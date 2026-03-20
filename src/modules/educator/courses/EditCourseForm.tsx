// src/components/educator/courses/EditCourseForm.tsx
// Form for editing an existing course.

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/modules/ui/components/card';
import { Button } from '@/modules/ui/components/button';
import { Input } from '@/modules/ui/components/input';
import { Textarea } from '@/modules/ui/components/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/modules/ui/components/select';
import { ArrowLeft, Loader2, Pencil } from 'lucide-react';
import { useEducatorCourses, type CreateCourseInput } from '@/modules/educator/hooks/useEducatorCourses';
import type { Course } from '@/modules/courseLibrary/hooks/useCourseLibrary';

interface EditCourseFormProps {
  course: Course;
  onSuccess: () => void;
  onCancel: () => void;
}

export const EditCourseForm: React.FC<EditCourseFormProps> = ({
  course,
  onSuccess,
  onCancel,
}) => {
  const { updateCourse } = useEducatorCourses();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState<Partial<CreateCourseInput>>({
    title: course.title,
    code: course.code,
    description: course.description || '',
    department: course.department || '',
    level: `${course.level ?? ''}`,
    semester: `${course.semester ?? ''}`,
    schoolName: course.school_name || '',
    visibility: (course as any).visibility || 'public',
  });

  const updateField = <K extends keyof CreateCourseInput>(key: K, value: CreateCourseInput[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title?.trim() || !form.code?.trim()) return;

    setIsSubmitting(true);
    const success = await updateCourse(course.id, form);
    setIsSubmitting(false);

    if (success) onSuccess();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onCancel}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Edit Course</h2>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Pencil className="w-5 h-5 text-blue-500" />
              Edit: {course.code}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">
                  Course Title <span className="text-red-500">*</span>
                </label>
                <Input
                  value={form.title}
                  onChange={(e) => updateField('title', e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">
                  Course Code <span className="text-red-500">*</span>
                </label>
                <Input
                  value={form.code}
                  onChange={(e) => updateField('code', e.target.value.toUpperCase())}
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Description</label>
              <Textarea
                value={form.description}
                onChange={(e) => updateField('description', e.target.value)}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Department</label>
                <Input
                  value={form.department}
                  onChange={(e) => updateField('department', e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Level</label>
                <Input
                  value={form.level}
                  onChange={(e) => updateField('level', e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Semester</label>
                <Input
                  value={form.semester}
                  onChange={(e) => updateField('semester', e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Visibility</label>
              <Select
                value={form.visibility || 'public'}
                onValueChange={(v) => updateField('visibility', v as any)}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="institution">Institution Only</SelectItem>
                  <SelectItem value="private">Private</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="pt-2 flex gap-3">
              <Button type="button" variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || !form.title?.trim() || !form.code?.trim()}>
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
};

export default EditCourseForm;
