// src/components/quizzes/components/LiveQuizParticipantLobby.tsx
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Alert, AlertDescription } from '../../ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';
import {
  Users,
  Clock,
  Crown,
  AlertCircle,
  LogOut,
  RefreshCw,
  UserCog,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { LiveQuizSession, LiveQuizPlayer } from '@/services/liveQuizService';

interface LiveQuizParticipantLobbyProps {
  session: LiveQuizSession | null;
  players: LiveQuizPlayer[];
  userId: string;
  isLoading: boolean;
  error: string | null;
  refreshSessionState: () => Promise<void>;
  resetView: () => void;
  toast: any;
}


const LiveQuizParticipantLobby: React.FC<LiveQuizParticipantLobbyProps> = ({
  session,
  players,
  userId,
  isLoading,
  error,
  refreshSessionState,
  resetView,
  toast,
}) => {
  const [isFullScreen, setIsFullScreen] = React.useState(true);
  // Audio refs for lobby
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
        // play a soft start chime once
        if (startRef.current) {
          // duck bg
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

  if (!session) return null;

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
        <div className="relative z-10 flex items-center justify-between px-6 py-4 bg-blue-600/90 dark:bg-black/20 backdrop-blur-md border-b border-blue-500/20 dark:border-white/10 shrink-0 shadow-lg dark:shadow-none">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-white/20 dark:bg-green-500/20 rounded-lg border border-white/10 dark:border-green-500/30 shadow-inner">
                <Users className="h-5 w-5 text-white dark:text-green-400" />
             </div>
             <div>
               <h1 className="font-bold text-lg leading-none text-white dark:text-white">Participant Lobby</h1>
               <div className="flex items-center gap-2 text-sm text-blue-100 dark:text-white/50">
                  <Badge variant="outline" className="border-white/30 dark:border-white/20 text-white dark:text-white/70 h-5 px-1.5 text-[10px] bg-white/10 dark:bg-transparent">
                    Waiting for Host
                  </Badge>
               </div>
             </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
               variant="ghost" 
               size="sm" 
               onClick={() => setIsFullScreen(false)}
               className="hover:bg-white/20 dark:hover:bg-white/10 text-white/80 dark:text-white/70 hover:text-white dark:hover:text-white"
            >
               <Minimize2 className="h-4 w-4 mr-2" />
               Exit Fullscreen
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={resetView} 
              className="bg-red-500/80 dark:bg-red-500/20 hover:bg-red-600 dark:hover:bg-red-500/40 text-white dark:text-red-300 border border-white/20 dark:border-red-500/30"
            >
              <LogOut className="h-4 w-4 mr-2" /> Leave
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-6">
           <motion.div
             initial={{ scale: 0.9, opacity: 0 }}
             animate={{ scale: 1, opacity: 1 }}
             className="bg-white/60 dark:bg-white/5 backdrop-blur-2xl border border-white/20 dark:border-white/10 p-8 md:p-12 rounded-3xl shadow-2xl w-full max-w-3xl flex flex-col md:flex-row items-center gap-8 md:gap-12"
           >
              {/* Left Side: Avatar & Status */}
              <div className="flex flex-col items-center gap-4 min-w-[200px] border-b md:border-b-0 md:border-r border-gray-200 dark:border-white/10 pb-6 md:pb-0 md:pr-12 w-full md:w-auto">
                 <div className="relative">
                    <div className="absolute -inset-4 bg-green-500/20 rounded-full blur-xl animate-pulse" />
                    <Avatar className="h-24 w-24 md:h-32 md:w-32 border-4 border-green-500/50 shadow-[0_0_30px_rgba(34,197,94,0.4)] relative bg-white dark:bg-black">
                        <AvatarImage src={players.find(p => p.user_id === userId)?.avatar_url || undefined} />
                        <AvatarFallback className="bg-slate-100 dark:bg-slate-800 text-3xl font-bold">
                            {(players.find(p => p.user_id === userId)?.display_name || 'U')[0]}
                        </AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-2 -right-2 bg-green-500 text-white dark:text-black text-xs font-bold px-2 py-1 rounded-full border-2 border-white dark:border-black">
                        READY
                    </div>
                 </div>
                 
                 <div className="text-center">
                    <div className="text-xs text-gray-500 dark:text-white/40 uppercase tracking-widest font-semibold mb-1">You are</div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white truncate max-w-[200px]">
                        {players.find(p => p.user_id === userId)?.display_name || 'You'}
                    </div>
                 </div>
              </div>

              {/* Right Side: Message & Timer */}
              <div className="text-center md:text-left flex-1 space-y-4">
                  <h2 className="text-3xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-600 via-emerald-500 to-teal-600 dark:from-green-300 dark:via-emerald-200 dark:to-teal-400 drop-shadow-sm leading-tight">
                     {scheduledTime && countdown ? "Get Ready!" : "You're In!"}
                  </h2>
                  
                  {scheduledTime && countdown ? (
                     <div className="bg-black/5 dark:bg-black/30 rounded-2xl p-6 border border-black/10 dark:border-white/5">
                        <p className="text-green-600 dark:text-emerald-400/80 uppercase tracking-widest text-xs font-bold mb-2">Quiz Starts In</p>
                        <div className="text-5xl md:text-7xl font-mono font-black text-gray-900 dark:text-white tabular-nums tracking-tighter">
                            {countdown}
                        </div>
                     </div>
                  ) : (
                     <div className="space-y-4">
                        <p className="text-lg md:text-xl text-gray-600 dark:text-white/70 font-light leading-relaxed">
                           See your name on screen? Sit tight! The host will start the game shortly.
                        </p>
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-sm text-gray-500 dark:text-white/50 animate-pulse">
                            <Clock className="w-4 h-4" />
                            <span>Waiting for host...</span>
                        </div>
                     </div>
                  )}
              </div>
           </motion.div>
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
              <Users className="h-5 w-5 text-green-500" />
              Waiting to Start
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

          {/* ─── Waiting Animation ─── */}
          <div className="text-center py-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/15 dark:to-indigo-900/15 rounded-xl border border-blue-100 dark:border-blue-800">
            {scheduledTime && countdown ? (
               <div className="mb-4">
                  <div className="text-4xl font-bold font-mono text-blue-600 dark:text-blue-300 animate-pulse">
                     {countdown}
                  </div>
                  <p className="text-sm text-blue-500/80 uppercase tracking-widest mt-1">Starting In</p>
               </div>
            ) : (
                <>
                {/* Pulsing dots */}
                <div className="flex items-center justify-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-3 h-3 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-3 h-3 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                </>
            )}
            
            <h3 className="text-lg font-semibold mb-1">Get Ready!</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Waiting for the host to start the quiz…
            </p>

            {/* Info pills */}
            <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
              {session.host_role === 'mediator' && (
                <span className="inline-flex items-center gap-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2.5 py-1 rounded-full">
                  <UserCog className="h-3 w-3" /> Host is mediator
                </span>
              )}
              {session.advance_mode && (
                <span className="inline-flex items-center gap-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2.5 py-1 rounded-full">
                  <Clock className="h-3 w-3" /> {session.advance_mode === 'auto' ? 'Auto advance' : 'Manual advance'}
                </span>
              )}
              {session.config?.question_time_limit && (
                <span className="inline-flex items-center gap-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2.5 py-1 rounded-full">
                  <Clock className="h-3 w-3" /> {session.config.question_time_limit}s per question
                </span>
              )}
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

            <div className="space-y-2">
              {players.map((player) => (
                <div
                  key={player.id}
                  className={[
                    'flex items-center gap-3 p-3 rounded-lg transition-all',
                    player.user_id === userId
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-400'
                      : 'bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700',
                  ].join(' ')}
                >
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
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LiveQuizParticipantLobby;