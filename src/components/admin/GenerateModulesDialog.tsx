import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Sparkles, Loader2, BookOpen, Plus, Trash2, Check, Wand2, Edit2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAppContext } from '@/hooks/useAppContext';
import { generateInlineContent } from '@/services/aiServices';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface GeneratedModule {
  title: string;
  description: string;
  category: string;
  selected: boolean;
  generating?: boolean;
  generated?: boolean;
}

interface GenerateModulesDialogProps {
  courseId: string;
  courseTitle: string;
  courseCode: string;
  userId: string | undefined;
  onModulesAdded: () => void;
}

export function GenerateModulesDialog({
  courseId,
  courseTitle,
  courseCode,
  userId,
  onModulesAdded,
}: GenerateModulesDialogProps) {
  const { userProfile } = useAppContext();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'configure' | 'review' | 'saving'>('configure');

  // Config step
  const [topic, setTopic] = useState('');
  const [moduleCount, setModuleCount] = useState('5');
  const [isGenerating, setIsGenerating] = useState(false);

  // Review step
  const [modules, setModules] = useState<GeneratedModule[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [savingProgress, setSavingProgress] = useState(0);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const resetState = () => {
    setStep('configure');
    setTopic('');
    setModuleCount('5');
    setModules([]);
    setIsGenerating(false);
    setIsSaving(false);
    setSavingProgress(0);
    setEditingIndex(null);
  };

  const handleGenerate = async () => {
    if (!userProfile) {
      toast.error('You must be logged in');
      return;
    }

    const effectiveTopic = topic.trim() || `${courseCode} - ${courseTitle}`;
    setIsGenerating(true);

    try {
      const prompt = `
Generate a list of ${moduleCount} course modules/materials for the course: "${courseCode} - ${courseTitle}".
${topic.trim() ? `Focus area: "${topic.trim()}"` : ''}

You MUST return strict JSON format ONLY. No markdown, no extra text.
Return an array of objects:
[
  {
    "title": "Module 1: Title Here",
    "description": "A 2-3 sentence description of what this module covers.",
    "category": "lecture_notes"
  }
]

Valid categories: "lecture_notes", "slides", "past_questions", "textbook", "other".
Make titles descriptive and academic. Descriptions should outline learning objectives.`;

      const { data, error } = await supabase.functions.invoke('generate-inline-content', {
        body: {
          selectedText: effectiveTopic,
          fullNoteContent: '',
          userProfile,
          actionType: 'generate_course_modules',
          customInstruction: prompt,
          attachedDocumentContent: '',
        },
      });

      if (error) throw error;

      let content = data.generatedContent;
      content = content.replace(/```json/g, '').replace(/```/g, '').trim();

      // Handle both array and object-with-modules formats
      let parsed: any;
      try {
        parsed = JSON.parse(content);
      } catch {
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('AI returned invalid format');
        }
      }

      const moduleArray = Array.isArray(parsed) ? parsed : parsed.modules || [];

      if (moduleArray.length === 0) {
        throw new Error('AI did not return any modules');
      }

      setModules(
        moduleArray.map((m: any) => ({
          title: m.title || 'Untitled Module',
          description: m.description || '',
          category: m.category || 'lecture_notes',
          selected: true,
        }))
      );
      setStep('review');
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate modules');
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleModule = (index: number) => {
    setModules((prev) =>
      prev.map((m, i) => (i === index ? { ...m, selected: !m.selected } : m))
    );
  };

  const toggleAll = () => {
    const allSelected = modules.every((m) => m.selected);
    setModules((prev) => prev.map((m) => ({ ...m, selected: !allSelected })));
  };

  const removeModule = (index: number) => {
    setModules((prev) => prev.filter((_, i) => i !== index));
  };

  const updateModule = (index: number, field: keyof GeneratedModule, value: string) => {
    setModules((prev) =>
      prev.map((m, i) => (i === index ? { ...m, [field]: value } : m))
    );
  };

  const addEmptyModule = () => {
    setModules((prev) => [
      ...prev,
      { title: '', description: '', category: 'lecture_notes', selected: true },
    ]);
    setEditingIndex(modules.length);
  };

  const handleSaveModules = async () => {
    const selectedModules = modules.filter((m) => m.selected && m.title.trim());
    if (selectedModules.length === 0) {
      toast.error('Select at least one module to add');
      return;
    }

    if (!userId || !userProfile) {
      toast.error('Authentication required');
      return;
    }

    setStep('saving');
    setIsSaving(true);
    setSavingProgress(0);

    const normalizeCategory = (raw?: string) => {
      if (!raw) return 'lecture_notes';
      const s = raw.toLowerCase();
      if (s.includes('lecture') || s.includes('notes')) return 'lecture_notes';
      if (s.includes('past') && s.includes('question')) return 'past_questions';
      if (s === 'past_questions') return 'past_questions';
      if (s.includes('slide')) return 'slides';
      if (s.includes('textbook') || s.includes('book')) return 'textbook';
      return 'other';
    };

    let saved = 0;

    for (let i = 0; i < selectedModules.length; i++) {
      const mod = selectedModules[i];
      setSavingProgress(Math.round(((i) / selectedModules.length) * 100));

      // Update the module's generating state
      const modIndex = modules.indexOf(mod);
      setModules((prev) =>
        prev.map((m, idx) => (idx === modIndex ? { ...m, generating: true } : m))
      );

      try {
        // Generate expanded content for the module
        let content = mod.description;
        try {
          const expanded = await generateInlineContent(
            mod.title,
            mod.description,
            userProfile,
            'generate_module_notes',
            `Create detailed lecture notes for the module titled "${mod.title}" in the course "${courseCode} - ${courseTitle}". Include explanations, key concepts, examples, and a summary.`
          );
          if (expanded?.trim()) content = expanded.trim();
        } catch {
          // Use description as fallback
        }

        const sanitize = (name: string) =>
          name.replace(/[^a-z0-9\-_. ]+/gi, '').replace(/\s+/g, '_').slice(0, 200);

        // Create document
        const { data: doc, error: docError } = await supabase
          .from('documents')
          .insert({
            user_id: userId,
            title: `${courseTitle} - ${mod.title}`,
            file_name: sanitize(`${courseTitle}-${mod.title}.md`),
            file_url: '',
            file_type: 'text/markdown',
            is_public: true,
            file_size: content.length,
            content_extracted: content,
            type: 'ai_generated',
            processing_status: 'completed',
          })
          .select()
          .single();

        if (docError) throw docError;

        // Create note
        await supabase.from('notes').insert({
          user_id: userId,
          title: mod.title,
          content,
          category: 'course',
          document_id: doc?.id || null,
        });

        // Create course material
        await supabase.from('course_materials').insert({
          course_id: courseId,
          title: mod.title,
          description: mod.description,
          category: normalizeCategory(mod.category),
          document_id: doc?.id || null,
        });

        saved++;
        setModules((prev) =>
          prev.map((m, idx) =>
            idx === modIndex ? { ...m, generating: false, generated: true } : m
          )
        );
      } catch (err: any) {
        setModules((prev) =>
          prev.map((m, idx) => (idx === modIndex ? { ...m, generating: false } : m))
        );
        console.error('Failed to save module:', mod.title, err);
      }
    }

    setSavingProgress(100);
    setIsSaving(false);

    if (saved > 0) {
      toast.success(`Added ${saved} module${saved > 1 ? 's' : ''} to ${courseCode}`);
      onModulesAdded();
      setOpen(false);
      resetState();
    } else {
      toast.error('Failed to save any modules');
      setStep('review');
    }
  };

  const selectedCount = modules.filter((m) => m.selected).length;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) resetState();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-2">
          <Sparkles className="h-4 w-4 text-purple-500" />
          AI Generate Modules
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            {step === 'configure' && 'Generate Modules with AI'}
            {step === 'review' && 'Review & Select Modules'}
            {step === 'saving' && 'Saving Modules...'}
          </DialogTitle>
          <DialogDescription>
            {step === 'configure' &&
              `AI will generate module outlines for "${courseCode}". You can review and edit before saving.`}
            {step === 'review' &&
              `Select and edit the modules you want to add. AI will generate detailed content for each.`}
            {step === 'saving' &&
              `Generating content and saving modules... (${savingProgress}%)`}
          </DialogDescription>
        </DialogHeader>

        {/* CONFIGURE STEP */}
        {step === 'configure' && (
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="ai-topic">Focus / Topic (optional)</Label>
              <Input
                id="ai-topic"
                placeholder={`Leave blank to generate for the full course, or focus on a subtopic...`}
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Number of Modules</Label>
              <Select value={moduleCount} onValueChange={setModuleCount}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 Modules</SelectItem>
                  <SelectItem value="5">5 Modules</SelectItem>
                  <SelectItem value="8">8 Modules</SelectItem>
                  <SelectItem value="10">10 Modules</SelectItem>
                  <SelectItem value="12">12 Modules</SelectItem>
                  <SelectItem value="15">15 Modules</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* REVIEW STEP */}
        {(step === 'review' || step === 'saving') && (
          <div className="flex-1 overflow-y-auto space-y-2 py-2 pr-1 max-h-[50vh]">
            {step === 'review' && (
              <div className="flex items-center justify-between mb-3">
                <Button variant="ghost" size="sm" onClick={toggleAll} className="text-xs">
                  {modules.every((m) => m.selected) ? 'Deselect All' : 'Select All'}
                </Button>
                <Button variant="ghost" size="sm" onClick={addEmptyModule} className="text-xs gap-1">
                  <Plus className="h-3 w-3" /> Add Custom
                </Button>
              </div>
            )}

            {modules.map((mod, index) => (
              <div
                key={index}
                className={cn(
                  'rounded-lg border p-3 transition-all',
                  mod.selected
                    ? 'border-primary/40 bg-primary/5'
                    : 'border-muted opacity-60',
                  mod.generated && 'border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20',
                  mod.generating && 'border-blue-300 animate-pulse'
                )}
              >
                <div className="flex items-start gap-3">
                  {/* Selection checkbox */}
                  <button
                    type="button"
                    onClick={() => step === 'review' && toggleModule(index)}
                    disabled={step === 'saving'}
                    className={cn(
                      'mt-1 h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
                      mod.generated
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : mod.selected
                        ? 'bg-primary border-primary text-primary-foreground'
                        : 'border-muted-foreground/30'
                    )}
                  >
                    {(mod.selected || mod.generated) && <Check className="h-3 w-3" />}
                  </button>

                  <div className="flex-1 min-w-0">
                    {editingIndex === index && step === 'review' ? (
                      <div className="space-y-2">
                        <Input
                          value={mod.title}
                          onChange={(e) => updateModule(index, 'title', e.target.value)}
                          placeholder="Module title"
                          className="text-sm font-medium"
                        />
                        <Textarea
                          value={mod.description}
                          onChange={(e) => updateModule(index, 'description', e.target.value)}
                          placeholder="Module description"
                          className="text-sm min-h-[60px]"
                        />
                        <Select
                          value={mod.category}
                          onValueChange={(v) => updateModule(index, 'category', v)}
                        >
                          <SelectTrigger className="text-xs h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="lecture_notes">Lecture Notes</SelectItem>
                            <SelectItem value="slides">Slides</SelectItem>
                            <SelectItem value="past_questions">Past Questions</SelectItem>
                            <SelectItem value="textbook">Textbook</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingIndex(null)}
                          className="text-xs"
                        >
                          Done editing
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium leading-tight">
                            {mod.title || 'Untitled Module'}
                          </span>
                          {mod.generating && (
                            <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                          )}
                          {mod.generated && (
                            <Check className="h-3 w-3 text-emerald-500" />
                          )}
                        </div>
                        {mod.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {mod.description}
                          </p>
                        )}
                        <span className="text-[10px] text-muted-foreground/60 mt-1 inline-block">
                          {mod.category.replace(/_/g, ' ')}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Actions */}
                  {step === 'review' && (
                    <div className="flex gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() =>
                          setEditingIndex(editingIndex === index ? null : index)
                        }
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => removeModule(index)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Saving progress bar */}
        {step === 'saving' && (
          <div className="w-full bg-muted rounded-full h-2 mt-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-500"
              style={{ width: `${savingProgress}%` }}
            />
          </div>
        )}

        <DialogFooter className="mt-4">
          {step === 'configure' && (
            <>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={isGenerating}>
                Cancel
              </Button>
              <Button onClick={handleGenerate} disabled={isGenerating} className="gap-2">
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4" />
                    Generate Modules
                  </>
                )}
              </Button>
            </>
          )}
          {step === 'review' && (
            <>
              <Button variant="outline" onClick={() => setStep('configure')}>
                Back
              </Button>
              <Button
                onClick={handleSaveModules}
                disabled={selectedCount === 0}
                className="gap-2"
              >
                <BookOpen className="h-4 w-4" />
                Save {selectedCount} Module{selectedCount !== 1 ? 's' : ''}
              </Button>
            </>
          )}
          {step === 'saving' && (
            <Button disabled className="gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving {savingProgress}%...
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
