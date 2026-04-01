import "dotenv/config";
import express from 'express';
import cors from 'cors';
import teacherroute from './routes/TeacherRouter.js';
import uploadroute from './routes/UploadRoutes.js';
import studentroute from './routes/StudentRouter.js';
import studentexamroute from "./routes/StudentExamRouter.js";
import examroute from "./routes/ExamRouter.js"
import questionRoutes from "./routes/QuestionRouter.js"
import cookieParser from 'cookie-parser';
import violationRoutes from "./routes/ViolationRouter.js";
import ResultRoutes from "./routes/ResultRouter.js"

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: "http://localhost:5173",
  credentials: true,
}));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/uploads', express.static('uploads'));
app.use('/api/v1/teacher', teacherroute);
app.use('/api/v1/student', studentroute);
app.use('/api/v1/uploadstudent', uploadroute);
app.use("/api/v1/studentexam", studentexamroute);
app.use('/api/v1/exam', examroute)
app.use("/api/v1/questions", questionRoutes);
app.use("/api/v1/violations", violationRoutes);
app.use("/api/v1/checkresult", ResultRoutes);
app.get('/', (req, res) => {
  res.send('<h1>Welcome to services</h1>');
});

app.listen(PORT, () => console.log(`Server is running on PORT ${PORT}`));
