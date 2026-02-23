// src/components/educator/courses/CreateCourseForm.tsx
// Form for creating a new course with education context fields.

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Loader2, BookPlus } from 'lucide-react';
import { useEducatorCourses, type CreateCourseInput } from '@/hooks/useEducatorCourses';
import { useEducationContext } from '@/hooks/useEducationContext';

interface CreateCourseFormProps {
  institutionId?: string | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export const CreateCourseForm: React.FC<CreateCourseFormProps> = ({
  institutionId,
  onSuccess,
  onCancel,
}) => {
  const { createCourse } = useEducatorCourses(institutionId);
  const { educationContext } = useEducationContext();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState<CreateCourseInput>({
    title: '',
    code: '',
    description: '',
    department: '',
    level: '',
    semester: '',
    schoolName: '',
    institutionId: institutionId || undefined,
    countryId: educationContext?.country?.id,
    educationLevelId: educationContext?.educationLevel?.id,
    curriculumId: educationContext?.curriculum?.id,
    visibility: 'public',
  });

  const updateField = <K extends keyof CreateCourseInput>(key: K, value: CreateCourseInput[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.code.trim()) return;

    setIsSubmitting(true);
    const course = await createCourse(form);
    setIsSubmitting(false);

    if (course) {
      onSuccess();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onCancel}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Create New Course</h2>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BookPlus className="w-5 h-5 text-purple-500" />
              Course Details
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
                  placeholder="e.g. Introduction to Computer Science"
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
                  placeholder="e.g. CS101"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Description</label>
              <Textarea
                value={form.description}
                onChange={(e) => updateField('description', e.target.value)}
                placeholder="Course description..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Department</label>
                <Input
                  value={form.department}
                  onChange={(e) => updateField('department', e.target.value)}
                  placeholder="e.g. Computer Science"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Level</label>
                <Input
                  value={form.level}
                  onChange={(e) => updateField('level', e.target.value)}
                  placeholder="e.g. 100, Year 1"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Semester</label>
                <Input
                  value={form.semester}
                  onChange={(e) => updateField('semester', e.target.value)}
                  placeholder="e.g. Fall 2025"
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

            {/* Education context auto-filled info */}
            {educationContext && (
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-sm text-blue-700 dark:text-blue-300">
                This course will be tagged with your education context:{' '}
                {[
                  educationContext.curriculum?.name,
                  educationContext.educationLevel?.short_name,
                  educationContext.country?.name,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
            )}

            <div className="pt-2 flex gap-3">
              <Button type="button" variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || !form.title.trim() || !form.code.trim()}>
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Course
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
};

export default CreateCourseForm;
