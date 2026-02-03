// src/components/quizzes/components/LiveQuizResults.tsx
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';
import {
  Trophy,
  Crown,
  Zap,
  ArrowRight,
  Target,
  Clock,
} from 'lucide-react';
import { LiveQuizSession, LiveQuizPlayer } from '@/services/liveQuizService';

interface LiveQuizResultsProps {
  session: LiveQuizSession | null;
  players: LiveQuizPlayer[];
  userId: string;
  resetView: () => void;
  toast: any;
  quiz?: any;
  userAnswers?: any[];
}

const LiveQuizResults: React.FC<LiveQuizResultsProps> = ({
  session,
  players,
  userId,
  resetView,
  toast,
  quiz,
  userAnswers = [],
}) => {
  if (!session) return null;

  const playingPlayers = players.filter(p => p.is_playing);
  const sortedPlayers = [...playingPlayers].sort((a, b) => b.score - a.score);
  const winner = sortedPlayers[0];
  const playerRank = sortedPlayers.findIndex(p => p.user_id === userId) + 1;
  const currentPlayer = players.find(p => p.user_id === userId);
  const noResults = sortedPlayers.length === 0;

  // Podium: 1st, 2nd, 3rd
  const podium = [sortedPlayers[1], sortedPlayers[0], sortedPlayers[2]]; // visual order: 2nd | 1st | 3rd

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <Card className="rounded-2xl border-2 shadow-lg overflow-hidden">
        {/* Gradient header strip */}
        <div className="h-2 bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400" />

        <CardHeader className="text-center pt-6 pb-4">
          <Trophy className="h-12 w-12 mx-auto text-yellow-500 mb-2" />
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent">
            Quiz Complete!
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6 px-5 pb-6">
          {/* ─── Podium ─── */}
          {sortedPlayers.length >= 1 && (
            <div className="flex items-end justify-center gap-3 px-4 pt-2">
              {podium.map((player, visualIdx) => {
                if (!player) {
                  // empty slot
                  return <div key={`empty-${visualIdx}`} className="flex-1 max-w-[120px]" />;
                }
                const rank = visualIdx === 0 ? 2 : visualIdx === 1 ? 1 : 3;
                const heights = { 1: 'h-36', 2: 'h-28', 3: 'h-24' };
                const colors = {
                  1: 'from-yellow-400 to-amber-500',
                  2: 'from-gray-400 to-gray-500',
                  3: 'from-orange-500 to-amber-600',
                };
                const medals = { 1: '🥇', 2: '🥈', 3: '🥉' };

                return (
                  <div key={player.id} className="flex-1 max-w-[120px] flex flex-col items-center">
                    {/* Name + score above the bar */}
                    <div className="flex items-center gap-2 mb-1 w-full justify-center">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={player.avatar_url || undefined} />
                        <AvatarFallback>{(player.display_name || 'U')[0]?.toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 truncate max-w-[80px]">
                        {player.display_name}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">
                      {player.score} <span className="text-xs font-normal text-gray-400">pts</span>
                    </span>
                    {/* Bar */}
                    <div className={`w-full rounded-t-lg bg-gradient-to-t ${colors[rank]} ${heights[rank]} flex flex-col items-center justify-end pb-2`}>
                      <span className="text-lg">{medals[rank]}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ─── Your Performance (if you played) ─── */}
          {currentPlayer && currentPlayer.is_playing && (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-4">
              <h4 className="font-semibold text-sm text-center text-gray-600 dark:text-gray-400 mb-3">Your Performance</h4>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <Trophy className="h-6 w-6 mx-auto text-blue-500 mb-1" />
                  <div className="text-2xl font-bold">#{playerRank}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Rank</div>
                </div>
                <div className="text-center">
                  <Zap className="h-6 w-6 mx-auto text-yellow-500 mb-1" />
                  <div className="text-2xl font-bold">{currentPlayer.score}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Points</div>
                </div>
                <div className="text-center">
                  <Target className="h-6 w-6 mx-auto text-green-500 mb-1" />
                  <div className="text-2xl font-bold">
                    {sortedPlayers.length > 1
                      ? `Top ${Math.round((playerRank / sortedPlayers.length) * 100)}%`
                      : '1st'}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Percentile</div>
                </div>
              </div>
            </div>
          )}

          {/* Mediator view */}
          {currentPlayer && !currentPlayer.is_playing && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-4 text-center">
              <h4 className="font-semibold text-sm mb-1">Mediator View</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">You moderated this quiz session.</p>
            </div>
          )}

          {/* ─── Quiz Questions Review ─── */}
          {quiz && quiz.questions && quiz.questions.length > 0 && (
            <div className="mb-6">
              <h4 className="font-semibold text-sm flex items-center gap-2 mb-3">
                <Target className="h-4 w-4 text-blue-500" />
                Quiz Questions ({quiz.questions.length})
              </h4>
              <div className="space-y-3">
                {quiz.questions.map((question: any, index: number) => {
                  // Find user's answer for this question
                  const userAnswer = userAnswers.find(a => a.question_id === question.id);
                  const userSelectedIndex = userAnswer?.answer_index;
                  
                  return (
                    <Card key={question.id || index} className="bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                      <CardContent className="p-4">
                        <div className="flex gap-3">
                          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">
                            {index + 1}
                          </div>
                          <div className="flex-1 space-y-2">
                            <p className="font-medium text-sm">{question.question_text}</p>
                            <div className="space-y-1.5">
                              {question.options?.map((option: string, optIdx: number) => {
                                const isCorrect = optIdx === question.correct_answer;
                                const isUserAnswer = optIdx === userSelectedIndex;
                                const isWrongAnswer = isUserAnswer && !isCorrect;
                                
                                return (
                                  <div
                                    key={optIdx}
                                    className={`text-xs px-3 py-2 rounded-lg relative ${
                                      isCorrect
                                        ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border border-green-300 dark:border-green-700 font-medium'
                                        : isWrongAnswer
                                        ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border border-red-300 dark:border-red-700'
                                        : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <span>
                                        {String.fromCharCode(65 + optIdx)}. {option}
                                      </span>
                                      <div className="flex items-center gap-1">
                                        {isCorrect && (
                                          <span className="text-green-600 dark:text-green-400 font-bold">✓</span>
                                        )}
                                        {isWrongAnswer && (
                                          <span className="text-red-600 dark:text-red-400 font-bold">✗</span>
                                        )}
                                        {isUserAnswer && (
                                          <span className="text-xs font-semibold ml-1">(Your answer)</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* ─── Final Rankings Table ─── */}
          <div>
            <h4 className="font-semibold text-sm flex items-center gap-2 mb-3">
              <Trophy className="h-4 w-4 text-yellow-500" />
              Final Rankings
            </h4>

            {noResults ? (
              <p className="text-center text-gray-400 text-sm py-6">No participants or results for this quiz.</p>
            ) : (
              <div className="space-y-1.5">
                {sortedPlayers.map((player, index) => {
                  const isYou = player.user_id === userId;
                  return (
                    <div
                      key={player.id}
                      className={[
                        'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all',
                        isYou
                          ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-400 scale-[1.02]'
                          : 'bg-gray-50 dark:bg-gray-800 border border-transparent',
                      ].join(' ')}
                    >
                      {/* Rank circle */}
                      <span className={[
                        'text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full flex-shrink-0',
                        index === 0 ? 'bg-yellow-500 text-white' :
                        index === 1 ? 'bg-gray-400 text-white' :
                        index === 2 ? 'bg-orange-500 text-white' :
                        'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
                      ].join(' ')}>
                        {index + 1}
                      </span>

                      {/* Name */}
                      <span className="flex-1 font-medium text-sm flex items-center gap-2 min-w-0">
                        {index === 0 && <Crown className="h-3.5 w-3.5 text-yellow-500" />}
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={player.avatar_url || undefined} />
                          <AvatarFallback>{(player.display_name || 'U')[0]?.toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <span className="truncate">
                          {player.display_name}
                        </span>
                        {isYou && <span className="text-xs text-blue-500 font-semibold">(You)</span>}
                        {player.is_host && !player.is_playing && (
                          <span className="text-xs text-gray-400">(Mediator)</span>
                        )}
                      </span>

                      {/* Score */}
                      <div className="flex items-center gap-1">
                        <Zap className="h-4 w-4 text-yellow-500" />
                        <span className="font-bold">{player.score}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ─── Back Button ─── */}
          <Button
            onClick={resetView}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 rounded-xl"
          >
            <ArrowRight className="h-4 w-4 mr-2" />
            Return to Menu
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default LiveQuizResults;