import cv2
import numpy as np
from fastapi import FastAPI, File, UploadFile
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from collections import deque
import os
import uuid
import asyncio
import time
import subprocess
from concurrent.futures import ThreadPoolExecutor
import mediapipe as mp

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(
    static_image_mode=False,
    max_num_faces=1,
    refine_landmarks=True,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5
)

YAW_THRESHOLD  = 20
PITCH_DOWN     = 15
PITCH_UP       = -15

pose_history  = deque(maxlen=5)
frame_buffer  = deque(maxlen=10)   # keep 10s of pre-violation footage
executor      = ThreadPoolExecutor(max_workers=2)

# Pending violation clips: tracks violations waiting for post-violation frames
# {vtype: {"frames": [...pre+violation frames], "collect_until": timestamp}}
pending_clips = {}

# ---------- VIOLATION TRACKING ----------
# count       = how many times they looked away for 3+ seconds
# active_since = when the current look-away event started
# event_fired  = True once violation fires for this event (prevents re-firing same event)
violation_stats = {
    "HEAD_LEFT":        {"count": 0, "active_since": None, "event_fired": False},
    "HEAD_RIGHT":       {"count": 0, "active_since": None, "event_fired": False},
    "HEAD_DOWN":        {"count": 0, "active_since": None, "event_fired": False},
    "HEAD_UP":          {"count": 0, "active_since": None, "event_fired": False},
    "FACE_NOT_VISIBLE": {"count": 0, "active_since": None, "event_fired": False},
}
DIRECTION_TO_TYPE = {
    "LEFT":    "HEAD_LEFT",
    "RIGHT":   "HEAD_RIGHT",
    "DOWN":    "HEAD_DOWN",
    "UP":      "HEAD_UP",
    "NO_FACE": "FACE_NOT_VISIBLE",
}
last_tracked_direction = None

# ---------- CALIBRATION STATE ----------
CALIBRATION_COUNT   = 15
calibration_yaws    = []
calibration_pitches = []
baseline_yaw        = 0.0
baseline_pitch      = 0.0
is_calibrated       = False

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
HEAD_VIOLATIONS_DIR = os.path.join(BASE_DIR, "head_violations")
os.makedirs(HEAD_VIOLATIONS_DIR, exist_ok=True)
app.mount("/videos", StaticFiles(directory=HEAD_VIOLATIONS_DIR), name="head-violation-videos")

# ---------- LANDMARKS ----------
NOSE_TIP      = 1
FOREHEAD      = 10
CHIN          = 152
LEFT_EAR      = 234
RIGHT_EAR     = 454
LEFT_EYE_OUT  = 33
RIGHT_EYE_OUT = 263


def get_head_angles(landmarks, img_w, img_h):
    def lm(idx):
        return np.array([landmarks[idx].x * img_w, landmarks[idx].y * img_h])

    nose      = lm(NOSE_TIP)
    forehead  = lm(FOREHEAD)
    chin      = lm(CHIN)
    left_ear  = lm(LEFT_EAR)
    right_ear = lm(RIGHT_EAR)
    left_eye  = lm(LEFT_EYE_OUT)
    right_eye = lm(RIGHT_EYE_OUT)

    ear_mid   = (left_ear + right_ear) / 2
    ear_width = np.linalg.norm(right_ear - left_ear)
    if ear_width < 1:
        return None, None, None

    yaw_raw = (nose[0] - ear_mid[0]) / (ear_width / 2)
    yaw     = float(np.degrees(np.arcsin(np.clip(yaw_raw, -1, 1))) * 2.5)
    yaw     = float(np.clip(yaw, -90.0, 90.0))  # prevent ±225° garbage values

    face_height = np.linalg.norm(chin - forehead)
    if face_height < 1:
        return yaw, None, None

    face_mid  = (forehead + chin) / 2
    pitch_raw = (nose[1] - face_mid[1]) / (face_height / 2)
    pitch     = float(np.degrees(np.arcsin(np.clip(pitch_raw, -1, 1))) * 2.0)
    pitch     = float(np.clip(pitch, -90.0, 90.0))

    eye_delta = right_eye - left_eye
    roll      = float(np.degrees(np.arctan2(eye_delta[1], eye_delta[0])))

    return yaw, pitch, roll


