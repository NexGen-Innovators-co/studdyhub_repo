
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { NotesList } from '../components/NotesList';
import { NoteEditor } from '../components/NoteEditor';
import { ClassRecordings } from '../components/ClassRecordings';
import { Schedule } from '../components/Schedule';
import { AIChat } from '../components/AIChat';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { Note } from '../types/Note';
import { ClassRecording, Quiz, ScheduleItem, Message } from '../types/Class';
import { generateId } from '../utils/helpers';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/button';
import { LogOut, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

const Index = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [notes, setNotes] = useState<Note[]>([]);
  const [recordings, setRecordings] = useState<ClassRecording[]>([]);
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'notes' | 'recordings' | 'schedule' | 'chat'>('notes');
  const [isAILoading, setIsAILoading] = useState(false);

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    const savedNotes = localStorage.getItem('notes');
    const savedRecordings = localStorage.getItem('recordings');
    const savedSchedule = localStorage.getItem('schedule');
    const savedMessages = localStorage.getItem('chatMessages');

    if (savedNotes) {
      const parsedNotes = JSON.parse(savedNotes);
      setNotes(parsedNotes);
      if (parsedNotes.length > 0) {
        setActiveNote(parsedNotes[0]);
      }
    }

    if (savedRecordings) {
      setRecordings(JSON.parse(savedRecordings));
    }

    if (savedSchedule) {
      const parsed = JSON.parse(savedSchedule);
      const withDates = parsed.map((item: any) => ({
        ...item,
        startTime: new Date(item.startTime),
        endTime: new Date(item.endTime)
      }));
      setScheduleItems(withDates);
    }

    if (savedMessages) {
      const parsed = JSON.parse(savedMessages);
      const withDates = parsed.map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }));
      setChatMessages(withDates);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('notes', JSON.stringify(notes));
  }, [notes]);

  useEffect(() => {
    localStorage.setItem('recordings', JSON.stringify(recordings));
  }, [recordings]);

  useEffect(() => {
    localStorage.setItem('schedule', JSON.stringify(scheduleItems));
  }, [scheduleItems]);

  useEffect(() => {
    localStorage.setItem('chatMessages', JSON.stringify(chatMessages));
  }, [chatMessages]);

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
    setActiveTab('notes');
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

  const addRecording = (recording: ClassRecording) => {
    setRecordings(prev => [recording, ...prev]);
  };

  const generateQuiz = async (classId: string) => {
    const recording = recordings.find(r => r.id === classId);
    if (!recording) return;

    try {
      toast.success(`Generating quiz for "${recording.title}"...`);
      // Mock quiz generation - in real app, send to AI service
      await new Promise(resolve => setTimeout(resolve, 2000));
      toast.success('Quiz generated! Check your notes section.');
    } catch (error) {
      toast.error('Failed to generate quiz');
    }
  };

  const addScheduleItem = (item: ScheduleItem) => {
    setScheduleItems(prev => [...prev, item]);
  };

  const updateScheduleItem = (item: ScheduleItem) => {
    setScheduleItems(prev => prev.map(i => i.id === item.id ? item : i));
  };

  const deleteScheduleItem = (id: string) => {
    setScheduleItems(prev => prev.filter(i => i.id !== id));
  };

  const sendChatMessage = async (message: string) => {
    const userMessage: Message = {
      id: generateId(),
      content: message,
      role: 'user',
      timestamp: new Date()
    };

    setChatMessages(prev => [...prev, userMessage]);
    setIsAILoading(true);

    try {
      // Mock AI response - in real app, send to AI service
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const aiResponse: Message = {
        id: generateId(),
        content: `I understand you're asking about "${message}". Based on your notes and recordings, I can help you with study strategies, concept explanations, and academic guidance. What specific aspect would you like me to elaborate on?`,
        role: 'assistant',
        timestamp: new Date()
      };

      setChatMessages(prev => [...prev, aiResponse]);
    } catch (error) {
      toast.error('Failed to get AI response');
    } finally {
      setIsAILoading(false);
    }
  };

  const filteredNotes = notes.filter(note => {
    const matchesSearch = note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         note.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || note.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Signed out successfully');
      navigate('/auth');
    } catch (error) {
      toast.error('Error signing out');
    }
  };

  // Show loading while checking auth
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="text-center">
          <Sparkles className="h-12 w-12 text-blue-600 mx-auto mb-4 animate-spin" />
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render main content if not authenticated
  if (!user) {
    return null;
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'notes':
        return (
          <div className="flex flex-1 min-h-0">
            <div className="w-80 bg-white border-r border-slate-200 flex flex-col">
              <NotesList 
                notes={filteredNotes}
                activeNote={activeNote}
                onNoteSelect={setActiveNote}
                onNoteDelete={deleteNote}
              />
            </div>
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
        );

      case 'recordings':
        return (
          <div className="flex-1 p-6 overflow-y-auto">
            <ClassRecordings 
              recordings={recordings}
              onAddRecording={addRecording}
              onGenerateQuiz={generateQuiz}
            />
          </div>
        );

      case 'schedule':
        return (
          <div className="flex-1 p-6 overflow-y-auto">
            <Schedule 
              scheduleItems={scheduleItems}
              onAddItem={addScheduleItem}
              onUpdateItem={updateScheduleItem}
              onDeleteItem={deleteScheduleItem}
            />
          </div>
        );

      case 'chat':
        return (
          <div className="flex-1">
            <AIChat 
              messages={chatMessages}
              onSendMessage={sendChatMessage}
              isLoading={isAILoading}
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="h-screen flex bg-gradient-to-br from-slate-50 to-blue-50">
      <Sidebar 
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        noteCount={notes.length}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between p-4 bg-white border-b border-slate-200">
          <Header 
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onNewNote={createNewNote}
            isSidebarOpen={isSidebarOpen}
            onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
            activeTab={activeTab}
          />
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-600">Welcome, {user.email}</span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleSignOut}
              className="flex items-center gap-2"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>

        {renderTabContent()}
      </div>
    </div>
  );
};

export default Index;
