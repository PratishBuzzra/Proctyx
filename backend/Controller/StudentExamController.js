import fs from "fs";
import axios from "axios";
import FormData from "form-data";
import prisma from "../DB/prisma.js";

const FACE_VERIFY_TIMEOUT_MS = parseInt(process.env.FACE_VERIFY_TIMEOUT_MS || "45000", 10);

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
      "http://localhost:8001/verify-face-v2",
      formData,
      { headers: formData.getHeaders(), timeout: FACE_VERIFY_TIMEOUT_MS }
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
        message: "Face verification timed out. Please try again in a moment."
      });
    }

    console.error("AI service error:", error.message);

    return res.status(503).json({
      verified: false,
      message: "Face verification service unavailable"
    });
  }
};

export const monitorFaceDuringExam = async (req, res) => {
  const { studentId, examId } = req.body;

  if (!studentId || !examId || !req.file) {
    if (req.file?.path) fs.unlink(req.file.path, () => {});
    return res.status(400).json({
      violation: false,
      matched: false,
      message: "Student ID, exam ID and live photo are required"
    });
  }

  try {
    const student = await prisma.student.findUnique({
      where: { student_id: studentId }
    });

    if (!student) {
      fs.unlink(req.file.path, () => {});
      return res.status(404).json({
        violation: true,
        matched: false,
        message: "Student not found"
      });
    }

    const formData = new FormData();
    formData.append("registered_image", fs.createReadStream(student.photoupload));
    formData.append("live_image", fs.createReadStream(req.file.path));

    const aiResponse = await axios.post(
      "http://localhost:8001/monitor-face-match",
      formData,
      { headers: formData.getHeaders(), timeout: FACE_VERIFY_TIMEOUT_MS }
    );

    const { matched, critical, distance, similarity, match_level, reason, confidence, liveness, ignored } = aiResponse.data;

    return res.json({
      violation: Boolean(critical),
      matched,
      critical: Boolean(critical),
      ignored: Boolean(ignored),
      distance,
      similarity,
      match_level,
      confidence,
      liveness,
      reason: matched ? null : reason || "Face mismatch detected during exam"
    });
  } catch (error) {
    if (error.code === "ECONNABORTED") {
      return res.status(503).json({
        violation: false,
        matched: false,
        message: "Face monitoring timed out"
      });
    }

    console.error("Face monitoring error:", error.message);
    return res.status(503).json({
      violation: false,
      matched: false,
      message: "Face monitoring service unavailable"
    });
  } finally {
    if (req.file?.path) fs.unlink(req.file.path, () => {});
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
      startTime: exam.startTime,
      endTime: exam.endTime,
      durationMinutes: exam.durationMinutes,
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

