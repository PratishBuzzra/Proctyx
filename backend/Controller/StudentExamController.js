import fs from "fs";
import axios from "axios";
import FormData from "form-data";
import prisma from "../DB/prisma.js";

export const verifyFaceAI = async (req, res) => {
  const { student_id, name, email } = req.body;
  console.log("Files received:", req.files);


  console.log("Face verification request received:", student_id);

  if (!student_id || !name || !email || !req.files || req.files.length === 0) {

    console.log("Missing required fields");
    return res.status(400).json({
      verified: false,
      message: "All fields and live photo are required"
    });
  }

  const student = await prisma.student.findUnique({
    where: { student_id }
  });

  if (!student) {
    fs.unlink(req.file.path, () => {});
    console.log("Student not found:", student_id);
    return res.status(404).json({
      verified: false,
      message: "Student not found"
    });
  }

  if (student.email !== email || student.name !== name) {
    req.files.forEach(file => fs.unlink(file.path, () => {}));

    console.log("Student details mismatch");
    return res.status(401).json({
      verified: false,
      message: "Student details mismatch"
    });
  }

  // 3️⃣ Prepare images for Python AI
  const formData = new FormData();
  formData.append("registered_image", fs.createReadStream(student.photoupload));
  req.files.forEach((file, index) => {
  formData.append("live_images", fs.createReadStream(file.path));
});

  try {
    console.log("Sending images to Python AI service...");

    const aiResponse = await axios.post(
      "http://localhost:8001/verify-face",
      formData,
      { headers: formData.getHeaders(), timeout: 15000 }
    );

  req.files.forEach((file) => fs.unlink(file.path, () => {}));


    const { matched, distance, match_level, reason } = aiResponse.data;

console.log("AI Response JSON:", aiResponse.data);

console.log(
  matched
    ? `Face verified successfully (Level: ${match_level}, Distance: ${distance})`
    : `Face verification failed (Level: ${match_level}, Distance: ${distance}, Reason: ${reason})`
);

return res.json({
  verified: matched,
  allow_exam: matched,
  distance,
  match_level,
  message: matched
    ? `Face verified (${match_level} match)`
    : reason || "Face verification failed. Please try again."
});


  } catch (error) {
    req.files.forEach(file => fs.unlink(file.path, () => {}));


    if (error.code === "ECONNABORTED") {
      console.error("AI service timeout");
      return res.status(503).json({
        verified: false,
        message: "Face verification timed out. Please hold still and try again."
      });
    }

    console.error("AI service error:", error.message);

    return res.status(503).json({
      verified: false,
      message: "Face verification service unavailable"
    });
  }
};

// Controller/StudentExamController.js - Update joinExam
export const joinExam = async (req, res) => {
  const { examKey } = req.body;

  if (!examKey) {
    return res.status(400).json({ message: "Exam key is required" });
  }

  try {
    const exam = await prisma.exam.findUnique({
      where: { examKey }
    });

    if (!exam) {
      return res.status(404).json({ message: "Invalid exam key" });
    }

    const now = new Date();
    if (now < exam.startTime || now > exam.endTime) {
      return res.status(403).json({
        message: "Exam is not active at this time"
      });
    }

    // Simple access token
    const accessToken = `${exam.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return res.json({
      examId: exam.id,
      accessToken, // Send this to frontend
      message: "Successfully joined exam"
    });

  } catch (error) {
    console.error("Join exam error:", error);
    return res.status(500).json({
      message: "Server error"
    });
  }
};



export const getExamQuestions = async (req, res) => {
  const { examId } = req.params;

  try {
    const questions = await prisma.question.findMany({
      where: { examId: parseInt(examId) },
      select: {
        id: true,
        questionText: true,
        optionA: true,
        optionB: true,
        optionC: true,
        optionD: true,
      },
    });

    if (!questions.length) {
      return res.status(404).json({ message: "No questions found for this exam" });
    }

    res.json(questions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

