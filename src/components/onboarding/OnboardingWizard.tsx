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

type Step = 'welcome' | 'about' | 'learning' | 'finish';
const STEPS: Step[] = ['welcome', 'about', 'learning', 'finish'];

const ONBOARDING_KEY = 'studdyhub_onboarding_completed_v2';

// ─── Quick-pick AI Context Cards (non-redundant — education/subjects covered by step 2) ──
const AI_CONTEXT_CARDS: { label: string; snippet: string }[] = [
  { label: '📝 Bullet points please', snippet: 'I prefer responses in bullet points rather than long paragraphs' },
  { label: '🗣 Explain like I\'m 5', snippet: 'I prefer simple explanations with everyday analogies' },
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
    // Also persist to DB via SECURITY DEFINER RPC (avoids RLS recursion)
    try {
      await supabase.rpc('complete_onboarding', {});
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

      // 2. Build profile update via SECURITY DEFINER RPC (bypasses recursive RLS)
      const personalContext = buildPersonalContext();
      const chosenRole = selectedRole || 'student';
      const resolvedSchool = educationData.institutionName.trim() || school.trim() || userProfile?.school || null;

      const { data, error } = await supabase.rpc('complete_onboarding', {
        _full_name: fullName.trim() || userProfile?.full_name || null,
        _school: resolvedSchool,
        _avatar_url: avatarUrl,
        _learning_style: learningStyle,
        _learning_prefs: {
          explanation_style: explanationStyle,
          examples: true,
          difficulty,
        },
        _user_role: chosenRole,
        _personal_context: personalContext || null,
      });

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

      // 5. Mark complete & notify parent
      markComplete();
      // RPC returns the full profile row as JSON
      const profileData = data as Record<string, unknown> | null;
      const updatedProfile: UserProfile = {
        ...userProfile,
        ...(profileData || {}),
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

  // ─── Educator role helpers (kept from original) ────────────
  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role);
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

  // ─── Step 1 — Welcome + Role ────────────────────────────────
  const renderWelcome = () => {
    // If an educator sub-flow is active, render it full-screen
    if (showEducatorSubFlow === 'create_institution') {
      return <CreateInstitutionFlow onComplete={handleEducatorSubFlowComplete} onSkip={handleEducatorSubFlowSkip} />;
    }
    if (showEducatorSubFlow === 'join_institution') {
      return <JoinInstitutionFlow onComplete={handleEducatorSubFlowComplete} onSkip={handleEducatorSubFlowSkip} />;
    }
    if (showEducatorSubFlow === 'independent_setup') {
      return <IndependentTutorSetup onComplete={handleEducatorSubFlowComplete} onSkip={handleEducatorSubFlowSkip} />;
    }

    const isEducator = selectedRole && selectedRole !== 'student';

    return (
      <div className="flex flex-col items-center text-center px-4">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
          className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center mb-5 shadow-xl"
        >
          <img src="/siteimage.png" alt="StuddyHub logo" className="w-12 h-12 sm:w-14 sm:h-14 object-contain" />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent mb-2"
        >
          Welcome to StuddyHub!
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-gray-500 dark:text-gray-400 text-base max-w-sm mb-6"
        >
          Just 3 quick steps and you&apos;re ready to learn.
        </motion.p>

        {/* Feature pills */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="flex flex-wrap justify-center gap-2 mb-8 max-w-sm">
          {[
            { icon: Brain, label: 'AI Notes' },
            { icon: BookOpen, label: 'Quizzes' },
            { icon: Mic, label: 'Recordings' },
            { icon: Sparkles, label: 'AI Tutor' },
          ].map(({ icon: Icon, label }) => (
            <span key={label} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs font-medium">
              <Icon className="w-3.5 h-3.5" />
              {label}
            </span>
          ))}
        </motion.div>

        {/* Quick role selection */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="w-full max-w-sm">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">I&apos;m here as a…</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => { setSelectedRole('student'); setShowEducatorSubFlow(null); }}
              className={`p-3 rounded-xl border-2 transition-all text-left ${
                !isEducator
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 bg-white dark:bg-gray-800'
              }`}
            >
              <div className="flex items-center gap-2 mb-0.5">
                <User className="w-4 h-4 text-blue-500" />
                <span className="font-semibold text-sm">Student</span>
                {!isEducator && <Check className="w-4 h-4 text-blue-500 ml-auto" />}
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">Learn with AI tools</p>
            </button>
            <button
              onClick={() => setSelectedRole('tutor_independent')}
              className={`p-3 rounded-xl border-2 transition-all text-left ${
                isEducator
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 bg-white dark:bg-gray-800'
              }`}
            >
              <div className="flex items-center gap-2 mb-0.5">
                <School className="w-4 h-4 text-indigo-500" />
                <span className="font-semibold text-sm">Educator</span>
                {isEducator && <Check className="w-4 h-4 text-blue-500 ml-auto" />}
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">Teach & create courses</p>
            </button>
          </div>

          {/* Educator sub-role options (inline, only when educator is selected) */}
          {isEducator && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-3 space-y-2">
              <p className="text-xs text-gray-400 mb-1">Choose your educator type:</p>
              {[
                { role: 'school_admin' as UserRole, label: 'School Admin', desc: 'Manage an institution' },
                { role: 'tutor_affiliated' as UserRole, label: 'Affiliated Tutor', desc: 'Teach at a school' },
                { role: 'tutor_independent' as UserRole, label: 'Independent Tutor', desc: 'Teach on your own' },
              ].map(({ role, label, desc }) => (
                <button
                  key={role}
                  onClick={() => handleRoleSelect(role)}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-lg border text-left transition-all ${
                    selectedRole === role
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300 bg-white dark:bg-gray-800'
                  }`}
                >
                  <div>
                    <span className="font-medium text-sm text-gray-900 dark:text-gray-100">{label}</span>
                    <span className="text-xs text-gray-400 ml-2">{desc}</span>
                  </div>
                  {selectedRole === role && <Check className="w-4 h-4 text-indigo-500 ml-auto flex-shrink-0" />}
                </button>
              ))}
            </motion.div>
          )}
        </motion.div>
      </div>
    );
  };

  // ─── Step 2 — About You (Profile + Education) ───────────────
  const renderAbout = () => (
    <div className="px-4 max-w-lg mx-auto w-full">
      <div className="flex items-center gap-3 mb-5">
        <User className="h-5 w-5 text-blue-500" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          About You
        </h2>
      </div>

      {/* Compact profile row — avatar + name */}
      <div className="flex items-center gap-4 mb-6">
        <button
          type="button"
          onClick={() => avatarInputRef.current?.click()}
          className="relative group w-16 h-16 rounded-full overflow-hidden border-3 border-blue-500 bg-gradient-to-br from-blue-400 to-blue-600 flex-shrink-0 transition-transform hover:scale-105"
        >
          {avatarPreview ? (
            <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
          ) : userProfile?.avatar_url ? (
            <img src={userProfile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white text-lg font-bold">
              {fullName ? fullName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) : 'U'}
            </div>
          )}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Camera className="w-4 h-4 text-white" />
          </div>
        </button>
        <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarSelect} className="hidden" />
        <div className="flex-1">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Full Name</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Enter your full name"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
          />
        </div>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
        <span className="text-xs text-gray-400 font-medium">EDUCATION</span>
        <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
      </div>

      {/* Education context (already includes institution + year) */}
      <EducationContextStep data={educationData} onChange={setEducationData} compact />
    </div>
  );

  // ─── Step 3 — Learning Preferences + AI Quick-picks ─────────
  const renderLearning = () => (
    <div className="px-4 max-w-lg mx-auto w-full">
      <div className="flex items-center gap-3 mb-5">
        <Brain className="h-5 w-5 text-blue-500" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          How Do You Learn Best?
        </h2>
      </div>

      <div className="space-y-5">
        {/* Learning Style */}
        <div>
          <label className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2 block">
            Learning Style
          </label>
          <div className="grid grid-cols-2 gap-2">
            {LEARNING_STYLES.map(({ value, label, description, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setLearningStyle(value)}
                className={`p-2.5 rounded-xl border-2 transition-all text-left ${
                  learningStyle === value
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 bg-white dark:bg-gray-800'
                }`}
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <Icon className={`h-4 w-4 ${learningStyle === value ? 'text-blue-500' : 'text-gray-400'}`} />
                  <span className="font-medium text-sm">{label}</span>
                  {learningStyle === value && <Check className="h-3.5 w-3.5 text-blue-500 ml-auto" />}
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">{description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Difficulty + Explanation in a single row */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2 block">Difficulty</label>
            <div className="space-y-1.5">
              {DIFFICULTY_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setDifficulty(value)}
                  className={`w-full p-2 rounded-lg border text-sm text-left transition-all ${
                    difficulty === value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 font-medium'
                      : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 bg-white dark:bg-gray-800'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2 block">Detail Level</label>
            <div className="space-y-1.5">
              {EXPLANATION_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setExplanationStyle(value)}
                  className={`w-full p-2 rounded-lg border text-sm text-left transition-all ${
                    explanationStyle === value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 font-medium'
                      : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 bg-white dark:bg-gray-800'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* AI quick-pick tags */}
        <div>
          <label className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2 block">
            AI Preferences <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {AI_CONTEXT_CARDS.map((card, index) => {
              const isSelected = selectedContextCards.has(index);
              return (
                <button
                  key={index}
                  onClick={() => toggleContextCard(index)}
                  className={`px-3 py-1.5 rounded-full border text-xs transition-all ${
                    isSelected
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                      : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800'
                  }`}
                >
                  {card.label}
                  {isSelected && <Check className="inline w-3 h-3 ml-1" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );

  // ─── Step 4 — You're All Set! (Permissions + Launch) ────────
  const renderFinish = () => (
    <div className="px-4 max-w-md mx-auto w-full flex flex-col items-center">
      {/* Celebratory icon */}
      <motion.div
        initial={{ scale: 0, rotate: -30 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 14, delay: 0.1 }}
        className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center mb-4 shadow-lg"
      >
        <Rocket className="w-8 h-8 text-white" />
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-2xl font-bold text-gray-900 dark:text-white mb-1"
      >
        You&apos;re All Set!
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="text-sm text-gray-500 dark:text-gray-400 mb-6 text-center max-w-xs"
      >
        Enable these for the best experience — you can change them anytime in Settings.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="w-full space-y-3"
      >
        {[
          { icon: Bell, label: 'Notifications', desc: 'Reminders & quiz alerts', iconBoxClass: 'bg-blue-100 dark:bg-blue-900/30', iconClass: 'text-blue-500', checked: wantNotifications, onChange: setWantNotifications },
          { icon: Mic, label: 'Microphone', desc: 'Voice recordings', iconBoxClass: 'bg-orange-100 dark:bg-orange-900/30', iconClass: 'text-orange-500', checked: wantMicrophone, onChange: setWantMicrophone },
          { icon: Camera, label: 'Camera', desc: 'Photos & live sessions', iconBoxClass: 'bg-purple-100 dark:bg-purple-900/30', iconClass: 'text-purple-500', checked: wantCamera, onChange: setWantCamera },
        ].map(({ icon: Icon, label, desc, iconBoxClass, iconClass, checked, onChange: onToggle }) => (
          <div key={label} className="flex items-center justify-between p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${iconBoxClass}`}>
                <Icon className={`w-4 h-4 ${iconClass}`} />
              </div>
              <div>
                <div className="font-medium text-sm">{label}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{desc}</div>
              </div>
            </div>
            <Switch checked={checked} onCheckedChange={onToggle} />
          </div>
        ))}
      </motion.div>
    </div>
  );

  const renderStep = () => {
    switch (currentStep) {
      case 'welcome':
        return renderWelcome();
      case 'about':
        return renderAbout();
      case 'learning':
        return renderLearning();
      case 'finish':
        return renderFinish();
    }
  };

  // ─── Render ──────────────────────────────────────────────────
  const stepLabels = ['Welcome', 'About You', 'Learning', 'Ready!'];

  return (
    <div className="fixed inset-0 z-[60] bg-white dark:bg-gray-900 flex flex-col overflow-hidden">
      {/* Progress header — numbered dots with labels */}
      <div className="w-full px-6 pt-5 pb-2">
        <div className="flex items-center justify-between mb-2 max-w-lg mx-auto">
          <div className="flex items-center gap-2">
            {STEPS.map((_, i) => (
              <React.Fragment key={i}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                  i < currentIndex
                    ? 'bg-blue-500 text-white'
                    : i === currentIndex
                    ? 'bg-blue-500 text-white ring-4 ring-blue-100 dark:ring-blue-900/40'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-400'
                }`}>
                  {i < currentIndex ? <Check className="w-3.5 h-3.5" /> : i + 1}
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`w-8 h-0.5 rounded-full transition-all duration-300 ${
                    i < currentIndex ? 'bg-blue-500' : 'bg-gray-200 dark:bg-gray-700'
                  }`} />
                )}
              </React.Fragment>
            ))}
          </div>
          <button
            onClick={skipAll}
            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            Skip
          </button>
        </div>
        <p className="text-xs text-center text-gray-400 dark:text-gray-500 font-medium">
          {stepLabels[currentIndex]}
        </p>
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
