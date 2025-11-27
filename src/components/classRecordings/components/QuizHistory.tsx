// components/QuizHistory.tsx
import React from 'react';
import { Quiz } from '../../../types/Class';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { formatDate } from '../utils/helpers';
import { Lightbulb, BookOpen } from 'lucide-react';

interface QuizHistoryProps {
  quizzes: Quiz[];
  onSelectQuiz: (quiz: Quiz) => void;
}

export const QuizHistory: React.FC<QuizHistoryProps> = ({ quizzes, onSelectQuiz }) => {
  return (
    <div className="grid gap-4">
      {Array.isArray(quizzes) && quizzes.length > 0 ? (
        quizzes.map((quiz) => (
          <Card key={quiz.id} className="hover:shadow-md transition-shadow duration-200 border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
            <CardHeader className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex-1">
                  <CardTitle className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                    <span className="flex items-center gap-2">
                      <Lightbulb className="h-5 w-5 text-yellow-500" />
                      {quiz.title}
                    </span>
                  </CardTitle>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {quiz.questions.length} Questions
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    Generated on: {formatDate(new Date(quiz.created_at))}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onSelectQuiz(quiz)}
                  className="flex items-center gap-2 text-blue-600 border-blue-200 hover:bg-blue-50 dark:text-blue-300 dark:border-blue-700 dark:hover:bg-blue-700"
                >
                  View Quiz
                </Button>
              </div>
            </CardHeader>
          </Card>
        ))
      ) : (
        <Card className="text-center py-8 bg-white shadow-sm dark:bg-gray-800 dark:border-gray-700">
          <CardContent>
            <BookOpen className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-500 mb-2 dark:text-gray-300">No quizzes generated yet</h3>
            <p className="text-gray-400">Generate a quiz from a recording to see it here!</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
