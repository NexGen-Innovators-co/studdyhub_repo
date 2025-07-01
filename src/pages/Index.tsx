
import React, { useState, useEffect } from 'react';
import { NotesList } from '../components/NotesList';
import { NoteEditor } from '../components/NoteEditor';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { Note } from '../types/Note';
import { generateId } from '../utils/helpers';

const Index = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Load notes from localStorage on mount
  useEffect(() => {
    const savedNotes = localStorage.getItem('notes');
    if (savedNotes) {
      const parsedNotes = JSON.parse(savedNotes);
      setNotes(parsedNotes);
      if (parsedNotes.length > 0) {
        setActiveNote(parsedNotes[0]);
      }
    }
  }, []);

  // Save notes to localStorage whenever notes change
  useEffect(() => {
    localStorage.setItem('notes', JSON.stringify(notes));
  }, [notes]);

  const createNewNote = () => {
    const newNote: Note = {
      id: generateId(),
      title: 'Untitled Note',
      content: '',
      category: 'general',
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      aiSummary: ''
    };
    
    setNotes(prev => [newNote, ...prev]);
    setActiveNote(newNote);
  };

  const updateNote = (updatedNote: Note) => {
    setNotes(prev => 
      prev.map(note => 
        note.id === updatedNote.id 
          ? { ...updatedNote, updatedAt: new Date() }
          : note
      )
    );
    setActiveNote(updatedNote);
  };

  const deleteNote = (noteId: string) => {
    setNotes(prev => prev.filter(note => note.id !== noteId));
    if (activeNote?.id === noteId) {
      const remainingNotes = notes.filter(note => note.id !== noteId);
      setActiveNote(remainingNotes.length > 0 ? remainingNotes[0] : null);
    }
  };

  const filteredNotes = notes.filter(note => {
    const matchesSearch = note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         note.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || note.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="h-screen flex bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Sidebar */}
      <Sidebar 
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        noteCount={notes.length}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <Header 
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onNewNote={createNewNote}
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        />

        <div className="flex flex-1 min-h-0">
          {/* Notes List */}
          <div className="w-80 bg-white border-r border-slate-200 flex flex-col">
            <NotesList 
              notes={filteredNotes}
              activeNote={activeNote}
              onNoteSelect={setActiveNote}
              onNoteDelete={deleteNote}
            />
          </div>

          {/* Note Editor */}
          <div className="flex-1 bg-white">
            {activeNote ? (
              <NoteEditor 
                note={activeNote}
                onNoteUpdate={updateNote}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400">
                <div className="text-center">
                  <div className="text-6xl mb-4">📝</div>
                  <h3 className="text-xl font-medium mb-2">No note selected</h3>
                  <p>Select a note to start editing or create a new one</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
