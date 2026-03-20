// src/components/quizzes/components/AutoAIQuizGenerator.tsx
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/components/card';
import { Button } from '../../ui/components/button';
import { Badge } from '../../ui/components/badge';
import { Input } from '../../ui/components/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/components/select';
import { Brain, Zap, Target, Plus, Sparkles, SlidersHorizontal, Hash, BarChart3 } from 'lucide-react';
import { SubscriptionGuard } from '@/modules/subscription/components/SubscriptionGuard';

interface AutoAIQuizProps {
  onGenerateAIQuiz: (topics: string[], focusAreas: string[], numQuestions: number, difficulty: string) => Promise<void>;
  userStats: any;
  isLoading?: boolean;
  dailyCount?: number;
}

export const AutoAIQuizGenerator: React.FC<AutoAIQuizProps> = ({
  onGenerateAIQuiz,
  userStats,
  isLoading = false,
  dailyCount = 0
}) => {
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [focusAreas, setFocusAreas] = useState<string[]>([]);
  const [customTopic, setCustomTopic] = useState('');
  const [numQuestions, setNumQuestions] = useState(8);
  const [difficulty, setDifficulty] = useState('auto');

  const commonTopics = [
    'Mathematics', 'Science', 'History', 'Literature', 'Programming',
    'Biology', 'Chemistry', 'Physics', 'Economics', 'Psychology'
  ];

  const weakAreas = userStats?.weakAreas || ['General Knowledge'];

  const handleTopicToggle = (topic: string) => {
    setSelectedTopics(prev =>
      prev.includes(topic)
        ? prev.filter(t => t !== topic)
        : [...prev, topic]
    );
  };

  const handleFocusAreaToggle = (area: string) => {
    setFocusAreas(prev =>
      prev.includes(area)
        ? prev.filter(a => a !== area)
        : [...prev, area]
    );
  };

  const handleAddCustomTopic = () => {
    const trimmed = customTopic.trim();
    if (trimmed && !selectedTopics.includes(trimmed)) {
      setSelectedTopics(prev => [...prev, trimmed]);
      setCustomTopic('');
    }
  };

  const handleGenerate = async () => {
    const topics = selectedTopics.length > 0 ? selectedTopics : ['General Knowledge'];
    await onGenerateAIQuiz(topics, focusAreas, numQuestions, difficulty);
  };

  return (
    <Card className="shadow-lg border border-blue-200/60 dark:border-blue-800/40 overflow-hidden">
      {/* Header with gradient */}
      <CardHeader className="pb-3 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/30 dark:via-indigo-950/30 dark:to-purple-950/30 border-b border-blue-100/50 dark:border-blue-800/30">
        <CardTitle className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/50">
            <Brain className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1">
            <span className="text-base sm:text-lg font-bold">AI Smart Quiz</span>
            <p className="text-xs font-normal text-gray-500 dark:text-gray-400 mt-0.5">
              Personalized questions powered by AI
            </p>
          </div>
          <Badge variant="secondary" className="bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/50 dark:to-indigo-900/50 text-blue-700 dark:text-blue-300 border-0">
            <Sparkles className="h-3 w-3 mr-1" />
            Adaptive
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="p-4 sm:p-5 space-y-4 sm:space-y-5">
        {/* Topics section */}
        <div>
          <label className="text-sm font-semibold mb-2 flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
            <Target className="h-3.5 w-3.5 text-blue-500" />
            Topics
            {selectedTopics.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 h-5 text-[10px] px-1.5">{selectedTopics.length} selected</Badge>
            )}
          </label>
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {commonTopics.map(topic => (
              <Badge
                key={topic}
                variant={selectedTopics.includes(topic) ? "default" : "outline"}
                className={`cursor-pointer transition-all text-xs sm:text-sm py-1 px-2 sm:px-2.5 ${
                  selectedTopics.includes(topic)
                    ? 'bg-blue-600 hover:bg-blue-700 shadow-sm'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
                onClick={() => handleTopicToggle(topic)}
              >
                {topic}
              </Badge>
            ))}
            {selectedTopics.filter(t => !commonTopics.includes(t)).map(topic => (
              <Badge
                key={topic}
                variant="default"
                className="cursor-pointer transition-all bg-purple-600 hover:bg-purple-700 text-xs sm:text-sm py-1 px-2 sm:px-2.5 shadow-sm"
                onClick={() => handleTopicToggle(topic)}
              >
                {topic} <span className="ml-1 opacity-70">&times;</span>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2 mt-2.5">
            <Input
              placeholder="Add a custom topic..."
              value={customTopic}
              onChange={e => setCustomTopic(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddCustomTopic())}
              className="flex-1 h-9 text-sm"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddCustomTopic}
              disabled={!customTopic.trim()}
              className="h-9 px-3"
            >
              <Plus className="h-3.5 w-3.5 sm:mr-1" />
              <span className="hidden sm:inline">Add</span>
            </Button>
          </div>
        </div>

        {/* Settings row */}
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 sm:p-4 border border-gray-100 dark:border-gray-700/50">
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2.5 flex items-center gap-1.5">
            <SlidersHorizontal className="h-3 w-3" />
            Quiz Settings
          </label>
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                <Hash className="h-3 w-3" />
                Questions
              </label>
              <Select value={String(numQuestions)} onValueChange={v => setNumQuestions(Number(v))}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 Questions</SelectItem>
                  <SelectItem value="8">8 Questions</SelectItem>
                  <SelectItem value="10">10 Questions</SelectItem>
                  <SelectItem value="15">15 Questions</SelectItem>
                  <SelectItem value="20">20 Questions</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                <BarChart3 className="h-3 w-3" />
                Difficulty
              </label>
              <Select value={difficulty} onValueChange={setDifficulty}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto (Adaptive)</SelectItem>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Weak areas */}
        <div>
          <label className="text-sm font-semibold mb-2 flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
            <Zap className="h-3.5 w-3.5 text-orange-500" />
            Focus on Weak Areas
          </label>
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {weakAreas.map(area => (
              <Badge
                key={area}
                variant={focusAreas.includes(area) ? "destructive" : "outline"}
                className={`cursor-pointer transition-all text-xs sm:text-sm py-1 px-2 sm:px-2.5 ${
                  focusAreas.includes(area) ? 'shadow-sm' : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
                onClick={() => handleFocusAreaToggle(area)}
              >
                {area}
              </Badge>
            ))}
          </div>
        </div>

        {/* Generate button */}
        <SubscriptionGuard
          feature="Notes Quizzes"
          limitFeature="maxDailyQuizzes"
          currentCount={dailyCount}
          message="You've reached your daily limit for Notes Quizzes (1/day on Free)."
        >
          <Button
            onClick={handleGenerate}
            disabled={isLoading}
            className="w-full h-11 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 text-white shadow-md hover:shadow-lg transition-all text-sm sm:text-base font-semibold"
          >
            {isLoading ? (
              <>
                <div className="h-4 w-4 mr-2 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Creating Smart Quiz...
              </>
            ) : (
              <>
                <Brain className="h-4 w-4 mr-2" />
                Generate AI Quiz
              </>
            )}
          </Button>
        </SubscriptionGuard>

        <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
          AI analyzes your learning patterns to create personalized questions
        </p>
      </CardContent>
    </Card>
  );
};