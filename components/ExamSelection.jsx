import { Loader2, Zap, Plus, CheckCircle, RefreshCw } from 'lucide-react';
import { EXAM_CONFIGS } from '../config/examConfig';
import { Button, Card } from './UIComponents';

export const ExamSelection = ({ 
  onStartQuiz, 
  quizzes, 
  isLoading, 
  error, 
  generateQuestions,
  onNewQuiz 
}) => {
  return (
    <Card className="max-w-6xl mx-auto">
      <h2 className="text-3xl font-extrabold text-gray-800 mb-8 text-center">
        Select Your Salesforce Certification Exam
      </h2>

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
          >
            <div className="p-6 h-full flex flex-col">
              <div className="flex items-center mb-4">
                <Zap size={24} className="text-blue-500 mr-3" />
                <h3 className="text-lg font-bold text-gray-800 leading-tight">
                  {examName}
                </h3>
              </div>
              <p className="text-sm text-gray-600 mb-4 flex-grow">
                {config.description}
              </p>
              
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

              <div className="space-y-2">
                <Button
                  onClick={() => generateQuestions(examName, false)}
                  className="w-full"
                  color="bg-blue-600 hover:bg-blue-700"
                  icon={Plus}
                  disabled={isLoading}
                >
                  Start Exam
                </Button>
                
                <Button
                  onClick={() => onNewQuiz(examName)}
                  className="w-full"
                  color="bg-green-600 hover:bg-green-700"
                  icon={RefreshCw}
                  disabled={isLoading}
                >
                  New Quiz
                </Button>
              </div>
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