import React, { useState, useRef } from 'react';


const Register = () => {
 
  const [formData, setFormData] = useState({
    studentId: '',
    name: '',
    email: '',
    address: '',
    phone: '',
    password: '',
    studentImg: null,
  });



  const handleInputChange = (e) => {
    const { name, value, type, files } = e.target;
    setFormData((prevState) => ({
      ...prevState,
       [name]: type === 'file' ? files[0] : value,
    }));
  };


 

  return (
    <div className="min-h-screen flex justify-center items-center py-20">
        <div className='w-full p-8 max-w-md shadow-2xl rounded-lg'>
      <h2 className="text-center text-2xl font-semibold text-gray-700 mb-4">Student Registration</h2>
      
      <form id="registration-form" className='space-y-4'>
          <div className="mb-4">
          <label htmlFor="studentId" className="block text-sm font-medium text-gray-700">StudentId</label>
          <input
            type="text"
            id="studentId"
            name="studentid"
            className="border border-gray-300 px-3 py-2 mt-1 w-full rounded"
            value={formData.studentId}
            onChange={handleInputChange}
            placeholder="Enter your StudentId"
          />
        </div>
        <div className="mb-4">
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">Name</label>
          <input
            type="text"
            id="name"
            name="name"
            className="border border-gray-300 px-3 py-2 mt-1 w-full rounded"
            value={formData.name}
            onChange={handleInputChange}
            placeholder="Enter your name"
          />
        </div>

        <div className="mb-4">
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
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
          <label htmlFor="phoneno" className="block text-sm font-medium text-gray-700">PhoneNo</label>
          <input
            id="phone"
            name="phone"
              className="border border-gray-300 px-3 py-2 mt-1 w-full rounded"
            value={formData.phone}
            onChange={handleInputChange}
            placeholder="Enter your phoneno"
          ></input>
        </div>

      <div className="mb-4">
            <label htmlFor="studentImg" className="block text-sm font-medium text-gray-700">Upload Image</label>
            <input
              type="file"
              id="studentImg"
              name="studentImg"
              className="border border-gray-300 px-3 py-2 mt-1 w-full rounded"
              onChange={handleInputChange}
            />
          </div>

        <div className="mb-4">
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
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
          type="button"
          className="w-full bg-green-500 text-white py-2 px-4 rounded-md hover:bg-green-600"
          disabled
        >
          Register
        </button>
      </form>
      </div>
    </div>
  );
};

export default Register;
