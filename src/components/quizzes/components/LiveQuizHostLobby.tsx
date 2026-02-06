// src/components/quizzes/components/LiveQuizHostLobby.tsx
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Alert, AlertDescription } from '../../ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';
import {
  Users,
  Play,
  Crown,
  Copy,
  Loader2,
  AlertCircle,
  LogOut,
  RefreshCw,
  Settings,
  UserCog,
  Clock,
  Maximize2,
  Minimize2,
  X,
  QrCode,
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


const LiveQuizHostLobby: React.FC<LiveQuizHostLobbyProps> = ({
  session,
  players,
  isHost,
  userId,
  isLoading,
  error,
  refreshSessionState,
  setIsLoading,
  setSession,
  setViewMode,
  resetView,
  toast,
}) => {
  const [isFullScreen, setIsFullScreen] = React.useState(true);
  const [isMobile, setIsMobile] = React.useState(false);
  // Lobby audio refs
  const bgRef = React.useRef<HTMLAudioElement | null>(null);
  const startRef = React.useRef<HTMLAudioElement | null>(null);
  const bgOrigVol = React.useRef<number>(0.3);
  const scheduledTime = session?.scheduled_start_time ? new Date(session.scheduled_start_time) : null;
  const [countdown, setCountdown] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!scheduledTime) return;
    const updateCountdown = () => {
      const now = new Date();
      const diff = scheduledTime.getTime() - now.getTime();
      if (diff <= 0) {
        setCountdown("Starting...");
      } else {
        const min = Math.floor(diff / 60000);
        const sec = Math.floor((diff % 60000) / 1000);
        setCountdown(`${min}:${sec < 10 ? '0' : ''}${sec}`);
      }
    };
    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [scheduledTime]);

  React.useEffect(() => {
    const update = () => setIsMobile(typeof window !== 'undefined' ? window.innerWidth < 640 : false);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // initialize lobby audio
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
          try { (window as any).__quizStartPlayedAt = Date.now(); } catch(e) {}
          startRef.current.addEventListener('ended', () => {
            try { if (bgRef.current) bgRef.current.volume = bgOrigVol.current; } catch (e) {}
          });
        }
      } catch (e) {}
    };

    play();

    return () => {
      try { if (bgRef.current) { bgRef.current.pause(); bgRef.current = null; } } catch (e) {}
      try { if (startRef.current) { startRef.current.pause(); startRef.current = null; } } catch (e) {}
    };
  }, []);

  const stopAllAudio = () => {
    try {
      if (bgRef.current) { bgRef.current.pause(); try { bgRef.current.currentTime = 0; } catch (e) {} }
      if (startRef.current) { startRef.current.pause(); try { startRef.current.currentTime = 0; } catch (e) {} }
    } catch (e) {}
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
      // play start chime and duck lobby bg
      try {
        if (startRef.current) {
          if (bgRef.current) bgRef.current.volume = Math.max(0.05, bgOrigVol.current * 0.25);
          startRef.current.currentTime = 0;
          startRef.current.play().catch(() => {});
          startRef.current.addEventListener('ended', () => {
            try { if (bgRef.current) bgRef.current.volume = bgOrigVol.current; } catch (e) {}
          });
        }
      } catch (e) {}

      const result = await startLiveQuizSession(session.id, session.quiz_mode || session.config?.quiz_mode);
      if (result.error) throw new Error(result.error);

      toast({ title: 'Quiz Started!', description: 'Good luck everyone!' });
      await refreshSessionState();
      // stop lobby audio to prevent overlap with active quiz audio
      stopAllAudio();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to start quiz', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  if (!session) return null;

  const isMediatorMode = session.host_role === 'mediator';

  // --- Fullscreen Immersive View ---
  if (isFullScreen) {
    return (
      <div className="fixed inset-0 z-50 bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-white overflow-hidden flex flex-col transition-colors duration-300">
        {/* Background */}
        <div className="absolute inset-0 z-0 opacity-40">
           <div 
             className="absolute inset-0 bg-cover bg-center"
             style={{ backgroundImage: "url('/herobackgroundimg.png')" }}
           />
           <div className="absolute inset-0 bg-white/30 dark:bg-slate-950/80 backdrop-blur-sm" />
        </div>

        {/* Top Bar */}
        {/* Responsive Top Bar */}
        <div className="relative z-10 flex items-center justify-between px-6 py-4 bg-white/80 dark:bg-black/20 backdrop-blur-md border-b border-gray-200 dark:border-white/10 shrink-0">
          {/* Minimize button - far left */}
          <div className="flex flex-row gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsFullScreen(false)}
              className="hover:bg-white/20 dark:hover:bg-white/10 text-gray-900 dark:text-white hover:text-gray-900 dark:hover:text-white"
            >
              <Minimize2 className="h-5 w-5 text-gray-900 dark:text-white" />
            </Button>
          </div>
          {/* Center crown, Host text, and badges */}
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg shadow-inner border border-white/10">
              <Crown className="h-6 w-6 text-gray-900 dark:text-yellow-500" />
            </div>
            <div>
              <h1 className="font-bold text-lg md:text-xl leading-none text-gray-900 dark:text-white">
                <span className="hidden md:inline">VisioQuiz Host</span>
                <span className="md:hidden inline">Host</span>
              </h1>
              <div className="flex items-center gap-2 text-sm text-gray-900 dark:text-white/70">
                <Badge variant="outline" className="border-white/30 dark:border-white/20 text-gray-900 dark:text-white h-5 px-1.5 bg-white/10 dark:bg-transparent text-[10px] md:text-xs">
                  <Users className="h-3 w-3 mr-1 md:hidden text-gray-900 dark:text-white" />
                  <span className="hidden md:inline">{players.length} Players Ready</span>
                  <span className="md:hidden inline">{players.length}</span>
                </Badge>
                {isMediatorMode && <Badge variant="secondary" className="bg-blue-900/40 text-blue-100 dark:bg-blue-500/20 dark:text-blue-300 border border-white/10 text-[10px] md:text-xs">Mediator</Badge>}
              </div>
            </div>
          </div>
          {/* Leave button - far right */}
          <div className="flex flex-row gap-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={resetView}
              className="bg-red-500/80 dark:bg-red-500/20 hover:bg-red-600 dark:hover:bg-red-500/40 text-white dark:text-red-300 border border-white/20 dark:border-red-500/30 shadow-sm px-2 md:px-4"
            >
              <LogOut className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">End</span>
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="relative z-10 flex-1 flex flex-col lg:flex-row items-center justify-center p-4 md:p-8 gap-6 md:gap-10 lg:gap-12 overflow-y-auto">
           {/* Left: Join Info */}
           <motion.div 
             initial={{ opacity: 0, x: -50 }}
             animate={{ opacity: 1, x: 0 }}
             className="flex flex-col items-center gap-6 md:gap-8 w-full lg:w-auto"
           >
              <div className="text-center space-y-2">
                 <h2 className="text-xl md:text-2xl font-light text-blue-900/60 dark:text-white/60 uppercase tracking-[0.2em] flex items-center justify-center gap-2">
                    Join Code
                    <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-full text-blue-900/40 hover:text-blue-900 dark:text-white/30 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10"
                        onClick={() => {
                            navigator.clipboard.writeText(session.join_code);
                            toast({ title: 'Copied!', description: 'Join code copied to clipboard' });
                        }}
                    >
                        <Copy className="h-5 w-5" />
                    </Button>
                 </h2>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(session.join_code);
                      toast({ title: 'Copied!', description: 'Join code copied to clipboard' });
                    }}
                    className="text-5xl md:text-8xl lg:text-9xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-400 dark:from-white dark:via-blue-100 dark:to-white/50 drop-shadow-xl dark:drop-shadow-2xl font-mono hover:scale-105 transition-transform cursor-pointer outline-none focus:scale-105 break-words"
                    title="Click to copy"
                  >
                    {session.join_code}
                  </button>
                 <p className="text-lg md:text-xl text-gray-500 dark:text-white/40">Enter this code to join</p>
              </div>

              {scheduledTime && countdown && (
                  <div className="bg-white/50 dark:bg-blue-500/10 border border-blue-500/30 rounded-2xl p-4 md:p-6 text-center backdrop-blur-md w-full max-w-sm md:max-w-md animate-pulse shadow-xl dark:shadow-none">
                      <div className="text-xs md:text-sm font-bold text-blue-600 dark:text-blue-300 uppercase tracking-widest mb-1">Auto-Start In</div>
                      <div className="text-4xl md:text-5xl font-mono font-bold text-blue-900 dark:text-white">{countdown}</div>
                  </div>
              )}
              
              <div className="flex gap-4 w-full justify-center">
                 <Button 
                   size="lg" 
                   onClick={handleStartQuiz}
                   disabled={isLoading}
                   className="h-14 md:h-16 px-8 md:px-12 text-xl md:text-2xl font-bold bg-blue-600 text-white hover:bg-blue-700 dark:bg-white dark:text-slate-900 dark:hover:bg-blue-50 shadow-[0_4px_14px_0_rgba(37,99,235,0.39)] dark:shadow-[0_0_30px_rgba(255,255,255,0.3)] transition-all hover:scale-105 rounded-2xl w-full md:w-auto"
                 > 
                    {isLoading ? <Loader2 className="h-6 w-6 animate-spin mr-3" /> : <Play className="h-6 w-6 mr-3 fill-current" />}
                    Start Quiz
                 </Button>
              </div>
           </motion.div>

           {/* Right: Player Grid */}
           <div className="flex-1 w-full max-w-2xl bg-white/60 dark:bg-black/20 backdrop-blur-md rounded-3xl border border-gray-200 dark:border-white/5 p-2 md:p-6 h-[300px] md:h-[500px] flex flex-col shadow-xl dark:shadow-none">
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200 dark:border-white/10">
                 <h3 className="text-xl font-semibold flex items-center gap-2 text-gray-900 dark:text-white">
                    <Users className="h-5 w-5 text-blue-600 dark:text-white" /> Participants
                 </h3>
                 <Button variant="ghost" size="sm" onClick={refreshSessionState} disabled={isLoading} className="hover:bg-black/5 dark:hover:bg-white/5 text-gray-500 dark:text-white/70">
                   <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                 </Button>
              </div>
              
              {players.length === 0 ? (
                 <div className="flex-1 flex flex-col items-center justify-center text-gray-400 dark:text-white/30 gap-4">
                    <div className="w-20 h-20 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center animate-pulse">
                       <Loader2 className="h-10 w-10 animate-spin" />
                    </div>
                    <p className="text-lg">Waiting for players to join...</p>
                 </div>
              ) : (
                 <div className="grid grid-cols-2 md:grid-cols-3 gap-3 overflow-y-auto pr-2 custom-scrollbar content-start">
                    <AnimatePresence>
                      {players.map((player) => (
                        <motion.div
                          key={player.id}
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          className="flex items-center gap-3 p-3 bg-white dark:bg-white/10 rounded-xl border border-gray-200 dark:border-white/5 shadow-sm dark:shadow-none"
                        >
                          <Avatar className="h-10 w-10 border-2 border-gray-100 dark:border-white/20">
                            <AvatarImage src={player.avatar_url || undefined} />
                            <AvatarFallback className="bg-slate-200 dark:bg-slate-700 text-gray-700 dark:text-white">{(player.display_name || 'U')[0]}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                             <div className="font-medium truncate text-gray-900 dark:text-white">{player.display_name}</div>
                             {player.is_host && <span className="text-xs text-yellow-600 dark:text-yellow-400 font-bold">Host</span>}
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                 </div>
              )}
           </div>
        </div>
      </div>
    );
  }

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

          {/* ─── Join Code + Settings ─── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Join code card */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-5 text-center">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Join Code</p>
              <div className="flex items-center justify-center gap-3">
                <span className="text-4xl font-bold tracking-widest font-mono text-gray-800 dark:text-gray-100">
                  {session.join_code}
                </span>
                <Button variant="ghost" size="sm" onClick={copyJoinCode} className="p-1.5 h-auto">
                  <Copy className="h-4 w-4 text-gray-400" />
                </Button>
              </div>
              <p className="text-xs text-gray-400 mt-2">Share with players</p>
            </div>

            {/* Session settings summary */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-2.5">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Settings</p>
              
              {scheduledTime && countdown && (
                 <div className="mb-2 p-2 bg-blue-100 dark:bg-blue-900/30 rounded text-center">
                    <div className="text-xs text-blue-600 dark:text-blue-300 font-bold mb-1">SCHEDULED START</div>
                    <div className="text-xl font-mono font-bold text-blue-800 dark:text-blue-200">{countdown}</div>
                 </div>
              )}

              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-gray-400" />
                <span className="text-gray-600 dark:text-gray-300">Role:</span>
                <span className="font-semibold">{isMediatorMode ? 'Mediator' : 'Participant'}</span>
              </div>
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
              <div className="flex items-center gap-2 text-sm">
                {session.allow_late_join === false ? (
                    <Badge variant="destructive" className="text-xs">Door Closes on Start</Badge>
                ) : (
                    <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">Late Join Allowed</Badge>
                )}
              </div>
            </div>
          </div>

          {/* ─── Players List ─── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-gray-500" />
                Players
                <Badge variant="secondary" className="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                  {players.length}
                </Badge>
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
              ) : (
                players.map((player) => (
                  <div
                    key={player.id}
                    className={[
                      'flex items-center gap-3 p-3 rounded-lg transition-all',
                      player.user_id === userId
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-400'
                        : 'bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700',
                    ].join(' ')}
                  >
                    {/* Avatar */}
                    <Avatar className="h-9 w-9 flex-shrink-0">
                      <AvatarImage src={player.avatar_url || undefined} />
                      <AvatarFallback>
                        {(player.display_name || 'U')[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    <span className="flex-1 font-medium text-sm">
                      {player.display_name}
                      {player.user_id === userId && <span className="text-xs text-gray-400 ml-1.5">(You)</span>}
                    </span>

                    {/* Badges */}
                    <div className="flex items-center gap-1.5">
                      {player.is_host && (
                        <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 text-xs">
                          <Crown className="h-2.5 w-2.5 mr-0.5" /> Host
                        </Badge>
                      )}
                      {player.is_host && !player.is_playing && (
                        <Badge variant="outline" className="text-xs text-gray-500">
                          <UserCog className="h-2.5 w-2.5 mr-0.5" /> Mediator
                        </Badge>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ─── Start Button ─── */}
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