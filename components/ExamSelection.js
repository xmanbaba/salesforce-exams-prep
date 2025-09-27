import React from 'react';

const ExamSelection = ({ onStartQuiz, quizzes }) => {
  const latestQuizzes = quizzes.slice(0, 5);
  
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold mb-4">Start a New Quiz</h2>
        <div className="flex flex-col space-y-4">
          <button onClick={() => onStartQuiz('Salesforce Associate')} className="w-full px-4 py-2 rounded-lg text-white bg-indigo-500 hover:bg-indigo-600 transition">Salesforce Associate</button>
          <button onClick={() => onStartQuiz('Salesforce Admin Exams')} className="w-full px-4 py-2 rounded-lg text-white bg-teal-500 hover:bg-teal-600 transition">Salesforce Admin Exams</button>
          <button onClick={() => onStartQuiz('Salesforce AI Agentforce')} className="w-full px-4 py-2 rounded-lg text-white bg-purple-500 hover:bg-purple-600 transition">Salesforce AI Agentforce</button>
        </div>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-md md:col-span-1 lg:col-span-2">
        <h2 className="text-2xl font-bold mb-4">Recent Quiz History</h2>
        {latestQuizzes.length > 0 ? (
          <ul className="divide-y divide-gray-200">
            {latestQuizzes.map(q => (
              <li key={q.id} className="py-4 flex justify-between items-center">
                <div>
                  <div className="font-semibold">{q.examName}</div>
                  <div className="text-sm text-gray-500">
                    {q.timestamp?.toDate().toLocaleString()}
                  </div>
                </div>
                <div className="text-lg font-bold">
                  {q.score} / {q.totalQuestions}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500">No quizzes completed yet.</p>
        )}
      </div>
    </div>
  );
};

export default ExamSelection;
