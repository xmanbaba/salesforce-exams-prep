import React, { useState, useEffect } from 'react';

const Quiz = ({ questions, answers, onAnswerChange, onSubmitQuiz, onBack }) => {
  const [timeLeft, setTimeLeft] = useState(600);
  const [showModal, setShowModal] = useState(false);

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
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleConfirmSubmit = () => {
    setShowModal(true);
  };
  
  const handleModalSubmit = () => {
    onSubmitQuiz();
    setShowModal(false);
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Quiz Time!</h2>
        <div className="text-lg font-bold text-gray-600">
          Time Left: {formatTime(timeLeft)}
        </div>
      </div>
      
      {questions.map((q, qIndex) => (
        <div key={qIndex} className="mb-6">
          <p className="font-semibold text-lg mb-2">{qIndex + 1}. {q.question}</p>
          <div className="space-y-2">
            {q.options.map((option, oIndex) => (
              <button
                key={oIndex}
                onClick={() => onAnswerChange(qIndex, option)}
                className={`block w-full text-left p-3 rounded-lg border transition ${
                  answers[qIndex] === option
                    ? 'bg-blue-200 border-blue-500'
                    : 'bg-gray-50 hover:bg-gray-100 border-gray-300'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      ))}
      
      <div className="flex justify-end mt-6 space-x-4">
        <button
          onClick={onBack}
          className="px-4 py-2 rounded-lg text-blue-600 border border-blue-600 hover:bg-blue-100 transition"
        >
          Back
        </button>
        <button
          onClick={handleConfirmSubmit}
          disabled={Object.keys(answers).length < questions.length}
          className="px-6 py-3 rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition disabled:opacity-50"
        >
          Submit Quiz
        </button>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center">
          <div className="relative p-8 bg-white w-96 rounded-lg shadow-xl">
            <h3 className="text-xl font-bold mb-4">Confirm Submission</h3>
            <p>Are you sure you want to submit your quiz?</p>
            <div className="flex justify-end space-x-4 mt-4">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg text-gray-600 border border-gray-300 hover:bg-gray-100 transition">Cancel</button>
              <button onClick={handleModalSubmit} className="px-4 py-2 rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition">Submit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Quiz;
