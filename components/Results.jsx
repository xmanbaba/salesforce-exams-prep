import { ArrowLeft, RefreshCw, CheckCircle, XCircle, BookOpen } from 'lucide-react';
import { EXAM_CONFIGS } from '../config/examConfig';
import { Button, Card } from './UIComponents';

export const Results = ({ 
  score, 
  totalQuestions, 
  questions, 
  answers, 
  onBackToDashboard, 
  onRestart, 
  examName, 
  timeSpent,
  isReviewMode = false
}) => {
  const percentage = ((score / totalQuestions) * 100).toFixed(0);
  const config = EXAM_CONFIGS[examName];
  const passed = percentage >= config.passMark;

  // Helper function to get the option text for a given letter
  const getOptionText = (question, optionLetter) => {
    const optionIndex = ['A', 'B', 'C', 'D'].indexOf(optionLetter);
    return optionIndex !== -1 ? question.options[optionIndex] : 'No answer selected';
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Review Mode Banner */}
      {isReviewMode && (
        <Card className="mb-6 bg-blue-50 border-2 border-blue-300">
          <div className="flex items-center gap-3">
            <BookOpen className="text-blue-600" size={28} />
            <div>
              <h3 className="text-lg font-bold text-blue-900">📖 Review Mode - Past Exam Attempt</h3>
              <p className="text-sm text-blue-700">
                You are reviewing a previously completed exam. Scroll down to see your answers and explanations.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Results Summary */}
      <Card className="mb-8">
        <div className="text-center pb-6 border-b">
          <h2 className="text-4xl font-extrabold text-gray-800 mb-2">
            {isReviewMode ? 'Exam Review' : 'Exam Results'}
          </h2>
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
            passed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
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
          {!isReviewMode && (
            <Button
              onClick={onRestart}
              color="bg-blue-600 hover:bg-blue-700"
              icon={RefreshCw}
            >
              Retake Exam
            </Button>
          )}
        </div>
      </Card>

      {/* Detailed Review */}
      <Card>
        <h3 className="text-2xl font-bold text-gray-800 mb-6">Detailed Answer Review</h3>
        
        <div className="space-y-6">
          {questions.map((q, index) => {
            const userAnswer = answers[index];
            const isCorrect = userAnswer === q.answer;
            const userAnswerText = userAnswer ? getOptionText(q, userAnswer) : 'No answer selected';
            const correctAnswerText = getOptionText(q, q.answer);
            
            return (
              <div key={index} className={`p-6 rounded-xl border-l-4 ${
                isCorrect ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'
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

                    {/* Side-by-side comparison */}
                    <div className="grid md:grid-cols-2 gap-4 mb-4">
                      <div className="p-4 bg-white border rounded-lg">
                        <p className="text-sm font-medium text-gray-600 mb-2">Your Answer:</p>
                        <div className="space-y-1">
                          <p className={`font-bold text-sm ${isCorrect ? 'text-green-700' : 'text-red-700'}`}>
                            {userAnswer || 'No selection'}
                          </p>
                          <p className={`text-sm ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                            {userAnswerText}
                          </p>
                        </div>
                      </div>
                      
                      <div className="p-4 bg-white border rounded-lg">
                        <p className="text-sm font-medium text-gray-600 mb-2">Correct Answer:</p>
                        <div className="space-y-1">
                          <p className="font-bold text-green-700 text-sm">{q.answer}</p>
                          <p className="text-green-600 text-sm">{correctAnswerText}</p>
                        </div>
                      </div>
                    </div>

                    {/* All options display for context */}
                    <div className="mb-4">
                      <p className="text-sm font-medium text-gray-600 mb-2">All Options:</p>
                      <div className="grid gap-2">
                        {q.options.map((option, optIndex) => {
                          const optionLetter = ['A', 'B', 'C', 'D'][optIndex];
                          const isUserChoice = userAnswer === optionLetter;
                          const isCorrectChoice = q.answer === optionLetter;
                          
                          return (
                            <div key={optIndex} className={`p-2 rounded text-sm flex items-center ${
                              isCorrectChoice 
                                ? 'bg-green-100 border border-green-300' 
                                : isUserChoice && !isCorrect
                                ? 'bg-red-100 border border-red-300'
                                : 'bg-gray-50'
                            }`}>
                              <span className="font-semibold mr-2">{optionLetter}.</span>
                              <span>{option}</span>
                              {isCorrectChoice && <span className="ml-auto text-green-600">✓ Correct</span>}
                              {isUserChoice && !isCorrect && <span className="ml-auto text-red-600">✗ Your choice</span>}
                            </div>
                          );
                        })}
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