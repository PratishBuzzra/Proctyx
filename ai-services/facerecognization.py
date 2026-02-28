from fastapi import FastAPI, UploadFile, File
from typing import List
import face_recognition
import shutil
import os
import uuid
import numpy as np
from scipy.spatial import distance as dist
from antispoof.predict import predict_antispoof
import cv2

app = FastAPI()

TEMP_DIR = "temp"
os.makedirs(TEMP_DIR, exist_ok=True)

TOLERANCE = 0.5

# ---------- SIZE CHECKS ----------
def face_too_small(location, img, min_ratio=0.05):
    top, right, bottom, left = location
    face_area = (bottom - top) * (right - left)
    img_area = img.shape[0] * img.shape[1]
    return (face_area / img_area) < min_ratio

def face_too_large(location, img, max_ratio=0.9):
    top, right, bottom, left = location
    face_area = (bottom - top) * (right - left)
    img_area = img.shape[0] * img.shape[1]
    return (face_area / img_area) > max_ratio

# ---------- LIVENESS HELPERS ----------
def images_are_too_similar(img1, img2, threshold=12):
    diff = np.mean(np.abs(img1.astype("float") - img2.astype("float")))
    return diff < threshold

def eye_aspect_ratio(eye):
    A = dist.euclidean(eye[1], eye[5])
    B = dist.euclidean(eye[2], eye[4])
    C = dist.euclidean(eye[0], eye[3])
    return (A + B) / (2.0 * C)

def blink_detected_across_frames(images):
    EAR_THRESHOLD = 0.26
    for img in images:
        landmarks = face_recognition.face_landmarks(img)
        if not landmarks:
            continue
        for face in landmarks:
            if "left_eye" in face and "right_eye" in face:
                ear = (
                    eye_aspect_ratio(face["left_eye"]) +
                    eye_aspect_ratio(face["right_eye"])
                ) / 2.0
                if ear < EAR_THRESHOLD:
                    return True
    return False

# ---------- MATCH LEVEL ----------
def get_match_level(distance: float):
    if distance <= 0.40:
        return "strong"
    elif distance <= 0.50:
        return "normal"
    else:
        return "failed"

# ---------- MAIN ENDPOINT ----------
@app.post("/verify-face")
async def verify_face(
    registered_image: UploadFile = File(...),
    live_images: List[UploadFile] = File(...)
):
    reg_path = f"{TEMP_DIR}/{uuid.uuid4()}_reg.jpg"
    live_paths = []

    with open(reg_path, "wb") as f:
        shutil.copyfileobj(registered_image.file, f)

    for img in live_images:
        path = f"{TEMP_DIR}/{uuid.uuid4()}_live.jpg"
        with open(path, "wb") as f:
            shutil.copyfileobj(img.file, f)
        live_paths.append(path)

    try:
        reg_img = face_recognition.load_image_file(reg_path)
        live_imgs = [face_recognition.load_image_file(p) for p in live_paths]

        # ---------- FACE DETECTION ----------
        valid_img = None
        loc = None

        for img in live_imgs:
            locs = face_recognition.face_locations(img)
            if len(locs) > 1:
                return {
                    "matched": False,
                    "distance": None,
                    "match_level": "failed",
                    "confidence": 0.0,
                    "liveness": 0.0,
                    "reason": "Multiple persons detected"
                }
            if locs:
                valid_img = img
                loc = locs[0]
                break

        if loc is None:
            return {
                "matched": False,
                "distance": None,
                "match_level": "failed",
                "confidence": 0.0,
                "liveness": 0.0,
                "reason": "No face detected"
            }

        if face_too_small(loc, valid_img):
            return {"matched": False, "match_level": "failed", "reason": "Face too far"}

        if face_too_large(loc, valid_img):
            return {"matched": False, "match_level": "failed", "reason": "Face too close"}

        # ---------- ANTISPOOF ----------
        top, right, bottom, left = loc
        h, w, _ = valid_img.shape

        pad_x = int((right - left) * 0.2)
        pad_y = int((bottom - top) * 0.2)

        x1 = max(0, left - pad_x)
        y1 = max(0, top - pad_y)
        x2 = min(w, right + pad_x)
        y2 = min(h, bottom + pad_y)

        face_crop = valid_img[y1:y2, x1:x2]
        face_crop = cv2.resize(face_crop, (128, 128))

        is_real, liveness_conf = predict_antispoof(face_crop)

        if liveness_conf < 0.45:
            return {
        "matched": False,
        "distance": None,
        "match_level": "failed",
        "confidence": 0.0,
        "liveness": round(liveness_conf, 3),
        "reason": "Spoof detected"
    }

        # ---------- MOVEMENT ----------
        if not any(
            not images_are_too_similar(live_imgs[i], live_imgs[i + 1])
            for i in range(len(live_imgs) - 1)
        ):
            return {"matched": False, "match_level": "failed", "reason": "No movement detected"}

        # ---------- BLINK ----------
        if not blink_detected_across_frames(live_imgs):
            return {"matched": False, "match_level": "failed", "reason": "Blink not detected"}

        # ---------- FACE MATCH ----------
        reg_encs = face_recognition.face_encodings(reg_img)
        if not reg_encs:
            return {"matched": False, "match_level": "failed", "reason": "Invalid registered image"}

        reg_enc = reg_encs[0]
        best_distance = min(
            face_recognition.face_distance([reg_enc], enc)[0]
            for img in live_imgs
            for enc in face_recognition.face_encodings(img)
        )

        match_level = get_match_level(best_distance)
        matched = best_distance <= TOLERANCE

        face_conf = max(0.0, 1.0 - best_distance)
        overall_conf = round(face_conf * liveness_conf, 3)

        return {
    "matched": bool(matched),
    "distance": float(round(best_distance, 3)),
    "match_level": str(match_level),
    "confidence": float(overall_conf),
    "liveness": float(round(liveness_conf, 3)),
    "reason": None if bool(matched) else "Face mismatch"
}

    finally:
        if os.path.exists(reg_path):
            os.remove(reg_path)
        for p in live_paths:
            if os.path.exists(p):
                os.remove(p)

