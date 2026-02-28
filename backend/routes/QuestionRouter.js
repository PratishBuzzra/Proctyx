import express from "express";
import {
  addQuestion,
  getQuestionsByExam,
  deleteQuestion
} from "../Controller/QuestionsController.js";
import { requireTeacherLogin } from "../middleware/AuthMiddleware.js";

const router = express.Router();

router.post("/addquestion", requireTeacherLogin, addQuestion);
router.get("/exam/:examId", requireTeacherLogin, getQuestionsByExam);
router.delete("/question/:id", requireTeacherLogin, deleteQuestion);

export default router;
