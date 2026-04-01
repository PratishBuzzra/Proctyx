import React from "react";
import Navbar from "./components/StaticComponets/Navbar/Navbar";
import { Route, Routes } from "react-router-dom";

import Register from "./pages/Register/Register";

import Login from "./pages/Login/Login";

import Home from "./pages/Home";

import Aboutus from "./pages/Aboutus";
import HowItWorks from "./pages/HowItWorks";
import ExamSystemCheck from "./pages/Exam/ExamSystemCheck";
import Exam from "./pages/Exam/Exam";
import ExamRules from "./pages/Exam/ExamRules";
import StudentVerify from "./pages/Exam/StudentVerify";
import TeacherDashboard from "./pages/Teacher/TeacherDashboard";
import { ToastContainer } from "react-toastify";
import CreateExam from "./pages/Teacher/CreateExam";
import AddQuestions from "./pages/Teacher/AddQuestions";
import TeacherProtected from "./routes/TeacherProtected";
import JoinExam from "./pages/Exam/JoinExam";
import ProtectedExamRoute from "./routes/ProtectedExamRoute";
import Result from "./pages/Result";
import ExamReport from "./pages/Teacher/ExamReport";

const App = () => {
  return (
    <div>
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        closeOnClick
        pauseOnHover={false}
        draggable={false}
        theme="dark"
      />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<Aboutus />} />
        <Route path="/register" element={<Register />} />
        <Route path="/howitworks" element={<HowItWorks />} />
        <Route path="/login" element={<Login />} />
        <Route path="/join-exam" element={<JoinExam />} />
        <Route path="/result/:examId/:studentId" element={<Result />} />
      
        <Route
          path="/studentverify/:examId"
          element={
            <ProtectedExamRoute>
              {" "}
              <StudentVerify />{" "}
            </ProtectedExamRoute>
          }
        />{" "}
        <Route
          path="/systemcheck/:examId"
          element={
            <ProtectedExamRoute requireVerification={true}>
              {" "}
              <ExamSystemCheck />{" "}
            </ProtectedExamRoute>
          }
        />{" "}
        <Route
          path="/rules/:examId"
          element={
            <ProtectedExamRoute
              requireVerification={true}
              requireSystemCheck={true}
            >
              {" "}
              <ExamRules />{" "}
            </ProtectedExamRoute>
          }
        />{" "}
        <Route
          path="/exam/:examId"
          element={
            <ProtectedExamRoute
              requireVerification={true}
              requireSystemCheck={true}
              requireRulesAcceptance={true}
            >
              {" "}
              <Exam />{" "}
            </ProtectedExamRoute>
          }
        />
        <Route
          path="/teacherdashboard"
          element={
            <TeacherProtected>
              <TeacherDashboard />
            </TeacherProtected>
          }
        />
        <Route
          path="/createexam"
          element={
            <TeacherProtected>
              <CreateExam />
            </TeacherProtected>
          }
        />
        <Route
          path="/exam/:id/questions"
          element={
            <TeacherProtected>
              <AddQuestions />
            </TeacherProtected>
          }
        />
        <Route
  path="/exam/:examId/report"
  element={
    <TeacherProtected>
      <ExamReport />
    </TeacherProtected>
  }
/>
      </Routes>
    </div>
  );
};

export default App;
