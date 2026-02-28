// src/components/quizzes/components/LiveQuizActive.tsx
import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Alert, AlertDescription } from '../../ui/alert';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  ArrowRight,
  AlertCircle,
  RefreshCw,
  UserCog,
  Maximize2,
  Minimize2,
  Zap,
  Trophy,
  Target,
  Sparkles,
} from 'lucide-react';
import {
  LiveQuizSession,
  LiveQuizPlayer,
  LiveQuizQuestion,
  LiveQuizAnswer,
  submitAnswer,
  advanceToNextQuestion,
  endQuizSession,
  advanceQuestionFallback,
} from '@/services/liveQuizService';
import LiveQuizActiveFullscreen from './LiveQuizActiveFullscreen';

interface LiveQuizActiveProps {
  session: LiveQuizSession | null;
  players: LiveQuizPlayer[];
  answers: LiveQuizAnswer[];
  currentQuestion: LiveQuizQuestion | null;
  allQuestions: LiveQuizQuestion[];
  selectedAnswer: number | null;
  setSelectedAnswer: (answer: number | null) => void;
  hasAnswered: boolean;
  setHasAnswered: (answered: boolean) => void;
  timeRemaining: number;
  isLoading: boolean;
  error: string | null;
  setError: (error: string | null) => void;
  isHost: boolean;
  userId: string;
  isPlayer: boolean;
  refreshSessionState: () => Promise<void>;
  setIsLoading: (loading: boolean) => void;
  resetView: () => void;
  toast: any;
}

// Circular SVG timer ring
const TimerRing: React.FC<{ timeRemaining: number; timeLimit: number }> = ({ timeRemaining, timeLimit }) => {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const progress = timeLimit > 0 ? timeRemaining / timeLimit : 0;
  const offset = circumference * (1 - progress);

  const isUrgent = timeRemaining <= 5;
  const isMid = timeRemaining <= 15 && timeRemaining > 5;

  return (
    <div className="relative flex items-center justify-center" style={{ width: 72, height: 72 }}>
      <svg width="72" height="72" className="-rotate-90">
        {/* Track */}
        <circle
          cx="36" cy="36" r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="5"
        />
        {/* Progress arc */}
        <circle
          cx="36" cy="36" r={radius}
          fill="none"
          stroke={isUrgent ? '#ef4444' : isMid ? '#f59e0b' : '#3b82f6'}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.8s linear, stroke 0.4s ease' }}
        />
      </svg>
      <span
        className={`absolute text-lg font-bold tabular-nums ${
          isUrgent ? 'text-red-500 animate-pulse' : isMid ? 'text-amber-500' : 'text-gray-700 dark:text-gray-200'
        }`}
      >
        {timeRemaining}
      </span>
    </div>
  );
};

