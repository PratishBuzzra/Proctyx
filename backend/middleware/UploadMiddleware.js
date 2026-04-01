import multer from "multer";
import path from "path";
import fs from "fs";

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = "uploads/students";
    ensureDir(dir);
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const imageFileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image file are allowed"), false);
  }
};

export const upload = multer({
  storage: storage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

const proctoringStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = "uploads/proctoring";
    ensureDir(dir);
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}_${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`);
  },
});

const proctoringFileFilter = (req, file, cb) => {
  const isVideo = file.mimetype.startsWith("video/");
  const allowedExt = [".webm", ".mp4", ".mkv", ".mov"];
  const fileExt = path.extname(file.originalname || "").toLowerCase();
  if (isVideo || allowedExt.includes(fileExt)) {
    cb(null, true);
  } else {
    cb(new Error("Only video files are allowed"), false);
  }
};

export const uploadProctoring = multer({
  storage: proctoringStorage,
  fileFilter: proctoringFileFilter,
  limits: { fileSize: 500 * 1024 * 1024 },
});
