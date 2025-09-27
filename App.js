import { useState, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, query, addDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { Loader2, Zap, LogIn, User, ArrowLeft, RefreshCw, Upload, CheckCircle, XCircle, SquareGanttChart } from 'lucide-react';

// --- Global Variable Configuration ---
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const apiKey = ""; // API key for Gemini is automatically provided by the Canvas environment

// --- Initialization ---
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// --- Firestore Hooks/Functions ---

/**
 * Custom hook for Firebase Authentication state management.
 */
const useAuth = () => {
  const [user, setUser] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        // Attempt custom token sign-in if available, otherwise sign in anonymously
        try {
          if (initialAuthToken) {
            await signInWithCustomToken(auth, initialAuthToken);
          } else {
            await signInAnonymously(auth);
          }
        } catch (error) {
          console.error("Firebase Auth Error:", error);
          // Fallback if anonymous sign-in fails
          setUser(null);
        }
      }
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Google Sign-In Error:", error);
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Sign Out Error:", error);
    }
  }, []);

  return { user, isAuthReady, signInWithGoogle, handleSignOut };
};

/**
 * Custom hook for Firestore data and operations.
 */
const useFirestore = (user) => {
  const [quizzes, setQuizzes] = useState({});
  const [userQuestions, setUserQuestions] = useState([]);

  // Collection reference for public data (Pre-set exams)
  const presetQuizzesRef = collection(db, 'artifacts', appId, 'public', 'data', 'presetExams');
  
  // User-specific collection references
  const getUserDataPath = (collectionName) => {
    const userId = user?.uid || 'anonymous';
    return collection(db, 'artifacts', appId, 'users', userId, collectionName);
  };

  // 1. Listen for User Quiz Attempts
  useEffect(() => {
    if (!user) return;
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

  // 2. Listen for User-Uploaded/Generated Questions (for file upload feature later)
  useEffect(() => {
    if (!user) return;
    const q = query(getUserDataPath('questions'), orderBy('timestamp', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const questions = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      setUserQuestions(questions);
    }, (error) => {
      console.error("Error fetching user questions:", error);
    });

    return () => unsubscribe();
  }, [user]);

  const addQuizAttempt = useCallback(async (examName, score, totalQuestions) => {
    if (!user) {
      console.error("Cannot add attempt: User not authenticated.");
      return;
    }
    try {
      await addDoc(getUserDataPath('examAttempts'), {
        examName,
        score,
        totalQuestions,
        userId: user.uid,
        timestamp: serverTimestamp(),
      });
    } catch (e) {
      console.error("Error adding document: ", e);
    }
  }, [user]);
  
  return { quizzes, userQuestions, addQuizAttempt };
};

// --- API Functions (Gemini) ---

/**
 * Generates quiz questions using the Gemini API.
 * @param {string} topic The subject matter for the quiz (e.g., 'Salesforce Administrator').
 * @param {number} count The number of questions to generate.
 */
const generateQuestions = async (topic, count = 5) => {
  const systemPrompt = `You are a certified exam question generator. Your task is to create ${count} multiple-choice questions about the topic "${topic}". Each question must have exactly 4 options (A, B, C, D) and a single correct answer. Provide the output only as a JSON array that strictly adheres to the provided schema. Do not include any introductory or concluding text.`;

  const userQuery = `Generate ${count} multiple-choice questions for the exam: ${topic}.`;
  
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
                      "explanation": { "type": "STRING", "description": "A brief explanation of why the answer is correct." }
                  },
                  "required": ["question", "options", "answer", "explanation"]
              }
          }
      },
      model: "gemini-2.5-flash-preview-05-20"
  };

  try {
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
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

      // The API response is a stringified JSON array
      const questionsArray = JSON.parse(jsonText);
      return questionsArray;

  } catch (e) {
      console.error("Gemini Generation Error:", e);
      throw new Error(`Failed to generate questions: ${e.message}`);
  }
};


// --- Components (Consolidated) ---

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

