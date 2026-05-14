import asyncio
import os
import subprocess
import time
import uuid
from collections import deque
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime

import cv2
import numpy as np
from fastapi import FastAPI, File, Header, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from ultralytics import YOLO

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- STATIC FILES ----------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
OBJECT_VIOLATIONS_DIR = os.path.join(BASE_DIR, "object_violations")
os.makedirs(OBJECT_VIOLATIONS_DIR, exist_ok=True)
app.mount("/videos", StaticFiles(directory=OBJECT_VIOLATIONS_DIR), name="object-violation-videos")

# ---------- YOLO MODEL ----------
print("Loading YOLOv8 nano model...")
model = YOLO("yolov8n.pt")
print("YOLOv8 nano loaded!")

# ---------- VIOLATION OBJECTS ----------
VIOLATION_OBJECTS = {
    "cell phone": {"type": "OBJECT_PHONE", "severity": "high", "label": "Cell Phone"},
}
PERSON_CLASS = "person"
ALLOWED_CLASSES = {"cell phone", "person"}
MULTI_PERSON_TYPE = "OBJECT_MULTIPLE_PERSONS"

# ---------- DETECTION TUNING ----------
DEFAULT_CONF_THRESHOLD = 0.35
LOW_LIGHT_CONF_REDUCTION = 0.06
MIN_CONF_FLOOR = 0.22
LOW_LIGHT_BRIGHTNESS_THRESHOLD = 90.0
VERY_DARK_BRIGHTNESS_THRESHOLD = 55.0

CLASS_CONF_THRESHOLDS = {
    "cell phone": 0.30,
    "person": 0.35,
}

# Minimum box area / frame area by class.
MIN_BOX_AREA_RATIO = {
    "cell phone": 0.0007,
    "person": 0.02,
}

# Multi-frame consistency to avoid flicker false positives.
PERSISTENCE_WINDOW = 3
PERSISTENCE_REQUIRED_HITS = 2

# Per-type violation cooldown (seconds between DB log entries for the same type).
# Also controls streak fill speed: streak 2/2 fires after 1 cooldown window (~10s).
VIOLATION_COOLDOWNS = {
    "OBJECT_PHONE": 10.0,
    "OBJECT_MULTIPLE_PERSONS": 10.0,
}
DEFAULT_VIOLATION_COOLDOWN = 10.0
POST_VIOLATION_SECONDS = 5.0
SESSION_TIMEOUT_SECONDS = 120.0
executor = ThreadPoolExecutor(max_workers=2)

# session_id -> state bucket
session_states = {}


