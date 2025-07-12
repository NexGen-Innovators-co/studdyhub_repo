import { useState, useEffect } from 'react';
import { Note } from '../types/Note';
import { ClassRecording, ScheduleItem, Message } from '../types/Class';
import { Document, UserProfile } from '../types/Document';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useAppData = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [recordings, setRecordings] = useState<ClassRecording[]>([]);
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'notes' | 'recordings' | 'schedule' | 'chat' | 'documents' | 'settings'>('notes');
  const [isAILoading, setIsAILoading] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load data from Supabase on mount
  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('No user authenticated');
        setLoading(false);
        setRecordings([]); // Ensure recordings is empty if no user
        return;
      }

      // Load user profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) {
        console.error('Error loading user profile:', profileError);
        toast.error('Failed to load user profile');
      }

      if (profileData) {
        setUserProfile({
          id: profileData.id,
          email: profileData.email || user.email || '',
          full_name: profileData.full_name || '',
          avatar_url: profileData.avatar_url || '',
          learning_style: (profileData.learning_style || 'visual') as 'visual' | 'auditory' | 'kinesthetic' | 'reading',
          learning_preferences: (profileData.learning_preferences as any) || {
            explanation_style: 'detailed',
            examples: true,
            difficulty: 'intermediate'
          },
          created_at: new Date(profileData.created_at || Date.now()),
          updated_at: new Date(profileData.updated_at || Date.now())
        });
      } else {
        const defaultProfile = {
          id: user.id,
          email: user.email || '',
          full_name: '',
          avatar_url: '',
          learning_style: 'visual' as const,
          learning_preferences: {
            explanation_style: 'detailed' as const,
            examples: true,
            difficulty: 'intermediate' as const
          }
        };
        try {
          const { error: insertError } = await supabase
            .from('profiles')
            .insert(defaultProfile);
          if (!insertError) {
            setUserProfile({
              ...defaultProfile,
              created_at: new Date(),
              updated_at: new Date()
            });
          }
        } catch (error) {
          console.error('Error creating default profile:', error);
          setUserProfile({
            ...defaultProfile,
            created_at: new Date(),
            updated_at: new Date()
          });
        }
      }

      // Load recordings
      console.log('Fetching recordings for user:', user.id); // Debug log
      const { data: recordingsData, error: recordingsError } = await supabase
        .from('class_recordings')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (recordingsError) {
        console.error('Error fetching recordings:', recordingsError);
        toast.error('Failed to load recordings');
        setRecordings([]);
      } else {
        console.log('Raw recordings data from Supabase:', recordingsData); // Debug log
        if (recordingsData) {
          const formattedRecordings = recordingsData.map(recording => ({
            id: recording.id,
            title: recording.title,
            subject: recording.subject,
            date: recording.date || new Date().toISOString(),
            duration: recording.duration || 0,
            audioUrl: recording.audio_url || '',
            transcript: recording.transcript || '',
            summary: recording.summary || '',
            createdAt: recording.created_at || new Date().toISOString(),
            userId: recording.user_id, // Add userId
            document_id: recording.document_id // Add document_id
          }));
          console.log('Formatted recordings:', formattedRecordings); // Debug log
          setRecordings(formattedRecordings);
        } else {
          console.log('No recordings data received, setting empty array'); // Debug log
          setRecordings([]);
        }
      }

      // Load notes
      const { data: notesData, error: notesError } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (notesError) {
        console.error('Error fetching notes:', notesError);
        toast.error('Failed to load notes');
      } else if (notesData) {
        const formattedNotes = notesData.map(note => ({
          id: note.id,
          title: note.title,
          content: note.content || '',
          document_id: (note as any).document_id || null,
          userId: note.user_id || user.id,
          category: note.category || 'general',
          tags: note.tags || [],
          createdAt: new Date(note.created_at || Date.now()),
          updatedAt: new Date(note.updated_at || Date.now()),
          aiSummary: note.ai_summary || ''
        }));
        setNotes(formattedNotes);
        if (formattedNotes.length > 0) {
          setActiveNote(formattedNotes[0]);
        }
      }

      // Load schedule items
      const { data: scheduleData, error: scheduleError } = await supabase
        .from('schedule_items')
        .select('*')
        .eq('user_id', user.id)
        .order('start_time', { ascending: true });

      if (scheduleError) {
        console.error('Error fetching schedule items:', scheduleError);
        toast.error('Failed to load schedule items');
      } else if (scheduleData) {
        const formattedSchedule = scheduleData.map(item => ({
          id: item.id,
          title: item.title,
          subject: item.subject,
          startTime: item.start_time,
          endTime: item.end_time,
          type: item.type as 'class' | 'study' | 'assignment' | 'exam' | 'other',
          description: item.description || '',
          location: item.location || '',
          color: item.color || '#3B82F6'
        }));
        setScheduleItems(formattedSchedule);
      }

      // Load chat messages
      const { data: chatData, error: chatError } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('user_id', user.id)
        .order('timestamp', { ascending: true });

      if (chatError) {
        console.error('Error fetching chat messages:', chatError);
        toast.error('Failed to load chat messages');
      } else if (chatData) {
        const formattedMessages = chatData.map(msg => ({
          id: msg.id,
          content: msg.content,
          role: msg.role as 'user' | 'assistant', // Ensure role is correctly typed
          timestamp: new Date(msg.timestamp || Date.now()).toISOString() // Convert Date to ISO string
        }));
        setChatMessages(formattedMessages);
      }

      // Load documents
      const { data: documentsData, error: documentsError } = await supabase
        .from('documents')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (documentsError) {
        console.error('Error fetching documents:', documentsError);
        toast.error('Failed to load documents');
      } else if (documentsData) {
        const formattedDocuments = documentsData.map(doc => ({
          id: doc.id,
          title: doc.title,
          user_id: doc.user_id,
          file_name: doc.file_name,
          file_type: doc.file_type,
          file_size: doc.file_size || 0,
          file_url: doc.file_url,
          content_extracted: doc.content_extracted || '',
          created_at: new Date(doc.created_at),
          updated_at: new Date(doc.updated_at)
        }));
        setDocuments(formattedDocuments);
      }

    } catch (error) {
      console.error('Unexpected error loading user data:', error);
      toast.error('An unexpected error occurred while loading data');
      setRecordings([]); // Fallback to empty array on any error
    } finally {
      setLoading(false);
      console.log('Final recordings state:', recordings); // Debug log
    }
  };

  // Filter notes based on search and category
  const filteredNotes = notes.filter(note => {
    const matchesSearch = note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         note.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || note.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return {
    // State
    notes,
    recordings,
    scheduleItems,
    chatMessages,
    documents,
    userProfile,
    activeNote,
    searchQuery,
    selectedCategory,
    isSidebarOpen,
    activeTab,
    isAILoading,
    filteredNotes,
    loading,
    
    // Setters
    setNotes,
    setRecordings,
    setScheduleItems,
    setChatMessages,
    setDocuments,
    setUserProfile,
    setActiveNote,
    setSearchQuery,
    setSelectedCategory,
    setIsSidebarOpen,
    setActiveTab,
    setIsAILoading,
    
    // Functions
    loadUserData,
  };
};