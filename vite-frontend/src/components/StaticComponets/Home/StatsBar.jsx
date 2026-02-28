import React from 'react'

const StatsBar = () => {
    const stats = [
  { value: "50+", label: "Universities" },
  { value: "100K+", label: "Exams Conducted" },
  { value: "99.9%", label: "Uptime" },
  { value: "500K+", label: "Students" },
];
  return (
     <div className="">
          <div className="container mx-auto px-4 py-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {stats.map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="text-3xl font-bold md:text-4xl font-bol mb-1">
                    {stat.value}
                  </div>
                  <div className="text-sm font-medium">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
  )
}

export default StatsBar
