import torch
import numpy as np
import os
from torchvision import transforms
from antispoof.model import AntiSpoofNet

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
REAL_THRESHOLD = 0.40

MODEL_PATH = os.path.join(
    os.path.dirname(__file__), "..", "weights", "antispoof_weights.pth"
)

model = AntiSpoofNet().to(DEVICE)
model.load_state_dict(torch.load(MODEL_PATH, map_location=DEVICE))
model.eval()

transform = transforms.Compose([
    transforms.ToTensor(),
    transforms.Resize((128, 128)),
    transforms.Normalize(mean=[0.5]*3, std=[0.5]*3)
])

def predict_antispoof(face_img: np.ndarray):
    """
    Returns:
        is_real: bool
        confidence: float
    """

    # ❌ DO NOT convert color (already RGB from face_recognition)
    img = face_img.copy()
    img = transform(img).unsqueeze(0).to(DEVICE)

    # Run 3 times and average to reduce random bad predictions
    scores = []
    with torch.no_grad():
        for _ in range(3):
            output = model(img)
            prob = torch.softmax(output, dim=1)[0]
            scores.append(float(prob[0]))

    real_conf = sum(scores) / len(scores)
    spoof_conf = 1 - real_conf

    print(f"[AntiSpoof] REAL={real_conf:.3f} SPOOF={spoof_conf:.3f}")

    return real_conf >= REAL_THRESHOLD, real_conf
