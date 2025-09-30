// hooks/useAuth.js
// Custom hook for Firebase authentication (NO anonymous sign-in)

import { useState, useEffect, useCallback } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signInWithCustomToken,
  onAuthStateChanged, 
  signInWithPopup, 
  signOut 
} from 'firebase/auth';
import { auth, googleProvider } from '../config/firebaseConfig';

// Global variables for authentication (from Claude.ai artifact environment)
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    if (!auth) {
      setIsAuthReady(true);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      // Only attempt custom token sign-in if available and no user is signed in
      if (!currentUser && initialAuthToken) {
        try {
          await signInWithCustomToken(auth, initialAuthToken);
        } catch (error) {
          console.error("Custom token sign-in error:", error);
        }
      }
      
      setIsAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  // Google Sign-In
  const signInWithGoogle = useCallback(async () => {
    if (!auth || !googleProvider) {
      console.error("Auth or Google Provider not initialized");
      return;
    }
    
    try {
      const result = await signInWithPopup(auth, googleProvider);
      console.log("✅ Google sign-in successful:", result.user.email);
    } catch (error) {
      console.error("❌ Google Sign-In Error:", error);
      
      if (error.code === 'auth/popup-blocked') {
        alert('Popup was blocked. Please allow popups for this site and try again.');
      } else if (error.code === 'auth/popup-closed-by-user') {
        console.log("User closed the popup");
      } else {
        alert(`Sign-in failed: ${error.message}`);
      }
    }
  }, []);

  // Email/Password Sign-In
  const signInWithEmailPassword = useCallback(async (email, password) => {
    if (!auth) {
      throw new Error("Firebase Auth not initialized");
    }
    
    try {
      await signInWithEmailAndPassword(auth, email, password);
      console.log("✅ Email sign-in successful");
    } catch (error) {
      console.error("❌ Email sign-in error:", error);
      throw error;
    }
  }, []);

  // Create Account with Email/Password
  const createAccount = useCallback(async (email, password) => {
    if (!auth) {
      throw new Error("Firebase Auth not initialized");
    }
    
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      console.log("✅ Account created successfully:", userCredential.user.email);
    } catch (error) {
      console.error("❌ Account creation error:", error);
      throw error;
    }
  }, []);

  // Sign Out with fallback reload
  const handleSignOut = useCallback(async () => {
    if (!auth) return;
    
    try {
      await signOut(auth);
      console.log("✅ Sign out successful");
      
      // Force page reload to clear all state
      setTimeout(() => {
        window.location.reload();
      }, 100);
    } catch (error) {
      console.error("❌ Sign Out Error:", error);
      
      // Fallback: Force reload even if signOut fails
      window.location.reload();
    }
  }, []);

  return { 
    user, 
    isAuthReady, 
    signInWithGoogle, 
    signInWithEmailPassword, 
    createAccount, 
    handleSignOut 
  };
};