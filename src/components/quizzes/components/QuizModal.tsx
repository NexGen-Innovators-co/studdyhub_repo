// src/components/quizzes/components/QuizModal.tsx
import React, { useState } from 'react';
import { Quiz, QuizQuestion } from '../../../types/Class';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../ui/dialog';
import { ShareDialog } from '../../ui/ShareDialog';
import { Button } from '../../ui/button';
import { Card, CardContent } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { CheckCircle, XCircle, ArrowLeft, ArrowRight, Trophy, Lightbulb, Info, GraduationCap, Share2 } from 'lucide-react';
import { QuizAttempt } from '../../../types/EnhancedClasses';

interface QuizModalProps {
  quizMode: { recording: any; quiz: Quiz } | null;
  currentQuestionIndex: number;
  userAnswers: (number | null)[];
  showResults: boolean;
  onAnswerSelect: (questionIndex: number, optionIndex: number) => void;
  onNextQuestion: () => void;
  onPreviousQuestion: () => void;
  onExitQuizMode: () => void;
  calculateScore: () => number;
  bestAttempts?: Record<string, QuizAttempt>;
  hasExamAccess?: boolean;
  onStartExamMode?: (quiz: Quiz) => void;
}

const optionLetters = ['A', 'B', 'C', 'D'];

