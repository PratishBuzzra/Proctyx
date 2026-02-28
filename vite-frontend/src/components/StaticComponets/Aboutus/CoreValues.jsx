import React from 'react'
import { FiTarget } from "react-icons/fi";
import { FaUserFriends } from "react-icons/fa";
import { FaAward } from "react-icons/fa";
import { AiOutlineGlobal } from "react-icons/ai";
const CoreValues = () => {
    const values = [
  {
    id: 1,
    icon: <FiTarget />,
    title: "Academic Integrity",
    description: "We are committed to maintaining the highest standards of academic honesty and fairness in all examinations.",
  },
  {
    id: 2,
    icon: <FaUserFriends />,
    title: "Accessibility",
    description: "Our platform is designed to be accessible to all students, regardless of their technical capabilities or disabilities.",
  },
  {
    id: 3,
    icon: <FaAward/>,
    title: "Excellence",
    description: "We continuously strive for excellence in our technology, support, and educational outcomes.",
  },
  {
    id: 4,
    icon: <AiOutlineGlobal/>,
    title: "Global Reach",
    description: "Supporting educational institutions worldwide with localized features and 24/7 multilingual support.",
  },
];
  return (
    <section className="px-8 py-24">
        <div className='max-w-7xl mx-auto'>
            <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">
               Our Core Values
            </h2>
            <p className="text-lg max-w-2xl mx-auto">
             The principles that guide everything we do
            </p>
          </div>
            
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {values.map((value) => (
              <div key={value.id} className="bg-white p-6 text-center rounded-xl shadow-[0px_5px_15px_rgba(0,0,0,0.35)]">
                <div className="p-6 h-full">
                  <div className="text-5xl opacity-50 font-bold mb-4 flex justify-center">
                    {value.icon}
                  </div>
                  <h3 className="text-lg font-semibold mb-2">
                    {value.title}
                  </h3>
                  <p className="text-sm">
                    {value.description}
                  </p>
                </div>
              
              </div>
            ))}
          </div>

        </div>
      </section>
  )
}

export default CoreValues
