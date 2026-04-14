import cv2
import numpy as np
from fastapi import FastAPI, File, Header, UploadFile
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

# ---------- MEDIAPIPE SETUP ----------
mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(
    static_image_mode=False,
    max_num_faces=1,
    refine_landmarks=True,   # REQUIRED for iris landmarks (468-477)
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5
)

# ---------- IRIS LANDMARK INDICES ----------
LEFT_EYE_LEFT    = 33
LEFT_EYE_RIGHT   = 133
LEFT_EYE_TOP     = 159
LEFT_EYE_BOTTOM  = 145
LEFT_IRIS        = 468   # iris center

RIGHT_EYE_LEFT   = 362
RIGHT_EYE_RIGHT  = 263
RIGHT_EYE_TOP    = 386
RIGHT_EYE_BOTTOM = 374
RIGHT_IRIS       = 473   # iris center

# ---------- THRESHOLDS ----------
# iris position ratio within eye width/height
# 0.0 = far left/top, 1.0 = far right/bottom, 0.5 = center
H_LEFT_THRESHOLD  = 0.40
H_RIGHT_THRESHOLD = 0.60
V_DOWN_ENTER_THRESHOLD = 0.34  # easier to enter DOWN for real low-light cams
V_DOWN_EXIT_THRESHOLD  = 0.40  # hysteresis to keep DOWN stable across jitter
V_UP_THRESHOLD    = 0.55   # iris near bottom of eye = looking UP

BLINK_EAR_THRESHOLD = 0.10  # less sensitive — only real blinks
RATIO_SMOOTHING_ALPHA = 0.40
EVENT_MIN_SECONDS = 3.0
EVENT_COOLDOWN_SECONDS = 2.0
POST_VIOLATION_SECONDS = 5.0

# ---------- STATE ----------
executor               = ThreadPoolExecutor(max_workers=2)
SESSION_TIMEOUT_SECONDS = 120.0


def new_violation_stats():
    return {
        "GAZE_LEFT":        {"count": 0, "active_since": None, "event_fired": False, "last_fired_at": None},
        "GAZE_RIGHT":       {"count": 0, "active_since": None, "event_fired": False, "last_fired_at": None},
        "GAZE_DOWN":        {"count": 0, "active_since": None, "event_fired": False, "last_fired_at": None},
        "GAZE_UP":          {"count": 0, "active_since": None, "event_fired": False, "last_fired_at": None},
        "FACE_NOT_VISIBLE": {"count": 0, "active_since": None, "event_fired": False, "last_fired_at": None},
    }


# session_id -> per-session runtime state
session_states = {}


def init_session_state():
    return {
        "direction_history": deque(maxlen=5),
        "frame_buffer": deque(maxlen=10),
        "last_tracked_direction": None,
        "pending_clips": {},
        "smoothed_h_ratio": None,
        "smoothed_v_ratio": None,
        "violation_stats": new_violation_stats(),
        "last_seen": time.time(),
    }


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


# ---------- VIOLATION TRACKING ----------
DIRECTION_TO_TYPE = {
    "LEFT":    "GAZE_LEFT",
    "RIGHT":   "GAZE_RIGHT",
    "DOWN":    "GAZE_DOWN",
    "UP":      "GAZE_UP",
    "NO_FACE": "FACE_NOT_VISIBLE",
}

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
GAZE_VIOLATIONS_DIR = os.path.join(BASE_DIR, "gaze_violations")
os.makedirs(GAZE_VIOLATIONS_DIR, exist_ok=True)
app.mount("/videos", StaticFiles(directory=GAZE_VIOLATIONS_DIR), name="gaze-violation-videos")


# ---------- CORE FUNCTIONS ----------

