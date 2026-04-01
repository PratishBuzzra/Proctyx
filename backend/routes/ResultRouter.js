import express from "express";
import { submitExam, getStudentResult, getExamResults } from "../Controller/ResultController.js";
const router = express.Router();
router.post("/results/submit", submitExam);
router.get("/results/:examId/:studentId", getStudentResult);
router.get("/results/exam/:examId", getExamResults);  // for teacher later
export default router;