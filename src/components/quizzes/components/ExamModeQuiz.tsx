// src/components/quizzes/components/ExamModeQuiz.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Quiz, QuizQuestion } from '../../../types/Class';
import { QuizAttempt } from '../../../types/EnhancedClasses';
import { Button } from '../../ui/button';
import { Card, CardContent } from '../../ui/card';
import { Badge } from '../../ui/badge';
import {
  CheckCircle,
  XCircle,
  ArrowLeft,
  ArrowRight,
  Trophy,
  Clock,
  Flag,
  AlertTriangle,
  Maximize,
  Minimize,
  Shield,
  GraduationCap,
  Eye,
  EyeOff,
  Send,
  Lightbulb,
  X,
  Lock,
  Zap,
} from 'lucide-react';
import { ExamModeSettings } from '../hooks/useExamMode';
import { toast } from 'sonner';

interface ExamModeQuizProps {
  quiz: Quiz;
  settings: ExamModeSettings;
  onSubmit: (
    answers: (number | null)[],
    timeTaken: number,
    tabSwitchCount: number,
    isExamMode: boolean
  ) => void;
  onExit: () => void;
  bestAttempt?: QuizAttempt;
}

export const ExamModeQuiz: React.FC<ExamModeQuizProps> = ({
  quiz,
  settings,
  onSubmit,
  onExit,
  bestAttempt,
}) => {
  const questions: QuizQuestion[] = quiz.questions || [];
  const questionCount = questions.length;

  // ---- State ----
  const [questionOrder, setQuestionOrder] = useState<number[]>([]);
  const [userAnswers, setUserAnswers] = useState<(number | null)[]>(new Array(questionCount).fill(null));
  const [currentDisplayIndex, setCurrentDisplayIndex] = useState(0);
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<number>>(new Set());
  const [confirmedAnswers, setConfirmedAnswers] = useState<Set<number>>(new Set());
  const [showResults, setShowResults] = useState(false);
  const [showNavigator, setShowNavigator] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(settings.timeLimitMinutes * 60);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [tabWarningVisible, setTabWarningVisible] = useState(false);
  const [timeWarningShown, setTimeWarningShown] = useState<Set<number>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const startTimeRef = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ---- Init: Shuffle & Fullscreen ----
  useEffect(() => {
    const indices = Array.from({ length: questionCount }, (_, i) => i);
    if (settings.shuffleQuestions) {
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }
    }
    setQuestionOrder(indices);

    // Try fullscreen on mount
    document.documentElement.requestFullscreen?.().then(() => {
      setIsFullscreen(true);
    }).catch(() => {});

    return () => {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, [questionCount, settings.shuffleQuestions]);

  // ---- Timer ----
  useEffect(() => {
    if (settings.timeLimitMinutes <= 0) return;

    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [settings.timeLimitMinutes]);

  // ---- Time warnings ----
  useEffect(() => {
    if (settings.timeLimitMinutes <= 0) return;

    if (timeRemaining === 300 && !timeWarningShown.has(300)) {
      toast.warning('⏰ 5 minutes remaining!', { duration: 3000 });
      setTimeWarningShown(prev => new Set(prev).add(300));
    }
    if (timeRemaining === 60 && !timeWarningShown.has(60)) {
      toast.error('⏰ 1 minute remaining!', { duration: 3000 });
      setTimeWarningShown(prev => new Set(prev).add(60));
    }
  }, [timeRemaining, settings.timeLimitMinutes, timeWarningShown]);

  // ---- Tab switch detection ----
  useEffect(() => {
    if (!settings.enableTabDetection) return;

    const handler = () => {
      if (document.hidden) {
        setTabSwitchCount(prev => prev + 1);
        setTabWarningVisible(true);
        toast.warning('⚠️ Tab switch detected! This will be recorded.', { duration: 3000 });
        setTimeout(() => setTabWarningVisible(false), 3000);
      }
    };

    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [settings.enableTabDetection]);

  // ---- Fullscreen listener ----
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // ---- Keyboard shortcuts ----
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (showResults || showSubmitConfirm) return;
      if (e.key === 'ArrowRight' || e.key === 'n') {
        handleNext();
      } else if (e.key === 'ArrowLeft' || e.key === 'p') {
        handlePrevious();
      } else if (e.key === 'f') {
        toggleFlag();
      } else if (e.key >= '1' && e.key <= '6') {
        const idx = parseInt(e.key) - 1;
        const actualIdx = questionOrder[currentDisplayIndex];
        if (questions[actualIdx]?.options?.[idx] !== undefined) {
          handleAnswerSelect(actualIdx, idx);
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentDisplayIndex, showResults, showSubmitConfirm, questionOrder]);

  // ---- Helpers ----

  const getActualIndex = (displayIdx: number) => questionOrder[displayIdx] ?? displayIdx;
  const currentActualIndex = getActualIndex(currentDisplayIndex);
  const currentQuestion = questions[currentActualIndex];
  const selectedAnswer = userAnswers[currentActualIndex];

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const answeredCount = userAnswers.filter(a => a !== null).length;
  const unansweredCount = questionCount - answeredCount;
  const flaggedCount = flaggedQuestions.size;

  // ---- Answer handling ----

  const handleAnswerSelect = useCallback((questionIdx: number, optionIdx: number) => {
    if (settings.lockAnswers && confirmedAnswers.has(questionIdx)) return;
    setUserAnswers(prev => {
      const next = [...prev];
      next[questionIdx] = optionIdx;
      return next;
    });
  }, [settings.lockAnswers, confirmedAnswers]);

  const handleConfirmAnswer = useCallback(() => {
    if (selectedAnswer === null || selectedAnswer === undefined) return;
    setConfirmedAnswers(prev => new Set(prev).add(currentActualIndex));
    toast.success('Answer locked!', { duration: 1000 });
  }, [selectedAnswer, currentActualIndex]);

  // ---- Navigation ----

  const handleNext = useCallback(() => {
    if (currentDisplayIndex < questionCount - 1) {
      setCurrentDisplayIndex(prev => prev + 1);
    }
  }, [currentDisplayIndex, questionCount]);

  const handlePrevious = useCallback(() => {
    if (currentDisplayIndex > 0) {
      setCurrentDisplayIndex(prev => prev - 1);
    }
  }, [currentDisplayIndex]);

  const navigateToQuestion = useCallback((displayIdx: number) => {
    setCurrentDisplayIndex(displayIdx);
    setShowNavigator(false);
  }, []);

  const toggleFlag = useCallback(() => {
    setFlaggedQuestions(prev => {
      const next = new Set(prev);
      if (next.has(currentActualIndex)) {
        next.delete(currentActualIndex);
      } else {
        next.add(currentActualIndex);
      }
      return next;
    });
  }, [currentActualIndex]);

  // ---- Submit ----

  const handleAutoSubmit = useCallback(() => {
    const timeTaken = Math.floor((Date.now() - startTimeRef.current) / 1000);
    setShowResults(true);
    onSubmit(userAnswers, timeTaken, tabSwitchCount, true);
    toast.info('⏰ Time expired! Quiz auto-submitted.');
  }, [userAnswers, tabSwitchCount, onSubmit]);

  const handleSubmit = useCallback(() => {
    if (isSubmitting) return;
    if (unansweredCount > 0) {
      setShowSubmitConfirm(true);
      return;
    }
    doSubmit();
  }, [unansweredCount, isSubmitting]);

  const doSubmit = useCallback(() => {
    setIsSubmitting(true);
    setShowSubmitConfirm(false);
    if (timerRef.current) clearInterval(timerRef.current);
    const timeTaken = Math.floor((Date.now() - startTimeRef.current) / 1000);
    setShowResults(true);
    onSubmit(userAnswers, timeTaken, tabSwitchCount, true);
  }, [userAnswers, tabSwitchCount, onSubmit]);

  const handleExit = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    onExit();
  }, [onExit]);

  // ---- Calculate score ----
  const calculateScore = () => {
    let correct = 0;
    questions.forEach((q, i) => {
      if (userAnswers[i] === q.correctAnswer) correct++;
    });
    return Math.round((correct / questionCount) * 100);
  };

  // ---- Render ----

  if (questionOrder.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[100] bg-gray-50 dark:bg-gray-950 flex flex-col overflow-hidden"
    >
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-900 border-b dark:border-gray-800 shadow-sm">
        {/* Left: Exam badge + quiz title */}
        <div className="flex items-center gap-3 min-w-0">
          <Badge className="bg-red-600 text-white flex-shrink-0 gap-1">
            <GraduationCap className="h-3.5 w-3.5" />
            EXAM
          </Badge>
          <span className="font-semibold text-sm truncate text-gray-800 dark:text-gray-200">
            {quiz.title}
          </span>
        </div>

        {/* Center: Timer */}
        <div className="flex items-center gap-4">
          {settings.showTimer && settings.timeLimitMinutes > 0 && (
            <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-mono font-bold
              ${timeRemaining <= 60
                ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 animate-pulse'
                : timeRemaining <= 300
                  ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
              }`}
            >
              <Clock className="h-4 w-4" />
              {formatTime(timeRemaining)}
            </div>
          )}

          {/* Progress */}
          <div className="hidden sm:flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <span>{answeredCount}/{questionCount} answered</span>
            {flaggedCount > 0 && (
              <span className="flex items-center gap-1 text-amber-500">
                <Flag className="h-3.5 w-3.5" /> {flaggedCount}
              </span>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {settings.enableTabDetection && tabSwitchCount > 0 && (
            <Badge variant="destructive" className="gap-1">
              <Shield className="h-3 w-3" />
              {tabSwitchCount} switch{tabSwitchCount > 1 ? 'es' : ''}
            </Badge>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (isFullscreen) {
                document.exitFullscreen().catch(() => {});
              } else {
                document.documentElement.requestFullscreen?.().catch(() => {});
              }
            }}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowNavigator(!showNavigator)}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tab switch warning overlay */}
      {tabWarningVisible && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg shadow-lg">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm font-medium">Tab switch detected!</span>
          </div>
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Question area */}
        <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 overflow-y-auto">
          {showResults ? (
            // ---- Results Screen ----
            <div className="w-full max-w-3xl mx-auto text-center space-y-6">
              <Trophy className="h-20 w-20 text-yellow-500 mx-auto animate-bounce" />
              <h2 className="text-3xl font-extrabold text-blue-600 dark:text-blue-400">
                Exam Completed!
              </h2>
              <p className="text-xl text-gray-700 dark:text-gray-300">
                Your Score: <span className="font-bold">{calculateScore()}%</span>
              </p>

              {/* Stats row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card>
                  <CardContent className="p-3 text-center">
                    <Clock className="h-5 w-5 mx-auto mb-1 text-blue-500" />
                    <div className="text-lg font-bold">{formatTime(Math.floor((Date.now() - startTimeRef.current) / 1000))}</div>
                    <div className="text-xs text-gray-500">Time Taken</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <CheckCircle className="h-5 w-5 mx-auto mb-1 text-green-500" />
                    <div className="text-lg font-bold">{questions.filter((q, i) => userAnswers[i] === q.correctAnswer).length}/{questionCount}</div>
                    <div className="text-xs text-gray-500">Correct</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <Shield className="h-5 w-5 mx-auto mb-1 text-purple-500" />
                    <div className="text-lg font-bold">{tabSwitchCount}</div>
                    <div className="text-xs text-gray-500">Tab Switches</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <Zap className="h-5 w-5 mx-auto mb-1 text-yellow-500" />
                    <div className="text-lg font-bold">1.5x</div>
                    <div className="text-xs text-gray-500">XP Bonus</div>
                  </CardContent>
                </Card>
              </div>

              {bestAttempt && (
                <p className="text-sm text-gray-500">
                  Previous best: {bestAttempt.percentage}%
                </p>
              )}

              {/* Review answers */}
              <div className="mt-6 space-y-3 text-left max-h-[40vh] overflow-y-auto modern-scrollbar">
                <h4 className="text-lg font-bold text-gray-800 dark:text-gray-100">Review Your Answers</h4>
                {questions.map((question, index) => (
                  <Card key={index} className="p-4 border border-gray-200 dark:border-gray-700 dark:bg-gray-800">
                    <div className="flex items-start gap-3 mb-2">
                      {userAnswers[index] === question.correctAnswer ? (
                        <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <p className="font-semibold text-gray-800 dark:text-gray-100">
                          {index + 1}. {question.question}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          Your answer: <span className="font-medium">
                            {question.options[userAnswers[index] ?? -1] || 'Not answered'}
                          </span>
                        </p>
                        {userAnswers[index] !== question.correctAnswer && (
                          <p className="text-sm text-green-600 dark:text-green-400">
                            Correct: <span className="font-medium">{question.options[question.correctAnswer]}</span>
                          </p>
                        )}
                        {question.explanation && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 italic">
                            {question.explanation}
                          </p>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              <Button
                onClick={handleExit}
                className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
              >
                Exit Exam
              </Button>
            </div>
          ) : (
            // ---- Active Question ----
            <div className="w-full max-w-2xl mx-auto space-y-6">
              {/* Question progress bar */}
              <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-red-500 to-orange-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${((currentDisplayIndex + 1) / questionCount) * 100}%` }}
                />
              </div>

              {/* Question Header */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Question {currentDisplayIndex + 1} of {questionCount}
                </span>
                <button
                  onClick={toggleFlag}
                  className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full transition-all
                    ${flaggedQuestions.has(currentActualIndex)
                      ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                >
                  <Flag className="h-3.5 w-3.5" />
                  {flaggedQuestions.has(currentActualIndex) ? 'Flagged' : 'Flag'}
                </button>
              </div>

              {/* Question Card */}
              <Card className="p-6 shadow-md border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
                <CardContent className="p-0">
                  <p className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-5">
                    {currentQuestion?.question}
                  </p>
                  <div className="space-y-3">
                    {currentQuestion?.options?.map((option: string, optIdx: number) => {
                      const isSelected = selectedAnswer === optIdx;
                      const isLocked = settings.lockAnswers && confirmedAnswers.has(currentActualIndex);

                      return (
                        <button
                          key={optIdx}
                          onClick={() => handleAnswerSelect(currentActualIndex, optIdx)}
                          disabled={isLocked}
                          className={`w-full flex items-center text-left py-3.5 px-4 rounded-lg transition-all duration-200 border
                            ${isLocked && isSelected
                              ? 'bg-blue-100 border-blue-500 text-blue-800 dark:bg-blue-900/50 dark:border-blue-500 dark:text-blue-200 opacity-80'
                              : isLocked
                                ? 'bg-gray-50 border-gray-200 text-gray-400 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-600 cursor-not-allowed'
                                : isSelected
                                  ? 'bg-blue-100 border-blue-500 text-blue-800 dark:bg-blue-900 dark:border-blue-500 dark:text-blue-200 shadow-sm'
                                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-750'
                            }`}
                        >
                          <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium mr-3 border
                            ${isSelected
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-gray-100 text-gray-500 border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-400'
                            }`}
                          >
                            {String.fromCharCode(65 + optIdx)}
                          </span>
                          <span className="flex-1">{option}</span>
                          {isLocked && isSelected && (
                            <Lock className="h-4 w-4 text-blue-500 flex-shrink-0 ml-2" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Lock answer button (if enabled) */}
              {settings.lockAnswers && selectedAnswer !== null && !confirmedAnswers.has(currentActualIndex) && (
                <div className="flex justify-center">
                  <Button
                    onClick={handleConfirmAnswer}
                    variant="outline"
                    size="sm"
                    className="text-amber-600 border-amber-300 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-700 dark:hover:bg-amber-900/20"
                  >
                    <Lock className="h-3.5 w-3.5 mr-1.5" />
                    Lock Answer
                  </Button>
                </div>
              )}

              {/* Navigation */}
              <div className="flex items-center justify-between pt-2">
                <Button
                  onClick={handlePrevious}
                  disabled={currentDisplayIndex === 0}
                  variant="outline"
                  className="gap-2 text-gray-600 dark:text-gray-300"
                >
                  <ArrowLeft className="h-4 w-4" /> Previous
                </Button>

                {currentDisplayIndex === questionCount - 1 ? (
                  <Button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="gap-2 bg-gradient-to-r from-red-600 to-orange-600 text-white hover:from-red-700 hover:to-orange-700"
                  >
                    <Send className="h-4 w-4" /> Submit Exam
                  </Button>
                ) : (
                  <Button
                    onClick={handleNext}
                    className="gap-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white"
                  >
                    Next <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* Keyboard hint */}
              <p className="text-center text-xs text-gray-400 dark:text-gray-600">
                Shortcuts: ← → navigate • 1-4 select answer • F flag • Enter submit
              </p>
            </div>
          )}
        </div>

        {/* Question Navigator Panel (slide-in) */}
        {showNavigator && !showResults && (
          <div className="w-64 border-l dark:border-gray-800 bg-white dark:bg-gray-900 p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Questions</h3>
              <button onClick={() => setShowNavigator(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-2 mb-3 text-[10px] text-gray-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Answered</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-300" /> Unanswered</span>
              <span className="flex items-center gap-1"><Flag className="h-2.5 w-2.5 text-amber-500" /> Flagged</span>
            </div>

            <div className="grid grid-cols-5 gap-2">
              {questionOrder.map((actualIdx, displayIdx) => {
                const isAnswered = userAnswers[actualIdx] !== null;
                const isFlagged = flaggedQuestions.has(actualIdx);
                const isCurrent = displayIdx === currentDisplayIndex;

                return (
                  <button
                    key={displayIdx}
                    onClick={() => navigateToQuestion(displayIdx)}
                    className={`relative w-10 h-10 rounded-lg text-xs font-medium transition-all border
                      ${isCurrent
                        ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-300'
                        : isAnswered
                          ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800'
                          : 'bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'
                      } hover:scale-105`}
                  >
                    {displayIdx + 1}
                    {isFlagged && (
                      <Flag className="absolute -top-1 -right-1 h-3 w-3 text-amber-500" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Summary */}
            <div className="mt-4 space-y-2 text-xs text-gray-500 dark:text-gray-400">
              <div className="flex justify-between">
                <span>Answered</span>
                <span className="font-medium text-gray-700 dark:text-gray-300">{answeredCount}/{questionCount}</span>
              </div>
              <div className="flex justify-between">
                <span>Flagged</span>
                <span className="font-medium text-amber-600">{flaggedCount}</span>
              </div>
              {settings.lockAnswers && (
                <div className="flex justify-between">
                  <span>Locked</span>
                  <span className="font-medium text-blue-600">{confirmedAnswers.size}</span>
                </div>
              )}
            </div>

            {/* Submit from navigator */}
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full mt-4 bg-gradient-to-r from-red-600 to-orange-600 text-white text-sm"
              size="sm"
            >
              <Send className="h-3.5 w-3.5 mr-1.5" /> Submit Exam
            </Button>
          </div>
        )}
      </div>

      {/* Submit Confirmation Modal */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 z-[110] bg-black/50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full shadow-2xl dark:bg-gray-900">
            <CardContent className="p-6 text-center space-y-4">
              <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto" />
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">Submit Exam?</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                You have <span className="font-bold text-amber-600">{unansweredCount}</span> unanswered question{unansweredCount > 1 ? 's' : ''}.
                {flaggedCount > 0 && (
                  <> and <span className="font-bold text-amber-600">{flaggedCount}</span> flagged question{flaggedCount > 1 ? 's' : ''}.</>
                )}
              </p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowSubmitConfirm(false)}
                  className="flex-1"
                >
                  Continue Exam
                </Button>
                <Button
                  onClick={doSubmit}
                  className="flex-1 bg-red-600 text-white hover:bg-red-700"
                >
                  Submit Anyway
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
