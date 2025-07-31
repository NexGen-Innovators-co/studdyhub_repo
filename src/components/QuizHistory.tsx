// components/QuizHistory.tsx
import React from 'react';
import { Quiz } from '../types/Class';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { formatDate } from '../utils/helpers';
import { BookOpen, History } from 'lucide-react';

interface QuizHistoryProps {
  quizzes: Quiz[];
  onSelectQuiz: (quiz: Quiz) => void;
}

export const QuizHistory: React.FC<QuizHistoryProps> = ({ quizzes, onSelectQuiz }) => {
  return (
    <div className="space-y-4">
      <h3 className="text-xl font-bold text-slate-800 dark:text-gray-100 flex items-center gap-2">
        <History className="h-6 w-6 text-blue-600" />
        Quiz History
      </h3>

      {quizzes.length === 0 ? (
        <Card className="text-center py-8 dark:bg-gray-800 dark:border-gray-700">
          <CardContent>
            <BookOpen className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-500 mb-2 dark:text-gray-300">No quizzes generated yet</h3>
            <p className="text-gray-400">Generate a quiz from a class recording to see it here!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {quizzes.map((quiz) => (
            <Card key={quiz.id} className="hover:shadow-md transition-shadow dark:bg-gray-800 dark:border-gray-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold text-slate-800 dark:text-gray-100">{quiz.title}</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between pt-0">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Generated on: {formatDate(new Date(quiz.createdAt))}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onSelectQuiz(quiz)}
                  className="text-blue-600 border-blue-200 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-700 dark:hover:bg-blue-700"
                >
                  View Quiz
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
