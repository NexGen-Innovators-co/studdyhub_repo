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
} from 'lucide-react';
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
  if (!session) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <Card className="rounded-2xl border-2 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-green-500" />
              Waiting to Start
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

          {/* ─── Waiting Animation ─── */}
          <div className="text-center py-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/15 dark:to-indigo-900/15 rounded-xl border border-blue-100 dark:border-blue-800">
            {/* Pulsing dots */}
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="w-3 h-3 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-3 h-3 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-3 h-3 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
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