// src/components/quizzes/components/LearningGoals.tsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Progress } from '../../ui/progress';
import { Input } from '../../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Badge } from '../../ui/badge';
import { Plus, Target, Trophy, Calendar, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../../integrations/supabase/client';

interface LearningGoal {
  id: string;
  user_id: string;
  goal_text: string;
  target_date: string | null;
  progress: number;
  category: string;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
}

interface LearningGoalsProps {
  userId: string;
}

export const LearningGoals: React.FC<LearningGoalsProps> = ({ userId }) => {
  const [goals, setGoals] = useState<LearningGoal[]>([]);
  const [newGoal, setNewGoal] = useState('');
  const [category, setCategory] = useState('general');
  const [targetDate, setTargetDate] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (userId) {
      fetchGoals();
    }
  }, [userId]);

  const fetchGoals = async () => {
    try {
      const { data, error } = await supabase
        .from('user_learning_goals')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setGoals(data || []);
    } catch (error) {
      //console.error('Error fetching goals:', error);
      toast.error('Failed to load goals');
    } finally {
      setIsLoading(false);
    }
  };

  const addGoal = async () => {
    if (!newGoal.trim()) {
      toast.error('Please enter a goal');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_learning_goals')
        .insert([{
          user_id: userId,
          goal_text: newGoal,
          target_date: targetDate || null,
          progress: 0,
          category: category,
          is_completed: false,
        }])
        .select()
        .single();

      if (error) throw error;

      setGoals([data, ...goals]);
      setNewGoal('');
      setCategory('general');
      setTargetDate('');
      toast.success('Goal added successfully!');
    } catch (error) {
      //console.error('Error adding goal:', error);
      toast.error('Failed to add goal');
    }
  };

  const updateProgress = async (goalId: string, progress: number) => {
    try {
      const { error } = await supabase
        .from('user_learning_goals')
        .update({
          progress,
          updated_at: new Date().toISOString(),
          is_completed: progress === 100
        })
        .eq('id', goalId);

      if (error) throw error;

      setGoals(goals.map(g => g.id === goalId ? { ...g, progress, is_completed: progress === 100 } : g));
      toast.success('Progress updated!');
    } catch (error) {
      //console.error('Error updating progress:', error);
      toast.error('Failed to update progress');
    }
  };

  const deleteGoal = async (goalId: string) => {
    try {
      const { error } = await supabase
        .from('user_learning_goals')
        .delete()
        .eq('id', goalId);

      if (error) throw error;

      setGoals(goals.filter(g => g.id !== goalId));
      toast.success('Goal deleted!');
    } catch (error) {
      //console.error('Error deleting goal:', error);
      toast.error('Failed to delete goal');
    }
  };

  const categories = [
    { value: 'general', label: 'General' },
    { value: 'quizzes', label: 'Quizzes' },
    { value: 'study', label: 'Study Time' },
    { value: 'streak', label: 'Streak' },
    { value: 'badges', label: 'Badges' },
    { value: 'notes', label: 'Notes' },
    { value: 'recordings', label: 'Recordings' }
  ];

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      quizzes: 'blue',
      study: 'green',
      streak: 'orange',
      badges: 'blue',
      notes: 'yellow',
      recordings: 'pink',
      general: 'gray'
    };
    return colors[category] || 'gray';
  };

  if (isLoading) {
    return (
      <Card className="shadow-lg">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5 text-blue-500" />
          Learning Goals
          <Badge variant="secondary" className="ml-2">
            {goals.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add New Goal */}
        <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <Input
            value={newGoal}
            onChange={(e) => setNewGoal(e.target.value)}
            placeholder="What do you want to achieve? (e.g., 'Complete 10 quizzes with 80% score')"
            className="w-full"
            onKeyPress={(e) => e.key === 'Enter' && addGoal()}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              placeholder="Target date (optional)"
            />
          </div>
          <Button onClick={addGoal} className="w-full" disabled={!newGoal.trim()}>
            <Plus className="h-4 w-4 mr-2" />
            Add Goal
          </Button>
        </div>

        {/* Goals List */}
        <div className="space-y-4">
          {goals.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Target className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No goals set yet</p>
              <p className="text-sm mt-1">Add your first learning goal to track your progress!</p>
            </div>
          ) : (
            goals.map((goal) => (
              <div key={goal.id} className="p-4 border rounded-lg space-y-3 bg-white dark:bg-gray-800">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className={`text-xs bg-${getCategoryColor(goal.category)}-100 text-${getCategoryColor(goal.category)}-700 border-${getCategoryColor(goal.category)}-200`}>
                        {categories.find(c => c.value === goal.category)?.label || 'General'}
                      </Badge>
                      {goal.is_completed && (
                        <Badge variant="secondary" className="bg-green-100 text-green-700">
                          <Trophy className="h-3 w-3 mr-1" />
                          Completed
                        </Badge>
                      )}
                    </div>
                    <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                      {goal.goal_text}
                    </h4>
                    {goal.target_date && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                        <Calendar className="h-3 w-3" />
                        Target: {new Date(goal.target_date).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteGoal(goal.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Progress</span>
                    <span className="font-semibold">{goal.progress}%</span>
                  </div>
                  <Progress value={goal.progress} className="h-2" />
                  <div className="flex gap-1 justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateProgress(goal.id, Math.max(0, goal.progress - 25))}
                      disabled={goal.progress <= 0}
                      className="h-6 text-xs"
                    >
                      -25%
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateProgress(goal.id, Math.min(100, goal.progress + 25))}
                      disabled={goal.progress >= 100}
                      className="h-6 text-xs"
                    >
                      +25%
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Quick Stats */}
        {goals.length > 0 && (
          <div className="grid grid-cols-3 gap-2 pt-4 border-t dark:border-gray-700">
            <div className="text-center">
              <div className="text-lg font-bold text-blue-600">
                {goals.filter(g => g.is_completed).length}
              </div>
              <div className="text-xs text-gray-500">Completed</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-green-600">
                {Math.round(goals.reduce((sum, goal) => sum + goal.progress, 0) / goals.length)}%
              </div>
              <div className="text-xs text-gray-500">Avg Progress</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-orange-600">
                {goals.filter(g => g.target_date && new Date(g.target_date) < new Date() && !g.is_completed).length}
              </div>
              <div className="text-xs text-gray-500">Overdue</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};