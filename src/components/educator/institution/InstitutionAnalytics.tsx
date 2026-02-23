// src/components/educator/institution/InstitutionAnalytics.tsx
// Institution-level analytics — member counts, course stats, trends.

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, BookOpen, Mail, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface InstitutionAnalyticsProps {
  institutionId: string;
}

interface Analytics {
  members: {
    total: number;
    byRole: Record<string, number>;
  };
  courses: {
    total: number;
    published: number;
    draft: number;
    createdLast30Days: number;
  };
  invites: {
    pending: number;
  };
}

export const InstitutionAnalytics: React.FC<InstitutionAnalyticsProps> = ({
  institutionId,
}) => {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke(
          'get-institution-analytics',
          { body: { institutionId } }
        );

        if (error) throw error;
        setAnalytics(data?.analytics || null);
      } catch {
        // Fallback — try a simple client-side count
        setAnalytics(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnalytics();
  }, [institutionId]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center py-12 text-gray-500">
        Analytics data is not available yet.
      </div>
    );
  }

  const statCards = [
    {
      label: 'Total Members',
      value: analytics.members.total,
      icon: Users,
      color: 'text-blue-500',
      bg: 'bg-blue-100 dark:bg-blue-900/30',
    },
    {
      label: 'Total Courses',
      value: analytics.courses.total,
      icon: BookOpen,
      color: 'text-purple-500',
      bg: 'bg-purple-100 dark:bg-purple-900/30',
    },
    {
      label: 'Published Courses',
      value: analytics.courses.published,
      icon: TrendingUp,
      color: 'text-green-500',
      bg: 'bg-green-100 dark:bg-green-900/30',
    },
    {
      label: 'Pending Invites',
      value: analytics.invites.pending,
      icon: Mail,
      color: 'text-orange-500',
      bg: 'bg-orange-100 dark:bg-orange-900/30',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label} className="rounded-2xl">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${stat.bg}`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stat.value}
                </p>
                <p className="text-xs text-gray-500">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Role breakdown */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">Members by Role</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {Object.entries(analytics.members.byRole).map(([role, count]) => (
              <div
                key={role}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800"
              >
                <Badge variant="outline" className="capitalize">
                  {role}
                </Badge>
                <span className="text-lg font-semibold text-gray-900 dark:text-white">
                  {count}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Course activity */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">Course Activity (Last 30 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 rounded-xl bg-gray-50 dark:bg-gray-800">
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {analytics.courses.createdLast30Days}
              </p>
              <p className="text-sm text-gray-500">New Courses</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-gray-50 dark:bg-gray-800">
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {analytics.courses.draft}
              </p>
              <p className="text-sm text-gray-500">Draft Courses</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default InstitutionAnalytics;
