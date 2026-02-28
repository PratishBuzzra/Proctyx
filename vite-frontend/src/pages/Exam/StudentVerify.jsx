import React, { useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Webcam from "react-webcam";
import { useExam } from "../../context/ExamContext";
import useCameraDevices from "../../hooks/useCamerDevices";


const StudentVerify = () => {
  const webcamRef = useRef(null);
  const navigate = useNavigate();
  const { examId } = useParams();
  const { updateExamState } = useExam();
  const { devices, selectedDeviceId, setSelectedDeviceId } = useCameraDevices();

  const [formData, setFormData] = useState({ studentId: "", name: "", email: "" });
  const [message, setMessage] = useState("");
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const verifyStudent = async () => {
    setMessage("");

    if (!formData.studentId || !formData.name || !formData.email) {
      setMessage("Please fill all fields");
      return;
    }

    try {
      setLoading(true);

      const frames = [];
      for (let i = 0; i < 6; i++) {
        const img = webcamRef.current.getScreenshot();
        frames.push(img);
        await new Promise((r) => setTimeout(r, 300));
      }

      const data = new FormData();
      data.append("student_id", formData.studentId);
      data.append("name", formData.name);
      data.append("email", formData.email);

      for (let i = 0; i < frames.length; i++) {
        const blob = await fetch(frames[i]).then((res) => res.blob());
        data.append("live_photos", blob, `live${i}.jpg`);
      }

      const response = await fetch(
        `http://localhost:3000/api/v1/studentexam/verify`,
        { method: "POST", body: data }
      );

      const result = await response.json();

      if (result.verified) {
        setMessage("✅ Verification Successful");
        setVerified(true);
        updateExamState({ verified: true, studentId: formData.studentId, selectedDeviceId });
      } else {
        setMessage("❌ " + result.message);
        setVerified(false);
      }
    } catch (error) {
      console.log(error);
      setMessage("Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const ifVerify = () => {
    if (verified) navigate(`/systemcheck/${examId}`);
  };

  return (
    <div className="min-h-screen flex justify-center items-center py-20">
      <div className="w-full p-8 max-w-md shadow-2xl rounded-lg">
        <h2 className="text-center text-2xl font-semibold text-gray-700 mb-4">
          Verify to Enter Exam
        </h2>

        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4 rounded">
          <h3 className="font-medium text-blue-700 mb-2">Rules for Verification:</h3>
          <ul className="list-disc list-inside text-sm text-blue-700 space-y-1">
            <li>Stay in front close to the camera.</li>
            <li>Move your head slightly left/right.</li>
            <li>Make sure eyes are wide open.</li>
            <li>Blink your eyes slowly.</li>
            <li>Ensure proper lighting and no face obstructions.</li>
          </ul>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Student ID</label>
            <input type="text" name="studentId" className="border border-gray-300 px-3 py-2 mt-1 w-full rounded"
              value={formData.studentId} onChange={handleInputChange} placeholder="Enter your Student ID" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Name</label>
            <input type="text" name="name" className="border border-gray-300 px-3 py-2 mt-1 w-full rounded"
              value={formData.name} onChange={handleInputChange} placeholder="Enter your Name" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input type="email" name="email" className="border border-gray-300 px-3 py-2 mt-1 w-full rounded"
              value={formData.email} onChange={handleInputChange} placeholder="Enter your Email" />
          </div>

          {/* Camera selector */}
          {devices.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Camera ({devices.length} detected)
              </label>
              <select
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                value={selectedDeviceId || ''}
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

          <div className="text-center">
            <label className="block text-sm font-medium text-gray-700 mb-2">Live Camera</label>
            <div className="border mb-3">
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                screenshotQuality={1}
                videoConstraints={{
                  deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
                }}
              />
            </div>
          </div>

          {message && <p className="text-center font-medium">{message}</p>}

          <button onClick={verifyStudent} disabled={loading}
            className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600">
            {loading ? "Verifying..." : "Verify Student"}
          </button>

          <button onClick={ifVerify} disabled={!verified}
            className={`w-full py-2 px-4 rounded-md text-white ${verified ? "bg-green-500 hover:bg-green-600" : "bg-gray-400 cursor-not-allowed"}`}>
            Enter Exam
          </button>
        </div>
      </div>
    </div>
  );
};

export default StudentVerify;