// src/components/quizzes/components/LiveQuizActiveFullscreen.tsx
import React, { useEffect, useRef, useState } from 'react';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
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
  X,
  Zap,
  Trophy,
  Target,
  Sparkles,
  Users,
  Volume2,
  VolumeX,
  LogOut,
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

// Enhanced Circular SVG timer ring with pulsing effect
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
        {/* Background circle */}
        <circle
          cx="55" cy="55" r={radius}
          fill="none"
          strokeWidth="8"
          className="stroke-gray-300 dark:stroke-white/10"
        />
        {/* Progress arc */}
        <circle
          cx="55" cy="55" r={radius}
          fill="none"
          stroke={isUrgent ? '#ef4444' : isMid ? '#f59e0b' : '#10b981'}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={isUrgent ? 'animate-pulse' : ''}
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s ease' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <Clock className={`h-6 w-6 mb-1 ${isUrgent ? 'text-red-500 dark:text-red-400 animate-pulse' : 'text-gray-700 dark:text-white'}`} />
        <span
          className={`text-3xl font-bold tabular-nums ${
            isUrgent ? 'text-red-500 dark:text-red-400 animate-pulse' : isMid ? 'text-amber-500 dark:text-amber-400' : 'text-gray-900 dark:text-white'
          }`}
        >
          {timeRemaining}
        </span>
      </div>
    </div>
  );
};

