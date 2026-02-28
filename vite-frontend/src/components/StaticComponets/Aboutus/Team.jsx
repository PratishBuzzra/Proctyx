import React from 'react'

const Team = () => {
    const team = [
  {
    id: 1,
    name: "Pratish Bajracharya",
    role: "Full Stack Developer",
    description: "CSIT 7th Sem Student",
  },
  {
    id: 2,
    name: "Aakrit Adhikari",
    role: "AI Developer",
    description: "CSIT 7th Sem Student",
  },
  {
    id: 3,
    name: "Sudesh Subedi",
    role: "AI Developer",
    description: "CSIT 7th Sem Student",
  }
];

  return (
     <section className="px-8 py-24">
        <div className='max-w-7xl mx-auto'>
            <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">
              Leadership Team
            </h2>
            <p className="text-lg max-w-2xl mx-auto">
                          Meet the experts behind Proctyx
            </p>
          </div>
            
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {team.map((member) => (
              <div key={member.id} className="bg-white p-6 text-center rounded-xl shadow-[0px_5px_15px_rgba(0,0,0,0.35)]">
                <div className="p-6 h-full">
                  <div className="w-30 h-30 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold">
                    {member.name.split(" ").map((n) => n[0]).join("")}
                  </span>
                </div>
                  <h3 className="text-lg font-semibold">
                    {member.name}
                  </h3>
                  <p className='text-sm font-medium mb-2'>
                    {member.role}
                  </p>
                  <p className="text-sm">
                    {member.description}
                  </p>
                </div>
              
              </div>
            ))}
          </div>

        </div>
      </section>
  )
}

export default Team
