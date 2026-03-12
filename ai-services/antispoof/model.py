import torch
import torch.nn as nn


class ConvBlock(nn.Module):
    """Conv → BN → ReLU → Conv → BN → ReLU with residual connection"""
    def __init__(self, in_ch, out_ch):
        super().__init__()
        self.block = nn.Sequential(
            nn.Conv2d(in_ch, out_ch, 3, 1, 1),
            nn.BatchNorm2d(out_ch),
            nn.ReLU(inplace=True),
            nn.Conv2d(out_ch, out_ch, 3, 1, 1),
            nn.BatchNorm2d(out_ch),
            nn.ReLU(inplace=True),
        )
        # residual shortcut if channels differ
        self.shortcut = nn.Sequential(
            nn.Conv2d(in_ch, out_ch, 1),
            nn.BatchNorm2d(out_ch)
        ) if in_ch != out_ch else nn.Identity()

    def forward(self, x):
        return self.block(x) + self.shortcut(x)


class AntiSpoofNet(nn.Module):
    def __init__(self):
        super().__init__()

        # ---------- FEATURE EXTRACTOR ----------
        # Input: 3 x 128 x 128
        self.features = nn.Sequential(
            # Block 1: 3 → 32, 128x128 → 64x64
            ConvBlock(3, 32),
            nn.MaxPool2d(2),
            nn.Dropout2d(0.1),

            # Block 2: 32 → 64, 64x64 → 32x32
            ConvBlock(32, 64),
            nn.MaxPool2d(2),
            nn.Dropout2d(0.1),

            # Block 3: 64 → 128, 32x32 → 16x16
            ConvBlock(64, 128),
            nn.MaxPool2d(2),
            nn.Dropout2d(0.2),

            # Block 4: 128 → 256, 16x16 → 8x8
            ConvBlock(128, 256),
            nn.MaxPool2d(2),
            nn.Dropout2d(0.2),

            # Block 5: 256 → 256, 8x8 → 4x4
            ConvBlock(256, 256),
            nn.MaxPool2d(2),
            nn.Dropout2d(0.3),

            # Global average pool → 256 x 1 x 1
            nn.AdaptiveAvgPool2d(1)
        )

        # ---------- CLASSIFIER ----------
        self.classifier = nn.Sequential(
            nn.Linear(256, 128),
            nn.ReLU(inplace=True),
            nn.Dropout(0.5),
            nn.Linear(128, 64),
            nn.ReLU(inplace=True),
            nn.Dropout(0.3),
            nn.Linear(64, 2)
        )

    def forward(self, x):
        x = self.features(x)
        x = x.view(x.size(0), -1)
        return self.classifier(x)