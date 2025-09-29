import { useState, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithCustomToken, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, query, addDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { Loader2, Zap, LogIn, User, ArrowLeft, RefreshCw, Upload, CheckCircle, XCircle, SquareGanttChart, Eye, EyeOff, Plus } from 'lucide-react';

// --- Global Variable Configuration (Fixed for Vite) ---
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Debug Firebase Configuration
console.log("Firebase Config Debug:", {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ? "✓ Found" : "✗ Missing",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ? "✓ Found" : "✗ Missing",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ? "✓ Found" : "✗ Missing",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ? "✓ Found" : "✗ Missing",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ? "✓ Found" : "✗ Missing",
  appId: import.meta.env.VITE_FIREBASE_APP_ID ? "✓ Found" : "✗ Missing",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID ? "✓ Found" : "✗ Missing"
});

console.log("Actual Config Values:", firebaseConfig);

const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
const modelName = import.meta.env.VITE_GEMINI_MODEL_NAME || "gemini-2.0-flash-exp";

console.log("Gemini Config:", {
  apiKey: apiKey ? "✓ Found" : "✗ Missing",
  modelName: modelName
});

// --- Exam Configuration ---
const EXAM_CONFIGS = {
  'Salesforce Associate Certification': {
    description: 'Platform Foundations - 40 questions, 62% pass mark',
    questionCount: 40,
    passMark: 62,
    timeLimit: 90, // minutes
  },
  'Salesforce Administrator Certification': {
    description: 'Admin Certification - 60 questions, 70% pass mark',
    questionCount: 60,
    passMark: 70,
    timeLimit: 120, // minutes
  },
  'Salesforce AI Agentforce': {
    description: 'AI and Agentforce - 40 questions, 70% pass mark',
    questionCount: 40,
    passMark: 70,
    timeLimit: 90, // minutes
  }
};

// --- Validate and Initialize Firebase ---
const validateFirebaseConfig = (config) => {
  const requiredFields = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
  const missingFields = requiredFields.filter(field => !config[field]);
  
  if (missingFields.length > 0) {
    console.error('Missing Firebase configuration fields:', missingFields);
    return false;
  }
  return true;
};

// Only initialize Firebase if configuration is valid
let app, db, auth, googleProvider;

if (validateFirebaseConfig(firebaseConfig)) {
  try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    
    // Configure Google provider
    googleProvider.setCustomParameters({
      prompt: 'select_account'
    });
    
    console.log("✅ Firebase initialized successfully");
  } catch (error) {
    console.error("❌ Firebase initialization failed:", error);
  }
} else {
  console.error("❌ Invalid Firebase configuration. Please check your environment variables.");
}

// --- Authentication Hook ---
const useAuth = () => {
  const [user, setUser] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    if (!auth) {
      setIsAuthReady(true);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setIsAuthReady(true);
      } else {
        try {
          if (initialAuthToken) {
            await signInWithCustomToken(auth, initialAuthToken);
          }
        } catch (error) {
          console.error("Firebase Auth Error:", error);
        }
        setIsAuthReady(true);
      }
    });
    return () => unsubscribe();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!auth) return;
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Google Sign-In Error:", error);
      if (error.code === 'auth/popup-blocked') {
        alert('Popup was blocked. Please allow popups for this site and try again.');
      }
    }
  }, []);

  const signInWithEmailPassword = useCallback(async (email, password) => {
    if (!auth) return;
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      throw error;
    }
  }, []);

  const createAccount = useCallback(async (email, password) => {
    if (!auth) return;
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (error) {
      throw error;
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    if (!auth) return;
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Sign Out Error:", error);
    }
  }, []);

  return { user, isAuthReady, signInWithGoogle, signInWithEmailPassword, createAccount, handleSignOut };
};

