// src/components/quizzes/components/QuizHistory.tsx - UPDATED
import React from 'react';
import { Quiz } from '../../../types/Class';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { formatDate } from '../../classRecordings/utils/helpers';
import { Lightbulb, BookOpen, FileText, Brain, Play } from 'lucide-react';
import { Badge } from '../../ui/badge';

interface QuizHistoryProps {
  quizzes: Quiz[];
  onSelectQuiz: (quiz: Quiz) => void;
  compact?: boolean;
}

export const QuizHistory: React.FC<QuizHistoryProps> = ({ quizzes, onSelectQuiz, compact = false }) => {
  const getQuizIcon = (sourceType?: string) => {
    switch (sourceType) {
      case 'notes':
        return <FileText className="h-4 w-4 text-green-500" />;
      case 'ai':
        return <Brain className="h-4 w-4 text-blue-500" />;
      case 'recording':
      default:
        return <Play className="h-4 w-4 text-blue-500" />;
    }
  };

  const getQuizBadge = (sourceType?: string) => {
    switch (sourceType) {
      case 'notes':
        return <Badge variant="secondary" className="bg-green-100 text-green-700">Notes</Badge>;
      case 'ai':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-700">AI Smart</Badge>;
      case 'recording':
      default:
        return <Badge variant="secondary" className="bg-blue-100 text-blue-700">Recording</Badge>;
    }
  };

  const getQuizDescription = (quiz: Quiz) => {
    const questionCount = quiz.questions?.length || 0;
    const sourceType = quiz.source_type || 'recording';

    switch (sourceType) {
      case 'notes':
        return `${questionCount} questions from notes`;
      case 'ai':
        return `${questionCount} personalized AI questions`;
      case 'recording':
      default:
        return `${questionCount} questions from recording`;
    }
  };

  if (compact) {
    return (
      <div className="space-y-3">
        {quizzes.map((quiz) => (
          <div
            key={quiz.id}
            className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
            onClick={() => onSelectQuiz(quiz)}
          >
            <div className="flex items-center gap-3">
              {getQuizIcon(quiz.source_type)}
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm">{quiz.title}</p>
                  {getQuizBadge(quiz.source_type)}
                </div>
                <p className="text-xs text-gray-500">
                  {getQuizDescription(quiz)} • {new Date(quiz.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm">
              Take Quiz
            </Button>
          </div>
        ))}
        {quizzes.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">No quizzes yet</p>
            <p className="text-sm mt-1">Generate your first quiz to get started!</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {Array.isArray(quizzes) && quizzes.length > 0 ? (
        quizzes.map((quiz) => (
          <Card key={quiz.id} className="hover:shadow-md transition-shadow duration-200  dark:bg-gray-800 ">
            <CardHeader className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {getQuizIcon(quiz.source_type)}
                    <CardTitle className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                      {quiz.title}
                    </CardTitle>
                    {getQuizBadge(quiz.source_type)}
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {getQuizDescription(quiz)}
                    </p>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <span>Generated on: {formatDate(new Date(quiz.created_at))}</span>

                      {quiz.source_type === 'ai' && (
                        <Badge variant="outline" className="text-xs">
                          🤖 Adaptive
                        </Badge>
                      )}

                      {quiz.source_type === 'notes' && (
                        <Badge variant="outline" className="text-xs">
                          📝 Multiple Notes
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onSelectQuiz(quiz)}
                  className="flex items-center gap-2 text-blue-600 border-blue-200 hover:bg-blue-50 dark:text-blue-300 dark:border-blue-700 dark:hover:bg-blue-700"
                >
                  <Lightbulb className="h-4 w-4" />
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
            <p className="text-gray-400">Generate a quiz from recordings, notes, or AI to see it here!</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Badge variant="outline">🎤 From Recordings</Badge>
              <Badge variant="outline">📝 From Notes</Badge>
              <Badge variant="outline">🤖 AI Smart Quiz</Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};