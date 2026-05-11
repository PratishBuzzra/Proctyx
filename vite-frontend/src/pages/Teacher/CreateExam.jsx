import React, { useState, useContext } from "react";
import { AuthContext } from "../../context/authContext";
import { useNavigate } from "react-router-dom";

const base_url = import.meta.env.VITE_API_URL;

const CreateExam = () => {
  const { teacherId } = useContext(AuthContext);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    durationMinutes: "",
    startTime: "",
    endTime: "",
  });

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const validateForm = () => {
    const duration = parseInt(formData.durationMinutes, 10);
    const start = new Date(formData.startTime);
    const end = new Date(formData.endTime);

    if (!formData.title.trim() || !formData.description.trim()) {
      return "Title and description are required";
    }
    if (!Number.isInteger(duration) || duration <= 0) {
      return "Duration must be a positive number";
    }
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return "Start time and end time are required";
    }
    if (start >= end) {
      return "End time must be later than start time";
    }
    return null;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setMessage("");

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      const res = await fetch(`${base_url}/exam/createexam`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          durationMinutes: parseInt(formData.durationMinutes),
          startTime: formData.startTime,
          endTime: formData.endTime,
          teacherId: teacherId
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage("Exam Created Successfully!");

        setTimeout(() => {
          navigate("/teacherdashboard");
        }, 1500);
      } else {
        setError(data.message || "Failed to create exam");
      }
    } catch (err) {
      setError("Server error, please try again");
    }
  };

  return (
    <div className="min-h-screen flex justify-center items-center bg-gray-100">
      <div className="bg-white shadow-lg rounded p-8 w-full max-w-lg">
        <h2 className="text-2xl font-bold text-center mb-6">
          Create New Exam
        </h2>

        {message && (
          <p className="text-green-600 text-center mb-4">{message}</p>
        )}

        {error && (
          <p className="text-red-600 text-center mb-4">{error}</p>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block mb-1 font-semibold">Exam Title</label>
            <input
              type="text"
              name="title"
              required
              className="border p-2 w-full rounded"
              value={formData.title}
              onChange={handleChange}
              placeholder="Enter exam title"
            />
          </div>

          <div className="mb-4">
            <label className="block mb-1 font-semibold">Description</label>
            <textarea
              name="description"
              required
              className="border p-2 w-full rounded"
              value={formData.description}
              onChange={handleChange}
              placeholder="Exam details..."
            />
          </div>

          <div className="mb-4">
            <label className="block mb-1 font-semibold">
              Duration (Minutes)
            </label>
            <input
              type="number"
              name="durationMinutes"
              required
              className="border p-2 w-full rounded"
              value={formData.durationMinutes}
              onChange={handleChange}
              placeholder="e.g. 60"
            />
          </div>

          <div className="mb-4">
            <label className="block mb-1 font-semibold">Start Time</label>
            <input
              type="datetime-local"
              name="startTime"
              required
              className="border p-2 w-full rounded"
              value={formData.startTime}
              onChange={handleChange}
            />
          </div>

          <div className="mb-4">
            <label className="block mb-1 font-semibold">End Time</label>
            <input
              type="datetime-local"
              name="endTime"
              required
              className="border p-2 w-full rounded"
              value={formData.endTime}
              onChange={handleChange}
            />
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
          >
            Create Exam
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateExam;
