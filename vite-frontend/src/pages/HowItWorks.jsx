import React from "react";
import { GiBrassEye } from "react-icons/gi";
import { FiClipboard, FiMonitor, FiShield, FiUserCheck } from "react-icons/fi";
import Navbar from "../components/StaticComponets/Navbar/Navbar";
import ConstantHero from "../components/StaticComponets/ConstantHero";
import Footer from "../components/StaticComponets/Footer/Footer";

const steps = [
  {
    id: "01",
    title: "Teacher Creates and Publishes the Exam",
    description:
      "Teachers create the exam, add questions, set duration, and share the exam key with students.",
    icon: <FiClipboard size={24} />,
  },
  {
    id: "02",
    title: "Student Joins with Exam Key",
    description:
      "Students enter the provided exam key, confirm their identity, and move through the required pre-exam checks.",
    icon: <FiUserCheck size={24} />,
  },
  {
    id: "03",
    title: "System Verification Starts",
    description:
      "The platform checks camera, microphone, fullscreen readiness, and face verification before allowing entry.",
    icon: <FiMonitor size={24} />,
  },
  {
    id: "04",
    title: "Rules Are Accepted Before Entry",
    description:
      "Students must read the exam rules and explicitly accept them before the exam session can begin.",
    icon: <FiShield size={24} />,
  },
];

const monitoringPoints = [
  "Face verification is performed before exam access.",
  "Camera and microphone remain active during the exam.",
  "AI-based monitoring checks suspicious movements and behavior.",
  "Violations are recorded and included in the final exam report.",
];

const HowItWorks = () => {
  return (
    <div className="bg-green-100 min-h-screen">
      <Navbar />
      <ConstantHero
        cName="container max-w-4xl mx-auto py-32"
        heroDesc="mx-auto text-center px-4"
        iconclass="w-16 h-16 flex items-center justify-center mx-auto"
        heroIcon={<GiBrassEye size={32} />}
        heroTitle="How Proctyx Works"
        heroText="A guided online examination flow that helps teachers manage exams securely and students complete them with clear verification and monitoring steps."
      />

      <section className="px-6 py-20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Exam Flow in Four Steps
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto text-lg">
              From exam creation to monitored submission, the system follows a structured process to protect fairness and simplify participation.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {steps.map((step) => (
              <div
                key={step.id}
                className="bg-white rounded-2xl shadow-[0px_8px_24px_rgba(0,0,0,0.12)] p-8"
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="w-12 h-12 rounded-full bg-green-100 text-green-700 flex items-center justify-center">
                    {step.icon}
                  </div>
                  <span className="text-4xl font-bold text-green-200">{step.id}</span>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">{step.title}</h3>
                <p className="text-gray-600 leading-7">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 pb-24">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-2xl p-8 shadow-[0px_8px_24px_rgba(0,0,0,0.12)]">
            <h3 className="text-2xl font-semibold text-gray-900 mb-4">For Students</h3>
            <p className="text-gray-600 leading-7 mb-4">
              Students join using the exam key, complete identity verification, pass the system check, accept the rules, and then take the exam in fullscreen mode.
            </p>
            <p className="text-gray-600 leading-7">
              During the exam, the platform continuously tracks behavior and records suspicious events for review.
            </p>
          </div>

          <div className="bg-green-600 rounded-2xl p-8 text-white shadow-[0px_8px_24px_rgba(0,0,0,0.16)]">
            <h3 className="text-2xl font-semibold mb-4">Monitoring Highlights</h3>
            <ul className="space-y-3 text-green-50 leading-7">
              {monitoringPoints.map((point) => (
                <li key={point} className="flex gap-3">
                  <span className="mt-2 w-2 h-2 rounded-full bg-white shrink-0" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default HowItWorks;
