import React from "react";
import { GiBrassEye } from "react-icons/gi";
import Navbar from "../components/StaticComponets/Navbar/Navbar";
import ConstantHero from "../components/StaticComponets/ConstantHero";
import Footer from "../components/StaticComponets/Footer/Footer";

const ruleSections = [
  {
    title: "Before the Exam",
    rules: [
      "Use a fully charged device or keep it connected to a reliable power source.",
      "Make sure your internet connection is stable before joining the exam.",
      "Test your webcam and microphone in advance.",
      "Keep a clean and distraction-free environment before starting.",
    ],
  },
  {
    title: "During the Exam",
    rules: [
      "Keep your face visible inside the webcam frame throughout the exam.",
      "Remain in fullscreen mode and avoid switching tabs or applications.",
      "Do not use phones, smartwatches, notes, or any unauthorized device.",
      "Do not talk to other people or allow anyone else to appear in the frame.",
    ],
  },
  {
    title: "Monitoring and Consequences",
    rules: [
      "Your camera, microphone, and system activity may be monitored during the session.",
      "Suspicious behavior can be flagged by the proctoring system for review.",
      "Repeated violations may terminate the session or invalidate results.",
      "Students are expected to complete the examination honestly and individually.",
    ],
  },
];

const ExamRules = () => {
  return (
    <div className="bg-green-100 min-h-screen">
      <Navbar />
      <ConstantHero
        cName="container max-w-4xl mx-auto py-32"
        heroDesc="mx-auto text-center px-4"
        iconclass="w-16 h-16 flex items-center justify-center mx-auto"
        heroIcon={<GiBrassEye size={32} />}
        heroTitle="Exam Rules"
        heroText="Clear instructions and conduct requirements help maintain a fair, secure, and uninterrupted examination environment for every student."
      />

      <section className="px-6 py-24">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
          {ruleSections.map((section) => (
            <div
              key={section.title}
              className="bg-white rounded-2xl p-8 shadow-[0px_8px_24px_rgba(0,0,0,0.12)]"
            >
              <h2 className="text-2xl font-semibold text-gray-900 mb-6">{section.title}</h2>
              <ul className="space-y-4 text-gray-600 leading-7">
                {section.rules.map((rule) => (
                  <li key={rule} className="flex gap-3">
                    <span className="mt-2 w-2 h-2 rounded-full bg-green-600 shrink-0" />
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default ExamRules;