// --- Firestore Hook ---
const useFirestore = (user) => {
  const [quizzes, setQuizzes] = useState({});
  const [userQuestions, setUserQuestions] = useState([]);

  const getUserDataPath = (collectionName) => {
    const userId = user?.uid || 'anonymous';
    return collection(db, 'artifacts', appId, 'users', userId, collectionName);
  };

  useEffect(() => {
    if (!user || !db) return;
    const q = query(getUserDataPath('examAttempts'), orderBy('timestamp', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const attemptsByExam = {};
      snapshot.forEach(doc => {
        const attempt = doc.data();
        const examName = attempt.examName;
        if (!attemptsByExam[examName]) {
          attemptsByExam[examName] = [];
        }
        attemptsByExam[examName].push({ ...attempt, id: doc.id });
      });
      setQuizzes(attemptsByExam);
    }, (error) => {
      console.error("Error fetching quiz attempts:", error);
    });

    return () => unsubscribe();
  }, [user]);

  const addQuizAttempt = useCallback(async (examName, score, totalQuestions, timeSpent) => {
    if (!user || !db) {
      console.error("Cannot add attempt: User not authenticated or DB not available.");
      return;
    }
    try {
      await addDoc(getUserDataPath('examAttempts'), {
        examName,
        score,
        totalQuestions,
        timeSpent,
        percentage: Math.round((score / totalQuestions) * 100),
        passed: (score / totalQuestions) * 100 >= EXAM_CONFIGS[examName].passMark,
        userId: user.uid,
        timestamp: serverTimestamp(),
      });
    } catch (e) {
      console.error("Error adding document: ", e);
    }
  }, [user]);
  
  return { quizzes, userQuestions, addQuizAttempt };
};

