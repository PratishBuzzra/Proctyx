// components/SimpleProtectedRoute.jsx - IMPROVED VERSION
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useExam } from '../context/ExamContext';


const ProtectedExamRoute = ({ 
  children, 
  requireVerification = false,
  requireSystemCheck = false,
  requireRulesAcceptance = false
}) => {
  const { examId } = useParams();
  const navigate = useNavigate();
  const { 
    examId: storedExamId, 
    accessToken, 
    verified, 
    systemChecked, 
    rulesAccepted
  } = useExam();

  // Check if user has access to this exam
  if (!accessToken || !storedExamId || storedExamId.toString() !== examId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-4">Access Denied</h2>
          <p>Please join the exam first</p>
          <button 
            onClick={() => navigate('/joinexam')}
            className="mt-4 bg-blue-500 text-white px-4 py-2 rounded"
          >
            Join Exam
          </button>
        </div>
      </div>
    );
  }

  // Check step requirements and redirect accordingly
  if (requireVerification && !verified) {
    navigate(`/studentverify/${examId}`);
    return <div>Redirecting to verification...</div>;
  }

  if (requireSystemCheck && !systemChecked) {
    navigate(`/systemcheck/${examId}`);
    return <div>Redirecting to system check...</div>;
  }

  if (requireRulesAcceptance && !rulesAccepted) {
    navigate(`/rules/${examId}`);
    return <div>Redirecting to rules...</div>;
  }

  return children;
};

export default ProtectedExamRoute;
