import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCourseEnrollment } from '@/hooks/useCourseEnrollment';
import { useCourseResources, ResourceType } from '@/hooks/useCourseResources';
import { useCourseProgress } from '@/hooks/useCourseProgress';
import { Course } from '@/hooks/useCourseLibrary';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import ModernPremiumLoader from '@/components/ui/ModernPremiumLoader';
import {
  ArrowLeft,
  BookOpen,
  BrainCircuit,
  FileText,
  Headphones,
  Loader2,
  MessageSquare,
  NotebookPen,
  Calendar,
  Users,
  CheckCircle2,
  Circle,
  GraduationCap,
  Trophy,
  Play,
  ExternalLink,
  Sparkles,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { GenerateCourseResourcesDialog } from '@/components/courseLibrary/GenerateCourseResourcesDialog';

// ── Progress Ring Component ─────────────────────────────────
const ProgressRing: React.FC<{ percent: number; size?: number }> = ({ percent, size = 80 }) => {
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted-foreground/20"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="text-blue-500 transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold">{percent}%</span>
      </div>
    </div>
  );
};

// ── Main CourseDashboard Component ──────────────────────────
interface CourseDashboardProps {
  /** When provided, used instead of useParams */
  courseId?: string;
  /** When provided, used instead of fetching from DB */
  course?: Course;
  /** When provided, used instead of navigate('/library') */
  onBack?: () => void;
  /** Whether this is rendered inline (not as a full page) */
  inline?: boolean;
}

