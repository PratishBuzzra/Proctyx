import prisma from "../DB/prisma.js";




export const addQuestion = async (req, res) => {
  try {
    const {
      examId,
      questionText,
      optionA,
      optionB,
      optionC,
      optionD,
      correctAnswer
    } = req.body;
   
    const exam = await prisma.exam.findUnique({
  where: { id: examId }
});

if (!exam || exam.createdBy !== req.teacher.id) {
  return res.status(403).json({ message: "Not authorized" });
}


    const question = await prisma.question.create({
      data: {
        examId,
        questionText,
        optionA,
        optionB,
        optionC,
        optionD,
        correctAnswer
      }
    });

    res.status(201).json(question);

  } catch (error) {
    res.status(500).json({ message: "Error adding question" });
  }
};

export const getQuestionsByExam = async (req, res) => {
  try {
    const examId = parseInt(req.params.examId);

    // Check if exam belongs to logged-in teacher
    const exam = await prisma.exam.findUnique({
      where: { id: examId }
    });

    if (!exam || exam.createdBy !== req.teacher.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const questions = await prisma.question.findMany({
      where: { examId }
    });

    res.json(questions);

  } catch (error) {
    res.status(500).json({ message: "Error fetching questions" });
  }
};


export const deleteQuestion = async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const question = await prisma.question.findUnique({
      where: { id },
      include: {
        exam: true
      }
    });

    if (!question || question.exam.createdBy !== req.teacher.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    await prisma.question.delete({
      where: { id }
    });

    res.json({ message: "Question deleted" });

  } catch (error) {
    res.status(500).json({ message: "Error deleting question" });
  }
};
