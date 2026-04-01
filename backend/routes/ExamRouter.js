import express from "express";
import { createExam, deleteExam, getTeacherExams, updateExam } from "../Controller/ExamController.js";
import { requireTeacherLogin } from "../middleware/AuthMiddleware.js";
import { getExamReport } from "../Controller/ExamReportController.js";

const router = express.Router();

router.post("/createexam", requireTeacherLogin, createExam);
router.get("/my-exams", requireTeacherLogin, getTeacherExams);
router.put("/my-exams/:id", requireTeacherLogin, updateExam);
router.delete("/my-exams/:id", requireTeacherLogin, deleteExam);
router.get("/report/:examId", requireTeacherLogin, getExamReport);
export default router;
