// hooks/useFirestore.js
// Custom hook for Firestore database operations

import { useState, useEffect, useCallback } from 'react';
import { 
  collection, 
  query, 
  addDoc, 
  serverTimestamp, 
  orderBy, 
  onSnapshot 
} from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { EXAM_CONFIGS } from '../config/examConfig';

// App ID from Claude.ai artifact environment
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

export const useFirestore = (user) => {
  const [quizzes, setQuizzes] = useState({});
  const [userQuestions, setUserQuestions] = useState([]);

  // Helper to get user-specific data path
  const getUserDataPath = (collectionName) => {
    const userId = user?.uid || 'anonymous';
    return collection(db, 'artifacts', appId, 'users', userId, collectionName);
  };

  // Listen to exam attempts in real-time
  useEffect(() => {
    if (!user || !db) return;

    const q = query(
      getUserDataPath('examAttempts'), 
      orderBy('timestamp', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const attemptsByExam = {};
      
      snapshot.forEach(doc => {
        const attempt = doc.data();
        const examName = attempt.examName;
        
        if (!attemptsByExam[examName]) {
          attemptsByExam[examName] = [];
        }
        
        attemptsByExam[examName].push({ 
          ...attempt, 
          id: doc.id 
        });
      });
      
      setQuizzes(attemptsByExam);
    }, (error) => {
      console.error("❌ Error fetching quiz attempts:", error);
    });

    return () => unsubscribe();
  }, [user]);

  // Add quiz attempt to Firestore
  const addQuizAttempt = useCallback(async (examName, score, totalQuestions, timeSpent) => {
    if (!user || !db) {
      console.error("❌ Cannot add attempt: User not authenticated or DB not available.");
      return;
    }

    try {
      const percentage = Math.round((score / totalQuestions) * 100);
      const passMark = EXAM_CONFIGS[examName]?.passMark || 70;
      
      await addDoc(getUserDataPath('examAttempts'), {
        examName,
        score,
        totalQuestions,
        timeSpent,
        percentage,
        passed: percentage >= passMark,
        userId: user.uid,
        timestamp: serverTimestamp(),
      });
      
      console.log("✅ Quiz attempt saved successfully");
    } catch (e) {
      console.error("❌ Error adding exam attempt to Firestore:", e);
    }
  }, [user]);

  return { 
    quizzes, 
    userQuestions, 
    addQuizAttempt 
  };
};