
import React, { useState, useEffect } from 'react';
import { Sparkles, Hash, Save, Brain } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Note, NoteCategory } from '../types/Note';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface NoteEditorProps {
  note: Note;
  onNoteUpdate: (note: Note) => void;
}

export const NoteEditor: React.FC<NoteEditorProps> = ({ note, onNoteUpdate }) => {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [category, setCategory] = useState<NoteCategory>(note.category);
  const [tags, setTags] = useState(note.tags.join(', '));
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  useEffect(() => {
    setTitle(note.title);
    setContent(note.content);
    setCategory(note.category);
    setTags(note.tags.join(', '));
  }, [note]);

  const handleSave = () => {
    const updatedNote: Note = {
      ...note,
      title: title || 'Untitled Note',
      content,
      category,
      tags: tags.split(',').map(tag => tag.trim()).filter(tag => tag !== ''),
      updatedAt: new Date()
    };
    
    onNoteUpdate(updatedNote);
    toast.success('Note saved successfully!');
  };

  const generateAISummary = async () => {
    if (!content.trim()) {
      toast.error('Please add some content to generate a summary');
      return;
    }

    setIsGeneratingAI(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-summary', {
        body: {
          content,
          title,
          category
        }
      });

      if (error) {
        throw new Error('Failed to generate summary');
      }

      const updatedNote: Note = {
        ...note,
        title,
        content,
        category,
        tags: tags.split(',').map(tag => tag.trim()).filter(tag => tag !== ''),
        aiSummary: data.summary,
        updatedAt: new Date()
      };
      
      onNoteUpdate(updatedNote);
      toast.success('AI summary generated!');
    } catch (error) {
      toast.error('Failed to generate AI summary');
      console.error('Error generating summary:', error);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Editor Header */}
      <div className="p-6 border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between mb-4">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Note title..."
            className="text-2xl font-bold border-none p-0 shadow-none focus-visible:ring-0 bg-transparent"
          />
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={generateAISummary}
              disabled={isGeneratingAI}
              className="text-purple-600 border-purple-200 hover:bg-purple-50"
            >
              {isGeneratingAI ? (
                <Brain className="h-4 w-4 mr-2 animate-pulse" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              {isGeneratingAI ? 'Generating...' : 'AI Summary'}
            </Button>
            <Button onClick={handleSave} size="sm">
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Select value={category} onValueChange={(value: NoteCategory) => setCategory(value)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="general">General</SelectItem>
              <SelectItem value="math">Mathematics</SelectItem>
              <SelectItem value="science">Science</SelectItem>
              <SelectItem value="history">History</SelectItem>
              <SelectItem value="language">Languages</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2 flex-1">
            <Hash className="h-4 w-4 text-slate-400" />
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Add tags (comma separated)..."
              className="border-none shadow-none focus-visible:ring-0 bg-transparent"
            />
          </div>
        </div>
      </div>

      {/* Editor Content */}
      <div className="flex-1 p-6">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Start writing your note here..."
          className="h-full resize-none border-none shadow-none focus-visible:ring-0 text-base leading-relaxed bg-transparent"
        />
      </div>

      {/* AI Summary Section */}
      {note.aiSummary && (
        <div className="p-6 border-t border-slate-200 bg-gradient-to-r from-purple-50 to-blue-50">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-purple-600" />
            <h4 className="font-medium text-purple-800">AI Summary</h4>
          </div>
          <p className="text-sm text-purple-700 leading-relaxed">{note.aiSummary}</p>
        </div>
      )}
    </div>
  );
};
