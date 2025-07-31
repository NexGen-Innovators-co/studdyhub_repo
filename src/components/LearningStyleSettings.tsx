import React, { useState, useEffect } from 'react';
import { Brain, Settings, Save } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { UserProfile } from '../types/Document';

interface LearningStyleSettingsProps {
  profile: UserProfile | null;
  onProfileUpdate: (profile: UserProfile) => void;
}

export const LearningStyleSettings: React.FC<LearningStyleSettingsProps> = ({
  profile,
  onProfileUpdate
}) => {
  const [learningStyle, setLearningStyle] = useState<UserProfile['learning_style']>('visual');
  const [explanationStyle, setExplanationStyle] = useState<'simple' | 'detailed' | 'comprehensive'>('detailed');
  const [includeExamples, setIncludeExamples] = useState(true);
  const [difficulty, setDifficulty] = useState<'beginner' | 'intermediate' | 'advanced'>('intermediate');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (profile) {
      setLearningStyle(profile.learning_style);
      setExplanationStyle(profile.learning_preferences.explanation_style);
      setIncludeExamples(profile.learning_preferences.examples);
      setDifficulty(profile.learning_preferences.difficulty);
    }
  }, [profile]);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const updatedPreferences = {
        explanation_style: explanationStyle,
        examples: includeExamples,
        difficulty: difficulty,
      };

      const { data, error } = await supabase
        .from('profiles')
        .update({
          learning_style: learningStyle,
          learning_preferences: updatedPreferences,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)
        .select()
        .single();

      if (error) throw error;

      const updatedProfile: UserProfile = {
        ...data,
        learning_style: data.learning_style as UserProfile['learning_style'],
        learning_preferences: data.learning_preferences as UserProfile['learning_preferences'],
        created_at: new Date(data.created_at),
        updated_at: new Date(data.updated_at),
      };

      onProfileUpdate(updatedProfile);
      toast.success('Learning preferences saved!');
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast.error('Failed to save preferences');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className='max-w-6xl mx-auto mt-6 p-4 shadow-lg'>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-purple-600" />
          Learning Style Preferences
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 ">
        <div className="space-y-2">
          <Label htmlFor="learning-style">Primary Learning Style</Label>
          <Select value={learningStyle} onValueChange={(value: UserProfile['learning_style']) => setLearningStyle(value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="visual">Visual - Diagrams, charts, and visual aids</SelectItem>
              <SelectItem value="auditory">Auditory - Verbal explanations and discussions</SelectItem>
              <SelectItem value="kinesthetic">Kinesthetic - Hands-on and practical examples</SelectItem>
              <SelectItem value="reading">Reading/Writing - Text-based learning</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="explanation-style">Explanation Style</Label>
          <Select value={explanationStyle} onValueChange={(value: 'simple' | 'detailed' | 'comprehensive') => setExplanationStyle(value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="simple">Simple - Brief and to the point</SelectItem>
              <SelectItem value="detailed">Detailed - Thorough explanations</SelectItem>
              <SelectItem value="comprehensive">Comprehensive - In-depth analysis</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="difficulty">Difficulty Level</Label>
          <Select value={difficulty} onValueChange={(value: 'beginner' | 'intermediate' | 'advanced') => setDifficulty(value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="beginner">Beginner - Basic concepts and simple language</SelectItem>
              <SelectItem value="intermediate">Intermediate - Moderate complexity</SelectItem>
              <SelectItem value="advanced">Advanced - Technical and detailed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id="examples"
            checked={includeExamples}
            onCheckedChange={setIncludeExamples}
          />
          <Label htmlFor="examples">Include practical examples and analogies</Label>
        </div>

        <Button onClick={handleSave} disabled={isLoading} className="w-full">
          {isLoading ? (
            <>
              <Settings className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Preferences
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};