def determine_head_direction(yaw, pitch):
    if yaw is None:
        return "UNKNOWN"

    adj_yaw   = yaw   - baseline_yaw
    adj_pitch = pitch - baseline_pitch if pitch is not None else 0

    print(f"Raw → Yaw: {yaw:.1f}° Pitch: {pitch:.1f}°  |  Adjusted → Yaw: {adj_yaw:.1f}° Pitch: {adj_pitch:.1f}°")

    if adj_yaw < -YAW_THRESHOLD:
        return "LEFT"
    elif adj_yaw > YAW_THRESHOLD:
        return "RIGHT"
    elif adj_pitch < PITCH_UP:
        return "UP"
    elif adj_pitch > PITCH_DOWN:
        return "DOWN"
    else:
        return "CENTER"


def check_sustained_violation(direction):
    recent = list(pose_history)
    count  = 0
    for d in reversed(recent):
        if d == direction:
            count += 1
        else:
            break
    return count >= 3


def save_violation_video(frames, filename):
    if not frames:
        return None
    temp_path = None
    try:
        video_path = os.path.join(HEAD_VIOLATIONS_DIR, filename)
        temp_path  = os.path.join(HEAD_VIOLATIONS_DIR, f"tmp_{filename}")
        h, w       = frames[0].shape[:2]
        fourcc     = cv2.VideoWriter_fourcc(*'mp4v')
        out        = cv2.VideoWriter(temp_path, fourcc, 1.0, (w, h))
        for f in frames:
            out.write(f)
        out.release()

        # Browser-friendly H.264 output for HTML5 <video> playback
        ffmpeg_cmd = [
            "ffmpeg",
            "-y",
            "-loglevel", "error",
            "-i", temp_path,
            "-c:v", "libx264",
            "-pix_fmt", "yuv420p",
            "-movflags", "+faststart",
            video_path,
        ]
        transcode = subprocess.run(ffmpeg_cmd, capture_output=True, text=True)
        if transcode.returncode == 0 and os.path.exists(video_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass
            print(f"Violation video saved: {video_path}")
            return video_path

        # Fallback: keep original file if transcode fails
        if temp_path and os.path.exists(temp_path):
            os.replace(temp_path, video_path)
        print(f"FFmpeg transcode failed, saved fallback video: {video_path}")
        return video_path
    except Exception as e:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass
        print(f"Video save error: {e}")
        return None


# ---------- CALIBRATION ENDPOINT ----------
@app.post("/calibrate")
async def calibrate(frame: UploadFile = File(...)):
    global calibration_yaws, calibration_pitches, baseline_yaw, baseline_pitch, is_calibrated

    try:
        contents  = await frame.read()
        np_arr    = np.frombuffer(contents, np.uint8)
        img       = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        if img is None:
            return {"calibrated": False, "reason": "Invalid image"}

        img_h, img_w = img.shape[:2]
        frame_rgb    = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        results      = face_mesh.process(frame_rgb)

        if not results.multi_face_landmarks:
            return {
                "calibrated": is_calibrated,
                "collected":  len(calibration_yaws),
                "needed":     CALIBRATION_COUNT,
                "reason":     "No face detected — look straight at the camera"
            }

        landmarks        = results.multi_face_landmarks[0].landmark
        yaw, pitch, roll = get_head_angles(landmarks, img_w, img_h)

        if yaw is None or pitch is None:
            return {"calibrated": False, "reason": "Could not compute angles"}

        calibration_yaws.append(yaw)
        calibration_pitches.append(pitch)

        collected = len(calibration_yaws)
        print(f"Calibration frame {collected}/{CALIBRATION_COUNT} — Yaw: {yaw:.1f}° Pitch: {pitch:.1f}°")

        if collected >= CALIBRATION_COUNT:
            yaw_median       = float(np.median(calibration_yaws))
            pitch_median     = float(np.median(calibration_pitches))
            filtered_yaws    = [y for y in calibration_yaws    if abs(y - yaw_median)   < 15]
            filtered_pitches = [p for p in calibration_pitches if abs(p - pitch_median) < 15]
            if len(filtered_yaws) < 5:
                filtered_yaws    = calibration_yaws
                filtered_pitches = calibration_pitches
            baseline_yaw   = float(np.mean(filtered_yaws))
            baseline_pitch = float(np.mean(filtered_pitches))
            is_calibrated  = True
            print(f"✅ Calibration complete — Baseline Yaw: {baseline_yaw:.1f}° Pitch: {baseline_pitch:.1f}°")
            return {
                "calibrated":     True,
                "baseline_yaw":   round(baseline_yaw,   1),
                "baseline_pitch": round(baseline_pitch, 1),
                "message":        "Calibration complete!"
            }

        return {
            "calibrated": False,
            "collected":  collected,
            "needed":     CALIBRATION_COUNT,
            "message":    f"Calibrating... {collected}/{CALIBRATION_COUNT} frames collected"
        }

    except Exception as e:
        import traceback
        print(f"Calibration error: {traceback.format_exc()}")
        return {"calibrated": False, "error": str(e)}


@app.post("/reset-calibration")
async def reset_calibration():
    global calibration_yaws, calibration_pitches, baseline_yaw, baseline_pitch, is_calibrated
    calibration_yaws    = []
    calibration_pitches = []
    baseline_yaw        = 0.0
    baseline_pitch      = 0.0
    is_calibrated       = False
    print("🔄 Calibration reset")
    return {"reset": True, "message": "Calibration reset."}


# ---------- STATS ENDPOINT ----------
@app.get("/stats")
async def get_stats():
    """Returns violation frequency counts per type"""
    summary = {vt: {"count": data["count"]} for vt, data in violation_stats.items()}
    return {"stats": summary, "timestamp": datetime.now().isoformat()}


# ---------- MAIN ENDPOINT ----------
@app.post("/analyze-head-pose")
async def analyze_head_pose(frame: UploadFile = File(...)):
    global baseline_yaw, baseline_pitch, is_calibrated, last_tracked_direction

    try:
        contents = await frame.read()
        np_arr   = np.frombuffer(contents, np.uint8)
        img      = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        if img is None:
            return {"violation": False, "direction": "UNKNOWN", "reason": "Invalid image"}

        frame_buffer.append(img.copy())
        now = time.time()

        # ---------- AUTO-CALIBRATION ----------
        if not is_calibrated:
            img_h, img_w = img.shape[:2]
            frame_rgb    = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            results      = face_mesh.process(frame_rgb)
            if results.multi_face_landmarks:
                lms     = results.multi_face_landmarks[0].landmark
                y, p, _ = get_head_angles(lms, img_w, img_h)
                if y is not None and p is not None:
                    calibration_yaws.append(y)
                    calibration_pitches.append(p)
                    print(f"Auto-calibrating... {len(calibration_yaws)}/{CALIBRATION_COUNT}")
                    if len(calibration_yaws) >= CALIBRATION_COUNT:
                        yaw_median       = float(np.median(calibration_yaws))
                        pitch_median     = float(np.median(calibration_pitches))
                        filtered_yaws    = [fy for fy in calibration_yaws    if abs(fy - yaw_median)   < 15]
                        filtered_pitches = [fp for fp in calibration_pitches if abs(fp - pitch_median) < 15]
                        if len(filtered_yaws) < 5:
                            filtered_yaws    = calibration_yaws
                            filtered_pitches = calibration_pitches
                        baseline_yaw   = float(np.mean(filtered_yaws))
                        baseline_pitch = float(np.mean(filtered_pitches))
                        is_calibrated  = True
                        print(f"✅ Auto-calibration done — Baseline Yaw: {baseline_yaw:.1f}° Pitch: {baseline_pitch:.1f}°")

            return {
                "violation":  False,
                "direction":  "CALIBRATING",
                "calibrated": is_calibrated,
                "collected":  len(calibration_yaws),
                "needed":     CALIBRATION_COUNT,
                "yaw": None, "pitch": None, "roll": None,
                "timestamp":  datetime.now().isoformat()
            }

        # ---------- FACE DETECTION ----------
        img_h, img_w = img.shape[:2]
        frame_rgb    = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        results      = face_mesh.process(frame_rgb)

        if not results.multi_face_landmarks:
            pose_history.append("NO_FACE")
            current_direction = "NO_FACE"
            yaw = pitch = roll = None
        else:
            landmarks        = results.multi_face_landmarks[0].landmark
            yaw, pitch, roll = get_head_angles(landmarks, img_w, img_h)
            if yaw is None:
                return {"violation": False, "direction": "UNKNOWN", "reason": "Angle computation failed"}
            current_direction = determine_head_direction(yaw, pitch)
            pose_history.append(current_direction)

        # ---------- PER-EVENT TRACKING ----------
        # When direction changes: reset previous event, start new event timer
        if last_tracked_direction != current_direction:
            # Close previous event
            if last_tracked_direction in DIRECTION_TO_TYPE:
                prev_type = DIRECTION_TO_TYPE[last_tracked_direction]
                violation_stats[prev_type]["active_since"] = None
                violation_stats[prev_type]["event_fired"]  = False

            # Start new event timer
            if current_direction in DIRECTION_TO_TYPE:
                vtype = DIRECTION_TO_TYPE[current_direction]
                violation_stats[vtype]["active_since"] = now
                violation_stats[vtype]["event_fired"]  = False

            last_tracked_direction = current_direction

        # ---------- VIOLATION DETECTION ----------
        # Fires ONCE per event when student has been looking away for 3+ seconds
        violation      = False
        violation_type = None
        severity       = None
        description    = None
        video_path     = None
        event_duration = None

        if current_direction in DIRECTION_TO_TYPE:
            vtype        = DIRECTION_TO_TYPE[current_direction]
            active_since = violation_stats[vtype]["active_since"]
            event_fired  = violation_stats[vtype]["event_fired"]

            if active_since is not None and not event_fired:
                elapsed = now - active_since
                if elapsed >= 3.0:
                    violation_stats[vtype]["count"]      += 1
                    violation_stats[vtype]["event_fired"] = True

                    violation      = True
                    violation_type = vtype
                    event_duration = round(elapsed, 1)
                    severity       = "high"   if current_direction in ["LEFT", "RIGHT", "NO_FACE"] else \
                                     "medium" if current_direction == "DOWN" else "low"
                    description    = (
                        f"Student looked {current_direction} for {event_duration}s "
                        f"— occurrence #{violation_stats[vtype]['count']}"
                    )
                    video_filename = f"{uuid.uuid4()}.mp4"
                    video_path = video_filename

                    # Start collecting post-violation frames (5 more seconds)
                    pending_clips[vtype] = {
                        "frames":        list(frame_buffer),   # pre-violation frames
                        "filename":      video_filename,
                        "collect_until": now + 5.0             # collect for 5 more seconds
                    }

        # ---------- COLLECT POST-VIOLATION FRAMES ----------
        # Add current frame to any pending clips still within their collection window
        completed_clips = []
        for vtype, clip in pending_clips.items():
            clip["frames"].append(img.copy() if img is not None else frame_buffer[-1])
            if now >= clip["collect_until"]:
                completed_clips.append(vtype)

        # Save completed clips (post-violation window expired)
        for vtype in completed_clips:
            clip_data = pending_clips.pop(vtype)
            clip_frames = clip_data["frames"]
            clip_filename = clip_data["filename"]
            loop = asyncio.get_event_loop()
            loop.run_in_executor(executor, save_violation_video, clip_frames, clip_filename)

        # ---------- STATS ----------
        stats_summary = {vt: {"count": data["count"]} for vt, data in violation_stats.items()}

        # ---------- LOGS ----------
        print(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        if yaw is not None:
            print(f"Yaw: {yaw:.1f}° (adj: {yaw-baseline_yaw:.1f}°)  Pitch: {pitch:.1f}° (adj: {pitch-baseline_pitch:.1f}°)")
        print(f"Direction: {current_direction} | History: {list(pose_history)}")
        if violation:
            print(f"🚨 Violation: {violation_type} | Duration: {event_duration}s | Count: {violation_stats[violation_type]['count']}")
        active_counts = {vt: d["count"] for vt, d in violation_stats.items() if d["count"] > 0}
        if active_counts:
            print(f"Counts: {active_counts}")
        print(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

        return {
            "violation":      violation,
            "type":           violation_type,
            "severity":       severity,
            "description":    description,
            "direction":      current_direction,
            "event_duration": event_duration,   # duration of THIS event only (not cumulative)
            "calibrated":     is_calibrated,
            "yaw":            round(yaw,   1) if yaw   is not None else None,
            "pitch":          round(pitch, 1) if pitch is not None else None,
            "roll":           round(roll,  1) if roll  is not None else None,
            "adj_yaw":        round(yaw   - baseline_yaw,   1) if yaw   is not None else None,
            "adj_pitch":      round(pitch - baseline_pitch, 1) if pitch is not None else None,
            "video_path":     video_path,
            "stats":          stats_summary,
            "timestamp":      datetime.now().isoformat()
        }

    except Exception as e:
        import traceback
        print(f"Head pose error: {traceback.format_exc()}")
        return {"violation": False, "direction": "UNKNOWN", "error": str(e)}
