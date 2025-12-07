import React, { useState, useEffect } from 'react';
import {
  Brain,
  Settings,
  Save,
  User,
  ImageIcon,
  Lock,
  Eye,
  EyeOff,
  Upload,
  Check,
  AlertCircle,
  Volume2,
  Hand,
  FileText,
  Target,
  Trophy,
  Clock,
  Shield,
  Download,
  Trash2,
  Calendar,
  Bell
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { supabase } from '../../integrations/supabase/client';
import { toast } from 'sonner';
import { UserProfile } from '../../types/Document';
import { LearningGoals } from './components.tsx/LearningGoals';

interface UserSettingsProps {
  profile: UserProfile | null;
  onProfileUpdate: (profile: UserProfile) => void;
}

// Types for new features
interface UserLearningGoal {
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

interface Achievement {
  id: string;
  user_id: string;
  badge_id: string;
  earned_at: string;
  badges: {
    id: string;
    name: string;
    description: string;
    icon: string;
    requirement_type: string;
    requirement_value: number;
    xp_reward: number;
  };
}

interface UserStats {
  user_id: string;
  total_xp: number;
  level: number;
  current_streak: number;
  longest_streak: number;
  total_quizzes_attempted: number;
  total_quizzes_completed: number;
  average_score: number;
  total_study_time_seconds: number;
  badges_earned: string[];
  last_activity_date: string;
}

export const UserSettings: React.FC<UserSettingsProps> = ({
  profile,
  onProfileUpdate
}) => {
  // Original form states
  const [learningStyle, setLearningStyle] = useState<UserProfile['learning_style']>('visual');
  const [explanationStyle, setExplanationStyle] = useState<'simple' | 'detailed' | 'comprehensive'>('detailed');
  const [includeExamples, setIncludeExamples] = useState(true);
  const [difficulty, setDifficulty] = useState<'beginner' | 'intermediate' | 'advanced'>('intermediate');
  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  // Enhanced password states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Enhanced UI states
  const [isLoading, setIsLoading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activeSection, setActiveSection] = useState<'profile' | 'learning' | 'goals' | 'achievements' | 'study' | 'privacy' | 'security'>('profile');

  // New feature states
  const [goals, setGoals] = useState<UserLearningGoal[]>([]);
  const [newGoal, setNewGoal] = useState('');
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [preferredStudyTimes, setPreferredStudyTimes] = useState<string[]>([]);
  const [studyReminders, setStudyReminders] = useState(true);
  const [breakInterval, setBreakInterval] = useState(45);
  const [dataCollection, setDataCollection] = useState(true);
  const [analytics, setAnalytics] = useState(true);

  useEffect(() => {
    if (profile) {
      setLearningStyle(profile.learning_style);
      setExplanationStyle(profile.learning_preferences.explanation_style);
      setIncludeExamples(profile.learning_preferences.examples);
      setDifficulty(profile.learning_preferences.difficulty);
      setFullName(profile.full_name || '');
      setAvatarUrl(profile.avatar_url || '');
    }
  }, [profile]);

  // Load additional data when section changes
  useEffect(() => {
    switch (activeSection) {
      case 'goals':
        fetchUserGoals();
        break;
      case 'achievements':
        fetchAchievements();
        fetchUserStats();
        break;
      case 'study':
        loadStudyPreferences();
        break;
      default:
        break;
    }
  }, [activeSection]);

  const fetchUserGoals = async () => {
    try {
      const { data, error } = await supabase
        .from('user_learning_goals')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setGoals(data || []);
    } catch (error) {
      //console.error('Error fetching goals:', error);
      toast.error('Failed to load goals');
    }
  };

  const fetchAchievements = async () => {
    try {
      const { data, error } = await supabase
        .from('achievements')
        .select(`
          *,
          badges (*)
        `)
        .order('earned_at', { ascending: false });

      if (error) throw error;
      setAchievements(data || []);
    } catch (error) {
      //console.error('Error fetching achievements:', error);
      toast.error('Failed to load achievements');
    }
  };

  const fetchUserStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get the most recent stats record
      const { data, error } = await supabase
        .from('user_stats')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (error) throw error;
      setStats(data?.[0] || null);
    } catch (error) {
      //console.error('Error fetching stats:', error);
    }
  };

  const loadStudyPreferences = async () => {
    // Load from user profile or preferences
    // This is a placeholder - you might want to store these in a separate table
    const savedTimes = localStorage.getItem('preferredStudyTimes');
    if (savedTimes) {
      setPreferredStudyTimes(JSON.parse(savedTimes));
    }

    const savedReminders = localStorage.getItem('studyReminders');
    if (savedReminders) {
      setStudyReminders(JSON.parse(savedReminders));
    }

    const savedInterval = localStorage.getItem('breakInterval');
    if (savedInterval) {
      setBreakInterval(JSON.parse(savedInterval));
    }
  };

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setErrors({ ...errors, avatar: 'Please select an image file.' });
        toast.error('Please select an image file.');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setErrors({ ...errors, avatar: 'Image size must be less than 5MB.' });
        toast.error('Image size must be less than 5MB.');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
        setErrors({ ...errors, avatar: '' });
      };
      reader.readAsDataURL(file);
      setAvatarUrl(file as any);
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (newPassword && newPassword.length < 8) {
      newErrors.newPassword = 'Password must be at least 8 characters long.';
    }

    if (newPassword && confirmPassword && newPassword !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match.';
    }

    if (!fullName.trim()) {
      newErrors.fullName = 'Full name is required.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    setSaveSuccess(false);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let updatedAvatarUrl = avatarUrl;
      if (avatarPreview && typeof avatarUrl !== 'string') {
        const file = avatarUrl as File;
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(`public/${user.id}/${fileName}`, file, {
            cacheControl: '3600',
            upsert: true
          });
        if (uploadError) throw uploadError;
        updatedAvatarUrl = `${supabase.storage.from('avatars').getPublicUrl(`public/${user.id}/${fileName}`).data.publicUrl}`;
      }

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
          full_name: fullName,
          avatar_url: updatedAvatarUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)
        .select()
        .single();

      if (error) throw error;

      if (newPassword) {
        const { error: passwordError } = await supabase.auth.updateUser({
          password: newPassword,
        });
        if (passwordError) throw passwordError;
        toast.success('Password updated successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }

      const updatedProfile: UserProfile = {
        ...data,
        learning_style: data.learning_style as UserProfile['learning_style'],
        learning_preferences: data.learning_preferences as UserProfile['learning_preferences'],
        created_at: new Date(data.created_at),
        updated_at: new Date(data.updated_at),
      };

      onProfileUpdate(updatedProfile);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      toast.success('Profile and preferences saved!');
    } catch (error) {
      //console.error('Error saving preferences:', error);
      toast.error('Failed to save preferences or update password');
    } finally {
      setIsLoading(false);
    }
  };

  // Goals Functions
  const addGoal = async () => {
    if (!newGoal.trim()) {
      toast.error('Please enter a goal');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('user_learning_goals')
        .insert([{
          user_id: user.id,
          goal_text: newGoal,
          progress: 0,
          category: 'general'
        }])
        .select()
        .single();

      if (error) throw error;

      setGoals([data, ...goals]);
      setNewGoal('');
      toast.success('Goal added!');
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

      setGoals(goals.map(g => g.id === goalId ? { ...g, progress } : g));
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

  // Study Preferences Functions
  const toggleStudyTime = (time: string) => {
    const newTimes = preferredStudyTimes.includes(time)
      ? preferredStudyTimes.filter(t => t !== time)
      : [...preferredStudyTimes, time];

    setPreferredStudyTimes(newTimes);
    localStorage.setItem('preferredStudyTimes', JSON.stringify(newTimes));
  };

  const saveStudyPreferences = () => {
    localStorage.setItem('studyReminders', JSON.stringify(studyReminders));
    localStorage.setItem('breakInterval', JSON.stringify(breakInterval));
    toast.success('Study preferences saved!');
  };

  const exportData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Fetch all user data - use limit(1) for stats
      const [profileData, goalsData, achievementsData, statsData] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('user_learning_goals').select('*').eq('user_id', user.id),
        supabase.from('achievements').select('*, badges(*)').eq('user_id', user.id),
        supabase.from('user_stats').select('*').eq('user_id', user.id).limit(1) // Changed from .single()
      ]);

      const userData = {
        profile: profileData.data,
        goals: goalsData.data,
        achievements: achievementsData.data,
        stats: statsData.data?.[0] || null, // Take first record
        export_date: new Date().toISOString()
      };

      const blob = new Blob([JSON.stringify(userData, null, 2)], {
        type: 'application/json'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `studdyhub-data-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success('Data exported successfully!');
    } catch (error) {
      //console.error('Error exporting data:', error);
      toast.error('Failed to export data');
    }
  };

  const deleteAccount = async () => {
    if (!confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      return;
    }

    try {
      // Note: This is a simplified version. In production, you might want to:
      // 1. Send a confirmation email
      // 2. Schedule deletion after a grace period
      // 3. Use proper cascade deletion

      toast.info('Account deletion feature would be implemented here');
      // const { error } = await supabase.rpc('delete_user_account');
      // if (error) throw error;
      // toast.success('Account deletion scheduled');
    } catch (error) {
      //console.error('Error deleting account:', error);
      toast.error('Failed to delete account');
    }
  };

  const learningStyleOptions = [
    { value: 'visual', label: 'Visual', description: 'Diagrams, charts, and visual aids', icon: Eye },
    { value: 'auditory', label: 'Auditory', description: 'Verbal explanations and discussions', icon: Volume2 },
    { value: 'kinesthetic', label: 'Kinesthetic', description: 'Hands-on and practical examples', icon: Hand },
    { value: 'reading', label: 'Reading/Writing', description: 'Text-based learning', icon: FileText },
  ];

  const timeSlots = [
    'Morning (6AM-12PM)',
    'Afternoon (12PM-5PM)',
    'Evening (5PM-9PM)',
    'Night (9PM-12AM)'
  ];

  return (
    <div className="min-h-screen p-6 transition-colors duration-300 dark: bg-transparent">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-600 rounded-xl">
              <Settings className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Settings</h1>
              <p className="text-gray-600 dark:text-gray-300">Customize your learning experience</p>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="p-1 rounded-xl border mb-8 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <div className="flex flex-wrap">
            {[
              { id: 'profile', label: 'Profile', icon: User },
              { id: 'learning', label: 'Learning', icon: Brain },
              { id: 'goals', label: 'Goals', icon: Target },
              { id: 'achievements', label: 'Achievements', icon: Trophy },
              { id: 'study', label: 'Study', icon: Clock },
              { id: 'privacy', label: 'Privacy', icon: Shield },
              { id: 'security', label: 'Security', icon: Lock }
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveSection(id as any)}
                className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 py-3 px-4 rounded-lg transition-all ${activeSection === id
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content Sections */}
        <Card className="rounded-2xl border shadow-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">

          {/* Profile Section */}
          {activeSection === 'profile' && (
            <CardContent className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <User className="h-5 w-5 text-blue-500" />
                <h2 className="text-xl font-semibold">Profile Information</h2>
              </div>

              <div className="flex flex-col md:flex-row gap-8">
                {/* Avatar Section */}
                <div className="flex flex-col items-center">
                  <div className="relative group">
                    <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-blue-500 bg-gradient-to-br from-blue-400 to-blue-500">
                      {avatarPreview ? (
                        <img src={avatarPreview} alt="Avatar Preview" className="w-full h-full object-cover" />
                      ) : avatarUrl && typeof avatarUrl === 'string' ? (
                        <img src={avatarUrl} alt="Current Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white text-2xl font-bold">
                          {fullName.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                        </div>
                      )}
                    </div>
                    <input
                      type="file"
                      id="avatar"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      className="hidden"
                    />
                    <button
                      onClick={() => document.getElementById('avatar')?.click()}
                      className="absolute inset-0 rounded-full bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                    >
                      <Upload className="h-6 w-6" />
                    </button>
                  </div>
                  {errors.avatar && (
                    <p className="text-red-500 text-sm mt-2 flex items-center gap-1">
                      <AlertCircle className="h-4 w-4" />
                      {errors.avatar}
                    </p>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => document.getElementById('avatar')?.click()}
                    className="mt-4 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600"
                  >
                    <ImageIcon className="h-4 w-4 mr-2" />
                    Change Avatar
                  </Button>
                </div>

                {/* Profile Form */}
                <div className="flex-1 space-y-6">
                  <div>
                    <Label className="text-sm font-medium text-gray-600 dark:text-gray-300">
                      Full Name *
                    </Label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full mt-2 px-4 py-3 rounded-xl border transition-all focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                      placeholder="Enter your full name"
                    />
                    {errors.fullName && (
                      <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                        <AlertCircle className="h-4 w-4" />
                        {errors.fullName}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          )}

          {/* Learning Section */}
          {activeSection === 'learning' && (
            <CardContent className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <Brain className="h-5 w-5 text-blue-500" />
                <h2 className="text-xl font-semibold">Learning Preferences</h2>
              </div>

              <div className="space-y-8">
                {/* Learning Style */}
                <div>
                  <Label className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    Primary Learning Style
                  </Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    {learningStyleOptions.map(({ value, label, description, icon: Icon }) => (
                      <button
                        key={value}
                        onClick={() => setLearningStyle(value as any)}
                        className={`p-4 rounded-xl border-2 transition-all text-left ${learningStyle === value
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 bg-white dark:bg-gray-800'
                          }`}
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <Icon className={`h-5 w-5 ${learningStyle === value ? 'text-blue-500' : 'text-gray-600 dark:text-gray-300'}`} />
                          <span className="font-medium">{label}</span>
                          {learningStyle === value && <Check className="h-4 w-4 text-blue-500 ml-auto" />}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-300">{description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Explanation Style */}
                <div>
                  <Label className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    Explanation Style
                  </Label>
                  <div className="grid grid-cols-3 gap-3 mt-3">
                    {[
                      { value: 'simple', label: 'Simple', desc: 'Brief and to the point' },
                      { value: 'detailed', label: 'Detailed', desc: 'Thorough explanations' },
                      { value: 'comprehensive', label: 'Comprehensive', desc: 'In-depth analysis' }
                    ].map(({ value, label, desc }) => (
                      <button
                        key={value}
                        onClick={() => setExplanationStyle(value as any)}
                        className={`p-4 rounded-xl border-2 transition-all ${explanationStyle === value
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 bg-white dark:bg-gray-800'
                          }`}
                      >
                        <div className="font-medium mb-1">{label}</div>
                        <div className="text-xs text-gray-600 dark:text-gray-300">{desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Difficulty Level */}
                <div>
                  <Label className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    Difficulty Level
                  </Label>
                  <div className="grid grid-cols-3 gap-3 mt-3">
                    {[
                      { value: 'beginner', label: 'Beginner', desc: 'Basic concepts' },
                      { value: 'intermediate', label: 'Intermediate', desc: 'Moderate complexity' },
                      { value: 'advanced', label: 'Advanced', desc: 'Technical details' }
                    ].map(({ value, label, desc }) => (
                      <button
                        key={value}
                        onClick={() => setDifficulty(value as any)}
                        className={`p-4 rounded-xl border-2 transition-all ${difficulty === value
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 bg-white dark:bg-gray-800'
                          }`}
                      >
                        <div className="font-medium mb-1">{label}</div>
                        <div className="text-xs text-gray-600 dark:text-gray-300">{desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Examples Toggle */}
                <div className="p-4 rounded-xl border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium mb-1">Include Examples</div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">
                        Add practical examples and analogies to explanations
                      </div>
                    </div>
                    <Switch
                      checked={includeExamples}
                      onCheckedChange={setIncludeExamples}
                      className="bg-gray-600 data-[state=checked]:bg-blue-500"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          )}

          {/* Goals Section */}
          {activeSection === 'goals' && (
            <LearningGoals userId={profile.id} />
          )}
          {/* Achievements Section */}
          {activeSection === 'achievements' && (
            <CardContent className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <Trophy className="h-5 w-5 text-blue-500" />
                <h2 className="text-xl font-semibold">Achievements</h2>
              </div>

              {/* Stats Overview */}
              {stats ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                  <div className="text-center p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20">
                    <div className="text-2xl font-bold text-blue-600">{stats.level || 1}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">Level</div>
                  </div>
                  <div className="text-center p-4 rounded-xl bg-green-50 dark:bg-green-900/20">
                    <div className="text-2xl font-bold text-green-600">{stats.total_xp || 0}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">Total XP</div>
                  </div>
                  <div className="text-center p-4 rounded-xl bg-orange-50 dark:bg-orange-900/20">
                    <div className="text-2xl font-bold text-orange-600">{stats.current_streak || 0}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">Day Streak</div>
                  </div>
                  <div className="text-center p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20">
                    <div className="text-2xl font-bold text-blue-600">{achievements.length || 0}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">Badges</div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500">
                  <p>Stats will appear here as you start using the app.</p>
                </div>
              )}

              {/* Badges Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {achievements.map((achievement) => (
                  <div key={achievement.id} className="text-center p-4 rounded-xl border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                    <div className="w-16 h-16 mx-auto mb-2 bg-yellow-100 rounded-full flex items-center justify-center text-2xl">
                      {achievement.badges?.icon || '🏆'}
                    </div>
                    <div className="font-medium text-sm mb-1">{achievement.badges?.name}</div>
                    <div className="text-xs text-gray-600 dark:text-gray-300 mb-2">
                      {achievement.badges?.description}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(achievement.earned_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}

                {achievements.length === 0 && (
                  <div className="col-span-full text-center py-8 text-gray-500">
                    <Trophy className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No achievements yet. Keep learning to earn badges!</p>
                  </div>
                )}
              </div>
            </CardContent>
          )}

          {/* Study Preferences Section */}
          {activeSection === 'study' && (
            <CardContent className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <Clock className="h-5 w-5 text-blue-500" />
                <h2 className="text-xl font-semibold">Study Preferences</h2>
              </div>

              <div className="space-y-6">
                {/* Preferred Study Times */}
                <div>
                  <Label className="text-sm font-medium">Preferred Study Times</Label>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    {timeSlots.map((time) => (
                      <button
                        key={time}
                        onClick={() => toggleStudyTime(time)}
                        className={`p-3 rounded-xl border-2 transition-all ${preferredStudyTimes.includes(time)
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 bg-white dark:bg-gray-800'
                          }`}
                      >
                        {time}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Break Interval */}
                <div>
                  <Label className="text-sm font-medium">
                    Break Interval: {breakInterval} minutes
                  </Label>
                  <input
                    type="range"
                    min="15"
                    max="90"
                    step="15"
                    value={breakInterval}
                    onChange={(e) => setBreakInterval(Number(e.target.value))}
                    className="w-full mt-2"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>15min</span>
                    <span>45min</span>
                    <span>90min</span>
                  </div>
                </div>

                {/* Study Reminders */}
                <div className="flex items-center justify-between p-4 rounded-xl border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                  <div>
                    <div className="font-medium mb-1">Study Reminders</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">
                      Get notifications for your study sessions
                    </div>
                  </div>
                  <Switch
                    checked={studyReminders}
                    onCheckedChange={setStudyReminders}
                  />
                </div>

                <Button onClick={saveStudyPreferences} className="w-full">
                  Save Study Preferences
                </Button>
              </div>
            </CardContent>
          )}

          {/* Privacy Section */}
          {activeSection === 'privacy' && (
            <CardContent className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <Shield className="h-5 w-5 text-blue-500" />
                <h2 className="text-xl font-semibold">Data & Privacy</h2>
              </div>

              <div className="space-y-6">
                {/* Privacy Toggles */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-xl border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                    <div>
                      <div className="font-medium mb-1">Data Collection</div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">
                        Help improve StuddyHub by sharing usage data
                      </div>
                    </div>
                    <Switch
                      checked={dataCollection}
                      onCheckedChange={setDataCollection}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-xl border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                    <div>
                      <div className="font-medium mb-1">Analytics</div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">
                        Track learning progress and insights
                      </div>
                    </div>
                    <Switch
                      checked={analytics}
                      onCheckedChange={setAnalytics}
                    />
                  </div>
                </div>

                {/* Data Actions */}
                <div className="space-y-3">
                  <Button
                    onClick={exportData}
                    variant="outline"
                    className="w-full justify-start"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export My Data
                  </Button>

                  <Button
                    onClick={deleteAccount}
                    variant="outline"
                    className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Account
                  </Button>
                </div>
              </div>
            </CardContent>
          )}

          {/* Security Section */}
          {activeSection === 'security' && (
            <CardContent className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <Lock className="h-5 w-5 text-blue-500" />
                <h2 className="text-xl font-semibold">Security Settings</h2>
              </div>

              <div className="space-y-6 max-w-md">
                <div>
                  <Label className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    Current Password
                  </Label>
                  <div className="relative mt-2">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border pr-12 transition-all focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                      placeholder="Enter current password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-600 dark:text-gray-300"
                    >
                      {showCurrentPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    New Password
                  </Label>
                  <div className="relative mt-2">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border pr-12 transition-all focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                      placeholder="Enter new password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-600 dark:text-gray-300"
                    >
                      {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  {errors.newPassword && (
                    <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                      <AlertCircle className="h-4 w-4" />
                      {errors.newPassword}
                    </p>
                  )}
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    Confirm New Password
                  </Label>
                  <div className="relative mt-2">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border pr-12 transition-all focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                      placeholder="Confirm new password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-600 dark:text-gray-300"
                    >
                      {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  {errors.confirmPassword && (
                    <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                      <AlertCircle className="h-4 w-4" />
                      {errors.confirmPassword}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          )}

          {/* Save Button (only show for profile, learning, and security sections) */}
          {(activeSection === 'profile' || activeSection === 'learning' || activeSection === 'security') && (
            <CardContent className="px-8 pb-8">
              <div className="flex items-center gap-4">
                <Button
                  onClick={handleSave}
                  disabled={isLoading}
                  className="px-8 py-3 font-medium transition-all focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isLoading ? (
                    <>
                      <Settings className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>

                {saveSuccess && (
                  <div className="flex items-center gap-2 text-green-500 animate-pulse">
                    <Check className="h-5 w-5" />
                    <span className="font-medium">Changes saved successfully!</span>
                  </div>
                )}
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
};