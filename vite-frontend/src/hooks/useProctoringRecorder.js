import { useEffect, useRef } from "react";

const NODE_URL = "http://localhost:3000/api/v1";

const useProctoringRecorder = (active, examId, studentId, deviceId = null) => {
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const uploadedPathRef = useRef(null);

  const stopRecorder = () =>
    new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        resolve();
        return;
      }
      const onStop = () => resolve();
      recorder.addEventListener("stop", onStop, { once: true });
      recorder.stop();
    });

  const stopStreamTracks = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  useEffect(() => {
    if (!active || !examId || !studentId) return;

    const startRecording = async () => {
      try {
        const videoConstraint = deviceId ? { deviceId: { exact: deviceId } } : true;

        chunksRef.current = [];
        uploadedPathRef.current = null;

        streamRef.current = await navigator.mediaDevices.getUserMedia({
          video: videoConstraint,
          audio: true,
        });

        mediaRecorderRef.current = new MediaRecorder(streamRef.current, {
          mimeType: "video/webm",
        });

        mediaRecorderRef.current.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunksRef.current.push(e.data);
          }
        };

        mediaRecorderRef.current.start(5000);
        console.log(
          "Proctoring recording started",
          deviceId ? `(device: ${deviceId.slice(0, 8)}...)` : "(default cam)"
        );
      } catch (err) {
        console.error("Recording failed:", err);
      }
    };

    startRecording();

    return () => {
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.stop();
      }
      stopStreamTracks();
      console.log("Recording stopped");
    };
  }, [active, examId, studentId, deviceId]);

  const uploadRecording = async () => {
    if (!examId || !studentId) return null;
    if (uploadedPathRef.current) return uploadedPathRef.current;

    await stopRecorder();
    stopStreamTracks();

    if (!chunksRef.current.length) return null;

    const blob = new Blob(chunksRef.current, { type: "video/webm" });
    if (blob.size === 0) return null;

    const formData = new FormData();
    formData.append("recording", blob, `exam_${examId}_${studentId}_${Date.now()}.webm`);

    const uploadRes = await fetch(`${NODE_URL}/uploadstudent/upload-proctoring`, {
      method: "POST",
      body: formData,
    });

    if (!uploadRes.ok) {
      throw new Error("Failed to upload proctoring recording");
    }

    const uploadData = await uploadRes.json();
    const recordingPath = uploadData.recordingPath || null;
    uploadedPathRef.current = recordingPath;

    if (recordingPath) {
      await fetch(`${NODE_URL}/violations/store`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examId,
          studentId,
          type: "PROCTORING_FULL_VIDEO",
          severity: "low",
          description: "Full proctoring session recording",
          videoPath: recordingPath,
        }),
      });
    }

    chunksRef.current = [];
    return recordingPath;
  };

  return { uploadRecording };
};

export default useProctoringRecorder;
