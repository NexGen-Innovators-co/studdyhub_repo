import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  BookOpen,
  Brain,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  Hand,
  Mic,
  Rocket,
  Sparkles,
  Upload,
  User,
  Volume2,
  Bell,
  ArrowRight,
  School,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  requestNotificationPermission,
} from '@/services/notificationInitService';
import { UserProfile } from '@/types/Document';
import { EducationContextStep, type EducationStepData } from './steps/EducationContextStep';
import { EducatorRoleStep } from '@/components/educator/onboarding/EducatorRoleStep';
import { CreateInstitutionFlow } from '@/components/educator/onboarding/CreateInstitutionFlow';
import { JoinInstitutionFlow } from '@/components/educator/onboarding/JoinInstitutionFlow';
import { IndependentTutorSetup } from '@/components/educator/onboarding/IndependentTutorSetup';
import type { UserRole } from '@/types/Education';

// ─── Types ────────────────────────────────────────────────────
interface OnboardingWizardProps {
  userProfile: UserProfile | null;
  onComplete: (updatedProfile?: UserProfile) => void;
  userId: string;
}

type Step = 'welcome' | 'education' | 'role' | 'profile' | 'learning' | 'personalization' | 'permissions';
const STEPS: Step[] = ['welcome', 'education', 'role', 'profile', 'learning', 'personalization', 'permissions'];

const ONBOARDING_KEY = 'studdyhub_onboarding_completed_v2';

// ─── Quick-pick AI Context Cards ───────────────────────────────
const AI_CONTEXT_CARDS: { label: string; snippet: string }[] = [
  { label: '🎓 University student', snippet: "I'm a university student" },
  { label: '🏫 High school student', snippet: "I'm a high school student" },
  { label: '📊 Visual learner', snippet: 'I learn best with diagrams, charts, and visual aids' },
  { label: '📝 Bullet points please', snippet: 'I prefer responses in bullet points rather than long paragraphs' },
  { label: '🧑‍💻 Tech / CS focus', snippet: "I'm studying technology / computer science" },
  { label: '🔬 Science focus', snippet: "I'm studying science subjects" },
  { label: '📖 Arts / humanities', snippet: "I'm studying arts and humanities" },
  { label: '💼 Business / economics', snippet: "I'm studying business or economics" },
  { label: '🌅 Morning studier', snippet: 'I study best in the morning' },
  { label: '🌙 Night owl', snippet: 'I study best at night' },
  { label: '⏱ Short sessions', snippet: 'I prefer short, focused study sessions (25-30 min)' },
  { label: '📚 Long deep-dives', snippet: 'I prefer long, deep study sessions' },
];

// ─── Learning Style Options (mirrored from UserSettings) ───────
const LEARNING_STYLES = [
  { value: 'visual', label: 'Visual', description: 'Diagrams, charts, and visual aids', icon: Eye },
  { value: 'auditory', label: 'Auditory', description: 'Verbal explanations and discussions', icon: Volume2 },
  { value: 'kinesthetic', label: 'Kinesthetic', description: 'Hands-on and practical examples', icon: Hand },
  { value: 'reading', label: 'Reading/Writing', description: 'Text-based learning', icon: FileText },
] as const;

const DIFFICULTY_OPTIONS = [
  { value: 'beginner', label: 'Beginner', desc: 'Basic concepts' },
  { value: 'intermediate', label: 'Intermediate', desc: 'Moderate complexity' },
  { value: 'advanced', label: 'Advanced', desc: 'Technical details' },
] as const;

const EXPLANATION_OPTIONS = [
  { value: 'simple', label: 'Simple', desc: 'Brief and to the point' },
  { value: 'detailed', label: 'Detailed', desc: 'Thorough explanations' },
  { value: 'comprehensive', label: 'Comprehensive', desc: 'In-depth analysis' },
] as const;

// ─── Animation Variants ────────────────────────────────────────
const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -300 : 300,
    opacity: 0,
  }),
};

