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
  FileText
} from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { supabase } from '../integrations/supabase/client';
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
  // You can integrate this with your global theme context or pass isDarkMode as a prop
  const [isDarkMode, setIsDarkMode] = useState(true);

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
  const [activeSection, setActiveSection] = useState<'profile' | 'learning' | 'security'>('profile');

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
      console.error('Error saving preferences:', error);
      toast.error('Failed to save preferences or update password');
    } finally {
      setIsLoading(false);
    }
  };

  const learningStyleOptions = [
    { value: 'visual', label: 'Visual', description: 'Diagrams, charts, and visual aids', icon: Eye },
    { value: 'auditory', label: 'Auditory', description: 'Verbal explanations and discussions', icon: Volume2 },
    { value: 'kinesthetic', label: 'Kinesthetic', description: 'Hands-on and practical examples', icon: Hand },
    { value: 'reading', label: 'Reading/Writing', description: 'Text-based learning', icon: FileText },
  ];

  const themeClasses = {
    container: isDarkMode
      ? 'bg-gray-900 text-gray-100'
      : 'bg-gray-50 text-gray-900',
    card: isDarkMode
      ? 'bg-gray-800 border-gray-700'
      : 'bg-white border-gray-200',
    input: isDarkMode
      ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400 focus:border-blue-500'
      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-blue-500',
    button: isDarkMode
      ? 'bg-blue-600 hover:bg-blue-700 text-white'
      : 'bg-blue-600 hover:bg-blue-700 text-white',
    secondaryButton: isDarkMode
      ? 'bg-gray-700 hover:bg-gray-600 text-gray-300 border-gray-600'
      : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-300',
    text: isDarkMode ? 'text-gray-300' : 'text-gray-600',
    accent: 'text-blue-500'
  };

  return (
    <div className={`min-h-screen p-6 transition-colors duration-300 ${themeClasses.container}`}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-600 rounded-xl">
              <Settings className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Settings</h1>
              <p className={themeClasses.text}>Customize your learning experience</p>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className={`p-1 rounded-xl border mb-8 ${themeClasses.card}`}>
          <div className="flex">
            {[
              { id: 'profile', label: 'Profile', icon: User },
              { id: 'learning', label: 'Learning', icon: Brain },
              { id: 'security', label: 'Security', icon: Lock }
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveSection(id as any)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg transition-all ${activeSection === id
                  ? 'bg-blue-600 text-white shadow-lg'
                  : `${themeClasses.text} hover:bg-gray-100 dark:hover:bg-gray-700`
                  }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Content Sections */}
        <Card className={`rounded-2xl border shadow-lg ${themeClasses.card}`}>

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
                    <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-blue-500 bg-gradient-to-br from-blue-400 to-purple-500">
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
                    className={`mt-4 ${themeClasses.secondaryButton}`}
                  >
                    <ImageIcon className="h-4 w-4 mr-2" />
                    Change Avatar
                  </Button>
                </div>

                {/* Profile Form */}
                <div className="flex-1 space-y-6">
                  <div>
                    <Label className={`text-sm font-medium ${themeClasses.text}`}>
                      Full Name *
                    </Label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className={`w-full mt-2 px-4 py-3 rounded-xl border transition-all focus:ring-2 focus:ring-blue-500 focus:outline-none ${themeClasses.input}`}
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
                  <Label className={`text-sm font-medium ${themeClasses.text}`}>
                    Primary Learning Style
                  </Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    {learningStyleOptions.map(({ value, label, description, icon: Icon }) => (
                      <button
                        key={value}
                        onClick={() => setLearningStyle(value as any)}
                        className={`p-4 rounded-xl border-2 transition-all text-left ${learningStyle === value
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : `border-gray-200 dark:border-gray-600 hover:border-blue-300 ${themeClasses.card}`
                          }`}
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <Icon className={`h-5 w-5 ${learningStyle === value ? 'text-blue-500' : themeClasses.text}`} />
                          <span className="font-medium">{label}</span>
                          {learningStyle === value && <Check className="h-4 w-4 text-blue-500 ml-auto" />}
                        </div>
                        <p className={`text-sm ${themeClasses.text}`}>{description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Explanation Style */}
                <div>
                  <Label className={`text-sm font-medium ${themeClasses.text}`}>
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
                          : `border-gray-200 dark:border-gray-600 hover:border-blue-300 ${themeClasses.card}`
                          }`}
                      >
                        <div className="font-medium mb-1">{label}</div>
                        <div className={`text-xs ${themeClasses.text}`}>{desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Difficulty Level */}
                <div>
                  <Label className={`text-sm font-medium ${themeClasses.text}`}>
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
                          : `border-gray-200 dark:border-gray-600 hover:border-blue-300 ${themeClasses.card}`
                          }`}
                      >
                        <div className="font-medium mb-1">{label}</div>
                        <div className={`text-xs ${themeClasses.text}`}>{desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Examples Toggle */}
                <div className={`p-4 rounded-xl border ${themeClasses.card}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium mb-1">Include Examples</div>
                      <div className={`text-sm ${themeClasses.text}`}>
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

          {/* Security Section */}
          {activeSection === 'security' && (
            <CardContent className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <Lock className="h-5 w-5 text-blue-500" />
                <h2 className="text-xl font-semibold">Security Settings</h2>
              </div>

              <div className="space-y-6 max-w-md">
                <div>
                  <Label className={`text-sm font-medium ${themeClasses.text}`}>
                    Current Password
                  </Label>
                  <div className="relative mt-2">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className={`w-full px-4 py-3 rounded-xl border pr-12 transition-all focus:ring-2 focus:ring-blue-500 focus:outline-none ${themeClasses.input}`}
                      placeholder="Enter current password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className={`absolute right-3 top-1/2 transform -translate-y-1/2 ${themeClasses.text}`}
                    >
                      {showCurrentPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <Label className={`text-sm font-medium ${themeClasses.text}`}>
                    New Password
                  </Label>
                  <div className="relative mt-2">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className={`w-full px-4 py-3 rounded-xl border pr-12 transition-all focus:ring-2 focus:ring-blue-500 focus:outline-none ${themeClasses.input}`}
                      placeholder="Enter new password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className={`absolute right-3 top-1/2 transform -translate-y-1/2 ${themeClasses.text}`}
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
                  <Label className={`text-sm font-medium ${themeClasses.text}`}>
                    Confirm New Password
                  </Label>
                  <div className="relative mt-2">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`w-full px-4 py-3 rounded-xl border pr-12 transition-all focus:ring-2 focus:ring-blue-500 focus:outline-none ${themeClasses.input}`}
                      placeholder="Confirm new password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className={`absolute right-3 top-1/2 transform -translate-y-1/2 ${themeClasses.text}`}
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

          {/* Save Button */}
          <CardContent className="px-8 pb-8">
            <div className="flex items-center gap-4">
              <Button
                onClick={handleSave}
                disabled={isLoading}
                className={`px-8 py-3 font-medium transition-all focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${themeClasses.button}`}
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
        </Card>
      </div>
    </div>
  );
};