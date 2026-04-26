from fastapi import FastAPI, UploadFile, File
from typing import List, Tuple
import face_recognition
import shutil
import os
import uuid
import math
import numpy as np
from scipy.spatial import distance as dist
from antispoof.predict import predict_antispoof
import cv2
try:
    from insightface.app import FaceAnalysis
except Exception:
    FaceAnalysis = None

app = FastAPI()

TEMP_DIR = "temp"
os.makedirs(TEMP_DIR, exist_ok=True)

# Face matching threshold (lower = stricter)
TOLERANCE = 0.50
V2_SIMILARITY_THRESHOLD = 0.35
V2_STRONG_SIMILARITY_THRESHOLD = 0.50
INSIGHTFACE_DET_SIZE = int(os.getenv("INSIGHTFACE_DET_SIZE", "640"))

# Face size constraints
MIN_FACE_RATIO = 0.02
MAX_FACE_RATIO = 0.85

# Frame quality constraints
MIN_LIVE_FACE_FRAMES = 3
MIN_SHARPNESS = 10.0
MIN_BRIGHTNESS = 20.0
MAX_BRIGHTNESS = 245.0
LOW_LIGHT_TRIGGER_BRIGHTNESS = 80.0
VERY_DARK_BRIGHTNESS = 50.0

# Anti-spoof constraints
ENABLE_ANTISPOOF = os.getenv("ENABLE_ANTISPOOF", "0").strip().lower() not in {
    "0", "false", "off", "no"
}
ANTISPOOF_MIN_REAL_CONF = 0.35
ANTISPOOF_PASS_RATIO = 0.50
ANTISPOOF_HARD_REJECT = 0.15
ANTISPOOF_RETRY_THRESHOLD = 0.25

# InsightFace singleton runtime
_insightface_app = None
_insightface_error = None


def fail_response(reason: str, liveness: float = 0.0, distance=None, confidence: float = 0.0):
    return {
        "matched": False,
        "distance": distance,
        "match_level": "failed",
        "confidence": float(round(confidence, 3)),
        "liveness": float(round(liveness, 3)),
        "reason": reason,
    }


def face_area_ratio(location, img):
    top, right, bottom, left = location
    face_area = max(1, (bottom - top) * (right - left))
    img_area = max(1, img.shape[0] * img.shape[1])
    return face_area / img_area


def face_too_small(location, img, min_ratio=MIN_FACE_RATIO):
    return face_area_ratio(location, img) < min_ratio


def face_too_large(location, img, max_ratio=MAX_FACE_RATIO):
    return face_area_ratio(location, img) > max_ratio


def crop_face_with_padding(img, location, pad_ratio=0.2):
    top, right, bottom, left = location
    h, w, _ = img.shape

    pad_x = int((right - left) * pad_ratio)
    pad_y = int((bottom - top) * pad_ratio)

    x1 = max(0, left - pad_x)
    y1 = max(0, top - pad_y)
    x2 = min(w, right + pad_x)
    y2 = min(h, bottom + pad_y)
    return img[y1:y2, x1:x2]


def is_image_quality_good(img) -> Tuple[bool, str]:
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    brightness = float(np.mean(gray))
    sharpness = float(cv2.Laplacian(gray, cv2.CV_64F).var())

    if brightness < MIN_BRIGHTNESS:
        return False, "Image too dark"
    if brightness > MAX_BRIGHTNESS:
        return False, "Image too bright"
    if sharpness < MIN_SHARPNESS:
        return False, "Image too blurry"
    return True, ""


def enhance_low_light_if_needed(img):
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    brightness = float(np.mean(gray))

    if brightness >= LOW_LIGHT_TRIGGER_BRIGHTNESS:
        return img, False, brightness

    # CLAHE on lightness channel for local contrast recovery in dark scenes.
    lab = cv2.cvtColor(img, cv2.COLOR_RGB2LAB)
    l_channel, a_channel, b_channel = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
    l_enhanced = clahe.apply(l_channel)
    enhanced = cv2.cvtColor(
        cv2.merge((l_enhanced, a_channel, b_channel)),
        cv2.COLOR_LAB2RGB
    )

    # Mild gamma boost, stronger only for very dark frames.
    gamma = 1.35 if brightness < VERY_DARK_BRIGHTNESS else 1.20
    table = np.array(
        [((i / 255.0) ** (1.0 / gamma)) * 255 for i in range(256)],
        dtype=np.uint8
    )
    enhanced = cv2.LUT(enhanced, table)
    return enhanced, True, brightness


