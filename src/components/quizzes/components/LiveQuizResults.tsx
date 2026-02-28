// src/components/quizzes/components/LiveQuizResults.tsx
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';
import {
  Trophy, Crown, Zap, ArrowRight, Target, Clock,
  Maximize2, Minimize2, RefreshCw, LogOut, Medal, Play, Share2
} from 'lucide-react';
import { LiveQuizSession, LiveQuizPlayer } from '@/services/liveQuizService';
import { ShareDialog } from '../../ui/ShareDialog';
import { useSocialActions } from '../../social/hooks/useSocialActions';
import { Privacy } from '../../social/types/social';
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
  onShareToFeedDraft?: (data: { session: any; quiz: any; userAnswers: any; players: any }) => void;
}

const COSMIC_BG: React.CSSProperties = {
  background: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)',
};
const GLASS: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  backdropFilter: 'blur(12px)',
};

const LiveQuizResults: React.FC<LiveQuizResultsProps> = ({
  session, players, userId, resetView, toast, quiz, userAnswers = [], onShareToFeedDraft,
}) => {
  const [isFullScreen, setIsFullScreen] = React.useState(true);
  const [recycleConfetti, setRecycleConfetti] = React.useState(true);
  const [windowSize, setWindowSize] = React.useState({ width: window.innerWidth, height: window.innerHeight });
  const [showShareModal, setShowShareModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [posts, setPosts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [suggestedUsers, setSuggestedUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [trendingPosts, setTrendingPosts] = useState([]);
  const [userPosts, setUserPosts] = useState([]);
  const socialActions = useSocialActions(
    currentUser,
    posts,
    setPosts,
    setSuggestedUsers,
    groups,
    setGroups,
    setTrendingPosts,
    setUserPosts,
    setCurrentUser
  );

  const handleShareToFeedDraft = ({ content, coverUrl }: { content: string; coverUrl?: string }) => {
    if (onShareToFeedDraft) {
      onShareToFeedDraft({ session, quiz, userAnswers, players });
      setShowShareModal(false);
      return;
    }
    const payload = {
      content, coverUrl,
      metadata: {
        type: 'quiz', quizId: session?.id, title: quiz?.title,
        description: quiz?.description || '', coverUrl,
        leaderboard: sortedPlayers.map((p, i) => ({ rank: i + 1, name: p.display_name, score: p.score })),
      }
    };
    const w = window as any;
    if (typeof w.onNavigateToTab === 'function') {
      w.onNavigateToTab('social');
      let attempts = 0;
      const checkRef = () => {
        if (w.socialFeedRef?.current) { w.socialFeedRef.current.openCreatePostDialog(payload); }
        else if (attempts < 20) { attempts++; setTimeout(checkRef, 100); }
      };
      setTimeout(checkRef, 100);
    } else if (w.socialFeedRef?.current) {
      w.socialFeedRef.current.openCreatePostDialog(payload);
    } else {
      window.location.href = '/social';
    }
    setShowShareModal(false);
  };

  React.useEffect(() => {
    const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    const applause = new Audio('https://kegsrvnywshxyucgjxml.supabase.co/storage/v1/object/public/documents/mixkit-end-of-show-clapping-crowd-477.wav');
    applause.volume = 0.7;
    applause.play().catch(() => {});
    const timer = setTimeout(() => setRecycleConfetti(false), 6000);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
      applause.pause();
    };
  }, []);

  if (!session) return null;

  const playingPlayers = players.filter(p => p.is_playing);
  const sortedPlayers = [...playingPlayers].sort((a, b) => b.score - a.score);
  const winner = sortedPlayers[0];
  const playerRank = sortedPlayers.findIndex(p => p.user_id === userId) + 1;
  const currentPlayer = players.find(p => p.user_id === userId);
  const noResults = sortedPlayers.length === 0;
  const podium = [sortedPlayers[1], sortedPlayers[0], sortedPlayers[2]];

  // ─── Fullscreen View ───
  if (isFullScreen) {
    return (
      <div className="fixed inset-0 z-50 overflow-hidden flex flex-col" style={COSMIC_BG}>
        {/* Ambient blobs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full blur-3xl" style={{ background: 'rgba(250,204,21,0.06)' }} />
          <div className="absolute -bottom-40 -right-40 w-80 h-80 rounded-full blur-3xl" style={{ background: 'rgba(99,102,241,0.12)' }} />
        </div>

        {/* Top bar */}
        <div
          className="relative z-10 flex items-center justify-between px-4 sm:px-6 py-3 shrink-0"
          style={{ background: 'rgba(0,0,0,0.35)', borderBottom: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(16px)' }}
        >
          <Button
            variant="ghost" size="sm"
            onClick={() => {
              try { document.querySelectorAll('audio').forEach(a => { a.pause(); a.currentTime = 0; }); } catch(e) {}
              setIsFullScreen(false);
            }}
            className="text-white/60 hover:text-white hover:bg-white/10 gap-1.5"
          >
            <Minimize2 className="h-4 w-4" />
            <span className="hidden sm:inline text-xs">Exit</span>
          </Button>

          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg" style={{ background: 'rgba(250,204,21,0.2)', border: '1px solid rgba(250,204,21,0.3)' }}>
              <Trophy className="h-4 w-4 text-yellow-400" />
            </div>
            <div>
              <h1 className="font-bold text-sm text-white leading-none">Session Complete</h1>
              <p className="text-xs text-white/40 mt-0.5">Final Results</p>
            </div>
          </div>

          <Button
            variant="ghost" size="sm"
            onClick={resetView}
            className="text-white/60 hover:text-white hover:bg-white/10 gap-1.5"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline text-xs">Menu</span>
          </Button>
        </div>

        {/* Main Content */}
        <div className="relative z-10 flex-1 flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-16 p-4 sm:p-6 overflow-y-auto">

          {/* Podium Section */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col items-center flex-shrink-0 w-full lg:w-auto"
          >
            <h2
              className="text-3xl sm:text-4xl font-black text-center mb-8 uppercase tracking-wider"
              style={{ background: 'linear-gradient(135deg,#fbbf24,#f59e0b,#fbbf24)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
            >
              {noResults ? 'No Players' : '🏆 Leaderboard'}
            </h2>

            {sortedPlayers.length >= 1 && (
              <div className="flex items-end justify-center gap-3 sm:gap-6 w-full max-w-md">
                {/* 2nd Place */}
                {podium[0] && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    transition={{ delay: 0.5, duration: 0.7 }}
                    className="flex flex-col items-center w-1/3 max-w-[140px]"
                  >
                    <div
                      className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border-4 mb-3 flex items-center justify-center text-xl font-black text-white"
                      style={{ borderColor: '#9ca3af', background: 'rgba(156,163,175,0.2)' }}
                    >
                      {(podium[0].display_name || 'U')[0]?.toUpperCase()}
                    </div>
                    <p className="text-white/80 text-xs font-bold text-center truncate w-full px-1">{podium[0].display_name}</p>
                    <p className="text-gray-400 text-xs font-mono mb-2">{podium[0].score} pts</p>
                    <div
                      className="w-full h-24 sm:h-32 rounded-t-xl flex flex-col items-center justify-start py-3"
                      style={{ background: 'linear-gradient(to top, rgba(75,85,99,0.8), rgba(107,114,128,0.6))', boxShadow: '0 0 20px rgba(156,163,175,0.15)', border: '1px solid rgba(255,255,255,0.08)' }}
                    >
                      <span className="text-3xl">🥈</span>
                    </div>
                  </motion.div>
                )}

                {/* 1st Place */}
                {podium[1] && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    transition={{ delay: 0.8, duration: 0.7 }}
                    className="flex flex-col items-center w-1/3 max-w-[170px] z-10 relative"
                  >
                    <div className="absolute -top-8 animate-bounce">
                      <Crown className="h-10 w-10 text-yellow-400 fill-yellow-400" style={{ filter: 'drop-shadow(0 0 12px rgba(250,204,21,0.8))' }} />
                    </div>
                    <div
                      className="w-18 h-18 sm:w-20 sm:h-20 rounded-full border-4 mb-3 flex items-center justify-center text-2xl font-black text-white mt-8"
                      style={{ borderColor: '#fbbf24', background: 'rgba(251,191,36,0.2)', boxShadow: '0 0 24px rgba(251,191,36,0.3)', width: 72, height: 72 }}
                    >
                      {(podium[1].display_name || 'U')[0]?.toUpperCase()}
                    </div>
                    <p className="text-yellow-300 text-sm font-black text-center truncate w-full px-1">{podium[1].display_name}</p>
                    <p className="text-yellow-400 text-sm font-mono font-bold mb-2">{podium[1].score} pts</p>
                    <div
                      className="w-full h-36 sm:h-44 rounded-t-xl flex flex-col items-center justify-start py-4"
                      style={{ background: 'linear-gradient(to top, rgba(120,53,15,0.8), rgba(217,119,6,0.6), rgba(251,191,36,0.4))', boxShadow: '0 0 40px rgba(251,191,36,0.2)', border: '1px solid rgba(251,191,36,0.2)' }}
                    >
                      <span className="text-4xl sm:text-5xl">🥇</span>
                    </div>
                  </motion.div>
                )}

                {/* 3rd Place */}
                {podium[2] && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    transition={{ delay: 0.6, duration: 0.7 }}
                    className="flex flex-col items-center w-1/3 max-w-[120px]"
                  >
                    <div
                      className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-4 mb-3 flex items-center justify-center text-lg font-black text-white"
                      style={{ borderColor: '#c2410c', background: 'rgba(194,65,12,0.2)' }}
                    >
                      {(podium[2].display_name || 'U')[0]?.toUpperCase()}
                    </div>
                    <p className="text-white/70 text-xs font-bold text-center truncate w-full px-1">{podium[2].display_name}</p>
                    <p className="text-orange-400 text-xs font-mono mb-2">{podium[2].score} pts</p>
                    <div
                      className="w-full h-20 sm:h-24 rounded-t-xl flex flex-col items-center justify-start py-3"
                      style={{ background: 'linear-gradient(to top, rgba(124,45,18,0.8), rgba(194,65,12,0.5))', boxShadow: '0 0 20px rgba(194,65,12,0.15)', border: '1px solid rgba(255,255,255,0.06)' }}
                    >
                      <span className="text-2xl sm:text-3xl">🥉</span>
                    </div>
                  </motion.div>
                )}
              </div>
            )}
          </motion.div>

          {/* Right panel: Your stats + actions */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1 }}
            className="w-full max-w-sm flex flex-col gap-4 flex-shrink-0"
          >
            {/* Your Performance */}
            {currentPlayer && currentPlayer.is_playing && (
              <div className="rounded-2xl p-5" style={GLASS}>
                <h3 className="text-white font-bold text-sm mb-4 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-yellow-400" /> Your Performance
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { icon: <Trophy className="h-5 w-5 text-yellow-400" />, value: `#${playerRank}`, label: 'Rank' },
                    { icon: <Zap className="h-5 w-5 text-yellow-400" />, value: currentPlayer.score, label: 'Points' },
                    {
                      icon: <Target className="h-5 w-5 text-emerald-400" />,
                      value: sortedPlayers.length > 1 ? `Top ${Math.round((playerRank / sortedPlayers.length) * 100)}%` : '1st',
                      label: 'Percentile'
                    },
                  ].map(({ icon, value, label }) => (
                    <div key={label} className="text-center p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)' }}>
                      <div className="flex justify-center mb-1">{icon}</div>
                      <div className="text-white font-black text-lg">{value}</div>
                      <div className="text-white/40 text-xs">{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-col gap-3">
              <button
                onClick={resetView}
                className="w-full py-4 rounded-2xl font-black text-white text-base relative overflow-hidden group"
                style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', boxShadow: '0 0 30px rgba(99,102,241,0.3)' }}
              >
                <span className="flex items-center justify-center gap-2"><Play className="h-5 w-5" /> Play Again</span>
                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
              <button
                onClick={() => { if (isFullScreen) setIsFullScreen(false); setTimeout(() => setShowShareModal(true), 200); }}
                className="w-full py-3.5 rounded-2xl font-bold text-white/80 text-sm hover:text-white transition-all"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
              >
                <span className="flex items-center justify-center gap-2"><Share2 className="h-4 w-4" /> Share Results</span>
              </button>
              <button
                onClick={() => setIsFullScreen(false)}
                className="w-full py-3 rounded-2xl font-medium text-white/40 text-sm hover:text-white/60 transition-all"
              >
                View Detailed Report
              </button>
            </div>
          </motion.div>
        </div>

        {/* Confetti */}
        <div className="absolute inset-0 z-[100] pointer-events-none">
          <ReactConfetti
            width={windowSize.width}
            height={windowSize.height}
            recycle={recycleConfetti}
            numberOfPieces={400}
            gravity={0.15}
          />
        </div>
      </div>
    );
  }

  // ─── Compact (non-fullscreen) View ───
  return (
    <div className="max-w-3xl mx-auto space-y-5 relative">
      {showShareModal && (
        <ShareDialog
          open={showShareModal}
          onClose={() => setShowShareModal(false)}
          shareUrl={`${window.location.origin}/quizzes/results/${session?.id}`}
          title={quiz?.title || 'Quiz Results'}
          description={`🎉 Quiz Results!\n\n${sortedPlayers.map((p, i) => `${i + 1}. ${p.display_name} - ${p.score} pts`).join('\n')}`}
          coverImageUrl={quiz?.cover_image_url || undefined}
          user={{ full_name: currentPlayer?.display_name || '', avatar_url: currentPlayer?.avatar_url }}
          onShareToFeedDraft={handleShareToFeedDraft}
        />
      )}

      <div className="flex justify-end mb-4">
        <Button variant="outline" onClick={() => setIsFullScreen(true)}>
          <Maximize2 className="h-4 w-4 mr-2" /> Fullscreen
        </Button>
      </div>

      <Card className="rounded-2xl border-2 shadow-lg overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400" />
        <CardHeader className="text-center pt-6 pb-4">
          <Trophy className="h-12 w-12 mx-auto text-yellow-500 mb-2" />
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent">
            Quiz Complete!
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6 px-5 pb-6">
          {sortedPlayers.length >= 1 && (
            <div className="flex items-end justify-center gap-3 px-4 pt-2">
              {podium.map((player, visualIdx) => {
                if (!player) return <div key={`empty-${visualIdx}`} className="flex-1 max-w-[120px]" />;
                const rank = visualIdx === 0 ? 2 : visualIdx === 1 ? 1 : 3;
                const heights = { 1: 'h-36', 2: 'h-28', 3: 'h-24' };
                const colors = { 1: 'from-yellow-400 to-amber-500', 2: 'from-gray-400 to-gray-500', 3: 'from-orange-500 to-amber-600' };
                const medals = { 1: '🥇', 2: '🥈', 3: '🥉' };
                return (
                  <div key={player.id} className="flex-1 max-w-[120px] flex flex-col items-center">
                    <div className="flex items-center gap-2 mb-1 w-full justify-center">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={player.avatar_url || undefined} />
                        <AvatarFallback>{(player.display_name || 'U')[0]?.toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 truncate max-w-[80px]">{player.display_name}</span>
                    </div>
                    <span className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">{player.score} <span className="text-xs font-normal text-gray-400">pts</span></span>
                    <div className={`w-full rounded-t-lg bg-gradient-to-t ${colors[rank]} ${heights[rank]} flex items-center justify-center`}>
                      <span className="text-lg">{medals[rank]}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {currentPlayer && currentPlayer.is_playing && (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-4">
              <h4 className="font-semibold text-sm text-center text-gray-600 dark:text-gray-400 mb-3">Your Performance</h4>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div><Trophy className="h-6 w-6 mx-auto text-blue-500 mb-1" /><div className="text-2xl font-bold">#{playerRank}</div><div className="text-xs text-gray-500">Rank</div></div>
                <div><Zap className="h-6 w-6 mx-auto text-yellow-500 mb-1" /><div className="text-2xl font-bold">{currentPlayer.score}</div><div className="text-xs text-gray-500">Points</div></div>
                <div><Target className="h-6 w-6 mx-auto text-green-500 mb-1" /><div className="text-2xl font-bold">{sortedPlayers.length > 1 ? `Top ${Math.round((playerRank / sortedPlayers.length) * 100)}%` : '1st'}</div><div className="text-xs text-gray-500">Percentile</div></div>
              </div>
            </div>
          )}

          {quiz && quiz.questions && quiz.questions.length > 0 && (
            <div className="mb-6">
              <h4 className="font-semibold text-sm flex items-center gap-2 mb-3">
                <Target className="h-4 w-4 text-blue-500" /> Quiz Questions ({quiz.questions.length})
              </h4>
              <div className="space-y-3">
                {quiz.questions.map((question: any, index: number) => {
                  const userAnswer = userAnswers.find(a => a.question_id === question.id);
                  const userSelectedIndex = userAnswer?.answer_index;
                  return (
                    <Card key={question.id || index} className="bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                      <CardContent className="p-4">
                        <div className="flex gap-3">
                          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">{index + 1}</div>
                          <div className="flex-1 space-y-2">
                            <p className="font-medium text-sm">{question.question_text}</p>
                            <div className="space-y-1.5">
                              {question.options?.map((option: string, optIdx: number) => {
                                const isCorrect = optIdx === question.correct_answer;
                                const isUserAnswer = optIdx === userSelectedIndex;
                                const isWrongAnswer = isUserAnswer && !isCorrect;
                                return (
                                  <div key={optIdx} className={`text-xs px-3 py-2 rounded-lg ${isCorrect ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border border-green-300' : isWrongAnswer ? 'bg-red-100 dark:bg-red-900/30 text-red-800 border border-red-300' : 'bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600'}`}>
                                    <div className="flex items-center justify-between">
                                      <span>{String.fromCharCode(65 + optIdx)}. {option}</span>
                                      <div className="flex items-center gap-1">
                                        {isCorrect && <span className="text-green-600 font-bold">✓</span>}
                                        {isWrongAnswer && <span className="text-red-600 font-bold">✗</span>}
                                        {isUserAnswer && <span className="text-xs font-semibold ml-1">(Your answer)</span>}
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

          <div>
            <h4 className="font-semibold text-sm flex items-center gap-2 mb-3">
              <Trophy className="h-4 w-4 text-yellow-500" /> Final Rankings
            </h4>
            {noResults ? (
              <p className="text-center text-gray-400 text-sm py-6">No participants or results.</p>
            ) : (
              <div className="space-y-1.5">
                {sortedPlayers.map((player, index) => {
                  const isYou = player.user_id === userId;
                  return (
                    <div key={player.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${isYou ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-400 scale-[1.02]' : 'bg-gray-50 dark:bg-gray-800 border border-transparent'}`}>
                      <span className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full flex-shrink-0 ${index === 0 ? 'bg-yellow-500 text-white' : index === 1 ? 'bg-gray-400 text-white' : index === 2 ? 'bg-orange-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>{index + 1}</span>
                      <span className="flex-1 font-medium text-sm flex items-center gap-2 min-w-0">
                        {index === 0 && <Crown className="h-3.5 w-3.5 text-yellow-500" />}
                        <Avatar className="h-6 w-6"><AvatarImage src={player.avatar_url || undefined} /><AvatarFallback>{(player.display_name || 'U')[0]?.toUpperCase()}</AvatarFallback></Avatar>
                        <span className="truncate">{player.display_name}</span>
                        {isYou && <span className="text-xs text-blue-500 font-semibold">(You)</span>}
                      </span>
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

          <Button onClick={resetView} className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 rounded-xl">
            <ArrowRight className="h-4 w-4 mr-2" /> Return to Menu
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default LiveQuizResults;