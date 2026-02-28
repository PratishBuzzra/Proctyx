import express from "express";
import { storeViolation, getViolationsByExam } from "../Controller/ViolationController.js";

const router = express.Router();

router.post("/store", storeViolation);
router.get("/:examId", getViolationsByExam);

export default router;