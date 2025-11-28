// src/components/quizzes/Quizzes.tsx
import React, { useEffect, useState } from 'react';
import { ClassRecording, Quiz } from '../../types/Class';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { QuizHistory } from './components/QuizHistory';
import { QuizModal } from './components/QuizModal';
import { StatsPanel } from './components/StatsPanel';
import { BadgesPanel } from './components/BadgesPanel';
import { useQuizManagement } from './hooks/useQuizManagement';
import { useQuizTracking } from './hooks/useQuizTracking';
import { useRealtimeSyncForQuizzes } from './hooks/useRealtimeSyncForQuizzes';
import { seedDefaultBadges, getAllBadges, getUserAchievements } from './utils/seedDefaultBadges';
import { Badge, Achievement } from '../../types/EnhancedClasses';
import { Sparkles, BookOpen } from 'lucide-react';

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

  const { userStats, isLoadingStats, recordQuizAttempt, fetchUserStats } = useQuizTracking(userId);

  const {
    quizMode,
    currentQuestionIndex,
    userAnswers,
    showResults,
    handleGenerateQuizFromRecording,
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

  return (
    <div className="h-full w-full overflow-y-auto modern-scrollbar p-6 space-y-6 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Sparkles className="h-8 w-8 text-yellow-500" />
            Quizzes & Progress
          </h1>
        </div>

        {/* Stats and Badges Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <StatsPanel stats={userStats} isLoading={isLoadingStats} />
          <BadgesPanel
            allBadges={allBadges}
            earnedAchievements={earnedAchievements}
            isLoading={isLoadingBadges}
          />
        </div>

        {/* Generate Quiz Section */}
        <Card className="mb-6 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-blue-500" />
              Generate New Quiz
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Select Recording</label>
                <Select value={selectedRecording} onValueChange={setSelectedRecording}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a recording" />
                  </SelectTrigger>
                  <SelectContent>
                    {recordings.map((rec) => (
                      <SelectItem key={rec.id} value={rec.id}>
                        {rec.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Number of Questions</label>
                <Select value={numQuestions.toString()} onValueChange={(val) => setNumQuestions(parseInt(val))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 Questions</SelectItem>
                    <SelectItem value="10">10 Questions</SelectItem>
                    <SelectItem value="15">15 Questions</SelectItem>
                    <SelectItem value="20">20 Questions</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Difficulty</label>
                <Select value={difficulty} onValueChange={setDifficulty}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              onClick={handleGenerateQuiz}
              disabled={!selectedRecording}
              className="mt-4 w-full md:w-auto bg-blue-600 hover:bg-blue-700"
            >
              Generate Quiz
            </Button>
          </CardContent>
        </Card>

        {/* Quiz History */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Quiz History</CardTitle>
          </CardHeader>
          <CardContent>
            <QuizHistory quizzes={quizzes} onSelectQuiz={handleSelectQuiz} />
          </CardContent>
        </Card>

        {/* Quiz Modal */}
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
      </div>
    </div>
  );
};
