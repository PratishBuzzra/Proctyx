import { useEffect, useRef } from "react";

const CHUNK_INTERVAL_MS = 5000;
const FASTAPI_URL = "http://localhost:8002";
const NODE_URL = "http://localhost:3000/api/v1";

const normalizeAudioPath = (audioPath) => {
  if (!audioPath || typeof audioPath !== "string") return null;
  const normalized = audioPath.replace(/\\/g, "/").trim();
  if (!normalized.toLowerCase().endsWith(".wav")) return null;
  return normalized.split("/").pop() || null;
};

const useAudioMonitor = (active, examId, studentId) => {
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const intervalRef = useRef(null);
  const samplesRef = useRef([]);

  useEffect(() => {
    if (!active || !examId || !studentId) return;

    const startAudioMonitoring = async () => {
      try {
        streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        audioContextRef.current = new AudioContext({ sampleRate: 16000 });

        const source = audioContextRef.current.createMediaStreamSource(streamRef.current);
        const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);

        processor.onaudioprocess = (e) => {
          const samples = e.inputBuffer.getChannelData(0);
          samplesRef.current.push(...samples);
        };

        source.connect(processor);
        processor.connect(audioContextRef.current.destination);

        // Every 5 seconds, send collected samples to FastAPI
        intervalRef.current = setInterval(async () => {
          if (samplesRef.current.length === 0) return;

          const samples = new Float32Array(samplesRef.current);
          samplesRef.current = []; // reset buffer

          try {
            const res = await fetch(`${FASTAPI_URL}/analyze-audio`, {
              method: "POST",
              headers: { "Content-Type": "application/octet-stream" },
              body: samples.buffer,
            });

            const aiResult = await res.json();
            console.log("Audio analysis:", aiResult);

            if (aiResult.violation) {
              await fetch(`${NODE_URL}/violations/store`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  examId,
                  studentId,
                  type: aiResult.type,
                  severity: aiResult.severity,
                  description: aiResult.description,
                  audioPath: normalizeAudioPath(aiResult.audio_path),
                }),
              });
              console.warn("Audio violation stored:", aiResult.type);
            }
          } catch (err) {
            console.error("Audio send error:", err);
          }
        }, CHUNK_INTERVAL_MS);

        console.log("Audio monitoring started");
      } catch (err) {
        console.error("Mic access failed:", err);
      }
    };

    startAudioMonitoring();

    return () => {
      clearInterval(intervalRef.current);
      audioContextRef.current?.close();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      console.log("Audio monitoring stopped");
    };
  }, [active, examId, studentId]);
};

export default useAudioMonitor;
