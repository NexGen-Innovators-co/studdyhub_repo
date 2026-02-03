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
} from 'lucide-react';
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
      const result = await startLiveQuizSession(session.id, session.quiz_mode || session.config?.quiz_mode);
      if (result.error) throw new Error(result.error);

      toast({ title: 'Quiz Started!', description: 'Good luck everyone!' });
      await refreshSessionState();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to start quiz', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  if (!session) return null;

  const isMediatorMode = session.host_role === 'mediator';

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
            <Button variant="ghost" size="sm" onClick={resetView} className="text-gray-500 hover:text-gray-700">
              <LogOut className="h-4 w-4 mr-1.5" /> Leave
            </Button>
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