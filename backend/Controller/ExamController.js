import prisma from "../DB/prisma.js";
import { generateExamKey } from "../utils/generatekey.js";

function parseDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function validateExamSchedule({ title, description, durationMinutes, startTime, endTime }) {
  if (!title || !description) {
    return "Title and description are required";
  }

  if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) {
    return "Duration must be a positive number of minutes";
  }

  const start = parseDate(startTime);
  const end = parseDate(endTime);

  if (!start || !end) {
    return "Start time and end time are required";
  }

  if (start >= end) {
    return "End time must be later than start time";
  }

  return null;
}



export const createExam = async (req, res) => {
  try {
    const {
      title,
      description,
      durationMinutes,
      startTime,
      endTime,
      teacherId
    } = req.body;

    const validationError = validateExamSchedule({
      title,
      description,
      durationMinutes,
      startTime,
      endTime
    });

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const examKey = generateExamKey();
    

    const exam = await prisma.exam.create({
      data: {
        title,
        description,
        durationMinutes,
        examKey,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        createdBy: req.teacher.id
      }
    });

    res.status(201).json({
      message: "Exam created successfully",
      exam
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error creating exam" });
  }
};

export const getTeacherExams = async (req, res) => {
  try {
    

    const exams = await prisma.exam.findMany({
      where: {
        createdBy: req.teacher.id
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    res.json(exams);

  } catch (error) {
    res.status(500).json({ message: "Error fetching exams" });
  }
};

export const updateExam = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      durationMinutes,
      startTime,
      endTime
    } = req.body;

    const validationError = validateExamSchedule({
      title,
      description,
      durationMinutes,
      startTime,
      endTime
    });

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    // 1️⃣ Check if exam exists and belongs to this teacher
    const exam = await prisma.exam.findUnique({
      where: { id: parseInt(id) }
    });

    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }

    if (exam.createdBy !== req.teacher.id) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    // 2️⃣ Update exam
    const updatedExam = await prisma.exam.update({
      where: { id: parseInt(id) },
      data: {
        title,
        description,
        durationMinutes,
        startTime: new Date(startTime),
        endTime: new Date(endTime)
      }
    });

    res.json({
      message: "Exam updated successfully",
      updatedExam
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error updating exam" });
  }
};

export const deleteExam = async (req, res) => {
  try {
    const { id } = req.params;

    const exam = await prisma.exam.findUnique({
      where: { id: parseInt(id) }
    });

    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }

    if (exam.createdBy !== req.teacher.id) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    // 1️⃣ Delete questions first
    await prisma.question.deleteMany({
      where: { examId: parseInt(id) }
    });

    // 2️⃣ Delete exam
    await prisma.exam.delete({
      where: { id: parseInt(id) }
    });

    res.json({ message: "Exam deleted successfully" });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error deleting exam" });
  }
};
