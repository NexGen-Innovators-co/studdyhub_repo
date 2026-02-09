import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BookOpen, GraduationCap, Loader2, LogIn, Users, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCourseLibrary, Course } from '@/hooks/useCourseLibrary';
import { useCourseEnrollment } from '@/hooks/useCourseEnrollment';
import { ResourceCard } from './ResourceCard';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import BookPagesAnimation from '@/components/ui/bookloader';

interface CourseDetailProps {
  course: Course;
  onBack: () => void;
  onOpenDashboard?: () => void;
}

export const CourseDetail: React.FC<CourseDetailProps> = ({ course, onBack, onOpenDashboard }) => {
  const navigate = useNavigate();
  const { useCourseMaterials } = useCourseLibrary();
  const { data: materials, isLoading } = useCourseMaterials(course.id);
  const { useEnrollment, useEnrollmentCount, useEnrollInCourse } = useCourseEnrollment();
  const { data: enrollment, isLoading: enrollmentLoading } = useEnrollment(course.id);
  const { data: enrollmentCount } = useEnrollmentCount(course.id);
  const enrollMutation = useEnrollInCourse();

  const handleEnroll = async () => {
    try {
      await enrollMutation.mutateAsync(course.id);
      toast.success('Enrolled successfully!');
      if (onOpenDashboard) {
        onOpenDashboard();
      } else {
        navigate(`/course/${course.id}`);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to enroll');
    }
  };

  const handleContinueLearning = () => {
    if (onOpenDashboard) {
      onOpenDashboard();
    } else {
      navigate(`/course/${course.id}`);
    }
  };

  const groupedMaterials = useMemo(() => {
    if (!materials) return {};
    
    return materials.reduce((acc, material) => {
      const category = material.category || 'Other Resources';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(material);
      return acc;
    }, {} as Record<string, typeof materials>);
  }, [materials]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <BookPagesAnimation size="lg" showText text="Loading course..." />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-4 mb-6 pb-4 border-b border-slate-200 dark:border-slate-700">
        <Button variant="ghost" size="icon" onClick={onBack} className="hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 flex items-center gap-2">
            <Badge variant="secondary" className="font-mono bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800 shrink-0">
              {course.code}
            </Badge>
            <span className="truncate">{course.title}</span>
          </h2>
          <div className="flex items-center gap-3 mt-1.5">
            <p className="text-sm text-gray-500 dark:text-gray-400">{course.department}</p>
            {course.level && <span className="text-sm text-gray-500 dark:text-gray-400">Level {course.level}</span>}
            {enrollmentCount !== undefined && enrollmentCount > 0 && (
              <Badge variant="secondary" className="gap-1 text-xs">
                <Users className="w-3 h-3" /> {enrollmentCount} students
              </Badge>
            )}
          </div>
          {course.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 line-clamp-2">{course.description}</p>
          )}
        </div>
        <div className="shrink-0">
          {enrollmentLoading ? (
            <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
          ) : enrollment ? (
            <Button onClick={handleContinueLearning} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-lg">
              <GraduationCap className="w-4 h-4" /> Continue Learning
            </Button>
          ) : (
            <Button onClick={handleEnroll} disabled={enrollMutation.isPending} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-lg">
              {enrollMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LogIn className="w-4 h-4" />
              )}
              Enroll in Course
            </Button>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1 pr-4">
        <div className="space-y-8 pb-8">
          {Object.entries(groupedMaterials).length === 0 ? (
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-2xl p-8 sm:p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900 dark:to-blue-800 rounded-full flex items-center justify-center">
                <BookOpen className="h-8 w-8 text-blue-600 dark:text-blue-300" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No Materials Yet</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">Enroll to access course materials as they become available.</p>
              {!enrollment && (
                <Button onClick={handleEnroll} disabled={enrollMutation.isPending} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                  <LogIn className="w-4 h-4" /> Enroll Now
                </Button>
              )}
            </div>
          ) : (
            Object.entries(groupedMaterials).map(([category, items]) => (
              <div key={category}>
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <div className="h-6 w-1 bg-blue-600 rounded-full" />
                  {category}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {items.map((material) => (
                    <ResourceCard key={material.id} material={material} course={course} />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
