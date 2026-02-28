import express from "express";
import { uploadVerify } from "../middleware/UploadVerify.js";
import { verifyFaceAI, joinExam, getExamQuestions } from "../Controller/StudentExamController.js";
import { checkExamAccess } from "../middleware/CheckExamAccess.js";

const router = express.Router();

router.post(
  "/verify",
  uploadVerify.array("live_photos", 6),
  
  verifyFaceAI
);
router.post('/joinexam', joinExam)
router.get("/exam/:examId/questions", getExamQuestions);
export default router;
