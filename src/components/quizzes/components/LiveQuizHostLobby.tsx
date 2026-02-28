// src/components/quizzes/components/LiveQuizHostLobby.tsx
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Alert, AlertDescription } from '../../ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';
import {
  Users, Play, Crown, Copy, Loader2, AlertCircle,
  LogOut, RefreshCw, Settings, UserCog, Clock,
  Maximize2, Minimize2, X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { LiveQuizSession, LiveQuizPlayer, startLiveQuizSession } from '@/services/liveQuizService';

interface LiveQuizHostLobbyProps {
  session: LiveQuizSession | null;
  players: LiveQuizPlayer[];
  isHost: boolean;
  userId: string;
  isLoading: boolean;
  error: string | null;
  refreshSessionState: () => Promise<void>;
  setIsLoading: (loading: boolean) => void;
  setSession: (session: LiveQuizSession | null) => void;
  setViewMode: (mode: 'menu' | 'host-lobby' | 'participant-lobby' | 'quiz-active' | 'results') => void;
  resetView: () => void;
  toast: any;
}

const COSMIC_BG: React.CSSProperties = {
  background: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)',
};
const GLASS: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  backdropFilter: 'blur(12px)',
};

const LiveQuizHostLobby: React.FC<LiveQuizHostLobbyProps> = ({
  session, players, isHost, userId, isLoading, error,
  refreshSessionState, setIsLoading, setSession, setViewMode, resetView, toast,
}) => {
  const [isFullScreen, setIsFullScreen] = React.useState(true);
  const [isMobile, setIsMobile] = React.useState(false);
  const bgRef = React.useRef<HTMLAudioElement | null>(null);
  const startRef = React.useRef<HTMLAudioElement | null>(null);
  const bgOrigVol = React.useRef<number>(0.3);
  const scheduledTime = session?.scheduled_start_time ? new Date(session.scheduled_start_time) : null;
  const [countdown, setCountdown] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!scheduledTime) return;
    const update = () => {
      const diff = scheduledTime.getTime() - Date.now();
      if (diff <= 0) { setCountdown('Starting...'); return; }
      const min = Math.floor(diff / 60000);
      const sec = Math.floor((diff % 60000) / 1000);
      setCountdown(`${min}:${sec < 10 ? '0' : ''}${sec}`);
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [scheduledTime]);

  React.useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 640);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  React.useEffect(() => {
    const bgUrl = 'https://kegsrvnywshxyucgjxml.supabase.co/storage/v1/object/public/documents/sonican-informational-quiz-loop-397409.mp3';
    const startUrl = 'https://kegsrvnywshxyucgjxml.supabase.co/storage/v1/object/public/documents/mixkit-correct-answer-tone-2870.wav';
    bgRef.current = new Audio(bgUrl);
    bgRef.current.loop = true;
    bgRef.current.volume = 0.25;
    bgOrigVol.current = bgRef.current.volume;
    startRef.current = new Audio(startUrl);
    const play = async () => {
      try { if (bgRef.current) await bgRef.current.play(); } catch (e) {}
      try {
        if (startRef.current) {
          if (bgRef.current) bgRef.current.volume = Math.max(0.05, bgOrigVol.current * 0.25);
          startRef.current.currentTime = 0;
          startRef.current.play().catch(() => {});
          startRef.current.addEventListener('ended', () => {
            try { if (bgRef.current) bgRef.current.volume = bgOrigVol.current; } catch(e) {}
          });
        }
      } catch (e) {}
    };
    play();
    return () => {
      try { if (bgRef.current) { bgRef.current.pause(); bgRef.current = null; } } catch(e) {}
      try { if (startRef.current) { startRef.current.pause(); startRef.current = null; } } catch(e) {}
    };
  }, []);

  const stopAllAudio = () => {
    try {
      if (bgRef.current) { bgRef.current.pause(); try { bgRef.current.currentTime = 0; } catch(e) {} }
      if (startRef.current) { startRef.current.pause(); try { startRef.current.currentTime = 0; } catch(e) {} }
    } catch(e) {}
  };

  const copyJoinCode = () => {
    if (session?.join_code) {
      navigator.clipboard.writeText(session.join_code);
      toast({ title: 'Copied!', description: 'Join code copied to clipboard' });
    }
  };

  const handleStartQuiz = async () => {
    if (!session || !isHost) return;
    setIsLoading(true);
    try {
      try {
        if (startRef.current) {
          if (bgRef.current) bgRef.current.volume = Math.max(0.05, bgOrigVol.current * 0.25);
          startRef.current.currentTime = 0;
          startRef.current.play().catch(() => {});
          startRef.current.addEventListener('ended', () => {
            try { if (bgRef.current) bgRef.current.volume = bgOrigVol.current; } catch(e) {}
          });
        }
      } catch(e) {}
      const result = await startLiveQuizSession(session.id, session.quiz_mode || session.config?.quiz_mode);
      if (result.error) throw new Error(result.error);
      toast({ title: 'Quiz Started!', description: 'Good luck everyone!' });
      await refreshSessionState();
      stopAllAudio();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to start quiz', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  if (!session) return null;
  const isMediatorMode = session.host_role === 'mediator';

  // ─── Fullscreen View ───
  if (isFullScreen) {
    return (
      <div className="fixed inset-0 z-50 overflow-hidden flex flex-col" style={COSMIC_BG}>
        {/* Ambient blobs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full blur-3xl" style={{ background: 'rgba(99,102,241,0.15)' }} />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full blur-3xl" style={{ background: 'rgba(139,92,246,0.12)' }} />
        </div>

        {/* Top bar */}
        <div
          className="relative z-10 flex items-center justify-between px-4 sm:px-6 py-3 shrink-0"
          style={{ background: 'rgba(0,0,0,0.35)', borderBottom: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(16px)' }}
        >
          <Button
            variant="ghost" size="sm"
            onClick={() => setIsFullScreen(false)}
            className="text-white/60 hover:text-white hover:bg-white/10 gap-1.5"
          >
            <Minimize2 className="h-4 w-4" />
            <span className="hidden sm:inline text-xs">Exit</span>
          </Button>

          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg" style={{ background: 'rgba(250,204,21,0.2)', border: '1px solid rgba(250,204,21,0.3)' }}>
              <Crown className="h-4 w-4 text-yellow-400" />
            </div>
            <div>
              <h1 className="font-bold text-sm text-white leading-none">
                Host Lobby
                {isMediatorMode && <span className="ml-2 text-xs font-normal text-blue-300">(Mediator)</span>}
              </h1>
              <p className="text-xs text-white/40 mt-0.5">{players.length} player{players.length !== 1 ? 's' : ''} ready</p>
            </div>
          </div>

          <Button
            variant="ghost" size="sm"
            onClick={resetView}
            className="text-red-400 hover:text-red-300 hover:bg-red-500/10 gap-1.5"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline text-xs">End</span>
          </Button>
        </div>

        {/* Main Content */}
        <div className="relative z-10 flex-1 flex flex-col lg:flex-row items-center justify-center p-4 sm:p-6 lg:p-10 gap-8 overflow-y-auto">

          {/* Left: Join Code + Start */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex flex-col items-center gap-6 w-full lg:w-auto flex-shrink-0"
          >
            {/* Join code */}
            <div className="text-center">
              <p className="text-white/40 text-xs uppercase tracking-widest font-semibold mb-3">Session Code</p>
              <button
                onClick={copyJoinCode}
                className="text-6xl sm:text-7xl lg:text-8xl font-black tracking-widest font-mono text-transparent hover:scale-105 transition-transform outline-none"
                style={{ background: 'linear-gradient(135deg,#818cf8,#c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
                title="Click to copy"
              >
                {session.join_code}
              </button>
              <p className="text-white/30 text-sm mt-2 flex items-center justify-center gap-1.5">
                <Copy className="h-3.5 w-3.5" /> Click code to copy
              </p>
            </div>

            {/* Scheduled countdown */}
            {scheduledTime && countdown && (
              <div
                className="rounded-2xl px-8 py-4 text-center animate-pulse"
                style={{ ...GLASS, background: 'rgba(99,102,241,0.12)' }}
              >
                <p className="text-indigo-300 text-xs uppercase tracking-widest font-bold mb-1">Auto-Start In</p>
                <p className="text-white font-black text-4xl font-mono">{countdown}</p>
              </div>
            )}

            {/* Session settings summary */}
            <div className="flex flex-wrap gap-2 justify-center">
              <span className="px-3 py-1.5 rounded-full text-xs font-semibold text-white/50" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                {isMediatorMode ? '👁 Mediator' : '🎮 Participant'}
              </span>
              <span className="px-3 py-1.5 rounded-full text-xs font-semibold text-white/50" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <Clock className="h-3 w-3 inline mr-1" />{session.config?.question_time_limit || 30}s / question
              </span>
              <span className="px-3 py-1.5 rounded-full text-xs font-semibold text-white/50" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                {session.advance_mode === 'auto' ? '⚡ Auto-advance' : '👆 Manual advance'}
              </span>
            </div>

            {/* Start button */}
            <button
              onClick={handleStartQuiz}
              disabled={isLoading || players.length < 1}
              className="h-16 px-12 rounded-2xl font-black text-white text-xl relative overflow-hidden group transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105"
              style={{ background: 'linear-gradient(135deg,#10b981,#059669)', boxShadow: '0 0 40px rgba(16,185,129,0.35)' }}
            >
              {isLoading ? (
                <span className="flex items-center gap-3"><Loader2 className="h-6 w-6 animate-spin" /> Starting…</span>
              ) : (
                <span className="flex items-center gap-3"><Play className="h-6 w-6 fill-current" /> Launch Quiz</span>
              )}
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          </motion.div>

          {/* Right: Player Grid */}
          <div className="flex-1 w-full max-w-xl rounded-3xl overflow-hidden flex flex-col" style={{ ...GLASS, minHeight: '300px', maxHeight: '500px' }}>
            <div
              className="flex items-center justify-between px-5 py-3 border-b shrink-0"
              style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.2)' }}
            >
              <h3 className="text-white font-bold text-sm flex items-center gap-2">
                <Users className="h-4 w-4" /> Participants
              </h3>
              <Button
                variant="ghost" size="sm"
                onClick={refreshSessionState}
                disabled={isLoading}
                className="h-7 w-7 p-0 text-white/40 hover:text-white hover:bg-white/10"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {players.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-white/30 gap-3">
                  <Loader2 className="h-10 w-10 animate-spin opacity-40" />
                  <p className="text-sm">Waiting for players to join…</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <AnimatePresence>
                    {players.map((player, i) => (
                      <motion.div
                        key={player.id}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        className="flex items-center gap-2.5 p-2.5 rounded-xl"
                        style={{
                          background: player.user_id === userId ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.06)',
                          border: player.user_id === userId ? '1px solid rgba(99,102,241,0.35)' : '1px solid rgba(255,255,255,0.06)',
                        }}
                      >
                        <div
                          className="h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                          style={{ background: 'rgba(99,102,241,0.4)' }}
                        >
                          {(player.display_name || 'U')[0]?.toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-white/85 text-sm font-medium truncate">{player.display_name}</div>
                          {player.is_host && <div className="text-yellow-400 text-xs">👑 Host</div>}
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Compact (non-fullscreen) View ───
  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <Card className="rounded-2xl border-2 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-yellow-500" />
              Host Lobby
              {isMediatorMode && (
                <Badge variant="secondary" className="ml-1 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                  <UserCog className="h-3 w-3 mr-1" /> Mediator
                </Badge>
              )}
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsFullScreen(true)}>
                <Maximize2 className="h-4 w-4 mr-2" /> Fullscreen
              </Button>
              <Button variant="ghost" size="sm" onClick={resetView} className="text-gray-500 hover:text-gray-700">
                <LogOut className="h-4 w-4 mr-1.5" /> Leave
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-5 text-center">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Join Code</p>
              <div className="flex items-center justify-center gap-3">
                <span className="text-4xl font-bold tracking-widest font-mono text-gray-800 dark:text-gray-100">{session.join_code}</span>
                <Button variant="ghost" size="sm" onClick={copyJoinCode} className="p-1.5 h-auto">
                  <Copy className="h-4 w-4 text-gray-400" />
                </Button>
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-2.5">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Settings</p>
              {scheduledTime && countdown && (
                <div className="mb-2 p-2 bg-blue-100 dark:bg-blue-900/30 rounded text-center">
                  <div className="text-xs text-blue-600 dark:text-blue-300 font-bold mb-1">SCHEDULED START</div>
                  <div className="text-xl font-mono font-bold text-blue-800 dark:text-blue-200">{countdown}</div>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <Settings className="h-4 w-4 text-gray-400" />
                <span className="text-gray-600 dark:text-gray-300">Advance:</span>
                <span className="font-semibold">{session.advance_mode === 'auto' ? 'Auto' : 'Manual'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-gray-400" />
                <span className="text-gray-600 dark:text-gray-300">Time limit:</span>
                <span className="font-semibold">{session.config?.question_time_limit || 30}s</span>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-gray-500" /> Players
                <Badge variant="secondary">{players.length}</Badge>
              </h3>
              <Button variant="ghost" size="sm" onClick={refreshSessionState} disabled={isLoading} className="h-8 px-2">
                <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {players.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Loader2 className="h-8 w-8 mx-auto mb-2 opacity-40 animate-spin" />
                  <p className="text-sm">Waiting for players…</p>
                </div>
              ) : players.map((player) => (
                <div
                  key={player.id}
                  className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                    player.user_id === userId
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-400'
                      : 'bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <Avatar className="h-9 w-9 flex-shrink-0">
                    <AvatarImage src={player.avatar_url || undefined} />
                    <AvatarFallback>{(player.display_name || 'U')[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="flex-1 font-medium text-sm">
                    {player.display_name}
                    {player.user_id === userId && <span className="text-xs text-gray-400 ml-1.5">(You)</span>}
                  </span>
                  {player.is_host && (
                    <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 text-xs">
                      <Crown className="h-2.5 w-2.5 mr-0.5" /> Host
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>

          <Button
            onClick={handleStartQuiz}
            disabled={isLoading || players.length < 1}
            className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold py-3.5 text-base rounded-xl"
          >
            {isLoading ? (
              <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Starting…</>
            ) : (
              <><Play className="h-5 w-5 mr-2" /> Start Quiz</>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default LiveQuizHostLobby;