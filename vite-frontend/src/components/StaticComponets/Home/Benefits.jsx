import React from 'react'

const Benefits = () => {
  return (
    <section className="min-h-screen max-w-6xl mx-auto  py-12 px-4 sm:py-16 lg:py-20">
    
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-center mb-12 sm:mb-16 leading-tight">
          The <span className="text-green-400">Benefits</span> -You Get!
        </h1>
        <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 items-stretch lg:items-center">
          <div className="flex-1 border-2 border-gray-200 rounded-xl sm:rounded-2xl p-6 sm:p-8 bg-white min-h-80 sm:min-h-96 flex flex-col justify-between">
            <div className="flex-1 flex items-center justify-center">
             
              <h2 className="text-3xl font-bold text-center">
                FOR A STUDENT
              </h2>
            </div>
            <p className="text-3xl sm:text-4xl font-bold text-center text-gray-700">01.</p>
          </div>

          <div className=" bg-green-400 rounded-xl sm:rounded-2xl p-6 sm:p-8 min-h-80 sm:min-h-96 flex flex-col justify-between shadow-lg">
              <h2 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6 text-gray-900">
                For a Institutions
              </h2>

              <ul className="space-y-4 sm:space-y-6">
                <li>
                  <h3 className="font-bold text-base sm:text-lg mb-1 sm:mb-2 text-gray-900">
                    Unleash Academic Integrity:
                  </h3>
                  <p className="text-sm sm:text-base text-gray-800 leading-relaxed">
                    Ensure A Level Playing Field And Protect The Value Of Your Degrees With ProctorTech's Robust Security Measures.
                  </p>
                </li>

                <li>
                  <h3 className="font-bold text-base sm:text-lg mb-1 sm:mb-2 text-gray-900">
                    Revolutionize Exam Delivery:
                  </h3>
                  <p className="text-sm sm:text-base text-gray-800 leading-relaxed">
                    Streamline Workflows, Automate Processes, And Experience Exam Management That's Effortless And Efficient.
                  </p>
                </li>

                <li>
                  <h3 className="font-bold text-base sm:text-lg mb-1 sm:mb-2 text-gray-900">
                    Gain Valuable Insights:
                  </h3>
                  <p className="text-sm sm:text-base text-gray-800 leading-relaxed">
                    Leverage Data-Driven Analytics To Improve Your Assessments And Optimize Learning Outcomes.
                  </p>
                </li>
              </ul>
            

            <div className="text-3xl sm:text-4xl font-bold text-gray-900 mt-4">02.</div>
          </div>

          <div className="flex-1 border-2 border-gray-200 rounded-xl sm:rounded-2xl p-6 sm:p-8 bg-white min-h-80 sm:min-h-96 flex flex-col justify-between">
            <div className="flex-1 flex items-center justify-center">
             
              <h2 className="text-3xl font-bold text-center">
                For A TEACHERS
              </h2>
            </div>
            <p className="text-3xl sm:text-4xl font-bold text-center text-gray-700">03.</p>
          </div>
        </div>
     
    </section>

  )
}

export default Benefits
