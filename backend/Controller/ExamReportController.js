import prisma from "../DB/prisma.js";

export const getExamReport = async (req, res) => {
  const { examId } = req.params;
  const FULL_RECORDING_TYPE = "PROCTORING_FULL_VIDEO";

  try {
    // Get exam details
    const exam = await prisma.exam.findUnique({
      where: { id: parseInt(examId) },
    });

    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }

    // Get all results for this exam
    const results = await prisma.examResult.findMany({
      where: { examId: parseInt(examId) },
      orderBy: { percentage: "desc" },
    });

    // Get all violations for this exam
    const violations = await prisma.violation.findMany({
      where: { examId: parseInt(examId) },
      orderBy: { timestamp: "asc" },
    });

    // Group violations by studentId and extract full recording path separately
    const violationsByStudent = {};
    const fullRecordingByStudent = {};
    for (const v of violations) {
      if (v.type === FULL_RECORDING_TYPE) {
        // Keep the latest uploaded full recording path for that student
        fullRecordingByStudent[v.studentId] = v.videoPath || null;
        continue;
      }
      if (!violationsByStudent[v.studentId]) {
        violationsByStudent[v.studentId] = [];
      }
      violationsByStudent[v.studentId].push(v);
    }

    // Merge results with violations
    const report = results.map((result) => ({
      studentId: result.studentId,
      score: result.score,
      totalQuestions: result.totalQuestions,
      percentage: result.percentage,
      submittedAt: result.submittedAt,
      fullRecordingPath: fullRecordingByStudent[result.studentId] || null,
      violations: violationsByStudent[result.studentId] || [],
      violationCount: (violationsByStudent[result.studentId] || []).length,
    }));

    return res.json({ exam, report });
  } catch (error) {
    console.error("Get exam report error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};