def get_insightface_app():
    global _insightface_app, _insightface_error

    if _insightface_app is not None:
        return _insightface_app, None
    if _insightface_error is not None:
        return None, _insightface_error

    if FaceAnalysis is None:
        _insightface_error = "InsightFace dependency is not available in this environment"
        return None, _insightface_error

    try:
        app_instance = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
        app_instance.prepare(ctx_id=-1, det_size=(INSIGHTFACE_DET_SIZE, INSIGHTFACE_DET_SIZE))
        _insightface_app = app_instance
        return _insightface_app, None
    except Exception as ex:
        _insightface_error = f"InsightFace initialization failed: {ex}"
        return None, _insightface_error


@app.on_event("startup")
def warmup_insightface():
    app_instance, init_error = get_insightface_app()
    if init_error:
        print(f"[InsightFace][Warmup] Failed: {init_error}")
    else:
        print(
            f"[InsightFace][Warmup] Ready with det_size="
            f"{INSIGHTFACE_DET_SIZE}x{INSIGHTFACE_DET_SIZE}"
        )


def get_insightface_face_and_embedding(rgb_img):
    app_instance, init_error = get_insightface_app()
    if init_error:
        return None, None, init_error

    bgr_img = cv2.cvtColor(rgb_img, cv2.COLOR_RGB2BGR)
    faces = app_instance.get(bgr_img)
    if len(faces) == 0:
        return None, None, "No face detected"
    if len(faces) > 1:
        return None, None, "Multiple persons detected"

    face = faces[0]
    x1, y1, x2, y2 = face.bbox.astype(int)
    h, w, _ = rgb_img.shape
    x1 = max(0, min(x1, w - 1))
    x2 = max(1, min(x2, w))
    y1 = max(0, min(y1, h - 1))
    y2 = max(1, min(y2, h))

    face_crop = rgb_img[y1:y2, x1:x2]
    if face_crop.size == 0:
        return None, None, "Face crop failed"

    embedding = getattr(face, "normed_embedding", None)
    if embedding is None:
        raw_embedding = getattr(face, "embedding", None)
        if raw_embedding is None:
            return None, None, "Face embedding not available"
        norm = np.linalg.norm(raw_embedding)
        if norm == 0:
            return None, None, "Invalid face embedding norm"
        embedding = raw_embedding / norm

    return embedding.astype(np.float32), face_crop, None


def check_movement(face_crops, threshold=3.0, required_ratio=0.25):
    if len(face_crops) < 2:
        return True

    movement_count = 0
    total_pairs = len(face_crops) - 1

    prepared = []
    for crop in face_crops:
        gray = cv2.cvtColor(crop, cv2.COLOR_RGB2GRAY)
        prepared.append(cv2.resize(gray, (96, 96)))

    for i in range(total_pairs):
        diff = np.mean(np.abs(prepared[i].astype("float32") - prepared[i + 1].astype("float32")))
        if diff >= threshold:
            movement_count += 1

    ratio = movement_count / total_pairs
    print(f"[Movement] {movement_count}/{total_pairs} pairs moved ({ratio:.2f})")
    return ratio >= required_ratio


def eye_aspect_ratio(eye):
    a = dist.euclidean(eye[1], eye[5])
    b = dist.euclidean(eye[2], eye[4])
    c = dist.euclidean(eye[0], eye[3])
    return (a + b) / (2.0 * c)


def check_blink(images):
    if len(images) < 2:
        return True

    ear_threshold = 0.25
    ear_var_min = 0.02
    ear_values = []

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
                ear_values.append(ear)
                if ear < ear_threshold:
                    print(f"[Blink] Full blink detected EAR={ear:.3f}")
                    return True

    if len(ear_values) >= 2:
        ear_variation = max(ear_values) - min(ear_values)
        print(f"[Blink] EAR variation={ear_variation:.3f}")
        if ear_variation >= ear_var_min:
            print("[Blink] Natural eye movement detected")
            return True

    print("[Blink] No blink or eye movement detected")
    return False


def get_match_level(distance_value: float):
    if distance_value <= 0.40:
        return "strong"
    if distance_value <= TOLERANCE:
        return "normal"
    return "failed"


def get_match_level_v2(similarity_value: float):
    if similarity_value >= V2_STRONG_SIMILARITY_THRESHOLD:
        return "strong"
    if similarity_value >= V2_SIMILARITY_THRESHOLD:
        return "normal"
    return "failed"


