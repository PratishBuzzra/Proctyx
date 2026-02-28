import prisma from "../DB/prisma.js";

export const storeViolation = async (req, res) => {
  const { examId, studentId, type, severity, description, audioPath, videoPath } = req.body;

  if (!examId || !studentId || !type || !severity) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    const violation = await prisma.violation.create({
      data: {
        examId: parseInt(examId),
        studentId,
        type,
        severity,
        description: description || "",
        audioPath: audioPath || null,
        videoPath: videoPath || null,
      },
    });

    return res.status(201).json({ success: true, violation });
  } catch (error) {
    console.error("Store violation error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getViolationsByExam = async (req, res) => {
  const { examId } = req.params;

  try {
    const violations = await prisma.violation.findMany({
      where: { examId: parseInt(examId) },
      orderBy: { timestamp: "asc" },
    });

    return res.json(violations);
  } catch (error) {
    console.error("Get violations error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};