
import fs from "fs";
import path from "path";
import { spawn } from "child_process";

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export const UploadStudentImage = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }

  res.status(201).json({
    photoPath: `uploads/students/${req.file.filename}`
  });
};

export const UploadProctoringVideo = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No recording uploaded" });
  }

  res.status(201).json({
    recordingPath: `uploads/proctoring/${req.file.filename}`,
  });
};

export const ExtractFaceMismatchClip = async (req, res) => {
  const {
    recordingPath,
    eventTimeSeconds,
    clipBeforeSeconds = 3,
    clipAfterSeconds = 3,
  } = req.body || {};

  if (!recordingPath || typeof recordingPath !== "string") {
    return res.status(400).json({ message: "recordingPath is required" });
  }

  const normalized = recordingPath.replace(/\\/g, "/").trim();
  const inputPath = path.resolve(process.cwd(), normalized);

  if (!fs.existsSync(inputPath)) {
    return res.status(404).json({ message: "Source recording not found" });
  }

  const clipDir = path.resolve(process.cwd(), "uploads/proctoring/clips");
  ensureDir(clipDir);

  const baseName = path.basename(normalized, path.extname(normalized));
  const outputName = `${baseName}_face_mismatch_${Date.now()}.mp4`;
  const outputPath = path.join(clipDir, outputName);

  const eventSec = toNumber(eventTimeSeconds, 0);
  const beforeSec = Math.max(0, toNumber(clipBeforeSeconds, 3));
  const afterSec = Math.max(1, toNumber(clipAfterSeconds, 3));
  const startSec = Math.max(0, eventSec - beforeSec);
  const durationSec = beforeSec + afterSec;

  const ffmpegArgs = [
    "-y",
    "-ss",
    String(startSec),
    "-i",
    inputPath,
    "-t",
    String(durationSec),
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "28",
    "-c:a",
    "aac",
    "-movflags",
    "+faststart",
    outputPath,
  ];

  try {
    await new Promise((resolve, reject) => {
      const ffmpeg = spawn("ffmpeg", ffmpegArgs, { stdio: "ignore" });
      ffmpeg.on("error", reject);
      ffmpeg.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg exited with code ${code}`));
      });
    });
  } catch (error) {
    console.error("Face mismatch clip extraction failed:", error.message);
    return res.status(500).json({
      message: "Failed to extract face mismatch clip",
      error: error.message,
    });
  }

  return res.status(201).json({
    clipPath: `uploads/proctoring/clips/${outputName}`,
  });
};
