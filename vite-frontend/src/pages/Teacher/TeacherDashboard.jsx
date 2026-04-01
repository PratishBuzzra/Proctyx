import React, { useContext, useEffect, useState } from "react";
import { AuthContext } from "../../context/authContext";
import { useNavigate, Link } from "react-router-dom";
import EditExamModal from "./EditExamModal";


const base_url = import.meta.env.VITE_API_URL;

const TeacherDashboard = () => {
  const { teachername, teacherId, loading, logout } = useContext(AuthContext);
  const [exams, setExams] = useState([]);
  const [error, setError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedExam, setSelectedExam] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    if (!teacherId) return;

    const fetchExams = async () => {
      try {
        const res = await fetch(`${base_url}/exam/my-exams`, {
          credentials: "include"
        });

        const data = await res.json();

        if (res.ok) {
          setExams(data);
        } else {
          setError(data.error || "Failed to load exams");
        }
      } catch (err) {
        setError("Server error while fetching exams");
      }
    };

    fetchExams();
  }, [teacherId]);

  const handleDelete = async (examId) => {
    if (!window.confirm("Are you sure you want to delete this exam?")) return;

    try {
      const res = await fetch(`${base_url}/exam/my-exams/${examId}`, {
        method: "DELETE",
        credentials: "include"
      });

      if (res.ok) {
        setExams((prev) => prev.filter((exam) => exam.id !== examId));
      } else {
        alert("Failed to delete exam");
      }
    } catch (err) {
      alert("Server error while deleting");
    }
  };

  const openEditModal = (exam) => {
    setSelectedExam(exam);
    setIsModalOpen(true);
  };

  const handleUpdateExam = (updatedExam) => {
    setExams((prev) =>
      prev.map((exam) =>
        exam.id === selectedExam.id ? { ...exam, ...updatedExam } : exam
      )
    );
  };

  if (loading) return <h2>Loading...</h2>;

  return (
    <div className="min-h-screen p-6 bg-gray-100">
      <h1 className="text-2xl font-bold mb-4">Welcome, {teachername}</h1>

      <div className="mb-6 flex justify-between">
        <button
          onClick={() => navigate("/createexam")}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          + Create New Exam
        </button>
        <button onClick={logout} className="bg-blue-600 text-white px-4 py-2 rounded">
          Logout
        </button>
      </div>

      <h2 className="text-xl font-semibold mb-3">Your Exams</h2>

      {error && <p className="text-red-600">{error}</p>}

      {exams.length === 0 ? (
        <p>No exams created yet.</p>
      ) : (
        <table className="w-full bg-white shadow rounded">
          <thead>
            <tr className="bg-gray-200">
              <th className="p-2">Title</th>
              <th className="p-2">Exam Key</th>
              <th className="p-2">Start Time</th>
              <th className="p-2">End Time</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {exams.map((exam) => (
              <tr key={exam.id} className="border-b">
                <td className="p-2">{exam.title}</td>
                <td className="p-2">{exam.examKey}</td>
                <td className="p-2">{new Date(exam.startTime).toLocaleString()}</td>
                <td className="p-2">{new Date(exam.endTime).toLocaleString()}</td>
                <td className="p-2 space-x-2">
                  <Link to={`/exam/${exam.id}/questions`} className="text-blue-600">
                    Manage Questions
                  </Link>
                  <Link to={`/exam/${exam.id}/report`} className="text-purple-600">
                    View Report
                  </Link>
                  <button onClick={() => openEditModal(exam)} className="text-green-600">
                    Edit
                  </button>
                  <button onClick={() => handleDelete(exam.id)} className="text-red-600">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Edit Modal */}
      {isModalOpen && (
        <EditExamModal
          exam={selectedExam}
          onClose={() => setIsModalOpen(false)}
          onUpdate={handleUpdateExam}
        />
      )}
    </div>
  );
};

export default TeacherDashboard;