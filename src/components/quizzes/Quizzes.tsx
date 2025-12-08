// src/components/quizzes/Quizzes.tsx - REDESIGNED
import React, { useEffect, useState } from 'react';
import { ClassRecording, Quiz } from '../../types/Class';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { QuizHistory } from './components/QuizHistory';
import { QuizModal } from './components/QuizModal';
import { StatsPanel } from './components/StatsPanel';
import { BadgesPanel } from './components/BadgesPanel';
import { NotesQuizGenerator } from './components/NotesQuizGenerator';
import { AutoAIQuizGenerator } from './components/AutoAIQuizGenerator';
import { useQuizManagement } from './hooks/useQuizManagement';
import { useQuizTracking } from './hooks/useQuizTracking';
import { useRealtimeSyncForQuizzes } from './hooks/useRealtimeSyncForQuizzes';
import { seedDefaultBadges, getAllBadges, getUserAchievements } from './utils/seedDefaultBadges';
import { Badge, Achievement } from '../../types/EnhancedClasses';
import { AppShell } from '../layout/AppShell';
import { StickyRail } from '../layout/StickyRail';
import { HeroHeader } from '../layout/HeroHeader';
import { QuickActionsCard } from '../layout/QuickActionsCard';
import { StatsCard } from '../layout/StatsCard';
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
  BarChart3
} from 'lucide-react';

interface QuizzesProps {
  quizzes: Quiz[];
  recordings: ClassRecording[];
  onGenerateQuiz: (recording: ClassRecording, quiz: Quiz) => void;
  userId: string;
}

export const Quizzes: React.FC<QuizzesProps> = ({ quizzes, recordings, onGenerateQuiz, userId }) => {
  const [selectedRecording, setSelectedRecording] = useState<string>('');
  const [numQuestions, setNumQuestions] = useState<number>(5);
  const [difficulty, setDifficulty] = useState<string>('intermediate');
  const [allBadges, setAllBadges] = useState<Badge[]>([]);
  const [earnedAchievements, setEarnedAchievements] = useState<Achievement[]>([]);
  const [isLoadingBadges, setIsLoadingBadges] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  const { userStats, isLoadingStats, recordQuizAttempt, fetchUserStats } = useQuizTracking(userId);

  const {
    quizMode,
    currentQuestionIndex,
    userAnswers,
    showResults,
    handleGenerateQuizFromRecording,
    handleGenerateQuizFromNotes,
    handleGenerateAIQuiz,
    handleAnswerSelect,
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
      onGenerateQuiz(recordings.find(r => r.id === quiz.classId)!, quiz);
    },
    onStatsUpdate: fetchUserStats,
  });

  // Sync tab changes with global header
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('section-tab-active', { detail: { section: 'quizzes', tab: activeTab } }));
  }, [activeTab]);

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

  const handleGenerateQuiz = () => {
    const recording = recordings.find(r => r.id === selectedRecording);
    if (recording) {
      handleGenerateQuizFromRecording(recording, numQuestions, difficulty);
    }
  };

  const handleSelectQuiz = (quiz: Quiz) => {
    const recording = recordings.find(r => r.id === quiz.classId);
    setQuizMode({ recording: recording!, quiz });
  };

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
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-yellow-500" />
          Quick Quiz Generation
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* From Recording */}
          <Card className="">
            <CardContent className="p-4 text-center">
              <Play className="h-8 w-8 text-blue-500 mx-auto mb-2" />
              <h3 className="font-semibold mb-2">From Recording</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Generate quiz from your class recordings
              </p>
              <Button
                onClick={() => setActiveTab('recordings')}
                className="w-full bg-blue-600 hover:bg-blue-700"
                size="sm"
              >
                Choose Recording
              </Button>
            </CardContent>
          </Card>

          {/* From Notes */}
          <Card className="">
            <CardContent className="p-4 text-center">
              <FileText className="h-8 w-8 text-green-500 mx-auto mb-2" />
              <h3 className="font-semibold mb-2">From Notes</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Convert your study notes into a quiz
              </p>
              <Button
                onClick={() => setActiveTab('notes')}
                className="w-full bg-green-600 hover:bg-green-700"
                size="sm"
              >
                Use Notes
              </Button>
            </CardContent>
          </Card>

          {/* AI Smart Quiz */}
          <Card className="">
            <CardContent className="p-4 text-center">
              <Brain className="h-8 w-8 text-blue-500 mx-auto mb-2" />
              <h3 className="font-semibold mb-2">AI Smart Quiz</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Personalized quiz based on your learning
              </p>
              <Button
                onClick={() => setActiveTab('ai')}
                className="w-full bg-blue-600 hover:bg-blue-700"
                size="sm"
              >
                Smart Quiz
              </Button>
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  );

  const leftRail = (
    <StickyRail>
      <QuickActions />
      <StatsCard
        title="Progress"
        items={[
          { label: "Level", value: userStats?.level || 1, icon: <Trophy className="h-4 w-4 text-yellow-500" /> },
          { label: "Total XP", value: userStats?.total_xp || 0, icon: <Zap className="h-4 w-4 text-blue-500" /> },
          { label: "Quizzes", value: userStats?.total_quizzes_completed || 0, icon: <Brain className="h-4 w-4 text-green-500" /> },
          { label: "Badges", value: earnedAchievements.length, icon: <Target className="h-4 w-4 text-blue-500" /> },
        ]}
      />
    </StickyRail>
  );

  const rightRail = (
    <StickyRail>
      <StatsCard
        title="At a glance"
        items={[
          { label: "Level", value: userStats?.level || 1, icon: <Trophy className="h-4 w-4 text-yellow-500" /> },
          { label: "Total XP", value: userStats?.total_xp || 0, icon: <Zap className="h-4 w-4 text-blue-500" /> },
          { label: "Quizzes Done", value: userStats?.total_quizzes_completed || 0, icon: <Brain className="h-4 w-4 text-green-500" /> },
          { label: "Badges", value: earnedAchievements.length, icon: <Target className="h-4 w-4 text-indigo-500" /> },
        ]}
      />
    </StickyRail>
  );

  return (
    <AppShell left={leftRail} right={rightRail}>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6 pb-12 px-2 lg:px-0">
        <HeroHeader
          title="Quiz Center"
          subtitle="Test your knowledge and track your learning progress"
          icon={<Sparkles className="h-8 w-8 text-yellow-300" />}
          gradient="from-blue-600 to-indigo-600"
        />

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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <Button
                onClick={handleGenerateQuiz}
                disabled={!selectedRecording}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                <BookOpen className="h-4 w-4 mr-2" />
                Generate Quiz from Recording
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Available Recordings ({recordings.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recordings.map((recording) => (
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
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes">
          <NotesQuizGenerator
            onGenerateQuizFromNotes={handleGenerateQuizFromNotes}
            isLoading={false}
          />
        </TabsContent>

        <TabsContent value="ai">
          <AutoAIQuizGenerator
            onGenerateAIQuiz={handleGenerateAIQuiz}
            userStats={userStats}
            isLoading={false}
          />
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Quiz History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <QuizHistory quizzes={quizzes} onSelectQuiz={handleSelectQuiz} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
      />
    </AppShell>
  );
};