// --- Enhanced Question Generation ---
const generateQuestions = async (examName, count) => {
  const examConfig = EXAM_CONFIGS[examName];
  
  const systemPrompt = `You are a certified ${examName} exam question generator. Create ${count} multiple-choice questions that accurately reflect real exam content.

REQUIREMENTS:
- Each question must have exactly 4 options (A, B, C, D)
- Questions should be at appropriate difficulty level for ${examName}
- Include detailed explanations (at least 2-3 sentences)
- Cover core topics relevant to ${examName}
- Use realistic scenarios and practical examples
- Ensure questions test understanding, not just memorization

For ${examName} specifically:
${examName === 'Salesforce Associate Certification' ? '- Focus on platform fundamentals, basic CRM concepts, and navigation' : ''}
${examName === 'Salesforce Administrator Certification' ? '- Cover advanced admin topics, complex workflows, security, and data management' : ''}
${examName === 'Salesforce AI Agentforce' ? '- Focus on AI capabilities, Einstein features, and Agentforce functionality' : ''}

Provide output as JSON array only.`;

  const userQuery = `Generate ${count} multiple-choice questions for ${examName}.`;
  
  const payload = {
      contents: [{ parts: [{ text: userQuery }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
              type: "ARRAY",
              items: {
                  type: "OBJECT",
                  properties: {
                      "question": { "type": "STRING", "description": "The full text of the question." },
                      "options": {
                          "type": "ARRAY",
                          "items": { "type": "STRING" },
                          "description": "An array of exactly 4 strings representing options A, B, C, and D."
                      },
                      "answer": { "type": "STRING", "description": "The correct option (A, B, C, or D)." },
                      "explanation": { "type": "STRING", "description": "A detailed explanation of why the answer is correct (at least 2-3 sentences)." }
                  },
                  "required": ["question", "options", "answer", "explanation"]
              }
          }
      },
      model: modelName
  };

  try {
      const apiUrl = `https://generativelanguage.googleapis.com/v1/models/${modelName}:generateContent?key=${apiKey}`;
      const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
      });

      if (!response.ok) {
          throw new Error(`API call failed with status: ${response.status}`);
      }
      
      const result = await response.json();
      const jsonText = result.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!jsonText) {
          throw new Error("Received empty response from Gemini API.");
      }

      const questionsArray = JSON.parse(jsonText);
      return questionsArray;
} catch (e) {
    console.error("Gemini Generation Error:", e);
    
    // Fallback questions when API fails
    console.log("Using fallback questions for", examName);
    
    const fallbackQuestions = {
      'Salesforce Associate Certification': [
        {
          question: "What is the primary purpose of Salesforce?",
          options: ["A. Customer Relationship Management", "B. Inventory Management", "C. Financial Planning", "D. Human Resources"],
          answer: "A",
          explanation: "Salesforce is primarily a Customer Relationship Management (CRM) platform designed to help businesses manage customer relationships, sales processes, and customer service interactions effectively."
        },
        {
          question: "Which standard object is used to track potential sales opportunities?",
          options: ["A. Account", "B. Contact", "C. Lead", "D. Opportunity"],
          answer: "D", 
          explanation: "The Opportunity object is specifically designed to track potential sales deals and revenue opportunities throughout the sales pipeline from initial qualification to closure."
        },
        {
          question: "What does CRM stand for?",
          options: ["A. Customer Resource Management", "B. Customer Relationship Management", "C. Client Relations Manager", "D. Customer Records Management"],
          answer: "B",
          explanation: "CRM stands for Customer Relationship Management, which is a strategy and technology for managing all company relationships and interactions with customers and potential customers."
        },
        {
          question: "Which tab in Salesforce shows a record's related information?",
          options: ["A. Details", "B. Related", "C. Activity", "D. News"],
          answer: "B",
          explanation: "The Related tab displays all related records, lists, and other information connected to the current record, providing a comprehensive view of associated data."
        },
        {
          question: "What is a Salesforce App?",
          options: ["A. A mobile application", "B. A collection of tabs and functionality", "C. A type of report", "D. A user profile"],
          answer: "B",
          explanation: "In Salesforce, an App is a collection of tabs that work together to provide functionality for a specific business process or department, accessible via the App Launcher."
        }
      ],
      'Salesforce Administrator Certification': [
        {
          question: "What is the difference between a Role and a Profile?",
          options: ["A. No difference", "B. Roles control data access, Profiles control feature access", "C. Profiles control data access, Roles control feature access", "D. Both control the same things"],
          answer: "B",
          explanation: "Roles determine what records a user can see through the role hierarchy and sharing rules, while Profiles determine what features, objects, and fields a user can access within Salesforce."
        },
        {
          question: "Which feature can prevent users from saving a record if certain conditions aren't met?",
          options: ["A. Workflow Rules", "B. Process Builder", "C. Validation Rules", "D. Flow"],
          answer: "C",
          explanation: "Validation Rules check data entered by users and prevent records from being saved if the data doesn't meet specified criteria, displaying custom error messages to guide users."
        },
        {
          question: "What are Organization-Wide Defaults (OWD) used for?",
          options: ["A. Setting user passwords", "B. Defining baseline record sharing", "C. Creating custom objects", "D. Managing user licenses"],
          answer: "B",
          explanation: "Organization-Wide Defaults establish the baseline level of access for records in your org, determining whether records are private, read-only, or read/write for users by default."
        },
        {
          question: "Which tool would you use to mass update records?",
          options: ["A. Data Import Wizard", "B. Data Loader", "C. Mass Update", "D. All of the above"],
          answer: "D",
          explanation: "All three tools can be used for mass updates: Data Import Wizard for simple updates via web interface, Data Loader for bulk operations, and Mass Update for updating multiple records from list views."
        },
        {
          question: "What happens when you delete a parent record in a Master-Detail relationship?",
          options: ["A. Child records remain unchanged", "B. Child records are also deleted", "C. Child records become orphaned", "D. System prevents deletion"],
          answer: "B",
          explanation: "In a Master-Detail relationship, deleting the parent record automatically deletes all associated child records, maintaining data integrity and preventing orphaned records."
        }
      ],
      'Salesforce AI Agentforce': [
        {
          question: "What is Einstein Analytics used for in Salesforce?",
          options: ["A. Creating chatbots", "B. Data visualization and advanced analytics", "C. Email automation", "D. Social media management"],
          answer: "B",
          explanation: "Einstein Analytics provides advanced data visualization, predictive analytics, and AI-powered insights to help users analyze business data and make informed decisions based on comprehensive dashboards and reports."
        },
        {
          question: "Which Einstein feature helps predict which leads are most likely to convert?",
          options: ["A. Einstein Activity Capture", "B. Einstein Lead Scoring", "C. Einstein Opportunity Insights", "D. Einstein Case Classification"],
          answer: "B",
          explanation: "Einstein Lead Scoring uses machine learning to analyze historical lead data and assign scores to leads based on their likelihood to convert, helping sales teams prioritize their efforts."
        },
        {
          question: "What is Salesforce Agentforce designed to do?",
          options: ["A. Replace human agents entirely", "B. Assist and augment human agents with AI", "C. Only handle simple inquiries", "D. Work only with phone calls"],
          answer: "B",
          explanation: "Salesforce Agentforce is designed to augment human agents with AI-powered capabilities, providing intelligent recommendations, automating routine tasks, and helping agents deliver better customer service."
        },
        {
          question: "Which Einstein feature automatically categorizes cases?",
          options: ["A. Einstein Case Routing", "B. Einstein Case Classification", "C. Einstein Case Prediction", "D. Einstein Case Analytics"],
          answer: "B",
          explanation: "Einstein Case Classification uses natural language processing to automatically categorize and route cases based on their content, improving efficiency and ensuring cases reach the right agents."
        },
        {
          question: "What does Einstein Discovery help with?",
          options: ["A. Creating reports", "B. Finding patterns and predicting outcomes", "C. Managing user permissions", "D. Designing page layouts"],
          answer: "B",
          explanation: "Einstein Discovery uses advanced analytics and machine learning to automatically find patterns in data, predict outcomes, and provide recommendations for business decisions and process improvements."
        }
      ]
    };
    
    const examQuestions = fallbackQuestions[examName] || [];
    return examQuestions;
}
};

