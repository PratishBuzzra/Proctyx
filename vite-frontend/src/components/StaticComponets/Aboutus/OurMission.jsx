import React from 'react'

const OurMission = () => {
      const stats = [
  { value: "50+", label: "Universities" },
  { value: "100K+", label: "Exams Conducted" },
  { value: "99.9%", label: "Uptime" },
  { value: "500K+", label: "Students" },
];
  return (
    <section className="py-16 md:py-24 mx-auto px-6 md:px-12 lg:px-24">
       
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-6">
                Our Mission
              </h2>
              <p className="text-lg mb-6">
                Proctyx was founded with a simple yet powerful mission: to provide 
                educational institutions with a secure, reliable, and user-friendly 
                platform for conducting online examinations.
              </p>
              <p className="mb-6">
                We believe that technology should enhance the educational experience, 
                not complicate it. Our platform is designed to be intuitive for both 
                educators and students, while maintaining the highest standards of 
                security and academic integrity.
              </p>
              <p className="">
                Since our founding, we have helped over 50 universities 
                and colleges conduct more than 100,000 examinations, serving 
                over 500,000 students worldwide.
              </p>
            </div>
             <div className="grid grid-cols-2 gap-4 sm:gap-6">
              {stats.map((stat) => (
                <div key={stat.label} className="text-center  p-8 rounded-xl shadow-[0px_5px_15px_rgba(0,0,0,0.35)]">
                  <div className="text-2xl sm:text-3xl md:text-4xl font-bold ">
                    {stat.value}
                  </div>
                  <div className="text-xs sm:text-sm font-medium">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
      </section>
  )
}

export default OurMission
