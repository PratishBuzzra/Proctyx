import React, { useEffect, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";

const base_url = import.meta.env.VITE_API_URL;

function Result() {
  const { examId, studentId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [result, setResult] = useState(location.state?.result || null);
  const [loading, setLoading] = useState(!result);

  useEffect(() => {
    if (result) return;

    const fetchResult = async () => {
      try {
        const res = await fetch(
          `${base_url}/checkresult/results/${examId}/${studentId}`,
          { credentials: "include" }
        );
        const data = await res.json();
        if (res.ok) setResult(data);
        else alert(data.message || "Failed to load result");
      } catch (err) {
        console.error(err);
        alert("Server error");
      } finally {
        setLoading(false);
      }
    };

    fetchResult();
  }, []);

  if (loading) return <h2 className="p-6 text-center">Loading result...</h2>;
  if (!result) return <h2 className="p-6 text-center">Result not found</h2>;

  const passed = result.percentage >= 50;

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-xl p-10 w-full max-w-md text-center">

        {/* Pass/Fail Badge */}
        <div
          className={`text-5xl mb-4 ${passed ? "text-green-500" : "text-red-500"}`}
        >
          {passed ? "🎉" : "😞"}
        </div>

        <h1 className="text-2xl font-bold mb-1">
          {passed ? "Congratulations!" : "Better Luck Next Time"}
        </h1>

        <p className="text-gray-500 mb-6">Exam Result</p>

        {/* Score Card */}
        <div className="bg-gray-50 rounded-xl p-6 mb-6">
          <div className="text-5xl font-bold mb-2 text-blue-600">
            {result.score}/{result.totalQuestions}
          </div>
          <div className="text-gray-500 text-sm">Questions Correct</div>

          <div className="mt-4">
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>Score</span>
              <span>{result.percentage}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all duration-500 ${
                  passed ? "bg-green-500" : "bg-red-500"
                }`}
                style={{ width: `${result.percentage}%` }}
              />
            </div>
          </div>
        </div>

        {/* Status */}
        <div
          className={`inline-block px-6 py-2 rounded-full text-white font-semibold mb-6 ${
            passed ? "bg-green-500" : "bg-red-500"
          }`}
        >
          {passed ? "PASSED" : "FAILED"}
        </div>

        <div className="text-gray-400 text-xs mb-6">
          Submitted at:{" "}
          {new Date(result.submittedAt).toLocaleString()}
        </div>

        <button
          onClick={() => navigate("/")}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition"
        >
          Back to Home
        </button>
      </div>
    </div>
  );
}

export default Result;