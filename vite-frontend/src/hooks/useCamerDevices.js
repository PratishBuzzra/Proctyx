import { useState, useEffect } from "react";

const useCameraDevices = () => {
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [permissionGranted, setPermissionGranted] = useState(false);

  useEffect(() => {
    const initDevices = async () => {
      try {
        // Request permission first so device labels are visible
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        stream.getTracks().forEach((t) => t.stop()); // release immediately
        setPermissionGranted(true);

        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = allDevices.filter((d) => d.kind === "videoinput");
        setDevices(videoDevices);

        // Auto-select Camo if found, otherwise pick first available
        const camo = videoDevices.find((d) =>
          d.label.toLowerCase().includes("camo")
        );
        const defaultDevice = camo || videoDevices[0];
        if (defaultDevice) {
          setSelectedDeviceId(defaultDevice.deviceId);
        }
      } catch (err) {
        console.error("Camera enumeration failed:", err);
      }
    };

    initDevices();

    // Also listen for device changes (e.g. user plugs in a webcam)
    navigator.mediaDevices.addEventListener("devicechange", initDevices);
    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", initDevices);
    };
  }, []);

  return { devices, selectedDeviceId, setSelectedDeviceId, permissionGranted };
};

export default useCameraDevices;