def get_iris_ratios(landmarks, img_w, img_h):
    """
    Returns iris position ratio within eye boundaries.
    h_ratio: 0.0=far left, 1.0=far right, 0.5=center
    v_ratio: 0.0=far up,   1.0=far down,  0.5=center
    Averages both eyes for stability.
    """
    def pt(idx):
        return np.array([landmarks[idx].x * img_w, landmarks[idx].y * img_h])

    # Left eye
    l_eye_w = pt(LEFT_EYE_RIGHT)[0]  - pt(LEFT_EYE_LEFT)[0]
    l_eye_h = pt(LEFT_EYE_BOTTOM)[1] - pt(LEFT_EYE_TOP)[1]
    if l_eye_w < 1 or l_eye_h < 1:
        return None, None
    l_h = (pt(LEFT_IRIS)[0]  - pt(LEFT_EYE_LEFT)[0]) / l_eye_w
    l_v = (pt(LEFT_IRIS)[1]  - pt(LEFT_EYE_TOP)[1])  / l_eye_h

    # Right eye
    r_eye_w = pt(RIGHT_EYE_RIGHT)[0]  - pt(RIGHT_EYE_LEFT)[0]
    r_eye_h = pt(RIGHT_EYE_BOTTOM)[1] - pt(RIGHT_EYE_TOP)[1]
    if r_eye_w < 1 or r_eye_h < 1:
        return None, None
    r_h = (pt(RIGHT_IRIS)[0] - pt(RIGHT_EYE_LEFT)[0]) / r_eye_w
    r_v = (pt(RIGHT_IRIS)[1] - pt(RIGHT_EYE_TOP)[1])  / r_eye_h

    return float((l_h + r_h) / 2), float((l_v + r_v) / 2)


def check_blink(landmarks, img_w, img_h):
    """
    Eye Aspect Ratio (EAR) — low value means eyes are closed/blinking.
    EAR = eye_height / eye_width
    """
    def pt(idx):
        return np.array([landmarks[idx].x * img_w, landmarks[idx].y * img_h])

    l_ear = np.linalg.norm(pt(LEFT_EYE_BOTTOM)  - pt(LEFT_EYE_TOP))  / \
            np.linalg.norm(pt(LEFT_EYE_RIGHT)   - pt(LEFT_EYE_LEFT))
    r_ear = np.linalg.norm(pt(RIGHT_EYE_BOTTOM) - pt(RIGHT_EYE_TOP)) / \
            np.linalg.norm(pt(RIGHT_EYE_RIGHT)  - pt(RIGHT_EYE_LEFT))

    return ((l_ear + r_ear) / 2) < BLINK_EAR_THRESHOLD


def determine_gaze_direction(h_ratio, v_ratio, prev_direction, smoothed_h_ratio, smoothed_v_ratio):
    if h_ratio is None:
        return "UNKNOWN", smoothed_h_ratio, smoothed_v_ratio

    if smoothed_h_ratio is None:
        smoothed_h_ratio = h_ratio
    else:
        smoothed_h_ratio = (RATIO_SMOOTHING_ALPHA * h_ratio) + ((1.0 - RATIO_SMOOTHING_ALPHA) * smoothed_h_ratio)

    if v_ratio is not None:
        if smoothed_v_ratio is None:
            smoothed_v_ratio = v_ratio
        else:
            smoothed_v_ratio = (RATIO_SMOOTHING_ALPHA * v_ratio) + ((1.0 - RATIO_SMOOTHING_ALPHA) * smoothed_v_ratio)

    h_for_decision = smoothed_h_ratio if smoothed_h_ratio is not None else h_ratio
    v_for_decision = smoothed_v_ratio if smoothed_v_ratio is not None else v_ratio

    if h_for_decision <= H_LEFT_THRESHOLD:
        return "LEFT", smoothed_h_ratio, smoothed_v_ratio
    elif h_for_decision >= H_RIGHT_THRESHOLD:
        return "RIGHT", smoothed_h_ratio, smoothed_v_ratio

    # Down-specific hysteresis: easier to enter DOWN and stable while staying DOWN
    if v_for_decision is not None:
        if prev_direction == "DOWN":
            if v_for_decision <= V_DOWN_EXIT_THRESHOLD:
                return "DOWN", smoothed_h_ratio, smoothed_v_ratio
        elif v_for_decision <= V_DOWN_ENTER_THRESHOLD:
            return "DOWN", smoothed_h_ratio, smoothed_v_ratio

        if v_for_decision >= V_UP_THRESHOLD:
            return "UP", smoothed_h_ratio, smoothed_v_ratio

    return "CENTER", smoothed_h_ratio, smoothed_v_ratio