const LiveQuizActive: React.FC<LiveQuizActiveProps> = ({
  session,
  answers,
  players,
  currentQuestion,
  allQuestions,
  selectedAnswer,
  setSelectedAnswer,
  hasAnswered,
  setHasAnswered,
  timeRemaining,
  isLoading,
  error,
  setError,
  isHost,
  userId,
  isPlayer,
  refreshSessionState,
  setIsLoading,
  resetView,
  toast,
}) => {
  // Track whether we already fired the timeout submission for this question
  // so we don't double-submit on re-renders.
  const timeoutFiredRef = useRef<string | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(true);
  const [showCorrectAnswer, setShowCorrectAnswer] = useState(false);
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number }>>([]);
  // (Previously used undo timer) ref kept for safety but we now submit immediately on selection.
  const undoTimeoutRef = useRef<number | null>(null);

  // FIX: submit a "timeout" answer to the backend when time runs out and the
  // player hasn't answered yet. Do NOT mark an answer as selected locally.
  useEffect(() => {
    if (
      timeRemaining !== 0 ||          // only when time is exactly 0
      hasAnswered ||                   // already answered
      isLoading ||                     // submit already in-flight
      !isPlayer ||                     // mediators don't answer
      !currentQuestion ||
      !session ||
      timeoutFiredRef.current === currentQuestion.id  // already fired for this question
    ) return;

    timeoutFiredRef.current = currentQuestion.id;

    // Submit -1 (no answer) to the backend so the server records a timeout
    submitAnswer(session.id, currentQuestion.id, -1, currentQuestion.time_limit || 0);

    toast({
      title: "⏱️ Time's Up!",
      description: 'No answer was submitted in time.',
      variant: 'destructive',
    });
  }, [timeRemaining, hasAnswered, isLoading, isPlayer, currentQuestion, session, toast]);

  // Reset the timeout-fired guard whenever the question changes
  useEffect(() => {
    timeoutFiredRef.current = null;
    setShowCorrectAnswer(false);
    setParticles([]);
  }, [currentQuestion?.id]);

  // Show correct answer after submission
  useEffect(() => {
    if (hasAnswered && !isHost) {
      setTimeout(() => setShowCorrectAnswer(true), 800);
    }
  }, [hasAnswered, isHost]);

  // Create celebration particles
  const createParticles = () => {
    const newParticles = Array.from({ length: 20 }, (_, i) => ({
      id: Date.now() + i,
      x: Math.random() * 100,
      y: Math.random() * 100,
    }));
    setParticles(newParticles);
    setTimeout(() => setParticles([]), 2000);
  };

  // Cleanup any stray timers on unmount
  useEffect(() => {
    return () => {
      if (undoTimeoutRef.current) {
        window.clearTimeout(undoTimeoutRef.current);
        undoTimeoutRef.current = null;
      }
    };
  }, []);

  // Accessibility: ARIA announcements for SR and keyboard navigation
  const [ariaAnnouncement, setAriaAnnouncement] = useState<string>('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isPlayer || hasAnswered || isLoading || timeRemaining === 0) return;
      if (!currentQuestion) return;

      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const next = selectedAnswer === null ? 0 : Math.max(0, selectedAnswer - 1);
        setSelectedAnswer(next);
        setAriaAnnouncement(`Selected option ${String.fromCharCode(65 + next)}.`);
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        const next = selectedAnswer === null ? 0 : Math.min(currentQuestion.options.length - 1, selectedAnswer + 1);
        setSelectedAnswer(next);
        setAriaAnnouncement(`Selected option ${String.fromCharCode(65 + next)}.`);
      }
      if (e.key === 'Enter') {
        e.preventDefault();
          if (selectedAnswer !== null) {
          // submit immediately
          if (undoTimeoutRef.current) {
            window.clearTimeout(undoTimeoutRef.current);
            undoTimeoutRef.current = null;
          }
          setAriaAnnouncement('Submitting answer.');
          handleSubmitAnswer();
        }
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isPlayer, hasAnswered, isLoading, timeRemaining, currentQuestion, selectedAnswer]);

  // --- Handlers ---
  const handleOptionSelect = (index: number) => {
    if (hasAnswered || isLoading || !isPlayer || timeRemaining === 0 || !currentQuestion || !session) return;

    setSelectedAnswer(index);

    // clear any stray timer
    if (undoTimeoutRef.current) {
      window.clearTimeout(undoTimeoutRef.current);
      undoTimeoutRef.current = null;
    }

    setAriaAnnouncement(`Selected option ${String.fromCharCode(65 + index)}. Submitting.`);
    // Submit immediately on selection
    handleSubmitAnswer();
  };

  const handleSubmitAnswer = async () => {
    if (selectedAnswer === null || !currentQuestion || !session || !isPlayer) return;

    // Clear any pending auto-submit undo timer to avoid duplicate submissions
    if (undoTimeoutRef.current) {
      window.clearTimeout(undoTimeoutRef.current);
      undoTimeoutRef.current = null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const timeTaken = currentQuestion.start_time
        ? Math.floor((Date.now() - new Date(currentQuestion.start_time).getTime()) / 1000)
        : 0;

      const result = await submitAnswer(session.id, currentQuestion.id, selectedAnswer, timeTaken);

      if (result.error) {
        // If the backend says this answer already exists (409), treat as submitted.
        if (result.error.includes('409') || result.error.toLowerCase().includes('conflict')) {
          setHasAnswered(true);
          setTimeout(() => refreshSessionState(), 300);
            return;
          }
          throw new Error(result.error);
        }
      setHasAnswered(true);

      // Create celebration particles for correct answers
      if (result.isCorrect) {
        createParticles();
      }

      toast({
        title: result.isCorrect ? '✅ Correct!' : '❌ Incorrect',
        description: result.isCorrect ? `+${result.points} points` : 'Better luck next time!',
        variant: result.isCorrect ? 'default' : 'destructive',
      });

      setAriaAnnouncement(result.isCorrect ? 'Correct answer submitted.' : 'Answer submitted.');

      setTimeout(() => refreshSessionState(), 500);
    } catch (err: any) {
      // console.error('Error submitting answer:', err);
      setError(err.message || 'Failed to submit answer');
      toast({ title: 'Error', description: err.message || 'Failed to submit answer', variant: 'destructive' });
      setHasAnswered(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNextQuestion = async () => {
    if (!session || !isHost) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await advanceToNextQuestion(session.id);
      if (result.error) throw new Error(result.error);

      setHasAnswered(false);
      setSelectedAnswer(null);
      await refreshSessionState();

      toast({ title: 'Question Advanced', description: 'Next question is now active' });
    } catch (err: any) {
      // console.error('Error advancing question:', err);
      setError(err.message || 'Failed to advance');
      toast({ title: 'Error', description: err.message || 'Failed to advance', variant: 'destructive' });

      // Try fallback
      try {
        const fb = await advanceQuestionFallback(session.id);
        if (fb.error) throw new Error(fb.error);
        setHasAnswered(false);
        setSelectedAnswer(null);
        await refreshSessionState();
        toast({ title: 'Advanced (Fallback)', description: 'Question advanced via fallback' });
      } catch (fbErr: any) {
        toast({ title: 'Fallback Failed', description: fbErr.message || 'Could not advance', variant: 'destructive' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleEndQuiz = async () => {
    if (!session || !isHost) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await endQuizSession(session.id);
      if (result.error) throw new Error(result.error);

      toast({ title: 'Quiz Ended', description: 'Thanks for playing!' });
      await refreshSessionState();
    } catch (err: any) {
      setError(err.message || 'Failed to end quiz');
      toast({ title: 'Error', description: err.message || 'Failed to end quiz', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  // --- Empty / loading states ---
  if (!currentQuestion) {
    if (allQuestions.length === 0 || allQuestions.every(q => q.end_time)) return null;

    return (
      <div className="max-w-4xl mx-auto">
        <Card className="rounded-2xl">
          <CardContent className="py-16 text-center">
            <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-blue-500" />
            <p className="text-gray-600 dark:text-gray-400 text-lg">Finding current question…</p>
            <Button onClick={resetView} variant="ghost" className="mt-4">Return to Menu</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- Derived values ---
  const questionNumber = currentQuestion.question_index + 1;
  const totalQuestions = allQuestions.length;
  const playingPlayers = players.filter(p => p.is_playing);
  const timeLimit = currentQuestion.time_limit || session?.config?.question_time_limit || 30;
  const playersAnswered = players.filter(
    p => p.last_answered_at && new Date(p.last_answered_at) >= new Date(currentQuestion.start_time || 0) && p.is_playing
  ).length;

  // If fullscreen mode, render the fullscreen component
  if (isFullScreen) {
    return (
      <LiveQuizActiveFullscreen
        answers={answers}
        session={session}
        players={players}
        currentQuestion={currentQuestion}
        allQuestions={allQuestions}
        selectedAnswer={selectedAnswer}
        setSelectedAnswer={setSelectedAnswer}
        hasAnswered={hasAnswered}
        setHasAnswered={setHasAnswered}
        timeRemaining={timeRemaining}
        isLoading={isLoading}
        error={error}
        setError={setError}
        isHost={isHost}
        userId={userId}
        isPlayer={isPlayer}
        refreshSessionState={refreshSessionState}
        setIsLoading={setIsLoading}
        resetView={resetView}
        toast={toast}
        onExitFullscreen={() => setIsFullScreen(false)}
      />
    );
  }

  return (
      <Card className="rounded-2xl border-2 shadow-lg">
        <CardHeader>
          {/* Progress bar */}
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mb-4">
            <div
              className="bg-gradient-to-r from-blue-500 to-purple-500 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${(questionNumber / totalQuestions) * 100}%` }}
            />
          </div>

          {/* Header row: badge + timer + fullscreen button */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsFullScreen(true)}
                className="hover:bg-blue-50 dark:hover:bg-blue-900/20"
                title="Enter Fullscreen"
              >
                <Maximize2 className="h-5 w-5" />
              </Button>
              <div>
              <Badge variant="secondary" className="text-sm mb-2">
                Question {questionNumber} of {totalQuestions}
              </Badge>
              <CardTitle className="text-xl mt-1">{currentQuestion.question_text}</CardTitle>
            </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost" size="sm"
                onClick={() => refreshSessionState()}
                disabled={isLoading}
                title="Refresh"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
              <TimerRing timeRemaining={timeRemaining} timeLimit={timeLimit} />
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* ─── Answer Options ─── */}
          <div className="grid gap-3">
            {currentQuestion.options.map((option, index) => {
              const isSelected = selectedAnswer === index;
              const isCorrect = hasAnswered && currentQuestion.correct_answer === index;
              const isWrong = hasAnswered && isSelected && currentQuestion.correct_answer !== index;
              const isDisabled = hasAnswered || !isPlayer || timeRemaining === 0;

              return (
                <button
                  key={index}
                  onClick={() => handleOptionSelect(index)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleOptionSelect(index);
                    }
                  }}
                  disabled={isDisabled}
                  aria-pressed={isSelected}
                  aria-label={`Option ${String.fromCharCode(65 + index)}: ${option}`}
                  aria-disabled={isDisabled}
                    className={[
                    'p-4 text-left rounded-xl border-2 transition-all duration-200',
                    // Base
                    'flex items-center justify-between',
                    // Hover (only when interactive)
                    !isDisabled ? 'hover:scale-[1.015] hover:shadow-md' : '',
                    // States
                    isSelected && !hasAnswered
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 shadow-md shadow-blue-100'
                      : '',
                    isCorrect
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/30 animate-[pulse_0.6s_ease]'
                      : '',
                    isWrong
                      ? 'border-red-500 bg-red-50 dark:bg-red-900/30 animate-[shake_0.4s_ease]'
                      : '',
                    !hasAnswered && !isSelected && isPlayer
                      ? 'border-gray-200 dark:border-gray-700 hover:border-blue-300'
                      : '',
                    isDisabled && !isCorrect && !isWrong
                      ? 'opacity-60 cursor-not-allowed'
                      : 'cursor-pointer',
                  ].join(' ')}
                >
                  <span className="flex items-center gap-3">
                    {/* Option letter bubble */}
                    <span className={[
                      'w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold',
                      isCorrect ? 'bg-green-500 text-white' :
                      isWrong ? 'bg-red-500 text-white' :
                      isSelected ? 'bg-blue-500 text-white' :
                      'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
                    ].join(' ')}>
                      {String.fromCharCode(65 + index)}
                    </span>
                    <span className="font-medium">{option}</span>
                  </span>
                  {isCorrect && <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />}
                  {isWrong && <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* ARIA live region for announcements (screen readers) */}
          <div aria-live="polite" role="status" className="sr-only">
            {ariaAnnouncement}
          </div>

          {/* ─── Undo / Feedback / Hint ─── */}
          {!hasAnswered ? (
            !isPlayer ? (
              <Button
                disabled
                className="w-full text-white font-semibold py-4 text-base rounded-xl"
              >
                <UserCog className="h-5 w-5 mr-2" /> Mediator (No Answer)
              </Button>
            ) : isLoading ? (
              <Button disabled className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold py-4 text-base rounded-xl">
                <Loader2 className="h-5 w-5 mr-2 animate-spin" /> Submitting…
              </Button>
            ) : (
              <div className="text-sm text-gray-600 dark:text-gray-400 py-4">Tap an option to answer — it submits immediately</div>
            )
          ) : (
            <div className="text-center py-5 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl border border-green-200 dark:border-green-800">
              <CheckCircle className="h-10 w-10 mx-auto text-green-500 mb-2" />
              <p className="font-semibold">Answer Submitted!</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {isHost
                  ? session?.advance_mode === 'auto' ? 'Waiting for auto-advance…' : 'Click "Next Question" when ready'
                  : 'Waiting for next question…'}
              </p>
            </div>
          )}

          {/* Time-up warning for non-hosts who haven't answered (mediators skip this) */}
          {timeRemaining === 0 && !hasAnswered && !isHost && isPlayer && (
            <Alert className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
              <Clock className="h-4 w-4 text-amber-500" />
              <AlertDescription className="text-amber-800 dark:text-amber-200">
                Time's up! {session?.advance_mode === 'auto' ? 'Waiting for auto-advance…' : 'Waiting for host…'}
              </AlertDescription>
            </Alert>
          )}

          {/* ─── Host Controls ─── */}
          {isHost && (
            <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-700 mt-2">
              {/* Players answered indicator */}
              <div className="flex items-center justify-between text-sm bg-slate-50 dark:bg-slate-800 rounded-lg px-4 py-2.5">
                <span className="text-gray-600 dark:text-gray-400 font-medium">Players answered</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: playingPlayers.length > 0 ? `${(playersAnswered / playingPlayers.length) * 100}%` : '0%' }}
                    />
                  </div>
                  <span className="font-bold text-blue-600 dark:text-blue-400">
                    {playersAnswered} / {playingPlayers.length}
                  </span>
                </div>
              </div>

              {/* Advance / End buttons */}
              <div className="flex gap-2">
                {session?.advance_mode === 'manual' ? (
                  <Button
                    onClick={handleNextQuestion}
                    disabled={isLoading || timeRemaining > 0}
                    className="flex-1 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white"
                  >
                    {timeRemaining > 0 ? (
                      <><Clock className="h-4 w-4 mr-2" /> Wait {timeRemaining}s</>
                    ) : (
                      <>Next Question <ArrowRight className="h-4 w-4 ml-2" /></>
                    )}
                  </Button>
                ) : (
                  <Button
                    onClick={handleNextQuestion}
                    variant="outline"
                    disabled={isLoading || timeRemaining > 0}
                    className="flex-1"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    {timeRemaining > 0 ? `Auto-advance in ${timeRemaining}s` : 'Force Next'}
                  </Button>
                )}
                <Button onClick={handleEndQuiz} variant="destructive" disabled={isLoading}>
                  End Quiz
                </Button>
              </div>

              {timeRemaining === 0 && session?.advance_mode === 'auto' && (
                <p className="text-xs text-center text-gray-500 dark:text-gray-400">
                  Auto-advancing… if it stalls, click "Force Next" above.
                </p>
              )}
            </div>
          )}
          </CardContent>
        </Card>
  );
};

export default LiveQuizActive;
