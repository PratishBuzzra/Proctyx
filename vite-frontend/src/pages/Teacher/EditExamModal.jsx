import React, { useState, useEffect } from "react";

const base_url = import.meta.env.VITE_API_URL;

const EditExamModal = ({ exam, onClose, onUpdate }) => {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    durationMinutes: "",
    startTime: "",
    endTime: ""
  });

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

  useEffect(() => {
    if (exam) {
      setFormData({
        title: exam.title,
        description: exam.description || "",
        durationMinutes: exam.durationMinutes,
        startTime: exam.startTime.slice(0, 16),
        endTime: exam.endTime.slice(0, 16)
      });
    }
  }, [exam]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async () => {
    const validationError = validateForm();
    if (validationError) {
      alert(validationError);
      return;
    }

    try {
      const res = await fetch(`${base_url}/exam/my-exams/${exam.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(formData)
      });

      const data = await res.json();

      if (res.ok) {
        onUpdate(formData); // update parent state
        onClose();
      } else {
        alert(data.message || "Update failed");
      }
    } catch (error) {
      alert("Server error");
    }
  };

  if (!exam) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded shadow w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Edit Exam</h2>

        <input
          type="text"
          name="title"
          value={formData.title}
          onChange={handleChange}
          className="w-full border p-2 rounded mb-3"
        />

        <textarea
          name="description"
          value={formData.description}
          onChange={handleChange}
          className="w-full border p-2 rounded mb-3"
        />

        <input
          type="number"
          name="durationMinutes"
          value={formData.durationMinutes}
          onChange={handleChange}
          className="w-full border p-2 rounded mb-3"
        />

        <input
          type="datetime-local"
          name="startTime"
          value={formData.startTime}
          onChange={handleChange}
          className="w-full border p-2 rounded mb-3"
        />

        <input
          type="datetime-local"
          name="endTime"
          value={formData.endTime}
          onChange={handleChange}
          className="w-full border p-2 rounded mb-4"
        />

        <div className="flex justify-between">
          <button
            onClick={onClose}
            className="bg-gray-400 text-white px-4 py-2 rounded"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="bg-green-600 text-white px-4 py-2 rounded"
          >
            Update
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditExamModal;
