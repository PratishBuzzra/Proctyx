import express from "express";
import { upload } from "../middleware/UploadMiddleware.js";
import { UploadStudentImage } from "../Controller/UploadController.js";

const router = express.Router();

router.post(
  "/upload-photo",
  upload.single("photo"),
  UploadStudentImage
);

export default router;
