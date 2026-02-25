// src/components/educator/InstitutionAnalyticsPage.tsx
// Route-level page for /educator/analytics — institution-wide analytics overview.

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart3,
  Users,
  BookOpen,
  TrendingUp,
  Loader2,
  Building2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useEducatorContext } from '@/contexts/EducatorContext';
import { useEducatorCourses } from '@/hooks/useEducatorCourses';
import { useInstitutionMembers } from '@/hooks/useInstitutionMembers';

interface InstitutionStats {
  totalCourses: number;
  publishedCourses: number;
  totalMembers: number;
  totalStudents: number;
  totalEducators: number;
  totalEnrollments: number;
  avgProgress: number;
}

export const InstitutionAnalyticsPage: React.FC = () => {
  const { institution, institutionLoading } = useEducatorContext();
  const { courses, isLoading: coursesLoading } = useEducatorCourses(institution?.id);
  const { members, isLoading: membersLoading } = useInstitutionMembers(institution?.id || '');
  const [enrollmentCount, setEnrollmentCount] = useState<number>(0);
  const [avgProgress, setAvgProgress] = useState<number>(0);
  const [enrollLoading, setEnrollLoading] = useState(false);

  useEffect(() => {
    if (!institution?.id || courses.length === 0) return;
    fetchEnrollmentStats();
  }, [institution?.id, courses]);

  const fetchEnrollmentStats = async () => {
    try {
      setEnrollLoading(true);
      const courseIds = courses.map((c) => c.id);
      const { data, error } = await supabase
        .from('course_enrollments')
        .select('id, progress')
        .in('course_id', courseIds);

      if (!error && data) {
        setEnrollmentCount(data.length);
        const avg = data.length > 0
          ? data.reduce((sum, e) => sum + (e.progress || 0), 0) / data.length
          : 0;
        setAvgProgress(Math.round(avg));
      }
    } catch {
      // silent — analytics are best-effort
    } finally {
      setEnrollLoading(false);
    }
  };

  const isLoading = institutionLoading || coursesLoading || membersLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!institution) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-500 dark:text-gray-400">
        <Building2 className="h-12 w-12 mb-4 opacity-40" />
        <p className="text-lg font-medium">No Institution</p>
        <p className="text-sm mt-1">Create or join an institution to view analytics.</p>
      </div>
    );
  }

  const studentCount = members.filter((m) => m.role === 'student').length;
  const educatorCount = members.filter((m) => ['owner', 'admin', 'educator'].includes(m.role)).length;
  const publishedCount = courses.filter((c) => c.is_published).length;

  const stats = [
    {
      label: 'Total Courses',
      value: courses.length,
      icon: BookOpen,
      color: 'text-purple-500',
      bg: 'bg-purple-100 dark:bg-purple-900/30',
    },
    {
      label: 'Published',
      value: publishedCount,
      icon: TrendingUp,
      color: 'text-green-500',
      bg: 'bg-green-100 dark:bg-green-900/30',
    },
    {
      label: 'Members',
      value: members.length,
      icon: Users,
      color: 'text-blue-500',
      bg: 'bg-blue-100 dark:bg-blue-900/30',
    },
    {
      label: 'Total Enrollments',
      value: enrollLoading ? '…' : enrollmentCount,
      icon: BarChart3,
      color: 'text-orange-500',
      bg: 'bg-orange-100 dark:bg-orange-900/30',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Analytics
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          {institution.name} — institution overview
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label} className="rounded-2xl border shadow-sm">
            <CardContent className="p-6 flex items-center gap-4">
              <div className={`p-3 rounded-xl ${bg}`}>
                <Icon className={`h-5 w-5 ${color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
                <p className="text-sm text-gray-500">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Members breakdown */}
        <Card className="rounded-2xl border shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Member Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Educators & Admins</span>
              <span className="font-semibold text-gray-900 dark:text-white">{educatorCount}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Students</span>
              <span className="font-semibold text-gray-900 dark:text-white">{studentCount}</span>
            </div>
            <div className="flex justify-between items-center border-t pt-3 dark:border-gray-700">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Total</span>
              <span className="font-bold text-gray-900 dark:text-white">{members.length}</span>
            </div>
          </CardContent>
        </Card>

        {/* Course progress */}
        <Card className="rounded-2xl border shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Course Performance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Published Courses</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {publishedCount} / {courses.length}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Total Enrollments</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {enrollLoading ? '…' : enrollmentCount}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Avg. Progress</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {enrollLoading ? '…' : `${avgProgress}%`}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Course list with enrollment counts */}
      {courses.length > 0 && (
        <Card className="rounded-2xl border shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Courses</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {courses.map((course) => (
              <div
                key={course.id}
                className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <BookOpen className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {course.title}
                    </p>
                    <p className="text-xs text-gray-500">{course.code}</p>
                  </div>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    course.is_published
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                      : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                  }`}
                >
                  {course.is_published ? 'Published' : 'Draft'}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default InstitutionAnalyticsPage;
