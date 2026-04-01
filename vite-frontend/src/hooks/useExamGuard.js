import { useEffect, useRef } from "react";
import { toast } from "react-toastify";

const base_url = import.meta.env.VITE_API_URL;

const useExamGuard = (examId, studentId) => {
  const lastToastRef = useRef(0);
  const violationCountRef = useRef(0);
  const leaveRef = useRef(false);

  useEffect(() => {
    const saveViolation = async (type, severity = "medium", description = "") => {
      if (!examId || !studentId) return;
      try {
        await fetch(`${base_url}/violations/store`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            examId,
            studentId,
            type,
            severity,
            description,
          }),
        });
      } catch (err) {
        console.error("Failed to save violation:", err);
      }
    };

    const logViolation = (type, severity = "medium", description = "") => {
      const now = Date.now();

      if (now - lastToastRef.current < 2000) return;

      lastToastRef.current = now;
      violationCountRef.current += 1;

      toast.error(`Violation detected: ${type}`);

      console.log("Violation:", type);
      console.log("Total violations:", violationCountRef.current);

      saveViolation(type, severity, description);
    };

    const handleLeaveExam = () => {
      if (leaveRef.current) return;
      leaveRef.current = true;
      logViolation("LEAVE_EXAM", "high", "Student left the exam window");
    };

    const handleFocus = () => {
      leaveRef.current = false;
    };

    const handleVisibilityChange = () => {
      if (document.hidden) handleLeaveExam();
    };

    const handleBlur = () => {
      handleLeaveExam();
    };

    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "";
      handleLeaveExam();
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        logViolation("FULLSCREEN_EXIT", "high", "Student exited fullscreen mode");
      }
    };

    const handleKeyDown = (e) => {
      const blocked =
        (e.ctrlKey &&
          ["c", "v", "x", "a", "t", "w", "s"].includes(
            e.key.toLowerCase()
          )) ||
        ["F12"].includes(e.key);

      if (blocked) {
        e.preventDefault();
        logViolation("KEYBOARD_SHORTCUT", "medium", `Blocked key: ${e.ctrlKey ? "Ctrl+" : ""}${e.key}`);
      }
    };

    const handleContextMenu = (e) => {
      e.preventDefault();
      logViolation("RIGHT_CLICK", "low", "Student right clicked during exam");
    };

    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [examId, studentId]);
};

export default useExamGuard;