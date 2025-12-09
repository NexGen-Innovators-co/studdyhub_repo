// src/components/quizzes/components/AutoAIQuizGenerator.tsx
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Brain, Zap, Target } from 'lucide-react';
import { SubscriptionGuard } from '@/components/subscription/SubscriptionGuard';

interface AutoAIQuizProps {
  onGenerateAIQuiz: (topics: string[], focusAreas: string[]) => Promise<void>;
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

  const handleGenerate = async () => {
    if (selectedTopics.length === 0) {
      selectedTopics.push('General Knowledge');
    }
    await onGenerateAIQuiz(selectedTopics, focusAreas);
  };

  return (
    <Card className="shadow-lg border-2 border-blue-200 dark:border-blue-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-blue-500" />
          AI Smart Quiz
          <Badge variant="secondary" className="ml-2 bg-blue-100 text-blue-700">
            <Zap className="h-3 w-3 mr-1" />
            Adaptive
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium mb-2 block items-center gap-2">
            <Target className="h-4 w-4" />
            Select Topics
          </label>
          <div className="flex flex-wrap gap-2">
            {commonTopics.map(topic => (
              <Badge
                key={topic}
                variant={selectedTopics.includes(topic) ? "default" : "outline"}
                className="cursor-pointer transition-all"
                onClick={() => handleTopicToggle(topic)}
              >
                {topic}
              </Badge>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Focus on Weak Areas</label>
          <div className="flex flex-wrap gap-2">
            {weakAreas.map(area => (
              <Badge
                key={area}
                variant={focusAreas.includes(area) ? "destructive" : "outline"}
                className="cursor-pointer transition-all"
                onClick={() => handleFocusAreaToggle(area)}
              >
                {area}
              </Badge>
            ))}
          </div>
        </div>
        <SubscriptionGuard
          feature="Notes Quizzes"
          limitFeature="maxDailyQuizzes"
          currentCount={dailyCount}
          message="You've reached your daily limit for Notes Quizzes (1/day on Free)."
        >
          <Button
            onClick={handleGenerate}
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-blue-600 to-pink-600 hover:from-blue-700 hover:to-pink-700"
          >
            <Brain className="h-4 w-4 mr-2" />
            {isLoading ? 'Creating Smart Quiz...' : 'Generate AI Quiz'}
          </Button>
        </SubscriptionGuard>
        <p className="text-xs text-gray-500 text-center">
          AI will analyze your learning patterns and create personalized questions
        </p>
      </CardContent>
    </Card>
  );
};