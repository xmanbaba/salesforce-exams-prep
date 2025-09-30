// components/AuthScreen.jsx
// Authentication screen with email/password and Google sign-in

import { useState } from 'react';
import { Loader2, Eye, EyeOff, SquareGanttChart } from 'lucide-react';
import { auth } from '../config/firebaseConfig';
import { Button, Card } from './UIComponents';

export const AuthScreen = ({ signInWithGoogle, signInWithEmailPassword, createAccount }) => {
  const [authMode, setAuthMode] = useState('signin'); // 'signin' or 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleEmailAuth = async (e) => {
    e.preventDefault();

    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      if (authMode === 'signin') {
        await signInWithEmailPassword(email, password);
      } else {
        await createAccount(email, password);
      }
    } catch (error) {
      console.error('Auth error:', error);
      
      const errorMessages = {
        'auth/user-not-found': 'No account found with this email address',
        'auth/wrong-password': 'Incorrect password',
        'auth/email-already-in-use': 'An account with this email already exists',
        'auth/weak-password': 'Password should be at least 6 characters',
        'auth/invalid-email': 'Please enter a valid email address',
        'auth/operation-not-allowed': 'Email/password accounts are currently disabled. Please use Google sign-in or contact support.',
        'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
        'auth/invalid-credential': 'Invalid email or password. Please try again.'
      };
      
      setError(errorMessages[error.code] || 'Authentication failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!auth) {
    return (
      <Card className="max-w-md mx-auto text-center mt-20">
        <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          <p className="font-bold">Configuration Error</p>
          <p className="text-sm">Firebase is not properly configured. Please check your environment variables.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="max-w-md mx-auto mt-20">
      <h2 className="text-3xl font-bold text-gray-800 mb-2 text-center">
        Welcome to Salesforce Certification Prep
      </h2>
      <p className="text-gray-600 mb-6 text-center">
        Sign in to save your progress and access AI-generated exams.
      </p>

      {/* Email/Password Form */}
      <form onSubmit={handleEmailAuth} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter your email"
            disabled={isLoading}
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your password"
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
            {error}
          </div>
        )}

        <Button
          type="submit"
          disabled={isLoading || !email || !password}
          className="w-full"
          color="bg-blue-600 hover:bg-blue-700"
        >
          {isLoading ? (
            <>
              <Loader2 className="animate-spin" size={20} />
              <span>{authMode === 'signin' ? 'Signing In...' : 'Creating Account...'}</span>
            </>
          ) : (
            <span>{authMode === 'signin' ? 'Sign In' : 'Create Account'}</span>
          )}
        </Button>
      </form>

      <div className="mt-4 text-center">
        <button
          onClick={() => {
            setAuthMode(authMode === 'signin' ? 'signup' : 'signin');
            setError('');
          }}
          className="text-blue-600 hover:text-blue-800 text-sm"
          disabled={isLoading}
        >
          {authMode === 'signin'
            ? "Don't have an account? Create one"
            : "Already have an account? Sign in"
          }
        </button>
      </div>

      <div className="mt-6 relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white text-gray-500">Or continue with</span>
        </div>
      </div>

      <Button
        onClick={signInWithGoogle}
        icon={SquareGanttChart}
        color="bg-red-600 hover:bg-red-700"
        className="w-full mt-4"
        disabled={isLoading}
      >
        Sign In with Google
      </Button>
    </Card>
  );
};