const CourseDashboard: React.FC<CourseDashboardProps> = (props) => {
  const params = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const courseId = props.courseId ?? params.courseId;
  const handleBack = props.onBack ?? (() => navigate('/library'));
  const isInline = props.inline ?? false;
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isAdmin } = useFeatureAccess();
  const { useEnrollment, useEnrollmentCount, useUpdateLastAccessed } = useCourseEnrollment();
  const { useResources, useResourcesByType, useResourceCounts } = useCourseResources();
  const { useProgress } = useCourseProgress();

  // AI Generation dialog state
  const [showAIGenerate, setShowAIGenerate] = useState(false);

  // ── Data fetching ──────────────────────────────────────
  const { data: fetchedCourse, isLoading: courseLoading } = useQuery({
    queryKey: ['course', courseId],
    queryFn: async () => {
      if (!courseId) return null;
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .single();
      if (error) throw error;
      return data as Course;
    },
    enabled: !!courseId && !props.course,
  });

  const course = props.course ?? fetchedCourse;

  const { data: enrollment, isLoading: enrollmentLoading } = useEnrollment(courseId ?? null);
  const { data: enrollmentCount } = useEnrollmentCount(courseId ?? null);
  const { data: allResources } = useResources(courseId ?? null);
  const { data: resourceCounts } = useResourceCounts(courseId ?? null);
  const { data: progress } = useProgress(enrollment?.id ?? null);

  const updateLastAccessed = useUpdateLastAccessed();

  // ── Update last accessed on mount ─────────────────────
  useEffect(() => {
    if (enrollment?.id) {
      updateLastAccessed.mutate(enrollment.id);
    }
  }, [enrollment?.id]);

  // ── Derived data ──────────────────────────────────────
  const completedResourceIds = useMemo(() => {
    return new Set(progress?.filter((p) => p.completed).map((p) => p.resource_id) ?? []);
  }, [progress]);

  const documentResources = allResources?.filter((r) => r.resource_type === 'document') ?? [];
  const quizResources = allResources?.filter((r) => r.resource_type === 'quiz') ?? [];
  const podcastResources = allResources?.filter((r) => r.resource_type === 'podcast') ?? [];
  const noteResources = allResources?.filter((r) => r.resource_type === 'note') ?? [];

  // ── Loading state ─────────────────────────────────────
  if (courseLoading || enrollmentLoading) {
    return (
      <div className={`flex items-center justify-center ${isInline ? 'h-full' : 'min-h-screen'}`}>
        <ModernPremiumLoader fullScreen={false} size="lg" text="COURSE" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className={`flex flex-col items-center justify-center ${isInline ? 'h-full' : 'min-h-screen'} gap-6`}>
        <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900 dark:to-blue-800 rounded-full flex items-center justify-center">
          <BookOpen className="w-10 h-10 text-blue-600 dark:text-blue-300" />
        </div>
        <p className="text-lg font-medium text-muted-foreground">Course not found</p>
        <Button onClick={handleBack} className="bg-blue-600 hover:bg-blue-700">Back to Library</Button>
      </div>
    );
  }

  if (!enrollment) {
    return (
      <div className={`flex flex-col items-center justify-center ${isInline ? 'h-full' : 'min-h-screen'} gap-6`}>
        <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900 dark:to-blue-800 rounded-full flex items-center justify-center">
          <GraduationCap className="w-10 h-10 text-blue-600 dark:text-blue-300" />
        </div>
        <p className="text-lg font-medium text-muted-foreground">You are not enrolled in this course</p>
        <Button onClick={handleBack} className="bg-blue-600 hover:bg-blue-700">Back to Library</Button>
      </div>
    );
  }

  return (
    <div className={isInline ? 'flex flex-col h-full' : 'min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-700'}>
      {/* ── Header ──────────────────────────────────────── */}
      <div className={isInline ? 'border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur pb-4 mb-4' : 'sticky top-0 z-10 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur'}>
        <div className={isInline ? '' : 'max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-5'}>
          <div className="flex items-start gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBack}
              className="mt-1 shrink-0 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 truncate">
                  {course.code} — {course.title}
                </h1>
                <Badge
                  variant="secondary"
                  className={`shrink-0 ${enrollment.status === 'completed'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800'
                      : 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                    }`}
                >
                  {enrollment.status === 'completed' ? (
                    <><Trophy className="w-3 h-3 mr-1" /> Completed</>
                  ) : (
                    <><GraduationCap className="w-3 h-3 mr-1" /> Enrolled</>
                  )}
                </Badge>
              </div>
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                {course.department && <span>{course.department}</span>}
                {course.level && <span>Level {course.level}</span>}
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  {enrollmentCount ?? 0} students
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 shrink-0 max-w-full">
              {isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 hidden sm:flex border-yellow-500/30 hover:bg-yellow-500/5 hover:border-yellow-500/50"
                  onClick={() => setShowAIGenerate(true)}
                >
                  <Sparkles className="w-4 h-4 text-yellow-500" />
                  AI Generate
                </Button>
              )}
              <div className="hidden sm:block">
                <ProgressRing percent={enrollment.progress_percent} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Completion Banner ───────────────────────────── */}
      {enrollment.status === 'completed' && (
        <div className="bg-gradient-to-r from-green-500/10 via-emerald-500/10 to-teal-500/10 border-b border-green-500/20">
          <div className="container mx-auto px-4 py-4 max-w-5xl flex items-center gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-500/20 shrink-0">
              <Trophy className="w-6 h-6 text-green-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-green-700 dark:text-green-400">
                Congratulations! You've completed this course!
              </h3>
              <p className="text-sm text-green-600/80 dark:text-green-500/80">
                You finished all {allResources?.length ?? 0} resources in {course.code}. Great work!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Tabs ────────────────────────────────────────── */}
      <div className={isInline ? 'flex-1 overflow-auto' : 'max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6'}>
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="w-full justify-start overflow-x-auto flex-nowrap mb-6 h-auto p-1.5 bg-white/80 dark:bg-gray-800/80 backdrop-blur shadow-sm rounded-xl border border-slate-200/60 dark:border-slate-700/60 scrollbar-thin scrollbar-thumb-blue-200 dark:scrollbar-thumb-blue-900">
            <TabsTrigger value="overview" className="gap-1.5 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700 dark:data-[state=active]:bg-blue-900/40 dark:data-[state=active]:text-blue-300 rounded-lg">
              <BookOpen className="w-4 h-4" /> Overview
            </TabsTrigger>
            <TabsTrigger value="materials" className="gap-1.5 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700 dark:data-[state=active]:bg-blue-900/40 dark:data-[state=active]:text-blue-300 rounded-lg">
              <FileText className="w-4 h-4" /> Materials
              {(resourceCounts?.document ?? 0) > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                  {resourceCounts?.document}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="quizzes" className="gap-1.5 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700 dark:data-[state=active]:bg-blue-900/40 dark:data-[state=active]:text-blue-300 rounded-lg">
              <BrainCircuit className="w-4 h-4" /> Quizzes
              {(resourceCounts?.quiz ?? 0) > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                  {resourceCounts?.quiz}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="podcasts" className="gap-1.5 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700 dark:data-[state=active]:bg-blue-900/40 dark:data-[state=active]:text-blue-300 rounded-lg">
              <Headphones className="w-4 h-4" /> Podcasts
              {(resourceCounts?.podcast ?? 0) > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                  {resourceCounts?.podcast}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="notes" className="gap-1.5 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700 dark:data-[state=active]:bg-blue-900/40 dark:data-[state=active]:text-blue-300 rounded-lg">
              <NotebookPen className="w-4 h-4" /> Notes
              {(resourceCounts?.note ?? 0) > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                  {resourceCounts?.note}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="discussions" className="gap-1.5 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700 dark:data-[state=active]:bg-blue-900/40 dark:data-[state=active]:text-blue-300 rounded-lg">
              <MessageSquare className="w-4 h-4" /> Discussions
            </TabsTrigger>
            <TabsTrigger value="ai-tutor" className="gap-1.5 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700 dark:data-[state=active]:bg-blue-900/40 dark:data-[state=active]:text-blue-300 rounded-lg">
              <BrainCircuit className="w-4 h-4" /> AI Tutor
            </TabsTrigger>
          </TabsList>

          {/* ── Overview Tab ────────────────────────────── */}
          <TabsContent value="overview">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {/* Progress Card */}
              <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur border-slate-200 dark:border-slate-700 hover:shadow-lg transition-all duration-300">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                      <GraduationCap className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    Your Progress
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex items-center gap-6">
                  <ProgressRing percent={enrollment.progress_percent} size={100} />
                  <div className="space-y-2 text-sm">
                    <p>
                      <span className="font-bold text-lg">{completedResourceIds.size}</span>
                      <span className="text-gray-500 dark:text-gray-400"> of {allResources?.length ?? 0} resources</span>
                    </p>
                    <Progress value={(completedResourceIds.size / Math.max(allResources?.length ?? 1, 1)) * 100} className="h-2" />
                    {enrollment.status === 'completed' ? (
                      <p className="text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
                        <Trophy className="w-4 h-4" /> Course Complete!
                      </p>
                    ) : (
                      <p className="text-gray-500 dark:text-gray-400">Keep going!</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Course Info Card */}
              <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur border-slate-200 dark:border-slate-700 hover:shadow-lg transition-all duration-300">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
                      <Info className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    Course Info
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 dark:text-gray-400">Code</span>
                    <Badge variant="secondary" className="font-mono bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800">{course.code}</Badge>
                  </div>
                  {course.department && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500 dark:text-gray-400">Department</span>
                      <span className="font-medium">{course.department}</span>
                    </div>
                  )}
                  {course.level && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500 dark:text-gray-400">Level</span>
                      <span className="font-medium">{course.level}</span>
                    </div>
                  )}
                  {course.semester && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500 dark:text-gray-400">Semester</span>
                      <span className="font-medium">{course.semester}</span>
                    </div>
                  )}
                  {course.description && (
                    <p className="text-gray-600 dark:text-gray-400 mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 line-clamp-3">{course.description}</p>
                  )}
                </CardContent>
              </Card>

              {/* Quick Actions Card */}
              <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur border-slate-200 dark:border-slate-700 hover:shadow-lg transition-all duration-300">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-green-100 dark:bg-green-900/30">
                      <Sparkles className="h-4 w-4 text-green-600 dark:text-green-400" />
                    </div>
                    Quick Actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3">
                  <button
                    className="group relative overflow-hidden rounded-xl border border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 p-4 hover:shadow-lg transition-all duration-300 hover:scale-[1.02] text-left"
                    onClick={() => navigate(`/chat?courseId=${courseId}&courseTitle=${encodeURIComponent(course.title)}`)}
                  >
                    <div className="p-2 rounded-full bg-blue-500 dark:bg-blue-600 w-fit mb-2 group-hover:scale-110 transition-transform">
                      <BrainCircuit className="w-4 h-4 text-white" />
                    </div>
                    <p className="text-xs font-medium text-blue-900 dark:text-blue-100">Ask AI Tutor</p>
                    <div className="absolute inset-x-0 bottom-0 h-1 bg-blue-500 transform scale-x-0 group-hover:scale-x-100 transition-transform" />
                  </button>
                  <button
                    className="group relative overflow-hidden rounded-xl border border-green-200 dark:border-green-800 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 p-4 hover:shadow-lg transition-all duration-300 hover:scale-[1.02] text-left"
                    onClick={() => navigate('/quizzes')}
                  >
                    <div className="p-2 rounded-full bg-green-500 dark:bg-green-600 w-fit mb-2 group-hover:scale-110 transition-transform">
                      <Play className="w-4 h-4 text-white" />
                    </div>
                    <p className="text-xs font-medium text-green-900 dark:text-green-100">Take a Quiz</p>
                    <div className="absolute inset-x-0 bottom-0 h-1 bg-green-500 transform scale-x-0 group-hover:scale-x-100 transition-transform" />
                  </button>
                  <button
                    className="group relative overflow-hidden rounded-xl border border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 p-4 hover:shadow-lg transition-all duration-300 hover:scale-[1.02] text-left"
                    onClick={() => navigate('/podcasts')}
                  >
                    <div className="p-2 rounded-full bg-purple-500 dark:bg-purple-600 w-fit mb-2 group-hover:scale-110 transition-transform">
                      <Headphones className="w-4 h-4 text-white" />
                    </div>
                    <p className="text-xs font-medium text-purple-900 dark:text-purple-100">Podcasts</p>
                    <div className="absolute inset-x-0 bottom-0 h-1 bg-purple-500 transform scale-x-0 group-hover:scale-x-100 transition-transform" />
                  </button>
                  {isAdmin ? (
                    <button
                      className="group relative overflow-hidden rounded-xl border border-yellow-200 dark:border-yellow-800 bg-gradient-to-br from-yellow-50 to-amber-100 dark:from-yellow-950 dark:to-amber-900 p-4 hover:shadow-lg transition-all duration-300 hover:scale-[1.02] text-left"
                      onClick={() => setShowAIGenerate(true)}
                    >
                      <div className="p-2 rounded-full bg-yellow-500 dark:bg-yellow-600 w-fit mb-2 group-hover:scale-110 transition-transform">
                        <Sparkles className="w-4 h-4 text-white" />
                      </div>
                      <p className="text-xs font-medium text-yellow-900 dark:text-yellow-100">AI Generate</p>
                      <div className="absolute inset-x-0 bottom-0 h-1 bg-yellow-500 transform scale-x-0 group-hover:scale-x-100 transition-transform" />
                    </button>
                  ) : (
                    <button
                      className="group relative overflow-hidden rounded-xl border border-indigo-200 dark:border-indigo-800 bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-950 dark:to-indigo-900 p-4 hover:shadow-lg transition-all duration-300 hover:scale-[1.02] text-left"
                      onClick={() => navigate(`/social?tab=feed&hashtag=${encodeURIComponent(`#${course.code}`)}`)}
                    >
                      <div className="p-2 rounded-full bg-indigo-500 dark:bg-indigo-600 w-fit mb-2 group-hover:scale-110 transition-transform">
                        <MessageSquare className="w-4 h-4 text-white" />
                      </div>
                      <p className="text-xs font-medium text-indigo-900 dark:text-indigo-100">Discussions</p>
                      <div className="absolute inset-x-0 bottom-0 h-1 bg-indigo-500 transform scale-x-0 group-hover:scale-x-100 transition-transform" />
                    </button>
                  )}
                </CardContent>
              </Card>

              {/* Resources Summary */}
              <Card className="md:col-span-2 lg:col-span-3 bg-white/80 dark:bg-gray-800/80 backdrop-blur border-slate-200 dark:border-slate-700">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-cyan-100 dark:bg-cyan-900/30">
                      <BookOpen className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                    </div>
                    Resources Overview
                  </CardTitle>
                  <CardDescription>All learning materials linked to this course</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                    {([
                      { type: 'document' as ResourceType, icon: FileText, label: 'Documents', color: 'from-blue-500 to-cyan-500', bg: 'bg-blue-100 dark:bg-blue-900' },
                      { type: 'quiz' as ResourceType, icon: BrainCircuit, label: 'Quizzes', color: 'from-green-500 to-emerald-500', bg: 'bg-green-100 dark:bg-green-900' },
                      { type: 'podcast' as ResourceType, icon: Headphones, label: 'Podcasts', color: 'from-purple-500 to-pink-500', bg: 'bg-purple-100 dark:bg-purple-900' },
                      { type: 'note' as ResourceType, icon: NotebookPen, label: 'Notes', color: 'from-yellow-500 to-orange-500', bg: 'bg-yellow-100 dark:bg-yellow-900' },
                      { type: 'recording' as ResourceType, icon: Play, label: 'Recordings', color: 'from-red-500 to-pink-500', bg: 'bg-red-100 dark:bg-red-900' },
                    ]).map(({ type, icon: Icon, label, color, bg }) => (
                      <Card
                        key={type}
                        className="overflow-hidden hover:scale-105 transition-all duration-300 cursor-pointer group border-slate-200 dark:border-slate-700"
                      >
                        <CardContent className="p-4 sm:p-5 flex flex-col items-center gap-2">
                          <div className={`p-3 rounded-2xl ${bg} group-hover:scale-110 transition-transform`}>
                            <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-gray-700 dark:text-gray-300" />
                          </div>
                          <span className="text-2xl font-bold">
                            {resourceCounts?.[type] ?? 0}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── Materials Tab ───────────────────────────── */}
          <TabsContent value="materials">
            <div className="space-y-6">
              {/* All document resources */}
              {documentResources.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <div className="h-5 w-1 bg-blue-600 rounded-full" />
                    Course Documents
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {documentResources.map((resource, i) => (
                      <motion.div
                        key={resource.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                      >
                        <Card className="h-full flex flex-col bg-white/90 dark:bg-slate-900/70 border-slate-200 dark:border-slate-700 hover:shadow-lg hover:border-blue-500/50 transition-all duration-300 group rounded-xl">
                          <CardContent className="p-4 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <h4 className="font-medium truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{resource.title}</h4>
                                {resource.description && (
                                  <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mt-1">
                                    {resource.description}
                                  </p>
                                )}
                                {resource.category && (
                                  <Badge variant="outline" className="mt-2 text-xs border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300">
                                    {resource.category}
                                  </Badge>
                                )}
                              </div>
                              {completedResourceIds.has(resource.id) ? (
                                <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                              ) : (
                                <Circle className="w-5 h-5 text-gray-300 dark:text-gray-600 shrink-0" />
                              )}
                            </div>
                          </CardContent>
                          <div className="px-4 pb-4 pt-0 flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 gap-1 border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-900/30"
                              onClick={() => navigate(`/documents?preview=${resource.resource_id}`)}
                            >
                              <ExternalLink className="w-3.5 h-3.5" /> View
                            </Button>
                            <Button
                              size="sm"
                              className="flex-1 gap-1 bg-blue-600 hover:bg-blue-700 text-white"
                              onClick={() =>
                                navigate(
                                  `/chat?documentId=${resource.resource_id}&courseId=${courseId}&courseTitle=${encodeURIComponent(course.title)}`
                                )
                              }
                            >
                              <BrainCircuit className="w-3.5 h-3.5" /> Ask AI
                            </Button>
                          </div>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {documentResources.length === 0 && (
                <EmptyState icon={FileText} title="No Materials Yet" label="Upload documents or generate materials to get started">
                  {isAdmin && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4 gap-2 border-yellow-500/30 hover:bg-yellow-500/5"
                      onClick={() => setShowAIGenerate(true)}
                    >
                      <Sparkles className="w-4 h-4 text-yellow-500" /> Generate Materials with AI
                    </Button>
                  )}
                </EmptyState>
              )}
            </div>
          </TabsContent>

          {/* ── Quizzes Tab ─────────────────────────────── */}
          <TabsContent value="quizzes">
            {quizResources.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {quizResources.map((resource, i) => (
                  <motion.div
                    key={resource.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Card className="h-full flex flex-col bg-white/90 dark:bg-slate-900/70 border-slate-200 dark:border-slate-700 hover:shadow-lg hover:border-green-500/50 transition-all duration-300 group rounded-xl">
                      <CardContent className="p-4 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h4 className="font-medium truncate group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">{resource.title}</h4>
                            {resource.description && (
                              <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mt-1">
                                {resource.description}
                              </p>
                            )}
                            {resource.category && (
                              <Badge variant="outline" className="mt-2 text-xs border-green-200 dark:border-green-800 text-green-700 dark:text-green-300">
                                {resource.category}
                              </Badge>
                            )}
                          </div>
                          {completedResourceIds.has(resource.id) ? (
                            <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                          ) : (
                            <Circle className="w-5 h-5 text-gray-300 dark:text-gray-600 shrink-0" />
                          )}
                        </div>
                      </CardContent>
                      <div className="px-4 pb-4 pt-0">
                        <Button
                          size="sm"
                          className="w-full gap-1 bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => navigate(`/quizzes`)}
                        >
                          <Play className="w-3.5 h-3.5" /> Take Quiz
                        </Button>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            ) : (
              <EmptyState icon={BrainCircuit} title="No Quizzes Yet" label="Generate quizzes from your course materials to test your knowledge">
                {isAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 gap-2 border-yellow-500/30 hover:bg-yellow-500/5"
                    onClick={() => setShowAIGenerate(true)}
                  >
                    <Sparkles className="w-4 h-4 text-yellow-500" /> Generate Quizzes with AI
                  </Button>
                )}
              </EmptyState>
            )}
          </TabsContent>

          {/* ── Podcasts Tab ────────────────────────────── */}
          <TabsContent value="podcasts">
            {podcastResources.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {podcastResources.map((resource, i) => (
                  <motion.div
                    key={resource.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Card className="h-full flex flex-col bg-white/90 dark:bg-slate-900/70 border-slate-200 dark:border-slate-700 hover:shadow-lg hover:border-purple-500/50 transition-all duration-300 group rounded-xl">
                      <CardContent className="p-4 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h4 className="font-medium truncate group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">{resource.title}</h4>
                            {resource.description && (
                              <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mt-1">
                                {resource.description}
                              </p>
                            )}
                          </div>
                          {completedResourceIds.has(resource.id) ? (
                            <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                          ) : (
                            <Circle className="w-5 h-5 text-gray-300 dark:text-gray-600 shrink-0" />
                          )}
                        </div>
                      </CardContent>
                      <div className="px-4 pb-4 pt-0">
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full gap-1 border-purple-200 text-purple-700 hover:bg-purple-50 hover:text-purple-800 dark:border-purple-800 dark:text-purple-400 dark:hover:bg-purple-900/30"
                          onClick={() => navigate(`/podcasts/${resource.resource_id}`)}
                        >
                          <Headphones className="w-3.5 h-3.5" /> Listen
                        </Button>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            ) : (
              <EmptyState icon={Headphones} title="No Podcasts Yet" label="Generate AI podcasts from your course content to learn on the go">
                {isAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 gap-2 border-yellow-500/30 hover:bg-yellow-500/5"
                    onClick={() => setShowAIGenerate(true)}
                  >
                    <Sparkles className="w-4 h-4 text-yellow-500" /> Generate Podcast with AI
                  </Button>
                )}
              </EmptyState>
            )}
          </TabsContent>

          {/* ── Notes Tab ───────────────────────────────── */}
          <TabsContent value="notes">
            {noteResources.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {noteResources.map((resource, i) => (
                  <motion.div
                    key={resource.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Card className="h-full flex flex-col bg-white/90 dark:bg-slate-900/70 border-slate-200 dark:border-slate-700 hover:shadow-lg hover:border-orange-500/50 transition-all duration-300 group rounded-xl">
                      <CardContent className="p-4 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h4 className="font-medium truncate group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">{resource.title}</h4>
                            {resource.description && (
                              <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mt-1">
                                {resource.description}
                              </p>
                            )}
                          </div>
                          {completedResourceIds.has(resource.id) ? (
                            <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                          ) : (
                            <Circle className="w-5 h-5 text-gray-300 dark:text-gray-600 shrink-0" />
                          )}
                        </div>
                      </CardContent>
                      <div className="px-4 pb-4 pt-0">
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full gap-1 border-orange-200 text-orange-700 hover:bg-orange-50 hover:text-orange-800 dark:border-orange-800 dark:text-orange-400 dark:hover:bg-orange-900/30"
                          onClick={() => navigate(`/notes/${resource.resource_id}`)}
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> Open Note
                        </Button>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            ) : (
              <EmptyState icon={NotebookPen} title="No Notes Yet" label="Generate study notes from your course materials with AI">
                {isAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 gap-2 border-yellow-500/30 hover:bg-yellow-500/5"
                    onClick={() => setShowAIGenerate(true)}
                  >
                    <Sparkles className="w-4 h-4 text-yellow-500" /> Generate Notes with AI
                  </Button>
                )}
              </EmptyState>
            )}
          </TabsContent>

          {/* ── Discussions Tab ─────────────────────────── */}
          <TabsContent value="discussions">
            <Card className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-gray-800 dark:to-gray-900 border-0 shadow-xl rounded-2xl overflow-hidden">
              <CardContent className="p-8 sm:p-12 text-center">
                <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-indigo-100 to-blue-200 dark:from-indigo-900 dark:to-blue-800 rounded-full flex items-center justify-center">
                  <MessageSquare className="w-8 h-8 text-indigo-600 dark:text-indigo-300" />
                </div>
                <h3 className="text-xl font-bold mb-2">Course Discussions</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
                  Join the conversation with other students in {course.code}. Share insights, ask questions, and collaborate.
                </p>
                <Button
                  className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg"
                  onClick={() =>
                    navigate(`/social?tab=feed&hashtag=${encodeURIComponent(`#${course.code}`)}`)
                  }
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Open Discussion Feed
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── AI Generate Resources (Admin) ────────── */}
          {isAdmin && course && user && (
            <GenerateCourseResourcesDialog
              open={showAIGenerate}
              onOpenChange={setShowAIGenerate}
              courseId={courseId!}
              courseTitle={course.title}
              courseCode={course.code}
              userId={user.id}
              onComplete={() => {
                queryClient.invalidateQueries({ queryKey: ['course-resources', courseId] });
                queryClient.invalidateQueries({ queryKey: ['course-resource-counts', courseId] });
              }}
            />
          )}

          {/* ── AI Tutor Tab ────────────────────────────── */}
          <TabsContent value="ai-tutor">
            <Card className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900 border-0 shadow-xl rounded-2xl overflow-hidden">
              <CardContent className="p-8 sm:p-12 text-center">
                <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-purple-100 to-indigo-200 dark:from-purple-900 dark:to-indigo-800 rounded-full flex items-center justify-center">
                  <BrainCircuit className="w-8 h-8 text-purple-600 dark:text-purple-300" />
                </div>
                <h3 className="text-xl font-bold mb-2">AI Tutor</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
                  Ask the AI tutor any question about {course.title}. It has access to all course
                  materials as context for accurate answers.
                </p>
                <Button
                  className="bg-purple-600 hover:bg-purple-700 text-white shadow-lg"
                  onClick={() =>
                    navigate(
                      `/chat?courseId=${courseId}&courseTitle=${encodeURIComponent(course.title)}&courseCode=${encodeURIComponent(course.code)}`
                    )
                  }
                >
                  <BrainCircuit className="w-4 h-4 mr-2" />
                  Start AI Tutor Chat
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

// ── Empty State Helper ──────────────────────────────────────
const EmptyState: React.FC<{ icon: React.ElementType; title?: string; label: string; children?: React.ReactNode }> = ({
  icon: Icon,
  title,
  label,
  children,
}) => (
  <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-2xl p-8 sm:p-12 text-center">
    <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900 dark:to-blue-800 rounded-full flex items-center justify-center">
      <Icon className="h-8 w-8 text-blue-600 dark:text-blue-300" />
    </div>
    {title && <h3 className="text-lg font-semibold mb-2">{title}</h3>}
    <p className="text-gray-600 dark:text-gray-400">{label}</p>
    {children}
  </div>
);

export default CourseDashboard;
