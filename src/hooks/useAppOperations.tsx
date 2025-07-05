import { Note } from '../types/Note';
import { ClassRecording, ScheduleItem, Message } from '../types/Class';
import { Document, UserProfile } from '../types/Document';
import { generateId } from '../utils/helpers';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface UseAppOperationsProps {
  notes: Note[];
  recordings: ClassRecording[];
  scheduleItems: ScheduleItem[];
  chatMessages: Message[];
  documents: Document[];
  userProfile: UserProfile | null;
  activeNote: Note | null;
  setNotes: (notes: Note[] | ((prev: Note[]) => Note[])) => void;
  setRecordings: (recordings: ClassRecording[] | ((prev: ClassRecording[]) => ClassRecording[])) => void;
  setScheduleItems: (items: ScheduleItem[] | ((prev: ScheduleItem[]) => ScheduleItem[])) => void;
  setChatMessages: (messages: Message[] | ((prev: Message[]) => Message[])) => void;
  setDocuments: (documents: Document[] | ((prev: Document[]) => Document[])) => void;
  setUserProfile: (profile: UserProfile | null) => void;
  setActiveNote: (note: Note | null) => void;
  setActiveTab: (tab: 'notes' | 'recordings' | 'schedule' | 'chat' | 'documents' | 'settings') => void;
  setIsAILoading: (loading: boolean) => void;
}

export const useAppOperations = ({
  notes,
  recordings,
  userProfile,
  activeNote,
  setNotes,
  setRecordings,
  setScheduleItems,
  setChatMessages,
  setDocuments,
  setUserProfile,
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
      
      const { data, error } = await supabase.functions.invoke('generate-quiz', {
        body: {
          title: recording.title,
          subject: recording.subject,
          transcript: recording.transcript,
          summary: recording.summary
        }
      });

      if (error) {
        throw new Error('Failed to generate quiz');
      }

      toast.success('Quiz generated! Check your notes section.');
    } catch (error) {
      toast.error('Failed to generate quiz');
      console.error('Error generating quiz:', error);
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Fetch latest chat messages to get AI response
      const { data: chatData, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('user_id', user.id)
        .order('timestamp', { ascending: false })
        .limit(20);

      if (error) throw error;

      // Convert to local format and update state
      const messages: Message[] = chatData.map(msg => ({
        id: msg.id,
        content: msg.content,
        role: msg.role as 'user' | 'assistant',
        timestamp: new Date(msg.timestamp || Date.now())
      })).reverse();

      setChatMessages(messages);
    } catch (error) {
      toast.error('Failed to get AI response');
      console.error('Error in sendChatMessage:', error);
    } finally {
      setIsAILoading(false);
    }
  };

  const handleDocumentUploaded = (document: Document) => {
    setDocuments(prev => [document, ...prev]);
  };

  const handleDocumentDeleted = (documentId: string) => {
    setDocuments(prev => prev.filter(doc => doc.id !== documentId));
  };

  const handleProfileUpdate = (profile: UserProfile) => {
    setUserProfile(profile);
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
    handleDocumentUploaded,
    handleDocumentDeleted,
    handleProfileUpdate,
  };
};