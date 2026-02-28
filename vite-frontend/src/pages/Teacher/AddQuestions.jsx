import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

const base_url = import.meta.env.VITE_API_URL;

const AddQuestions = () => {
  const { id } = useParams(); // exam id
  const [questions, setQuestions] = useState([]);

  const [formData, setFormData] = useState({
    questionText: "",
    optionA: "",
    optionB: "",
    optionC: "",
    optionD: "",
    correctAnswer: ""
  });

  const fetchQuestions = async () => {
    try {
      const res = await fetch(
        `${base_url}/questions/exam/${id}`,
        { credentials: "include" }
      );

      const data = await res.json();
      if (res.ok) setQuestions(data);
    } catch (err) {
      console.log("Error loading questions");
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, []);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const res = await fetch(`${base_url}/questions/addquestion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...formData,
          examId: parseInt(id)
        })
      });

      if (res.ok) {
        alert("Question added successfully");
        setFormData({
          questionText: "",
          optionA: "",
          optionB: "",
          optionC: "",
          optionD: "",
          correctAnswer: ""
        });
        fetchQuestions();
      }
    } catch (err) {
      alert("Error adding question");
    }
  };

  const handleDelete = async (questionId) => {
    try {
      const res = await fetch(
        `${base_url}/questions/question/${questionId}`,
        {
          method: "DELETE",
          credentials: "include"
        }
      );

      if (res.ok) fetchQuestions();
    } catch (err) {
      alert("Error deleting question");
    }
  };

  return (
    <div className="min-h-screen p-6 bg-gray-100">
      <h2 className="text-2xl font-bold mb-4">Manage Questions</h2>

      {/* Add Question Form */}
      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 rounded shadow mb-6 space-y-4"
      >
        <textarea
          name="questionText"
          placeholder="Enter Question (You can paste code here)"
          value={formData.questionText}
          onChange={handleChange}
          className="w-full border p-3 rounded font-mono whitespace-pre-wrap"
          rows={4}
          required
        />

        {/* Options */}
        <textarea
          name="optionA"
          placeholder="Option A"
          value={formData.optionA}
          onChange={handleChange}
          className="w-full border p-3 rounded font-mono whitespace-pre-wrap"
          rows={3}
          required
        />

        <textarea
          name="optionB"
          placeholder="Option B"
          value={formData.optionB}
          onChange={handleChange}
          className="w-full border p-3 rounded font-mono whitespace-pre-wrap"
          rows={3}
          required
        />

        <textarea
          name="optionC"
          placeholder="Option C"
          value={formData.optionC}
          onChange={handleChange}
          className="w-full border p-3 rounded font-mono whitespace-pre-wrap"
          rows={3}
          required
        />

        <textarea
          name="optionD"
          placeholder="Option D"
          value={formData.optionD}
          onChange={handleChange}
          className="w-full border p-3 rounded font-mono whitespace-pre-wrap"
          rows={3}
          required
        />

        <select
          name="correctAnswer"
          value={formData.correctAnswer}
          onChange={handleChange}
          className="w-full border p-3 rounded"
          required
        >
          <option value="">Select Correct Answer</option>
          <option value="A">Option A</option>
          <option value="B">Option B</option>
          <option value="C">Option C</option>
          <option value="D">Option D</option>
        </select>

        <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          Add Question
        </button>
      </form>

      {/* Questions Table */}
      <div className="bg-white shadow rounded overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-200">
            <tr>
              <th className="p-2 text-left">Question</th>
              <th className="p-2 text-left">Correct</th>
              <th className="p-2">Action</th>
            </tr>
          </thead>

          <tbody>
            {questions.map((q) => (
              <tr key={q.id} className="border-b">
                <td className="p-3 whitespace-pre-wrap font-mono">
                  {q.questionText}
                </td>
                <td className="p-3">{q.correctAnswer}</td>
                <td className="p-3 text-center">
                  <button
                    onClick={() => handleDelete(q.id)}
                    className="text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}

            {questions.length === 0 && (
              <tr>
                <td colSpan="3" className="text-center p-4">
                  No questions added yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AddQuestions;
