import React, { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom';
import { useExam } from '../../context/ExamContext';

const ExamRules = () => {
    const [isChecked, setIsChecked] = useState(false)
    const navigate = useNavigate(); 
    const { examId } = useParams();
     const { updateExamState } = useExam();
    
    const enterFullScreen = async()=>{
      const elem = document.documentElement

      try {
        if(elem.requestFullscreen){
          await elem.requestFullscreen();
        }else if(elem.webkitRequestFullScreen()){
          await elem.webkitRequestFullScreen();
        }else if(elem.msRequestFullScreen()){
          elem.msRequestFullScreen();
        }
      } catch (error) {
        alert("full screen is required to start the exam")
        throw error;
        
      }
    }
    const startExam = async()=>{
      if(!isChecked) return;
      try {
        updateExamState({ rulesAccepted: true });
        await enterFullScreen()
        navigate(`/exam/${examId}`)
      } catch (error) {
        
      }
    }

  return (
    <div className="min-h-screen flex justify-center items-center py-20">
        <div className='w-full p-8 max-w-7xl shadow-2xl rounded-lg'>
      <h2 className="text-center text-2xl font-semibold text-gray-700 mb-4">Important Rules</h2>
      <ol className="list-decimal pl-8 mt-4 mb-4 space-y-2">
             <li><strong>Device and Internet:</strong> Ensure your device is fully charged or connected to a reliable power source and has a stable, high-speed internet connection for the entire duration of the exam.</li>
             <li><strong>Webcam and Microphone:</strong> Keep your webcam and microphone turned on at all times. These are mandatory for real-time monitoring during the exam.</li>
             <li><strong>No Unauthorized Tabs or Devices:</strong> Refrain from opening additional browser tabs, applications, or using external devices such as phones, smartwatches, or notes during the session.</li>
             <li><strong>Stay in Frame:</strong> Ensure your face is clearly visible in the webcam frame throughout the exam. Avoid looking away from the screen frequently.</li>
             <li><strong>Quiet and Distraction-Free Environment:</strong> Select a quiet location where you won’t be interrupted. Background noise or distractions may lead to your session being flagged.</li>
             <li><strong>Individual Effort Only:</strong> The examination is strictly individual. Any form of collaboration or communication with others is prohibited.</li>
         <li><strong>Behavior Monitoring:</strong> Be aware that AI systems and live proctors may monitor your activity, including webcam and microphone feeds. Suspicious activities will be flagged for review.</li>
             <li><strong>Consequences of Rule Violations:</strong> Any violation of these rules, including misconduct or suspicious behavior, may lead to immediate termination of your exam session, invalidation of your results, and possible disciplinary action.</li>
           </ol>

           <div className='flex items-center justify-center mb-4'>
            <input type="checkbox" id='agreecheckbox' checked={isChecked} onClick={()=>setIsChecked(prev=>!prev)} className='mr-2' />
            <label htmlFor="agreecheckbox" className='text-lg'>I have read and agree to the terms and rules</label>
           </div>
        <button
          type="button"
          onClick={startExam}
          className={`w-full bg-green-500 text-white py-2 px-4 rounded-md hover:bg-green-600 ${isChecked ? '' : 'opacity-50 cursor-not-allowed'}`}
        >
          Start Exam
        </button>
    
      </div>
    </div>
  )
}

export default ExamRules
