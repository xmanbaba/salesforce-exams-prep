import { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, query, orderBy, serverTimestamp, addDoc } from 'firebase/firestore';

const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

let app = null;
let auth = null;
let db = null;

if (Object.keys(firebaseConfig).length > 0) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
}

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  useEffect(() => {
    if (!auth) {
      setIsDataLoaded(true);
      return;
    }
    const signIn = async () => {
      try {
        if (initialAuthToken) {
          await signInWithCustomToken(auth, initialAuthToken);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Firebase Auth Error:", error);
      }
    };
    
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      setUser(currentUser);
      if (!currentUser && !auth.currentUser) {
        signIn();
      } else {
        setIsDataLoaded(true);
      }
    });

    return () => unsubscribe();
  }, []);

  return { user, isDataLoaded };
};

export const useFirestore = (user) => {
  const [quizzes, setQuizzes] = useState([]);
  
  useEffect(() => {
    if (!db || !user) return;
    const userExamAttemptsPath = `artifacts/${appId}/users/${user.uid}/examAttempts`;
    const q = query(collection(db, userExamAttemptsPath), orderBy('timestamp', 'desc'));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const attempts = [];
      querySnapshot.forEach((doc) => {
        attempts.push({ id: doc.id, ...doc.data() });
      });
      setQuizzes(attempts);
    }, (error) => {
      console.error("Error fetching quizzes:", error);
    });
    
    return () => unsubscribe();
  }, [user]);

  const addQuizAttempt = async (examName, score, totalQuestions, userId) => {
    if (!db || !user) return;
    const userExamAttemptsPath = `artifacts/${appId}/users/${user.uid}/examAttempts`;
    try {
      await addDoc(collection(db, userExamAttemptsPath), {
        examName,
        score,
        totalQuestions,
        timestamp: serverTimestamp(),
        userId,
      });
    } catch (error) {
      console.error("Error saving quiz results to Firestore:", error);
    }
  };
  
  return { quizzes, addQuizAttempt };
};
