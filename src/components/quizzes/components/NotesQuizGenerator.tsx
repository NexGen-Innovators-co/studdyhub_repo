// src/components/quizzes/components/NotesQuizGenerator.tsx - UPDATED
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { Textarea } from '../../ui/textarea';
import { FileText, Sparkles, Upload, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import { NotesSelector } from './NoteSelector';

interface Note {
  id: string;
  title: string;
  content: string;
  category: string;
  created_at: string;
  ai_summary?: string;
}

interface NotesQuizGeneratorProps {
  onGenerateQuizFromNotes: (notesContent: string, numQuestions: number, difficulty: string) => Promise<void>;
  isLoading?: boolean;
}

export const NotesQuizGenerator: React.FC<NotesQuizGeneratorProps> = ({
  onGenerateQuizFromNotes,
  isLoading = false
}) => {
  const [activeTab, setActiveTab] = useState<'saved' | 'paste'>('saved');
  const [notesText, setNotesText] = useState('');
  const [selectedNotes, setSelectedNotes] = useState<Note[]>([]);
  const [numQuestions, setNumQuestions] = useState<number>(5);
  const [difficulty, setDifficulty] = useState<string>('intermediate');

  const handleGenerate = async () => {
    let notesContent = '';

    if (activeTab === 'saved') {
      if (selectedNotes.length === 0) {
        toast.error('Please select at least one note');
        return;
      }
      // Combine selected notes content
      notesContent = selectedNotes.map(note => 
        `=== ${note.title} (${note.category}) ===\n${note.content}${note.ai_summary ? `\n\nAI Summary: ${note.ai_summary}` : ''}`
      ).join('\n\n');
    } else {
      if (!notesText.trim()) {
        toast.error('Please enter some notes content');
        return;
      }

      if (notesText.split(' ').length < 20) {
        toast.error('Please provide more detailed notes (at least 20 words) for better quiz generation');
        return;
      }
      notesContent = notesText;
    }

    await onGenerateQuizFromNotes(notesContent, numQuestions, difficulty);
    
    // Reset form
    if (activeTab === 'paste') {
      setNotesText('');
    }
    setSelectedNotes([]);
  };

  const getTotalContentLength = () => {
    if (activeTab === 'saved') {
      return selectedNotes.reduce((total, note) => total + note.content.length, 0);
    }
    return notesText.length;
  };

  const getWordCount = () => {
    if (activeTab === 'saved') {
      const combinedContent = selectedNotes.map(note => note.content).join(' ');
      return combinedContent.split(/\s+/).filter(word => word.length > 0).length;
    }
    return notesText.split(/\s+/).filter(word => word.length > 0).length;
  };

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-green-500" />
          Generate Quiz from Notes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={activeTab} onValueChange={(value: any) => setActiveTab(value)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="saved" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Saved Notes
            </TabsTrigger>
            <TabsTrigger value="paste" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Paste Text
            </TabsTrigger>
          </TabsList>

          <TabsContent value="saved" className="space-y-4">
            <NotesSelector
              onNotesSelect={setSelectedNotes}
              selectedNotes={selectedNotes}
            />
          </TabsContent>

          <TabsContent value="paste" className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Paste Your Notes</label>
              <Textarea
                value={notesText}
                onChange={(e) => setNotesText(e.target.value)}
                placeholder="Paste your study notes here... (minimum 20 words for best results)"
                className="min-h-[200px] resize-none"
                disabled={isLoading}
              />
              <p className="text-xs text-gray-500 mt-1">
                {getWordCount()} words, {getTotalContentLength()} characters
              </p>
            </div>
          </TabsContent>
        </Tabs>

        {/* Configuration Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t dark:border-gray-700">
          <div>
            <label className="text-sm font-medium mb-2 block">Number of Questions</label>
            <Select value={numQuestions.toString()} onValueChange={(val) => setNumQuestions(parseInt(val))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3 Questions</SelectItem>
                <SelectItem value="5">5 Questions</SelectItem>
                <SelectItem value="10">10 Questions</SelectItem>
                <SelectItem value="15">15 Questions</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Difficulty</label>
            <Select value={difficulty} onValueChange={setDifficulty}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="intermediate">Intermediate</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Generation Info */}
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-blue-800 dark:text-blue-200">
            <Sparkles className="h-4 w-4" />
            <div>
              <strong>Ready to generate:</strong> {getWordCount()} words from {
                activeTab === 'saved' 
                  ? `${selectedNotes.length} note${selectedNotes.length !== 1 ? 's' : ''}` 
                  : 'pasted text'
              }
            </div>
          </div>
        </div>
        
        <Button
          onClick={handleGenerate}
          disabled={
            isLoading || 
            (activeTab === 'saved' && selectedNotes.length === 0) ||
            (activeTab === 'paste' && !notesText.trim())
          }
          className="w-full bg-green-600 hover:bg-green-700"
        >
          <Sparkles className="h-4 w-4 mr-2" />
          {isLoading ? 'Generating Quiz...' : 'Generate Quiz from Notes'}
        </Button>
      </CardContent>
    </Card>
  );
};