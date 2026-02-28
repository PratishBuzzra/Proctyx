import os
import shutil
from pathlib import Path

SRC = Path("training/dataset/train")
DST = Path("training/dataset_flat/train")

for label in ["real", "spoof"]:
    src_label = SRC / label
    dst_label = DST / label
    dst_label.mkdir(parents=True, exist_ok=True)

    for user_dir in src_label.iterdir():
        if not user_dir.is_dir():
            continue
        for img in user_dir.iterdir():
            if img.suffix.lower() in [".jpg", ".png", ".jpeg"]:
                new_name = f"{user_dir.name}_{img.name}"
                shutil.copy(img, dst_label / new_name)

print("✅ Dataset flattened")
