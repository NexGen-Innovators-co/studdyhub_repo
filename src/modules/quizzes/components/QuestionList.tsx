import React from 'react';

// Props: questions, playerProgress, onSelectQuestion
interface QuestionListProps {
  questions: Array<{ id: string; question_text: string; question_index: number }>;
  playerProgress: Array<{ question_index: number; status: string }>;
  currentQuestionIndex: number;
  onSelectQuestion: (index: number) => void;
}

const QuestionList: React.FC<QuestionListProps> = ({ questions, playerProgress, currentQuestionIndex, onSelectQuestion }) => {
  const statusClasses: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-600 border-gray-200',
    answered: 'bg-green-100 text-green-700 border-green-200',
    correct: 'bg-green-100 text-green-700 border-green-200',
    incorrect: 'bg-red-100 text-red-700 border-red-200',
    timeout: 'bg-amber-100 text-amber-700 border-amber-200',
  };

  return (
    <aside className="space-y-2">
      <ul className="space-y-2">
        {questions.map((q, idx) => {
          const progress = playerProgress.find(p => p.question_index === q.question_index);
          const status = progress?.status || 'pending';
          const isActive = currentQuestionIndex === idx;
          return (
            <li key={q.id}>
              <button
                type="button"
                onClick={() => onSelectQuestion(idx)}
                className={`w-full flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                  isActive ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <span className="font-medium">Q{q.question_index + 1}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${statusClasses[status] || statusClasses.pending}`}>
                  {status}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
};

export default QuestionList;
