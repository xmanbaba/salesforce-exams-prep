import { useState, useEffect } from 'react';
import { ArrowLeft, AlertTriangle, Pause } from 'lucide-react';
import { EXAM_CONFIGS } from '../config/examConfig';
import { Button, Card } from './UIComponents';

export const Quiz = ({ 
  questions, 
  answers, 
  currentQuestion: initialQuestion,
  onCurrentQuestionChange,
  initialTimeLeft,
  onAnswerChange, 
  onSubmitQuiz, 
  onPauseExam,
  onBack, 
  examName,
  isResuming
}) => {
  const [currentQuestion, setCurrentQuestion] = useState(initialQuestion || 0);
  const [timeLeft, setTimeLeft] = useState(initialTimeLeft || EXAM_CONFIGS[examName].timeLimit * 60);
  const [showConfirm, setShowConfirm] = useState(false);
  const [unansweredQuestions, setUnansweredQuestions] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const question = questions[currentQuestion];
  const isLastQuestion = currentQuestion === questions.length - 1;

  // Update parent component when current question changes
  useEffect(() => {
    if (onCurrentQuestionChange) {
      onCurrentQuestionChange(currentQuestion);
    }
  }, [currentQuestion, onCurrentQuestionChange]);

  // Timer effect
  useEffect(() => {
    if (timeLeft <= 0) {
      handleFinalSubmit();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

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
    if (timeLeft < 300) return 'text-red-600';
    if (timeLeft < 900) return 'text-yellow-600';
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

  const handleJumpToQuestion = (index) => {
    setCurrentQuestion(index);
  };

  const handleSubmit = () => {
    const unanswered = [];
    for (let i = 0; i < questions.length; i++) {
      if (!answers[i]) {
        unanswered.push(i + 1);
      }
    }
    setUnansweredQuestions(unanswered);
    setShowConfirm(true);
  };

  const handleFinalSubmit = async () => {
    if (isSubmitting) {
      console.log('⚠️ Submit already in progress, ignoring duplicate click');
      return;
    }

    setIsSubmitting(true);
    console.log('📝 Submitting quiz...');
    
    try {
      await onSubmitQuiz();
      console.log('✅ Quiz submitted successfully');
    } catch (error) {
      console.error('❌ Error submitting quiz:', error);
      setIsSubmitting(false);
    }
  };

  // Manual Pause Handler
  const handleManualPause = () => {
    console.log('⏸️ Manual pause button clicked');
    onPauseExam(currentQuestion, answers, timeLeft);
  };

  const answeredCount = Object.keys(answers).length;
  const progressPercentage = (answeredCount / questions.length) * 100;

  const getQuestionStatus = (index) => {
    if (index === currentQuestion) return 'current';
    if (answers[index]) return 'answered';
    return 'unanswered';
  };

  if (!question) {
    return (
      <div className="text-center p-8 text-lg text-red-500">
        Quiz data is missing.
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Resumed Banner */}
      {isResuming && (
        <div className="mb-4 p-3 bg-green-50 border-l-4 border-green-500 rounded-lg">
          <p className="text-green-800 font-semibold">
            📂 Exam Resumed - Continue where you left off!
          </p>
        </div>
      )}

      {/* Header with timer and progress */}
      <Card className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-800">{examName}</h1>
            <p className="text-sm text-gray-600">
              Question {currentQuestion + 1} of {questions.length}
            </p>
          </div>
          <div className="text-right">
            <div className={`text-2xl font-bold ${getTimeColor()}`}>
              {formatTime(timeLeft)}
            </div>
            <p className="text-xs text-gray-500">Time Remaining</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
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

        {/* Question Navigator Grid */}
        <div className="border-t pt-4">
          <p className="text-xs text-gray-600 mb-2 font-medium">Question Navigator (click to jump):</p>
          <div className="grid grid-cols-10 gap-2">
            {questions.map((_, index) => {
              const status = getQuestionStatus(index);
              return (
                <button
                  key={index}
                  onClick={() => handleJumpToQuestion(index)}
                  className={`
                    w-full aspect-square rounded-lg font-semibold text-sm transition-all
                    ${status === 'current' 
                      ? 'bg-blue-600 text-white ring-2 ring-blue-400 ring-offset-2' 
                      : status === 'answered'
                      ? 'bg-green-500 text-white hover:bg-green-600'
                      : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                    }
                  `}
                  title={`Question ${index + 1} - ${status === 'answered' ? 'Answered' : 'Not answered'}`}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>
          <div className="flex gap-4 text-xs text-gray-600 mt-3">
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 bg-blue-600 rounded"></div>
              <span>Current</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 bg-green-500 rounded"></div>
              <span>Answered</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 bg-gray-200 rounded"></div>
              <span>Unanswered</span>
            </div>
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
          <div className="flex space-x-3">
            <Button
              onClick={onBack}
              color="bg-gray-400 hover:bg-gray-500"
              icon={ArrowLeft}
              disabled={isSubmitting}
            >
              Exit Exam
            </Button>

            <Button
              onClick={handleManualPause}
              color="bg-orange-500 hover:bg-orange-600"
              icon={Pause}
              disabled={isSubmitting}
            >
              Pause & Save
            </Button>
          </div>

          <div className="flex space-x-3">
            <Button
              onClick={handlePrev}
              disabled={currentQuestion === 0 || isSubmitting}
              color="bg-indigo-500 hover:bg-indigo-600"
            >
              Previous
            </Button>
            
            {isLastQuestion ? (
              <Button
                onClick={handleSubmit}
                color="bg-green-600 hover:bg-green-700"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Exam'}
              </Button>
            ) : (
              <Button
                onClick={handleNext}
                color="bg-blue-600 hover:bg-blue-700"
                disabled={isSubmitting}
              >
                Next
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Confirmation Modal with Unanswered Warning */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">Submit Exam?</h3>
            <p className="text-gray-600 mb-2">
              You have answered {answeredCount} out of {questions.length} questions.
            </p>
            
            {unansweredQuestions.length > 0 && (
              <div className="my-4 p-4 bg-orange-50 border-l-4 border-orange-500 rounded">
                <div className="flex items-start gap-2 mb-2">
                  <AlertTriangle className="text-orange-600 flex-shrink-0 mt-0.5" size={20} />
                  <div>
                    <p className="font-semibold text-orange-800">
                      {unansweredQuestions.length} Unanswered Question{unansweredQuestions.length > 1 ? 's' : ''}
                    </p>
                    <p className="text-sm text-orange-700 mt-1">
                      Questions: {unansweredQuestions.slice(0, 10).join(', ')}
                      {unansweredQuestions.length > 10 && '...'}
                    </p>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-2 mt-3">
                  {unansweredQuestions.slice(0, 15).map(qNum => (
                    <button
                      key={qNum}
                      onClick={() => {
                        setShowConfirm(false);
                        handleJumpToQuestion(qNum - 1);
                      }}
                      className="px-3 py-1 bg-orange-200 hover:bg-orange-300 text-orange-800 rounded-lg text-sm font-semibold transition"
                    >
                      Q{qNum}
                    </button>
                  ))}
                  {unansweredQuestions.length > 15 && (
                    <span className="px-3 py-1 text-orange-600 text-sm">
                      +{unansweredQuestions.length - 15} more
                    </span>
                  )}
                </div>
              </div>
            )}
            
            <p className="text-gray-600 mb-6">
              Are you sure you want to submit your exam?
            </p>
            
            <div className="flex space-x-3 justify-end">
              <Button
                onClick={() => {
                  setShowConfirm(false);
                  setUnansweredQuestions([]);
                }}
                color="bg-gray-400 hover:bg-gray-500"
                disabled={isSubmitting}
              >
                Continue Exam
              </Button>
              <Button
                onClick={handleFinalSubmit}
                color="bg-green-600 hover:bg-green-700"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Now'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};