// hooks/useFirestore.js
// COMPLETE VERSION: Added pause/resume functionality + delete + 7-day cleanup

import { useState, useEffect, useCallback } from 'react';
import { 
  collection, 
  query, 
  addDoc, 
  deleteDoc,
  doc,
  setDoc,
  getDoc,
  serverTimestamp, 
  orderBy, 
  onSnapshot,
  where,
  getDocs
} from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { EXAM_CONFIGS } from '../config/examConfig';

// App ID from Claude.ai artifact environment
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

export const useFirestore = (user) => {
  const [quizzes, setQuizzes] = useState({});
  const [pausedExams, setPausedExams] = useState([]);

  // Helper to get user-specific data path
  const getUserDataPath = (collectionName) => {
    const userId = user?.uid || 'anonymous';
    return collection(db, 'artifacts', appId, 'users', userId, collectionName);
  };

  // Automatic 7-day cleanup
  const cleanupOldAttempts = useCallback(async () => {
    if (!user || !db) return;

    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // Cleanup completed attempts
      const attemptsRef = getUserDataPath('examAttempts');
      const oldAttemptsQuery = query(
        attemptsRef,
        where('timestamp', '<', sevenDaysAgo)
      );

      const attemptsSnapshot = await getDocs(oldAttemptsQuery);
      
      // Cleanup paused exams
      const pausedRef = getUserDataPath('pausedExams');
      const oldPausedQuery = query(
        pausedRef,
        where('pausedAt', '<', sevenDaysAgo)
      );

      const pausedSnapshot = await getDocs(oldPausedQuery);

      const totalOld = attemptsSnapshot.size + pausedSnapshot.size;

      if (totalOld === 0) {
        console.log('✅ No old data to clean up');
        return;
      }

      console.log(`🧹 Found ${totalOld} old records (${attemptsSnapshot.size} attempts, ${pausedSnapshot.size} paused), deleting...`);

      const deletePromises = [
        ...attemptsSnapshot.docs.map(docSnapshot => deleteDoc(doc(db, docSnapshot.ref.path))),
        ...pausedSnapshot.docs.map(docSnapshot => deleteDoc(doc(db, docSnapshot.ref.path)))
      ];

      await Promise.all(deletePromises);
      console.log(`✅ Deleted ${totalOld} old records`);
    } catch (error) {
      console.error('❌ Error cleaning up old data:', error);
    }
  }, [user]);

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
          hasReviewData: !!(attempt.questions && attempt.userAnswers)
        });
      });
      
      setQuizzes(attemptsByExam);
    }, (error) => {
      console.error('❌ Error fetching quiz attempts:', error);
    });

    return () => unsubscribe();
  }, [user]);

  // Listen to paused exams in real-time
  useEffect(() => {
    if (!user || !db) return;

    const q = query(
      getUserDataPath('pausedExams'),
      orderBy('pausedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const paused = [];
      
      snapshot.forEach(doc => {
        paused.push({
          ...doc.data(),
          id: doc.id
        });
      });

      setPausedExams(paused);
      console.log(`📊 Loaded ${paused.length} paused exam(s)`);
    }, (error) => {
      console.error('❌ Error fetching paused exams:', error);
    });

    // Run cleanup on mount
    cleanupOldAttempts();

    return () => unsubscribe();
  }, [user, cleanupOldAttempts]);

  // Add completed quiz attempt
  const addQuizAttempt = useCallback(async (examName, score, totalQuestions, timeSpent, questions, userAnswers) => {
    if (!user || !db) {
      console.error('❌ Cannot save: User not authenticated or DB unavailable');
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
        questions: questions || [],
        userAnswers: userAnswers || {}
      };
      
      await addDoc(getUserDataPath('examAttempts'), attemptData);
      
      console.log('✅ Quiz attempt saved with full review data');
    } catch (error) {
      console.error('❌ Error saving exam attempt:', error);
      throw error;
    }
  }, [user]);

  // Save paused exam (or update existing)
  const savePausedExam = useCallback(async (examName, currentQuestion, answers, timeLeft, questions, examStartTime) => {
    if (!user || !db) {
      console.error('❌ Cannot save paused exam: User not authenticated');
      return null;
    }

    try {
      const pausedData = {
        examName,
        currentQuestion,
        answers,
        timeLeft,
        questions,
        examStartTime,
        userId: user.uid,
        pausedAt: serverTimestamp(),
        totalQuestions: questions.length,
        answeredCount: Object.keys(answers).length
      };

      // Use examName as document ID to ensure only one paused exam per exam type
      const pausedRef = doc(getUserDataPath('pausedExams'), examName.replace(/\s+/g, '_'));
      await setDoc(pausedRef, pausedData);

      console.log(`✅ Paused exam saved: ${examName} at question ${currentQuestion + 1}`);
      return pausedRef.id;
    } catch (error) {
      console.error('❌ Error saving paused exam:', error);
      throw error;
    }
  }, [user]);

  // Load paused exam
  const loadPausedExam = useCallback(async (examName) => {
    if (!user || !db) {
      console.error('❌ Cannot load paused exam: User not authenticated');
      return null;
    }

    try {
      const pausedRef = doc(getUserDataPath('pausedExams'), examName.replace(/\s+/g, '_'));
      const pausedDoc = await getDoc(pausedRef);

      if (pausedDoc.exists()) {
        console.log(`✅ Loaded paused exam: ${examName}`);
        return {
          id: pausedDoc.id,
          ...pausedDoc.data()
        };
      }

      console.log(`⚠️ No paused exam found for: ${examName}`);
      return null;
    } catch (error) {
      console.error('❌ Error loading paused exam:', error);
      throw error;
    }
  }, [user]);

  // Delete paused exam
  const deletePausedExam = useCallback(async (examName) => {
    if (!user || !db) {
      console.error('❌ Cannot delete paused exam: User not authenticated');
      return;
    }

    try {
      const pausedRef = doc(getUserDataPath('pausedExams'), examName.replace(/\s+/g, '_'));
      await deleteDoc(pausedRef);
      console.log(`✅ Deleted paused exam: ${examName}`);
    } catch (error) {
      console.error('❌ Error deleting paused exam:', error);
      throw error;
    }
  }, [user]);

  // Delete individual completed attempt
  const deleteAttempt = useCallback(async (attemptId) => {
    if (!user || !db) {
      console.error('❌ Cannot delete: User not authenticated or DB unavailable');
      return;
    }

    if (!attemptId) {
      console.error('❌ Cannot delete: No attempt ID provided');
      return;
    }

    try {
      const userId = user.uid;
      const attemptRef = doc(db, 'artifacts', appId, 'users', userId, 'examAttempts', attemptId);
      
      await deleteDoc(attemptRef);
      console.log('✅ Exam attempt deleted successfully');
    } catch (error) {
      console.error('❌ Error deleting exam attempt:', error);
      throw error;
    }
  }, [user]);

  return { 
    quizzes, 
    pausedExams,
    addQuizAttempt,
    deleteAttempt,
    savePausedExam,
    loadPausedExam,
    deletePausedExam
  };
};