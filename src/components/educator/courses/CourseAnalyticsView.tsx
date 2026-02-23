// src/components/educator/courses/CourseAnalyticsView.tsx
// Per-course performance analytics with charts and breakdowns.

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  BarChart3,
  TrendingUp,
  Users,
  Clock,
  GraduationCap,
  Loader2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CourseAnalyticsViewProps {
  courseId?: string;
}

interface AnalyticsData {
  totalEnrolled: number;
  completionRate: number;
  avgProgress: number;
  avgQuizScore: number;
  weeklyEnrollments: { week: string; count: number }[];
  progressDistribution: { label: string; value: number; color: string }[];
  recentActivity: { date: string; active: number }[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

const PROGRESS_BUCKETS = [
  { label: '0-25%', min: 0, max: 25, color: '#ef4444' },
  { label: '26-50%', min: 26, max: 50, color: '#f59e0b' },
  { label: '51-75%', min: 51, max: 75, color: '#3b82f6' },
  { label: '76-99%', min: 76, max: 99, color: '#8b5cf6' },
  { label: '100%', min: 100, max: 100, color: '#10b981' },
];

export const CourseAnalyticsView: React.FC<CourseAnalyticsViewProps> = ({ courseId }) => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (courseId) fetchAnalytics();
    else setLoading(false);
  }, [courseId]);

  const fetchAnalytics = async () => {
    if (!courseId) return;
    try {
      setLoading(true);

      const { data: enrollments, error } = await supabase
        .from('course_enrollments')
        .select('id, progress, enrolled_at, last_accessed')
        .eq('course_id', courseId);

      if (error) throw error;

      const rows = enrollments || [];
      const totalEnrolled = rows.length;
      const completed = rows.filter((r) => (r.progress || 0) >= 100).length;
      const completionRate = totalEnrolled > 0 ? Math.round((completed / totalEnrolled) * 100) : 0;
      const avgProgress = totalEnrolled > 0
        ? Math.round(rows.reduce((s, r) => s + (r.progress || 0), 0) / totalEnrolled)
        : 0;

      // Quiz scores from quizzes scoped to this course
      const { data: quizData } = await supabase
        .from('quiz_attempts')
        .select('score')
        .eq('course_id', courseId);
      const quizRows = quizData || [];
      const avgQuizScore = quizRows.length
        ? Math.round(quizRows.reduce((s, r) => s + (r.score || 0), 0) / quizRows.length)
        : 0;

      // Weekly enrollments (last 8 weeks)
      const now = new Date();
      const weeklyEnrollments: { week: string; count: number }[] = [];
      for (let i = 7; i >= 0; i--) {
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - i * 7);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);
        const count = rows.filter((r) => {
          const d = new Date(r.enrolled_at);
          return d >= weekStart && d < weekEnd;
        }).length;
        weeklyEnrollments.push({
          week: weekStart.toLocaleDateString('en', { month: 'short', day: 'numeric' }),
          count,
        });
      }

      // Progress distribution
      const progressDistribution = PROGRESS_BUCKETS.map((bucket) => ({
        label: bucket.label,
        value: rows.filter((r) => {
          const p = r.progress || 0;
          return p >= bucket.min && p <= bucket.max;
        }).length,
        color: bucket.color,
      }));

      // Recent daily activity (last 14 days)
      const recentActivity: { date: string; active: number }[] = [];
      for (let i = 13; i >= 0; i--) {
        const day = new Date(now);
        day.setDate(day.getDate() - i);
        const dayStr = day.toISOString().slice(0, 10);
        const active = rows.filter(
          (r) => r.last_accessed && r.last_accessed.slice(0, 10) === dayStr
        ).length;
        recentActivity.push({
          date: day.toLocaleDateString('en', { month: 'short', day: 'numeric' }),
          active,
        });
      }

      setData({
        totalEnrolled,
        completionRate,
        avgProgress,
        avgQuizScore,
        weeklyEnrollments,
        progressDistribution,
        recentActivity,
      });
    } catch (err: any) {
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  if (!courseId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-500 dark:text-gray-400">
        <BarChart3 className="h-12 w-12 mb-4 opacity-40" />
        <p className="text-lg font-medium">Select a course to view analytics</p>
        <p className="text-sm mt-1">Navigate to a course from the Courses tab first.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Course Analytics</h2>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-2xl">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{data.totalEnrolled}</p>
              <p className="text-xs text-gray-500">Enrolled</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
              <GraduationCap className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{data.completionRate}%</p>
              <p className="text-xs text-gray-500">Completion Rate</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
              <TrendingUp className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{data.avgProgress}%</p>
              <p className="text-xs text-gray-500">Avg Progress</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <BarChart3 className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{data.avgQuizScore}%</p>
              <p className="text-xs text-gray-500">Avg Quiz Score</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Tabs defaultValue="enrollments" className="space-y-4">
        <TabsList>
          <TabsTrigger value="enrollments">Enrollments</TabsTrigger>
          <TabsTrigger value="progress">Progress</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="enrollments">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base">Weekly Enrollments (Last 8 Weeks)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.weeklyEnrollments}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" fontSize={12} />
                  <YAxis allowDecimals={false} fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Enrollments" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="progress">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base">Student Progress Distribution</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={data.progressDistribution}
                    dataKey="value"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ label, value }) => (value > 0 ? `${label}: ${value}` : '')}
                  >
                    {data.progressDistribution.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base">Daily Active Students (Last 14 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data.recentActivity}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" fontSize={12} />
                  <YAxis allowDecimals={false} fontSize={12} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="active"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="Active Students"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CourseAnalyticsView;
