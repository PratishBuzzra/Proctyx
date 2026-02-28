import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import WebcamMonitor from "../../components/WebcamMonitor";
import useExamGuard from "../../hooks/useExamGuard";
import useFullscreenGuard from "../../hooks/useFullscreenGuard";
import useProctoringRecorder from "../../hooks/useProctoringRecorder";
import useAudioMonitor from "../../hooks/useAudioMonitor";
import { useExam } from "../../context/ExamContext";

const base_url = import.meta.env.VITE_API_URL;

function Exam() {
  const { examId } = useParams();
  const { studentId, selectedDeviceId } = useExam();
  const [questions, setQuestions] = useState([]);
  const [examActive, setExamActive] = useState(true);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);

  /* guards */
  useExamGuard();
  const { isFullscreen, requestFullscreen } = useFullscreenGuard();
  const { downloadRecording } = useProctoringRecorder(examActive, selectedDeviceId);
  useAudioMonitor(examActive, examId, studentId);

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const res = await fetch(`${base_url}/studentexam/exam/${examId}/questions`, {
          credentials: "include",
        });
        const data = await res.json();
        if (res.ok) {
          const formatted = data.map(q => ({
            id: q.id,
            question: q.questionText,
            options: [q.optionA, q.optionB, q.optionC, q.optionD],
          }));
          setQuestions(formatted);
        } else {
          alert(data.message || "Failed to load questions");
        }
      } catch (err) {
        console.error(err);
        alert("Server error while loading questions");
      } finally {
        setLoading(false);
      }
    };

    fetchQuestions();
  }, [examId]);

  const handleNext = () => {
    if (!selected) {
      alert("Please select an answer");
      return;
    }

    if (current === questions.length - 1) {
      setExamActive(false);
      downloadRecording();
      alert("Exam submitted successfully");
      return;
    }

    setCurrent(prev => prev + 1);
    setSelected("");
  };

  if (loading) return <h2 className="p-6">Loading questions...</h2>;
  if (!questions.length) return <h2 className="p-6">No questions available for this exam</h2>;

  return (
    <>
      <WebcamMonitor
        examId={examId}
        studentId={studentId}
        active={examActive}
      />

      {!isFullscreen && (
        <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center text-white">
          <p className="mb-4 text-lg">Fullscreen is required to continue</p>
          <button onClick={requestFullscreen} className="bg-green-500 px-6 py-2 rounded">
            Return to Fullscreen
          </button>
        </div>
      )}

      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
          <h2 className="mb-4 font-bold">
            Question {current + 1} / {questions.length}
          </h2>

          <p className="mb-4">{questions[current].question}</p>

          {questions[current].options.map((opt) => (
            <label key={opt} className="block mb-2">
              <input type="radio" checked={selected === opt} onChange={() => setSelected(opt)} className="mr-2" />
              {opt}
            </label>
          ))}

          <button onClick={handleNext} className="mt-4 bg-blue-600 text-white px-4 py-2 rounded">
            {current === questions.length - 1 ? "Submit" : "Next"}
          </button>
        </div>
      </div>
    </>
  );
}

export default Exam;