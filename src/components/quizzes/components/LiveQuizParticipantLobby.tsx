// src/components/quizzes/components/LiveQuizParticipantLobby.tsx
import React from 'react';
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

const COSMIC_BG: React.CSSProperties = {
  background: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)',
};

const GLASS_CARD: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  backdropFilter: 'blur(12px)',
};

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
  const [isMobile, setIsMobile] = React.useState(false);
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
        setCountdown('Starting...');
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

  React.useEffect(() => {
    const update = () => setIsMobile(typeof window !== 'undefined' ? window.innerWidth < 640 : false);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  if (!session) return null;

  // --- Fullscreen Immersive View ---
  if (isFullScreen) {
    const myPlayer = players.find(p => p.user_id === userId);
    const initials = (myPlayer?.display_name || 'You').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();

    return (
      <div className="fixed inset-0 z-50 overflow-hidden flex flex-col" style={COSMIC_BG}>
        {/* Ambient blobs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full blur-3xl" style={{ background: 'rgba(16,185,129,0.12)' }} />
          <div className="absolute -bottom-40 -right-40 w-80 h-80 rounded-full blur-3xl" style={{ background: 'rgba(99,102,241,0.15)' }} />
        </div>

        {/* Top Bar */}
        <div
          className="relative z-10 flex items-center justify-between px-4 sm:px-6 py-3 shrink-0"
          style={{ background: 'rgba(0,0,0,0.35)', borderBottom: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(16px)' }}
        >
          <Button
            variant="ghost" size="sm"
            onClick={() => setIsFullScreen(false)}
            className="text-white/60 hover:text-white hover:bg-white/10 gap-2"
          >
            <Minimize2 className="h-4 w-4" />
            <span className="hidden sm:inline text-xs">Exit</span>
          </Button>

          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg" style={{ background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.3)' }}>
              <Users className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <h1 className="font-bold text-sm text-white leading-none">Participant Lobby</h1>
              <p className="text-xs text-white/40 mt-0.5">Waiting for host</p>
            </div>
          </div>

          <Button
            variant="ghost" size="sm"
            onClick={resetView}
            className="text-red-400 hover:text-red-300 hover:bg-red-500/10 gap-2"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline text-xs">Leave</span>
          </Button>
        </div>

        {/* Main Content */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 overflow-y-auto">
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-lg flex flex-col items-center gap-8"
          >
            {/* Avatar + name */}
            <div className="flex flex-col items-center gap-3">
              <div
                className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-black text-white shadow-2xl"
                style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', boxShadow: '0 0 40px rgba(99,102,241,0.4)' }}
              >
                {initials}
              </div>
              <div className="text-center">
                <p className="text-xs text-white/40 uppercase tracking-widest mb-1">You are</p>
                <p className="text-2xl font-black text-white">{myPlayer?.display_name || 'You'}</p>
              </div>
            </div>

            {/* Status message */}
            <div className="text-center space-y-3 w-full">
              <h2 className="text-3xl sm:text-4xl font-black text-white">
                {scheduledTime && countdown ? 'Get Ready!' : "You're In! ⚡"}
              </h2>

              {scheduledTime && countdown ? (
                <div
                  className="rounded-2xl p-6 text-center w-full"
                  style={GLASS_CARD}
                >
                  <p className="text-emerald-400 uppercase tracking-widest text-xs font-bold mb-2">Quiz Starts In</p>
                  <div className="text-5xl font-black text-white font-mono tabular-nums">{countdown}</div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-white/50 text-base leading-relaxed max-w-sm mx-auto">
                    See your name on screen? Sit tight — the host will start the game shortly.
                  </p>
                  <div
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm text-white/50 animate-pulse"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    <Clock className="w-4 h-4" />
                    Waiting for host…
                  </div>
                </div>
              )}
            </div>

            {/* Session info pills */}
            <div className="flex flex-wrap gap-2 justify-center">
              {session.host_role === 'mediator' && (
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-blue-300"
                  style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.25)' }}
                >
                  <UserCog className="h-3.5 w-3.5" /> Host is mediator
                </span>
              )}
              {session.advance_mode && (
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-white/50"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  <Clock className="h-3.5 w-3.5" />
                  {session.advance_mode === 'auto' ? 'Auto advance' : 'Manual advance'}
                </span>
              )}
              {session.config?.question_time_limit && (
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-white/50"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  <Clock className="h-3.5 w-3.5" /> {session.config.question_time_limit}s / question
                </span>
              )}
            </div>

            {/* Players list */}
            <div className="w-full rounded-2xl overflow-hidden" style={GLASS_CARD}>
              <div
                className="flex items-center justify-between px-4 py-3 border-b"
                style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.15)' }}
              >
                <span className="text-white/70 text-sm font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4" /> Players
                  <span
                    className="ml-1 px-2 py-0.5 rounded-full text-xs font-bold"
                    style={{ background: 'rgba(99,102,241,0.2)', color: '#a5b4fc' }}
                  >
                    {players.length}
                  </span>
                </span>
                <Button
                  variant="ghost" size="sm"
                  onClick={refreshSessionState}
                  disabled={isLoading}
                  className="h-7 w-7 p-0 text-white/40 hover:text-white hover:bg-white/10"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
              <div className="p-3 space-y-2 max-h-48 overflow-y-auto">
                {players.map((player, i) => (
                  <div
                    key={player.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                    style={{
                      background: player.user_id === userId ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)',
                      border: player.user_id === userId ? '1px solid rgba(99,102,241,0.3)' : '1px solid rgba(255,255,255,0.06)',
                      animation: `slideIn 0.3s ease ${i * 0.06}s both`,
                    }}
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                      style={{ background: 'rgba(99,102,241,0.35)' }}
                    >
                      {(player.display_name || 'U')[0]?.toUpperCase()}
                    </div>
                    <span className="flex-1 text-sm font-medium text-white/80">{player.display_name}</span>
                    {player.user_id === userId && <span className="text-xs text-indigo-400">You</span>}
                    {player.is_host && (
                      <span className="text-xs text-yellow-400 flex items-center gap-0.5">
                        <Crown className="h-3 w-3" /> Host
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        <style>{`
          @keyframes slideIn {
            from { opacity: 0; transform: translateX(-12px); }
            to { opacity: 1; transform: translateX(0); }
          }
        `}</style>
      </div>
    );
  }

  // --- Compact (non-fullscreen) View ---
  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold flex items-center gap-2 text-gray-800 dark:text-white">
          <Users className="h-5 w-5 text-green-500" /> Waiting to Start
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsFullScreen(true)}>
            <Maximize2 className="h-4 w-4 mr-2" /> Fullscreen
          </Button>
          <Button variant="ghost" size="sm" onClick={resetView} className="text-gray-500">
            <LogOut className="h-4 w-4 mr-1.5" /> Leave
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="text-center py-8 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/15 dark:to-indigo-900/15 rounded-xl border border-blue-100 dark:border-blue-800">
        {scheduledTime && countdown ? (
          <div className="text-4xl font-bold font-mono text-blue-600 dark:text-blue-300 animate-pulse mb-2">{countdown}</div>
        ) : (
          <div className="flex items-center justify-center gap-2 mb-4">
            {[0, 150, 300].map(delay => (
              <div key={delay} className="w-3 h-3 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: `${delay}ms` }} />
            ))}
          </div>
        )}
        <h3 className="text-lg font-semibold mb-1">Get Ready!</h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm">Waiting for the host to start the quiz…</p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Users className="h-4 w-4 text-gray-500" /> Players
            <Badge variant="secondary" className="bg-gray-100 text-gray-600 dark:bg-gray-700">{players.length}</Badge>
          </h3>
          <Button variant="ghost" size="sm" onClick={refreshSessionState} disabled={isLoading} className="h-8 px-2">
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        {players.map((player) => (
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
  );
};

export default LiveQuizParticipantLobby;