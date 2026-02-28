import React from 'react'
import { FaUserTie } from "react-icons/fa6";
import { GiLaptop } from "react-icons/gi";
import { MdMobileOff } from "react-icons/md";
import { GiGaze } from "react-icons/gi";
import { FaPeopleGroup } from "react-icons/fa6";
import { MdSpatialAudioOff } from "react-icons/md";
const Features = () => {
    const feature = [
    {
        id: 1,
        icon: <FaUserTie />,
        heading: "Facial Recognition",
        details: "The exam is unlocked only after successful facial verification. A photo uploaded during registration is used to confirm the student's identity during each exam."
    },
    {
        id: 2,
        heading: "Tab Switching Monitoring",
         icon: <GiLaptop />,
        details: "The system tracks tab-switching behavior to flag any unauthorized attempts to leave the exam window."
    },
    {
        id: 3,
        heading: "Object Detection",
         icon: <MdMobileOff />,
        details: "Detects unauthorized objects, such as books or smartphones, to prevent cheating during the exam."
    },
    {
        id: 4,
        heading: "Gaze Monitoring",
         icon: <GiGaze />,
        details: "Monitors eye movement to ensure the candidate remains focused on the exam screen."
    },
    {
        id: 5,
        heading: "Multiple Person Detection",
        icon: <FaPeopleGroup />,
        details: "Detects the presence of additional individuals in the exam area to confirm only the registered student is present."
    },
    {
        id: 6,
        heading: "Audio Surveillance",
         icon: <MdSpatialAudioOff />,
        details: "Records and analyzes background sounds for any suspicious noises, such as conversation or other distractions."
    }
];

  return (
   <section id='feature' className='bg-gray-50 px-6 py-8'>
        <div className='max-w-6xl mx-auto text-center'>
            <h2 className='text-3xl font-bold mb-2'>Advanced Features for Exam Integrity</h2>
<p className='mb-6 text-lg leading-relaxed'>
 Secure and monitor exams with advanced features to ensure integrity.
</p>
            <div className='grid md:grid-cols-3 gap-8 text-left'>
                {feature.map((item)=>(
                    <div key={item.id} className='bg-white p-8 rounded-xl shadow-2xl'>
                        <p className='text-4xl text-white w-20 h-20 rounded-full mx-auto p-5 bg-gray-500'>{item.icon}</p>
                        <h3 className='text-xl text-center font-semibold mb-2'>{item.heading}</h3>
                        <p className='text-justify'>{item.details}</p>
                    </div>
                ))}

            </div>

        </div>
      
    </section>
  )
}

export default Features
