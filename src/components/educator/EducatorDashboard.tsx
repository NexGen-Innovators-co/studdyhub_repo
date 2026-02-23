// src/components/educator/EducatorDashboard.tsx
// Landing page for /educator — shows institution overview and quick actions.

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Users,
  BarChart3,
  Plus,
  GraduationCap,
  Building2,
  Loader2,
} from 'lucide-react';
import { useEducatorPermissions } from '@/hooks/useEducatorPermissions';
import { useEducation } from '@/hooks/useAppContext';
import { useEducatorCourses } from '@/hooks/useEducatorCourses';
import { useInstitutionMembers } from '@/hooks/useInstitutionMembers';

export const EducatorDashboard: React.FC = () => {
  const { permissions } = useEducatorPermissions();
  const { educationContext } = useEducation();
  const navigate = useNavigate();
  const { courses, isLoading: coursesLoading } = useEducatorCourses(permissions.institutionId || undefined);
  const { members, isLoading: membersLoading } = useInstitutionMembers(permissions.institutionId || '');
  const studentCount = members.filter(m => m.role === 'student').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Educator Dashboard
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          {permissions.institutionName
            ? `Managing ${permissions.institutionName}`
            : 'Independent educator'}
        </p>
      </div>

      {/* Role / institution info */}
      <Card className="rounded-2xl border shadow-sm">
        <CardContent className="p-6 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900/30">
            <Building2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 dark:text-white">
              {permissions.role === 'school_admin'
                ? 'School Administrator'
                : permissions.role === 'tutor_affiliated'
                  ? 'Affiliated Tutor'
                  : 'Independent Tutor'}
            </p>
            <p className="text-sm text-gray-500">
              {permissions.institutionRole
                ? `Institution role: ${permissions.institutionRole}`
                : 'No institution linked'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="rounded-2xl border shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/educator/courses')}>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-purple-100 dark:bg-purple-900/30">
              <BookOpen className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{coursesLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : courses.length}</p>
              <p className="text-sm text-gray-500">Courses</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/educator/students')}>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-green-100 dark:bg-green-900/30">
              <Users className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{membersLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : studentCount}</p>
              <p className="text-sm text-gray-500">Students</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/educator/analytics')}>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-orange-100 dark:bg-orange-900/30">
              <BarChart3 className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{coursesLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : members.length}</p>
              <p className="text-sm text-gray-500">Enrollments</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="rounded-2xl border shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {permissions.canCreateCourses && (
            <Button variant="outline" className="gap-2" onClick={() => navigate('/educator/courses')}>
              <Plus className="h-4 w-4" /> Create Course
            </Button>
          )}
          {permissions.canInviteStudents && (
            <Button variant="outline" className="gap-2" onClick={() => navigate('/educator/students')}>
              <Users className="h-4 w-4" /> Invite Students
            </Button>
          )}
          {permissions.canInviteEducators && (
            <Button variant="outline" className="gap-2" onClick={() => navigate('/educator/settings')}>
              <GraduationCap className="h-4 w-4" /> Invite Educators
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EducatorDashboard;
