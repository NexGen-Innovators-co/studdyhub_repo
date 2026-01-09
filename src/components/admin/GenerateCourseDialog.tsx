import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Sparkles, Loader2, BookOpen } from 'lucide-react';
import { generateCourseStructure, AIGeneratedCourse } from '@/services/aiServices';
import { useAppContext } from '@/hooks/useAppContext';
import { toast } from 'sonner';

interface GenerateCourseDialogProps {
  onCourseGenerated: (courseData: AIGeneratedCourse) => void;
}

export function GenerateCourseDialog({ onCourseGenerated }: GenerateCourseDialogProps) {
  const { userProfile } = useAppContext();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Form State
  const [topic, setTopic] = useState('');
  const [level, setLevel] = useState('Beginner');
  const [moduleCount, setModuleCount] = useState('5');

  const handleGenerate = async () => {
    if (!topic.trim()) {
      toast.error('Please enter a course topic');
      return;
    }
    
    if (!userProfile) {
      toast.error('You must be logged in to generate courses');
      return;
    }

    setLoading(true);
    try {
      const courseData = await generateCourseStructure(
        topic,
        level,
        parseInt(moduleCount),
        userProfile
      );
      
      onCourseGenerated(courseData);
      setOpen(false);
      toast.success('Course structure generated successfully!');
      
      // Reset form
      setTopic('');
      setLevel('Beginner');
      setModuleCount('5');
      
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate course');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 border-primary/20 hover:bg-primary/5">
          <Sparkles className="h-4 w-4 text-purple-500" />
          Generate with AI
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            Generate Course Structure
          </DialogTitle>
          <DialogDescription>
            Enter a topic and let AI create a comprehensive course curriculum including modules and descriptions.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="topic">Course Topic</Label>
            <Input
              id="topic"
              placeholder="e.g., Introduction to Machine Learning"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="level">Level</Label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger id="level">
                  <SelectValue placeholder="Select level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Beginner">Beginner</SelectItem>
                  <SelectItem value="Intermediate">Intermediate</SelectItem>
                  <SelectItem value="Advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="modules">Modules</Label>
              <Select value={moduleCount} onValueChange={setModuleCount}>
                <SelectTrigger id="modules">
                  <SelectValue placeholder="Count" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 Modules</SelectItem>
                  <SelectItem value="5">5 Modules</SelectItem>
                  <SelectItem value="8">8 Modules</SelectItem>
                  <SelectItem value="10">10 Modules</SelectItem>
                  <SelectItem value="12">12 Modules</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleGenerate} disabled={loading} className="gap-2">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <BookOpen className="h-4 w-4" />
                Generate Course
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
