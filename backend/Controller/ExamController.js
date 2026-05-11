import prisma from "../DB/prisma.js";
import { generateExamKey } from "../utils/generatekey.js";

function parseDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getScheduleParts({ title, description, startTime, endTime }) {
  if (!title || !description) {
    return { error: "Title and description are required" };
  }

  const start = parseDate(startTime);
  const end = parseDate(endTime);
  const now = new Date();
  now.setSeconds(0, 0);

  if (!start || !end) {
    return { error: "Start time and end time are required" };
  }

  if (start < now) {
    return { error: "Start time cannot be in the past" };
  }

  if (start >= end) {
    return { error: "End time must be later than start time" };
  }

  const durationMinutes = Math.round((end.getTime() - start.getTime()) / 60000);
  if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) {
    return { error: "Duration must be at least 1 minute" };
  }

  return { start, end, durationMinutes };
}



export const createExam = async (req, res) => {
  try {
    const {
      title,
      description,
      startTime,
      endTime,
      teacherId
    } = req.body;

    const schedule = getScheduleParts({
      title,
      description,
      startTime,
      endTime
    });

    if (schedule.error) {
      return res.status(400).json({ message: schedule.error });
    }

    const examKey = generateExamKey();
    

    const exam = await prisma.exam.create({
      data: {
        title,
        description,
        durationMinutes: schedule.durationMinutes,
        examKey,
        startTime: schedule.start,
        endTime: schedule.end,
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
      startTime,
      endTime
    } = req.body;

    const schedule = getScheduleParts({
      title,
      description,
      startTime,
      endTime
    });

    if (schedule.error) {
      return res.status(400).json({ message: schedule.error });
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
        durationMinutes: schedule.durationMinutes,
        startTime: schedule.start,
        endTime: schedule.end
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
