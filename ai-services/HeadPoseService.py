import asyncio
import os
import subprocess
import time
import uuid
from collections import deque
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime

import cv2
import mediapipe as mp
import numpy as np
from fastapi import FastAPI, File, Header, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

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
    min_tracking_confidence=0.5,
)

BASE_YAW_THRESHOLD = 20.0
BASE_PITCH_ABS = 15.0
POSE_SMOOTHING_ALPHA = 0.35
EVENT_MIN_SECONDS = 3.0
POST_VIOLATION_SECONDS = 5.0
EVENT_COOLDOWN_SECONDS = 2.0
CALIBRATION_COUNT = 15
SESSION_TIMEOUT_SECONDS = 120.0

executor = ThreadPoolExecutor(max_workers=2)

# ---------- VIOLATION TRACKING ----------
DIRECTION_TO_TYPE = {
    "LEFT": "HEAD_LEFT",
    "RIGHT": "HEAD_RIGHT",
    "DOWN": "HEAD_DOWN",
    "UP": "HEAD_UP",
    "NO_FACE": "FACE_NOT_VISIBLE",
}


def new_violation_stats():
    return {
        "HEAD_LEFT": {"count": 0, "active_since": None, "event_fired": False, "last_fired_at": None},
        "HEAD_RIGHT": {"count": 0, "active_since": None, "event_fired": False, "last_fired_at": None},
        "HEAD_DOWN": {"count": 0, "active_since": None, "event_fired": False, "last_fired_at": None},
        "HEAD_UP": {"count": 0, "active_since": None, "event_fired": False, "last_fired_at": None},
        "FACE_NOT_VISIBLE": {"count": 0, "active_since": None, "event_fired": False, "last_fired_at": None},
    }


def init_session_state():
    return {
        "dynamic_yaw_threshold": BASE_YAW_THRESHOLD,
        "dynamic_pitch_down": BASE_PITCH_ABS,
        "dynamic_pitch_up": -BASE_PITCH_ABS,
        "pose_history": deque(maxlen=5),
        "frame_buffer": deque(maxlen=10),
        "pending_clips": {},
        "smoothed_adj_yaw": None,
        "smoothed_adj_pitch": None,
        "violation_stats": new_violation_stats(),
        "last_tracked_direction": None,
        "calibration_yaws": [],
        "calibration_pitches": [],
        "baseline_yaw": 0.0,
        "baseline_pitch": 0.0,
        "is_calibrated": False,
        "last_seen": time.time(),
    }


session_states = {}


def get_session_state(session_id):
    state = session_states.get(session_id)
    if state is None:
        state = init_session_state()
        session_states[session_id] = state
    state["last_seen"] = time.time()
    return state


def cleanup_inactive_sessions():
    now = time.time()
    stale_ids = [
        sid
        for sid, state in session_states.items()
        if now - state.get("last_seen", now) > SESSION_TIMEOUT_SECONDS
    ]
    for sid in stale_ids:
        session_states.pop(sid, None)


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
HEAD_VIOLATIONS_DIR = os.path.join(BASE_DIR, "head_violations")
os.makedirs(HEAD_VIOLATIONS_DIR, exist_ok=True)
app.mount("/videos", StaticFiles(directory=HEAD_VIOLATIONS_DIR), name="head-violation-videos")

# ---------- LANDMARKS ----------
NOSE_TIP = 1
FOREHEAD = 10
CHIN = 152
LEFT_EAR = 234
RIGHT_EAR = 454
LEFT_EYE_OUT = 33
RIGHT_EYE_OUT = 263