def check_sustained_violation(direction, direction_history):
    recent = list(direction_history)
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
        video_path = os.path.join(GAZE_VIOLATIONS_DIR, filename)
        temp_path  = os.path.join(GAZE_VIOLATIONS_DIR, f"tmp_{filename}")
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


# ---------- STATS ENDPOINT ----------
@app.get("/stats")
async def get_stats():
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
@app.post("/analyze-gaze")
async def analyze_gaze(
    frame: UploadFile = File(...),
    x_session_id: str | None = Header(default=None),
):

    try:
        cleanup_inactive_sessions()
        session_id = (x_session_id or "").strip() or "default"
        state = get_session_state(session_id)

        direction_history = state["direction_history"]
        frame_buffer = state["frame_buffer"]
        pending_clips = state["pending_clips"]
        violation_stats = state["violation_stats"]
        last_tracked_direction = state["last_tracked_direction"]
        smoothed_h_ratio = state["smoothed_h_ratio"]
        smoothed_v_ratio = state["smoothed_v_ratio"]

        def persist_session_state():
            state["last_tracked_direction"] = last_tracked_direction
            state["smoothed_h_ratio"] = smoothed_h_ratio
            state["smoothed_v_ratio"] = smoothed_v_ratio
            state["last_seen"] = time.time()

        contents = await frame.read()
        np_arr   = np.frombuffer(contents, np.uint8)
        img      = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        if img is None:
            persist_session_state()
            return {"violation": False, "direction": "UNKNOWN", "reason": "Invalid image"}

        frame_buffer.append(img.copy())
        now = time.time()

        img_h, img_w = img.shape[:2]
        frame_rgb    = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        results      = face_mesh.process(frame_rgb)

        h_ratio = v_ratio = None

        # ---------- NO FACE ----------
        if not results.multi_face_landmarks:
            direction_history.append("NO_FACE")
            current_direction = "NO_FACE"
            smoothed_h_ratio = None
            smoothed_v_ratio = None
            print(f"No face | History: {list(direction_history)}")

        else:
            landmarks = results.multi_face_landmarks[0].landmark

            # ---------- BLINK CHECK ----------
            if check_blink(landmarks, img_w, img_h):
                direction_history.append("BLINK")
                smoothed_h_ratio = None
                smoothed_v_ratio = None
                print(f"Blinking — skipping frame")
                persist_session_state()
                return {
                    "violation":  False,
                    "direction":  "BLINK",
                    "h_ratio":    None,
                    "v_ratio":    None,
                    "stats":      {vt: {"count": d["count"]} for vt, d in violation_stats.items()},
                    "timestamp":  datetime.now().isoformat()
                }

            # ---------- IRIS TRACKING ----------
            h_ratio, v_ratio = get_iris_ratios(landmarks, img_w, img_h)

            if h_ratio is None:
                persist_session_state()
                return {"violation": False, "direction": "UNKNOWN", "reason": "Could not compute iris ratios"}

            current_direction, smoothed_h_ratio, smoothed_v_ratio = determine_gaze_direction(
                h_ratio, v_ratio, last_tracked_direction, smoothed_h_ratio, smoothed_v_ratio
            )
            direction_history.append(current_direction)

        # ---------- PER-EVENT TRACKING ----------
        if last_tracked_direction != current_direction:
            if last_tracked_direction in DIRECTION_TO_TYPE:
                prev_type = DIRECTION_TO_TYPE[last_tracked_direction]
                violation_stats[prev_type]["active_since"] = None
                violation_stats[prev_type]["event_fired"]  = False

            if current_direction in DIRECTION_TO_TYPE:
                vtype = DIRECTION_TO_TYPE[current_direction]
                violation_stats[vtype]["active_since"] = now
                violation_stats[vtype]["event_fired"]  = False

            last_tracked_direction = current_direction

        # ---------- VIOLATION DETECTION ----------
        violation      = False
        violation_type = None
        severity       = None
        description    = None
        video_path     = None
        event_duration = None

        if current_direction in DIRECTION_TO_TYPE and check_sustained_violation(current_direction, direction_history):
            vtype        = DIRECTION_TO_TYPE[current_direction]
            active_since = violation_stats[vtype]["active_since"]
            event_fired  = violation_stats[vtype]["event_fired"]
            last_fired_at = violation_stats[vtype]["last_fired_at"]

            if active_since is not None and not event_fired:
                elapsed = now - active_since
                cooldown_ok = (last_fired_at is None) or ((now - last_fired_at) >= EVENT_COOLDOWN_SECONDS)
                if elapsed >= EVENT_MIN_SECONDS and cooldown_ok:
                    violation_stats[vtype]["count"]      += 1
                    violation_stats[vtype]["event_fired"] = True
                    violation_stats[vtype]["last_fired_at"] = now

                    violation      = True
                    violation_type = vtype
                    event_duration = round(elapsed, 1)
                    severity       = "high"   if current_direction in ["LEFT", "RIGHT", "NO_FACE"] else \
                                     "medium" if current_direction == "DOWN" else "low"
                    description    = (
                        f"Student gaze {current_direction} for {event_duration}s "
                        f"— occurrence #{violation_stats[vtype]['count']}"
                    )
                    video_filename = f"{uuid.uuid4()}.mp4"
                    video_path = video_filename

                    # Start collecting post-violation frames (5 more seconds)
                    clip_id = str(uuid.uuid4())
                    pending_clips[clip_id] = {
                        "frames":        list(frame_buffer),
                        "filename":      video_filename,
                        "collect_until": now + POST_VIOLATION_SECONDS
                    }

        # ---------- COLLECT POST-VIOLATION FRAMES ----------
        completed_clips = []
        for clip_id, clip in pending_clips.items():
            clip["frames"].append(img.copy())
            if now >= clip["collect_until"]:
                completed_clips.append(clip_id)

        for clip_id in completed_clips:
            clip_data = pending_clips.pop(clip_id)
            clip_frames = clip_data["frames"]
            clip_filename = clip_data["filename"]
            loop = asyncio.get_event_loop()
            loop.run_in_executor(executor, save_violation_video, clip_frames, clip_filename)

        # ---------- STATS ----------
        stats_summary = {vt: {"count": data["count"]} for vt, data in violation_stats.items()}

        # ---------- LOGS ----------
        print(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        if h_ratio is not None:
            print(f"H Ratio: {h_ratio:.3f}  V Ratio: {v_ratio:.3f}")
        print(f"[session={session_id}] Direction: {current_direction} | History: {list(direction_history)}")
        if violation:
            print(f"🚨 Violation: {violation_type} | Duration: {event_duration}s | Count: {violation_stats[violation_type]['count']}")
        active_counts = {vt: d["count"] for vt, d in violation_stats.items() if d["count"] > 0}
        if active_counts:
            print(f"Counts: {active_counts}")
        print(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

        persist_session_state()
        return {
            "session_id":     session_id,
            "violation":      violation,
            "type":           violation_type,
            "severity":       severity,
            "description":    description,
            "direction":      current_direction,
            "event_duration": event_duration,
            "h_ratio":        round(h_ratio, 3) if h_ratio is not None else None,
            "v_ratio":        round(v_ratio, 3) if v_ratio is not None else None,
            "video_path":     video_path,
            "stats":          stats_summary,
            "timestamp":      datetime.now().isoformat()
        }

    except Exception as e:
        import traceback
        print(f"Gaze analysis error: {traceback.format_exc()}")
        return {"violation": False, "direction": "UNKNOWN", "error": str(e)}
