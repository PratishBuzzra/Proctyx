import express from "express";
import { createStudent } from "../Controller/StudentController.js";

const router = express.Router();

router.post("/registerstudent", createStudent);

export default router;
