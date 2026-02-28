import cv2
import numpy as np
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from collections import deque
import os
import uuid
import asyncio
import time
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
V_DOWN_THRESHOLD  = 0.30   # iris very near top of eye = looking DOWN
V_UP_THRESHOLD    = 0.55   # iris near bottom of eye = looking UP

BLINK_EAR_THRESHOLD = 0.10  # less sensitive — only real blinks

# ---------- STATE ----------
direction_history      = deque(maxlen=5)
frame_buffer           = deque(maxlen=10)   # 10s pre-violation footage
executor               = ThreadPoolExecutor(max_workers=2)
last_tracked_direction = None
pending_clips          = {}

# ---------- VIOLATION TRACKING ----------
violation_stats = {
    "GAZE_LEFT":        {"count": 0, "active_since": None, "event_fired": False},
    "GAZE_RIGHT":       {"count": 0, "active_since": None, "event_fired": False},
    "GAZE_DOWN":        {"count": 0, "active_since": None, "event_fired": False},
    "GAZE_UP":          {"count": 0, "active_since": None, "event_fired": False},
    "FACE_NOT_VISIBLE": {"count": 0, "active_since": None, "event_fired": False},
}
DIRECTION_TO_TYPE = {
    "LEFT":    "GAZE_LEFT",
    "RIGHT":   "GAZE_RIGHT",
    "DOWN":    "GAZE_DOWN",
    "UP":      "GAZE_UP",
    "NO_FACE": "FACE_NOT_VISIBLE",
}

GAZE_VIOLATIONS_DIR = "gaze_violations"
os.makedirs(GAZE_VIOLATIONS_DIR, exist_ok=True)


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


def determine_gaze_direction(h_ratio, v_ratio):
    if h_ratio is None:
        return "UNKNOWN"
    if h_ratio <= H_LEFT_THRESHOLD:
        return "LEFT"
    elif h_ratio >= H_RIGHT_THRESHOLD:
        return "RIGHT"
    elif v_ratio is not None and v_ratio <= V_DOWN_THRESHOLD:
        return "DOWN"
    elif v_ratio is not None and v_ratio >= V_UP_THRESHOLD:
        return "UP"
    else:
        return "CENTER"


def check_sustained_violation(direction):
    recent = list(direction_history)
    count  = 0
    for d in reversed(recent):
        if d == direction:
            count += 1
        else:
            break
    return count >= 3


def save_violation_video(frames):
    if not frames:
        return None
    try:
        filename   = f"{uuid.uuid4()}.mp4"
        video_path = os.path.join(GAZE_VIOLATIONS_DIR, filename)
        h, w       = frames[0].shape[:2]
        fourcc     = cv2.VideoWriter_fourcc(*'mp4v')
        out        = cv2.VideoWriter(video_path, fourcc, 1.0, (w, h))
        for f in frames:
            out.write(f)
        out.release()
        print(f"Violation video saved: {video_path}")
        return video_path
    except Exception as e:
        print(f"Video save error: {e}")
        return None


# ---------- STATS ENDPOINT ----------
@app.get("/stats")
async def get_stats():
    summary = {vt: {"count": data["count"]} for vt, data in violation_stats.items()}
    return {"stats": summary, "timestamp": datetime.now().isoformat()}


# ---------- MAIN ENDPOINT ----------
@app.post("/analyze-gaze")
async def analyze_gaze(frame: UploadFile = File(...)):
    global last_tracked_direction

    try:
        contents = await frame.read()
        np_arr   = np.frombuffer(contents, np.uint8)
        img      = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        if img is None:
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
            print(f"No face | History: {list(direction_history)}")

        else:
            landmarks = results.multi_face_landmarks[0].landmark

            # ---------- BLINK CHECK ----------
            if check_blink(landmarks, img_w, img_h):
                direction_history.append("BLINK")
                print(f"Blinking — skipping frame")
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
                return {"violation": False, "direction": "UNKNOWN", "reason": "Could not compute iris ratios"}

            current_direction = determine_gaze_direction(h_ratio, v_ratio)
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

        if current_direction in DIRECTION_TO_TYPE and check_sustained_violation(current_direction):
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
                        f"Student gaze {current_direction} for {event_duration}s "
                        f"— occurrence #{violation_stats[vtype]['count']}"
                    )
                    video_path = "gaze_violations/saving..."

                    # Start collecting post-violation frames (5 more seconds)
                    pending_clips[vtype] = {
                        "frames":        list(frame_buffer),
                        "collect_until": now + 5.0
                    }

        # ---------- COLLECT POST-VIOLATION FRAMES ----------
        completed_clips = []
        for vtype, clip in pending_clips.items():
            clip["frames"].append(img.copy())
            if now >= clip["collect_until"]:
                completed_clips.append(vtype)

        for vtype in completed_clips:
            clip_frames = pending_clips.pop(vtype)["frames"]
            loop = asyncio.get_event_loop()
            loop.run_in_executor(executor, save_violation_video, clip_frames)

        # ---------- STATS ----------
        stats_summary = {vt: {"count": data["count"]} for vt, data in violation_stats.items()}

        # ---------- LOGS ----------
        print(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        if h_ratio is not None:
            print(f"H Ratio: {h_ratio:.3f}  V Ratio: {v_ratio:.3f}")
        print(f"Direction: {current_direction} | History: {list(direction_history)}")
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