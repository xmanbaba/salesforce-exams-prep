// hooks/useFirestore.js
// Fixed: Now saves complete question and answer data for review

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
          id: doc.id,
          // Ensure we have the review data
          hasReviewData: !!(attempt.questions && attempt.userAnswers)
        });
      });
      
      setQuizzes(attemptsByExam);
    }, (error) => {
      console.error("❌ Error fetching quiz attempts:", error);
    });

    return () => unsubscribe();
  }, [user]);

  // Add quiz attempt with COMPLETE data for review
  const addQuizAttempt = useCallback(async (examName, score, totalQuestions, timeSpent, questions, userAnswers) => {
    if (!user || !db) {
      console.error("❌ Cannot save: User not authenticated or DB unavailable");
      return;
    }

    try {
      const percentage = Math.round((score / totalQuestions) * 100);
      const passMark = EXAM_CONFIGS[examName]?.passMark || 70;
      
      const attemptData = {
        examName,
        score,
        totalQuestions,
        timeSpent,
        percentage,
        passed: percentage >= passMark,
        userId: user.uid,
        timestamp: serverTimestamp(),
        // Store complete question and answer data for review
        questions: questions || [],
        userAnswers: userAnswers || {}
      };
      
      await addDoc(getUserDataPath('examAttempts'), attemptData);
      
      console.log("✅ Quiz attempt saved with full review data");
    } catch (error) {
      console.error("❌ Error saving exam attempt:", error);
      throw error;
    }
  }, [user]);

  return { 
    quizzes, 
    addQuizAttempt 
  };
};