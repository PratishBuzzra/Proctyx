import express from "express";
import { upload, uploadProctoring } from "../middleware/UploadMiddleware.js";
import { ExtractFaceMismatchClip, UploadProctoringVideo, UploadStudentImage } from "../Controller/UploadController.js";

const router = express.Router();

router.post(
  "/upload-photo",
  upload.single("photo"),
  UploadStudentImage
);

router.post(
  "/upload-proctoring",
  uploadProctoring.single("recording"),
  UploadProctoringVideo
);

router.post(
  "/extract-face-mismatch-clip",
  ExtractFaceMismatchClip
);

export default router;
