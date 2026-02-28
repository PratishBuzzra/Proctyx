import { useEffect, useRef } from "react";
import { toast } from "react-toastify";

const useExamGuard = () => {
  const lastToastRef = useRef(0);
  const violationCountRef = useRef(0);
  const leaveRef = useRef(false);

  useEffect(() => {
    const logViolation = (type) => {
      const now = Date.now();

     
      if (now - lastToastRef.current < 2000) return;

      lastToastRef.current = now;
      violationCountRef.current += 1;

      toast.error(`Violation detected: ${type}`);

      console.log("Violation:", type);
      console.log("Total violations:", violationCountRef.current);
    };

   
    const handleLeaveExam = () => {
      if (leaveRef.current) return;
      leaveRef.current = true;
      logViolation("LEAVE_EXAM");
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
        logViolation("FULLSCREEN_EXIT");
      }
    };

 
    const handleKeyDown = (e) => {
      const blocked =
        (e.ctrlKey &&
          ["c", "v", "x", "a", "t", "w", "s"].includes(
            e.key.toLowerCase()
          )) ||
        ["F12"].includes(e.key); // ❌ ESC removed

      if (blocked) {
        e.preventDefault();
        logViolation("KEYBOARD_SHORTCUT");
      }
    };

   
    const handleContextMenu = (e) => {
      e.preventDefault();
      logViolation("RIGHT_CLICK");
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
  }, []);
};

export default useExamGuard;
