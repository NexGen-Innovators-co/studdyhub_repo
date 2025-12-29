// src/components/quizzes/components/NotesSelector.tsx - UPDATED
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Badge } from '../../ui/badge';
import { Search, FileText, Check, ChevronDown, ChevronUp, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../../integrations/supabase/client';
import { MarkdownRenderer } from '../../ui/MarkDownRendererUi';

interface Note {
  id: string;
  title: string;
  content: string;
  category: string;
  created_at: string;
  ai_summary?: string;
}

interface NotesSelectorProps {
  onNotesSelect: (notes: Note[]) => void;
  selectedNotes: Note[];
}

export const NotesSelector: React.FC<NotesSelectorProps> = ({
  onNotesSelect,
  selectedNotes
}) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [filteredNotes, setFilteredNotes] = useState<Note[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [expandedNote, setExpandedNote] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [previewMode, setPreviewMode] = useState<'rendered' | 'raw'>('rendered');

  useEffect(() => {
    fetchNotes();
  }, []);

  useEffect(() => {
    filterNotes();
  }, [notes, searchQuery, selectedCategory]);

  const fetchNotes = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotes(data || []);
    } catch (error) {

    } finally {
      setIsLoading(false);
    }
  };

  const filterNotes = () => {
    let filtered = notes;

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(note =>
        note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(note => note.category === selectedCategory);
    }

    setFilteredNotes(filtered);
  };

  const toggleNoteSelection = (note: Note) => {
    const isSelected = selectedNotes.some(n => n.id === note.id);
    if (isSelected) {
      onNotesSelect(selectedNotes.filter(n => n.id !== note.id));
    } else {
      onNotesSelect([...selectedNotes, note]);
    }
  };

  const getCategories = () => {
    const categories = new Set(notes.map(note => note.category));
    return Array.from(categories);
  };

  const truncateMarkdown = (content: string, maxLength: number = 150) => {
    // Remove markdown syntax for preview
    const plainText = content
      .replace(/#{1,6}\s?/g, '') // Remove headers
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
      .replace(/\*(.*?)\*/g, '$1') // Remove italic
      .replace(/`(.*?)`/g, '$1') // Remove inline code
      .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Remove links
      .replace(/\n/g, ' '); // Replace newlines with spaces

    if (plainText.length <= maxLength) return plainText;
    return plainText.substring(0, maxLength) + '...';
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-green-500" />
          Select Notes for Quiz
          <Badge variant="secondary">
            {selectedNotes.length} selected
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search and Filter */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex flex-wrap gap-2 items-center justify-between">
            {/* Category Filter */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedCategory === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory('all')}
              >
                All
              </Button>
              {getCategories().map(category => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(category)}
                >
                  {category}
                </Button>
              ))}
            </div>

            {/* Preview Toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPreviewMode(previewMode === 'rendered' ? 'raw' : 'rendered')}
              className="flex items-center gap-2"
            >
              {previewMode === 'rendered' ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              {previewMode === 'rendered' ? 'Rendered' : 'Raw'}
            </Button>
          </div>
        </div>

        {/* Notes List */}
        <div className="space-y-3 max-h-96 overflow-y-auto modern-scrollbar">
          {filteredNotes.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No notes found</p>
              <p className="text-sm mt-1">
                {searchQuery || selectedCategory !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Create some notes first to generate quizzes'
                }
              </p>
            </div>
          ) : (
            filteredNotes.map(note => {
              const isSelected = selectedNotes.some(n => n.id === note.id);
              const isExpanded = expandedNote === note.id;

              return (
                <Card
                  key={note.id}
                  className={`cursor-pointer transition-all border-2 ${isSelected
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                    }`}
                  onClick={() => toggleNoteSelection(note)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-1 ${isSelected
                          ? 'bg-green-500 border-green-500 text-white'
                          : 'border-gray-300'
                        }`}>
                        {isSelected && <Check className="h-3 w-3" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="font-semibold text-sm truncate">
                              {note.title}
                            </h3>
                            <Badge variant="outline" className="text-xs mt-1">
                              {note.category}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedNote(isExpanded ? null : note.id);
                              }}
                            >
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </Button>
                          </div>
                        </div>

                        {/* Content Preview */}
                        {isExpanded ? (
                          <div className="mt-2">
                            {previewMode === 'rendered' ? (
                              <div className="border rounded-lg p-3 bg-white dark:bg-gray-800 max-h-48 overflow-y-auto">
                                <MarkdownRenderer
                                  content={note.content}
                                  className="text-sm"
                                />
                              </div>
                            ) : (
                              <pre className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap border rounded-lg p-3 bg-gray-50 dark:bg-gray-800 max-h-48 overflow-y-auto">
                                {note.content}
                              </pre>
                            )}

                            {note.ai_summary && (
                              <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-xs">
                                <strong>AI Summary:</strong> {note.ai_summary}
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {truncateMarkdown(note.content)}
                          </p>
                        )}

                        <p className="text-xs text-gray-500 mt-2">
                          Created: {new Date(note.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Selection Summary */}
        {selectedNotes.length > 0 && (
          <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <p className="text-sm font-medium text-green-800 dark:text-green-200">
              {selectedNotes.length} note{selectedNotes.length > 1 ? 's' : ''} selected
            </p>
            <p className="text-xs text-green-600 dark:text-green-300 mt-1">
              Total content: {selectedNotes.reduce((total, note) => total + note.content.length, 0)} characters
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              {selectedNotes.map(note => (
                <Badge key={note.id} variant="secondary" className="text-xs">
                  {note.title}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};