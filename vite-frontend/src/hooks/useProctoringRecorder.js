import { useEffect, useRef } from "react";

const useProctoringRecorder = (active, deviceId = null) => {
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);

  useEffect(() => {
    if (!active) return;

    const startRecording = async () => {
      try {
        const videoConstraint = deviceId
          ? { deviceId: { exact: deviceId } }
          : true;

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
            console.log("📦 Chunk stored:", e.data.size);
          }
        };

        mediaRecorderRef.current.start(5000);
        console.log("🎥 Proctoring recording started", deviceId ? `(device: ${deviceId.slice(0, 8)}...)` : "(default cam)");
      } catch (err) {
        console.error("Recording failed:", err);
      }
    };

    startRecording();

    return () => {
      mediaRecorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      console.log("🛑 Recording stopped");
    };
  }, [active, deviceId]);

  const downloadRecording = () => {
    if (!chunksRef.current.length) {
      alert("No recording available");
      return;
    }

    const blob = new Blob(chunksRef.current, { type: "video/webm" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `exam_recording_${Date.now()}.webm`;
    a.click();

    URL.revokeObjectURL(url);
  };

  return { downloadRecording };
};

export default useProctoringRecorder;