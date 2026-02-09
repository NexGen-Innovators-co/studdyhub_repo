/**
 * GenerateCourseResourcesDialog
 *
 * Admin/creator dialog that uses AI to auto-generate quizzes, notes,
 * podcasts, and flashcards from a course's existing documents & materials,
 * then auto-links them as course_resources.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sparkles,
  Loader2,
  BrainCircuit,
  NotebookPen,
  Headphones,
  Layers,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  generateCourseResources,
  GenerationResourceType,
  GenerationProgress,
  GenerationRequest,
} from '@/services/courseAIGenerationService';
import { useAppContext } from '@/hooks/useAppContext';
import { toast } from 'sonner';

interface GenerateCourseResourcesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
  courseTitle: string;
  courseCode: string;
  userId: string;
  /** Called when generation finishes so parent can refetch resources */
  onComplete: () => void;
}

const RESOURCE_OPTIONS: {
  type: GenerationResourceType;
  label: string;
  description: string;
  icon: React.ElementType;
}[] = [
  {
    type: 'quiz',
    label: 'Quizzes',
    description: 'Multiple-choice questions from course content',
    icon: BrainCircuit,
  },
  {
    type: 'notes',
    label: 'Study Notes',
    description: 'Structured summaries with key concepts & visual aids',
    icon: NotebookPen,
  },
  {
    type: 'podcast',
    label: 'Podcast',
    description: 'AI-narrated audio walkthrough of course material',
    icon: Headphones,
  },
  {
    type: 'flashcards',
    label: 'Flashcards',
    description: 'Quick review cards for key terms & concepts',
    icon: Layers,
  },
];

const statusIcon = (status: GenerationProgress['status']) => {
  switch (status) {
    case 'done':
      return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    case 'error':
      return <XCircle className="w-4 h-4 text-red-500" />;
    case 'pending':
      return <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30" />;
    default:
      return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
  }
};