// --- ExamSelection Component (Integrated) ---
const ExamSelection = ({ onStartQuiz, quizzes, isLoading, error, generateQuestions }) => {
    const presetExams = {
        'Salesforce Administrator': '5 questions on core Salesforce Admin topics.',
        'Gemini AI Agentforce Exam': '5 AI-generated questions on Gemini Agents and SDKs.',
        'Gemini Salesforce Admin Exam': '5 AI-generated questions on advanced Salesforce Admin topics.',
    };

    const handleSelectExam = async (examName) => {
        // If it's a Gemini-generated exam, call the API first
        if (examName.includes('Gemini')) {
            await generateQuestions(examName);
        } else {
            // For hardcoded/preset exams (currently hardcoded dummy data)
            // In a real app, this would fetch from a database.
            // Since we merged, we'll use a placeholder structure for non-gemini exams
            const dummyQuestions = [
                { question: "What is the primary function of a Profile in Salesforce?", options: ["A. Defines data access.", "B. Manages user sessions.", "C. Controls record visibility.", "D. Assigns licenses."], answer: "A", explanation: "Profiles control object and field permissions." },
                { question: "Which feature can enforce data entry standards for a record?", options: ["A. Workflow Rule", "B. Validation Rule", "C. Process Builder", "D. Flow"], answer: "B", explanation: "Validation rules check data before saving and display error messages." },
                { question: "Where do you manage sharing settings for records?", options: ["A. Profile", "B. Role Hierarchy", "C. Organization-Wide Defaults", "D. Permission Set"], answer: "C", explanation: "Organization-Wide Defaults (OWD) are the baseline for sharing." },
                { question: "How many apps can a user be assigned?", options: ["A. One", "B. Five", "C. Unlimited", "D. Depends on the license"], answer: "C", explanation: "Users can access any app they have permissions for." },
                { question: "What is the difference between a Role and a Profile?", options: ["A. Role defines access, Profile defines data visibility.", "B. Role defines data visibility, Profile defines access.", "C. Role is for security, Profile is for communication.", "D. They are functionally identical.",], answer: "B", explanation: "Role controls record access via hierarchy and sharing, Profile controls object/field access." },
            ];
            onStartQuiz(examName, dummyQuestions);
        }
    };

    return (
        <Card className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-extrabold text-gray-800 mb-6">Select an Exam</h2>
            
            {isLoading && (
                <div className="flex flex-col items-center justify-center p-10 bg-blue-50 rounded-xl">
                    <Loader2 className="animate-spin text-blue-600" size={32} />
                    <p className="mt-4 text-lg font-medium text-blue-700">Generating questions with Gemini...</p>
                    <p className="text-sm text-gray-500 mt-1">This may take up to 30 seconds.</p>
                </div>
            )}

            {error && (
                <div className="p-4 mb-4 bg-red-100 border-l-4 border-red-500 text-red-700 rounded-lg">
                    <p className="font-bold">Error Generating Quiz:</p>
                    <p className="text-sm">{error}</p>
                    <p className="mt-2 text-xs">Please try again or select a different exam.</p>
                </div>
            )}

            <div className="grid md:grid-cols-2 gap-6">
                {Object.entries(presetExams).map(([name, description]) => (
                    <div
                        key={name}
                        className="p-5 border-2 border-gray-100 rounded-xl hover:border-blue-400 transition cursor-pointer flex flex-col justify-between h-full"
                        onClick={() => handleSelectExam(name)}
                    >
                        <div>
                            <h3 className="text-xl font-bold text-gray-700 flex items-center">
                                {name.includes('Gemini') ? <Zap size={20} className="text-yellow-500 mr-2" /> : <CheckCircle size={20} className="text-green-500 mr-2" />}
                                {name}
                            </h3>
                            <p className="text-sm text-gray-500 mt-2">{description}</p>
                        </div>
                        <div className="mt-4">
                            <Button className="w-full" color="bg-blue-600 hover:bg-blue-700">
                                Start Quiz
                            </Button>
                        </div>
                    </div>
                ))}
            </div>

            <h3 className="text-xl font-bold text-gray-700 mt-10 mb-4 border-t pt-6">Your Recent Quiz History</h3>
            {Object.keys(quizzes).length === 0 ? (
                <p className="text-gray-500">No recent quiz attempts found. Start an exam!</p>
            ) : (
                <div className="space-y-3">
                    {Object.entries(quizzes).map(([examName, attempts]) => (
                        <div key={examName} className="p-4 bg-gray-50 rounded-lg border">
                            <h4 className="font-semibold text-gray-700">{examName}</h4>
                            <div className="text-sm text-gray-600 mt-1 space-y-1">
                                {attempts.slice(0, 3).map((attempt, index) => (
                                    <p key={index} className="flex justify-between">
                                        <span>Attempt {attempts.length - index}:</span>
                                        <span className={`font-bold ${attempt.score / attempt.totalQuestions > 0.6 ? 'text-green-600' : 'text-red-600'}`}>
                                            {attempt.score}/{attempt.totalQuestions}
                                        </span>
                                    </p>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </Card>
    );
};


// --- Quiz Component (Integrated) ---
const Quiz = ({ questions, answers, onAnswerChange, onSubmitQuiz, onBack }) => {
    const [currentQuestion, setCurrentQuestion] = useState(0);

    const question = questions[currentQuestion];
    const isLastQuestion = currentQuestion === questions.length - 1;

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
        // Simple confirmation before submitting (since alerts are not allowed)
        if (window.confirm("Are you sure you want to submit the quiz?")) {
            onSubmitQuiz();
        }
    };

    if (!question) return <div className="text-center p-8 text-lg text-red-500">Quiz data is missing.</div>;

    return (
        <Card className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Question {currentQuestion + 1} of {questions.length}</h2>
            
            <p className="text-lg font-medium mb-8 p-4 bg-gray-50 border-l-4 border-blue-500 rounded-lg">{question.question}</p>

            <div className="space-y-4">
                {question.options.map((option, index) => {
                    // Options are assumed to be strings. We determine A, B, C, D based on index.
                    const optionKey = ['A', 'B', 'C', 'D'][index]; 
                    const isSelected = answers[currentQuestion] === optionKey;

                    return (
                        <div
                            key={optionKey}
                            className={`p-4 border-2 rounded-xl cursor-pointer transition ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300 bg-white'}`}
                            onClick={() => onAnswerChange(currentQuestion, optionKey)}
                        >
                            <span className={`font-bold mr-3 ${isSelected ? 'text-blue-600' : 'text-gray-600'}`}>{optionKey}.</span>
                            <span className="text-gray-700">{option}</span>
                        </div>
                    );
                })}
            </div>

            <div className="flex justify-between mt-8 pt-6 border-t border-gray-100">
                <Button onClick={onBack} color="bg-gray-400 hover:bg-gray-500" icon={ArrowLeft}>Back to Dashboard</Button>

                <div className="flex space-x-3">
                    <Button 
                        onClick={handlePrev} 
                        disabled={currentQuestion === 0} 
                        color="bg-indigo-500 hover:bg-indigo-600"
                    >
                        Previous
                    </Button>
                    
                    {isLastQuestion ? (
                        <Button onClick={handleSubmit} color="bg-green-600 hover:bg-green-700">Submit Quiz</Button>
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
    );
};

// --- Results Component (Integrated) ---
const Results = ({ score, totalQuestions, questions, answers, onBackToDashboard, onRestart }) => {
    const percentage = ((score / totalQuestions) * 100).toFixed(0);
    const passed = percentage >= 70; // 70% is common passing score
    const resultColor = passed ? 'text-green-600' : 'text-red-600';

    return (
        <Card className="max-w-4xl mx-auto">
            <div className="text-center mb-8 pb-6 border-b">
                <h2 className="text-4xl font-extrabold text-gray-800 mb-2">Quiz Results</h2>
                <p className="text-xl text-gray-600">You scored <span className={resultColor}>{score} out of {totalQuestions}</span></p>
                <p className="text-6xl font-black mt-4" style={{ color: passed ? '#10B981' : '#EF4444' }}>{percentage}%</p>
            </div>

            <div className="flex justify-center space-x-4 mb-8">
                <Button onClick={onBackToDashboard} color="bg-gray-500 hover:bg-gray-600" icon={ArrowLeft}>
                    Back to Dashboard
                </Button>
                <Button onClick={onRestart} color="bg-indigo-600 hover:bg-indigo-700" icon={RefreshCw}>
                    Try Quiz Again
                </Button>
            </div>

            <h3 className="text-2xl font-bold text-gray-800 mb-4">Review Your Answers</h3>
            <div className="space-y-6">
                {questions.map((q, index) => {
                    const userAnswer = answers[index];
                    const isCorrect = userAnswer === q.answer;

                    return (
                        <div key={index} className={`p-4 rounded-xl border-l-4 ${isCorrect ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}`}>
                            <p className="font-semibold text-lg flex items-start">
                                {isCorrect ? <CheckCircle size={20} className="text-green-600 mt-1 mr-2 flex-shrink-0" /> : <XCircle size={20} className="text-red-600 mt-1 mr-2 flex-shrink-0" />}
                                Q{index + 1}: {q.question}
                            </p>
                            <p className="mt-2 text-sm text-gray-700">
                                Your Answer: <span className="font-bold">{userAnswer || 'N/A'}</span>
                            </p>
                            <p className="text-sm text-gray-700">
                                Correct Answer: <span className="font-bold text-green-700">{q.answer}</span>
                            </p>
                            <p className="mt-2 text-xs p-2 rounded bg-white border">
                                **Explanation:** {q.explanation}
                            </p>
                        </div>
                    );
                })}
            </div>
        </Card>
    );
};


// --- Main Application Component ---
function App() {
  const { user, isAuthReady, signInWithGoogle, handleSignOut } = useAuth();
  const { quizzes, addQuizAttempt } = useFirestore(user);

  const [exam, setExam] = useState(null);
  const [currentPage, setCurrentPage] = useState('selection');
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [score, setScore] = useState(0);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleStartQuiz = useCallback((examName, newQuestions) => {
    setExam(examName);
    setQuestions(newQuestions || []);
    setAnswers({});
    setScore(0);
    setCurrentPage('quiz');
  }, []);

  const handleGenerateQuestions = useCallback(async (examName) => {
    setIsLoading(true);
    setError(null);
    try {
        const generatedQuestions = await generateQuestions(examName, 5); // Request 5 questions
        
        // Pass the generated questions to start the quiz
        handleStartQuiz(examName, generatedQuestions); 
        
    } catch (e) {
        console.error("Quiz generation failed:", e);
        setError(`Failed to create quiz: ${e.message}. Please check console for details.`);
    } finally {
        setIsLoading(false);
    }
  }, [handleStartQuiz]);
  
  const handleSubmitQuiz = useCallback(async () => {
    const finalScore = questions.reduce((acc, q, index) => {
      // Find the correct answer key (A, B, C, D)
      if (answers[index] === q.answer) {
        return acc + 1;
      }
      return acc;
    }, 0);

    setScore(finalScore);
    if (user) {
        await addQuizAttempt(exam, finalScore, questions.length);
    }
    setCurrentPage('results');
  }, [answers, exam, questions, addQuizAttempt, user]);

  const handleRestartQuiz = useCallback(() => {
    // Reload the current set of questions
    setAnswers({});
    setCurrentPage('quiz');
  }, []);

  const handleAnswerChange = useCallback((qIndex, option) => {
    setAnswers(prev => ({ ...prev, [qIndex]: option }));
  }, []);

  const renderPage = () => {
    if (!isAuthReady) {
      return <div className="text-center p-8 text-xl font-semibold text-gray-600">Initializing Application...</div>;
    }
    
    // Show login/signup screen if not authenticated
    if (!user) {
        return <AuthScreen signInWithGoogle={signInWithGoogle} />;
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
          />
        );
      default:
        return null;
    }
  };

  const AuthScreen = ({ signInWithGoogle }) => (
      <Card className="max-w-md mx-auto text-center mt-20">
          <h2 className="text-3xl font-bold text-gray-800 mb-4">Welcome to Exam Prep</h2>
          <p className="text-gray-600 mb-6">Sign in to save your progress and access AI-generated exams.</p>
          <Button onClick={signInWithGoogle} icon={SquareGanttChart} color="bg-red-600 hover:bg-red-700" className="w-full">
              Sign In with Google
          </Button>
          <Button onClick={() => auth.currentUser ? null : signInAnonymously(auth)} icon={LogIn} color="bg-gray-500 hover:bg-gray-600" className="w-full mt-3">
              Continue Anonymously
          </Button>
      </Card>
  );

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 font-sans">
      <header className="flex justify-between items-center bg-white p-4 md:p-6 rounded-2xl shadow-xl mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800 flex items-center">
            <Zap className="text-blue-500 mr-2" size={30} />
            AI Salesforce Exam Prep
        </h1>
        {user && (
          <nav className="flex items-center space-x-4">
            <span className="text-sm text-gray-600 hidden sm:inline">
                {user.isAnonymous ? 'Guest User' : user.displayName || user.email}
            </span>
            {currentPage !== 'selection' && (
                <button onClick={() => setCurrentPage('selection')} className="px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition text-sm">Dashboard</button>
            )}
            <button onClick={handleSignOut} className="px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-white bg-red-500 hover:bg-red-600 transition text-sm">Sign Out</button>
          </nav>
        )}
      </header>
      <main>
        {renderPage()}
      </main>
      <footer className="mt-8 text-center text-gray-500 text-xs md:text-sm">
        <p>Current User ID: {user?.uid || 'Not authenticated'}</p>
        <p>App ID: {appId}</p>
      </footer>
    </div>
  );
}

export default App;
