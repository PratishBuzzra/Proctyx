import sys
import os

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, ROOT_DIR)

import torch
from torch.utils.data import DataLoader, random_split
from torchvision import datasets, transforms
from antispoof.model import AntiSpoofNet


DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
DATA_DIR = "training/dataset_flat/train"
WEIGHTS_DIR = "weights"
os.makedirs(WEIGHTS_DIR, exist_ok=True)

print(f"Using device: {DEVICE}")

# ---------- AUGMENTATION ----------
# More aggressive augmentation for better generalization
train_transform = transforms.Compose([
    transforms.Resize((128, 128)),
    transforms.RandomHorizontalFlip(),
    transforms.RandomVerticalFlip(p=0.1),
    transforms.RandomRotation(15),
    transforms.ColorJitter(brightness=0.3, contrast=0.3, saturation=0.3, hue=0.1),
    transforms.RandomGrayscale(p=0.05),
    transforms.GaussianBlur(kernel_size=3, sigma=(0.1, 2.0)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.5]*3, std=[0.5]*3),
    transforms.RandomErasing(p=0.2)
])

val_transform = transforms.Compose([
    transforms.Resize((128, 128)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.5]*3, std=[0.5]*3)
])

# ---------- DATASET ----------
full_dataset = datasets.ImageFolder(DATA_DIR)

train_size = int(0.8 * len(full_dataset))
val_size   = len(full_dataset) - train_size
train_ds, val_ds = random_split(full_dataset, [train_size, val_size])

# Apply different transforms to train and val
train_ds.dataset.transform = train_transform
val_ds.dataset.transform   = val_transform

train_loader = DataLoader(train_ds, batch_size=32, shuffle=True,  num_workers=0)
val_loader   = DataLoader(val_ds,   batch_size=32, shuffle=False, num_workers=0)

print(f"Train: {len(train_ds)} | Val: {len(val_ds)}")
print(f"Classes: {full_dataset.classes}")

# ---------- CLASS WEIGHTS (handles imbalanced dataset) ----------
class_counts = [0, 0]
for _, label in full_dataset:
    class_counts[label] += 1

total = sum(class_counts)
class_weights = torch.tensor(
    [total / (2 * c) for c in class_counts],
    dtype=torch.float
).to(DEVICE)

print(f"Class counts: {dict(zip(full_dataset.classes, class_counts))}")
print(f"Class weights: {class_weights}")

# ---------- MODEL ----------
model     = AntiSpoofNet().to(DEVICE)
criterion = torch.nn.CrossEntropyLoss(weight=class_weights)
optimizer = torch.optim.Adam(model.parameters(), lr=1e-3, weight_decay=1e-4)

# ---------- SCHEDULER ----------
# Reduces LR by 0.5 if val accuracy doesn't improve for 3 epochs
scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
    optimizer, mode='max', factor=0.5, patience=3
)

# ---------- TRAINING LOOP ----------
EPOCHS        = 30
best_val_acc  = 0.0
patience      = 7       # early stopping patience
no_improve    = 0

for epoch in range(EPOCHS):
    # ---- TRAIN ----
    model.train()
    train_loss  = 0
    train_correct = 0

    for imgs, labels in train_loader:
        imgs, labels = imgs.to(DEVICE), labels.to(DEVICE)
        optimizer.zero_grad()
        outputs = model(imgs)
        loss    = criterion(outputs, labels)
        loss.backward()
        optimizer.step()
        train_loss    += loss.item()
        train_correct += (outputs.argmax(1) == labels).sum().item()

    train_acc = train_correct / len(train_ds)

    # ---- VALIDATE ----
    model.eval()
    val_correct = 0
    val_loss    = 0

    with torch.no_grad():
        for imgs, labels in val_loader:
            imgs, labels = imgs.to(DEVICE), labels.to(DEVICE)
            outputs      = model(imgs)
            val_loss    += criterion(outputs, labels).item()
            val_correct += (outputs.argmax(1) == labels).sum().item()

    val_acc = val_correct / len(val_ds)

    # ---- SCHEDULER STEP ----
    scheduler.step(val_acc)

    print(f"Epoch {epoch+1:02d}/{EPOCHS} | "
          f"Train Loss: {train_loss:.3f} | Train Acc: {train_acc:.3f} | "
          f"Val Loss: {val_loss:.3f} | Val Acc: {val_acc:.3f} | "
          f"LR: {optimizer.param_groups[0]['lr']:.6f}")

    # ---- SAVE BEST MODEL ----
    if val_acc > best_val_acc:
        best_val_acc = val_acc
        torch.save(model.state_dict(), f"{WEIGHTS_DIR}/antispoof_weights.pth")
        print(f"  ✅ Best model saved! Val Acc: {val_acc:.3f}")
        no_improve = 0
    else:
        no_improve += 1
        print(f"  No improvement ({no_improve}/{patience})")

    # ---- EARLY STOPPING ----
    if no_improve >= patience:
        print(f"\n⛔ Early stopping at epoch {epoch+1}")
        break

print(f"\n✅ Training complete! Best Val Acc: {best_val_acc:.3f}")
print(f"Weights saved to: {WEIGHTS_DIR}/antispoof_weights.pth")