def init_session_state():
    presence = {obj["type"]: deque(maxlen=PERSISTENCE_WINDOW) for obj in VIOLATION_OBJECTS.values()}
    presence[MULTI_PERSON_TYPE] = deque(maxlen=PERSISTENCE_WINDOW)
    return {
        "violation_stats": {},
        "last_violation_time": {},
        "frame_buffer": deque(maxlen=10),
        "pending_clips": {},
        "presence_history": presence,
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


def estimate_brightness(img):
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    return float(np.mean(hsv[:, :, 2]))


def enhance_for_low_light(img):
    """
    Improve visibility in low-light frames while preserving edge detail.
    """
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l_channel, a_channel, b_channel = cv2.split(lab)

    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l_eq = clahe.apply(l_channel)
    enhanced = cv2.cvtColor(cv2.merge((l_eq, a_channel, b_channel)), cv2.COLOR_LAB2BGR)

    brightness = estimate_brightness(img)
    if brightness < VERY_DARK_BRIGHTNESS_THRESHOLD:
        gamma = 1.6
    elif brightness < LOW_LIGHT_BRIGHTNESS_THRESHOLD:
        gamma = 1.35
    else:
        gamma = 1.0

    if gamma != 1.0:
        table = np.array([((i / 255.0) ** (1.0 / gamma)) * 255 for i in range(256)], dtype=np.uint8)
        enhanced = cv2.LUT(enhanced, table)

    return enhanced


def get_dynamic_conf_threshold(class_name, brightness):
    base = CLASS_CONF_THRESHOLDS.get(class_name, DEFAULT_CONF_THRESHOLD)
    if brightness < LOW_LIGHT_BRIGHTNESS_THRESHOLD:
        base = max(MIN_CONF_FLOOR, base - LOW_LIGHT_CONF_REDUCTION)
    return base


def is_valid_box(det, img_h, img_w):
    x1, y1, x2, y2 = det["box"]
    box_w = max(0.0, x2 - x1)
    box_h = max(0.0, y2 - y1)
    frame_area = float(img_h * img_w)
    if frame_area <= 0:
        return False

    area_ratio = (box_w * box_h) / frame_area
    min_ratio = MIN_BOX_AREA_RATIO.get(det["class"], 0.0006)
    return area_ratio >= min_ratio


def detect_objects(img):
    """
    Run YOLO detection with low-light enhancement + class-specific filtering.
    """
    brightness = estimate_brightness(img)
    processed = enhance_for_low_light(img) if brightness < LOW_LIGHT_BRIGHTNESS_THRESHOLD else img

    results = model(processed, conf=MIN_CONF_FLOOR, verbose=False, imgsz=640)[0]
    detections = []
    img_h, img_w = img.shape[:2]

    for box in results.boxes:
        cls_name = model.names[int(box.cls[0])]
        if cls_name not in ALLOWED_CLASSES:
            continue
        conf = float(box.conf[0])
        det = {
            "class": cls_name,
            "confidence": round(conf, 3),
            "box": box.xyxy[0].tolist(),
        }

        threshold = get_dynamic_conf_threshold(cls_name, brightness)
        if conf < threshold:
            continue
        if not is_valid_box(det, img_h, img_w):
            continue
        detections.append(det)

    return detections, brightness


def update_presence(state, vtype, detected_now):
    presence_history = state["presence_history"]
    history = presence_history.setdefault(vtype, deque(maxlen=PERSISTENCE_WINDOW))
    history.append(bool(detected_now))
    hits = sum(1 for x in history if x)
    return hits >= PERSISTENCE_REQUIRED_HITS


def should_fire_violation(state, vtype):
    now = time.time()
    last_violation_time = state["last_violation_time"]
    last = last_violation_time.get(vtype, 0)
    cooldown = VIOLATION_COOLDOWNS.get(vtype, DEFAULT_VIOLATION_COOLDOWN)
    if now - last >= cooldown:
        last_violation_time[vtype] = now
        return True
    return False


def save_violation_video(frames, filename):
    if not frames:
        return None

    temp_path = None
    try:
        video_path = os.path.join(OBJECT_VIOLATIONS_DIR, filename)
        temp_path = os.path.join(OBJECT_VIOLATIONS_DIR, f"tmp_{filename}")
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


@app.post("/detect-objects")
async def detect_objects_endpoint(
    frame: UploadFile = File(...),
    x_session_id: str | None = Header(default=None),
):
    try:
        cleanup_inactive_sessions()

        session_id = (x_session_id or "").strip() or "default"
        state = get_session_state(session_id)
        violation_stats = state["violation_stats"]
        frame_buffer = state["frame_buffer"]
        pending_clips = state["pending_clips"]

        contents = await frame.read()
        np_arr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        if img is None:
            return {"violation": False, "reason": "Invalid image"}

        frame_buffer.append(img.copy())

        detections, brightness = detect_objects(img)
        now = time.time()

        violations = []
        person_count = 0
        detected_vtypes = set()

        for det in detections:
            cls = det["class"]
            conf = det["confidence"]

            if cls == PERSON_CLASS:
                person_count += 1
                continue

            if cls in VIOLATION_OBJECTS:
                obj_info = VIOLATION_OBJECTS[cls]
                vtype = obj_info["type"]
                detected_vtypes.add(vtype)

                if update_presence(state, vtype, True) and should_fire_violation(state, vtype):
                    video_filename = f"{uuid.uuid4()}.mp4"
                    clip_id = str(uuid.uuid4())
                    pending_clips[clip_id] = {
                        "frames": list(frame_buffer),
                        "filename": video_filename,
                        "collect_until": now + POST_VIOLATION_SECONDS,
                    }

                    violations.append(
                        {
                            "type": vtype,
                            "severity": obj_info["severity"],
                            "description": f"{obj_info['label']} detected (confidence: {conf:.0%})",
                            "videoPath": video_filename,
                            "confidence": conf,
                        }
                    )

                    violation_stats[vtype] = violation_stats.get(vtype, 0) + 1
                    print(f"Object detected: {obj_info['label']} | confidence={conf:.0%}")

        for obj in VIOLATION_OBJECTS.values():
            vtype = obj["type"]
            if vtype not in detected_vtypes:
                update_presence(state, vtype, False)

        if person_count > 1:
            if update_presence(state, MULTI_PERSON_TYPE, True) and should_fire_violation(state, MULTI_PERSON_TYPE):
                video_filename = f"{uuid.uuid4()}.mp4"
                clip_id = str(uuid.uuid4())
                pending_clips[clip_id] = {
                    "frames": list(frame_buffer),
                    "filename": video_filename,
                    "collect_until": now + POST_VIOLATION_SECONDS,
                }

                violations.append(
                    {
                        "type": MULTI_PERSON_TYPE,
                        "severity": "high",
                        "description": f"{person_count} persons detected in frame",
                        "videoPath": video_filename,
                        "confidence": 1.0,
                    }
                )
                violation_stats[MULTI_PERSON_TYPE] = violation_stats.get(MULTI_PERSON_TYPE, 0) + 1
                print(f"Multiple persons detected: {person_count}")
        else:
            update_presence(state, MULTI_PERSON_TYPE, False)

        completed_clips = []
        for clip_id, clip in pending_clips.items():
            clip["frames"].append(img.copy())
            if now >= clip["collect_until"]:
                completed_clips.append(clip_id)

        for clip_id in completed_clips:
            clip_data = pending_clips.pop(clip_id)
            loop = asyncio.get_event_loop()
            loop.run_in_executor(executor, save_violation_video, clip_data["frames"], clip_data["filename"])

        detected_names = [d["class"] for d in detections]
        print(
            f"[session={session_id}] Detected={detected_names} | Persons={person_count} | "
            f"Brightness={brightness:.1f} | Violations={len(violations)}"
        )

        return {
            "session_id": session_id,
            "violation": len(violations) > 0,
            "violations": violations,
            "detections": detections,
            "person_count": person_count,
            "brightness": round(brightness, 1),
            "stats": violation_stats,
            "timestamp": datetime.now().isoformat(),
        }

    except Exception as e:
        import traceback

        print(f"Object detection error: {traceback.format_exc()}")
        return {"violation": False, "error": str(e)}


@app.get("/stats")
async def get_stats():
    aggregated_stats = {}
    for state in session_states.values():
        for key, value in state["violation_stats"].items():
            aggregated_stats[key] = aggregated_stats.get(key, 0) + value
    return {
        "active_sessions": len(session_states),
        "stats": aggregated_stats,
        "timestamp": datetime.now().isoformat(),
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("ObjectdetectionService:app", host="0.0.0.0", port=8005, reload=True)
