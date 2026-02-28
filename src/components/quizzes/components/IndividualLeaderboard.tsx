// src/components/quizzes/components/LiveQuizLeaderboard.tsx
import React from 'react';
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
  const sorted = [...playingPlayers].sort((a, b) => b.score - a.score);

  const medalColors = [
    'from-yellow-500 to-amber-600',
    'from-gray-400 to-gray-500',
    'from-orange-500 to-amber-600',
  ];

  return (
    <div
      className="rounded-2xl overflow-hidden border h-fit"
      style={{
        background: 'rgba(255,255,255,0.04)',
        borderColor: 'rgba(255,255,255,0.1)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center gap-2 border-b"
        style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.2)' }}
      >
        <Trophy className="h-4 w-4 text-yellow-400" />
        <span className="text-white font-bold text-sm tracking-wide uppercase">Leaderboard</span>
        <span className="ml-auto text-xs text-white/40">{sorted.length} players</span>
      </div>

      {/* Player list */}
      <div className="p-3 space-y-2">
        {sorted.map((player, index) => {
          const answered =
            currentQuestion &&
            player.last_answered_at &&
            new Date(player.last_answered_at) >= new Date(currentQuestion.start_time || 0);

          const isMe = player.user_id === userId;

          return (
            <div
              key={player.id}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all"
              style={{
                background: isMe
                  ? 'rgba(99,102,241,0.2)'
                  : 'rgba(255,255,255,0.04)',
                border: isMe
                  ? '1px solid rgba(99,102,241,0.4)'
                  : '1px solid rgba(255,255,255,0.06)',
              }}
            >
              {/* Rank badge */}
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 text-white ${
                  index < 3 ? `bg-gradient-to-br ${medalColors[index]}` : ''
                }`}
                style={index >= 3 ? { background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' } : {}}
              >
                {index < 3 ? ['🥇', '🥈', '🥉'][index] : index + 1}
              </div>

              {/* Avatar initial */}
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ background: 'rgba(99,102,241,0.4)', color: 'white' }}
              >
                {(player.display_name || 'U')[0]?.toUpperCase()}
              </div>

              {/* Name */}
              <span className="flex-1 min-w-0">
                <span
                  className="text-sm font-semibold truncate block"
                  style={{ color: isMe ? '#a5b4fc' : 'rgba(255,255,255,0.85)' }}
                >
                  {index === 0 && <Crown className="h-3 w-3 text-yellow-400 inline mr-1 flex-shrink-0" />}
                  {player.display_name}
                  {isMe && <span className="text-xs text-indigo-400 ml-1">(you)</span>}
                </span>
              </span>

              {/* Answered indicator + score */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {answered ? (
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <div
                    className="h-3.5 w-3.5 rounded-full border-2 flex-shrink-0"
                    style={{ borderColor: 'rgba(255,255,255,0.2)' }}
                  />
                )}
                <div className="flex items-center gap-0.5">
                  <Zap className="h-3 w-3 text-yellow-400" />
                  <span className="font-black text-sm text-yellow-400">{player.score}</span>
                </div>
              </div>
            </div>
          );
        })}

        {sorted.length === 0 && (
          <div className="text-center py-6 text-white/30 text-sm">
            No players yet
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveQuizLeaderboard;