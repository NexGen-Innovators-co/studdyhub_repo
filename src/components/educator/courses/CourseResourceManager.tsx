// src/components/educator/courses/CourseResourceManager.tsx
// Allows educators to manage resources within their courses:
// add/remove/reorder resources, mark as required.

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import {
  FileText,
  BrainCircuit,
  Headphones,
  NotebookPen,
  Mic,
  Plus,
  Trash2,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Loader2,
  Package,
  Star,
} from 'lucide-react';
import { useCourseResources, type ResourceType, type CourseResource } from '@/hooks/useCourseResources';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface CourseResourceManagerProps {
  courseId: string;
  courseTitle: string;
  onBack?: () => void;
}

const RESOURCE_TYPE_CONFIG: Record<ResourceType, { label: string; icon: React.ElementType; color: string }> = {
  document: { label: 'Document', icon: FileText, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  quiz: { label: 'Quiz', icon: BrainCircuit, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  podcast: { label: 'Podcast', icon: Headphones, color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
  note: { label: 'Note', icon: NotebookPen, color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  recording: { label: 'Recording', icon: Mic, color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
};

export const CourseResourceManager: React.FC<CourseResourceManagerProps> = ({
  courseId,
  courseTitle,
  onBack,
}) => {
  const { user } = useAuth();
  const { useResources, useAddResource, useRemoveResource } = useCourseResources();
  const { data: resources = [], isLoading } = useResources(courseId);
  const addResource = useAddResource();
  const removeResource = useRemoveResource();

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [resourceToDelete, setResourceToDelete] = useState<CourseResource | null>(null);

  // Add form state
  const [newType, setNewType] = useState<ResourceType>('document');
  const [newResourceId, setNewResourceId] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newIsRequired, setNewIsRequired] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  const resetForm = () => {
    setNewType('document');
    setNewResourceId('');
    setNewTitle('');
    setNewDescription('');
    setNewIsRequired(false);
  };

  const handleAdd = async () => {
    if (!newTitle.trim() || !newResourceId.trim()) {
      toast.error('Title and Resource ID are required');
      return;
    }

    setIsAdding(true);
    try {
      await addResource.mutateAsync({
        course_id: courseId,
        resource_type: newType,
        resource_id: newResourceId.trim(),
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
        sort_order: resources.length,
        is_required: newIsRequired,
        created_by: user?.id,
      });
      toast.success('Resource added to course');
      resetForm();
      setShowAddDialog(false);
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to add resource');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async () => {
    if (!resourceToDelete) return;
    try {
      await removeResource.mutateAsync({
        resourceId: resourceToDelete.id,
        courseId,
      });
      toast.success('Resource removed from course');
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to remove resource');
    } finally {
      setResourceToDelete(null);
    }
  };

  const sortedResources = [...resources].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          {onBack && (
            <button
              onClick={onBack}
              className="text-sm text-blue-600 hover:underline mb-1 block"
            >
              ← Back to courses
            </button>
          )}
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Course Resources
          </h2>
          <p className="text-sm text-gray-500">{courseTitle}</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Add Resource
        </Button>
      </div>

      {/* Resource counts by type */}
      <div className="flex flex-wrap gap-2">
        {(Object.entries(RESOURCE_TYPE_CONFIG) as [ResourceType, typeof RESOURCE_TYPE_CONFIG[ResourceType]][]).map(
          ([type, config]) => {
            const count = resources.filter((r) => r.resource_type === type).length;
            return (
              <Badge key={type} variant="secondary" className={`${config.color} text-xs`}>
                <config.icon className="w-3 h-3 mr-1" />
                {count} {config.label}{count !== 1 ? 's' : ''}
              </Badge>
            );
          }
        )}
      </div>

      {/* Resource list */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : sortedResources.length === 0 ? (
        <div className="text-center py-12">
          <Package className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            No Resources Yet
          </h3>
          <p className="text-gray-500 mb-4">
            Add quizzes, notes, podcasts, documents, or recordings to this course.
          </p>
          <Button onClick={() => setShowAddDialog(true)} variant="outline">
            <Plus className="w-4 h-4 mr-2" />
            Add First Resource
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {sortedResources.map((resource, idx) => {
            const config = RESOURCE_TYPE_CONFIG[resource.resource_type];
            const Icon = config.icon;
            return (
              <Card key={resource.id} className="rounded-xl hover:shadow-sm transition-shadow">
                <CardContent className="p-4 flex items-center gap-3">
                  <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0" />
                  <div className={`p-2 rounded-lg ${config.color} flex-shrink-0`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 dark:text-white truncate">
                        {resource.title}
                      </p>
                      {resource.is_required && (
                        <Badge variant="outline" className="text-xs flex-shrink-0">
                          <Star className="w-3 h-3 mr-0.5" />
                          Required
                        </Badge>
                      )}
                    </div>
                    {resource.description && (
                      <p className="text-xs text-gray-500 truncate">{resource.description}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">
                      {config.label} · Order: {resource.sort_order}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-500 hover:text-red-700 flex-shrink-0"
                    onClick={() => setResourceToDelete(resource)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Resource Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Resource to Course</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="mb-1.5 block">Resource Type</Label>
              <Select value={newType} onValueChange={(v) => setNewType(v as ResourceType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(RESOURCE_TYPE_CONFIG) as [ResourceType, typeof RESOURCE_TYPE_CONFIG[ResourceType]][]).map(
                    ([type, config]) => (
                      <SelectItem key={type} value={type}>
                        <div className="flex items-center gap-2">
                          <config.icon className="w-4 h-4" />
                          {config.label}
                        </div>
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-1.5 block">Resource ID</Label>
              <Input
                placeholder="UUID of the existing resource"
                value={newResourceId}
                onChange={(e) => setNewResourceId(e.target.value)}
              />
              <p className="text-xs text-gray-400 mt-1">
                The ID of an existing quiz, note, podcast, document, or recording
              </p>
            </div>

            <div>
              <Label className="mb-1.5 block">Title</Label>
              <Input
                placeholder="Display title for this resource"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
            </div>

            <div>
              <Label className="mb-1.5 block">Description (optional)</Label>
              <Textarea
                placeholder="Brief description..."
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={2}
              />
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={newIsRequired}
                onCheckedChange={setNewIsRequired}
              />
              <Label>Mark as required for course completion</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { resetForm(); setShowAddDialog(false); }}>
              Cancel
            </Button>
            <Button
              onClick={handleAdd}
              disabled={!newTitle.trim() || !newResourceId.trim() || isAdding}
            >
              {isAdding && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Add Resource
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!resourceToDelete} onOpenChange={(open) => !open && setResourceToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Resource</AlertDialogTitle>
            <AlertDialogDescription>
              Remove "{resourceToDelete?.title}" from this course? The original resource won't be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CourseResourceManager;
