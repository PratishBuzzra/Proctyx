import numpy as np
import os 
import uuid
import wave
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
from scipy.signal import butter, filtfilt

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SAMPLE_RATE      = 16000
RMS_THRESHOLD    = 0.015
SUSTAINED_RATIO  = 0.35

# Human voice frequency range
VOICE_LOW_HZ  = 85
VOICE_HIGH_HZ = 3000

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
AUDIO_VIOLATIONS_DIR = os.path.join(BASE_DIR, "audio_violations")
os.makedirs(AUDIO_VIOLATIONS_DIR, exist_ok=True)
app.mount("/audios", StaticFiles(directory=AUDIO_VIOLATIONS_DIR), name="audio-violation-files")

# ---------- HELPER FUNCTIONS ----------

def butter_bandpass(lowcut, highcut, fs, order=5):
    nyq  = 0.5 * fs
    low  = lowcut  / nyq
    high = highcut / nyq
    b, a = butter(order, [low, high], btype='band')
    return b, a

def apply_voice_filter(samples, sample_rate=SAMPLE_RATE):
    try:
        b, a     = butter_bandpass(VOICE_LOW_HZ, VOICE_HIGH_HZ, sample_rate)
        filtered = filtfilt(b, a, samples)
        return filtered
    except Exception as e:
        print(f"Filter error: {e}")
        return samples

def has_speech_zcr(samples):
    """
    Zero Crossing Rate check.
    Human speech:         ZCR = 0.02 - 0.30  → pass
    Background noise/fan: ZCR = 0.30+         → blocked
    Traffic/random noise: ZCR = 0.35+         → blocked
    """
    zero_crossings = np.sum(np.abs(np.diff(np.sign(samples)))) / 2
    zcr = zero_crossings / len(samples)
    print(f"ZCR: {zcr:.4f}")
    return 0.02 < zcr < 0.30

def is_human_voice(samples, sample_rate=SAMPLE_RATE):
    """
    Two checks:
    1. FFT — voice band energy > 45% of total energy
    2. ZCR — zero crossing rate in speech range (filters bg noise)
    Both must pass to confirm human voice.
    """
    if len(samples) < 512:
        return False, 0.0

    # FFT analysis
    fft_vals  = np.abs(np.fft.rfft(samples))
    fft_freqs = np.fft.rfftfreq(len(samples), d=1.0/sample_rate)

    voice_mask   = (fft_freqs >= VOICE_LOW_HZ) & (fft_freqs <= VOICE_HIGH_HZ)
    voice_energy = np.sum(fft_vals[voice_mask] ** 2)
    total_energy = np.sum(fft_vals ** 2)

    if total_energy == 0:
        return False, 0.0

    voice_ratio = voice_energy / total_energy

    # ZCR check — this is what filters out bg noise
    zcr_ok   = has_speech_zcr(samples)
    is_voice = voice_ratio > 0.45 and zcr_ok

    return is_voice, voice_ratio

# ---------- MAIN ENDPOINT ----------

@app.post("/analyze-audio")
async def analyze_audio(request: Request):
    try:
        raw_bytes = await request.body()

        if len(raw_bytes) == 0:
            return {"violation": False, "type": None, "severity": None}

        samples = np.frombuffer(raw_bytes, dtype=np.float32)

        if len(samples) == 0:
            return {"violation": False, "type": None, "severity": None}

        # STEP 1: Check if human voice present (with ZCR filter)
        is_voice, voice_ratio = is_human_voice(samples)

        if not is_voice:
            print(f"No human voice | Voice ratio: {voice_ratio:.3f}")
            return {
                "violation":   False,
                "type":        None,
                "severity":    None,
                "loud_ratio":  0,
                "voice_ratio": round(float(voice_ratio), 3),
                "reason":      "Background noise only, no human voice",
                "timestamp":   datetime.now().isoformat()
            }

        # STEP 2: Apply voice filter
        filtered_samples = apply_voice_filter(samples)

        # STEP 3: RMS analysis on filtered audio
        frame_length = 1024
        hop_length   = 512
        num_frames   = (len(filtered_samples) - frame_length) // hop_length + 1

        if num_frames <= 0:
            return {"violation": False, "type": None, "severity": None}

        rms_per_frame = []
        for i in range(num_frames):
            start = i * hop_length
            frame = filtered_samples[start:start + frame_length]
            rms   = np.sqrt(np.mean(frame ** 2))
            rms_per_frame.append(rms)

        rms_per_frame = np.array(rms_per_frame)
        loud_frames   = np.sum(rms_per_frame > RMS_THRESHOLD)
        total_frames  = len(rms_per_frame)
        loud_ratio    = loud_frames / total_frames if total_frames > 0 else 0

        # STEP 4: Violation check
        violation      = False
        violation_type = None
        severity       = None
        description    = None
        audio_path     = None

        if loud_ratio >= SUSTAINED_RATIO:
            violation      = True
            violation_type = "AUDIO_SPEECH_DETECTED"
            severity       = "high" if loud_ratio > 0.8 else "medium"
            description    = f"Human voice detected ({round(loud_ratio * 100)}% of chunk)"

            filename      = f"{uuid.uuid4()}.wav"
            save_path     = os.path.join(AUDIO_VIOLATIONS_DIR, filename)
            audio_path    = filename
            samples_int16 = (filtered_samples * 32767).astype(np.int16)

            with wave.open(save_path, 'w') as wav_file:
                wav_file.setnchannels(1)
                wav_file.setsampwidth(2)
                wav_file.setframerate(SAMPLE_RATE)
                wav_file.writeframes(samples_int16.tobytes())

            print(f"Violation audio saved: {save_path}")

        print(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print(f"Voice ratio : {voice_ratio:.3f}")
        print(f"Loud ratio  : {loud_ratio:.3f}")
        print(f"Human voice : {is_voice}")
        print(f"Violation   : {violation}")
        if violation:
            print(f"Severity    : {severity}")
        print(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

        return {
            "violation":   violation,
            "type":        violation_type,
            "severity":    severity,
            "description": description,
            "loud_ratio":  round(float(loud_ratio), 3),
            "voice_ratio": round(float(voice_ratio), 3),
            "audio_path":  audio_path,
            "timestamp":   datetime.now().isoformat()
        }

    except Exception as e:
        import traceback
        print(f"Audio analysis error: {traceback.format_exc()}")
        return {"violation": False, "type": None, "severity": None, "error": str(e)}