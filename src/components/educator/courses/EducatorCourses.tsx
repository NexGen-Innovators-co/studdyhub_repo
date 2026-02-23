// src/components/educator/courses/EducatorCourses.tsx
// Lists courses managed by the educator, with create/edit/publish actions.

import React, { useState } from 'react';
import { Card, CardContent} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  BookOpen,
  Plus,
  Search,
  Loader2,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  BarChart3,
} from 'lucide-react';
import { useEducatorCourses, type Course } from '@/hooks/useEducatorCourses';
import { useInstitution } from '@/hooks/useInstitution';
import { CreateCourseForm } from './CreateCourseForm';
import { EditCourseForm } from './EditCourseForm';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type ViewMode = 'list' | 'create' | 'edit';

export const EducatorCourses: React.FC = () => {
  const { institution } = useInstitution();
  const { courses, isLoading, publishCourse, deleteCourse, refetch } =
    useEducatorCourses(institution?.id);
  const [view, setView] = useState<ViewMode>('list');
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [courseToDelete, setCourseToDelete] = useState<string | null>(null);

  const filteredCourses = courses.filter(
    (c) =>
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleEdit = (course: Course) => {
    setEditingCourse(course);
    setView('edit');
  };

  const handleBack = () => {
    setView('list');
    setEditingCourse(null);
    refetch();
  };

  const handleDelete = async () => {
    if (courseToDelete) {
      await deleteCourse(courseToDelete);
      setCourseToDelete(null);
    }
  };

  if (view === 'create') {
    return (
      <CreateCourseForm
        institutionId={institution?.id}
        onSuccess={handleBack}
        onCancel={handleBack}
      />
    );
  }

  if (view === 'edit' && editingCourse) {
    return (
      <EditCourseForm
        course={editingCourse}
        onSuccess={handleBack}
        onCancel={handleBack}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">My Courses</h2>
          <p className="text-sm text-gray-500">
            {courses.length} course{courses.length !== 1 ? 's' : ''} created
          </p>
        </div>
        <Button onClick={() => setView('create')}>
          <Plus className="w-4 h-4 mr-2" />
          Create Course
        </Button>
      </div>

      {/* Search */}
      <div className="relative w-full sm:w-72">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search courses..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Course list */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : filteredCourses.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            No Courses Yet
          </h3>
          <p className="text-gray-500 mb-4">Create your first course to get started.</p>
          <Button onClick={() => setView('create')} variant="outline">
            <Plus className="w-4 h-4 mr-2" />
            Create Course
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredCourses.map((course) => (
            <Card key={course.id} className="rounded-xl hover:shadow-md transition-shadow">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="p-3 rounded-xl bg-purple-100 dark:bg-purple-900/30">
                  <BookOpen className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="secondary" className="font-mono text-xs">
                      {course.code}
                    </Badge>
                    {(course as any).is_published ? (
                      <Badge className="bg-green-100 text-green-700 text-xs">Published</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">Draft</Badge>
                    )}
                  </div>
                  <p className="font-medium text-gray-900 dark:text-white truncate">
                    {course.title}
                  </p>
                  {course.department && (
                    <p className="text-xs text-gray-500">{course.department}</p>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() =>
                      publishCourse(course.id, !(course as any).is_published)
                    }
                    title={(course as any).is_published ? 'Unpublish' : 'Publish'}
                  >
                    {(course as any).is_published ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleEdit(course)}
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-500 hover:text-red-700"
                    onClick={() => setCourseToDelete(course.id)}
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!courseToDelete} onOpenChange={(open) => !open && setCourseToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Course</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. All materials in this course will also be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default EducatorCourses;
