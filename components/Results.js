import React from 'react';

const Results = ({ score, totalQuestions, questions, answers, onBackToDashboard, onRestart }) => {
  const percentage = Math.round((score / totalQuestions) * 100);

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">Quiz Results</h2>
      <div className="text-center mb-6">
        <p className="text-lg">Your Score:</p>
        <p className="text-4xl font-extrabold text-blue-600">{score} / {totalQuestions}</p>
        <p className="text-lg font-semibold text-gray-700">({percentage}%)</p>
      </div>
      
      <h3 className="text-xl font-bold mb-4">Answer Explanations</h3>
      <div className="space-y-6">
        {questions.map((q, qIndex) => (
          <div key={qIndex} className="p-4 rounded-lg bg-gray-50">
            <p className="font-semibold">{qIndex + 1}. {q.question}</p>
            <div className="mt-2">
              <p className={`font-medium ${answers[qIndex] === q.answer ? 'text-green-600' : 'text-red-600'}`}>
                Your Answer: {answers[qIndex] || 'No answer selected'}
              </p>
              <p className="font-medium text-green-600">
                Correct Answer: {q.answer}
              </p>
            </div>
            <p className="mt-2 text-sm text-gray-600">{q.explanation}</p>
          </div>
        ))}
      </div>
      
      <div className="flex justify-end mt-8 space-x-4">
        <button onClick={onRestart} className="px-4 py-2 rounded-lg text-blue-600 border border-blue-600 hover:bg-blue-100 transition">
          Take Again
        </button>
        <button onClick={onBackToDashboard} className="px-4 py-2 rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition">
          Back to Dashboard
        </button>
      </div>
    </div>
  );
};

export default Results;