export function GenerateCourseResourcesDialog({
  open,
  onOpenChange,
  courseId,
  courseTitle,
  courseCode,
  userId,
  onComplete,
}: GenerateCourseResourcesDialogProps) {
  const { userProfile } = useAppContext();

  // Selection step
  const [selectedTypes, setSelectedTypes] = useState<Set<GenerationResourceType>>(
    new Set(['quiz', 'notes'])
  );
  const [quizDifficulty, setQuizDifficulty] = useState('medium');
  const [quizCount, setQuizCount] = useState('10');
  const [podcastStyle, setPodcastStyle] = useState<'casual' | 'educational' | 'deep-dive'>('educational');
  const [podcastDuration, setPodcastDuration] = useState<'short' | 'medium' | 'long'>('medium');
  const [flashcardCount, setFlashcardCount] = useState('20');

  // Progress step
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<GenerationProgress[]>([]);

  const toggleType = (type: GenerationResourceType) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const handleGenerate = async () => {
    if (selectedTypes.size === 0) {
      toast.error('Select at least one resource type');
      return;
    }
    if (!userProfile) {
      toast.error('User profile not loaded');
      return;
    }

    setIsGenerating(true);

    const request: GenerationRequest = {
      courseId,
      courseTitle,
      courseCode,
      userId,
      userProfile,
      resourceTypes: Array.from(selectedTypes),
      options: {
        quizNumQuestions: parseInt(quizCount, 10),
        quizDifficulty,
        podcastStyle,
        podcastDuration,
        flashcardCount: parseInt(flashcardCount, 10),
      },
    };

    try {
      await generateCourseResources(request, (p) => setProgress([...p]));
      toast.success('AI generation complete!');
      onComplete();
    } catch (err: any) {
      toast.error(err.message || 'Generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClose = () => {
    if (isGenerating) return; // prevent close while generating
    setProgress([]);
    onOpenChange(false);
  };

  const allDone = progress.length > 0 && progress.every((p) => p.status === 'done' || p.status === 'error');

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-yellow-100 to-amber-100 dark:from-yellow-900/30 dark:to-amber-900/30">
              <Sparkles className="w-5 h-5 text-yellow-500" />
            </div>
            AI Generate Course Resources
          </DialogTitle>
          <DialogDescription>
            The AI will analyze all documents and materials in{' '}
            <span className="font-medium">{courseCode}</span> and generate the selected resources
            automatically.
          </DialogDescription>
        </DialogHeader>

        {/* ── Selection Step ─────────────────────────── */}
        {!isGenerating && progress.length === 0 && (
          <div className="space-y-5 py-2">
            {/* Resource type checkboxes */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Select what to generate</Label>
              {RESOURCE_OPTIONS.map(({ type, label, description, icon: Icon }) => (
                <label
                  key={type}
                  className={cn(
                    'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                    selectedTypes.has(type)
                      ? 'border-blue-500 bg-blue-500/5'
                      : 'border-border hover:bg-muted/50'
                  )}
                >
                  <Checkbox
                    checked={selectedTypes.has(type)}
                    onCheckedChange={() => toggleType(type)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium text-sm">{label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                  </div>
                </label>
              ))}
            </div>

            {/* Quiz options */}
            {selectedTypes.has('quiz') && (
              <div className="grid grid-cols-2 gap-3 pl-8">
                <div>
                  <Label className="text-xs">Questions</Label>
                  <Select value={quizCount} onValueChange={setQuizCount}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 questions</SelectItem>
                      <SelectItem value="10">10 questions</SelectItem>
                      <SelectItem value="15">15 questions</SelectItem>
                      <SelectItem value="20">20 questions</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Difficulty</Label>
                  <Select value={quizDifficulty} onValueChange={setQuizDifficulty}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Podcast options */}
            {selectedTypes.has('podcast') && (
              <div className="grid grid-cols-2 gap-3 pl-8">
                <div>
                  <Label className="text-xs">Style</Label>
                  <Select value={podcastStyle} onValueChange={(v) => setPodcastStyle(v as any)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="casual">Casual</SelectItem>
                      <SelectItem value="educational">Educational</SelectItem>
                      <SelectItem value="deep-dive">Deep Dive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Duration</Label>
                  <Select value={podcastDuration} onValueChange={(v) => setPodcastDuration(v as any)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="short">Short (~5 min)</SelectItem>
                      <SelectItem value="medium">Medium (~15 min)</SelectItem>
                      <SelectItem value="long">Long (~30 min)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Flashcard options */}
            {selectedTypes.has('flashcards') && (
              <div className="grid grid-cols-2 gap-3 pl-8">
                <div>
                  <Label className="text-xs">Number of Cards</Label>
                  <Select value={flashcardCount} onValueChange={setFlashcardCount}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10 cards</SelectItem>
                      <SelectItem value="20">20 cards</SelectItem>
                      <SelectItem value="30">30 cards</SelectItem>
                      <SelectItem value="50">50 cards</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Info box */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>
                The AI uses all documents, materials, and notes linked to this course as source
                content. Make sure you've uploaded or linked the materials you want the AI to learn
                from before generating.
              </p>
            </div>
          </div>
        )}

        {/* ── Progress Step ──────────────────────────── */}
        {(isGenerating || progress.length > 0) && (
          <div className="space-y-3 py-2">
            {progress.map((p) => (
              <div
                key={p.type}
                className={cn(
                  'flex items-start gap-3 p-3 rounded-lg border',
                  p.status === 'done' && 'border-green-500/30 bg-green-500/5',
                  p.status === 'error' && 'border-red-500/30 bg-red-500/5',
                  p.status !== 'done' && p.status !== 'error' && p.status !== 'pending' && 'border-blue-500/30 bg-blue-500/5'
                )}
              >
                {statusIcon(p.status)}
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-sm capitalize">{p.type}</span>
                  <p className="text-xs text-muted-foreground">{p.message}</p>
                </div>
              </div>
            ))}

            {allDone && (
              <p className="text-center text-sm text-muted-foreground pt-2">
                All tasks complete. Resources have been auto-linked to the course.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          {!isGenerating && progress.length === 0 && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={selectedTypes.size === 0}
                className="gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-lg"
              >
                <Sparkles className="w-4 h-4" />
                Generate {selectedTypes.size} Resource{selectedTypes.size !== 1 ? 's' : ''}
              </Button>
            </>
          )}

          {isGenerating && (
            <Button disabled className="gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating...
            </Button>
          )}

          {allDone && (
            <Button onClick={handleClose} className="bg-green-600 hover:bg-green-700 text-white">Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
