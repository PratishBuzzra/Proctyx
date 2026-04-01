import prisma from "../DB/prisma.js";

// Submit exam answers and calculate score
export const submitExam = async (req, res) => {
    
  const { examId, studentId, answers } = req.body;
  // answers = [{ questionId, selectedAnswer }, ...]
  console.log("Received:", req.body);

  if (!examId || !studentId || !answers || !answers.length) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    // Check if already submitted
    const existing = await prisma.examResult.findFirst({
      where: {
        examId: parseInt(examId),
        studentId,
      },
    });

    if (existing) {
      return res.status(400).json({ message: "Exam already submitted" });
    }

    // Get all questions with correct answers
    const questions = await prisma.question.findMany({
      where: { examId: parseInt(examId) },
    });

    if (!questions.length) {
      return res.status(404).json({ message: "No questions found" });
    }

    // Calculate score
    let score = 0;
    const totalQuestions = questions.length;

    for (const question of questions) {
      const studentAnswer = answers.find(
        (a) => a.questionId === question.id
      );

      if (studentAnswer) {
        // Map "A","B","C","D" to actual option text
        const optionMap = {
          A: question.optionA,
          B: question.optionB,
          C: question.optionC,
          D: question.optionD,
        };
        const correctText = optionMap[question.correctAnswer];

        if (studentAnswer.selectedAnswer === correctText) {
          score += 1;
        }
      }
    }

    const percentage = parseFloat(
      ((score / totalQuestions) * 100).toFixed(2)
    );

    // Save result
    const result = await prisma.examResult.create({
      data: {
        examId: parseInt(examId),
        studentId,
        score,
        totalQuestions,
        percentage,
      },
    });

    return res.status(201).json({
      success: true,
      result: {
        score,
        totalQuestions,
        percentage,
        submittedAt: result.submittedAt,
      },
    });
  } catch (error) {
    console.error("Submit exam error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// Get result for a student
export const getStudentResult = async (req, res) => {
  const { examId, studentId } = req.params;

  try {
    const result = await prisma.examResult.findFirst({
      where: {
        examId: parseInt(examId),
        studentId,
      },
      include: {
        exam: {
          select: { title: true },
        },
      },
    });

    if (!result) {
      return res.status(404).json({ message: "Result not found" });
    }

    return res.json(result);
  } catch (error) {
    console.error("Get result error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// Get all results for an exam (for teacher)
export const getExamResults = async (req, res) => {
  const { examId } = req.params;

  try {
    const results = await prisma.examResult.findMany({
      where: { examId: parseInt(examId) },
      orderBy: { percentage: "desc" },
    });

    return res.json(results);
  } catch (error) {
    console.error("Get exam results error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};