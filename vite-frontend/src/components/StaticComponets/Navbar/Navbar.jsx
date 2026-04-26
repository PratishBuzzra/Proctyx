import React from 'react'
import { GiBrassEye } from "react-icons/gi";
import { Link, NavLink } from 'react-router-dom';
const Navbar = () => {
  return (
    <header className='fixed top-0 left-0 w-full bg-green-100 shadow-lg px-4 py-4 z-50'>
        <div className='max-w-7xl mx-auto flex justify-between items-center'>
        <Link to={'/'}>
      <div  className='flex items-center gap-2 font-bold'>
        <h1 className='text-2xl'>Proctyx</h1>
       <GiBrassEye size={32}/>
      </div>
        </Link>
        <div className='flex gap-8 items-center justify-center text-md font-medium'>
          <NavLink to="/" className="nav-link">Home</NavLink>
           <NavLink to="/about" className="nav-link">About</NavLink>
            <NavLink to="/howitworks" className="nav-link">How It Works</NavLink>
             <NavLink to="/exam-rules" className="nav-link">Exam Rules</NavLink>
              
        </div>
       <div className='flex gap-4'>
           <Link to="/join-exam" className="py-2 text-green-600 font-medium  cursor-pointer">
            Join Exam
          </Link>
         <Link to={'/login'}>
        <button className='bg-green-600 px-3 py-2 text-white rounded shadow-xl cursor-pointer'>Teacher Sign In</button>
        </Link>
        </div>
      </div>
    </header>
  )
}

export default Navbar