def collect_valid_live_frames(live_imgs):
    valid_frames = []
    fallback_frames = []

    for img in live_imgs:
        locs = face_recognition.face_locations(img, model="hog")
        if len(locs) > 1:
            return None, "Multiple persons detected"
        if len(locs) == 0:
            continue

        loc = locs[0]
        if face_too_small(loc, img) or face_too_large(loc, img):
            continue

        crop = crop_face_with_padding(img, loc)
        if crop.size == 0:
            continue

        crop_for_checks, enhanced, raw_brightness = enhance_low_light_if_needed(crop)
        quality_ok, _ = is_image_quality_good(crop_for_checks)
        if quality_ok:
            valid_frames.append((img, loc, crop_for_checks))
        else:
            # Keep low-quality frames as fallback for weak webcams
            fallback_frames.append((img, loc, crop_for_checks))

        if enhanced:
            print(f"[LowLightEnhance] Applied on live frame (brightness={raw_brightness:.1f})")

    if len(valid_frames) < MIN_LIVE_FACE_FRAMES and fallback_frames:
        needed = MIN_LIVE_FACE_FRAMES - len(valid_frames)
        valid_frames.extend(fallback_frames[:needed])

    if len(valid_frames) < MIN_LIVE_FACE_FRAMES:
        return None, "Face not stable in frame. Please hold still and retry."

    return valid_frames, None


def collect_valid_live_frames_v2(live_imgs):
    valid_frames = []
    fallback_frames = []

    for img in live_imgs:
        live_embedding, face_crop, err = get_insightface_face_and_embedding(img)
        if err == "Multiple persons detected":
            return None, err
        if err is not None:
            continue

        crop_for_checks, enhanced, raw_brightness = enhance_low_light_if_needed(face_crop)
        quality_ok, _ = is_image_quality_good(crop_for_checks)
        frame_tuple = (live_embedding, crop_for_checks)

        if quality_ok:
            valid_frames.append(frame_tuple)
        else:
            fallback_frames.append(frame_tuple)

        if enhanced:
            print(f"[LowLightEnhance][V2] Applied on live frame (brightness={raw_brightness:.1f})")

    if len(valid_frames) < MIN_LIVE_FACE_FRAMES and fallback_frames:
        needed = MIN_LIVE_FACE_FRAMES - len(valid_frames)
        valid_frames.extend(fallback_frames[:needed])

    if len(valid_frames) < MIN_LIVE_FACE_FRAMES:
        return None, "Face not stable in frame. Please hold still and retry."

    return valid_frames, None


def run_antispoof(face_crops, tag=""):
    if not ENABLE_ANTISPOOF:
        print(f"[AntiSpoof{tag}] Disabled via ENABLE_ANTISPOOF")
        return {
            "anti_passes": len(face_crops),
            "liveness_conf": 1.0,
            "required_passes": 0,
        }

    anti_scores = []
    anti_passes = 0
    for crop in face_crops:
        face_crop = cv2.resize(crop, (128, 128))
        is_real, liveness_conf = predict_antispoof(face_crop)
        anti_scores.append(float(liveness_conf))
        if is_real and liveness_conf >= ANTISPOOF_MIN_REAL_CONF:
            anti_passes += 1

    liveness_conf = float(np.median(anti_scores)) if anti_scores else 0.0
    required_passes = max(1, math.ceil(len(face_crops) * ANTISPOOF_PASS_RATIO))
    return {
        "anti_passes": anti_passes,
        "liveness_conf": liveness_conf,
        "required_passes": required_passes,
    }


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

        reg_locs = face_recognition.face_locations(reg_img, model="hog")
        if len(reg_locs) != 1:
            return fail_response("Invalid registered image (must contain exactly one face)")

        reg_loc = reg_locs[0]
        if face_too_small(reg_loc, reg_img):
            return fail_response("Registered face too far")
        if face_too_large(reg_loc, reg_img):
            return fail_response("Registered face too close")

        reg_crop = crop_face_with_padding(reg_img, reg_loc)
        quality_ok, quality_reason = is_image_quality_good(reg_crop)
        if not quality_ok:
            print(f"[RegQuality] Warning: {quality_reason}")

        reg_encs = face_recognition.face_encodings(reg_img, known_face_locations=[reg_loc], model="small")
        if not reg_encs:
            return fail_response("Invalid registered image (encoding failed)")
        reg_enc = reg_encs[0]

        valid_live_frames, reason = collect_valid_live_frames(live_imgs)
        if not valid_live_frames:
            return fail_response(reason)

        # ---------- ANTISPOOF (multi-frame) ----------
        anti_result = run_antispoof([crop for _, _, crop in valid_live_frames])
        anti_passes = anti_result["anti_passes"]
        liveness_conf = anti_result["liveness_conf"]
        required_passes = anti_result["required_passes"]
        if anti_passes < required_passes:
            if liveness_conf < ANTISPOOF_HARD_REJECT:
                return fail_response("Spoof detected", liveness=liveness_conf)
            print("[AntiSpoof] Soft fail, proceeding with other liveness checks")

        # ---------- MOVEMENT ----------
        face_crops = [crop for _, _, crop in valid_live_frames]
        if not check_movement(face_crops):
            return fail_response("No movement detected", liveness=liveness_conf)

        # ---------- BLINK ----------
        blink_imgs = [img for img, _, _ in valid_live_frames]
        if not check_blink(blink_imgs):
            print("[Blink] Soft fail, proceeding")

        # ---------- FACE MATCH ----------
        live_encodings = []
        for img, loc, _ in valid_live_frames:
            encs = face_recognition.face_encodings(img, known_face_locations=[loc], model="small")
            if encs:
                live_encodings.append(encs[0])

        if not live_encodings:
            return fail_response("Live face encoding failed", liveness=liveness_conf)

        distances = face_recognition.face_distance(live_encodings, reg_enc)
        best_distance = float(np.min(distances))
        matched = best_distance <= TOLERANCE
        match_level = get_match_level(best_distance)

        face_conf = max(0.0, min(1.0, 1.0 - best_distance))
        overall_conf = round((0.7 * face_conf) + (0.3 * liveness_conf), 3)

        return {
            "matched": bool(matched),
            "distance": float(round(best_distance, 3)),
            "match_level": str(match_level),
            "confidence": float(overall_conf),
            "liveness": float(round(liveness_conf, 3)),
            "reason": None if bool(matched) else "Face mismatch",
        }

    finally:
        if os.path.exists(reg_path):
            os.remove(reg_path)
        for p in live_paths:
            if os.path.exists(p):
                os.remove(p)


