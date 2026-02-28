import React from 'react'

const Hero = () => {
  return (
    <section id='hero' className="px-6 mb-16 md:flex items-center justify-between max-w-7xl mx-auto pt-32">        
        <div className="md:w-1/2 mb-10 md:mb-0">
          <h1 className="text-4xl text-black md:text-5xl font-bold leading-tight">
           Secure Online Examinations for
          </h1>
          <h1 className="text-4xl md:text-5xl font-bold text-green-500 mt-2">
           Modern Education
          </h1>

          <p className="mt-6 text-lg text-black md:text-gray-600">
           comprehensive examination platform with AI-powered proctoring, real-time monitoring, and seamless integration for universities and colleges.
          </p>
          <div className='flex gap-4 items-center mt-8'>
            <button className=" bg-green-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-500 transition">
            Get Started
          </button>
          <button className='shadow-xl bg-white px-6 py-3 rounded-lg font-medium'>Learn More</button>

          </div>
          
        </div>

        {/* Image Section (Desktop Only) */}
        <div className=" md:w-2/5">
          <img
            src="./heroimg.png"
            alt="job"
            className="rounded-xl shadow-lg"
          />
        </div>

      
    </section>
  )
}

export default Hero
