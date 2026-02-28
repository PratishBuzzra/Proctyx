import numpy as np
import os 
import uuid
import wave
from fastapi import FastAPI, Request
from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

RMS_THRESHOLD = 0.01
SUSTAINED_RATIO = 0.6
AUDIO_VIOLATIONS_DIR = "audio_violations"
os.makedirs(AUDIO_VIOLATIONS_DIR, exist_ok=True)

@app.post("/analyze-audio")
async def analyze_audio(request: Request):
    try:
        raw_bytes = await request.body()

        if len(raw_bytes) == 0:
            return {"violation": False, "type": None, "severity": None}

        samples = np.frombuffer(raw_bytes, dtype=np.float32)

        if len(samples) == 0:
            return {"violation": False, "type": None, "severity": None}

        frame_length = 1024
        hop_length = 512
        num_frames = (len(samples) - frame_length) // hop_length + 1

        if num_frames <= 0:
            return {"violation": False, "type": None, "severity": None}

        rms_per_frame = []
        for i in range(num_frames):
            start = i * hop_length
            frame = samples[start:start + frame_length]
            rms = np.sqrt(np.mean(frame ** 2))
            rms_per_frame.append(rms)

        rms_per_frame = np.array(rms_per_frame)
        loud_frames = np.sum(rms_per_frame > RMS_THRESHOLD)
        total_frames = len(rms_per_frame)
        loud_ratio = loud_frames / total_frames if total_frames > 0 else 0

        violation = False
        violation_type = None
        severity = None
        description = None
        audio_path = None

        if loud_ratio >= SUSTAINED_RATIO:
            violation = True
            violation_type = "AUDIO_SPEECH_DETECTED"
            severity = "high" if loud_ratio > 0.8 else "medium"
            description = f"Sustained audio detected ({round(loud_ratio * 100)}% of chunk)"

            # Save as WAV file
            filename = f"{uuid.uuid4()}.wav"
            audio_path = os.path.join(AUDIO_VIOLATIONS_DIR, filename)

            samples_int16 = (samples * 32767).astype(np.int16)

            with wave.open(audio_path, 'w') as wav_file:
                wav_file.setnchannels(1)      # mono
                wav_file.setsampwidth(2)      # 2 bytes = int16
                wav_file.setframerate(16000)  # 16000 Hz
                wav_file.writeframes(samples_int16.tobytes())

            print(f"Violation audio saved: {audio_path}")

        print(f"loud_ratio: {loud_ratio:.3f}, violation: {violation}")

        return {
            "violation": violation,
            "type": violation_type,
            "severity": severity,
            "description": description,
            "loud_ratio": round(float(loud_ratio), 3),
            "audio_path": audio_path,
            "timestamp": datetime.now().isoformat()
        }

    except Exception as e:
        import traceback
        print(f"Audio analysis error: {traceback.format_exc()}")
        return {"violation": False, "type": None, "severity": None, "error": str(e)}