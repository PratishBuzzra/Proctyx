import React, { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import WebcamMonitor from "../../components/WebcamMonitor";
import useExamGuard from "../../hooks/useExamGuard";
import useFullscreenGuard from "../../hooks/useFullscreenGuard";
import useProctoringRecorder from "../../hooks/useProctoringRecorder";
import useAudioMonitor from "../../hooks/useAudioMonitor";
import { useExam } from "../../context/ExamContext";
import { toast } from "react-toastify";

const base_url = import.meta.env.VITE_API_URL;

function Exam() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const { studentId, selectedDeviceId, endTime, durationMinutes } = useExam();

  const [questions, setQuestions] = useState([]);
  const [examActive, setExamActive] = useState(true);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({}); // { questionId: selectedAnswer }
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [timeUp, setTimeUp] = useState(false);
  const [criticalViolationMessage, setCriticalViolationMessage] = useState("");
  const [isCalibrated, setIsCalibrated] = useState(false);
  const autoSubmittedRef = useRef(false);
  const submitExamRef = useRef(null);

  /* guards */
  useExamGuard(examId, studentId);
  const { isFullscreen, requestFullscreen } = useFullscreenGuard();
  const { uploadRecording, getRecordingElapsedSeconds } = useProctoringRecorder(examActive, examId, studentId, selectedDeviceId);
  useAudioMonitor(examActive, examId, studentId);

  const examDeadline = useMemo(() => {
    if (endTime) {
      const parsed = new Date(endTime);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    if (durationMinutes && durationMinutes > 0) {
      const start = new Date();
      return new Date(start.getTime() + durationMinutes * 60000);
    }

    return null;
  }, [endTime, durationMinutes]);

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const res = await fetch(
          `${base_url}/studentexam/exam/${examId}/questions`,
          { credentials: "include" }
        );
        const data = await res.json();
        if (res.ok) {
          const formatted = data.map((q) => ({
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

  useEffect(() => {
    if (!examDeadline) return undefined;

    const updateTimer = () => {
      const diff = Math.max(0, Math.floor((examDeadline.getTime() - Date.now()) / 1000));
      setRemainingSeconds(diff);

      if (diff <= 0 && !autoSubmittedRef.current) {
        autoSubmittedRef.current = true;
        setTimeUp(true);
        setTimeout(() => submitExamRef.current?.(true), 0);
      }
    };

    updateTimer();
    const timerId = setInterval(updateTimer, 1000);

    return () => clearInterval(timerId);
  }, [examDeadline]);

  const handleSelect = (option) => {
    setAnswers((prev) => ({
      ...prev,
      [questions[current].id]: option,
    }));
  };

  const handleNext = () => {
    if (!answers[questions[current].id]) {
      toast("Please Select an answer")
      return;
    }
    setCurrent((prev) => prev + 1);
  };

  const handleSubmit = async (force = false, source = "manual", reason = "") => {
    if (!force && !answers[questions[current].id]) {
      toast("Please select an answer");
      return;
    }

    if (submitting) return;

    autoSubmittedRef.current = true;
    if (source === "timer") {
      setTimeUp(true);
    }
    if (source === "critical") {
      setCriticalViolationMessage(reason || "Face mismatch detected. Submitting exam...");
    }
    setSubmitting(true);
    setExamActive(false);
    try {
      await uploadRecording();
    } catch (err) {
      console.error("Proctoring upload failed:", err);
    }

    // Format answers for backend
    const formattedAnswers = Object.entries(answers).map(
      ([questionId, selectedAnswer]) => ({
        questionId: parseInt(questionId),
        selectedAnswer,
      })
    );
    
    try {
      const res = await fetch(`${base_url}/checkresult/results/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          examId: parseInt(examId),
          studentId,
          answers: formattedAnswers,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        navigate(`/result/${examId}/${studentId}`, {
          state: { result: data.result },
        });
        
        
      } else {
        alert(data.message || "Failed to submit exam");
      }
    } catch (err) {
      console.error(err);
      alert("Server error while submitting exam");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCriticalViolation = async (violation) => {
    if (autoSubmittedRef.current) return;

    autoSubmittedRef.current = true;
    setCriticalViolationMessage(
      violation?.description || "Face mismatch detected. Submitting exam..."
    );
    setSubmitting(true);
    setExamActive(false);

    try {
      const fullRecordingPath = await uploadRecording();
      let clipPath = fullRecordingPath || null;

      if (fullRecordingPath) {
        try {
          const clipRes = await fetch(`${base_url}/uploadstudent/extract-face-mismatch-clip`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              recordingPath: fullRecordingPath,
              eventTimeSeconds: getRecordingElapsedSeconds(),
              clipBeforeSeconds: 3,
              clipAfterSeconds: 3,
            }),
          });

          const clipData = await clipRes.json();
          if (clipRes.ok && clipData?.clipPath) {
            clipPath = clipData.clipPath;
          }
        } catch (clipErr) {
          console.error("Face mismatch clip extraction failed:", clipErr);
        }
      }

      await fetch(`${base_url}/violations/store`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          examId: parseInt(examId),
          studentId,
          type: "FACE_MISMATCH_DETECTED",
          severity: "high",
          description:
            violation?.description || "Face mismatch detected during exam",
          videoPath: clipPath || null,
        }),
      });
    } catch (err) {
      console.error("Failed to store face mismatch violation:", err);
    }

    const formattedAnswers = Object.entries(answers).map(
      ([questionId, selectedAnswer]) => ({
        questionId: parseInt(questionId),
        selectedAnswer,
      })
    );

    try {
      const res = await fetch(`${base_url}/checkresult/results/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          examId: parseInt(examId),
          studentId,
          answers: formattedAnswers,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        navigate(`/result/${examId}/${studentId}`, {
          state: { result: data.result },
        });
      } else {
        alert(data.message || "Failed to submit exam");
      }
    } catch (err) {
      console.error(err);
      alert("Server error while submitting exam");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    submitExamRef.current = handleSubmit;
  }, [handleSubmit]);

  if (loading) return <h2 className="p-6">Loading questions...</h2>;
  if (!questions.length)
    return <h2 className="p-6">No questions available for this exam</h2>;

  const currentQuestion = questions[current];
  const selectedAnswer = answers[currentQuestion.id];
  const isLastQuestion = current === questions.length - 1;
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;

  return (
    <>
      <WebcamMonitor
        examId={examId}
        studentId={studentId}
        active={examActive}
        onCriticalViolation={handleCriticalViolation}
        onCalibrationChange={setIsCalibrated}
      />

      {!isFullscreen && (
        <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center text-white">
          <p className="mb-4 text-lg">Fullscreen is required to continue</p>
          <button
            onClick={requestFullscreen}
            className="bg-green-500 px-6 py-2 rounded"
          >
            Return to Fullscreen
          </button>
        </div>
      )}

      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className={`relative bg-white p-8 rounded-lg shadow-xl w-full max-w-md ${!isCalibrated ? "pointer-events-none select-none" : ""}`}>
          {!isCalibrated && (
            <div className="absolute inset-0 z-10 rounded-lg bg-white/90 flex flex-col items-center justify-center text-center p-6">
              <div className="mb-3 h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
              <h3 className="text-lg font-semibold text-gray-800">Calibrating camera...</h3>
              <p className="mt-2 text-sm text-gray-600">
                Please look straight at the camera and wait until calibration completes.
                The exam will unlock automatically after calibration.
              </p>
            </div>
          )}
          <div className="mb-4 rounded bg-red-50 px-4 py-3 text-center text-red-700">
            <span className="font-semibold">Time Left:</span>{" "}
            {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
          </div>

          {timeUp && submitting && (
            <div className="mb-4 rounded bg-yellow-50 px-4 py-3 text-center text-yellow-800 font-medium">
              Time&apos;s up, submitting...
            </div>
          )}

          {criticalViolationMessage && submitting && (
            <div className="mb-4 rounded bg-red-50 px-4 py-3 text-center text-red-800 font-medium">
              {criticalViolationMessage}
            </div>
          )}

          <h2 className="mb-4 font-bold">
            Question {current + 1} / {questions.length}
          </h2>

          <p className="mb-4">{currentQuestion.question}</p>

          {currentQuestion.options.map((opt) => (
            <label key={opt} className="block mb-2 cursor-pointer">
              <input
                type="radio"
                checked={selectedAnswer === opt}
                onChange={() => handleSelect(opt)}
                disabled={!isCalibrated}
                className="mr-2"
              />
              {opt}
            </label>
          ))}

          {/* Previous button */}
          <div className="flex justify-between mt-4">
            {current > 0 && (
              <button
                onClick={() => setCurrent((prev) => prev - 1)}
                disabled={!isCalibrated}
                className="bg-gray-400 text-white px-4 py-2 rounded"
              >
                Previous
              </button>
            )}

            {!isLastQuestion ? (
              <button
                onClick={handleNext}
                disabled={!isCalibrated}
                className="ml-auto bg-blue-600 text-white px-4 py-2 rounded"
              >
                Next
              </button>
            ) : (
              <button
                onClick={() => handleSubmit(false)}
                disabled={submitting || !isCalibrated}
                className="ml-auto bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50"
              >
                {submitting ? "Submitting..." : "Submit Exam"}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default Exam;