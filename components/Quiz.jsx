import { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { EXAM_CONFIGS } from '../config/examConfig';
import { Button, Card } from './UIComponents';

export const Quiz = ({ 
  questions, 
  answers, 
  onAnswerChange, 
  onSubmitQuiz, 
  onBack, 
  examName 
}) => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [timeLeft, setTimeLeft] = useState(EXAM_CONFIGS[examName].timeLimit * 60);
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

  if (!question) {
    return (
      <div className="text-center p-8 text-lg text-red-500">
        Quiz data is missing.
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header with timer and progress */}
      <Card className="mb-6">
        <div className="flex justify-between items-center">
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