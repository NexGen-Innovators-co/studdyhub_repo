// src/components/educator/courses/CourseStudents.tsx
// Enrolled student roster with progress tracking per course.

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Users,
  Search,
  Loader2,
  ArrowUpDown,
  Download,
  GraduationCap,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface EnrolledStudent {
  id: string;
  user_id: string;
  enrolled_at: string;
  progress: number;
  last_accessed: string | null;
  profile: {
    display_name: string;
    avatar_url: string | null;
    email: string | null;
  } | null;
}

interface CourseStudentsProps {
  courseId?: string;
}

export const CourseStudents: React.FC<CourseStudentsProps> = ({ courseId }) => {
  const [students, setStudents] = useState<EnrolledStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<'name' | 'progress' | 'enrolled'>('enrolled');
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    if (courseId) fetchStudents();
    else setLoading(false);
  }, [courseId]);

  const fetchStudents = async () => {
    if (!courseId) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('course_enrollments')
        .select(`
          id,
          user_id,
          enrolled_at,
          progress,
          last_accessed,
          profile:profiles!course_enrollments_user_id_fkey(
            display_name,
            avatar_url,
            email
          )
        `)
        .eq('course_id', courseId)
        .order('enrolled_at', { ascending: false });

      if (error) throw error;
      setStudents((data || []) as unknown as EnrolledStudent[]);
    } catch (err: any) {
      toast.error('Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  const filtered = students
    .filter((s) => {
      const name = (s.profile?.display_name || '').toLowerCase();
      const email = (s.profile?.email || '').toLowerCase();
      return name.includes(search.toLowerCase()) || email.includes(search.toLowerCase());
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') {
        cmp = (a.profile?.display_name || '').localeCompare(b.profile?.display_name || '');
      } else if (sortField === 'progress') {
        cmp = (a.progress || 0) - (b.progress || 0);
      } else {
        cmp = new Date(a.enrolled_at).getTime() - new Date(b.enrolled_at).getTime();
      }
      return sortAsc ? cmp : -cmp;
    });

  const avgProgress = students.length
    ? Math.round(students.reduce((sum, s) => sum + (s.progress || 0), 0) / students.length)
    : 0;

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(true); }
  };

  const handleExport = () => {
    const csv = [
      ['Student', 'Email', 'Enrolled', 'Progress %', 'Last Accessed'],
      ...filtered.map((s) => [
        s.profile?.display_name || 'Unknown',
        s.profile?.email || '',
        new Date(s.enrolled_at).toLocaleDateString(),
        String(s.progress || 0),
        s.last_accessed ? new Date(s.last_accessed).toLocaleString() : 'Never',
      ]),
    ].map((r) => r.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `students-${courseId}.csv`;
    a.click();
    toast.success('Student list exported');
  };

  if (!courseId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-500 dark:text-gray-400">
        <GraduationCap className="h-12 w-12 mb-4 opacity-40" />
        <p className="text-lg font-medium">Select a course to view enrolled students</p>
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Enrolled Students
          </h2>
          <p className="text-sm text-gray-500">
            {students.length} student{students.length !== 1 ? 's' : ''} enrolled · Avg progress: {avgProgress}%
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="rounded-2xl">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{students.length}</p>
              <p className="text-xs text-gray-500">Total Enrolled</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
              <GraduationCap className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{students.filter((s) => (s.progress || 0) >= 100).length}</p>
              <p className="text-xs text-gray-500">Completed</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 mb-1">Average Progress</p>
            <Progress value={avgProgress} className="h-2" />
            <p className="text-sm font-medium mt-1">{avgProgress}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Table */}
      <Card className="rounded-2xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer" onClick={() => toggleSort('name')}>
                Student <ArrowUpDown className="inline h-3 w-3 ml-1" />
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort('enrolled')}>
                Enrolled <ArrowUpDown className="inline h-3 w-3 ml-1" />
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort('progress')}>
                Progress <ArrowUpDown className="inline h-3 w-3 ml-1" />
              </TableHead>
              <TableHead>Last Active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                  {search ? 'No students match your search.' : 'No students enrolled yet.'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={s.profile?.avatar_url || ''} />
                        <AvatarFallback className="text-xs">
                          {(s.profile?.display_name || '?')[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm">{s.profile?.display_name || 'Unknown'}</p>
                        <p className="text-xs text-gray-500">{s.profile?.email || ''}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                    {new Date(s.enrolled_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={s.progress || 0} className="h-2 w-20" />
                      <Badge variant={(s.progress || 0) >= 100 ? 'default' : 'secondary'} className="text-xs">
                        {s.progress || 0}%
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {s.last_accessed ? new Date(s.last_accessed).toLocaleDateString() : '—'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};

export default CourseStudents;
