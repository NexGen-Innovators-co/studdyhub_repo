// src/components/quizzes/Quizzes.tsx - REDESIGNED
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ClassRecording, Quiz } from '../../types/Class';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { QuizHistory } from './components/QuizHistory';
import { QuizModal } from './components/QuizModal';
import { StatsPanel } from './components/StatsPanel';
import { BadgesPanel } from './components/BadgesPanel';
import { NotesQuizGenerator } from './components/NotesQuizGenerator';
import { AutoAIQuizGenerator } from './components/AutoAIQuizGenerator';
import { LiveQuiz } from './components/LiveQuiz';
import LiveQuizResults from './components/LiveQuizResults';
import LiveQuizLeaderboard from './components/LiveQuizLeaderboard';
import { useQuizManagement } from './hooks/useQuizManagement';
import { getPastSessions, getSessionResultsById } from '@/services/liveQuizService';
import { useQuizTracking } from './hooks/useQuizTracking';
import { useRealtimeSyncForQuizzes } from './hooks/useRealtimeSyncForQuizzes';
import { seedDefaultBadges, getAllBadges, getUserAchievements } from './utils/seedDefaultBadges';
import { Badge as BadgeType, Achievement } from '../../types/EnhancedClasses';
import { AppShell } from '../layout/AppShell';
import { StickyRail } from '../layout/StickyRail';
import { HeroHeader } from '../layout/HeroHeader';
import { QuickActionsCard } from '../layout/QuickActionsCard';
import { StatsCard } from '../layout/StatsCard';
import { useAppContext } from '../../hooks/useAppContext';
import {
  Sparkles,
  BookOpen,
  Target,
  Zap,
  Brain,
  FileText,
  Play,
  History,
  Trophy,
  BarChart3,
  RefreshCw,
  Users,
  Crown,
  X,
  Lightbulb,
} from 'lucide-react';
import { SubscriptionGuard } from '../subscription/SubscriptionGuard';
import { useDailyQuizTracker } from '../../hooks/useDailyQuizTracker';
import { supabase } from '../../integrations/supabase/client';
import { toast } from 'sonner';
import { useGlobalSearch } from '../../hooks/useGlobalSearch';
import { SEARCH_CONFIGS } from '../../services/globalSearchService';

interface QuizzesProps {
  quizzes: Quiz[];
  recordings: ClassRecording[];
  onGenerateQuiz: (recording: ClassRecording, quiz: Quiz) => void;
  userId: string;
}

