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
  Maximize2,
  Minimize2,
  RefreshCw,
  LogOut,
  Medal,
  Play,
  Share2
} from 'lucide-react';
import { LiveQuizSession, LiveQuizPlayer } from '@/services/liveQuizService';
import { motion, AnimatePresence } from 'framer-motion';
import ReactConfetti from 'react-confetti';

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
  const [isFullScreen, setIsFullScreen] = React.useState(true);
  const [recycleConfetti, setRecycleConfetti] = React.useState(true);
  const [windowSize, setWindowSize] = React.useState({ width: window.innerWidth, height: window.innerHeight });

  React.useEffect(() => {
      const handleResize = () => {
          setWindowSize({ width: window.innerWidth, height: window.innerHeight });
      };
      window.addEventListener('resize', handleResize);

      // Stop recycling after 6 seconds
      const timer = setTimeout(() => {
          setRecycleConfetti(false);
      }, 6000);

      return () => {
          window.removeEventListener('resize', handleResize);
          clearTimeout(timer);
      };
  }, []);

  if (!session) return null;

  const playingPlayers = players.filter(p => p.is_playing);
  const sortedPlayers = [...playingPlayers].sort((a, b) => b.score - a.score);
  const winner = sortedPlayers[0];
  const playerRank = sortedPlayers.findIndex(p => p.user_id === userId) + 1;
  const currentPlayer = players.find(p => p.user_id === userId);
  const noResults = sortedPlayers.length === 0;

  // Podium: 1st, 2nd, 3rd
  const podium = [sortedPlayers[1], sortedPlayers[0], sortedPlayers[2]]; // visual order: 2nd | 1st | 3rd
  
  // Immersive Fullscreen View
  if (isFullScreen) {
      return (
        <div className="fixed inset-0 z-50 bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-white overflow-hidden flex flex-col">
            {/* Background */}
            <div className="absolute inset-0 z-0 opacity-40">
                <div 
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: "url('/herobackgroundimg.png')" }}
                />
                <div className="absolute inset-0 bg-white/30 dark:bg-slate-950/80 backdrop-blur-sm" />
            </div>

            {/* Top Bar */}
            <div className="relative z-10 flex items-center justify-between px-6 py-4 bg-white/80 dark:bg-black/20 backdrop-blur-md border-b border-gray-200 dark:border-white/10 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-yellow-500/20 rounded-lg">
                        <Trophy className="h-6 w-6 text-yellow-600 dark:text-yellow-500" />
                    </div>
                    <div>
                        <h1 className="font-bold text-xl leading-none text-gray-900 dark:text-white">Session Complete</h1>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Quiz Results</p>
                    </div>
                </div>
                <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setIsFullScreen(false)}
                    className="text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10"
                >
                    <Minimize2 className="h-4 w-4 mr-2" />
                    Exit
                </Button>
            </div>

            {/* Main Content Area */}
            <div className="relative z-10 flex-col lg:flex-row flex items-center justify-center gap-8 lg:gap-16 p-8 pt-20 flex-1 overflow-y-auto">
                {/* Winner / Podium Section */}
                <motion.div 
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="flex flex-col items-center flex-1 max-w-2xl"
                >
                    <h2 className="text-4xl lg:text-5xl font-black text-center mb-12 text-transparent bg-clip-text bg-gradient-to-br from-yellow-600 via-amber-500 to-yellow-600 dark:from-yellow-300 dark:via-amber-200 dark:to-yellow-500 drop-shadow-xl uppercase tracking-wider">
                        {noResults ? "No Players" : "Leaderboard"}
                    </h2>

                    {sortedPlayers.length >= 1 && (
                        <div className="flex items-end justify-center gap-4 lg:gap-8 w-full mb-12 h-[400px]">
                            {/* 2nd Place */}
                            {podium[0] && (
                                <motion.div 
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    transition={{ delay: 0.5, duration: 0.8 }}
                                    className="flex flex-col items-center w-1/3 max-w-[180px]"
                                >
                                    <Avatar className="h-16 w-16 lg:h-20 lg:w-20 mb-4 border-4 border-gray-400 shadow-lg ring-4 ring-black/50">
                                        <AvatarImage src={podium[0].avatar_url || undefined} />
                                        <AvatarFallback className="text-xl bg-gray-800 text-gray-200">
                                            {(podium[0].display_name || 'U')[0]?.toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="text-center mb-2">
                                        <div className="font-bold text-lg lg:text-xl truncate w-full px-2 text-gray-900 dark:text-white">{podium[0].display_name}</div>
                                        <div className="text-gray-600 dark:text-gray-400 font-mono">{podium[0].score} pts</div>
                                    </div>
                                    <div className="w-full h-48 lg:h-64 bg-gradient-to-t from-gray-900 via-gray-700 to-gray-500 rounded-t-xl border-x border-t border-white/20 flex flex-col items-center justify-start py-4 shadow-[0_0_30px_rgba(255,255,255,0.1)]">
                                        <span className="text-4xl lg:text-5xl drop-shadow-lg">🥈</span>
                                    </div>
                                </motion.div>
                            )}

                            {/* 1st Place */}
                            {podium[1] && (
                                <motion.div 
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    transition={{ delay: 0.8, duration: 0.8 }}
                                    className="flex flex-col items-center w-1/3 max-w-[200px] z-20 relative"
                                >
                                    <div className="absolute -top-24 animate-bounce">
                                        <Crown className="h-12 w-12 text-yellow-400 fill-yellow-400 drop-shadow-[0_0_15px_rgba(234,179,8,0.8)]" />
                                    </div>
                                    <Avatar className="h-24 w-24 lg:h-32 lg:w-32 mb-4 border-4 border-yellow-400 shadow-[0_0_30px_rgba(234,179,8,0.4)] ring-4 ring-black/50">
                                        <AvatarImage src={podium[1].avatar_url || undefined} />
                                        <AvatarFallback className="text-2xl bg-yellow-900 text-yellow-100">
                                            {(podium[1].display_name || 'U')[0]?.toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="text-center mb-2 scale-110">
                                        <div className="font-bold text-xl lg:text-2xl truncate w-full px-2 text-yellow-700 dark:text-yellow-200">{podium[1].display_name}</div>
                                        <div className="text-yellow-600 dark:text-yellow-400/80 font-mono font-bold text-lg">{podium[1].score} pts</div>
                                    </div>
                                    <div className="w-full h-64 lg:h-80 bg-gradient-to-t from-orange-900 via-amber-600 to-yellow-500 rounded-t-xl border-x border-t border-white/30 flex flex-col items-center justify-start py-6 shadow-[0_0_50px_rgba(234,179,8,0.3)]">
                                        <span className="text-5xl lg:text-7xl drop-shadow-lg">🥇</span>
                                    </div>
                                </motion.div>
                            )}

                            {/* 3rd Place */}
                            {podium[2] && (
                                <motion.div 
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    transition={{ delay: 0.6, duration: 0.8 }}
                                    className="flex flex-col items-center w-1/3 max-w-[180px]"
                                >
                                    <Avatar className="h-16 w-16 lg:h-20 lg:w-20 mb-4 border-4 border-orange-700 shadow-lg ring-4 ring-black/50">
                                        <AvatarImage src={podium[2].avatar_url || undefined} />
                                        <AvatarFallback className="text-xl bg-orange-950 text-orange-200">
                                            {(podium[2].display_name || 'U')[0]?.toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="text-center mb-2">
                                        <div className="font-bold text-lg lg:text-xl truncate w-full px-2 text-gray-900 dark:text-white">{podium[2].display_name}</div>
                                        <div className="text-gray-600 dark:text-gray-400 font-mono">{podium[2].score} pts</div>
                                    </div>
                                    <div className="w-full h-40 lg:h-56 bg-gradient-to-t from-orange-950 via-orange-800 to-orange-600 rounded-t-xl border-x border-t border-white/20 flex flex-col items-center justify-start py-4 shadow-[0_0_30px_rgba(255,255,255,0.1)]">
                                        <span className="text-4xl lg:text-5xl drop-shadow-lg">🥉</span>
                                    </div>
                                </motion.div>
                            )}
                        </div>
                    )}
                </motion.div>

                {/* Right Side: Stats Panel & Actions */}
                <motion.div 
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 1 }}
                    className="w-full max-w-sm flex flex-col gap-6"
                >
                    {/* Your Result Card */}
                    {currentPlayer && currentPlayer.is_playing ? (
                        <div className="bg-white/60 dark:bg-white/10 backdrop-blur-md rounded-2xl border border-gray-200 dark:border-white/10 p-6 shadow-2xl">
                             <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
                                <Zap className="h-5 w-5 text-blue-600 dark:text-blue-400" /> Your Performance
                             </h3>
                             <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-white/50 dark:bg-black/20 rounded-xl flex flex-col items-center shadow-sm dark:shadow-none">
                                    <span className="text-3xl font-bold mb-1 text-gray-900 dark:text-white">{playerRank}</span>
                                    <span className="text-xs text-gray-500 dark:text-white/50 uppercase tracking-wider">Rank</span>
                                </div>
                                <div className="p-4 bg-white/50 dark:bg-black/20 rounded-xl flex flex-col items-center shadow-sm dark:shadow-none">
                                    <span className="text-3xl font-bold mb-1 text-yellow-600 dark:text-yellow-400">{currentPlayer.score}</span>
                                    <span className="text-xs text-gray-500 dark:text-white/50 uppercase tracking-wider">Points</span>
                                </div>
                             </div>
                             <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-700 dark:text-green-300 text-center text-sm font-semibold">
                                 {playerRank === 1 ? "Incredible! You're the champion!" : "Great job! Keep learning!"}
                             </div>
                        </div>
                    ) : (
                         <div className="bg-white/60 dark:bg-white/10 backdrop-blur-md rounded-2xl border border-gray-200 dark:border-white/10 p-6 shadow-2xl text-center">
                             <h3 className="text-lg font-bold mb-2 text-gray-900 dark:text-white">Host View</h3>
                             <p className="text-gray-500 dark:text-white/60 text-sm">You successfully moderated this session.</p>
                         </div>
                    )}

                    <div className="flex flex-col gap-3">
                        <Button 
                            size="lg" 
                            onClick={resetView}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white dark:bg-white dark:text-black dark:hover:bg-gray-200 font-bold py-6 text-lg"
                        >
                            <Play className="h-5 w-5 mr-2" /> Play Again
                        </Button>
                        <Button 
                            variant="outline" 
                            size="lg"
                            className="w-full border-gray-300 dark:border-white/20 text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-white/10 py-6"
                        >
                            <Share2 className="h-5 w-5 mr-2" /> Share Results
                        </Button>
                        <Button
                            variant="ghost"
                            onClick={() => setIsFullScreen(false)}
                            className="w-full text-gray-500 dark:text-white/50 hover:text-gray-900 dark:hover:text-white"
                        >
                            View Detailed Report
                        </Button>
                    </div>
                </motion.div>
            </div>

            {/* Confetti Overlay */}
            <div className="absolute inset-0 z-[100] pointer-events-none">
                <ReactConfetti
                    width={windowSize.width}
                    height={windowSize.height}
                    recycle={recycleConfetti}
                    numberOfPieces={500}
                    gravity={0.15}
                />
            </div>
        </div>
      );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5 relative">
        <div className="flex justify-end mb-4">
            <Button variant="outline" onClick={() => setIsFullScreen(true)}>
                <Maximize2 className="h-4 w-4 mr-2" />
                Fullscreen
            </Button>
        </div>

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