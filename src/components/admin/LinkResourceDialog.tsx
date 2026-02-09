import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCourseResources, ResourceType } from '@/hooks/useCourseResources';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Link2,
  Loader2,
  Search,
  FileText,
  BrainCircuit,
  Headphones,
  NotebookPen,
  Mic,
  Check,
} from 'lucide-react';

interface LinkResourceDialogProps {
  courseId: string;
  courseTitle: string;
  onResourceLinked?: () => void;
}

const RESOURCE_TYPES: { value: ResourceType; label: string; icon: React.ElementType }[] = [
  { value: 'document', label: 'Document', icon: FileText },
  { value: 'quiz', label: 'Quiz', icon: BrainCircuit },
  { value: 'podcast', label: 'Podcast', icon: Headphones },
  { value: 'note', label: 'Note', icon: NotebookPen },
  { value: 'recording', label: 'Recording', icon: Mic },
];

export const LinkResourceDialog: React.FC<LinkResourceDialogProps> = ({
  courseId,
  courseTitle,
  onResourceLinked,
}) => {
  const { user } = useAuth();
  const { useAddResource, useResources } = useCourseResources();
  const addResource = useAddResource();
  const { data: existingResources } = useResources(courseId);

  const [open, setOpen] = useState(false);
  const [resourceType, setResourceType] = useState<ResourceType>('document');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedResource, setSelectedResource] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [titleOverride, setTitleOverride] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [isRequired, setIsRequired] = useState(false);

  // Fetch available resources based on type
  const { data: availableResources, isLoading: isSearching } = useQuery({
    queryKey: ['linkable-resources', resourceType, searchQuery],
    queryFn: async () => {
      const q = searchQuery.trim().toLowerCase();

      switch (resourceType) {
        case 'document': {
          let query = supabase
            .from('documents')
            .select('id, title, file_name, type')
            .order('created_at', { ascending: false })
            .limit(50);
          if (q) query = query.ilike('title', `%${q}%`);
          const { data, error } = await query;
          if (error) throw error;
          return (data ?? []).map((d) => ({
            id: d.id,
            title: d.title || d.file_name,
            subtitle: d.type,
          }));
        }
        case 'quiz': {
          let query = supabase
            .from('quizzes')
            .select('id, title, source_type, created_at')
            .order('created_at', { ascending: false })
            .limit(50);
          if (q) query = query.ilike('title', `%${q}%`);
          const { data, error } = await query;
          if (error) throw error;
          return (data ?? []).map((d) => ({
            id: d.id,
            title: d.title,
            subtitle: d.source_type || 'quiz',
          }));
        }
        case 'podcast': {
          let query = supabase
            .from('ai_podcasts')
            .select('id, title, style, status')
            .eq('status', 'completed')
            .order('created_at', { ascending: false })
            .limit(50);
          if (q) query = query.ilike('title', `%${q}%`);
          const { data, error } = await query;
          if (error) throw error;
          return (data ?? []).map((d) => ({
            id: d.id,
            title: d.title,
            subtitle: d.style,
          }));
        }
        case 'note': {
          let query = supabase
            .from('notes')
            .select('id, title, category')
            .order('created_at', { ascending: false })
            .limit(50);
          if (q) query = query.ilike('title', `%${q}%`);
          const { data, error } = await query;
          if (error) throw error;
          return (data ?? []).map((d) => ({
            id: d.id,
            title: d.title,
            subtitle: d.category || 'note',
          }));
        }
        case 'recording': {
          let query = supabase
            .from('class_recordings')
            .select('id, title, subject')
            .order('created_at', { ascending: false })
            .limit(50);
          if (q) query = query.ilike('title', `%${q}%`);
          const { data, error } = await query;
          if (error) throw error;
          return (data ?? []).map((d) => ({
            id: d.id,
            title: d.title,
            subtitle: d.subject,
          }));
        }
        default:
          return [];
      }
    },
    enabled: open,
  });

  // Check if resource is already linked
  const alreadyLinkedIds = new Set(
    existingResources
      ?.filter((r) => r.resource_type === resourceType)
      .map((r) => r.resource_id) ?? []
  );

  const handleLink = async () => {
    if (!selectedResource) {
      toast.error('Select a resource first');
      return;
    }

    try {
      await addResource.mutateAsync({
        course_id: courseId,
        resource_type: resourceType,
        resource_id: selectedResource.id,
        title: titleOverride.trim() || selectedResource.title,
        description: description.trim() || undefined,
        category: category.trim() || undefined,
        is_required: isRequired,
        created_by: user?.id,
      });
      toast.success(`${resourceType} linked to course`);
      resetForm();
      setOpen(false);
      onResourceLinked?.();
    } catch (err: any) {
      if (err?.message?.includes('duplicate') || err?.message?.includes('unique')) {
        toast.error('This resource is already linked to the course');
      } else {
        toast.error(err?.message || 'Failed to link resource');
      }
    }
  };

  const resetForm = () => {
    setSelectedResource(null);
    setTitleOverride('');
    setDescription('');
    setCategory('');
    setIsRequired(false);
    setSearchQuery('');
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Link2 className="h-4 w-4" /> Link Resource
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Link Resource to {courseTitle}</DialogTitle>
          <DialogDescription>
            Search for an existing resource and link it to this course.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Resource Type Selector */}
          <div className="flex gap-2 flex-wrap">
            {RESOURCE_TYPES.map(({ value, label, icon: Icon }) => (
              <Button
                key={value}
                variant={resourceType === value ? 'default' : 'outline'}
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  setResourceType(value);
                  setSelectedResource(null);
                  setSearchQuery('');
                }}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Button>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={`Search ${resourceType}s...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Results List */}
          <ScrollArea className="flex-1 max-h-[250px] border rounded-lg">
            <div className="p-2 space-y-1">
              {isSearching ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : availableResources?.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No {resourceType}s found
                </div>
              ) : (
                availableResources?.map((res) => {
                  const isLinked = alreadyLinkedIds.has(res.id);
                  const isSelected = selectedResource?.id === res.id;
                  return (
                    <div
                      key={res.id}
                      className={`flex items-center justify-between p-2.5 rounded-md cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-primary/10 border border-primary/30'
                          : isLinked
                          ? 'bg-muted/50 opacity-60 cursor-not-allowed'
                          : 'hover:bg-muted/50'
                      }`}
                      onClick={() => {
                        if (!isLinked) {
                          setSelectedResource({ id: res.id, title: res.title });
                          setTitleOverride(res.title);
                        }
                      }}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm truncate">{res.title}</div>
                        <div className="text-xs text-muted-foreground">{res.subtitle}</div>
                      </div>
                      {isLinked ? (
                        <Badge variant="secondary" className="text-xs shrink-0">
                          <Check className="h-3 w-3 mr-1" /> Linked
                        </Badge>
                      ) : isSelected ? (
                        <Badge className="text-xs shrink-0">Selected</Badge>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>

          {/* Details Form (shown when a resource is selected) */}
          {selectedResource && (
            <div className="space-y-3 border-t pt-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Display Title</Label>
                  <Input
                    value={titleOverride}
                    onChange={(e) => setTitleOverride(e.target.value)}
                    placeholder={selectedResource.title}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Category / Group</Label>
                  <Input
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="e.g., Week 1, Midterm Prep"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Description (optional)</Label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Short description..."
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is-required"
                  checked={isRequired}
                  onCheckedChange={(v) => setIsRequired(v === true)}
                />
                <Label htmlFor="is-required" className="text-sm cursor-pointer">
                  Required for course completion
                </Label>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleLink} disabled={!selectedResource || addResource.isPending}>
            {addResource.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Link2 className="h-4 w-4 mr-2" />
            )}
            Link to Course
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
