import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useExam } from "../../context/ExamContext";

const base_url = import.meta.env.VITE_API_URL;

const JoinExam = () => {
  const [examKey, setExamKey] = useState("");
  const navigate = useNavigate();
const { updateExamState } = useExam();
  const handleJoin = async (e) => {
    e.preventDefault();

    if (!examKey.trim()) {
      alert("Please enter exam key");
      return;
    }

    try {
      const res = await fetch(`${base_url}/studentexam/joinexam`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ examKey })
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message);
        return;
      }
      updateExamState({
        examId: data.examId,
        accessToken: data.accessToken,
        startTime: data.startTime,
        endTime: data.endTime,
        durationMinutes: data.durationMinutes,
      });
      // Navigate to student verification page with examId
      navigate(`/studentverify/${data.examId}`);
    } catch (error) {
      alert("Error joining exam");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
        <h2 className="text-xl font-bold mb-6 text-center">Join Exam</h2>

        <form onSubmit={handleJoin}>
          <input
            type="text"
            placeholder="Enter Exam Key"
            value={examKey}
            onChange={(e) => setExamKey(e.target.value)}
            className="w-full border p-3 rounded mb-4"
          />

          <button
            type="submit"
            className="w-full bg-green-600 text-white py-3 rounded hover:bg-green-700"
          >
            Join
          </button>
        </form>
      </div>
    </div>
  );
};

export default JoinExam;
