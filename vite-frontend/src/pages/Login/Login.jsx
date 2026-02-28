import React, { useRef, useState } from "react";
import { useContext } from "react";
import { useNavigate } from "react-router-dom";
import Webcam from "react-webcam";
import { AuthContext } from "../../context/authContext";

const base_url = import.meta.env.VITE_API_URL

const Login = () => {
  const [formData, setFormData] = useState({
    teacher_id: "",
    email: "",
    password: ""
  });

  const navigate = useNavigate()
  const {login} = useContext(AuthContext) 

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevState) => ({
      ...prevState,
      [name]: value
    }));
  };

const handleSubmit = async (e)=>{
  e.preventDefault()
  try {
    const res = await fetch(`${base_url}/teacher/loginteacher`, {
      method: "POST",
      headers:{
        'Content-Type': 'application/json',
       
        
      },
      credentials: "include",
      body: JSON.stringify({
        teacher_id: formData.teacher_id,
        email: formData.email,
        password: formData.password
      })
    })
    let data = await res.json()
    if(res.ok){
      alert('login successful')
      login()
      navigate('/teacherdashboard')
    }else{
      alert(data.error || 'login failed')
    }
  } catch (error) {
      console.error('error login', error);
      alert('error occured please try again')
  }
}

  return (
    <div className="min-h-screen flex justify-center items-center py-20">
      <div className="w-full p-8 max-w-md shadow-2xl rounded-lg">
        <h2 className="text-center text-2xl font-semibold text-gray-700 mb-4">
          TEACHER SIGN IN
        </h2>

        <form id="registration-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="mb-4">
            <label
              htmlFor="teacherid"
              className="block text-sm font-medium text-gray-700"
            >
              Teacher Id
            </label>
            <input
              type="text"
              id="teacherid"
              name="teacher_id"
              className="border border-gray-300 px-3 py-2 mt-1 w-full rounded"
              value={formData.teacher_id}
              onChange={handleInputChange}
              placeholder="Enter your teacher id"
            />
          </div>
        

          <div className="mb-4">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700"
            >
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              className="border border-gray-300 px-3 py-2 mt-1 w-full rounded"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="Enter your email"
            />
          </div>

        

          <div className="mb-4">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700"
            >
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              className="border border-gray-300 px-3 py-2 mt-1 w-full rounded"
              value={formData.password}
              onChange={handleInputChange}
              placeholder="Create a password"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-green-500 text-white py-2 px-4 rounded-md hover:bg-green-600"
          >
            Login
          </button>
          <p>Need help accessing your account? Contact Support</p>
        </form>
      </div>
    </div>
  );
};

export default Login;
