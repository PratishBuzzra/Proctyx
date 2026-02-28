import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useExam } from '../../context/ExamContext';
import useCameraDevices from '../../hooks/useCamerDevices';


function ExamSystemCheck() {
  const [webcamStatus, setWebcamStatus] = useState(null);
  const [microphoneStatus, setMicrophoneStatus] = useState(null);
  const navigate = useNavigate();
  const { examId } = useParams();
  const { updateExamState } = useExam();
  const { devices, selectedDeviceId, setSelectedDeviceId } = useCameraDevices();

  // Re-check devices whenever the selected camera changes
  useEffect(() => {
    if (!selectedDeviceId) return;

    async function checkDevices() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: selectedDeviceId } },
          audio: true,
        });
        setWebcamStatus('Available');
        setMicrophoneStatus('Available');
        stream.getTracks().forEach(track => track.stop());
      } catch (error) {
        setWebcamStatus('Not available');
        setMicrophoneStatus('Not available');
      }
    }
    checkDevices();
  }, [selectedDeviceId]);

  const handleNextClick = () => {
    updateExamState({ systemChecked: true, selectedDeviceId });
    setTimeout(() => {
      navigate(`/rules/${examId}`);
    }, 1000);
  };

  const isNextButtonDisabled = webcamStatus !== 'Available' || microphoneStatus !== 'Available';

  return (
    <div className="min-h-screen flex justify-center items-center">
      <div className='w-full max-w-7xl shadow-2xl'>
        <div className="flex flex-col items-center p-6 space-y-8">
          <section className="w-full text-center">
            <h1 className="text-2xl font-bold">System Compatibility Check</h1>
          </section>

          {/* Camera Selector */}
          {devices.length > 0 && (
            <section className="w-full max-w-md">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select Camera
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
              <p className="text-xs text-gray-400 mt-1">
                {devices.length} camera{devices.length !== 1 ? 's' : ''} detected
              </p>
            </section>
          )}

          <section className="w-full">
            <table className="table-auto w-full bg-white shadow-md rounded-lg">
              <thead>
                <tr className="bg-gray-200">
                  <th className="px-4 py-2">Device</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-4 py-2">Webcam</td>
                  <td className={`px-4 py-2 font-medium ${webcamStatus === 'Available' ? 'text-green-600' : 'text-red-500'}`}>
                    {webcamStatus || 'Checking...'}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2">Microphone</td>
                  <td className={`px-4 py-2 font-medium ${microphoneStatus === 'Available' ? 'text-green-600' : 'text-red-500'}`}>
                    {microphoneStatus || 'Checking...'}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          <section>
            <button
              className={`bg-blue-500 text-white py-2 px-6 rounded mt-4 ${isNextButtonDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={handleNextClick}
              disabled={isNextButtonDisabled}
            >
              Next
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}

export default ExamSystemCheck;