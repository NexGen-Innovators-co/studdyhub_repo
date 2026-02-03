// src/components/quizzes/components/LiveQuizActive.tsx
import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Alert, AlertDescription } from '../../ui/alert';
import {
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  ArrowRight,
  AlertCircle,
  RefreshCw,
  UserCog,
} from 'lucide-react';
import {
  LiveQuizSession,
  LiveQuizPlayer,
  LiveQuizQuestion,
  submitAnswer,
  advanceToNextQuestion,
  endQuizSession,
  advanceQuestionFallback,
} from '@/services/liveQuizService';

interface LiveQuizActiveProps {
  session: LiveQuizSession | null;
  players: LiveQuizPlayer[];
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
  }, [currentQuestion?.id]);

  // --- Handlers ---
  const handleSubmitAnswer = async () => {
    if (selectedAnswer === null || !currentQuestion || !session || !isPlayer) return;

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

      toast({
        title: result.isCorrect ? '✅ Correct!' : '❌ Incorrect',
        description: result.isCorrect ? `+${result.points} points` : 'Better luck next time!',
        variant: result.isCorrect ? 'default' : 'destructive',
      });

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

          {/* Header row: badge + timer */}
          <div className="flex items-start justify-between">
            <div>
              <Badge variant="secondary" className="text-sm mb-2">
                Question {questionNumber} of {totalQuestions}
              </Badge>
              <CardTitle className="text-xl mt-1">{currentQuestion.question_text}</CardTitle>
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
                  onClick={() => !isDisabled && setSelectedAnswer(index)}
                  disabled={isDisabled}
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

          {/* ─── Submit / Feedback ─── */}
          {!hasAnswered ? (
            <Button
              onClick={handleSubmitAnswer}
              disabled={selectedAnswer === null || isLoading || timeRemaining === 0 || !isPlayer}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-4 text-base rounded-xl"
            >
              {isLoading ? (
                <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Submitting…</>
              ) : timeRemaining === 0 ? (
                <><Clock className="h-5 w-5 mr-2" /> Time's Up!</>
              ) : !isPlayer ? (
                <><UserCog className="h-5 w-5 mr-2" /> Mediator (No Answer)</>
              ) : (
                <>Submit Answer <ArrowRight className="h-5 w-5 ml-2" /></>
              )}
            </Button>
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
