import os
import sys
from pathlib import Path

import torch
from torch.utils.data import DataLoader, Subset
from torchvision import datasets, transforms

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, ROOT_DIR)

from antispoof.model import AntiSpoofNet


DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
WEIGHTS_DIR = os.path.join(ROOT_DIR, "weights")
WEIGHTS_PATH = os.path.join(WEIGHTS_DIR, "antispoof_weights.pth")
os.makedirs(WEIGHTS_DIR, exist_ok=True)

print(f"Using device: {DEVICE}")


def _is_valid_split_dir(path: str) -> bool:
    if not path or not os.path.isdir(path):
        return False
    classes = [d.name for d in Path(path).iterdir() if d.is_dir()]
    return "real" in classes and "spoof" in classes


def resolve_dataset_root() -> str:
    env_root = os.getenv("ANTISPOOF_DATASET_ROOT")
    candidates = [
        env_root,
        os.path.join(os.path.expanduser("~"), "Desktop", "liveness_dataset"),
        os.path.join(os.path.expanduser("~"), "Desktop", "liveness detection.coco"),
        os.path.join(ROOT_DIR, "training", "dataset_flat"),
        os.path.join(ROOT_DIR, "training", "dataset"),
    ]
    for c in candidates:
        if c and os.path.isdir(c):
            return c
    raise FileNotFoundError(
        "No dataset root found. Set ANTISPOOF_DATASET_ROOT "
        "or place dataset in Desktop/liveness detection.coco"
    )


def resolve_split_path(dataset_root: str, split: str) -> str | None:
    direct = os.path.join(dataset_root, split)
    if _is_valid_split_dir(direct):
        return direct

    nested_candidates = [
        os.path.join(dataset_root, "dataset", split),
        os.path.join(dataset_root, "dataset_flat", split),
    ]
    for path in nested_candidates:
        if _is_valid_split_dir(path):
            return path
    return None


# ---------- AUGMENTATION ----------
train_transform = transforms.Compose([
    transforms.Resize((128, 128)),
    transforms.RandomHorizontalFlip(),
    transforms.RandomVerticalFlip(p=0.1),
    transforms.RandomRotation(15),
    transforms.ColorJitter(brightness=0.3, contrast=0.3, saturation=0.3, hue=0.1),
    transforms.RandomGrayscale(p=0.05),
    transforms.GaussianBlur(kernel_size=3, sigma=(0.1, 2.0)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.5] * 3, std=[0.5] * 3),
    transforms.RandomErasing(p=0.2),
])

val_transform = transforms.Compose([
    transforms.Resize((128, 128)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.5] * 3, std=[0.5] * 3),
])


dataset_root = resolve_dataset_root()
train_dir = resolve_split_path(dataset_root, "train")
val_dir = resolve_split_path(dataset_root, "val")
test_dir = resolve_split_path(dataset_root, "test")

if train_dir is None:
    raise FileNotFoundError(
        f"Could not find a valid train split under dataset root: {dataset_root}"
    )

print(f"Dataset root: {dataset_root}")
print(f"Train dir: {train_dir}")
print(f"Val dir:   {val_dir if val_dir else '(auto split from train)'}")
print(f"Test dir:  {test_dir if test_dir else '(not provided)'}")


# ---------- DATASET ----------
if val_dir:
    train_ds = datasets.ImageFolder(train_dir, transform=train_transform)
    val_ds = datasets.ImageFolder(val_dir, transform=val_transform)
else:
    # fallback: split train dir by index while preserving separate transforms
    base_for_indices = datasets.ImageFolder(train_dir)
    n_total = len(base_for_indices)
    n_train = int(0.8 * n_total)
    n_val = n_total - n_train
    gen = torch.Generator().manual_seed(42)
    perm = torch.randperm(n_total, generator=gen).tolist()
    train_idx = perm[:n_train]
    val_idx = perm[n_train:]

    train_full = datasets.ImageFolder(train_dir, transform=train_transform)
    val_full = datasets.ImageFolder(train_dir, transform=val_transform)
    train_ds = Subset(train_full, train_idx)
    val_ds = Subset(val_full, val_idx)

test_ds = datasets.ImageFolder(test_dir, transform=val_transform) if test_dir else None

