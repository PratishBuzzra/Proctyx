import React from 'react'

const HowWorks = () => {
    const steps = [
  {
    step: "01",
    title: "Admin Creates Teacher and Student Account",
    description: "Create account and access your personalized dashboard.",
  },
  {
    step: "02",
    title: "Teahcer Creates Exam provide exam key",
    description: "Teacher Create Exam, instructions, and provide exam key.",
  },
  {
    step: "03",
    title: "Student enter key Complete Prerequisites",
    description: "Join exam with key Verify your identity and ensure camera/microphone are working.",
  },
  {
    step: "04",
    title: "Take Your Exam",
    description: "Complete your exam in a secure, monitored environment.",
  },
];
  return (
    <section className="px-8 py-24">
        <div className='max-w-7xl mx-auto'>
            <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">
              How It Works
            </h2>
            <p className="text-lg max-w-2xl mx-auto">
              Get started with your online examination in four simple steps.
            </p>
          </div>
            
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((item, index) => (
              <div key={item.step} className="bg-white p-3 rounded-xl shadow-[0px_5px_15px_rgba(0,0,0,0.35)]">
                <div className="p-6 h-full">
                  <div className="text-5xl opacity-25 font-bold mb-4">
                    {item.step}
                  </div>
                  <h3 className="text-lg font-semibold mb-2">
                    {item.title}
                  </h3>
                  <p className="text-sm">
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

export default HowWorks
