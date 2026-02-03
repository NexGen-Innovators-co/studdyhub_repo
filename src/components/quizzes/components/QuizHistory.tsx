// src/components/quizzes/components/QuizHistory.tsx - UPDATED
import React, { useState } from 'react';
import { Quiz } from '../../../types/Class';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { formatDate } from '../../classRecordings/utils/helpers';
import { Lightbulb, BookOpen, FileText, Brain, Play, Trash2, MoreVertical } from 'lucide-react';
import { Badge } from '../../ui/badge';
import { QuizAttempt } from '../../../types/EnhancedClasses';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../ui/alert-dialog';

interface QuizHistoryProps {
  quizzes: Quiz[];
  onSelectQuiz: (quiz: Quiz) => void;
  onDeleteQuiz?: (quizId: string) => Promise<void>;
  compact?: boolean;
  bestAttempts?: Record<string, QuizAttempt>;
}

export const QuizHistory: React.FC<QuizHistoryProps> = ({ quizzes, onSelectQuiz, onDeleteQuiz, compact = false, bestAttempts = {} }) => {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [quizToDelete, setQuizToDelete] = useState<Quiz | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteClick = (quiz: Quiz, e: React.MouseEvent) => {
    e.stopPropagation();
    setQuizToDelete(quiz);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!quizToDelete || !onDeleteQuiz) return;
    
    setIsDeleting(true);
    try {
      await onDeleteQuiz(quizToDelete.id);
      setDeleteDialogOpen(false);
      setQuizToDelete(null);
    } catch (error) {
      // console.error('Failed to delete quiz:', error);
    } finally {
      setIsDeleting(false);
    }
  };
  const inferSourceType = (quiz: Quiz) => {
    if (quiz.source_type) return quiz.source_type;
    if (quiz.class_id === 'ai-generated') return 'ai';
    if (quiz.class_id === 'notes-generated') return 'notes';
    if (quiz.class_id === 'custom') return 'custom';
    return 'recording';
  };

  const getQuizIcon = (sourceType?: string) => {
    switch (sourceType) {
      case 'notes':
        return <FileText className="h-4 w-4 text-green-500" />;
      case 'ai':
        return <Brain className="h-4 w-4 text-purple-500" />;
      case 'recording':
        return <Play className="h-4 w-4 text-blue-500" />;
      default:
        return <BookOpen className="h-4 w-4 text-gray-500" />;
    }
  };

  const getQuizBadge = (sourceType?: string) => {
    switch (sourceType) {
      case 'notes':
        return <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">From Notes</Badge>;
      case 'ai':
        return <Badge variant="secondary" className="bg-purple-100 text-purple-700 border-purple-200">AI Smart</Badge>;
      case 'recording':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200">Recording</Badge>;
      default:
        return <Badge variant="secondary" className="bg-gray-100 text-gray-700 border-gray-200">Quiz</Badge>;
    }
  };

  const getQuizDescription = (quiz: Quiz) => {
    const questionCount = quiz.questions?.length || 0;
    const sourceType = inferSourceType(quiz);

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
      <div className="space-y-2 md:space-y-3">
        {quizzes.map((quiz) => {
          const sourceType = inferSourceType(quiz);
          return (
            <div
              key={quiz.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 p-3 sm:p-4 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
              onClick={() => onSelectQuiz(quiz)}
            >
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="flex-shrink-0 mt-0.5">{getQuizIcon(sourceType)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 gap-1 mb-1">
                    <p className="font-medium text-sm line-clamp-1">{quiz.title}</p>
                    <div className="flex flex-wrap items-center gap-1">
                      {getQuizBadge(sourceType)}
                      {bestAttempts[quiz.id] && (
                        <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 text-[10px] py-0.5">
                          Best: {bestAttempts[quiz.id].percentage}%
                        </Badge>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 line-clamp-1">
                    {getQuizDescription(quiz)} • {new Date(quiz.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button 
                  variant="default" 
                  size="sm" 
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectQuiz(quiz);
                  }}
                  className="text-xs sm:text-sm"
                >
                  Take Quiz
                </Button>
                {onDeleteQuiz && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={(e) => handleDeleteClick(quiz, e)}
                        className="text-red-600 focus:text-red-600 cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Quiz
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          );
        })}
        {quizzes.length === 0 && (
          <div className="text-center py-8 px-4 text-gray-500">
            <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium text-sm">No quizzes yet</p>
            <p className="text-xs mt-1">Generate your first quiz to get started!</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-3 md:gap-4">
        {Array.isArray(quizzes) && quizzes.length > 0 ? (
          quizzes.map((quiz) => {
            const sourceType = inferSourceType(quiz);
            return (
              <Card key={quiz.id} className="hover:shadow-lg transition-shadow duration-200 dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                <CardHeader className="p-3 sm:p-5">
                  <div className="flex flex-col gap-3">
                    {/* Header Row - Title and Badges */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <div className="flex-shrink-0 mt-0.5">{getQuizIcon(sourceType)}</div>
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base sm:text-lg font-semibold text-gray-800 dark:text-gray-100 line-clamp-2">
                            {quiz.title}
                          </CardTitle>
                          <div className="flex flex-wrap items-center gap-1.5 mt-2">
                            {getQuizBadge(sourceType)}
                            {bestAttempts[quiz.id] && (
                              <Badge className="bg-green-100 text-green-700 border-green-200 text-xs sm:text-sm">
                                ✓ Best: {bestAttempts[quiz.id].percentage}%
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      {onDeleteQuiz && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9 flex-shrink-0">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={(e) => handleDeleteClick(quiz, e)}
                              className="text-red-600 focus:text-red-600 cursor-pointer"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete Quiz
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>

                    {/* Description and Metadata */}
                    <div className="space-y-2">
                      <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                        {getQuizDescription(quiz)}
                      </p>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          📅 {formatDate(new Date(quiz.created_at))}
                        </span>
                        {sourceType === 'ai' && (
                          <Badge variant="outline" className="w-fit text-xs sm:text-sm">
                            🤖 Adaptive
                          </Badge>
                        )}
                        {sourceType === 'notes' && (
                          <Badge variant="outline" className="w-fit text-xs sm:text-sm">
                            📝 Multiple Notes
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Action Button */}
                    <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-700">
                      <Button
                        onClick={() => onSelectQuiz(quiz)}
                        className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white flex items-center gap-2 w-full sm:w-auto justify-center"
                      >
                        <Lightbulb className="h-4 w-4" />
                        <span className="text-sm">View Quiz</span>
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            );
          })
        ) : (
          <Card className="text-center py-12 sm:py-16 px-4 bg-white shadow-sm dark:bg-slate-800 dark:border-slate-700">
            <CardContent>
              <BookOpen className="h-16 w-16 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg sm:text-xl font-semibold text-gray-600 dark:text-gray-300 mb-2">
                No quizzes generated yet
              </h3>
              <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mb-6">
                Generate a quiz from recordings, notes, or AI to see it here!
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <Badge variant="outline" className="text-xs sm:text-sm">🎤 From Recordings</Badge>
                <Badge variant="outline" className="text-xs sm:text-sm">📝 From Notes</Badge>
                <Badge variant="outline" className="text-xs sm:text-sm">🤖 AI Smart Quiz</Badge>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="w-[90vw] max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Quiz</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <span className="font-semibold text-gray-900 dark:text-gray-100">"{quizToDelete?.title}"</span>? 
              This action cannot be undone. All associated quiz attempts and scores will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex gap-2 sm:gap-3">
            <AlertDialogCancel disabled={isDeleting} className="w-full sm:w-auto">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting ? (
                <><span className="inline-block h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin"></span>Deleting...</>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};