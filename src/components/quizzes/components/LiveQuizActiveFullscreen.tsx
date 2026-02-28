// src/components/quizzes/components/LiveQuizActiveFullscreen.tsx
import React, { useEffect, useRef, useState } from 'react';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock, CheckCircle, XCircle, Loader2, ArrowRight, AlertCircle,
  RefreshCw, UserCog, X, Zap, Trophy, Target, Sparkles,
  Users, Volume2, VolumeX, LogOut,
} from 'lucide-react';
import {
  LiveQuizSession, LiveQuizPlayer, LiveQuizQuestion, LiveQuizAnswer,
  submitAnswer, advanceToNextQuestion, endQuizSession, advanceQuestionFallback,
} from '@/services/liveQuizService';

interface LiveQuizActiveFullscreenProps {
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
  onExitFullscreen: () => void;
}

// ─── Timer Ring ─────────────────────────────────────────────────────────────
const TimerRing: React.FC<{ timeRemaining: number; timeLimit: number }> = ({ timeRemaining, timeLimit }) => {
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const progress = timeLimit > 0 ? timeRemaining / timeLimit : 0;
  const offset = circumference * (1 - progress);
  const isUrgent = timeRemaining <= 5;
  const isMid = timeRemaining <= 15 && timeRemaining > 5;

  return (
    <div className="relative flex items-center justify-center" style={{ width: 110, height: 110 }}>
      <svg width="110" height="110" className="-rotate-90">
        <circle cx="55" cy="55" r={radius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
        <circle
          cx="55" cy="55" r={radius} fill="none"
          stroke={isUrgent ? '#ef4444' : isMid ? '#f59e0b' : '#10b981'}
          strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={isUrgent ? 'animate-pulse' : ''}
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s ease' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <Clock className={`h-5 w-5 mb-0.5 ${isUrgent ? 'text-red-400 animate-pulse' : 'text-white/60'}`} />
        <span className={`text-3xl font-black tabular-nums leading-none ${isUrgent ? 'text-red-400 animate-pulse' : isMid ? 'text-amber-400' : 'text-white'}`}>
          {timeRemaining}
        </span>
      </div>
    </div>
  );
};

// ─── Answer option colors (Kahoot-style) ────────────────────────────────────
const OPTION_STYLES = [
  { base: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.4)', selected: 'rgba(239,68,68,0.45)', glow: 'rgba(239,68,68,0.3)', icon: '▲', label: 'A' },
  { base: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.4)', selected: 'rgba(59,130,246,0.45)', glow: 'rgba(59,130,246,0.3)', icon: '◆', label: 'B' },
  { base: 'rgba(234,179,8,0.15)', border: 'rgba(234,179,8,0.4)', selected: 'rgba(234,179,8,0.45)', glow: 'rgba(234,179,8,0.3)', icon: '●', label: 'C' },
  { base: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.4)', selected: 'rgba(16,185,129,0.45)', glow: 'rgba(16,185,129,0.3)', icon: '■', label: 'D' },
];

const LiveQuizActiveFullscreen: React.FC<LiveQuizActiveFullscreenProps> = ({
  session, answers, players, currentQuestion, allQuestions,
  selectedAnswer, setSelectedAnswer, hasAnswered, setHasAnswered,
  timeRemaining, isLoading, error, setError, isHost, userId, isPlayer,
  refreshSessionState, setIsLoading, resetView, toast, onExitFullscreen,
}) => {
  const timeoutFiredRef = useRef<string | null>(null);
  const [showCorrectAnswer, setShowCorrectAnswer] = useState(false);
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; color: string; size: number; rotation: number; velocityX: number; velocityY: number }>>([]);
  const [answerResult, setAnswerResult] = useState<{ isCorrect: boolean; points: number } | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const undoTimeoutRef = useRef<number | null>(null);

  // Audio refs
  const bgMusicRef = useRef<HTMLAudioElement | null>(null);
  const correctSfxRef = useRef<HTMLAudioElement | null>(null);
  const incorrectSfxRef = useRef<HTMLAudioElement | null>(null);
  const startSfxRef = useRef<HTMLAudioElement | null>(null);
  const thinkingLoopRef = useRef<HTMLAudioElement | null>(null);
  const tickRef = useRef<HTMLAudioElement | null>(null);
  const submitSfxRef = useRef<HTMLAudioElement | null>(null);
  const advanceSfxRef = useRef<HTMLAudioElement | null>(null);
  const endSfxRef = useRef<HTMLAudioElement | null>(null);
  const clickSfxRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio
  useEffect(() => {
    const bgUrl = 'https://kegsrvnywshxyucgjxml.supabase.co/storage/v1/object/public/documents/sonican-informational-quiz-loop-397409.mp3';
    const correctUrl = 'https://kegsrvnywshxyucgjxml.supabase.co/storage/v1/object/public/documents/mixkit-correct-answer-tone-2870.wav';
    const tickUrl = 'https://kegsrvnywshxyucgjxml.supabase.co/storage/v1/object/public/documents/mixkit-fast-wall-clock-ticking-1063.wav';
    const incorrectUrl = 'https://kegsrvnywshxyucgjxml.supabase.co/storage/v1/object/public/documents/mixkit-wrong-answer-fail-notification-946.wav';
    const endUrl = 'https://kegsrvnywshxyucgjxml.supabase.co/storage/v1/object/public/documents/mixkit-end-of-show-clapping-crowd-477.wav';

    bgMusicRef.current = new Audio(bgUrl);
    try { (bgMusicRef.current as any).crossOrigin = 'anonymous'; } catch (e) {}
    bgMusicRef.current.loop = true;
    bgMusicRef.current.volume = 0.3;

    correctSfxRef.current = new Audio(correctUrl);
    incorrectSfxRef.current = new Audio(incorrectUrl);
    thinkingLoopRef.current = new Audio(bgUrl);
    thinkingLoopRef.current.loop = true;
    thinkingLoopRef.current.volume = 0.45;
    tickRef.current = new Audio(tickUrl);
    endSfxRef.current = new Audio(endUrl);
    startSfxRef.current = new Audio(correctUrl);
    submitSfxRef.current = new Audio(correctUrl);
    advanceSfxRef.current = new Audio(tickUrl);
    clickSfxRef.current = new Audio(tickUrl);

    const playMusic = async () => {
      try { if (bgMusicRef.current && !isMuted) await bgMusicRef.current.play(); } catch (err) {}
    };
    playMusic();

    return () => {
      if (bgMusicRef.current) { bgMusicRef.current.pause(); bgMusicRef.current = null; }
    };
  }, []);

  // Mute toggle
  useEffect(() => {
    if (bgMusicRef.current) {
      if (isMuted) { bgMusicRef.current.pause(); }
      else { bgMusicRef.current.play().catch(() => {}); }
    }
    if (thinkingLoopRef.current) {
      if (isMuted) { thinkingLoopRef.current.pause(); }
      else if (currentQuestion) { thinkingLoopRef.current.play().catch(() => {}); }
    }
  }, [isMuted]);

  // Reset on question change
  useEffect(() => {
    timeoutFiredRef.current = null;
    setShowCorrectAnswer(false);
    setParticles([]);
    setAnswerResult(null);
    try {
      if (!isMuted && startSfxRef.current) { startSfxRef.current.currentTime = 0; startSfxRef.current.play().catch(() => {}); }
      if (!isMuted && thinkingLoopRef.current) { thinkingLoopRef.current.currentTime = 0; thinkingLoopRef.current.play().catch(() => {}); }
    } catch (e) {}
  }, [currentQuestion?.id]);

  useEffect(() => {
    return () => {
      if (undoTimeoutRef.current) { window.clearTimeout(undoTimeoutRef.current); undoTimeoutRef.current = null; }
    };
  }, []);

  useEffect(() => {
    const update = () => setIsMobile(typeof window !== 'undefined' ? window.innerWidth < 640 : false);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    if (hasAnswered && !isHost) setTimeout(() => setShowCorrectAnswer(true), 1000);
  }, [hasAnswered, isHost]);

  useEffect(() => {
    if (thinkingLoopRef.current) {
      if (hasAnswered || timeRemaining === 0) {
        try { thinkingLoopRef.current.pause(); } catch (e) {}
      } else if (!isMuted && currentQuestion) {
        try { thinkingLoopRef.current.play().catch(() => {}); } catch (e) {}
      }
    }
  }, [hasAnswered, timeRemaining, isMuted, currentQuestion]);

  const createConfetti = () => {
    const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD'];
    const np = Array.from({ length: 100 }, (_, i) => ({
      id: Date.now() + i,
      x: 50, y: 50,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.random() * 10 + 5,
      rotation: Math.random() * 360,
      velocityX: (Math.random() - 0.5) * 100,
      velocityY: (Math.random() - 0.5) * 100,
    }));
    setParticles(np);
    if (!isMuted && correctSfxRef.current) { correctSfxRef.current.currentTime = 0; correctSfxRef.current.play().catch(() => {}); }
    setTimeout(() => setParticles([]), 4000);
  };

  const playIncorrectSound = () => {
    if (!isMuted && incorrectSfxRef.current) { incorrectSfxRef.current.currentTime = 0; incorrectSfxRef.current.play().catch(() => {}); }
  };

  // Auto-submit on timeout
  useEffect(() => {
    if (
      timeRemaining !== 0 || hasAnswered || isLoading || !isPlayer ||
      !currentQuestion || !session || timeoutFiredRef.current === currentQuestion.id
    ) return;
    timeoutFiredRef.current = currentQuestion.id;
    try {
      if (!isMuted && submitSfxRef.current) { submitSfxRef.current.currentTime = 0; submitSfxRef.current.play().catch(() => {}); }
    } catch (e) {}
    submitAnswer(session.id, currentQuestion.id, -1, currentQuestion.time_limit || 0);
    if (!isMobile) toast({ title: "⏱️ Time's Up!", description: 'No answer was submitted in time.', variant: 'destructive' });
  }, [timeRemaining, hasAnswered, isLoading, isPlayer, currentQuestion, session, toast]);

  // ─── Handlers ───────────────────────────────────────────────────────────────
  const handleSubmitAnswer = async () => {
    if (selectedAnswer === null || !currentQuestion || !session || !isPlayer) return;
    if (undoTimeoutRef.current) { window.clearTimeout(undoTimeoutRef.current); undoTimeoutRef.current = null; }
    setIsLoading(true);
    setError(null);
    try {
      try {
        if (!isMuted && submitSfxRef.current) { submitSfxRef.current.currentTime = 0; submitSfxRef.current.play().catch(() => {}); }
      } catch (e) {}
      const timeTaken = currentQuestion.start_time
        ? Math.floor((Date.now() - new Date(currentQuestion.start_time).getTime()) / 1000) : 0;
      const result = await submitAnswer(session.id, currentQuestion.id, selectedAnswer, timeTaken);
      if (result.error) {
        if (result.error.includes('409') || result.error.toLowerCase().includes('conflict')) {
          setHasAnswered(true);
          setTimeout(() => refreshSessionState(), 300);
          return;
        }
        throw new Error(result.error);
      }
      setHasAnswered(true);
      setAnswerResult({ isCorrect: result.isCorrect, points: result.points });
      if (result.isCorrect) { createConfetti(); }
      else { playIncorrectSound(); }
      setTimeout(() => refreshSessionState(), 500);
    } catch (err: any) {
      setError(err.message || 'Failed to submit answer');
      toast({ title: 'Error', description: err.message || 'Failed to submit answer', variant: 'destructive' });
      setHasAnswered(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOptionSelect = (index: number) => {
    if (hasAnswered || isLoading || !isPlayer || timeRemaining === 0 || !currentQuestion || !session) return;
    setSelectedAnswer(index);
    if (undoTimeoutRef.current) { window.clearTimeout(undoTimeoutRef.current); undoTimeoutRef.current = null; }
    handleSubmitAnswer();
  };

  const handleNextQuestion = async () => {
    if (!session || !isHost) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await advanceToNextQuestion(session.id);
      if (result.error) throw new Error(result.error);
      try {
        if (!isMuted && advanceSfxRef.current) { advanceSfxRef.current.currentTime = 0; advanceSfxRef.current.play().catch(() => {}); }
      } catch (e) {}
      setHasAnswered(false);
      setSelectedAnswer(null);
      await refreshSessionState();
      if (!isMobile) toast({ title: 'Question Advanced', description: 'Next question is now active' });
    } catch (err: any) {
      setError(err.message || 'Failed to advance');
      if (!isMobile) toast({ title: 'Error', description: err.message || 'Failed to advance', variant: 'destructive' });
      try {
        const fb = await advanceQuestionFallback(session.id);
        if (fb.error) throw new Error(fb.error);
        setHasAnswered(false);
        setSelectedAnswer(null);
        await refreshSessionState();
        if (!isMobile) toast({ title: 'Advanced (Fallback)', description: 'Question advanced via fallback' });
      } catch (fbErr: any) {
        if (!isMobile) toast({ title: 'Fallback Failed', description: fbErr.message || 'Could not advance', variant: 'destructive' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleEndQuiz = async () => {
    if (!session || !isHost) return;
    setIsLoading(true);
    setError(null);
    const audioRefs = [bgMusicRef, correctSfxRef, incorrectSfxRef, startSfxRef, thinkingLoopRef, tickRef, submitSfxRef, advanceSfxRef, clickSfxRef];
    audioRefs.forEach(ref => { if (ref.current) { try { ref.current.pause(); ref.current.currentTime = 0; } catch {} } });
    try {
      const result = await endQuizSession(session.id);
      if (result.error) throw new Error(result.error);
      try {
        if (!isMuted && endSfxRef.current) {
          const applause = endSfxRef.current.cloneNode(true) as HTMLAudioElement;
          applause.volume = endSfxRef.current.volume;
          applause.play().catch(() => {});
        }
      } catch (e) {}
      if (!isMobile) toast({ title: 'Quiz Ended', description: 'Thanks for playing!' });
      await refreshSessionState();
    } catch (err: any) {
      setError(err.message || 'Failed to end quiz');
      if (!isMobile) toast({ title: 'Error', description: err.message || 'Failed to end quiz', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  if (!session || !currentQuestion) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#0f0c29,#302b63,#24243e)' }}>
        <div className="text-center text-white">
          <Loader2 className="h-16 w-16 animate-spin mx-auto mb-4 text-indigo-400" />
          <p className="text-xl text-white/70">Loading quiz…</p>
        </div>
      </div>
    );
  }

  // Derived values
  const currentIndex = allQuestions.findIndex(q => q.id === currentQuestion.id);
  const totalQuestions = allQuestions.length;
  const progressPercent = totalQuestions > 0 ? ((currentIndex + 1) / totalQuestions) * 100 : 0;
  const playingPlayers = players.filter(p => p.is_playing);
  const playersAnswered = playingPlayers.filter(
    p => p.last_answered_at && new Date(p.last_answered_at) >= new Date(currentQuestion.start_time || 0)
  ).length;
  const answerOptions = currentQuestion.options || [];
  const correctIndex = currentQuestion.correct_answer;

  const COSMIC: React.CSSProperties = { background: 'linear-gradient(135deg,#0f0c29,#302b63,#24243e)' };
  const GLASS = (extra?: string): React.CSSProperties => ({
    background: extra || 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    backdropFilter: 'blur(12px)',
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 overflow-auto"
      style={COSMIC}
    >
      {/* Ambient blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full blur-3xl" style={{ background: 'rgba(99,102,241,0.1)' }} />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 rounded-full blur-3xl" style={{ background: 'rgba(139,92,246,0.08)' }} />
      </div>

      {/* Confetti particles */}
      <AnimatePresence>
        {particles.map(particle => (
          <motion.div
            key={particle.id}
            initial={{ opacity: 1, scale: 0, x: '50vw', y: '50vh', rotate: 0 }}
            animate={{ opacity: 0, scale: 1, x: `calc(50vw + ${particle.velocityX}vw)`, y: `calc(50vh + ${particle.velocityY}vh)`, rotate: particle.rotation }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
            className="fixed pointer-events-none rounded-sm z-[100]"
            style={{ backgroundColor: particle.color, width: particle.size, height: particle.size, left: 0, top: 0 }}
          />
        ))}
      </AnimatePresence>

      {/* Top bar: controls */}
      <div
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 sm:px-6 py-3"
        style={{ background: 'rgba(0,0,0,0.4)', borderBottom: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(16px)' }}
      >
        {/* Left: progress + question counter */}
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl" style={GLASS()}>
            <Target className="h-4 w-4 text-indigo-400" />
            <span className="text-white font-bold text-sm">{currentIndex + 1} / {totalQuestions}</span>
          </div>
          {/* Progress bar */}
          <div className="flex-1 max-w-xs hidden md:block">
            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: 'linear-gradient(to right,#10b981,#6366f1)' }}
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
          </div>
          {isHost && (
            <span className="px-2 py-1 rounded-lg text-xs font-bold text-yellow-300" style={{ background: 'rgba(250,204,21,0.15)', border: '1px solid rgba(250,204,21,0.3)' }}>
              👑 Host
            </span>
          )}
        </div>

        {/* Right: players answered + controls */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl" style={GLASS()}>
            <Users className="h-3.5 w-3.5 text-white/50" />
            <span className="text-white/70 text-sm font-semibold">{playersAnswered}/{playingPlayers.length}</span>
          </div>
          <Button
            variant="ghost" size="icon"
            onClick={() => setIsMuted(!isMuted)}
            className="text-white/60 hover:text-white hover:bg-white/10 rounded-full h-8 w-8"
          >
            {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost" size="icon"
            onClick={() => {
              try { document.querySelectorAll('audio').forEach(a => { a.pause(); a.currentTime = 0; }); } catch (e) {}
              onExitFullscreen();
            }}
            className="text-white/60 hover:text-white hover:bg-white/10 rounded-full h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="relative z-10 container mx-auto px-4 pt-20 pb-8 max-w-6xl min-h-screen flex flex-col">

        {/* ─── HOST MEDIATOR VIEW (not playing) ─── */}
        {isHost && !isPlayer ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 mt-4">

            {/* Leaderboard */}
            <motion.div
              initial={{ x: -40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="lg:col-span-1 rounded-3xl overflow-hidden flex flex-col max-h-[600px]"
              style={GLASS()}
            >
              <div className="flex items-center gap-2.5 px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.2)' }}>
                <Trophy className="h-5 w-5 text-yellow-400" />
                <h3 className="text-white font-bold">Leaderboard</h3>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {[...playingPlayers].sort((a, b) => b.score - a.score).map((player, idx) => (
                  <div
                    key={player.id}
                    className="flex items-center justify-between p-3 rounded-xl"
                    style={{
                      background: idx === 0 ? 'rgba(250,204,21,0.12)' : idx === 1 ? 'rgba(156,163,175,0.1)' : idx === 2 ? 'rgba(234,88,12,0.1)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${idx === 0 ? 'rgba(250,204,21,0.3)' : idx === 1 ? 'rgba(156,163,175,0.2)' : idx === 2 ? 'rgba(234,88,12,0.2)' : 'rgba(255,255,255,0.06)'}`,
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm text-white ${idx === 0 ? 'bg-yellow-500' : idx === 1 ? 'bg-gray-500' : idx === 2 ? 'bg-orange-600' : 'bg-white/10'}`}>
                        {idx < 3 ? ['🥇','🥈','🥉'][idx] : idx + 1}
                      </div>
                      <div>
                        <div className="text-white font-bold text-sm truncate max-w-[110px]">{player.display_name}</div>
                        {answers.some(a => a.user_id === player.user_id && a.question_id === currentQuestion.id) ? (
                          <span className="text-[10px] text-emerald-400 font-semibold">✓ Answered</span>
                        ) : (
                          <span className="text-[10px] text-white/30 italic">Thinking…</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-yellow-400 font-black">{player.score}</div>
                      <div className="text-white/30 text-xs">pts</div>
                    </div>
                  </div>
                ))}
                {playingPlayers.length === 0 && (
                  <div className="text-center text-white/30 py-8 text-sm">Waiting for players…</div>
                )}
              </div>
            </motion.div>

            {/* Question + Chart */}
            <motion.div
              initial={{ x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="lg:col-span-2 flex flex-col gap-5"
            >
              <div className="flex flex-col items-center gap-4">
                <TimerRing timeRemaining={timeRemaining} timeLimit={currentQuestion.time_limit || 30} />
                <h2 className="text-2xl md:text-3xl font-black text-white text-center leading-tight">
                  {currentQuestion.question_text}
                </h2>
              </div>

              {/* Live response chart */}
              <div className="flex-1 rounded-3xl p-6 flex flex-col" style={GLASS()}>
                <p className="text-white/50 text-xs uppercase tracking-widest font-semibold mb-4 flex items-center gap-2">
                  <Users className="h-3.5 w-3.5" /> Live Response Distribution
                </p>
                <div className="flex items-end justify-around gap-4 h-48 w-full">
                  {(() => {
                    const currentAnswers = answers.filter(a => a.question_id === currentQuestion.id);
                    const counts = answerOptions.map((_, i) => currentAnswers.filter(a => a.selected_option === i).length);
                    const max = Math.max(...counts, 1);
                    return answerOptions.map((opt, i) => {
                      const count = counts[i];
                      const height = (count / max) * 100;
                      const isCorrect = i === correctIndex;
                      const showResult = showCorrectAnswer;
                      const barBg = showResult
                        ? (isCorrect ? 'rgba(16,185,129,0.7)' : 'rgba(255,255,255,0.1)')
                        : OPTION_STYLES[i % OPTION_STYLES.length].selected;
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                          <div className="text-white/60 font-bold text-sm">{count}</div>
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: `${height}%` }}
                            transition={{ type: 'spring', damping: 20 }}
                            className="w-full max-w-[70px] rounded-t-xl min-h-[8px] relative"
                            style={{ background: barBg }}
                          >
                            {showResult && isCorrect && (
                              <div className="absolute -top-8 left-1/2 -translate-x-1/2">
                                <CheckCircle className="h-7 w-7 text-emerald-400 animate-bounce" />
                              </div>
                            )}
                          </motion.div>
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black text-white"
                            style={{ background: OPTION_STYLES[i % OPTION_STYLES.length].selected }}
                          >
                            {String.fromCharCode(65 + i)}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Host Controls */}
              <div className="flex gap-3 justify-end">
                {session?.advance_mode === 'manual' ? (
                  <button
                    onClick={handleNextQuestion}
                    disabled={isLoading || timeRemaining > 0}
                    className="px-8 py-4 rounded-2xl font-black text-white text-base disabled:opacity-50 transition-all hover:scale-105 relative overflow-hidden group"
                    style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', boxShadow: '0 0 20px rgba(99,102,241,0.3)' }}
                  >
                    {timeRemaining > 0 ? <><Clock className="h-4 w-4 mr-2 inline animate-pulse" />Wait {timeRemaining}s</> : <>Next Question <ArrowRight className="h-4 w-4 ml-2 inline" /></>}
                    <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ) : (
                  <button
                    onClick={handleNextQuestion}
                    disabled={isLoading || timeRemaining > 0}
                    className="px-6 py-4 rounded-2xl font-bold text-white/70 hover:text-white text-sm disabled:opacity-50 transition-all"
                    style={GLASS()}
                  >
                    <RefreshCw className="h-4 w-4 mr-2 inline" />
                    {timeRemaining > 0 ? `Auto: ${timeRemaining}s` : 'Force Next'}
                  </button>
                )}
                <button
                  onClick={handleEndQuiz}
                  disabled={isLoading}
                  className="px-5 py-4 rounded-2xl font-bold text-red-400 hover:text-red-300 text-sm disabled:opacity-50 transition-all"
                  style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}
                >
                  End Quiz
                </button>
              </div>
            </motion.div>
          </div>

        ) : (
          /* ─── PLAYER VIEW (and host-participant) ─── */
          <motion.div
            key={currentQuestion.id}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4, type: 'spring' }}
            className="w-full max-w-4xl mx-auto flex flex-col items-center gap-8"
          >
            {/* Timer */}
            <div className="flex justify-center">
              <TimerRing timeRemaining={timeRemaining} timeLimit={currentQuestion.time_limit || 30} />
            </div>

            {/* Question */}
            <motion.h2
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-3xl md:text-4xl lg:text-5xl font-black text-white text-center leading-tight px-2"
            >
              {currentQuestion.question_text}
            </motion.h2>

            {/* Answer grid */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full"
            >
              {answerOptions.map((option: string, index: number) => {
                const isSelected = selectedAnswer === index;
                const isCorrect = index === correctIndex;
                const showAsCorrect = showCorrectAnswer && isCorrect;
                const showAsWrong = showCorrectAnswer && isSelected && !isCorrect;
                const style = OPTION_STYLES[index % OPTION_STYLES.length];

                let bg = style.base;
                let borderColor = style.border;
                let boxShadow = '';

                if (isSelected && !showCorrectAnswer) {
                  bg = style.selected;
                  borderColor = style.glow.replace('0.3)', '0.7)');
                  boxShadow = `0 0 24px ${style.glow}`;
                }
                if (showAsCorrect) {
                  bg = 'rgba(16,185,129,0.3)';
                  borderColor = 'rgba(16,185,129,0.7)';
                  boxShadow = '0 0 30px rgba(16,185,129,0.4)';
                }
                if (showAsWrong) {
                  bg = 'rgba(239,68,68,0.3)';
                  borderColor = 'rgba(239,68,68,0.7)';
                  boxShadow = '0 0 20px rgba(239,68,68,0.3)';
                }

                return (
                  <motion.button
                    key={index}
                    initial={{ scale: 0.85, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.12 * index, type: 'spring', stiffness: 200 }}
                    whileHover={hasAnswered ? {} : { scale: 1.03 }}
                    whileTap={hasAnswered ? {} : { scale: 0.97 }}
                    onClick={() => handleOptionSelect(index)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleOptionSelect(index); } }}
                    disabled={hasAnswered || isLoading || timeRemaining === 0 || !isPlayer}
                    aria-pressed={isSelected}
                    aria-label={`Option ${String.fromCharCode(65 + index)}: ${option}`}
                    className="relative p-5 md:p-6 rounded-2xl font-bold text-left transition-all duration-200 min-h-[100px] flex items-center"
                    style={{ background: bg, border: `2px solid ${borderColor}`, boxShadow, cursor: (hasAnswered || !isPlayer) ? 'not-allowed' : 'pointer', opacity: (hasAnswered && !isSelected && !showAsCorrect) ? 0.5 : 1 }}
                    tabIndex={0}
                  >
                    <div className="flex items-center justify-between w-full gap-3">
                      <div className="flex items-center gap-3 flex-1">
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl text-white flex-shrink-0"
                          style={{ background: style.selected }}
                        >
                          {String.fromCharCode(65 + index)}
                        </div>
                        <span className="text-white font-bold text-base md:text-lg leading-tight flex-1 break-words">
                          {option}
                        </span>
                      </div>
                      <AnimatePresence>
                        {showAsCorrect && (
                          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 300 }}>
                            <CheckCircle className="h-10 w-10 text-emerald-400 flex-shrink-0" />
                          </motion.div>
                        )}
                        {showAsWrong && (
                          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 300 }}>
                            <XCircle className="h-10 w-10 text-red-400 flex-shrink-0" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.button>
                );
              })}
            </motion.div>

            {/* Submit status */}
            <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.6 }} className="flex justify-center w-full">
              {!hasAnswered ? (
                !isPlayer ? (
                  <div className="px-6 py-3 rounded-2xl text-white/40 text-sm font-semibold" style={GLASS()}>
                    <UserCog className="h-4 w-4 mr-2 inline" /> Mediator — no answer required
                  </div>
                ) : isLoading ? (
                  <div className="px-8 py-4 rounded-2xl text-white font-bold" style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
                    <Loader2 className="h-5 w-5 mr-2 inline animate-spin" /> Submitting…
                  </div>
                ) : (
                  <div className="px-6 py-3 rounded-2xl text-white/50 text-sm text-center" style={GLASS()}>
                    Tap an option to answer — it submits immediately
                  </div>
                )
              ) : (
                <div
                  className="text-center py-6 px-10 rounded-3xl"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(12px)' }}
                >
                  <CheckCircle className="h-12 w-12 mx-auto text-emerald-400 mb-3" />
                  <p className="text-xl font-black text-white mb-1">Answer Submitted!</p>
                  {answerResult && (
                    <p className="text-white/70 text-base">
                      {answerResult.isCorrect ? `✅ +${answerResult.points} points!` : '❌ Better luck next time'}
                    </p>
                  )}
                  <p className="text-white/40 text-sm mt-2">
                    {isHost
                      ? session?.advance_mode === 'auto' ? 'Waiting for auto-advance…' : 'Click "Next" when ready'
                      : 'Waiting for next question…'}
                  </p>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </div>

      {/* Host+Player floating controls */}
      {isHost && isPlayer && (
        <div
          className="fixed bottom-5 right-5 z-[60] flex gap-2 p-2 rounded-2xl"
          style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(16px)' }}
        >
          {session?.advance_mode === 'manual' ? (
            <Button
              onClick={handleNextQuestion}
              disabled={isLoading || timeRemaining > 0}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5"
              size="sm"
            >
              {timeRemaining > 0 ? <><Clock className="h-3.5 w-3.5 mr-1.5 animate-pulse" />Wait</> : <><ArrowRight className="h-3.5 w-3.5 mr-1.5" />Next</>}
            </Button>
          ) : (
            <Button
              onClick={handleNextQuestion}
              variant="outline"
              disabled={isLoading || timeRemaining > 0}
              className="border-white/20 text-white hover:bg-white/10"
              size="sm"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              {timeRemaining > 0 ? 'Wait' : 'Force Next'}
            </Button>
          )}
          <Button
            onClick={handleEndQuiz}
            variant="destructive"
            size="icon"
            className="rounded-xl h-8 w-8"
            title="End Quiz"
          >
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Answer feedback overlay (mobile or non-host player) */}
      <AnimatePresence>
        {isPlayer && hasAnswered && showCorrectAnswer && answerResult && !isMobile && (
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-8 py-5 rounded-3xl z-40 flex items-center gap-5 ${answerResult.isCorrect ? 'bg-emerald-500/85' : 'bg-red-500/85'}`}
            style={{ backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.2)' }}
          >
            <div className="bg-white/20 p-2.5 rounded-full">
              {answerResult.isCorrect ? <Trophy className="h-7 w-7 text-white" /> : <Target className="h-7 w-7 text-white" />}
            </div>
            <div className="text-white">
              <div className="font-black text-xl">{answerResult.isCorrect ? 'Correct!' : 'Incorrect'}</div>
              <div className="text-white/80 text-sm">{answerResult.isCorrect ? `+${answerResult.points} points` : 'Keep trying!'}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-red-500/20 border border-red-400/40 rounded-2xl px-5 py-3 z-50 text-center"
          style={{ backdropFilter: 'blur(8px)' }}
        >
          <AlertCircle className="h-5 w-5 text-red-400 inline mr-2" />
          <span className="text-white/90 text-sm">{error}</span>
        </motion.div>
      )}
    </motion.div>
  );
};

export default LiveQuizActiveFullscreen;