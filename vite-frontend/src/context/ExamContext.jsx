// context/SimpleExamContext.jsx - IMPROVED VERSION
import React, { createContext, useContext, useState, useEffect } from 'react';

const ExamContext = createContext();

// Helper function to get from localStorage
const getStoredExamData = () => {
  try {
    const stored = localStorage.getItem('examAccess');
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

export function ExamProvider({ children }) {
  // Initialize with localStorage data immediately
  const [examState, setExamState] = useState(() => {
    const stored = getStoredExamData();
    return stored || {
      examId: null,
      accessToken: null,
      verified: false,
      systemChecked: false,
      rulesAccepted: false,
      studentId: null
    };
  });

  // Save to localStorage whenever state changes
  const updateExamState = (newState) => {
    const updated = { ...examState, ...newState };
    setExamState(updated);
    localStorage.setItem('examAccess', JSON.stringify(updated));
  };

  const clearExamAccess = () => {
    const clearedState = {
      examId: null,
      accessToken: null,
      verified: false,
      systemChecked: false,
      rulesAccepted: false
    };
    setExamState(clearedState);
    localStorage.removeItem('examAccess');
  };

  return (
    <ExamContext.Provider value={{
      ...examState,
      updateExamState,
      clearExamAccess
    }}>
      {children}
    </ExamContext.Provider>
  );
}

export const useExam = () => {
  const context = useContext(ExamContext);
  if (!context) {
    throw new Error('useExam must be used within ExamProvider');
  }
  return context;
};
