import React from 'react'

const About = () => {
const about = [
    {
        id: 1,
        title: "Ensures Credibility of Exam Results",
        description: "The system guarantees the authenticity of exam results by eliminating opportunities for cheating or malpractice, providing instructors with reliable and accurate data for grading."
    },
    {
        id: 2,
        title: "User-Friendly for Instructors and Students",
        description: "Designed with simplicity in mind, this system is intuitive and easy to use for both instructors setting up exams and students taking them, ensuring a smooth experience for everyone involved."
    },
    {
        id: 3,
        title: "Browser Lockdown for Exam Security",
        description: "The system prevents students from accessing unauthorized websites or applications during exams by locking down their browsers, ensuring a focused and secure exam environment."
    },
    {
        id: 4,
        title: "Real-Time Monitoring & Detailed Activity Reports",
        description: "Monitor student activity in real-time and receive detailed reports on any suspicious behavior, ensuring that the integrity of your exam process is maintained throughout."
    },
    {
        id: 5,
        title: "Face Recognition & Audio Analysis for Exam Integrity",
        description: "Advanced technologies like face recognition and audio analysis ensure a secure exam environment by verifying the student’s identity and monitoring their surroundings, replicating the experience of an in-class exam."
    },
    {
        id: 6,
        title: "Additional Practical Features",
        description: "The system comes with a range of extra features tailored to improve exam security and administration, such as automatic flagging of anomalies and customizable settings to fit various exam formats."
    }
];


  return (
    <section id='about' className='px-8 pt-24'>
        <div className='max-w-7xl mx-auto text-center'>
             <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">
              Everything you need for secure assessments
            </h2>
            <p className="text-lg max-w-2xl mx-auto">
              Our comprehensive proctoring platform combines cutting-edge technology with ease of use
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {about.map((item) => (
              <div
                key={item.id}
                className="bg-white p-3 rounded-xl shadow-[0px_5px_15px_rgba(0,0,0,0.35)]"
              >
                <div className='p-6 flex flex-col items-center justify-center'> 
                     <h3 className="text-lg font-semibold mb-2">
                  {item.title}
                </h3>
                <p className="text-md">
                  {item.description}
                </p>

                </div>
               
              </div>
            ))}
          </div>

        </div>
      
    </section>
  )
}

export default About
