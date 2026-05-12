import express from "express";
import { uploadVerify } from "../middleware/UploadVerify.js";
import { verifyFaceAI, joinExam, getExamQuestions, monitorFaceDuringExam } from "../Controller/StudentExamController.js";
import { checkExamAccess } from "../middleware/CheckExamAccess.js";

const router = express.Router();

router.post(
  "/verify",
  uploadVerify.array("live_photos", 6),
  
  verifyFaceAI
);
router.post(
  "/monitor-face",
  uploadVerify.single("live_photo"),
  monitorFaceDuringExam
);
router.post('/joinexam', joinExam)
router.get("/exam/:examId/questions", getExamQuestions);
export default router;
