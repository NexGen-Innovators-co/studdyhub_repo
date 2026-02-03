import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';

// Props: leaderboard
interface LeaderboardEntry {
  player_id: string;
  display_name: string;
  avatar_url?: string | null;
  score: number;
  questions_attempted: number;
  questions_correct: number;
  total_time_spent: number;
  accuracy: number;
  current_question_idx: number;
  status: string;
}

interface IndividualLeaderboardProps {
  leaderboard: LeaderboardEntry[];
  currentPlayerId: string;
}

const IndividualLeaderboard: React.FC<IndividualLeaderboardProps> = ({ leaderboard, currentPlayerId }) => {
  return (
    <section className="w-full overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-gray-500">
            <th className="py-2 pr-2">#</th>
            <th className="py-2 pr-2">Player</th>
            <th className="py-2 pr-2">Score</th>
            <th className="py-2 pr-2">Acc</th>
            <th className="py-2 pr-2">Q</th>
            <th className="py-2 pr-2">Time</th>
          </tr>
        </thead>
        <tbody>
          {leaderboard.map((entry, idx) => (
            <tr
              key={entry.player_id}
              className={`border-t ${entry.player_id === currentPlayerId ? 'bg-blue-50' : ''}`}
            >
              <td className="py-2 pr-2 font-semibold">{idx + 1}</td>
              <td className="py-2 pr-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={entry.avatar_url || undefined} />
                    <AvatarFallback>{(entry.display_name || 'U')[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="truncate max-w-[120px]" title={entry.display_name}>{entry.display_name}</span>
                </div>
              </td>
              <td className="py-2 pr-2 font-semibold">{entry.score}</td>
              <td className="py-2 pr-2">{entry.accuracy}%</td>
              <td className="py-2 pr-2">{entry.questions_attempted}/{entry.questions_correct}</td>
              <td className="py-2 pr-2">{entry.total_time_spent}s</td>
            </tr>
          ))}
          {leaderboard.length === 0 && (
            <tr>
              <td colSpan={6} className="py-3 text-center text-gray-400">No players yet</td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
};

export default IndividualLeaderboard;
