import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

const base_url = import.meta.env.VITE_API_URL;

const SEVERITY_COLOR = {
  high:   "bg-red-100 text-red-700",
  medium: "bg-yellow-100 text-yellow-700",
  low:    "bg-green-100 text-green-700",
};

const ExamReport = () => {
  const { examId } = useParams();
  const navigate = useNavigate();
  const [exam, setExam] = useState(null);
  const [report, setReport] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState(null);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const res = await fetch(`${base_url}/exam/report/${examId}`, {
          credentials: "include",
        });
        const data = await res.json();
        if (res.ok) {
          setExam(data.exam);
          setReport(data.report);
        } else {
          alert(data.message || "Failed to load report");
        }
      } catch (err) {
        alert("Server error");
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [examId]);

  if (loading) return <h2 className="p-6 text-center">Loading report...</h2>;

  // FIX 1 (ExamReport side): Build the video URL using only the stored filename.
  // Previously the code tried to detect the service port from the path string
  // ("head" in videoPath → 8004, else 8003) which was fragile and broke when
  // the stored path format changed. Now both services store just the filename
  // and expose /videos/<filename> — we only need to know which port.
  // The violation `type` field reliably identifies the service:
  //   HEAD_* types  → HeadPoseService  → port 8004
  //   everything else → GazeService    → port 8003
  const getVideoFilename = (videoPath) => {
    if (!videoPath || typeof videoPath !== "string") return null;
    const normalized = videoPath.replace(/\\/g, "/").trim();
    if (!normalized.toLowerCase().endsWith(".mp4")) return null;
    return normalized.split("/").pop() || null;
  };

  const getVideoUrl = (violation) => {
    if (!violation?.videoPath) return null;

    const normalized = violation.videoPath.replace(/\\/g, "/").trim();
    const nodeBase = base_url?.replace(/\/api\/v1\/?$/, "") || "http://localhost:3000";

    // Proctored full recordings and face-mismatch clips are stored under uploads/
    // on the Node server, so they should be loaded from the Node static path.
    if (normalized.startsWith("uploads/")) {
      const supportedExt = [".webm", ".mp4", ".mkv", ".mov"];
      if (!supportedExt.some((ext) => normalized.toLowerCase().endsWith(ext))) return null;
      return `${nodeBase}/${normalized}`;
    }

    const filename = getVideoFilename(normalized);
    if (!filename) return null;
    const type = violation.type || "";
    let port = 8003; // gaze default
    if (type.startsWith("HEAD_")) port = 8004;
    if (type.startsWith("OBJECT_")) port = 8005;
    return `http://localhost:${port}/videos/${filename}`;
  };

  const getVideoMimeType = (videoUrl) => {
    if (!videoUrl || typeof videoUrl !== "string") return "video/mp4";
    const normalized = videoUrl.toLowerCase().split("?")[0].split("#")[0];
    if (normalized.endsWith(".webm")) return "video/webm";
    if (normalized.endsWith(".mov")) return "video/quicktime";
    if (normalized.endsWith(".mkv")) return "video/x-matroska";
    return "video/mp4";
  };

  const getAudioFilename = (audioPath) => {
    if (!audioPath || typeof audioPath !== "string") return null;
    const normalized = audioPath.replace(/\\/g, "/").trim();
    if (!normalized.toLowerCase().endsWith(".wav")) return null;
    return normalized.split("/").pop() || null;
  };

  const getAudioUrl = (violation) => {
    const filename = getAudioFilename(violation.audioPath);
    if (!filename) return null;
    return `http://localhost:8002/audios/${filename}`;
  };

  const getFullRecordingUrl = (recordingPath) => {
    if (!recordingPath || typeof recordingPath !== "string") return null;
    const normalized = recordingPath.replace(/\\/g, "/").trim();
    const supportedExt = [".webm", ".mp4", ".mkv", ".mov"];
    if (!supportedExt.some((ext) => normalized.toLowerCase().endsWith(ext))) return null;

    const nodeBase = base_url?.replace(/\/api\/v1\/?$/, "") || "http://localhost:3000";
    if (normalized.startsWith("uploads/")) {
      return `${nodeBase}/${normalized}`;
    }
    const filename = normalized.split("/").pop();
    return filename ? `${nodeBase}/uploads/proctoring/${filename}` : null;
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <button
            onClick={() => navigate("/teacherdashboard")}
            className="text-blue-600 hover:underline mb-2 block"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-2xl font-bold">{exam?.title} — Exam Report</h1>
          <p className="text-gray-500 text-sm">
            {report.length} student{report.length !== 1 ? "s" : ""} submitted
          </p>
        </div>
      </div>

      {report.length === 0 ? (
        <div className="bg-white rounded shadow p-6 text-center text-gray-500">
          No students have submitted this exam yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {/* Students Table */}
          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-200">
                <tr>
                  <th className="p-3 text-left">Student ID</th>
                  <th className="p-3 text-left">Score</th>
                  <th className="p-3 text-left">Percentage</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-left">Violations</th>
                  <th className="p-3 text-left">Submitted At</th>
                  <th className="p-3 text-left">Details</th>
                </tr>
              </thead>
              <tbody>
                {report.map((student) => (
                  <tr key={student.studentId} className="border-b hover:bg-gray-50">
                    <td className="p-3 font-mono">{student.studentId}</td>
                    <td className="p-3">
                      {student.score}/{student.totalQuestions}
                    </td>
                    <td className="p-3">{student.percentage}%</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          student.percentage >= 50
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {student.percentage >= 50 ? "PASSED" : "FAILED"}
                      </span>
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          student.violationCount === 0
                            ? "bg-green-100 text-green-700"
                            : student.violationCount <= 3
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {student.violationCount} violation{student.violationCount !== 1 ? "s" : ""}
                      </span>
                    </td>
                    <td className="p-3 text-sm text-gray-500">
                      {new Date(student.submittedAt).toLocaleString()}
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() =>
                          setSelectedStudent(
                            selectedStudent?.studentId === student.studentId
                              ? null
                              : student
                          )
                        }
                        className="text-blue-600 hover:underline text-sm"
                      >
                        {selectedStudent?.studentId === student.studentId
                          ? "Hide"
                          : "View Violations"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Violation Detail Panel */}
          {selectedStudent && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-bold mb-4">
                Violations — {selectedStudent.studentId}
              </h2>

              <div className="mb-4">
                <p className="text-xs text-gray-500 mb-1">Full Exam Recording:</p>
                {getFullRecordingUrl(selectedStudent.fullRecordingPath) ? (
                  <a
                    href={getFullRecordingUrl(selectedStudent.fullRecordingPath)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block text-sm px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Download Full Recording
                  </a>
                ) : (
                  <p className="text-sm text-gray-500">No full recording available</p>
                )}
              </div>

              {selectedStudent.violations.length === 0 ? (
                <p className="text-green-600">No violations recorded ✅</p>
              ) : (
                <div className="space-y-3">
                  {selectedStudent.violations.map((v) => (
                    <div
                      key={v.id}
                      className="border rounded-lg p-4 flex flex-col gap-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-1 rounded text-xs font-semibold ${
                              SEVERITY_COLOR[v.severity] ||
                              "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {v.severity.toUpperCase()}
                          </span>
                          <span className="font-semibold">{v.type}</span>
                        </div>
                        <span className="text-xs text-gray-400">
                          {new Date(v.timestamp).toLocaleString()}
                        </span>
                      </div>

                      {v.description && (
                        <p className="text-sm text-gray-600">{v.description}</p>
                      )}

                      {/* Video clip */}
                      {getVideoUrl(v) && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">
                            📹 Violation Video:
                          </p>
                          <video
                            controls
                            preload="metadata"
                            className="w-full max-w-sm rounded border bg-black"
                          >
                            <source
                              src={getVideoUrl(v)}
                              type={getVideoMimeType(getVideoUrl(v))}
                            />
                            Your browser does not support the video tag.
                          </video>
                          <a
                            href={getVideoUrl(v)}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 inline-block text-xs text-blue-600 hover:underline"
                          >
                            Open evidence in new tab
                          </a>
                        </div>
                      )}

                      {/* Audio clip */}
                      {getAudioUrl(v) && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">
                            🎵 Violation Audio:
                          </p>
                          <audio
                            src={getAudioUrl(v)}
                            controls
                            className="w-full"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ExamReport;