@app.post("/verify-face-v2")
async def verify_face_v2(
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

        reg_embedding, reg_crop, reg_error = get_insightface_face_and_embedding(reg_img)
        if reg_error:
            return fail_response(f"V2: {reg_error}")

        reg_crop_for_checks, _, _ = enhance_low_light_if_needed(reg_crop)
        quality_ok, quality_reason = is_image_quality_good(reg_crop_for_checks)
        if not quality_ok:
            print(f"[RegQuality][V2] Warning: {quality_reason}")

        valid_live_frames, reason = collect_valid_live_frames_v2(live_imgs)
        if not valid_live_frames:
            return fail_response(reason)

        # ---------- ANTISPOOF (multi-frame) ----------
        anti_result = run_antispoof([crop for _, crop in valid_live_frames], tag="[V2]")
        anti_passes = anti_result["anti_passes"]
        liveness_conf = anti_result["liveness_conf"]
        required_passes = anti_result["required_passes"]
        if liveness_conf < ANTISPOOF_HARD_REJECT:
            return fail_response("Spoof detected", liveness=liveness_conf)

        if anti_passes < required_passes or liveness_conf < ANTISPOOF_RETRY_THRESHOLD:
            print(
                f"[AntiSpoof][V2] Retry required: passes={anti_passes}/{required_passes}, "
                f"median_conf={liveness_conf:.3f}"
            )
            return fail_response(
                "Liveness uncertain. Please retry verification.",
                liveness=liveness_conf
            )

        # ---------- FACE MATCH ----------
        similarities = []
        for live_embedding, _ in valid_live_frames:
            similarity = float(np.dot(live_embedding, reg_embedding))
            similarities.append(similarity)

        if not similarities:
            return fail_response("Live face embedding failed", liveness=liveness_conf)

        best_similarity = float(np.max(similarities))
        best_distance = float(1.0 - best_similarity)
        matched = best_similarity >= V2_SIMILARITY_THRESHOLD
        match_level = get_match_level_v2(best_similarity)

        # Map similarity [-1, 1] into [0, 1] style confidence.
        face_conf = max(0.0, min(1.0, (best_similarity + 1.0) / 2.0))
        overall_conf = round((0.7 * face_conf) + (0.3 * liveness_conf), 3)

        return {
            "matched": bool(matched),
            "distance": float(round(best_distance, 3)),
            "similarity": float(round(best_similarity, 3)),
            "match_level": str(match_level),
            "confidence": float(overall_conf),
            "liveness": float(round(liveness_conf, 3)),
            "reason": None if bool(matched) else "Face mismatch",
        }

    finally:
        if os.path.exists(reg_path):
            os.remove(reg_path)
        for p in live_paths:
            if os.path.exists(p):
                os.remove(p)