def get_head_angles(landmarks, img_w, img_h):
    def lm(idx):
        return np.array([landmarks[idx].x * img_w, landmarks[idx].y * img_h])

    nose = lm(NOSE_TIP)
    forehead = lm(FOREHEAD)
    chin = lm(CHIN)
    left_ear = lm(LEFT_EAR)
    right_ear = lm(RIGHT_EAR)
    left_eye = lm(LEFT_EYE_OUT)
    right_eye = lm(RIGHT_EYE_OUT)

    ear_mid = (left_ear + right_ear) / 2
    ear_width = np.linalg.norm(right_ear - left_ear)
    if ear_width < 1:
        return None, None, None

    yaw_raw = (nose[0] - ear_mid[0]) / (ear_width / 2)
    yaw = float(np.degrees(np.arcsin(np.clip(yaw_raw, -1, 1))) * 2.5)
    yaw = float(np.clip(yaw, -90.0, 90.0))

    face_height = np.linalg.norm(chin - forehead)
    if face_height < 1:
        return yaw, None, None

    face_mid = (forehead + chin) / 2
    pitch_raw = (nose[1] - face_mid[1]) / (face_height / 2)
    pitch = float(np.degrees(np.arcsin(np.clip(pitch_raw, -1, 1))) * 2.0)
    pitch = float(np.clip(pitch, -90.0, 90.0))

    eye_delta = right_eye - left_eye
    roll = float(np.degrees(np.arctan2(eye_delta[1], eye_delta[0])))

    return yaw, pitch, roll


def update_dynamic_thresholds(state, yaws, pitches):
    if not yaws or not pitches:
        state["dynamic_yaw_threshold"] = BASE_YAW_THRESHOLD
        state["dynamic_pitch_down"] = BASE_PITCH_ABS
        state["dynamic_pitch_up"] = -BASE_PITCH_ABS
        return

    yaw_std = float(np.std(yaws))
    pitch_std = float(np.std(pitches))

    state["dynamic_yaw_threshold"] = float(
        np.clip(max(BASE_YAW_THRESHOLD, yaw_std * 2.8), BASE_YAW_THRESHOLD, 35.0)
    )
    pitch_abs = float(np.clip(max(BASE_PITCH_ABS, pitch_std * 2.5), BASE_PITCH_ABS, 30.0))
    state["dynamic_pitch_down"] = pitch_abs
    state["dynamic_pitch_up"] = -pitch_abs


def determine_head_direction(state, yaw, pitch):
    if yaw is None:
        return "UNKNOWN"

    adj_yaw = yaw - state["baseline_yaw"]
    adj_pitch = pitch - state["baseline_pitch"] if pitch is not None else 0

    if state["smoothed_adj_yaw"] is None:
        state["smoothed_adj_yaw"] = adj_yaw
        state["smoothed_adj_pitch"] = adj_pitch
    else:
        state["smoothed_adj_yaw"] = (POSE_SMOOTHING_ALPHA * adj_yaw) + (
            (1.0 - POSE_SMOOTHING_ALPHA) * state["smoothed_adj_yaw"]
        )
        state["smoothed_adj_pitch"] = (POSE_SMOOTHING_ALPHA * adj_pitch) + (
            (1.0 - POSE_SMOOTHING_ALPHA) * state["smoothed_adj_pitch"]
        )

    print(
        f"Raw -> Yaw: {yaw:.1f} Pitch: {pitch:.1f} | "
        f"Adjusted -> Yaw: {adj_yaw:.1f} Pitch: {adj_pitch:.1f} | "
        f"Smoothed -> Yaw: {state['smoothed_adj_yaw']:.1f} Pitch: {state['smoothed_adj_pitch']:.1f}"
    )

    if state["smoothed_adj_yaw"] < -state["dynamic_yaw_threshold"]:
        return "LEFT"
    if state["smoothed_adj_yaw"] > state["dynamic_yaw_threshold"]:
        return "RIGHT"
    if state["smoothed_adj_pitch"] < state["dynamic_pitch_up"]:
        return "UP"
    if state["smoothed_adj_pitch"] > state["dynamic_pitch_down"]:
        return "DOWN"
    return "CENTER"


