// src/components/quizzes/components/LiveQuizLeaderboard.tsx
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';
import { Trophy, Crown, Zap, CheckCircle } from 'lucide-react';
import { LiveQuizPlayer, LiveQuizQuestion } from '@/services/liveQuizService';

interface LiveQuizLeaderboardProps {
  players: LiveQuizPlayer[];
  currentQuestion: LiveQuizQuestion | null;
  userId: string;
}

export const LiveQuizLeaderboard: React.FC<LiveQuizLeaderboardProps> = ({
  players,
  currentQuestion,
  userId,
}) => {
  const playingPlayers = players.filter(p => p.is_playing);

  return (
    <Card className="rounded-2xl border-2 shadow-lg h-fit">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="h-5 w-5 text-yellow-500" />
          Leaderboard
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {playingPlayers
            .sort((a, b) => b.score - a.score)
            .map((player, index) => {
              const answered =
                currentQuestion &&
                player.last_answered_at &&
                new Date(player.last_answered_at) >=
                  new Date(currentQuestion.start_time || 0);

              return (
                <div
                  key={player.id}
                  className={[
                    'flex items-center justify-between p-2.5 rounded-lg transition-all',
                    player.user_id === userId
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-500'
                      : 'bg-gray-50 dark:bg-gray-800 border border-transparent',
                  ].join(' ')}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Rank badge */}
                    <span
                      className={[
                        'text-sm font-bold w-6 h-6 flex items-center justify-center rounded-full flex-shrink-0',
                        index === 0
                          ? 'bg-yellow-500 text-white'
                          : index === 1
                            ? 'bg-gray-400 text-white'
                            : index === 2
                              ? 'bg-orange-500 text-white'
                              : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
                      ].join(' ')}
                    >
                      {index + 1}
                    </span>

                    <span className="truncate flex items-center gap-2">
                      {index === 0 && (
                        <Crown className="h-3.5 w-3.5 text-yellow-500 flex-shrink-0" />
                      )}
                      <Avatar className="h-6 w-6 flex-shrink-0">
                        <AvatarImage src={player.avatar_url || undefined} />
                        <AvatarFallback>
                          {(player.display_name || 'U')[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-sm">
                        {player.display_name}
                      </span>
                      {player.user_id === userId && (
                        <span className="text-xs text-gray-400">(You)</span>
                      )}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Answered tick for this question */}
                    {answered ? (
                      <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <div className="h-3.5 w-3.5 rounded-full border-2 border-gray-300 dark:border-gray-600" />
                    )}
                    <div className="flex items-center gap-0.5">
                      <Zap className="h-3.5 w-3.5 text-yellow-500" />
                      <span className="font-bold text-sm">{player.score}</span>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </CardContent>
    </Card>
  );
};

export default LiveQuizLeaderboard;