const LiveQuizActiveFullscreen: React.FC<LiveQuizActiveFullscreenProps> = ({
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
  onExitFullscreen,
}) => {
  const timeoutFiredRef = useRef<string | null>(null);
  const [showCorrectAnswer, setShowCorrectAnswer] = useState(false);
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; color: string; size: number; rotation: number; velocityX: number; velocityY: number }>>([]);
  const [answerResult, setAnswerResult] = useState<{ isCorrect: boolean; points: number } | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

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

  // Initialize and manage audio
  useEffect(() => {
    // Create audio instances
    // Use the provided Supabase-hosted tracks for background and SFX
    const bgUrl = 'https://kegsrvnywshxyucgjxml.supabase.co/storage/v1/object/public/documents/sonican-informational-quiz-loop-397409.mp3';
    const correctUrl = 'https://kegsrvnywshxyucgjxml.supabase.co/storage/v1/object/public/documents/mixkit-correct-answer-tone-2870.wav';
    const tickUrl = 'https://kegsrvnywshxyucgjxml.supabase.co/storage/v1/object/public/documents/mixkit-fast-wall-clock-ticking-1063.wav';
    const incorrectUrl = 'https://kegsrvnywshxyucgjxml.supabase.co/storage/v1/object/public/documents/mixkit-wrong-answer-fail-notification-946.wav';
    const endUrl = 'https://kegsrvnywshxyucgjxml.supabase.co/storage/v1/object/public/documents/mixkit-end-of-show-clapping-crowd-477.wav';

    bgMusicRef.current = new Audio(bgUrl);
    // allow cross-origin playback for hosted assets
    try {
      // some browsers require crossOrigin to be set before loading
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      bgMusicRef.current.crossOrigin = 'anonymous';
    } catch (e) {}
    bgMusicRef.current.loop = true;
    bgMusicRef.current.volume = 0.3;

    // Map provided Supabase files to SFX refs
    correctSfxRef.current = new Audio(correctUrl);
    incorrectSfxRef.current = new Audio(incorrectUrl);

    // thinking/background loops
    thinkingLoopRef.current = new Audio(bgUrl);
    thinkingLoopRef.current.loop = true;
    thinkingLoopRef.current.volume = 0.45;

    // tick and end sounds
    tickRef.current = new Audio(tickUrl);
    endSfxRef.current = new Audio(endUrl);

    // Map remaining UX placeholders to provided Supabase assets
    // short chime for start/submit
    startSfxRef.current = new Audio(correctUrl);
    submitSfxRef.current = new Audio(correctUrl);
    // use ticking for quick feedback/advance/click (single play)
    advanceSfxRef.current = new Audio(tickUrl);
    clickSfxRef.current = new Audio(tickUrl);

    // Attempt to play background music interaction
    const playMusic = async () => {
      try {
        if (bgMusicRef.current && !isMuted) {
          await bgMusicRef.current.play();
        }
      } catch (err) {
        // console.warn("Audio autoplay blocked", err);
      }
    };

    playMusic();

    return () => {
      if (bgMusicRef.current) {
        bgMusicRef.current.pause();
        bgMusicRef.current = null;
      }
    };
  }, []);

  // Handle Mute Toggle
  useEffect(() => {
    if (bgMusicRef.current) {
      if (isMuted) {
        bgMusicRef.current.pause();
      } else {
        bgMusicRef.current.play().catch(() => {});
      }
    }

    // toggle thinking loop as well
    if (thinkingLoopRef.current) {
      if (isMuted) {
        thinkingLoopRef.current.pause();
      } else {
        // only autoplay if a question is active
        if (currentQuestion) thinkingLoopRef.current.play().catch(() => {});
      }
    }
  }, [isMuted]);

  // Reset states on question change
  useEffect(() => {
    timeoutFiredRef.current = null;
    setShowCorrectAnswer(false);
    setParticles([]);
    setAnswerResult(null);
    // play question start chime and start thinking loop
    try {
      if (!isMuted && startSfxRef.current) {
        startSfxRef.current.currentTime = 0;
        startSfxRef.current.play().catch(() => {});
      }
      if (!isMuted && thinkingLoopRef.current) {
        thinkingLoopRef.current.currentTime = 0;
        thinkingLoopRef.current.play().catch(() => {});
      }
    } catch (e) {}
  }, [currentQuestion?.id]);

  // Track small screens to adapt UI and toasts
  useEffect(() => {
    const update = () => setIsMobile(typeof window !== 'undefined' ? window.innerWidth < 640 : false);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Show correct answer after submission
  useEffect(() => {
    if (hasAnswered && !isHost) {
      setTimeout(() => setShowCorrectAnswer(true), 1000);
    }
  }, [hasAnswered, isHost]);

  // Pause thinking loop when answered or time's up
  useEffect(() => {
    if (thinkingLoopRef.current) {
      if (hasAnswered || timeRemaining === 0) {
        try { thinkingLoopRef.current.pause(); } catch (e) {}
      } else if (!isMuted && currentQuestion) {
        try { thinkingLoopRef.current.play().catch(() => {}); } catch (e) {}
      }
    }
  }, [hasAnswered, timeRemaining, isMuted, currentQuestion]);

  // Create celebration confetti explosion
  const createConfetti = () => {
    const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD'];
    const newParticles = Array.from({ length: 100 }, (_, i) => ({
      id: Date.now() + i,
      x: 50, // Start from center
      y: 50,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.random() * 10 + 5,
      rotation: Math.random() * 360,
      velocityX: (Math.random() - 0.5) * 100, // Random spread X
      velocityY: (Math.random() - 0.5) * 100, // Random spread Y
    }));
    setParticles(newParticles);
    
    // Play SFX
    if (!isMuted && correctSfxRef.current) {
      correctSfxRef.current.currentTime = 0;
      correctSfxRef.current.play().catch(() => {});
    }

    setTimeout(() => setParticles([]), 4000);
  };

  // Play incorrect sfx
  const playIncorrectSound = () => {
    if (!isMuted && incorrectSfxRef.current) {
      incorrectSfxRef.current.currentTime = 0;
      incorrectSfxRef.current.play().catch(() => {});
    }
  };

  // Auto-submit on timeout
  useEffect(() => {
    if (
      timeRemaining !== 0 ||
      hasAnswered ||
      isLoading ||
      !isPlayer ||
      !currentQuestion ||
      !session ||
      timeoutFiredRef.current === currentQuestion.id
    ) return;

    timeoutFiredRef.current = currentQuestion.id;
    // play submit SFX for auto-submit
    try {
      if (!isMuted && submitSfxRef.current) {
        submitSfxRef.current.currentTime = 0;
        submitSfxRef.current.play().catch(() => {});
      }
    } catch (e) {}

    submitAnswer(session.id, currentQuestion.id, -1, currentQuestion.time_limit || 0);

    if (!isMobile) {
      toast({
        title: "⏱️ Time's Up!",
        description: 'No answer was submitted in time.',
        variant: 'destructive',
      });
    }
  }, [timeRemaining, hasAnswered, isLoading, isPlayer, currentQuestion, session, toast]);

  const handleSubmitAnswer = async () => {
    if (selectedAnswer === null || !currentQuestion || !session || !isPlayer) return;

    setIsLoading(true);
    setError(null);

    try {
      // play submit SFX on explicit submit
      try {
        if (!isMuted && submitSfxRef.current) {
          submitSfxRef.current.currentTime = 0;
          submitSfxRef.current.play().catch(() => {});
        }
      } catch (e) {}

      const timeTaken = currentQuestion.start_time
        ? Math.floor((Date.now() - new Date(currentQuestion.start_time).getTime()) / 1000)
        : 0;

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

      if (result.isCorrect) {
        createConfetti();
      } else {
        playIncorrectSound();
      }

      // Muted toast to avoid clutter since we have the feedback overlay
      // toast({
      //   title: result.isCorrect ? '✅ Correct!' : '❌ Incorrect',
      //   description: result.isCorrect ? `+${result.points} points` : 'Better luck next time!',
      //   variant: result.isCorrect ? 'default' : 'destructive',
      // });

      setTimeout(() => refreshSessionState(), 500);
    } catch (err: any) {
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

      try {
        if (!isMuted && advanceSfxRef.current) {
          advanceSfxRef.current.currentTime = 0;
          advanceSfxRef.current.play().catch(() => {});
        }
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

    // Stop all audio playback except applause
    const audioRefs = [
      bgMusicRef,
      correctSfxRef,
      incorrectSfxRef,
      startSfxRef,
      thinkingLoopRef,
      tickRef,
      submitSfxRef,
      advanceSfxRef,
      clickSfxRef
    ];
    audioRefs.forEach(ref => {
      if (ref.current) {
        try {
          ref.current.pause();
          ref.current.currentTime = 0;
        } catch {}
      }
    });

    try {
      const result = await endQuizSession(session.id);
      if (result.error) throw new Error(result.error);

      // Play applause sound fully (clone to avoid interruption)
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
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-50 bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center"
      >
        <div className="text-center text-gray-900 dark:text-white">
          <Loader2 className="h-16 w-16 animate-spin mx-auto text-blue-600 dark:text-white mb-4" />
          <p className="text-xl">Loading quiz...</p>
        </div>
      </motion.div>
    );
  }

  const currentIndex = allQuestions.findIndex((q) => q.id === currentQuestion.id);
  const totalQuestions = allQuestions.length;
  const progressPercent = totalQuestions > 0 ? ((currentIndex + 1) / totalQuestions) * 100 : 0;

  const playingPlayers = players.filter((p) => p.is_playing);
  const playersAnswered = playingPlayers.filter(
    (p) => p.last_answered_at && new Date(p.last_answered_at) >= new Date(currentQuestion.start_time || 0)
  ).length;

  const answerOptions = currentQuestion.options || [];
  const correctIndex = currentQuestion.correct_answer;



  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black overflow-auto"
    >
      {/* Background Image & Overlay */}
      <div
        className="fixed inset-0 z-0"
        style={{
          backgroundImage: "url('/herobackgroundimg.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      
      <div className="fixed inset-0 z-0 bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
         <div className="absolute inset-0 bg-cover bg-center opacity-40 dark:opacity-40" style={{ backgroundImage: "url('/herobackgroundimg.png')" }} />
         <div className="absolute inset-0 bg-white/30 dark:bg-slate-950/80 backdrop-blur-sm" />
      </div>


      {/* Confetti Explosion System */}
      <AnimatePresence>
        {particles.map((particle) => (
          <motion.div
            key={particle.id}
            initial={{ opacity: 1, scale: 0, x: '50vw', y: '50vh', rotate: 0 }}
            animate={{ 
              opacity: 0, 
              scale: 1, 
              x: `calc(50vw + ${particle.velocityX}vw)`, 
              y: `calc(50vh + ${particle.velocityY}vh)`,
              rotate: particle.rotation 
            }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
            className="fixed pointer-events-none rounded-sm z-[100]"
            style={{ 
              backgroundColor: particle.color,
              width: particle.size,
              height: particle.size,
              left: 0, 
              top: 0 
            }}
          />
        ))}
      </AnimatePresence>

      {/* Top Controls - Responsive Header */}
      <div
        className="fixed z-50 flex gap-2"
        style={{
          top: '1rem',
          left: '0',
          right: '0',
          width: '100vw',
          justifyContent: 'flex-end',
          paddingLeft: '1rem',
          paddingRight: '1rem',
          pointerEvents: 'none',
        }}
      >
        <div
          className="flex gap-2 w-full"
          style={{
            maxWidth: '100vw',
            justifyContent: 'flex-end',
            pointerEvents: 'auto',
          }}
        >
          {/* On mobile, spread buttons horizontally */}
          <div className="flex flex-row w-full max-w-xs sm:max-w-none sm:w-auto justify-between sm:justify-end gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMuted(!isMuted)}
              className="text-gray-700 dark:text-white hover:bg-black/5 dark:hover:bg-white/20 rounded-full"
            >
              {isMuted ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                // Stop all playing audio when exiting fullscreen
                try {
                  const audios = document.querySelectorAll('audio');
                  audios.forEach((audio) => {
                    (audio as HTMLAudioElement).pause();
                    (audio as HTMLAudioElement).currentTime = 0;
                  });
                } catch (e) {}
                onExitFullscreen();
              }}
              className="text-gray-700 dark:text-white hover:bg-black/5 dark:hover:bg-white/20 rounded-full"
            >
              <X className="h-6 w-6" />
            </Button>
          </div>
        </div>
      </div>

      <div className="relative z-10 container mx-auto px-4 py-8 max-w-6xl min-h-screen flex flex-col">
        {/* Header Section */}
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, type: 'spring' }}
          className="mb-8"
        >
          {/* Progress Bar */}
          <div className="relative mb-6">
            <div className="w-full h-4 bg-gray-200 dark:bg-white/10 backdrop-blur-sm rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-green-400 via-emerald-400 to-green-500 rounded-full shadow-lg"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
              />
            </div>
            <motion.div
              className="absolute -top-2 bg-white rounded-full w-8 h-8 shadow-xl flex items-center justify-center border border-gray-100 dark:border-transparent"
              initial={{ left: '0%' }}
              animate={{ left: `${progressPercent}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
              style={{ transform: 'translateX(-50%)' }}
            >
              <Zap className="h-4 w-4 text-yellow-500" />
            </motion.div>
          </div>

          {/* Header Info */}
          <div className="relative z-10 flex items-center justify-between px-6 py-4 bg-white/80 dark:bg-black/20 backdrop-blur-md border-b border-gray-200 dark:border-white/10 shrink-0">
            <motion.div
              initial={{ x: -30, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="flex items-center gap-4"
            >
              <div className="bg-white/60 dark:bg-white/20 backdrop-blur-lg rounded-2xl px-6 py-3 border border-gray-200 dark:border-white/30 shadow-sm dark:shadow-none">
                <div className="flex items-center gap-3">
                  <Target className="h-6 w-6 text-blue-600 dark:text-white" />
                  <div>
                    <div className="text-xs opacity-80 text-gray-600 dark:text-white/80">Question</div>
                    <div className="text-2xl font-bold">
                      {currentIndex + 1} / {totalQuestions}
                    </div>
                  </div>
                </div>
              </div>
              
              {isHost && (
                <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-4 py-2 text-base shadow-md">
                  <Trophy className="h-4 w-4 mr-2" /> Host
                </Badge>
              )}
            </motion.div>

            <motion.div
              initial={{ x: 30, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="bg-white/60 dark:bg-white/20 backdrop-blur-lg rounded-2xl px-6 py-3 border border-gray-200 dark:border-white/30 shadow-sm dark:shadow-none"
            >
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-purple-600 dark:text-white" />
                <div>
                  <div className="text-xs opacity-80 text-gray-600 dark:text-white/80">Players Answered</div>
                  <div className="text-xl font-bold">{playersAnswered} / {playingPlayers.length}</div>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* Main Content */}
        <div className="flex-1 w-full max-w-7xl mx-auto flex flex-col justify-center">
          {isHost && !isPlayer ? (
            /* --- HOST VIEW (Only if not playing) --- */
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 w-full mt-4 h-full min-h-[500px]">
              {/* LEFT: Leaderboard */}
              <motion.div
                initial={{ x: -50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                className="lg:col-span-1 bg-white/60 dark:bg-black/40 backdrop-blur-md rounded-3xl border border-gray-200 dark:border-white/10 p-6 flex flex-col overflow-hidden max-h-[600px] shadow-lg dark:shadow-none"
              >
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200 dark:border-white/10">
                  <Trophy className="h-8 w-8 text-yellow-500 dark:text-yellow-400 z-20" />
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white z-20 relative">Leaderboard</h3>
                </div>
                
                <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar flex-1">
                  {[...playingPlayers]
                    .sort((a, b) => b.score - a.score)
                    .map((player, idx) => (
                      <div
                        key={player.id}
                        className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                          idx === 0 ? 'bg-yellow-500/20 border-yellow-500/50' : 
                          idx === 1 ? 'bg-slate-300/40 dark:bg-slate-300/20 border-slate-300/50' : 
                          idx === 2 ? 'bg-orange-700/20 border-orange-700/50' : 
                          'bg-white/40 dark:bg-white/5 border-gray-200 dark:border-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`
                            w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-sm
                            ${idx < 3 ? 'text-white shadow-lg' : 'text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-white/10'}
                            ${idx === 0 ? 'bg-yellow-500' : idx === 1 ? 'bg-slate-500 dark:bg-slate-400' : idx === 2 ? 'bg-orange-600 dark:bg-orange-700' : ''}
                          `}>
                            {idx + 1}
                          </div>
                          <div>
                            <div className="font-bold text-gray-900 dark:text-white text-lg truncate max-w-[120px]">{player.display_name}</div>
                             <div className="flex items-center gap-2">
                               {answers.some(a => a.user_id === player.user_id && a.question_id === currentQuestion.id) ? (
                                   <Badge variant="outline" className="text-[10px] px-1 py-0 h-5 bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30">Answered</Badge>
                               ) : (
                                   <span className="text-[10px] text-gray-500 dark:text-gray-400 italic">Thinking...</span>
                               )}
                             </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold text-gray-900 dark:text-white">{player.score}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">pts</div>
                        </div>
                      </div>
                  ))}
                  {playingPlayers.length === 0 && (
                     <div className="text-center text-gray-500 dark:text-gray-400 py-8">Waiting for players...</div>
                  )}
                </div>
              </motion.div>

              {/* RIGHT: Question & Stats */}
              <motion.div
                 initial={{ x: 50, opacity: 0 }}
                 animate={{ x: 0, opacity: 1 }}
                 className="lg:col-span-2 flex flex-col h-full"
              >
                  {/* Timer & Question */}
                  <div className="flex flex-col items-center mb-8 shrink-0">
                     <TimerRing timeRemaining={timeRemaining} timeLimit={currentQuestion.time_limit || 30} />
                     <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white leading-tight px-4 text-center mt-6 drop-shadow-sm line-clamp-3">
                        {currentQuestion.question_text}
                     </h2>
                  </div>

                  {/* Analytics Graph */}
                  <div className="flex-1 bg-white/60 dark:bg-black/40 backdrop-blur-md rounded-3xl border border-gray-200 dark:border-white/10 p-8 flex flex-col justify-end min-h-[300px] shadow-lg dark:shadow-none">
                     <h4 className="text-gray-500 dark:text-white/60 font-medium mb-6 uppercase tracking-wider text-sm flex items-center gap-2">
                        <Users className="w-4 h-4" /> Live Response Distribution
                     </h4>
                     <div className="flex items-end justify-around gap-4 h-64 w-full">
                        {(() => {
                            const currentAnswers = answers.filter(a => a.question_id === currentQuestion.id);
                            const counts = answerOptions.map((_, i) => currentAnswers.filter(a => a.selected_option === i).length);
                            const max = Math.max(...counts, 1); 

                            return answerOptions.map((opt, i) => {
                                const count = counts[i];
                                const height = (count / max) * 100;
                                const isCorrect = i === correctIndex;
                                const showResult = showCorrectAnswer; 

                                let barColor = 'bg-blue-500';
                                if (showResult) {
                                   if (isCorrect) barColor = 'bg-green-500 shadow-[0_0_20px_rgba(34,197,94,0.6)]';
                                   else barColor = 'bg-slate-400 dark:bg-slate-600 opacity-50';
                                }

                                return (
                                   <div key={i} className="flex-1 flex flex-col items-center gap-3 h-full justify-end group">
                                      <div className={`text-gray-900 dark:text-white font-bold text-xl mb-1 transition-opacity ${count > 0 ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                         {count} <span className="text-sm font-normal opacity-70 text-gray-500 dark:text-white/70">({Math.round((count / (currentAnswers.length || 1)) * 100)}%)</span>
                                      </div>
                                        <motion.div
                                         initial={{ height: 0 }}
                                         animate={{ height: `${height}%` }}
                                         transition={{ type: 'spring', damping: 20 }}
                                         className={`w-full max-w-[80px] rounded-t-xl relative min-h-[10px] ${barColor} transition-colors duration-500`}
                                         style={{ marginTop: showResult && isCorrect ? '2.5rem' : undefined }}
                                        >
                                          {showResult && isCorrect && (
                                            <div className="absolute top-0 left-1/2 -translate-x-1/2 mt-[-2.5rem] sm:mt-[-2.5rem]">
                                              <CheckCircle className="h-8 w-8 text-green-500 dark:text-green-400 drop-shadow-lg animate-bounce" />
                                            </div>
                                          )}
                                        </motion.div>
                                      
                                      <div className="h-12 w-12 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center text-gray-900 dark:text-white font-bold text-lg border border-gray-200 dark:border-white/20">
                                         {String.fromCharCode(65 + i)}
                                      </div>
                                   </div>
                                )
                            });
                        })()}
                     </div>
                  </div>
                  
                  {/* Host Controls */}
                  <div className="flex gap-4 mt-6 justify-end shrink-0">
                      {session?.advance_mode === 'manual' ? (
                        <Button
                            onClick={handleNextQuestion}
                            disabled={isLoading || timeRemaining > 0}
                            size="lg"
                            className="bg-indigo-600 dark:bg-white text-white dark:text-indigo-900 hover:bg-indigo-700 dark:hover:bg-indigo-50 font-bold text-lg px-8 py-6 rounded-xl shadow-xl transition-all hover:scale-105"
                        >
                            {timeRemaining > 0 ? (
                                <><Clock className="h-5 w-5 mr-2 animate-pulse" /> Wait {timeRemaining}s</>
                            ) : (
                                <>Next Question <ArrowRight className="h-5 w-5 ml-2" /></>
                            )}
                        </Button>
                      ) : (
                        <Button
                            onClick={handleNextQuestion}
                            variant="outline"
                            disabled={isLoading || timeRemaining > 0}
                            size="lg"
                            className="border-gray-300 dark:border-white/30 text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-white/20 px-8 py-6 text-lg rounded-xl bg-white/50 dark:bg-transparent"
                        >
                            <RefreshCw className="h-5 w-5 mr-2" />
                            {timeRemaining > 0 ? `Auto: ${timeRemaining}s` : 'Force Next'}
                        </Button>
                      )}
                       <Button
                            onClick={handleEndQuiz}
                            variant="destructive"
                            size="lg"
                            disabled={isLoading}
                             className="px-6 py-6 rounded-xl font-bold bg-red-500/80 hover:bg-red-600 border border-red-400/30"
                        >
                            End Quiz
                        </Button>
                  </div>
              </motion.div>
            </div>
          ) : (
            /* --- PLAYER VIEW --- */
          <motion.div
            key={currentQuestion.id}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, type: 'spring' }}
            className="w-full max-w-4xl mx-auto"
          >
            {/* Timer */}
            <div className="flex justify-center mb-8">
              <TimerRing timeRemaining={timeRemaining} timeLimit={currentQuestion.time_limit || 30} />
            </div>

            {/* Question Text */}
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-center mb-12"
            >
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white leading-tight px-4 filter drop-shadow-sm dark:drop-shadow-none">
                {currentQuestion.question_text}
              </h2>
            </motion.div>

            {/* Answer Options Grid */}
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8"
            >
              {answerOptions.map((option: string, index: number) => {
                const isSelected = selectedAnswer === index;
                const isCorrect = index === correctIndex;
                const showAsCorrect = showCorrectAnswer && isCorrect;
                const showAsWrong = showCorrectAnswer && isSelected && !isCorrect;

                return (
                  <motion.button
                    key={index}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.15 * index, type: 'spring', stiffness: 200 }}
                    whileHover={{ scale: hasAnswered ? 1 : 1.05 }}
                    whileTap={{ scale: hasAnswered ? 1 : 0.95 }}
                    onClick={() => !hasAnswered && !isLoading && timeRemaining > 0 && isPlayer && setSelectedAnswer(index)}
                    disabled={hasAnswered || isLoading || timeRemaining === 0 || !isPlayer}
                    className={`
                      relative p-6 md:p-8 rounded-3xl border-4 font-bold text-left transition-all duration-300
                      min-h-[140px] flex items-center h-auto shadow-lg
                      ${!hasAnswered && !isSelected
                        ? 'border-gray-200 dark:border-white/30 bg-white/60 dark:bg-white/10 backdrop-blur-lg hover:border-blue-400 dark:hover:border-white/50 hover:bg-white/80 dark:hover:bg-white/20'
                        : ''
                      }
                      ${isSelected && !showCorrectAnswer
                        ? 'border-blue-500 bg-blue-100 dark:bg-blue-500/30 backdrop-blur-lg ring-4 ring-blue-300/50 scale-105'
                        : ''
                      }
                      ${showAsCorrect
                        ? 'border-green-500 bg-green-100 dark:bg-green-500/30 backdrop-blur-lg ring-4 ring-green-300/50 scale-105'
                        : ''
                      }
                      ${showAsWrong
                        ? 'border-red-500 bg-red-100 dark:bg-red-500/30 backdrop-blur-lg ring-4 ring-red-300/50'
                        : ''
                      }
                      ${hasAnswered || !isPlayer ? 'cursor-not-allowed opacity-70' : 'cursor-pointer shadow-xl'}
                    `}
                  >
                    <div className="flex items-center justify-between w-full gap-4">
                      <div className="flex items-center gap-4 flex-1">
                        <div
                          className={`
                            w-16 h-16 rounded-2xl flex items-center justify-center font-bold text-2xl flex-shrink-0 shadow-sm
                            ${!hasAnswered && !isSelected
                              ? 'bg-gray-100 dark:bg-white/20 text-gray-900 dark:text-white'
                              : ''
                            }
                            ${isSelected && !showCorrectAnswer ? 'bg-blue-500 text-white' : ''}
                            ${showAsCorrect ? 'bg-green-500 text-white' : ''}
                            ${showAsWrong ? 'bg-red-500 text-white' : ''}
                          `}
                        >
                          {String.fromCharCode(65 + index)}
                        </div>
                        <span className={`flex-1 break-words text-lg md:text-2xl leading-tight ${
                             isSelected ? 'text-gray-900 dark:text-white' : 'text-gray-900 dark:text-white'
                        }`}>{option}</span>
                      </div>
                      
                      <AnimatePresence>
                        {showAsCorrect && (
                          <motion.div
                            initial={{ scale: 0, rotate: -180 }}
                            animate={{ scale: 1, rotate: 0 }}
                            exit={{ scale: 0 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                          >
                            <CheckCircle className="h-12 w-12 text-green-400" />
                          </motion.div>
                        )}
                        {showAsWrong && (
                          <motion.div
                            initial={{ scale: 0, rotate: 180 }}
                            animate={{ scale: 1, rotate: 0 }}
                            exit={{ scale: 0 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                          >
                            <XCircle className="h-12 w-12 text-red-400" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.button>
                );
              })}
            </motion.div>

            {/* Submit Button or Status */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="flex justify-center"
            >
              {!hasAnswered ? (
                <Button
                  onClick={handleSubmitAnswer}
                  disabled={selectedAnswer === null || isLoading || timeRemaining === 0 || !isPlayer}
                  size="lg"
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-6 px-12 text-xl rounded-2xl shadow-2xl"
                >
                  {isLoading ? (
                    <><Loader2 className="h-6 w-6 mr-3 animate-spin" /> Submitting...</>
                  ) : timeRemaining === 0 ? (
                    <><Clock className="h-6 w-6 mr-3" /> Time's Up!</>
                  ) : !isPlayer ? (
                    <><UserCog className="h-6 w-6 mr-3" /> Mediator (No Answer)</>
                  ) : (
                    <>Submit Answer <ArrowRight className="h-6 w-6 ml-3" /></>
                  )}
                </Button>
              ) : (
                <div className="text-center py-8 bg-white/60 dark:bg-white/20 backdrop-blur-lg rounded-3xl border-2 border-white/50 dark:border-white/30 px-12 shadow-xl">
                  <CheckCircle className="h-16 w-16 mx-auto text-green-500 dark:text-green-400 mb-4" />
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Answer Submitted!</p>
                  {answerResult && (
                    <p className="text-xl text-gray-700 dark:text-white/80">
                      {answerResult.isCorrect ? `+${answerResult.points} points` : 'Better luck next time'}
                    </p>
                  )}
                  <p className="text-sm text-gray-600 dark:text-white/60 mt-3">
                    {isHost
                      ? session?.advance_mode === 'auto' ? 'Waiting for auto-advance...' : 'Click "Next Question" when ready'
                      : 'Waiting for next question...'}
                  </p>
                </div>
              )}
            </motion.div>
          </motion.div>
          )}

          {/* Host Controls Overlay for Playing Host */}
          {isHost && isPlayer && (
            <div className="fixed bottom-6 right-6 z-[60] flex gap-3 p-2 bg-white/80 dark:bg-black/40 backdrop-blur-md rounded-2xl border border-gray-200 dark:border-white/10 shadow-lg dark:shadow-none">
                 {session?.advance_mode === 'manual' ? (
                      <Button
                          onClick={handleNextQuestion}
                          disabled={isLoading || timeRemaining > 0}
                          className="bg-indigo-600 dark:bg-white/90 text-white dark:text-indigo-900 hover:bg-indigo-700 dark:hover:bg-white shadow-lg backdrop-blur-sm px-6"
                      >
                          {timeRemaining > 0 ? <Clock className="h-4 w-4 mr-2 animate-pulse" /> : <ArrowRight className="h-4 w-4 mr-2" />}
                          {timeRemaining > 0 ? 'Wait' : 'Next'}
                      </Button>
                  ) : (
                      <Button
                          onClick={handleNextQuestion}
                          variant="outline"
                          disabled={isLoading || timeRemaining > 0}
                          className="bg-white/50 dark:bg-black/50 border-gray-300 dark:border-white/20 text-gray-700 dark:text-white hover:bg-white/80 dark:hover:bg-black/70 backdrop-blur-sm"
                      >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Force Next
                      </Button>
                  )}
                  <Button
                      onClick={handleEndQuiz}
                      variant="destructive"
                      size="icon"
                      className="rounded-xl shadow-lg hover:bg-red-600"
                      title="End Quiz"
                  >
                      <LogOut className="h-4 w-4" />
                  </Button>
            </div>
          )}

          {/* Feedback Overlay (for Player) */}
          <AnimatePresence>
              {isPlayer && hasAnswered && showCorrectAnswer && !isMobile && (
              <motion.div
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 50, opacity: 0 }}
                className={`
                  fixed bottom-8 left-1/2 -translate-x-1/2 
                  px-8 py-6 rounded-3xl shadow-2xl backdrop-blur-xl border border-white/20
                  ${answerResult.isCorrect ? 'bg-green-500/80' : 'bg-red-500/80'}
                  text-white flex items-center gap-6 z-40 w-auto max-w-[90%] sm:min-w-[300px] justify-center
                `}
              >
                {answerResult.isCorrect ? (
                  <>
                    <div className="bg-white/20 p-3 rounded-full"><Trophy className="h-8 w-8" /></div>
                    <div>
                      <div className="font-bold text-2xl">Correct!</div>
                      <div className="opacity-90">+{answerResult.points} points</div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="bg-white/20 p-3 rounded-full"><Target className="h-8 w-8" /></div>
                    <div>
                      <div className="font-bold text-2xl">Incorrect</div>
                      <div className="opacity-90">Keep trying!</div>
                    </div>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Error Display */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 bg-red-500/20 backdrop-blur-lg border border-red-400/50 rounded-2xl p-4 text-center"
          >
            <AlertCircle className="h-6 w-6 text-red-400 inline-block mr-2" />
            <span className="text-white font-medium">{error}</span>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

export default LiveQuizActiveFullscreen;
