import { Note } from '../types/Note';
import { ClassRecording, ScheduleItem, Message } from '../types/Class';
import { generateId } from '../utils/helpers';
import { toast } from 'sonner';

interface UseAppOperationsProps {
  notes: Note[];
  recordings: ClassRecording[];
  scheduleItems: ScheduleItem[];
  chatMessages: Message[];
  activeNote: Note | null;
  setNotes: (notes: Note[] | ((prev: Note[]) => Note[])) => void;
  setRecordings: (recordings: ClassRecording[] | ((prev: ClassRecording[]) => ClassRecording[])) => void;
  setScheduleItems: (items: ScheduleItem[] | ((prev: ScheduleItem[]) => ScheduleItem[])) => void;
  setChatMessages: (messages: Message[] | ((prev: Message[]) => Message[])) => void;
  setActiveNote: (note: Note | null) => void;
  setActiveTab: (tab: 'notes' | 'recordings' | 'schedule' | 'chat') => void;
  setIsAILoading: (loading: boolean) => void;
}

export const useAppOperations = ({
  notes,
  recordings,
  activeNote,
  setNotes,
  setRecordings,
  setScheduleItems,
  setChatMessages,
  setActiveNote,
  setActiveTab,
  setIsAILoading,
}: UseAppOperationsProps) => {

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

  return {
    createNewNote,
    updateNote,
    deleteNote,
    addRecording,
    generateQuiz,
    addScheduleItem,
    updateScheduleItem,
    deleteScheduleItem,
    sendChatMessage,
  };
};