export const Quizzes: React.FC<QuizzesProps> = ({ quizzes, recordings, onGenerateQuiz, userId }) => {
  const navigate = useNavigate();
  const params = useParams();
  const [selectedRecording, setSelectedRecording] = useState<string>('');
    // Get userName from context (userProfile or user)
    const { userProfile, user } = useAppContext();
    const userName = userProfile?.full_name || userProfile?.username || user?.email || 'Player';
  const [localQuizzes, setLocalQuizzes] = useState<Quiz[]>(quizzes);
  const [numQuestions, setNumQuestions] = useState<number>(5);
  const [difficulty, setDifficulty] = useState<string>('intermediate');
  const [allBadges, setAllBadges] = useState<BadgeType[]>([]);
  const [earnedAchievements, setEarnedAchievements] = useState<Achievement[]>([]);
  const [isLoadingBadges, setIsLoadingBadges] = useState(true);
  // Determine initial tab from URL param, fallback to overview
  const initialTab = params.tab || 'overview';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [livePastSessions, setLivePastSessions] = useState<any[]>([]);
  const [loadingLivePastSessions, setLoadingLivePastSessions] = useState(false);
  const [viewingLiveSessionId, setViewingLiveSessionId] = useState<string | null>(null);
  const [viewingSessionData, setViewingSessionData] = useState<{ session: any; players: any[]; quiz?: any; userAnswers?: any[] }>({ session: null, players: [] });
  const [loadingSessionResults, setLoadingSessionResults] = useState(false);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

    // Live quiz state - passed from LiveQuiz component
    const [liveQuizState, setLiveQuizState] = useState<{
      viewMode: string | null;
      session: any | null;
      players: any[];
      currentQuestion: any | null;
    }>({
      viewMode: null,
      session: null,
      players: [],
      currentQuestion: null,
    });

    // --- Live Quiz Routing: reflect sessionId in URL when active ---
    useEffect(() => {
      if (activeTab === 'live') {
        // If a live session is active, update URL to /quizzes/live/:sessionId
        if (liveQuizState.session && liveQuizState.session.id) {
          if (params.sessionId !== liveQuizState.session.id) {
            navigate(`/quizzes/live/${liveQuizState.session.id}`, { replace: true });
          }
        } else {
          // No session, ensure URL is just /quizzes/live
          if (params.sessionId) {
            navigate(`/quizzes/live`, { replace: true });
          }
        }
      }
    }, [activeTab, liveQuizState.session, params.sessionId, navigate]);
  // Initialize global search hook for quizzes
  const { search, results: searchResults, isSearching: isSearchingQuizzes } = useGlobalSearch(
    SEARCH_CONFIGS.quizzes,
    userId,
    { debounceMs: 500 }
  );

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (!value.trim()) {
      setHasSearched(false);
    } else {
      setHasSearched(true);
      search(value);
    }
  };

  useEffect(() => {
    setLocalQuizzes(quizzes);
  }, [quizzes]);

  const { userStats, isLoadingStats, bestAttempts, recordQuizAttempt, fetchUserStats } = useQuizTracking(userId);

  const {
    quizMode,
    currentQuestionIndex,
    userAnswers,
    showResults,
    handleGenerateQuizFromRecording,
    handleGenerateQuizFromNotes,
    handleGenerateAIQuiz,
    handleAnswerSelect,
    handleSelectQuizMode,
    handleNextQuestion,
    handlePreviousQuestion,
    handleExitQuizMode,
    calculateScore,
    setQuizMode,
  } = useQuizManagement({
    onGenerateQuiz,
    recordQuizAttempt,
    fetchUserStats,
  });

  useRealtimeSyncForQuizzes({
    userId,
    onQuizUpdate: (quiz) => {
      onGenerateQuiz(recordings.find(r => r.id === quiz.class_id)!, quiz);
    },
    onStatsUpdate: fetchUserStats,
  });
  const { dailyCounts } = useDailyQuizTracker();
  const { refreshData, dataLoading } = useAppContext();

  // Sync tab changes with global header

  // Sync tab state with URL
  useEffect(() => {
    if (params.tab !== activeTab) {
      navigate(`/quizzes/${activeTab}`, { replace: true });
    }
    window.dispatchEvent(new CustomEvent('section-tab-active', { detail: { section: 'quizzes', tab: activeTab } }));
  }, [activeTab]);

  // Update tab if URL param changes (browser nav)
  useEffect(() => {
    if (params.tab && params.tab !== activeTab) {
      setActiveTab(params.tab);
    }
  }, [params.tab]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.section === 'quizzes' && detail?.tab) {
        setActiveTab(detail.tab);
      }
    };
    window.addEventListener('section-tab-change', handler as EventListener);
    return () => window.removeEventListener('section-tab-change', handler as EventListener);
  }, []);

  useEffect(() => {
    const initBadges = async () => {
      setIsLoadingBadges(true);
      await seedDefaultBadges();
      const badges = await getAllBadges();
      const achievements = await getUserAchievements(userId);
      setAllBadges(badges);
      setEarnedAchievements(achievements);
      setIsLoadingBadges(false);
    };

    if (userId) {
      initBadges();
    }
  }, [userId]);

  const fetchLivePastSessions = async () => {
    setLoadingLivePastSessions(true);
    try {
      const sessions = await getPastSessions(userId);
      setLivePastSessions(sessions);
    } catch (err) {
      // console.error('Error fetching live quiz history:', err);
    } finally {
      setLoadingLivePastSessions(false);
    }
  };

  useEffect(() => {
    if ((activeTab === 'history' || activeTab === 'live') && userId) {
      fetchLivePastSessions();
    }
  }, [activeTab, userId]);

  const handleGenerateQuiz = () => {
    const recording = recordings.find(r => r.id === selectedRecording);
    if (recording) {
      handleGenerateQuizFromRecording(recording, numQuestions, difficulty);
    }
  };

  const handleSelectQuiz = (quiz: Quiz) => {
    // Validate that the quiz has questions before opening
    if (!quiz.questions || !Array.isArray(quiz.questions) || quiz.questions.length === 0) {
      // console.error('Quiz has no questions:', quiz);
      alert('This quiz has no questions available. Please generate a new quiz.');
      return;
    }
    
    const recording = recordings.find(r => r.id === quiz.class_id);
    handleSelectQuizMode(recording || null, quiz);
  };

  const handleDeleteQuiz = async (quizId: string) => {
    try {
      if (!userId) {
        toast.error('You must be logged in to delete a quiz');
        return;
      }

      const { data: sessions, error: sessionsError } = await supabase
        .from('live_quiz_sessions')
        .select('id')
        .eq('quiz_id', quizId);

      if (sessionsError) throw sessionsError;

      const sessionIds = (sessions || []).map(session => session.id).filter(Boolean);

      if (sessionIds.length > 0) {
        const { error: progressError } = await supabase
          .from('player_question_progress')
          .delete()
          .in('session_id', sessionIds);

        if (progressError) throw progressError;

        const { error: answersError } = await supabase
          .from('live_quiz_answers')
          .delete()
          .in('session_id', sessionIds);

        if (answersError) throw answersError;

        const { error: playersError } = await supabase
          .from('live_quiz_players')
          .delete()
          .in('session_id', sessionIds);

        if (playersError) throw playersError;

        const { error: questionsError } = await supabase
          .from('live_quiz_questions')
          .delete()
          .in('session_id', sessionIds);

        if (questionsError) throw questionsError;

        const { error: sessionsDeleteError } = await supabase
          .from('live_quiz_sessions')
          .delete()
          .in('id', sessionIds);

        if (sessionsDeleteError) throw sessionsDeleteError;
      }

      const { error: attemptsError } = await supabase
        .from('quiz_attempts')
        .delete()
        .eq('quiz_id', quizId)
        .eq('user_id', userId);

      if (attemptsError) throw attemptsError;

      const { error } = await supabase
        .from('quizzes')
        .delete()
        .eq('id', quizId)
        .eq('user_id', userId); // Ensure user can only delete their own quizzes

      if (error) throw error;

      toast.success('Quiz deleted successfully');
      setLocalQuizzes(prev => prev.filter(quiz => quiz.id !== quizId));
      
      // Refresh the data by triggering a refetch from parent
      // The parent component (App.tsx) will handle the refetch through useAppData
      window.dispatchEvent(new CustomEvent('refresh-quizzes'));
    } catch (error: any) {
      // console.error('Error deleting quiz:', error);

      if (error?.code === '23503' || error?.status === 409) {
        toast.error('Unable to delete this quiz because it has related data. Please try again.');
      } else {
        toast.error('Failed to delete quiz');
      }

      throw error;
    }
  };

  // Filter recordings based on search
  const filteredRecordings = recordings.filter(recording =>
    recording.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    recording.subject?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter quizzes based on search
  const filteredQuizzes = localQuizzes.filter(quiz => {
    const recording = recordings.find(r => r.id === quiz.class_id);
    const searchLower = searchQuery.toLowerCase();
    
    return (
      quiz.title?.toLowerCase().includes(searchLower) ||
      recording?.title?.toLowerCase().includes(searchLower) ||
      recording?.subject?.toLowerCase().includes(searchLower) ||
      quiz.source_type?.toLowerCase().includes(searchLower)
    );
  });

  // Quick Stats Summary
  const QuickStats = () => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <Card className="text-center">
        <CardContent className="p-4">
          <Trophy className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
          <div className="text-2xl font-bold">{userStats?.level || 1}</div>
          <div className="text-sm text-gray-500">Level</div>
        </CardContent>
      </Card>
      <Card className="text-center">
        <CardContent className="p-4">
          <Zap className="h-8 w-8 text-blue-500 mx-auto mb-2" />
          <div className="text-2xl font-bold">{userStats?.total_xp || 0}</div>
          <div className="text-sm text-gray-500">Total XP</div>
        </CardContent>
      </Card>
      <Card className="text-center">
        <CardContent className="p-4">
          <Brain className="h-8 w-8 text-green-500 mx-auto mb-2" />
          <div className="text-2xl font-bold">{userStats?.total_quizzes_completed || 0}</div>
          <div className="text-sm text-gray-500">Quizzes Done</div>
        </CardContent>
      </Card>
      <Card className="text-center">
        <CardContent className="p-4">
          <Target className="h-8 w-8 text-blue-500 mx-auto mb-2" />
          <div className="text-2xl font-bold">{earnedAchievements.length}</div>
          <div className="text-sm text-gray-500">Badges</div>
        </CardContent>
      </Card>
    </div>
  );

  // Quick Actions Panel
  const QuickActions = () => (
    <Card className="mb-6 rounded-xl shadow-sm border-l-4 border-l-yellow-500">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-yellow-100 to-amber-100 dark:from-yellow-900/30 dark:to-amber-900/30">
            <Zap className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
          </div>
          <div>
            <CardTitle className="text-base">Quick Quiz Generation</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Generate quizzes from your content</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-4">
          {/* From Recording */}
          <button
            onClick={() => setActiveTab('recordings')}
            className="group relative overflow-hidden rounded-lg border border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 p-6 hover:shadow-lg transition-all duration-300 hover:scale-[1.02] flex items-center justify-center"
          >
            <div className="p-4 rounded-full bg-blue-500 dark:bg-blue-600 group-hover:scale-110 transition-transform">
              <Play className="h-8 w-8 text-white" />
            </div>
            <div className="absolute inset-x-0 bottom-0 h-1 bg-blue-500 dark:bg-blue-400 transform scale-x-0 group-hover:scale-x-100 transition-transform" />
          </button>

          {/* From Notes */}
          <button
            onClick={() => setActiveTab('notes')}
            className="group relative overflow-hidden rounded-lg border border-green-200 dark:border-green-800 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 p-6 hover:shadow-lg transition-all duration-300 hover:scale-[1.02] flex items-center justify-center"
          >
            <div className="p-4 rounded-full bg-green-500 dark:bg-green-600 group-hover:scale-110 transition-transform">
              <FileText className="h-8 w-8 text-white" />
            </div>
            <div className="absolute inset-x-0 bottom-0 h-1 bg-green-500 dark:bg-green-400 transform scale-x-0 group-hover:scale-x-100 transition-transform" />
          </button>

          {/* AI Smart Quiz */}
          <button
            onClick={() => setActiveTab('ai')}
            className="group relative overflow-hidden rounded-lg border border-indigo-200 dark:border-indigo-800 bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-950 dark:to-indigo-900 p-6 hover:shadow-lg transition-all duration-300 hover:scale-[1.02] flex items-center justify-center"
          >
            <div className="p-4 rounded-full bg-indigo-500 dark:bg-indigo-600 group-hover:scale-110 transition-transform">
              <Brain className="h-8 w-8 text-white" />
            </div>
            <div className="absolute inset-x-0 bottom-0 h-1 bg-indigo-500 dark:bg-indigo-400 transform scale-x-0 group-hover:scale-x-100 transition-transform" />
          </button>

          {/* Live Quiz */}
          <button
            onClick={() => setActiveTab('live')}
            className="group relative overflow-hidden rounded-lg border border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 p-6 hover:shadow-lg transition-all duration-300 hover:scale-[1.02] flex items-center justify-center"
          >
            <div className="p-4 rounded-full bg-purple-500 dark:bg-purple-600 group-hover:scale-110 transition-transform">
              <Users className="h-8 w-8 text-white" />
            </div>
            <div className="absolute inset-x-0 bottom-0 h-1 bg-purple-500 dark:bg-purple-400 transform scale-x-0 group-hover:scale-x-100 transition-transform" />
          </button>
        </div>
      </CardContent>
    </Card>
  );

  const leftRail = () => {
    switch (activeTab) {
      case 'recordings':
        return (
          <StickyRail>
            <Card className="rounded-xl shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                    <Play className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <span>Recording Tips</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-gray-600 dark:text-gray-400 space-y-3">
                <div className="flex gap-2">
                  <div className="w-1.5 bg-blue-500 rounded-full flex-shrink-0"></div>
                  <p>Pick shorter recordings for faster quizzes.</p>
                </div>
                <div className="flex gap-2">
                  <div className="w-1.5 bg-blue-500 rounded-full flex-shrink-0"></div>
                  <p>Higher difficulty yields more XP.</p>
                </div>
              </CardContent>
            </Card>
          </StickyRail>
        );
      case 'notes':
        return (
          <StickyRail>
            <Card className="rounded-xl shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-green-100 dark:bg-green-900/30">
                    <FileText className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                  <span>Notes Tips</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-gray-600 dark:text-gray-400 space-y-3">
                <div className="flex gap-2">
                  <div className="w-1.5 bg-green-500 rounded-full flex-shrink-0"></div>
                  <p>Use headings and bullets for best results.</p>
                </div>
                <div className="flex gap-2">
                  <div className="w-1.5 bg-green-500 rounded-full flex-shrink-0"></div>
                  <p>Short notes generate cleaner questions.</p>
                </div>
              </CardContent>
            </Card>
          </StickyRail>
        );
      case 'ai':
        return (
          <StickyRail>
            <Card className="rounded-xl shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                    <Brain className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <span>AI Tips</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-gray-600 dark:text-gray-400 space-y-3">
                <div className="flex gap-2">
                  <div className="w-1.5 bg-purple-500 rounded-full flex-shrink-0"></div>
                  <p>More context improves question quality.</p>
                </div>
                <div className="flex gap-2">
                  <div className="w-1.5 bg-purple-500 rounded-full flex-shrink-0"></div>
                  <p>Try multiple difficulty levels.</p>
                </div>
              </CardContent>
            </Card>
          </StickyRail>
        );
      case 'history':
        return (
          <StickyRail>
            <Card className="rounded-xl shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-800">
                    <History className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                  </div>
                  <span>History Tips</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-gray-600 dark:text-gray-400 space-y-3">
                <div className="flex gap-2">
                  <div className="w-1.5 bg-gray-500 rounded-full flex-shrink-0"></div>
                  <p>Search by subject or quiz title.</p>
                </div>
                <div className="flex gap-2">
                  <div className="w-1.5 bg-gray-500 rounded-full flex-shrink-0"></div>
                  <p>Review best attempts for progress.</p>
                </div>
              </CardContent>
            </Card>
          </StickyRail>
        );
      case 'live':
        return (
          <StickyRail>
            <Card className="rounded-xl shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                    <Users className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <span>Live Quiz Tips</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-gray-600 dark:text-gray-400 space-y-3">
                <div className="flex gap-2">
                  <div className="w-1.5 bg-purple-500 rounded-full flex-shrink-0"></div>
                  <p>Auto mode keeps the pace moving for everyone.</p>
                </div>
                <div className="flex gap-2">
                  <div className="w-1.5 bg-purple-500 rounded-full flex-shrink-0"></div>
                  <p>Individual mode lets users progress at their own speed.</p>
                </div>
                <div className="flex gap-2">
                  <div className="w-1.5 bg-purple-500 rounded-full flex-shrink-0"></div>
                  <p>Share the join code to invite others!</p>
                </div>
              </CardContent>
            </Card>
          </StickyRail>
        );
      default:
        return (
          <StickyRail>
            <QuickActions />
          </StickyRail>
        );
    }
  };

  const rightRail = () => {
    switch (activeTab) {
      case 'recordings':
        return (
          <StickyRail>
            <StatsCard
              title="Daily Limits"
              items={[
                { label: 'Recording Quizzes', value: dailyCounts.recording, icon: <Play className="h-4 w-4 text-blue-500" /> },
              ]}
            />
          </StickyRail>
        );
      case 'notes':
        return (
          <StickyRail>
            <StatsCard
              title="Daily Limits"
              items={[
                { label: 'Notes Quizzes', value: dailyCounts.notes, icon: <FileText className="h-4 w-4 text-green-500" /> },
              ]}
            />
          </StickyRail>
        );
      case 'ai':
        return (
          <StickyRail>
            <StatsCard
              title="Daily Limits"
              items={[
                { label: 'AI Quizzes', value: dailyCounts.ai, icon: <Brain className="h-4 w-4 text-purple-500" /> },
              ]}
            />
          </StickyRail>
        );
      case 'history':
        return (
          <StickyRail>
            <StatsCard
              title="Progress"
              items={[
                { label: 'Best Attempts', value: Object.keys(bestAttempts || {}).length, icon: <Trophy className="h-4 w-4 text-yellow-500" /> },
                { label: 'Quizzes', value: userStats?.total_quizzes_completed || 0, icon: <Brain className="h-4 w-4 text-green-500" /> },
              ]}
            />
          </StickyRail>
        );
      case 'live':
        // Debug: Log the current state
        // console.log('Live Quiz State:', liveQuizState);
        
        // Show leaderboard if in quiz-active mode
        if (liveQuizState.viewMode === 'quiz-active') {
          return (
            <LiveQuizLeaderboard
              players={liveQuizState.players}
              currentQuestion={liveQuizState.currentQuestion}
              userId={userId}
            />
          );
        }
        // Otherwise show live stats
        return (
          <StickyRail>
            <Card className="rounded-xl shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                    <Trophy className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <span>Live Stats</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {liveQuizState.session ? (
                  <>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-green-50 dark:bg-green-900/20">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-green-600 dark:text-green-400" />
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Players</span>
                      </div>
                      <span className="text-sm font-bold text-green-600 dark:text-green-400">{liveQuizState.players.length}</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                      <div className="flex items-center gap-2">
                        <Crown className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Status</span>
                      </div>
                      <span className="text-xs font-bold text-blue-600 dark:text-blue-400 capitalize">
                        {liveQuizState.session.status}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-purple-50 dark:bg-purple-900/20">
                      <div className="flex items-center gap-2">
                        <Trophy className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Completed</span>
                      </div>
                      <span className="text-sm font-bold text-purple-600 dark:text-purple-400">
                        {loadingLivePastSessions ? '...' : livePastSessions.length}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                      Start or join a live quiz to compete with others in real-time!
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          </StickyRail>
        );
      default:
        return (
          <StickyRail>
            <StatsCard
              title="Progress"
              items={[
                { label: "Level", value: userStats?.level || 1, icon: <Trophy className="h-4 w-4 text-yellow-500" /> },
                { label: "Total XP", value: userStats?.total_xp || 0, icon: <Zap className="h-4 w-4 text-blue-500" /> },
                { label: "Quizzes", value: userStats?.total_quizzes_completed || 0, icon: <Brain className="h-4 w-4 text-green-500" /> },
                { label: "Badges", value: earnedAchievements.length, icon: <Target className="h-4 w-4 text-blue-500" /> },
              ]}
            />
            <div />
          </StickyRail>
        );
    }
  };

  return (
    <AppShell left={leftRail()} right={rightRail()}>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6 pb-12 lg:px-0">
        <HeroHeader
          title="Quiz Center"
          subtitle="Test your knowledge and track your learning progress"
          icon={<Sparkles className="h-8 w-8 text-yellow-300" />}
          gradient="from-blue-600 to-indigo-600"
          actions={null}
        />
        
        {/* Floating Action Buttons */}
        <div className="fixed bottom-16 right-2 lg:bottom-4 lg:right-4 flex flex-col gap-3 z-50">
          {/* Tips Button */}
          {(window as any).__toggleTips && (
            <button
              onClick={() => (window as any).__toggleTips?.()}
              className="h-11 w-11 rounded-full shadow-lg text-blue-500 dark:text-yellow-400 hover:text-yellow-600 dark:hover:text-yellow-300 transition-all duration-300 hover:scale-110 cursor-pointer bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 backdrop-blur-sm flex items-center justify-center"
              style={{
                filter: 'drop-shadow(0 0 8px rgba(36, 190, 251, 0.6))',
                animation: 'glow 2s ease-in-out infinite'
              }}
              title="Quick Tips"
            >
              <Lightbulb className="w-6 h-6 fill-current" />
            </button>
          )}
          
          {/* Refresh Button */}
          <Button
            onClick={() => refreshData('quizzes')}
            disabled={dataLoading.quizzes}
            size="icon"
            className="h-11 w-11 rounded-full shadow-lg bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:shadow-xl transition-all duration-300 border border-slate-100 dark:border-slate-800 backdrop-blur-sm"
          >
            <RefreshCw className={`h-5 w-5 text-blue-600 ${dataLoading.quizzes ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Search Bar */}
        {(activeTab === 'recordings' || activeTab === 'history') && (
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1 max-w-md">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={activeTab === 'recordings' ? 'Search recordings...' : 'Search quiz history...'}
                className="w-full px-4 py-2 pl-10 border rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <svg
                className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchQuery('')}
                className="px-3"
              >
                Clear
              </Button>
            )}
          </div>
        )}

        <TabsContent value="overview" className="space-y-6">
          <QuickStats />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <StatsPanel stats={userStats} isLoading={isLoadingStats} />
            <BadgesPanel
              allBadges={allBadges}
              earnedAchievements={earnedAchievements}
              isLoading={isLoadingBadges}
            />
          </div>
        </TabsContent>
        <TabsContent value="recordings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Play className="h-5 w-5 text-blue-500" />
                Generate Quiz from Recording
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Select Recording</label>
                  <select
                    value={selectedRecording}
                    onChange={(e) => setSelectedRecording(e.target.value)}
                    className="w-full px-3 py-2  rounded-lg bg-white dark:bg-gray-800 "
                  >
                    <option value="">Choose a recording</option>
                    {recordings.map((rec) => (
                      <option key={rec.id} value={rec.id}>
                        {rec.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Questions</label>
                  <select
                    value={numQuestions}
                    onChange={(e) => setNumQuestions(parseInt(e.target.value))}
                    className="w-full px-3 py-2  rounded-lg bg-white dark:bg-gray-800  "
                  >
                    <option value="5">5 Questions</option>
                    <option value="10">10 Questions</option>
                    <option value="15">15 Questions</option>
                    <option value="20">20 Questions</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Difficulty</label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                    className="w-full px-3 py-2  rounded-lg bg-white dark:bg-gray-800 "
                  >
                    <option value="easy">Easy</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
              </div>
              <SubscriptionGuard
                feature="Recording Quizzes"
                limitFeature="maxDailyQuizzes"
                currentCount={dailyCounts.recording}
                message="You've reached your daily limit for Recording Quizzes."
              >
                <Button
                  onClick={handleGenerateQuiz}
                  disabled={!selectedRecording}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  <BookOpen className="h-4 w-4 mr-2" />
                  Generate Quiz from Recording
                </Button>
              </SubscriptionGuard>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Available Recordings ({filteredRecordings.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {filteredRecordings.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No recordings found</p>
                ) : (
                  filteredRecordings.map((recording) => (
                    <div
                      key={recording.id}
                      className="flex items-center justify-between p-3  rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                      onClick={() => setSelectedRecording(recording.id)}
                    >
                      <div className="flex items-center gap-3">
                        <Play className="h-4 w-4 text-blue-500" />
                        <div>
                          <p className="font-medium">{recording.title}</p>
                          <p className="text-sm text-gray-500">
                            {Math.round(recording.duration / 60)} min • {recording.subject}
                          </p>
                        </div>
                      </div>
                      {selectedRecording === recording.id && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes">
          <NotesQuizGenerator
            onGenerateQuizFromNotes={handleGenerateQuizFromNotes}
            isLoading={false}
            dailyCount={dailyCounts.notes}
          />
        </TabsContent>

        <TabsContent value="ai">
          <AutoAIQuizGenerator
            onGenerateAIQuiz={handleGenerateAIQuiz}
            userStats={userStats}
            isLoading={false}
            dailyCount={dailyCounts.ai}
          />
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Quiz History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <QuizHistory 
                quizzes={filteredQuizzes} 
                onSelectQuiz={handleSelectQuiz} 
                bestAttempts={bestAttempts}
                onDeleteQuiz={handleDeleteQuiz}
              />
            </CardContent>
          </Card>

          <Card className="rounded-xl shadow-sm border-l-4 border-l-purple-500">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                  <Trophy className="h-5 w-5 text-purple-700 dark:text-purple-300" />
                </div>
                <div>
                  <CardTitle className="text-base">Live Quiz History</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">Review completed live sessions and results</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingLivePastSessions ? (
                <div className="text-center py-6">
                  <RefreshCw className="h-6 w-6 mx-auto mb-2 animate-spin text-purple-500" />
                  <p className="text-sm text-gray-600 dark:text-gray-400">Loading live sessions...</p>
                </div>
              ) : livePastSessions.length === 0 ? (
                <div className="text-sm text-gray-500 bg-slate-50 dark:bg-slate-900/40 border border-dashed border-slate-200 dark:border-slate-700 rounded-lg p-4">
                  No completed live sessions yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {livePastSessions.map((sessionData) => (
                    <button
                      key={sessionData.id}
                      className="group text-left p-4 bg-white dark:bg-gray-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-purple-300 dark:hover:border-purple-600 transition-all duration-300"
                      onClick={async () => {
                        setViewingLiveSessionId(sessionData.id);
                        setLoadingSessionResults(true);
                        const data = await getSessionResultsById(sessionData.id, userId);
                        setViewingSessionData(data);
                        setLoadingSessionResults(false);
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                              Completed
                            </Badge>
                            {sessionData.player_info.is_host && (
                              <Badge variant="secondary" className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100">
                                <Crown className="h-3 w-3 mr-1" /> Host
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-gray-700 dark:text-gray-300">
                            Join Code: <span className="font-mono font-semibold tracking-wide">{sessionData.join_code}</span>
                          </div>
                          {sessionData.end_time && (
                            <div className="text-xs text-gray-500">
                              Finished: {new Date(sessionData.end_time).toLocaleString()}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          {typeof sessionData.player_info?.score === 'number' && (
                            <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                              Score: {sessionData.player_info.score}
                            </div>
                          )}
                          <div className="text-[11px] px-2 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-medium">
                            View Results
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 h-1 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full w-0 group-hover:w-full transition-all duration-300 bg-gradient-to-r from-purple-400 to-blue-400" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="live">
          {liveQuizState.viewMode === 'quiz-active' && (
            <div className="lg:hidden mb-4">
              <LiveQuizLeaderboard
                players={liveQuizState.players}
                currentQuestion={liveQuizState.currentQuestion}
                userId={userId}
              />
            </div>
          )}
          <LiveQuiz 
            userId={userId} 
            userName={userName} 
            quizzes={quizzes}
              onStateChange={setLiveQuizState}
          />
        </TabsContent>
      </Tabs>

      {/* Live Session Results Modal */}
      {viewingLiveSessionId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-300 overflow-y-auto">
          <div className="relative w-full max-w-5xl my-auto bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden max-h-[95vh] flex flex-col">
            <div className="flex items-center justify-between px-3 sm:px-5 py-3 sm:py-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
              <div className="flex-1 min-w-0">
                <div className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Live Session Results</div>
                <div className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {viewingSessionData.session?.join_code ? `Join Code: ${viewingSessionData.session.join_code}` : 'Session Overview'}
                </div>
              </div>
              <Button
                onClick={() => setViewingLiveSessionId(null)}
                size="sm"
                variant="ghost"
                className="text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 ml-2 flex-shrink-0"
              >
                <X className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            </div>

            <div className="p-3 sm:p-4 md:p-6 overflow-y-auto flex-1">
              {loadingSessionResults ? (
                <div className="text-center py-12">
                  <RefreshCw className="h-8 w-8 mx-auto mb-3 animate-spin text-blue-500" />
                  <p className="text-gray-600 dark:text-gray-400">Loading session results...</p>
                </div>
              ) : viewingSessionData.session ? (
                <LiveQuizResults 
                  session={viewingSessionData.session}
                  players={viewingSessionData.players}
                  userId={userId}
                  resetView={() => setViewingLiveSessionId(null)}
                  toast={({ title, description, variant }: any) => {
                    // console.log(`${variant || 'info'}: ${title} - ${description}`);
                  }}
                  quiz={viewingSessionData.quiz}
                  userAnswers={viewingSessionData.userAnswers}
                  onShareToFeedDraft={({ session, quiz, userAnswers, players }) => {
                    // 1. Close the modal
                    setViewingLiveSessionId(null);
                    // 2. Prepare the data to pass
                    const shareData = { session, quiz, userAnswers, players, type: 'quiz' };
                    // 3. Navigate to social feed and open CreatePostDialog with quiz content (like podcast sharing)
                    if ((window as any).onNavigateToTab) {
                      (window as any).onNavigateToTab('social');
                    } else {
                      // fallback navigation if needed
                      navigate('/social');
                    }
                    setTimeout(() => {
                      if ((window as any).socialFeedRef && (window as any).socialFeedRef.current && (window as any).socialFeedRef.current.openCreatePostDialogWithQuiz) {
                        (window as any).socialFeedRef.current.openCreatePostDialogWithQuiz(shareData);
                      }
                    }, 300);
                  }}
                />
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-600 dark:text-gray-400">Failed to load session results</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <QuizModal
        quizMode={quizMode}
        currentQuestionIndex={currentQuestionIndex}
        userAnswers={userAnswers}
        showResults={showResults}
        onAnswerSelect={handleAnswerSelect}
        onNextQuestion={handleNextQuestion}
        onPreviousQuestion={handlePreviousQuestion}
        onExitQuizMode={handleExitQuizMode}
        calculateScore={calculateScore}
        bestAttempts={bestAttempts}
      />
    </AppShell>
  );
};