// --- Components ---
const Button = ({ children, onClick, disabled, className = '', icon: Icon, color = 'bg-blue-600 hover:bg-blue-700' }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={`flex items-center justify-center space-x-2 px-6 py-3 rounded-xl font-semibold text-white transition duration-200 shadow-md ${color} disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
        {Icon && <Icon size={20} />}
        <span>{children}</span>
    </button>
);

const Card = ({ children, className = '' }) => (
    <div className={`bg-white p-6 md:p-8 rounded-2xl shadow-xl ${className}`}>
        {children}
    </div>
);

// --- Enhanced Authentication Screen ---
const AuthScreen = ({ signInWithGoogle, signInWithEmailPassword, createAccount }) => {
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
        'auth/invalid-email': 'Please enter a valid email address'
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
      <h2 className="text-3xl font-bold text-gray-800 mb-2 text-center">Welcome to Certification Prep</h2>
      <p className="text-gray-600 mb-6 text-center">Sign in to save your progress and access AI-generated exams.</p>
      
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

// --- Enhanced Exam Selection Component ---
const ExamSelection = ({ onStartQuiz, quizzes, isLoading, error, generateQuestions }) => {
    return (
        <Card className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-extrabold text-gray-800 mb-8 text-center">Select Your Certification Exam</h2>
            
            {isLoading && (
                <div className="flex flex-col items-center justify-center p-10 bg-blue-50 rounded-xl mb-8">
                    <Loader2 className="animate-spin text-blue-600" size={32} />
                    <p className="mt-4 text-lg font-medium text-blue-700">Generating AI questions...</p>
                    <p className="text-sm text-gray-500 mt-1">This may take up to 30 seconds.</p>
                </div>
            )}

            {error && (
                <div className="p-4 mb-8 bg-red-100 border-l-4 border-red-500 text-red-700 rounded-lg">
                    <p className="font-bold">Error Generating Quiz:</p>
                    <p className="text-sm">{error}</p>
                    <p className="mt-2 text-xs">Please try again or check your internet connection.</p>
                </div>
            )}

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
                {Object.entries(EXAM_CONFIGS).map(([examName, config]) => (
                    <div
                        key={examName}
                        className="border-2 border-gray-200 rounded-xl hover:border-blue-400 hover:shadow-lg transition-all duration-300 cursor-pointer bg-gradient-to-br from-white to-gray-50"
                        onClick={() => generateQuestions(examName)}
                    >
                        <div className="p-6 h-full flex flex-col">
                            <div className="flex items-center mb-4">
                                <Zap size={24} className="text-blue-500 mr-3" />
                                <h3 className="text-lg font-bold text-gray-800 leading-tight">{examName}</h3>
                            </div>
                            
                            <p className="text-sm text-gray-600 mb-4 flex-grow">{config.description}</p>
                            
                            <div className="space-y-2 mb-4">
                                <div className="flex justify-between text-xs text-gray-500">
                                    <span>Questions:</span>
                                    <span className="font-semibold">{config.questionCount}</span>
                                </div>
                                <div className="flex justify-between text-xs text-gray-500">
                                    <span>Pass Mark:</span>
                                    <span className="font-semibold">{config.passMark}%</span>
                                </div>
                                <div className="flex justify-between text-xs text-gray-500">
                                    <span>Time Limit:</span>
                                    <span className="font-semibold">{config.timeLimit} min</span>
                                </div>
                            </div>
                            
                            <Button 
                                className="w-full" 
                                color="bg-blue-600 hover:bg-blue-700"
                                icon={Plus}
                            >
                                Start Exam
                            </Button>
                        </div>
                    </div>
                ))}
            </div>

            <div className="border-t pt-8">
                <h3 className="text-2xl font-bold text-gray-700 mb-6">Your Recent Exam History</h3>
                {Object.keys(quizzes).length === 0 ? (
                    <div className="text-center py-8">
                        <div className="text-gray-400 mb-4">
                            <CheckCircle size={48} className="mx-auto" />
                        </div>
                        <p className="text-gray-500 text-lg">No exam attempts yet</p>
                        <p className="text-gray-400 text-sm">Start an exam above to see your progress here</p>
                    </div>
                ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {Object.entries(quizzes).map(([examName, attempts]) => (
                            <div key={examName} className="p-4 bg-gray-50 rounded-lg border">
                                <h4 className="font-semibold text-gray-700 mb-3">{examName}</h4>
                                <div className="space-y-2">
                                    {attempts.slice(0, 3).map((attempt, index) => {
                                        const isPassed = attempt.passed;
                                        
                                        return (
                                            <div key={index} className="flex justify-between items-center text-sm">
                                                <span>Attempt {attempts.length - index}:</span>
                                                <div className="text-right">
                                                    <span className={`font-bold ${isPassed ? 'text-green-600' : 'text-red-600'}`}>
                                                        {attempt.percentage}%
                                                    </span>
                                                    <div className="text-xs text-gray-500">
                                                        {attempt.score}/{attempt.totalQuestions}
                                                        {isPassed ? ' ✓ PASSED' : ' ✗ FAILED'}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </Card>
    );
};

// --- Enhanced Quiz Component with Timer ---
const Quiz = ({ questions, answers, onAnswerChange, onSubmitQuiz, onBack, examName }) => {
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [timeLeft, setTimeLeft] = useState(EXAM_CONFIGS[examName].timeLimit * 60); // Convert to seconds
    const [showConfirm, setShowConfirm] = useState(false);

    const question = questions[currentQuestion];
    const isLastQuestion = currentQuestion === questions.length - 1;

    // Timer effect
    useEffect(() => {
        if (timeLeft <= 0) {
            onSubmitQuiz();
            return;
        }

        const timer = setInterval(() => {
            setTimeLeft(prev => prev - 1);
        }, 1000);

        return () => clearInterval(timer);
    }, [timeLeft, onSubmitQuiz]);

    const formatTime = (seconds) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    };

    const getTimeColor = () => {
        if (timeLeft < 300) return 'text-red-600'; // Less than 5 minutes
        if (timeLeft < 900) return 'text-yellow-600'; // Less than 15 minutes
        return 'text-green-600';
    };

    const handleNext = () => {
        if (!isLastQuestion) {
            setCurrentQuestion(prev => prev + 1);
        }
    };

    const handlePrev = () => {
        if (currentQuestion > 0) {
            setCurrentQuestion(prev => prev - 1);
        }
    };

    const handleSubmit = () => {
        setShowConfirm(true);
    };

    const answeredCount = Object.keys(answers).length;
    const progressPercentage = (answeredCount / questions.length) * 100;

    if (!question) return <div className="text-center p-8 text-lg text-red-500">Quiz data is missing.</div>;

    return (
        <div className="max-w-4xl mx-auto">
            {/* Header with timer and progress */}
            <Card className="mb-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-xl font-bold text-gray-800">{examName}</h1>
                        <p className="text-sm text-gray-600">Question {currentQuestion + 1} of {questions.length}</p>
                    </div>
                    <div className="text-right">
                        <div className={`text-2xl font-bold ${getTimeColor()}`}>
                            {formatTime(timeLeft)}
                        </div>
                        <p className="text-xs text-gray-500">Time Remaining</p>
                    </div>
                </div>
                
                {/* Progress Bar */}
                <div className="mt-4">
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                        <span>Progress</span>
                        <span>{answeredCount}/{questions.length} answered</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${progressPercentage}%` }}
                        ></div>
                    </div>
                </div>
            </Card>

            {/* Question Card */}
            <Card className="mb-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-6">
                    Question {currentQuestion + 1}
                </h2>
                
                <div className="p-4 bg-blue-50 border-l-4 border-blue-500 rounded-lg mb-8">
                    <p className="text-lg leading-relaxed">{question.question}</p>
                </div>

                <div className="space-y-3">
                    {question.options.map((option, index) => {
                        const optionKey = ['A', 'B', 'C', 'D'][index]; 
                        const isSelected = answers[currentQuestion] === optionKey;

                        return (
                            <div
                                key={optionKey}
                                className={`p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 ${
                                    isSelected 
                                        ? 'border-blue-500 bg-blue-50 shadow-md' 
                                        : 'border-gray-200 hover:border-blue-300 bg-white hover:shadow-sm'
                                }`}
                                onClick={() => onAnswerChange(currentQuestion, optionKey)}
                            >
                                <div className="flex items-center">
                                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mr-4 ${
                                        isSelected 
                                            ? 'border-blue-500 bg-blue-500' 
                                            : 'border-gray-300'
                                    }`}>
                                        {isSelected && <div className="w-2 h-2 bg-white rounded-full"></div>}
                                    </div>
                                    <span className={`font-bold mr-3 ${isSelected ? 'text-blue-600' : 'text-gray-600'}`}>
                                        {optionKey}.
                                    </span>
                                    <span className="text-gray-700 flex-1">{option}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </Card>

            {/* Navigation */}
            <Card>
                <div className="flex justify-between items-center">
                    <Button 
                        onClick={onBack} 
                        color="bg-gray-400 hover:bg-gray-500" 
                        icon={ArrowLeft}
                    >
                        Exit Exam
                    </Button>

                    <div className="flex space-x-3">
                        <Button 
                            onClick={handlePrev} 
                            disabled={currentQuestion === 0} 
                            color="bg-indigo-500 hover:bg-indigo-600"
                        >
                            Previous
                        </Button>
                        
                        {isLastQuestion ? (
                            <Button 
                                onClick={handleSubmit} 
                                color="bg-green-600 hover:bg-green-700"
                            >
                                Submit Exam
                            </Button>
                        ) : (
                            <Button 
                                onClick={handleNext} 
                                color="bg-blue-600 hover:bg-blue-700"
                            >
                                Next
                            </Button>
                        )}
                    </div>
                </div>
            </Card>

            {/* Confirmation Modal */}
            {showConfirm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <Card className="max-w-md mx-4">
                        <h3 className="text-xl font-bold mb-4">Submit Exam?</h3>
                        <p className="text-gray-600 mb-2">
                            You have answered {answeredCount} out of {questions.length} questions.
                        </p>
                        {answeredCount < questions.length && (
                            <p className="text-orange-600 text-sm mb-4">
                                ⚠️ You have {questions.length - answeredCount} unanswered questions.
                            </p>
                        )}
                        <p className="text-gray-600 mb-6">
                            Are you sure you want to submit your exam?
                        </p>
                        <div className="flex space-x-3 justify-end">
                            <Button 
                                onClick={() => setShowConfirm(false)} 
                                color="bg-gray-400 hover:bg-gray-500"
                            >
                                Continue Exam
                            </Button>
                            <Button 
                                onClick={onSubmitQuiz} 
                                color="bg-green-600 hover:bg-green-700"
                            >
                                Submit Now
                            </Button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
};

// --- Enhanced Results Component ---
const Results = ({ score, totalQuestions, questions, answers, onBackToDashboard, onRestart, examName, timeSpent }) => {
    const percentage = ((score / totalQuestions) * 100).toFixed(0);
    const config = EXAM_CONFIGS[examName];
    const passed = percentage >= config.passMark;
    const resultColor = passed ? 'text-green-600' : 'text-red-600';

    return (
        <div className="max-w-6xl mx-auto">
            {/* Results Summary */}
            <Card className="mb-8">
                <div className="text-center pb-6 border-b">
                    <h2 className="text-4xl font-extrabold text-gray-800 mb-2">Exam Results</h2>
                    <h3 className="text-xl text-gray-600 mb-4">{examName}</h3>
                    
                    <div className="grid md:grid-cols-3 gap-6 mb-6">
                        <div className="text-center">
                            <p className="text-6xl font-black mb-2" style={{ color: passed ? '#10B981' : '#EF4444' }}>
                                {percentage}%
                            </p>
                            <p className="text-gray-600">Final Score</p>
                        </div>
                        <div className="text-center">
                            <p className="text-3xl font-bold text-gray-700 mb-2">
                                {score}/{totalQuestions}
                            </p>
                            <p className="text-gray-600">Questions Correct</p>
                        </div>
                        <div className="text-center">
                            <p className="text-3xl font-bold text-gray-700 mb-2">
                                {Math.floor(timeSpent / 60)}:{(timeSpent % 60).toString().padStart(2, '0')}
                            </p>
                            <p className="text-gray-600">Time Taken</p>
                        </div>
                    </div>

                    <div className={`inline-flex items-center px-6 py-3 rounded-full text-lg font-bold ${
                        passed 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                    }`}>
                        {passed ? (
                            <>
                                <CheckCircle size={24} className="mr-2" />
                                PASSED - Congratulations!
                            </>
                        ) : (
                            <>
                                <XCircle size={24} className="mr-2" />
                                NOT PASSED - Keep studying!
                            </>
                        )}
                    </div>
                    
                    {!passed && (
                        <p className="text-sm text-gray-600 mt-2">
                            You need {config.passMark}% to pass. You were {(config.passMark - percentage).toFixed(0)}% away.
                        </p>
                    )}
                </div>

                <div className="flex justify-center space-x-4 mt-6">
                    <Button 
                        onClick={onBackToDashboard} 
                        color="bg-gray-500 hover:bg-gray-600" 
                        icon={ArrowLeft}
                    >
                        Back to Dashboard
                    </Button>
                    <Button 
                        onClick={onRestart} 
                        color="bg-blue-600 hover:bg-blue-700" 
                        icon={RefreshCw}
                    >
                        Retake Exam
                    </Button>
                </div>
            </Card>

            {/* Detailed Review */}
            <Card>
                <h3 className="text-2xl font-bold text-gray-800 mb-6">Detailed Answer Review</h3>
                <div className="space-y-6">
                    {questions.map((q, index) => {
                        const userAnswer = answers[index];
                        const isCorrect = userAnswer === q.answer;

                        return (
                            <div key={index} className={`p-6 rounded-xl border-l-4 ${
                                isCorrect 
                                    ? 'border-green-500 bg-green-50' 
                                    : 'border-red-500 bg-red-50'
                            }`}>
                                <div className="flex items-start mb-4">
                                    {isCorrect ? (
                                        <CheckCircle size={24} className="text-green-600 mt-1 mr-3 flex-shrink-0" />
                                    ) : (
                                        <XCircle size={24} className="text-red-600 mt-1 mr-3 flex-shrink-0" />
                                    )}
                                    <div className="flex-1">
                                        <h4 className="font-semibold text-lg text-gray-800 mb-2">
                                            Question {index + 1}
                                        </h4>
                                        <p className="text-gray-700 mb-4">{q.question}</p>
                                        
                                        <div className="grid md:grid-cols-2 gap-4 mb-4">
                                            <div>
                                                <p className="text-sm font-medium text-gray-600">Your Answer:</p>
                                                <p className={`font-bold ${isCorrect ? 'text-green-700' : 'text-red-700'}`}>
                                                    {userAnswer || 'No answer selected'}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-gray-600">Correct Answer:</p>
                                                <p className="font-bold text-green-700">{q.answer}</p>
                                            </div>
                                        </div>
                                        
                                        <div className="p-4 bg-white border rounded-lg">
                                            <h5 className="font-semibold text-gray-800 mb-2">Explanation:</h5>
                                            <p className="text-gray-700 leading-relaxed">{q.explanation}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </Card>
        </div>
    );
};

// --- Main Application Component ---
function App() {
  const { user, isAuthReady, signInWithGoogle, signInWithEmailPassword, createAccount, handleSignOut } = useAuth();
  const { quizzes, addQuizAttempt } = useFirestore(user);

  const [exam, setExam] = useState(null);
  const [currentPage, setCurrentPage] = useState('selection');
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [score, setScore] = useState(0);
  const [examStartTime, setExamStartTime] = useState(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleStartQuiz = useCallback((examName, newQuestions) => {
    setExam(examName);
    setQuestions(newQuestions || []);
    setAnswers({});
    setScore(0);
    setExamStartTime(Date.now());
    setCurrentPage('quiz');
  }, []);

  const handleGenerateQuestions = useCallback(async (examName) => {
    setIsLoading(true);
    setError(null);
    try {
        const config = EXAM_CONFIGS[examName];
        const generatedQuestions = await generateQuestions(examName, config.questionCount);
        handleStartQuiz(examName, generatedQuestions); 
    } catch (e) {
        console.error("Quiz generation failed:", e);
        setError(`Failed to create quiz: ${e.message}. Please check your API configuration and try again.`);
    } finally {
        setIsLoading(false);
    }
  }, [handleStartQuiz]);
  
  const handleSubmitQuiz = useCallback(async () => {
    const finalScore = questions.reduce((acc, q, index) => {
      if (answers[index] === q.answer) {
        return acc + 1;
      }
      return acc;
    }, 0);

    const timeSpent = Math.floor((Date.now() - examStartTime) / 1000); // in seconds
    
    setScore(finalScore);
    if (user && db) {
        await addQuizAttempt(exam, finalScore, questions.length, timeSpent);
    }
    setCurrentPage('results');
  }, [answers, exam, questions, addQuizAttempt, user, examStartTime]);

  const handleRestartQuiz = useCallback(() => {
    setAnswers({});
    setExamStartTime(Date.now());
    setCurrentPage('quiz');
  }, []);

  const handleAnswerChange = useCallback((qIndex, option) => {
    setAnswers(prev => ({ ...prev, [qIndex]: option }));
  }, []);

  const renderPage = () => {
    if (!isAuthReady) {
      return (
        <div className="text-center p-8">
          <Loader2 className="animate-spin mx-auto mb-4" size={48} />
          <p className="text-xl font-semibold text-gray-600">Initializing Application...</p>
        </div>
      );
    }
    
    if (!user) {
        return (
          <AuthScreen 
            signInWithGoogle={signInWithGoogle} 
            signInWithEmailPassword={signInWithEmailPassword}
            createAccount={createAccount}
          />
        );
    }

    switch (currentPage) {
      case 'selection':
        return (
            <ExamSelection 
                onStartQuiz={handleStartQuiz} 
                quizzes={quizzes} 
                isLoading={isLoading}
                error={error}
                generateQuestions={handleGenerateQuestions}
            />
        );
      case 'quiz':
        return (
          <Quiz
            questions={questions}
            answers={answers}
            onAnswerChange={handleAnswerChange}
            onSubmitQuiz={handleSubmitQuiz}
            onBack={() => setCurrentPage('selection')}
            examName={exam}
          />
        );
      case 'results':
        return (
          <Results
            score={score}
            totalQuestions={questions.length}
            questions={questions}
            answers={answers}
            onBackToDashboard={() => setCurrentPage('selection')}
            onRestart={handleRestartQuiz}
            examName={exam}
            timeSpent={Math.floor((Date.now() - examStartTime) / 1000)}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 md:p-8 font-sans">
      <header className="flex justify-between items-center bg-white p-4 md:p-6 rounded-2xl shadow-xl mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800 flex items-center">
            <Zap className="text-blue-500 mr-2" size={30} />
            Salesforce Certification Prep
        </h1>
        {user && (
          <nav className="flex items-center space-x-4">
            <span className="text-sm text-gray-600 hidden sm:inline">
                {user.isAnonymous ? 'Guest User' : user.displayName || user.email}
            </span>
            {currentPage !== 'selection' && (
                <button 
                  onClick={() => setCurrentPage('selection')} 
                  className="px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition text-sm"
                >
                  Dashboard
                </button>
            )}
            <button 
              onClick={handleSignOut} 
              className="px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-white bg-red-500 hover:bg-red-600 transition text-sm"
            >
              Sign Out
            </button>
          </nav>
        )}
      </header>
      <main>
        {renderPage()}
      </main>
      <footer className="mt-8 text-center text-gray-500 text-xs md:text-sm">
        <p>© 2025 Salesforce Certification Prep - AI-Powered Learning Platform</p>
      </footer>
    </div>
  );
}

export default App;