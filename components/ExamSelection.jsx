import { Loader2, Zap, Plus, CheckCircle, RefreshCw, Eye, Trash2 } from 'lucide-react';
import { EXAM_CONFIGS } from '../config/examConfig';
import { Button, Card } from './UIComponents';

export const ExamSelection = ({ 
  onStartQuiz, 
  quizzes, 
  isLoading, 
  error, 
  generateQuestions,
  onNewQuiz,
  onReviewPastExam,
  onDeleteAttempt
}) => {
  const handleDelete = async (examName, attemptId, e) => {
    e.stopPropagation(); // Prevent triggering review when clicking delete
    
    if (!confirm('Are you sure you want to delete this exam attempt? This action cannot be undone.')) {
      return;
    }

    try {
      await onDeleteAttempt(attemptId);
      console.log('✅ Exam attempt deleted successfully');
    } catch (error) {
      console.error('❌ Failed to delete exam attempt:', error);
      alert('Failed to delete exam attempt. Please try again.');
    }
  };

  return (
    <Card className="max-w-6xl mx-auto">
      <h2 className="text-3xl font-extrabold text-gray-800 mb-8 text-center">
        Select Your Salesforce Certification Exam
      </h2>

      {isLoading && (
        <div className="flex flex-col items-center justify-center p-10 bg-blue-50 rounded-xl mb-8">
          <Loader2 className="animate-spin text-blue-600" size={32} />
          <p className="mt-4 text-lg font-medium text-blue-700">Generating AI questions...</p>
          <p className="text-sm text-gray-500 mt-1">This may take up to 3 minutes for larger exams.</p>
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
                  {attempts.slice(0, 5).map((attempt, index) => {
                    const isPassed = attempt.passed;
                    const hasReviewData = attempt.hasReviewData;
                    const attemptNumber = attempts.length - index;
                    
                    return (
                      <div 
                        key={attempt.id || index} 
                        className={`p-3 rounded-lg border-2 transition-all relative group ${
                          hasReviewData 
                            ? 'border-blue-300 bg-white hover:border-blue-500 hover:shadow-md cursor-pointer' 
                            : 'border-gray-200 bg-gray-100 cursor-not-allowed'
                        }`}
                        onClick={() => hasReviewData && onReviewPastExam && onReviewPastExam(attempt)}
                        title={hasReviewData ? 'Click to review this exam attempt' : 'Review data not available'}
                      >
                        {/* Delete button - appears on hover */}
                        <button
                          onClick={(e) => handleDelete(examName, attempt.id, e)}
                          className="absolute top-2 right-2 p-1.5 bg-red-100 hover:bg-red-200 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Delete this attempt"
                        >
                          <Trash2 size={14} className="text-red-600" />
                        </button>

                        <div className="flex justify-between items-start mb-2 pr-8">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-600">
                              Attempt {attemptNumber}
                            </span>
                            {hasReviewData && (
                              <Eye size={14} className="text-blue-500" />
                            )}
                          </div>
                          <span className={`text-xs font-semibold px-2 py-1 rounded ${
                            isPassed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {isPassed ? 'PASSED' : 'FAILED'}
                          </span>
                        </div>
                        
                        <div className="flex justify-between items-center">
                          <span className={`text-lg font-bold ${
                            isPassed ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {attempt.percentage}%
                          </span>
                          <span className="text-xs text-gray-500">
                            {attempt.score}/{attempt.totalQuestions}
                          </span>
                        </div>
                        
                        {hasReviewData && (
                          <div className="mt-2 text-xs text-blue-600 flex items-center gap-1">
                            <Eye size={12} />
                            <span>Click to review</span>
                          </div>
                        )}
                        
                        {!hasReviewData && (
                          <div className="mt-2 text-xs text-gray-400">
                            Review not available
                          </div>
                        )}
                      </div>
                    );
                  })}
                  
                  {attempts.length > 5 && (
                    <p className="text-xs text-gray-400 text-center pt-2">
                      Showing 5 most recent attempts
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
};