// ─── Component ─────────────────────────────────────────────────
export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  userProfile,
  onComplete,
  userId,
}) => {
  const [currentStep, setCurrentStep] = useState<Step>('welcome');
  const [direction, setDirection] = useState(1);
  const [isSaving, setIsSaving] = useState(false);

  // Education step state
  const [educationData, setEducationData] = useState<EducationStepData>({
    countryId: null,
    countryCode: null,
    educationLevelId: null,
    curriculumId: null,
    examinationId: null,
    selectedSubjectIds: [],
    institutionName: userProfile?.school || '',
    yearOrGrade: '',
  });

  // Profile step state
  const [fullName, setFullName] = useState(userProfile?.full_name || '');
  const [school, setSchool] = useState(userProfile?.school || '');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Learning step state
  const [learningStyle, setLearningStyle] = useState<string>(
    userProfile?.learning_style || 'visual'
  );
  const [difficulty, setDifficulty] = useState<string>(
    userProfile?.learning_preferences?.difficulty || 'intermediate'
  );
  const [explanationStyle, setExplanationStyle] = useState<string>(
    userProfile?.learning_preferences?.explanation_style || 'detailed'
  );

  // Role step state
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(
    (userProfile?.user_role as UserRole) || null
  );
  const [showEducatorSubFlow, setShowEducatorSubFlow] = useState<
    'create_institution' | 'join_institution' | 'independent_setup' | null
  >(null);

  // AI personalization state
  const [selectedContextCards, setSelectedContextCards] = useState<Set<number>>(new Set());
  const [customContext, setCustomContext] = useState('');

  // Permissions state
  const [wantNotifications, setWantNotifications] = useState(true);
  const [wantMicrophone, setWantMicrophone] = useState(true);
  const [wantCamera, setWantCamera] = useState(false);

  const currentIndex = STEPS.indexOf(currentStep);
  const isFirstStep = currentIndex === 0;
  const isLastStep = currentIndex === STEPS.length - 1;

  // ─── Navigation ─────────────────────────────────────────────
  const goNext = () => {
    if (currentIndex < STEPS.length - 1) {
      setDirection(1);
      setCurrentStep(STEPS[currentIndex + 1]);
    }
  };

  const goBack = () => {
    if (currentIndex > 0) {
      setDirection(-1);
      setCurrentStep(STEPS[currentIndex - 1]);
    }
  };

  const skipAll = () => {
    markComplete();
    onComplete();
  };

  const markComplete = async () => {
    try {
      localStorage.setItem(ONBOARDING_KEY, '1');
    } catch {
      // ignore localStorage errors
    }
    // Also persist to DB so it survives sign-out / new device
    try {
      await supabase
        .from('profiles')
        .update({ onboarding_completed: true })
        .eq('id', userId);
    } catch {
      // Non-blocking — localStorage is primary fallback
    }
  };

  // ─── Avatar handling ─────────────────────────────────────────
  const handleAvatarSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB.');
      return;
    }
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  // ─── AI context helpers ──────────────────────────────────────
  const toggleContextCard = (index: number) => {
    setSelectedContextCards((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const buildPersonalContext = (): string => {
    const snippets = Array.from(selectedContextCards).map(
      (i) => AI_CONTEXT_CARDS[i].snippet
    );
    const combined = [...snippets];
    if (customContext.trim()) combined.push(customContext.trim());
    return combined.join('\n').slice(0, 2000);
  };

  // ─── Save & finish ──────────────────────────────────────────
  const handleFinish = async () => {
    setIsSaving(true);

    try {
      // 1. Upload avatar if selected
      let avatarUrl = userProfile?.avatar_url || null;
      if (avatarFile) {
        const ext = avatarFile.name.split('.').pop();
        const fileName = `${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(`public/${userId}/${fileName}`, avatarFile, {
            cacheControl: '3600',
            upsert: true,
          });
        if (!uploadError) {
          avatarUrl = supabase.storage
            .from('avatars')
            .getPublicUrl(`public/${userId}/${fileName}`).data.publicUrl;
        }
      }

      // 2. Build profile update
      const personalContext = buildPersonalContext();
      const chosenRole = selectedRole || 'student';
      const updatePayload: Record<string, unknown> = {
        full_name: fullName.trim() || userProfile?.full_name || null,
        school: school.trim() || userProfile?.school || null,
        avatar_url: avatarUrl,
        learning_style: learningStyle,
        learning_preferences: {
          explanation_style: explanationStyle,
          examples: true,
          difficulty,
        },
        user_role: chosenRole,
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
      };

      // Only set personal_context if user actually picked something
      if (personalContext) {
        updatePayload.personal_context = personalContext;
      }

      const { data, error } = await supabase
        .from('profiles')
        .update(updatePayload)
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;

      // 3. Request permissions (grant & immediately release media streams)
      if (wantNotifications) {
        try {
          await requestNotificationPermission();
        } catch {
          // silently ignore
        }
      }
      if (wantMicrophone) {
        try {
          if (navigator.mediaDevices?.getUserMedia) {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach((t) => t.stop());
          }
        } catch {
          // silently ignore
        }
      }
      if (wantCamera) {
        try {
          if (navigator.mediaDevices?.getUserMedia) {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            stream.getTracks().forEach((t) => t.stop());
          }
        } catch {
          // silently ignore
        }
      }

      // 4. Save education context (if user filled it in)
      if (educationData.countryId) {
        try {
          // Upsert education profile
          const { data: eduProfile, error: eduErr } = await supabase
            .from('user_education_profiles')
            .upsert({
              user_id: userId,
              country_id: educationData.countryId,
              education_level_id: educationData.educationLevelId,
              curriculum_id: educationData.curriculumId,
              target_examination_id: educationData.examinationId,
              institution_name: educationData.institutionName.trim() || null,
              year_or_grade: educationData.yearOrGrade.trim() || null,
            }, { onConflict: 'user_id' })
            .select('id')
            .single();

          if (!eduErr && eduProfile && educationData.selectedSubjectIds.length > 0) {
            // Delete existing user_subjects then insert new ones
            await supabase
              .from('user_subjects')
              .delete()
              .eq('user_education_profile_id', eduProfile.id);

            await supabase
              .from('user_subjects')
              .insert(
                educationData.selectedSubjectIds.map((subjectId) => ({
                  user_education_profile_id: eduProfile.id,
                  subject_id: subjectId,
                }))
              );
          }
        } catch {
          // Education data save is non-blocking — user can fix later in Settings
        }
      }

      // Also sync school field from education step if not already filled
      if (!school.trim() && educationData.institutionName.trim()) {
        // Already saved via profile update above, but update local too
        await supabase
          .from('profiles')
          .update({ school: educationData.institutionName.trim() })
          .eq('id', userId);
      }

      // 5. Mark complete & notify parent
      markComplete();
      const updatedProfile: UserProfile = {
        ...userProfile,
        ...data,
        learning_style: data.learning_style,
        learning_preferences: data.learning_preferences,
      } as UserProfile;
      onComplete(updatedProfile);
      toast.success('Welcome to StuddyHub! 🎉');
    } catch (err) {
      console.error('Onboarding save error:', err);
      toast.error('Failed to save — you can update later in Settings.');
      markComplete();
      onComplete();
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Step Content Renderers ──────────────────────────────────
  const renderWelcome = () => (
    <div className="flex flex-col items-center text-center px-4">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
        className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center mb-6 shadow-xl"
      >
        <img
          src="/siteimage.png"
          alt="StuddyHub logo"
          className="w-12 h-12 sm:w-14 sm:h-14 object-contain"
        />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent mb-3"
      >
        Welcome to StuddyHub!
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-gray-600 dark:text-gray-400 text-lg max-w-md mb-8"
      >
        Let's set up your learning experience in under 2 minutes.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="grid grid-cols-2 gap-3 w-full max-w-sm"
      >
        {[
          { icon: Brain, label: 'AI-Powered Notes' },
          { icon: BookOpen, label: 'Smart Quizzes' },
          { icon: Mic, label: 'Voice Recordings' },
          { icon: Sparkles, label: 'AI Chat Tutor' },
        ].map(({ icon: Icon, label }) => (
          <div
            key={label}
            className="flex items-center gap-2 p-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
          >
            <Icon className="w-5 h-5 text-blue-500 flex-shrink-0" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {label}
            </span>
          </div>
        ))}
      </motion.div>
    </div>
  );

  const renderProfile = () => (
    <div className="px-4 max-w-md mx-auto w-full">
      <div className="flex items-center gap-3 mb-6">
        <User className="h-5 w-5 text-blue-500" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Set Up Your Profile
        </h2>
      </div>

      {/* Avatar */}
      <div className="flex flex-col items-center mb-6">
        <button
          type="button"
          onClick={() => avatarInputRef.current?.click()}
          className="relative group w-24 h-24 rounded-full overflow-hidden border-4 border-blue-500 bg-gradient-to-br from-blue-400 to-blue-600 transition-transform hover:scale-105"
        >
          {avatarPreview ? (
            <img
              src={avatarPreview}
              alt="Avatar"
              className="w-full h-full object-cover"
            />
          ) : userProfile?.avatar_url ? (
            <img
              src={userProfile.avatar_url}
              alt="Avatar"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white text-2xl font-bold">
              {fullName
                ? fullName
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2)
                : 'U'}
            </div>
          )}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Upload className="w-5 h-5 text-white" />
          </div>
        </button>
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/*"
          onChange={handleAvatarSelect}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => avatarInputRef.current?.click()}
          className="mt-2 text-sm text-blue-500 hover:text-blue-600 font-medium"
        >
          Upload photo
        </button>
      </div>

      <div className="space-y-4">
        {/* Full name */}
        <div>
          <label className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1 block">
            Full Name
          </label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Enter your full name"
            className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
          />
        </div>

        {/* School / institution */}
        <div>
          <label className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1 block">
            School / Institution
          </label>
          <div className="relative">
            <School className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={school}
              onChange={(e) => setSchool(e.target.value)}
              placeholder="e.g. University of Ghana"
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderLearning = () => (
    <div className="px-4 max-w-lg mx-auto w-full">
      <div className="flex items-center gap-3 mb-6">
        <Brain className="h-5 w-5 text-blue-500" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          How Do You Learn Best?
        </h2>
      </div>

      <div className="space-y-6">
        {/* Learning Style */}
        <div>
          <label className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-3 block">
            Learning Style
          </label>
          <div className="grid grid-cols-2 gap-3">
            {LEARNING_STYLES.map(({ value, label, description, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setLearningStyle(value)}
                className={`p-3 rounded-xl border-2 transition-all text-left ${
                  learningStyle === value
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 bg-white dark:bg-gray-800'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon
                    className={`h-4 w-4 ${
                      learningStyle === value
                        ? 'text-blue-500'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  />
                  <span className="font-medium text-sm">{label}</span>
                  {learningStyle === value && (
                    <Check className="h-4 w-4 text-blue-500 ml-auto" />
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Difficulty */}
        <div>
          <label className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-3 block">
            Content Difficulty
          </label>
          <div className="grid grid-cols-3 gap-2">
            {DIFFICULTY_OPTIONS.map(({ value, label, desc }) => (
              <button
                key={value}
                onClick={() => setDifficulty(value)}
                className={`p-3 rounded-xl border-2 transition-all ${
                  difficulty === value
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 bg-white dark:bg-gray-800'
                }`}
              >
                <div className="font-medium text-sm mb-0.5">{label}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Explanation Style */}
        <div>
          <label className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-3 block">
            Explanation Style
          </label>
          <div className="grid grid-cols-3 gap-2">
            {EXPLANATION_OPTIONS.map(({ value, label, desc }) => (
              <button
                key={value}
                onClick={() => setExplanationStyle(value)}
                className={`p-3 rounded-xl border-2 transition-all ${
                  explanationStyle === value
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 bg-white dark:bg-gray-800'
                }`}
              >
                <div className="font-medium text-sm mb-0.5">{label}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{desc}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderPersonalization = () => (
    <div className="px-4 max-w-lg mx-auto w-full">
      <div className="flex items-center gap-3 mb-2">
        <Sparkles className="h-5 w-5 text-purple-500" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Personalize Your AI
        </h2>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
        Pick what describes you — the AI will tailor responses to match.
      </p>

      {/* Quick-pick cards */}
      <div className="grid grid-cols-2 gap-2 mb-5">
        {AI_CONTEXT_CARDS.map((card, index) => {
          const isSelected = selectedContextCards.has(index);
          return (
            <button
              key={index}
              onClick={() => toggleContextCard(index)}
              className={`p-2.5 rounded-xl border-2 text-left text-sm transition-all ${
                isSelected
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 bg-white dark:bg-gray-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <span>{card.label}</span>
                {isSelected && <Check className="h-3.5 w-3.5 text-purple-500 ml-auto flex-shrink-0" />}
              </div>
            </button>
          );
        })}
      </div>

      {/* Optional free-text */}
      <div>
        <label className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1 block">
          Anything else? <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <textarea
          value={customContext}
          onChange={(e) => setCustomContext(e.target.value.slice(0, 500))}
          rows={3}
          placeholder="e.g. I'm preparing for my final exams in biochemistry..."
          className="w-full p-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 resize-none focus:ring-2 focus:ring-purple-500 focus:outline-none text-sm"
        />
        <div className="text-xs text-gray-400 text-right mt-1">
          {customContext.length}/500
        </div>
      </div>
    </div>
  );

  const renderPermissions = () => (
    <div className="px-4 max-w-md mx-auto w-full">
      <div className="flex items-center gap-3 mb-2">
        <Rocket className="h-5 w-5 text-green-500" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Almost There!
        </h2>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Enable permissions for the best experience. You can change these later in Settings.
      </p>

      <div className="space-y-4">
        {/* Notifications */}
        <div className="flex items-center justify-between p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Bell className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <div className="font-medium text-sm">Push Notifications</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Reminders, social updates, quiz alerts
              </div>
            </div>
          </div>
          <Switch
            checked={wantNotifications}
            onCheckedChange={setWantNotifications}
            className="data-[state=checked]:bg-blue-500"
          />
        </div>

        {/* Microphone */}
        <div className="flex items-center justify-between p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
              <Mic className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <div className="font-medium text-sm">Microphone</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Voice recordings & live sessions
              </div>
            </div>
          </div>
          <Switch
            checked={wantMicrophone}
            onCheckedChange={setWantMicrophone}
            className="data-[state=checked]:bg-orange-500"
          />
        </div>

        {/* Camera */}
        <div className="flex items-center justify-between p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <Camera className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <div className="font-medium text-sm">Camera</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Profile photos & live sessions
              </div>
            </div>
          </div>
          <Switch
            checked={wantCamera}
            onCheckedChange={setWantCamera}
            className="data-[state=checked]:bg-purple-500"
          />
        </div>
      </div>
    </div>
  );

  const renderEducation = () => (
    <EducationContextStep data={educationData} onChange={setEducationData} />
  );

  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role);
    // Auto-trigger sub-flow for educator roles
    if (role === 'school_admin') {
      setShowEducatorSubFlow('create_institution');
    } else if (role === 'tutor_affiliated') {
      setShowEducatorSubFlow('join_institution');
    } else if (role === 'tutor_independent') {
      setShowEducatorSubFlow('independent_setup');
    } else {
      setShowEducatorSubFlow(null);
    }
  };

  const handleEducatorSubFlowComplete = () => {
    setShowEducatorSubFlow(null);
    goNext();
  };

  const handleEducatorSubFlowSkip = () => {
    setShowEducatorSubFlow(null);
  };

  const renderRole = () => {
    // If an educator sub-flow is active, show it
    if (showEducatorSubFlow === 'create_institution') {
      return (
        <CreateInstitutionFlow
          onComplete={handleEducatorSubFlowComplete}
          onSkip={handleEducatorSubFlowSkip}
        />
      );
    }
    if (showEducatorSubFlow === 'join_institution') {
      return (
        <JoinInstitutionFlow
          onComplete={handleEducatorSubFlowComplete}
          onSkip={handleEducatorSubFlowSkip}
        />
      );
    }
    if (showEducatorSubFlow === 'independent_setup') {
      return (
        <IndependentTutorSetup
          onComplete={() => handleEducatorSubFlowComplete()}
          onSkip={handleEducatorSubFlowSkip}
        />
      );
    }

    // Default: show role selection
    return (
      <div className="space-y-4">
        <EducatorRoleStep
          selectedRole={selectedRole}
          onRoleSelect={handleRoleSelect}
        />
        <p className="text-center text-xs text-gray-400 mt-2">
          Not an educator? Just skip this step — you&apos;re set as a student by default.
        </p>
      </div>
    );
  };

  const renderStep = () => {
    switch (currentStep) {
      case 'welcome':
        return renderWelcome();
      case 'education':
        return renderEducation();
      case 'role':
        return renderRole();
      case 'profile':
        return renderProfile();
      case 'learning':
        return renderLearning();
      case 'personalization':
        return renderPersonalization();
      case 'permissions':
        return renderPermissions();
    }
  };

  // ─── Render ──────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[60] bg-white dark:bg-gray-900 flex flex-col overflow-hidden">
      {/* Progress bar */}
      <div className="w-full px-6 pt-5 pb-2">
        <div className="flex items-center justify-between mb-3 max-w-lg mx-auto">
          <span className="text-xs font-medium text-gray-400 dark:text-gray-500">
            Step {currentIndex + 1} of {STEPS.length}
          </span>
          <button
            onClick={skipAll}
            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            Skip for now
          </button>
        </div>
        <div className="flex gap-1.5 max-w-lg mx-auto">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                i <= currentIndex
                  ? 'bg-blue-500'
                  : 'bg-gray-200 dark:bg-gray-700'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 flex items-center justify-center overflow-y-auto py-6">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentStep}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="w-full max-w-xl"
          >
            {renderStep()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer navigation */}
      <div className="px-6 pb-6 pt-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          {/* Back button */}
          {!isFirstStep ? (
            <Button
              variant="ghost"
              onClick={goBack}
              className="gap-1.5 text-gray-600 dark:text-gray-400"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </Button>
          ) : (
            <div /> // spacer
          )}

          {/* Next / Finish */}
          {isLastStep ? (
            <Button
              onClick={handleFinish}
              disabled={isSaving}
              className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6"
            >
              {isSaving ? (
                'Setting up...'
              ) : (
                <>
                  Start Learning
                  <Rocket className="w-4 h-4" />
                </>
              )}
            </Button>
          ) : currentStep === 'welcome' ? (
            <Button
              onClick={goNext}
              className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6"
            >
              Get Started
              <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              onClick={goNext}
              className="gap-1.5"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Step-level skip hint */}
        {!isFirstStep && !isLastStep && (
          <div className="text-center mt-2">
            <button
              onClick={goNext}
              className="text-xs text-gray-400 hover:text-gray-500 underline-offset-2 hover:underline transition-colors"
            >
              Skip this step
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Check whether onboarding has been completed.
 * Checks localStorage first (fast), falls back to userProfile DB flag.
 */
export const isOnboardingComplete = (userProfile?: UserProfile | null): boolean => {
  try {
    // Fast path: localStorage check
    if (localStorage.getItem(ONBOARDING_KEY) === '1') return true;
  } catch {
    // localStorage unavailable
  }

  // DB-backed check: if profile says completed, sync to localStorage
  if (userProfile?.onboarding_completed) {
    try {
      localStorage.setItem(ONBOARDING_KEY, '1');
    } catch {
      // ignore
    }
    return true;
  }

  return false;
};

export default OnboardingWizard;
