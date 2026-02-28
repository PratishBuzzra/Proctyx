import prisma from "../DB/prisma.js";

export const checkExamAccess = async (req, res, next) => {
  const { examId } = req.params; // or req.body if needed

  if (!examId) return res.status(400).json({ message: "Exam ID is required" });

  try {
    const exam = await prisma.exam.findUnique({
      where: { id: parseInt(examId) }
    });

    if (!exam) return res.status(403).json({ message: "Invalid exam access" });

    // Optional: check if exam is active
    const now = new Date();
    if (now < exam.startTime || now > exam.endTime) {
      return res.status(403).json({ message: "Exam is not active" });
    }

    req.exam = exam; // store exam info if needed
    next();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to validate exam access" });
  }
};