train_loader = DataLoader(train_ds, batch_size=32, shuffle=True, num_workers=0)
val_loader = DataLoader(val_ds, batch_size=32, shuffle=False, num_workers=0)
test_loader = DataLoader(test_ds, batch_size=32, shuffle=False, num_workers=0) if test_ds else None

if isinstance(train_ds, Subset):
    class_names = train_ds.dataset.classes
    train_targets = [train_ds.dataset.targets[i] for i in train_ds.indices]
else:
    class_names = train_ds.classes
    train_targets = train_ds.targets

print(f"Classes: {class_names}")
print(f"Train: {len(train_ds)} | Val: {len(val_ds)} | Test: {len(test_ds) if test_ds else 0}")


# ---------- CLASS WEIGHTS ----------
class_counts = [0, 0]
for t in train_targets:
    class_counts[t] += 1

total = sum(class_counts)
class_weights = torch.tensor(
    [total / (2 * max(1, c)) for c in class_counts],
    dtype=torch.float,
).to(DEVICE)

print(f"Train class counts: {dict(zip(class_names, class_counts))}")
print(f"Class weights: {class_weights.tolist()}")


# ---------- MODEL ----------
model = AntiSpoofNet().to(DEVICE)
criterion = torch.nn.CrossEntropyLoss(weight=class_weights)
optimizer = torch.optim.Adam(model.parameters(), lr=1e-3, weight_decay=1e-4)
scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
    optimizer, mode="max", factor=0.5, patience=3
)


# ---------- TRAINING LOOP ----------
EPOCHS = int(os.getenv("ANTISPOOF_EPOCHS", "25"))
best_val_acc = 0.0
patience = 5
no_improve = 0

for epoch in range(EPOCHS):
    model.train()
    train_loss = 0.0
    train_correct = 0

    for imgs, labels in train_loader:
        imgs, labels = imgs.to(DEVICE), labels.to(DEVICE)
        optimizer.zero_grad()
        outputs = model(imgs)
        loss = criterion(outputs, labels)
        loss.backward()
        optimizer.step()
        train_loss += loss.item()
        train_correct += (outputs.argmax(1) == labels).sum().item()

    train_acc = train_correct / max(1, len(train_ds))

    model.eval()
    val_correct = 0
    val_loss = 0.0
    with torch.no_grad():
        for imgs, labels in val_loader:
            imgs, labels = imgs.to(DEVICE), labels.to(DEVICE)
            outputs = model(imgs)
            val_loss += criterion(outputs, labels).item()
            val_correct += (outputs.argmax(1) == labels).sum().item()

    val_acc = val_correct / max(1, len(val_ds))
    scheduler.step(val_acc)

    print(
        f"Epoch {epoch + 1:02d}/{EPOCHS} | "
        f"Train Loss: {train_loss:.3f} | Train Acc: {train_acc:.3f} | "
        f"Val Loss: {val_loss:.3f} | Val Acc: {val_acc:.3f} | "
        f"LR: {optimizer.param_groups[0]['lr']:.6f}"
    )

    if val_acc > best_val_acc:
        best_val_acc = val_acc
        torch.save(model.state_dict(), WEIGHTS_PATH)
        print(f"  Best model saved! Val Acc: {val_acc:.3f}")
        no_improve = 0
    else:
        no_improve += 1
        print(f"  No improvement ({no_improve}/{patience})")

    if no_improve >= patience:
        print(f"\nEarly stopping at epoch {epoch + 1}")
        break


# ---------- TEST EVALUATION ----------
if test_loader:
    model.load_state_dict(torch.load(WEIGHTS_PATH, map_location=DEVICE))
    model.eval()
    test_correct = 0
    with torch.no_grad():
        for imgs, labels in test_loader:
            imgs, labels = imgs.to(DEVICE), labels.to(DEVICE)
            outputs = model(imgs)
            test_correct += (outputs.argmax(1) == labels).sum().item()
    test_acc = test_correct / max(1, len(test_ds))
    print(f"Test Acc: {test_acc:.3f}")

print(f"\nTraining complete! Best Val Acc: {best_val_acc:.3f}")
print(f"Weights saved to: {WEIGHTS_PATH}")


