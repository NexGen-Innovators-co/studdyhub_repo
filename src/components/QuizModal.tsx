// components/QuizModal.tsx
import React from 'react';
import { Button } from './ui/button';
import { X, Check, BookOpen } from 'lucide-react';
import { Quiz, ClassRecording, QuizQuestion } from '../types/Class';
// No longer importing useQuizManagement here

interface QuizModalProps {
  quizMode: { recording: ClassRecording; quiz: Quiz } | null;
  currentQuestionIndex: number;
  userAnswers: (number | null)[];
  showResults: boolean;
  onAnswerSelect: (questionIndex: number, optionIndex: number) => void;
  onNextQuestion: () => void;
  onPreviousQuestion: () => void;
  onExitQuizMode: () => void;
  onCalculateScore: () => number;
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
  onCalculateScore,
}) => {
  // Removed internal useQuizManagement hook call

  if (!quizMode) return null;

  const { quiz } = quizMode;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto dark:bg-gray-800">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-gray-100">{quiz.title}</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={onExitQuizMode}
              className="text-slate-600 hover:bg-slate-50 dark:text-gray-400 dark:hover:bg-gray-700"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {!showResults ? (
            quiz.questions && quiz.questions.length > 0 && quiz.questions[currentQuestionIndex] ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600 dark:text-gray-300">
                    Question {currentQuestionIndex + 1} of {quiz.questions.length}
                  </span>
                  <div className="w-64 h-2 bg-slate-200 rounded-full dark:bg-gray-700">
                    <div
                      className="h-full bg-gradient-to-r from-blue-600 to-purple-600 rounded-full transition-all duration-300"
                      style={{ width: `${((currentQuestionIndex + 1) / quiz.questions.length) * 100}%` }}
                    />
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-4 dark:text-gray-100">
                    {quiz.questions?.[currentQuestionIndex]?.question || 'Question not available'}
                  </h3>
                  <div className="space-y-3">
                    {(quiz.questions?.[currentQuestionIndex]?.options || []).map((option, index) => (
                      <Button
                        key={index}
                        variant={userAnswers[currentQuestionIndex] === index ? "default" : "outline"}
                        className={`w-full text-left justify-start p-4 transition-all duration-200 ${userAnswers[currentQuestionIndex] === index
                          ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                          : 'text-slate-600 border-slate-200 hover:bg-slate-50 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700'
                          }`}
                        onClick={() => onAnswerSelect(currentQuestionIndex, index)}
                      >
                        {option}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    onClick={onPreviousQuestion}
                    disabled={currentQuestionIndex === 0}
                    className="text-slate-600 border-slate-200 hover:bg-slate-50 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700"
                  >
                    Previous
                  </Button>
                  <Button
                    onClick={onNextQuestion}
                    disabled={userAnswers[currentQuestionIndex] === null}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700"
                  >
                    {currentQuestionIndex < (quiz.questions?.length || 0) - 1 ? 'Next' : 'Finish'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <BookOpen className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-500 mb-2">No questions available</h3>
                <p className="text-gray-400">The quiz could not be generated. Please try again.</p>
                <Button
                  onClick={onExitQuizMode}
                  className="mt-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700"
                >
                  Close
                </Button>
              </div>
            )
          ) : (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-2xl font-bold text-slate-800 dark:text-gray-100">Quiz Results</h3>
                <p className="text-lg text-slate-600 mt-2 dark:text-gray-300">
                  Your score: <span className="font-semibold text-blue-600">{onCalculateScore()}%</span>
                </p>
              </div>

              <div className="space-y-4">
                {quiz.questions && Array.isArray(quiz.questions) && quiz.questions.length > 0 ? (
                  quiz.questions.map((question, index) => (
                    <div key={question.id || index} className="border border-slate-200 rounded-lg p-4 dark:border-gray-700">
                      <div className="flex items-center gap-2 mb-2">
                        {userAnswers[index] === question.correctAnswer ? (
                          <Check className="h-5 w-5 text-green-600" />
                        ) : (
                          <X className="h-5 w-5 text-red-600" />
                        )}
                        <h4 className="font-semibold text-slate-800 dark:text-gray-100">{question.question}</h4>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-gray-300">
                        Your answer: {question.options[userAnswers[index] ?? -1] || 'Not answered'}
                      </p>
                      {userAnswers[index] !== question.correctAnswer && (
                        <p className="text-sm text-slate-600 dark:text-gray-300">
                          Correct answer: {question.options[question.correctAnswer]}
                        </p>
                      )}
                      <p className="text-sm text-slate-700 mt-2 dark:text-gray-200">{question.explanation}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-600 dark:text-gray-300">No questions available.</p>
                )}
              </div>

              <Button
                onClick={onExitQuizMode}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700"
              >
                Exit Quiz
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
