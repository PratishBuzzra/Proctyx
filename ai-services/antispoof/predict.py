import torch
import numpy as np
import os
from torchvision import transforms
from antispoof.model import AntiSpoofNet

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

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

    with torch.no_grad():
        output = model(img)
        prob = torch.softmax(output, dim=1)[0]

    # ✅ FIXED label order (MOST IMPORTANT)
    real_conf = float(prob[0])   # real
    spoof_conf = float(prob[1])  # spoof

    print(f"[AntiSpoof] REAL={real_conf:.3f} SPOOF={spoof_conf:.3f}")

    return real_conf > 0.45, real_conf