export const QuizModal: React.FC<QuizModalProps> = ({
  quizMode,
  currentQuestionIndex,
  userAnswers,
  showResults,
  onAnswerSelect,
  onNextQuestion,
  onPreviousQuestion,
  onExitQuizMode,
  calculateScore,
  bestAttempts = {},
  hasExamAccess = false,
  onStartExamMode,
}) => {
  const [showShareModal, setShowShareModal] = useState(false);

  if (!quizMode) {
    return null;
  }

  const { quiz, recording } = quizMode;
  const quizLink = `${window.location.origin}/quizzes/${quiz.id || ''}`;
  const quizCode = quiz.id || '';
  
  if (!quiz.questions || !Array.isArray(quiz.questions) || quiz.questions.length === 0) {
    return (
      <Dialog open={true} onOpenChange={onExitQuizMode}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Quiz Error</DialogTitle>
            <DialogDescription>
              This quiz has no questions available. Please try generating a new quiz.
            </DialogDescription>
          </DialogHeader>
          <Button onClick={onExitQuizMode}>Close</Button>
        </DialogContent>
      </Dialog>
    );
  }
  
  const currentQuestion = quiz.questions[currentQuestionIndex];
  const selectedAnswer = userAnswers[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === quiz.questions.length - 1;
  const isFirstQuestion = currentQuestionIndex === 0;
  const score = showResults ? calculateScore() : 0;
  const bestAttempt = bestAttempts[quiz.id];
  const answeredCount = userAnswers.filter(a => a !== null && a !== undefined).length;
  const progressPercent = showResults ? 100 : (answeredCount / quiz.questions.length) * 100;

  const getScoreColor = (s: number) => {
    if (s >= 80) return 'text-green-500';
    if (s >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getScoreMessage = (s: number) => {
    if (s >= 90) return 'Outstanding! You nailed it!';
    if (s >= 80) return 'Great job! Keep it up!';
    if (s >= 60) return 'Good effort! Room to improve.';
    if (s >= 40) return 'Keep studying, you\'ll get there!';
    return 'Don\'t give up — review and try again!';
  };

  return (
    <React.Fragment>
      <Dialog open={!!quizMode} onOpenChange={onExitQuizMode}>
        <DialogContent className="sm:max-w-2xl lg:max-w-3xl p-0 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-xl shadow-2xl w-full max-w-[95vw] sm:max-w-[90vw] overflow-hidden max-h-[90vh] flex flex-col" title="Quiz">
          {/* Header */}
          <div className="px-4 sm:px-6 pt-5 pb-3 border-b dark:border-gray-800 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Lightbulb className="h-5 w-5 text-yellow-500 flex-shrink-0" />
                <DialogTitle className="text-base sm:text-lg font-bold truncate">
                  {quiz.title || 'Generated Quiz'}
                </DialogTitle>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowShareModal(true)} className="flex-shrink-0 h-8 w-8 p-0">
                <Share2 className="h-4 w-4" />
              </Button>
            </div>

            {recording?.title && (
              <DialogDescription className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                Based on: {recording.title}
              </DialogDescription>
            )}

            {/* Progress bar */}
            <div className="mt-3 mb-1">
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                <span>{showResults ? 'Completed' : `Question ${currentQuestionIndex + 1} of ${quiz.questions.length}`}</span>
                <span>{answeredCount}/{quiz.questions.length} answered</span>
              </div>
              <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {bestAttempt && !showResults && (
              <div className="flex items-center gap-1.5 text-xs bg-blue-100/70 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2.5 py-1 rounded-md mt-2">
                <Info className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">Best: {bestAttempt.percentage}% — beat it for XP!</span>
              </div>
            )}

            {hasExamAccess && onStartExamMode && !showResults && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onStartExamMode(quiz)}
                className="mt-2 gap-1.5 text-xs text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/20"
              >
                <GraduationCap className="h-3.5 w-3.5" />
                Exam Mode
              </Button>
            )}
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
            {showResults ? (
              <div className="space-y-6">
                {/* Score card */}
                <div className="text-center py-4">
                  <Trophy className={`h-16 w-16 sm:h-20 sm:w-20 mx-auto mb-4 ${score >= 60 ? 'text-yellow-500 animate-bounce' : 'text-gray-400'}`} />
                  <h3 className={`text-4xl sm:text-5xl font-extrabold mb-1 ${getScoreColor(score)}`}>{score}%</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{getScoreMessage(score)}</p>
                  <div className="flex flex-wrap justify-center gap-2 mb-4">
                    <Badge variant="secondary" className="text-xs">
                      {userAnswers.filter((a, i) => a === quiz.questions[i]?.correctAnswer).length} correct
                    </Badge>
                    <Badge variant="outline" className="text-xs text-red-500 border-red-200 dark:border-red-800">
                      {quiz.questions.length - userAnswers.filter((a, i) => a === quiz.questions[i]?.correctAnswer).length} wrong
                    </Badge>
                  </div>
                  <Button
                    onClick={onExitQuizMode}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 px-8"
                  >
                    Done
                  </Button>
                </div>

                {/* Answer review */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Answer Review</h4>
                  <div className="space-y-3">
                    {quiz.questions.map((question, index) => {
                      const isCorrect = userAnswers[index] === question.correctAnswer;
                      return (
                        <div
                          key={index}
                          className={`rounded-lg border p-3 sm:p-4 transition-colors ${
                            isCorrect
                              ? 'border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-900/20'
                              : 'border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-900/20'
                          }`}
                        >
                          <div className="flex items-start gap-2.5">
                            {isCorrect ? (
                              <CheckCircle className="h-4.5 w-4.5 text-green-500 flex-shrink-0 mt-0.5" />
                            ) : (
                              <XCircle className="h-4.5 w-4.5 text-red-500 flex-shrink-0 mt-0.5" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                                <span className="text-gray-400 dark:text-gray-500 mr-1">{index + 1}.</span>
                                {question.question}
                              </p>
                              <div className="mt-1.5 space-y-0.5 text-xs">
                                <p className="text-gray-500 dark:text-gray-400">
                                  Your answer: <span className={isCorrect ? 'font-medium text-green-600 dark:text-green-400' : 'font-medium text-red-600 dark:text-red-400'}>
                                    {question.options[userAnswers[index] ?? -1] || 'Not answered'}
                                  </span>
                                </p>
                                {!isCorrect && (
                                  <p className="text-gray-500 dark:text-gray-400">
                                    Correct: <span className="font-medium text-green-600 dark:text-green-400">
                                      {question.options[question.correctAnswer]}
                                    </span>
                                  </p>
                                )}
                              </div>
                              {question.explanation && (
                                <p className="mt-2 text-xs text-gray-600 dark:text-gray-400 bg-white/60 dark:bg-gray-800/60 rounded px-2.5 py-1.5 italic leading-relaxed">
                                  {question.explanation}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 sm:space-y-5">
                {/* Question dot navigation */}
                <div className="flex flex-wrap justify-center gap-1.5">
                  {quiz.questions.map((_, i) => (
                    <div
                      key={i}
                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all ${
                        i === currentQuestionIndex
                          ? 'bg-blue-600 text-white scale-110 shadow-md'
                          : userAnswers[i] !== null && userAnswers[i] !== undefined
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                          : 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500'
                      }`}
                    >
                      {i + 1}
                    </div>
                  ))}
                </div>

                {/* Question card */}
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 sm:p-5 border border-gray-100 dark:border-gray-700/50">
                  <p className="text-sm sm:text-base font-semibold text-gray-800 dark:text-gray-100 leading-relaxed">
                    {currentQuestion.question}
                  </p>
                </div>

                {/* Options */}
                <div className="grid gap-2 sm:gap-2.5">
                  {currentQuestion.options.map((option, optionIndex) => (
                    <button
                      key={optionIndex}
                      className={`w-full flex items-center gap-3 text-left px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl border-2 transition-all duration-150 text-sm sm:text-base ${
                        selectedAnswer === optionIndex
                          ? 'border-blue-500 bg-blue-50 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200 dark:border-blue-500 shadow-sm'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 dark:hover:border-gray-600 dark:hover:bg-gray-750 active:scale-[0.99]'
                      }`}
                      onClick={() => onAnswerSelect(currentQuestionIndex, optionIndex)}
                    >
                      <span className={`flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold ${
                        selectedAnswer === optionIndex
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                      }`}>
                        {optionLetters[optionIndex]}
                      </span>
                      <span className="flex-1 leading-snug">{option}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer navigation - only show during quiz */}
          {!showResults && (
            <div className="px-4 sm:px-6 py-3 border-t dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 flex items-center justify-between gap-2">
              <Button
                onClick={onPreviousQuestion}
                disabled={isFirstQuestion}
                variant="ghost"
                size="sm"
                className="gap-1.5 text-gray-600 dark:text-gray-400 disabled:opacity-30"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Previous</span>
              </Button>

              <span className="text-xs text-gray-400 dark:text-gray-500">
                {currentQuestionIndex + 1} / {quiz.questions.length}
              </span>

              <Button
                onClick={onNextQuestion}
                disabled={selectedAnswer === null || selectedAnswer === undefined}
                size="sm"
                className="gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
              >
                <span>{isLastQuestion ? 'Submit' : 'Next'}</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <ShareDialog
        open={showShareModal}
        onClose={() => setShowShareModal(false)}
        shareUrl={quizLink}
        title={quiz.title || 'Quiz'}
        description={`Join this quiz using code: ${quizCode}`}
      />
    </React.Fragment>
  );
};
