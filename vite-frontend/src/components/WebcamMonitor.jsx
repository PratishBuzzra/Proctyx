import React, { useEffect, useRef, useState } from "react";
import useCameraDevices from "../hooks/useCamerDevices";


const FASTAPI_GAZE_URL    = "http://localhost:8003";
const FASTAPI_HEAD_URL    = "http://localhost:8004";
const FASTAPI_OBJECT_URL  = "http://localhost:8005";
const NODE_URL            = "http://localhost:3000/api/v1";
const CAPTURE_INTERVAL_MS = 1000;
const CALIBRATION_COUNT   = 15;

const normalizeVideoPath = (videoPath) => {
  if (!videoPath || typeof videoPath !== "string") return null;
  const normalized = videoPath.replace(/\\/g, "/").trim();
  if (!normalized.toLowerCase().endsWith(".mp4")) return null;
  return normalized.split("/").pop() || null;
};

const buildSessionId = (examId, studentId) => `${examId}:${studentId}`;

const WebcamMonitor = ({ examId, studentId, active = true }) => {
  const videoRef    = useRef(null);
  const streamRef   = useRef(null);
  const canvasRef   = useRef(null);
  const intervalRef = useRef(null);

  const [showSelector, setShowSelector]       = useState(true);
  const [calibrated, setCalibrated]           = useState(false);
  const [calibProgress, setCalibProgress]     = useState(0);
  const [calibMessage, setCalibMessage]       = useState("Look straight at the camera to calibrate...");

  const calibFrameCount = useRef(0);

  const { devices, selectedDeviceId, setSelectedDeviceId } = useCameraDevices();

  // Restart stream when camera changes
  useEffect(() => {
    if (!selectedDeviceId) return;

    const startPreview = async () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      try {
        streamRef.current = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: { exact: selectedDeviceId },
            width:    { ideal: 1280 },
            height:   { ideal: 720 },
          },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = streamRef.current;
        }
      } catch (err) {
        console.error("Webcam preview failed", err);
      }
    };

    startPreview();
    return () => streamRef.current?.getTracks().forEach((t) => t.stop());
  }, [selectedDeviceId]);

  // Hide camera selector 5s after exam starts
  useEffect(() => {
    if (active) {
      const timer = setTimeout(() => setShowSelector(false), 5000);
      return () => clearTimeout(timer);
    } else {
      setShowSelector(true);
    }
  }, [active]);

  useEffect(() => {
    if (!active || !examId || !studentId) return;

    const captureFrame = () => {
      if (!videoRef.current || !canvasRef.current) return null;
      const video  = videoRef.current;
      const canvas = canvasRef.current;
      const ctx    = canvas.getContext("2d");
      canvas.width  = 640;
      canvas.height = 480;
      ctx.drawImage(video, 0, 0, 640, 480);
      return canvas;
    };

    const sendCalibrationFrame = async (canvas) => {
      return new Promise((resolve) => {
        canvas.toBlob(async (blob) => {
          if (!blob) return resolve();
          try {
            const sessionId = buildSessionId(examId, studentId);
            const formData = new FormData();
            formData.append("frame", blob, "frame.jpg");
            const res = await fetch(`${FASTAPI_HEAD_URL}/calibrate`, {
              method: "POST",
              headers: { "X-Session-Id": sessionId },
              body: formData,
            });
            const result = await res.json();

            setCalibProgress(result.collected || CALIBRATION_COUNT);

            if (result.calibrated) {
              setCalibrated(true);
              setCalibMessage(`✅ Calibrated! (Baseline Yaw: ${result.baseline_yaw}° Pitch: ${result.baseline_pitch}°)`);
              console.log("Head pose calibrated:", result);
            } else {
              setCalibMessage(`Calibrating... ${result.collected}/${result.needed} — look straight at camera`);
            }
          } catch (err) {
            console.error("Calibration error:", err);
          }
          resolve();
        }, "image/jpeg", 0.8);
      });
    };

    const analyzeGaze = async (blob) => {
      try {
        const sessionId = buildSessionId(examId, studentId);
        const formData = new FormData();
        formData.append("frame", blob, "frame.jpg");
        const res = await fetch(`${FASTAPI_GAZE_URL}/analyze-gaze`, {
          method: "POST",
          headers: { "X-Session-Id": sessionId },
          body: formData,
        });
        const result = await res.json();
        console.log(`Gaze: ${result.direction}`);
        if (result.violation) {
          await storeViolation({
            type: result.type === "FACE_NOT_VISIBLE" ? "GAZE_FACE_NOT_VISIBLE" : result.type,
            severity: result.severity,
            description: result.description,
            videoPath: normalizeVideoPath(result.video_path),
          });
        }
      } catch (err) {
        console.error("Gaze error:", err);
      }
    };

    const analyzeHeadPose = async (blob) => {
      try {
        const sessionId = buildSessionId(examId, studentId);
        const formData = new FormData();
        formData.append("frame", blob, "frame.jpg");
        const res = await fetch(`${FASTAPI_HEAD_URL}/analyze-head-pose`, {
          method: "POST",
          headers: { "X-Session-Id": sessionId },
          body: formData,
        });
        const result = await res.json();

        // Update calibration status from response
        if (result.calibrated !== undefined) setCalibrated(result.calibrated);
        if (result.direction === "CALIBRATING") {
          setCalibProgress(result.collected || 0);
          setCalibMessage(`Auto-calibrating... ${result.collected}/${result.needed}`);
          return;
        }

        console.log(`Head: ${result.direction} | Adj Yaw: ${result.adj_yaw}° Pitch: ${result.adj_pitch}°`);
        if (result.violation) {
          await storeViolation({
            type: result.type === "FACE_NOT_VISIBLE" ? "HEAD_FACE_NOT_VISIBLE" : result.type,
            severity: result.severity,
            description: result.description,
            videoPath: normalizeVideoPath(result.video_path),
          });
        }
      } catch (err) {
        console.error("Head pose error:", err);
      }
    };

    const analyzeObjectDetection = async (blob) => {
      try {
        const sessionId = buildSessionId(examId, studentId);
        const formData = new FormData();
        formData.append("frame", blob, "frame.jpg");
        const res = await fetch(`${FASTAPI_OBJECT_URL}/detect-objects`, {
          method: "POST",
          headers: { "X-Session-Id": sessionId },
          body: formData,
        });
        const result = await res.json();

        if (result?.violation && Array.isArray(result.violations)) {
          await Promise.all(
            result.violations.map((v) =>
              storeViolation({
                type: v.type,
                severity: v.severity || "medium",
                description: v.description || "Object violation detected",
                videoPath: normalizeVideoPath(v.videoPath),
              })
            )
          );
        }
      } catch (err) {
        console.error("Object detection error:", err);
      }
    };

    const storeViolation = async ({ type, severity, description, videoPath }) => {
      try {
        await fetch(`${NODE_URL}/violations/store`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ examId, studentId, type, severity, description, videoPath: videoPath || null }),
        });
        console.warn("Violation stored:", type);
      } catch (err) {
        console.error("Store violation error:", err);
      }
    };

    const captureAndAnalyze = async () => {
      const canvas = captureFrame();
      if (!canvas) return;

      // Phase 1: calibration — send frames to /calibrate endpoint
      if (!calibrated && calibFrameCount.current < CALIBRATION_COUNT) {
        calibFrameCount.current += 1;
        await sendCalibrationFrame(canvas);
        return; // don't analyze violations during calibration
      }

      // Phase 2: normal monitoring
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        await Promise.all([analyzeGaze(blob), analyzeHeadPose(blob), analyzeObjectDetection(blob)]);
      }, "image/jpeg", 0.8);
    };

    intervalRef.current = setInterval(captureAndAnalyze, CAPTURE_INTERVAL_MS);
    console.log("Monitoring started");

    return () => {
      clearInterval(intervalRef.current);
      console.log("Monitoring stopped");
    };
  }, [active, examId, studentId, calibrated]);

  const handleRecalibrate = async () => {
    try {
      const sessionId = buildSessionId(examId, studentId);
      await fetch(`${FASTAPI_HEAD_URL}/reset-calibration`, {
        method: "POST",
        headers: { "X-Session-Id": sessionId },
      });
      setCalibrated(false);
      setCalibProgress(0);
      calibFrameCount.current = 0;
      setCalibMessage("Look straight at the camera to recalibrate...");
    } catch (err) {
      console.error("Reset calibration error:", err);
    }
  };

  return (
    <div className="fixed top-6 right-6 w-56 z-50 bg-white rounded-lg shadow-xl p-2">
      <p className="text-xs text-center bg-green-600 text-white rounded mb-1">
        {calibrated ? "Monitoring" : "Calibrating..."}
      </p>

      <video ref={videoRef} autoPlay muted playsInline className="w-full h-28 object-cover rounded" />
      <canvas ref={canvasRef} className="hidden" />

      {/* Calibration status */}
      {!calibrated && (
        <div className="mt-1">
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-blue-500 h-1.5 rounded-full transition-all"
              style={{ width: `${(calibProgress / CALIBRATION_COUNT) * 100}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 text-center mt-1">{calibMessage}</p>
        </div>
      )}

      {/* Recalibrate button — shown after calibration */}
      {calibrated && (
        <button
          onClick={handleRecalibrate}
          className="text-xs w-full mt-1 text-blue-500 hover:text-blue-700"
        >
          ↺ Recalibrate
        </button>
      )}

      {/* Camera selector */}
      {showSelector && devices.length > 0 && (
        <div className="mt-1">
          <p className="text-xs text-gray-500 text-center mb-0.5">
            {devices.length > 1 ? "Select Camera:" : "Camera:"}
          </p>
          <select
            className="text-xs w-full border rounded px-1 py-0.5 truncate"
            value={selectedDeviceId || ""}
            onChange={(e) => setSelectedDeviceId(e.target.value)}
          >
            {devices.map((d, i) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Camera ${i + 1}`}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
};

export default WebcamMonitor;
