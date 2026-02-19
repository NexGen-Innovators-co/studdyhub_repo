// src/components/quizzes/components/QuizModal.tsx
import React from 'react';
import { Quiz, QuizQuestion } from '../../../types/Class';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Card, CardContent } from '../../ui/card';
import { CheckCircle, XCircle, ArrowLeft, ArrowRight, Trophy, Lightbulb, Info, GraduationCap } from 'lucide-react';
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
  if (!quizMode) {
    return null;
  }

  const { quiz, recording } = quizMode;
  
  // Validate quiz has questions
  if (!quiz.questions || !Array.isArray(quiz.questions) || quiz.questions.length === 0) {
    return (
      <Dialog open={true} onOpenChange={onExitQuizMode}>
        <DialogContent className="max-w-2xl">
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

  return (
    <Dialog open={!!quizMode} onOpenChange={onExitQuizMode} >
      <DialogContent className="sm:max-w-2xl lg:max-w-3xl xl:max-w-4xl p-6 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-lg shadow-xl w-full max-w-[90vw]" title='Quiz'>
        <DialogHeader className="border-b pb-4 mb-4 dark:border-gray-700">
          <DialogTitle className="text-2xl font-bold text-center flex items-center justify-center gap-2">
            <Lightbulb className="h-6 w-6 text-yellow-500" /> {quiz.title || 'Generated Quiz'}
          </DialogTitle>
          <div className="flex flex-col items-center gap-1">
            {recording && (
              <DialogDescription className="text-center text-gray-600 dark:text-gray-400">
                Based on: <span className="font-medium text-blue-600 dark:text-blue-400">{recording.title}</span>
              </DialogDescription>
            )}
            {bestAttempt && !showResults && (
              <div className="flex items-center gap-1.5 text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-3 py-1 rounded-full border border-blue-100 dark:border-blue-800 mt-1">
                <Info className="h-3 w-3" />
                <span>You've already attempted this quiz (Best: {bestAttempt.percentage}%). No new XP will be awarded unless you beat your high score.</span>
              </div>
            )}
            {hasExamAccess && onStartExamMode && !showResults && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onStartExamMode(quiz)}
                className="mt-2 gap-1.5 text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/20"
              >
                <GraduationCap className="h-4 w-4" />
                Switch to Exam Mode
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="relative">
          {showResults ? (
            <div className="text-center py-8 max-h-[70vh] overflow-y-auto modern-scrollbar">
              <Trophy className="h-20 w-20 text-yellow-500 mx-auto mb-6 animate-bounce" />
              <h3 className="text-3xl font-extrabold text-blue-600 dark:text-blue-400 mb-4">Quiz Completed!</h3>
              <p className="text-xl text-gray-700 dark:text-gray-300 mb-6">
                Your Score: <span className="font-bold">{score}%</span>
              </p>
              <Button
                onClick={onExitQuizMode}
                className="w-full sm:w-auto max-w-xs bg-gradient-to-r from-blue-600 to-blue-600 text-white hover:from-blue-700 hover:to-blue-700"
              >
                Exit Quiz
              </Button>

              <div className="mt-8 space-y-4 text-left">
                <h4 className="text-xl font-bold text-slate-800 dark:text-gray-100 mb-4">Review Your Answers</h4>
                {quiz.questions.length > 0 ? (
                  quiz.questions.map((question, index) => (
                    <Card key={index} className="p-4 rounded-lg shadow-sm border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
                      <div className="flex items-start gap-3 mb-2">
                        {userAnswers[index] === question.correctAnswer ? (
                          <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-1" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-1" />
                        )}
                        <h4 className="font-semibold text-slate-800 dark:text-gray-100 flex-1">
                          {index + 1}. {question.question}
                        </h4>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 ml-8">
                        Your answer: <span className="font-medium">
                          {question.options[userAnswers[index] ?? -1] || 'Not answered'}
                        </span>
                      </p>
                      {userAnswers[index] !== question.correctAnswer && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 ml-8">
                          Correct answer: <span className="font-medium text-green-600 dark:text-green-400">
                            {question.options[question.correctAnswer]}
                          </span>
                        </p>
                      )}
                      <p className="text-sm text-gray-700 dark:text-gray-300 mt-2 ml-8 italic">
                        Explanation: {question.explanation}
                      </p>
                    </Card>
                  ))
                ) : (
                  <p className="text-sm text-gray-600 dark:text-gray-400">No questions available for review.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="text-center text-lg font-medium text-gray-700 dark:text-gray-300">
                Question {currentQuestionIndex + 1} of {quiz.questions.length}
              </div>
              <Card className="p-6 rounded-lg shadow-md border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
                <CardContent className="p-0">
                  <p className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">
                    {currentQuestion.question}
                  </p>
                  <div className="space-y-3">
                    {currentQuestion.options.map((option, optionIndex) => (
                      <Button
                        key={optionIndex}
                        variant="outline"
                        className={`w-full flex items-center justify-start text-left py-3 px-4 rounded-md transition-colors duration-200 whitespace-pre-wrap
${selectedAnswer === optionIndex
                            ? 'bg-blue-100 border-blue-500 text-blue-800 dark:bg-blue-900 dark:border-blue-500 dark:text-blue-200'
                            : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600'
                          }
`}
                        onClick={() => onAnswerSelect(currentQuestionIndex, optionIndex)}
                      >
                        {option}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="flex flex-col sm:flex-row justify-between mt-6 gap-2">
                <Button
                  onClick={onPreviousQuestion}
                  disabled={isFirstQuestion}
                  variant="outline"
                  className="flex items-center gap-2 text-gray-600 border-gray-200 hover:bg-gray-100 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700 w-full sm:w-auto"
                >
                  <ArrowLeft className="h-4 w-4" /> Previous
                </Button>
                <Button
                  onClick={onNextQuestion}
                  disabled={selectedAnswer === null || selectedAnswer === undefined}
                  className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-blue-500 text-white hover:from-blue-600 hover:to-blue-600 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed w-full sm:w-auto"
                >
                  {isLastQuestion ? 'Submit Quiz' : 'Next Question'} <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