def check_sustained_violation(direction, pose_history):
    recent = list(pose_history)
    count = 0
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
        temp_path = os.path.join(HEAD_VIOLATIONS_DIR, f"tmp_{filename}")
        h, w = frames[0].shape[:2]
        out = cv2.VideoWriter(temp_path, cv2.VideoWriter_fourcc(*"mp4v"), 1.0, (w, h))
        for f in frames:
            out.write(f)
        out.release()

        ffmpeg_cmd = [
            "ffmpeg",
            "-y",
            "-loglevel",
            "error",
            "-i",
            temp_path,
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
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
async def calibrate(
    frame: UploadFile = File(...),
    x_session_id: str | None = Header(default=None),
):
    try:
        cleanup_inactive_sessions()
        session_id = (x_session_id or "").strip() or "default"
        state = get_session_state(session_id)

        contents = await frame.read()
        np_arr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        if img is None:
            return {"calibrated": False, "reason": "Invalid image"}

        img_h, img_w = img.shape[:2]
        frame_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        results = face_mesh.process(frame_rgb)

        if not results.multi_face_landmarks:
            return {
                "session_id": session_id,
                "calibrated": state["is_calibrated"],
                "collected": len(state["calibration_yaws"]),
                "needed": CALIBRATION_COUNT,
                "reason": "No face detected - look straight at the camera",
            }

        landmarks = results.multi_face_landmarks[0].landmark
        yaw, pitch, _ = get_head_angles(landmarks, img_w, img_h)

        if yaw is None or pitch is None:
            return {"calibrated": False, "reason": "Could not compute angles"}

        state["calibration_yaws"].append(yaw)
        state["calibration_pitches"].append(pitch)
        collected = len(state["calibration_yaws"])
        print(f"[session={session_id}] Calibration frame {collected}/{CALIBRATION_COUNT} - Yaw: {yaw:.1f} Pitch: {pitch:.1f}")

        if collected >= CALIBRATION_COUNT:
            yaw_median = float(np.median(state["calibration_yaws"]))
            pitch_median = float(np.median(state["calibration_pitches"]))
            filtered_yaws = [y for y in state["calibration_yaws"] if abs(y - yaw_median) < 15]
            filtered_pitches = [p for p in state["calibration_pitches"] if abs(p - pitch_median) < 15]
            if len(filtered_yaws) < 5:
                filtered_yaws = state["calibration_yaws"]
                filtered_pitches = state["calibration_pitches"]

            state["baseline_yaw"] = float(np.mean(filtered_yaws))
            state["baseline_pitch"] = float(np.mean(filtered_pitches))
            update_dynamic_thresholds(state, filtered_yaws, filtered_pitches)
            state["smoothed_adj_yaw"] = None
            state["smoothed_adj_pitch"] = None
            state["is_calibrated"] = True

            print(
                f"[session={session_id}] Calibration complete - "
                f"Baseline Yaw: {state['baseline_yaw']:.1f} Pitch: {state['baseline_pitch']:.1f}"
            )
            return {
                "session_id": session_id,
                "calibrated": True,
                "baseline_yaw": round(state["baseline_yaw"], 1),
                "baseline_pitch": round(state["baseline_pitch"], 1),
                "yaw_threshold": round(state["dynamic_yaw_threshold"], 1),
                "pitch_threshold": round(state["dynamic_pitch_down"], 1),
                "message": "Calibration complete!",
            }

        return {
            "session_id": session_id,
            "calibrated": False,
            "collected": collected,
            "needed": CALIBRATION_COUNT,
            "message": f"Calibrating... {collected}/{CALIBRATION_COUNT} frames collected",
        }

    except Exception as e:
        import traceback

        print(f"Calibration error: {traceback.format_exc()}")
        return {"calibrated": False, "error": str(e)}


@app.post("/reset-calibration")
async def reset_calibration(x_session_id: str | None = Header(default=None)):
    cleanup_inactive_sessions()
    session_id = (x_session_id or "").strip() or "default"
    state = init_session_state()
    session_states[session_id] = state
    print(f"[session={session_id}] Calibration reset")
    return {"session_id": session_id, "reset": True, "message": "Calibration reset."}


# ---------- STATS ENDPOINT ----------
@app.get("/stats")
async def get_stats():
    cleanup_inactive_sessions()
    aggregated = {vt: {"count": 0} for vt in new_violation_stats().keys()}
    for state in session_states.values():
        for vt, data in state["violation_stats"].items():
            aggregated[vt]["count"] += data["count"]
    return {
        "active_sessions": len(session_states),
        "stats": aggregated,
        "timestamp": datetime.now().isoformat(),
    }


# ---------- MAIN ENDPOINT ----------
@app.post("/analyze-head-pose")
async def analyze_head_pose(
    frame: UploadFile = File(...),
    x_session_id: str | None = Header(default=None),
):
    try:
        cleanup_inactive_sessions()
        session_id = (x_session_id or "").strip() or "default"
        state = get_session_state(session_id)

        pose_history = state["pose_history"]
        frame_buffer = state["frame_buffer"]
        pending_clips = state["pending_clips"]
        violation_stats = state["violation_stats"]

        contents = await frame.read()
        np_arr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        if img is None:
            return {"violation": False, "direction": "UNKNOWN", "reason": "Invalid image"}

        frame_buffer.append(img.copy())
        now = time.time()

        # ---------- AUTO-CALIBRATION ----------
        if not state["is_calibrated"]:
            img_h, img_w = img.shape[:2]
            frame_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            results = face_mesh.process(frame_rgb)
            if results.multi_face_landmarks:
                lms = results.multi_face_landmarks[0].landmark
                yaw, pitch, _ = get_head_angles(lms, img_w, img_h)
                if yaw is not None and pitch is not None:
                    state["calibration_yaws"].append(yaw)
                    state["calibration_pitches"].append(pitch)
                    print(f"[session={session_id}] Auto-calibrating... {len(state['calibration_yaws'])}/{CALIBRATION_COUNT}")
                    if len(state["calibration_yaws"]) >= CALIBRATION_COUNT:
                        yaw_median = float(np.median(state["calibration_yaws"]))
                        pitch_median = float(np.median(state["calibration_pitches"]))
                        filtered_yaws = [fy for fy in state["calibration_yaws"] if abs(fy - yaw_median) < 15]
                        filtered_pitches = [fp for fp in state["calibration_pitches"] if abs(fp - pitch_median) < 15]
                        if len(filtered_yaws) < 5:
                            filtered_yaws = state["calibration_yaws"]
                            filtered_pitches = state["calibration_pitches"]

                        state["baseline_yaw"] = float(np.mean(filtered_yaws))
                        state["baseline_pitch"] = float(np.mean(filtered_pitches))
                        update_dynamic_thresholds(state, filtered_yaws, filtered_pitches)
                        state["smoothed_adj_yaw"] = None
                        state["smoothed_adj_pitch"] = None
                        state["is_calibrated"] = True
                        print(
                            f"[session={session_id}] Auto-calibration done - "
                            f"Baseline Yaw: {state['baseline_yaw']:.1f} Pitch: {state['baseline_pitch']:.1f}"
                        )

            return {
                "session_id": session_id,
                "violation": False,
                "direction": "CALIBRATING",
                "calibrated": state["is_calibrated"],
                "collected": len(state["calibration_yaws"]),
                "needed": CALIBRATION_COUNT,
                "yaw": None,
                "pitch": None,
                "roll": None,
                "timestamp": datetime.now().isoformat(),
            }

        # ---------- FACE DETECTION ----------
        img_h, img_w = img.shape[:2]
        frame_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        results = face_mesh.process(frame_rgb)

        if not results.multi_face_landmarks:
            pose_history.append("NO_FACE")
            current_direction = "NO_FACE"
            yaw = pitch = roll = None
        else:
            landmarks = results.multi_face_landmarks[0].landmark
            yaw, pitch, roll = get_head_angles(landmarks, img_w, img_h)
            if yaw is None:
                return {"violation": False, "direction": "UNKNOWN", "reason": "Angle computation failed"}
            current_direction = determine_head_direction(state, yaw, pitch)
            pose_history.append(current_direction)

        # ---------- PER-EVENT TRACKING ----------
        if state["last_tracked_direction"] != current_direction:
            if state["last_tracked_direction"] in DIRECTION_TO_TYPE:
                prev_type = DIRECTION_TO_TYPE[state["last_tracked_direction"]]
                violation_stats[prev_type]["active_since"] = None
                violation_stats[prev_type]["event_fired"] = False

            if current_direction in DIRECTION_TO_TYPE:
                vtype = DIRECTION_TO_TYPE[current_direction]
                violation_stats[vtype]["active_since"] = now
                violation_stats[vtype]["event_fired"] = False

            state["last_tracked_direction"] = current_direction

        # ---------- VIOLATION DETECTION ----------
        violation = False
        violation_type = None
        severity = None
        description = None
        video_path = None
        event_duration = None

        if current_direction in DIRECTION_TO_TYPE and check_sustained_violation(current_direction, pose_history):
            vtype = DIRECTION_TO_TYPE[current_direction]
            active_since = violation_stats[vtype]["active_since"]
            event_fired = violation_stats[vtype]["event_fired"]
            last_fired_at = violation_stats[vtype]["last_fired_at"]

            if active_since is not None and not event_fired:
                elapsed = now - active_since
                cooldown_ok = (last_fired_at is None) or ((now - last_fired_at) >= EVENT_COOLDOWN_SECONDS)
                if elapsed >= EVENT_MIN_SECONDS and cooldown_ok:
                    violation_stats[vtype]["count"] += 1
                    violation_stats[vtype]["event_fired"] = True
                    violation_stats[vtype]["last_fired_at"] = now

                    violation = True
                    violation_type = vtype
                    event_duration = round(elapsed, 1)
                    severity = (
                        "high"
                        if current_direction in ["LEFT", "RIGHT", "NO_FACE"]
                        else "medium" if current_direction == "DOWN" else "low"
                    )
                    description = (
                        f"Student looked {current_direction} for {event_duration}s "
                        f"- occurrence #{violation_stats[vtype]['count']}"
                    )
                    video_filename = f"{uuid.uuid4()}.mp4"
                    video_path = video_filename

                    clip_id = str(uuid.uuid4())
                    pending_clips[clip_id] = {
                        "frames": list(frame_buffer),
                        "filename": video_filename,
                        "collect_until": now + POST_VIOLATION_SECONDS,
                        "vtype": vtype,
                    }

        # ---------- COLLECT POST-VIOLATION FRAMES ----------
        completed_clips = []
        for clip_id, clip in pending_clips.items():
            clip["frames"].append(img.copy())
            if now >= clip["collect_until"]:
                completed_clips.append(clip_id)

        for clip_id in completed_clips:
            clip_data = pending_clips.pop(clip_id)
            loop = asyncio.get_running_loop()
            loop.run_in_executor(executor, save_violation_video, clip_data["frames"], clip_data["filename"])

        # ---------- STATS ----------
        stats_summary = {vt: {"count": data["count"]} for vt, data in violation_stats.items()}

        # ---------- LOGS ----------
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        if yaw is not None:
            print(
                f"Yaw: {yaw:.1f} (adj: {yaw - state['baseline_yaw']:.1f})  "
                f"Pitch: {pitch:.1f} (adj: {pitch - state['baseline_pitch']:.1f})"
            )
        print(f"[session={session_id}] Direction: {current_direction} | History: {list(pose_history)}")
        if violation:
            print(
                f"Violation: {violation_type} | Duration: {event_duration}s | "
                f"Count: {violation_stats[violation_type]['count']}"
            )
        active_counts = {vt: d["count"] for vt, d in violation_stats.items() if d["count"] > 0}
        if active_counts:
            print(f"Counts: {active_counts}")
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

        return {
            "session_id": session_id,
            "violation": violation,
            "type": violation_type,
            "severity": severity,
            "description": description,
            "direction": current_direction,
            "event_duration": event_duration,
            "calibrated": state["is_calibrated"],
            "yaw": round(yaw, 1) if yaw is not None else None,
            "pitch": round(pitch, 1) if pitch is not None else None,
            "roll": round(roll, 1) if roll is not None else None,
            "adj_yaw": round(yaw - state["baseline_yaw"], 1) if yaw is not None else None,
            "adj_pitch": round(pitch - state["baseline_pitch"], 1) if pitch is not None else None,
            "yaw_threshold": round(state["dynamic_yaw_threshold"], 1),
            "pitch_threshold": round(state["dynamic_pitch_down"], 1),
            "video_path": video_path,
            "stats": stats_summary,
            "timestamp": datetime.now().isoformat(),
        }

    except Exception as e:
        import traceback

        print(f"Head pose error: {traceback.format_exc()}")
        return {"violation": False, "direction": "UNKNOWN", "error": str(e)}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("HeadPoseService:app", host="0.0.0.0", port=8004, reload=True)
