// useAppData.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { Note } from '../types/Note';
import { ClassRecording, ScheduleItem, Message, Quiz, QuizQuestion } from '../types/Class'; // Import QuizQuestion
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
  const [quizzes, setQuizzes] = useState<Quiz[]>([]); // New state for quizzes

  const [currentUser, setCurrentUser] = useState<any>(null);

  const documentChannelRef = useRef<any>(null);
  const chatMessageChannelRef = useRef<any>(null);
  const notesChannelRef = useRef<any>(null);
  const recordingsChannelRef = useRef<any>(null);
  const scheduleChannelRef = useRef<any>(null);
  const profileChannelRef = useRef<any>(null);
  const quizzesChannelRef = useRef<any>(null); // New ref for quizzes channel


  // Auth listener to set currentUser
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user || null);
    });

    // Initial check
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUser(user || null);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Load data from Supabase when currentUser changes
  useEffect(() => {
    if (currentUser) {
      loadUserData(currentUser);
    } else {
      setNotes([]);
      setRecordings([]);
      setScheduleItems([]);
      setChatMessages([]);
      setDocuments([]);
      setUserProfile(null);
      setQuizzes([]); // Clear quizzes on logout
      setLoading(false);
    }
  }, [currentUser]);

  // Centralized function to load all user data
  const loadUserData = useCallback(async (user: any) => {
    if (!loading && (notes.length === 0 && recordings.length === 0 && scheduleItems.length === 0 && chatMessages.length === 0 && documents.length === 0 && quizzes.length === 0 && !userProfile)) {
      setLoading(true);
    }

    try {
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
            userId: recording.user_id,
            document_id: recording.document_id
          }));
          setRecordings(formattedRecordings);
        } else {
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
          document_id: note.document_id || null,
          user_id: note.user_id || user.id,
          category: note.category || 'general',
          tags: note.tags || [],
          createdAt: new Date(note.created_at || Date.now()),
          updatedAt: new Date(note.updated_at || Date.now()),
          aiSummary: note.ai_summary || ''
        }));
        setNotes(formattedNotes);
        if (formattedNotes.length > 0 && !activeNote) {
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
          color: item.color || '#3B82F6',
          userId: item.user_id,
          createdAt: item.created_at || new Date().toISOString()
        }));
        setScheduleItems(formattedSchedule);
      }

      // Load documents (initial load, real-time listener handles subsequent changes)
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
          file_url: doc.file_url,
          file_size: doc.file_size || 0, // Add file_size
          content_extracted: doc.content_extracted || null,
          type: doc.type as Document['type'],
          processing_status: String(doc.processing_status) || null,
          processing_error: String(doc.processing_error) || null,
          created_at: new Date(doc.created_at).toISOString(),
          updated_at: new Date(doc.updated_at).toISOString()
        }));
        setDocuments(formattedDocuments);
      }

      // NEW: Load quizzes
      const { data: quizzesData, error: quizzesError } = await supabase
        .from('quizzes')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (quizzesError) {
        console.error('Error fetching quizzes:', quizzesError);
        toast.error('Failed to load quizzes');
      } else if (quizzesData) {
        const formattedQuizzes = quizzesData.map(quiz => ({
          id: quiz.id,
          title: quiz.title,
          // Safely parse and cast 'questions' to QuizQuestion[]
          questions: (Array.isArray(quiz.questions) ? quiz.questions.map((q: any) => ({
            id: q.id, // Ensure id is mapped if it exists
            question: q.question,
            options: q.options,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation
          })) : []) as QuizQuestion[],
          classId: quiz.class_id,
          userId: quiz.user_id,
          createdAt: quiz.created_at
        }));
        setQuizzes(formattedQuizzes);
      }


    } catch (error) {
      console.error('Unexpected error loading user data:', error);
      toast.error('An unexpected error occurred while loading data');
      setRecordings([]);
      setQuizzes([]); // Fallback to empty array on error
    } finally {
      setLoading(false);
    }
  }, [loading, notes.length, recordings.length, scheduleItems.length, chatMessages.length, documents.length, quizzes.length, userProfile, setNotes, setRecordings, setScheduleItems, setChatMessages, setDocuments, setQuizzes, setUserProfile, setActiveNote]);

  // Real-time listener for documents
  useEffect(() => {
    const setupDocumentListener = () => {
      if (documentChannelRef.current) {
        supabase.removeChannel(documentChannelRef.current);
        documentChannelRef.current = null;
      }

      if (!currentUser) {
        return;
      }

      const channel = supabase
        .channel('public:documents')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'documents', filter: `user_id=eq.${currentUser.id}` },
          (payload) => {
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              const newDoc = payload.new as any;
              const formattedDoc: Document = {
                id: newDoc.id,
                title: newDoc.title,
                user_id: newDoc.user_id,
                file_name: newDoc.file_name,
                file_type: newDoc.file_type,
                file_url: newDoc.file_url,
                content_extracted: newDoc.content_extracted || null,
                file_size: newDoc.file_size || 0,
                type: newDoc.type as Document['type'],
                processing_status: String(newDoc.processing_status) || null,
                processing_error: String(newDoc.processing_error) || null,
                created_at: new Date(newDoc.created_at).toISOString(),
                updated_at: new Date(newDoc.updated_at).toISOString(),
              };

              setDocuments(prevDocs => {
                const existingIndex = prevDocs.findIndex(doc => doc.id === formattedDoc.id);
                if (existingIndex > -1) {
                  const updatedDocs = [...prevDocs];
                  updatedDocs[existingIndex] = formattedDoc;
                  return updatedDocs;
                } else {
                  return [formattedDoc, ...prevDocs];
                }
              });

              if (formattedDoc.processing_status === 'completed') {
                toast.success(`Document "${formattedDoc.title}" processed successfully!`);
              } else if (formattedDoc.processing_status === 'failed') {
                toast.error(`Document "${formattedDoc.title}" processing failed: ${formattedDoc.processing_error}`);
              }
            } else if (payload.eventType === 'DELETE') {
              const deletedId = payload.old.id;
              setDocuments(prevDocs => prevDocs.filter(doc => doc.id !== deletedId));
              toast.info('Document deleted from list.');
            }
          }
        )
        .subscribe();

      documentChannelRef.current = channel;

      return () => {
        if (documentChannelRef.current) {
          supabase.removeChannel(documentChannelRef.current);
          documentChannelRef.current = null;
        }
      };
    };

    setupDocumentListener();
  }, [currentUser, setDocuments]);

  // Real-time listener for ALL chat messages for the current user
  useEffect(() => {
    const setupChatMessageListener = () => {
      if (chatMessageChannelRef.current) {
        supabase.removeChannel(chatMessageChannelRef.current);
        chatMessageChannelRef.current = null;
      }

      if (!currentUser) {
        setChatMessages([]);
        return;
      }

      const channel = supabase
        .channel(`public:chat_messages:user_${currentUser.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'chat_messages', filter: `user_id=eq.${currentUser.id}` },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              const newMessage: Message = {
                id: payload.new.id,
                content: payload.new.content,
                role: payload.new.role,
                timestamp: payload.new.timestamp,
                isError: payload.new.is_error || false,
                attachedDocumentIds: payload.new.attached_document_ids || [],
                attachedNoteIds: payload.new.attached_note_ids || [],
                imageUrl: payload.new.image_url || undefined,
                imageMimeType: payload.new.image_mime_type || undefined,
                session_id: payload.new.session_id,
              };
              setChatMessages(prevMessages => {
                if (!prevMessages.some(msg => msg.id === newMessage.id)) {
                  const updatedMessages = [...prevMessages, newMessage].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                  return updatedMessages;
                }
                return prevMessages;
              });
            } else if (payload.eventType === 'UPDATE') {
              const updatedMessage: Message = {
                id: payload.new.id,
                content: payload.new.content,
                role: payload.new.role,
                timestamp: payload.new.timestamp,
                isError: payload.new.is_error || false,
                attachedDocumentIds: payload.new.attached_document_ids || [],
                attachedNoteIds: payload.new.attached_note_ids || [],
                imageUrl: payload.new.image_url || undefined,
                imageMimeType: payload.new.image_mime_type || undefined,
                session_id: payload.new.session_id,
              };
              setChatMessages(prevMessages =>
                prevMessages.map(msg => (msg.id === updatedMessage.id ? updatedMessage : msg))
              );
            } else if (payload.eventType === 'DELETE') {
              setChatMessages(prevMessages =>
                prevMessages.filter(msg => msg.id !== payload.old.id)
              );
            }
          }
        )
        .subscribe();

      chatMessageChannelRef.current = channel;

      return () => {
        if (chatMessageChannelRef.current) {
          supabase.removeChannel(chatMessageChannelRef.current);
          chatMessageChannelRef.current = null;
        }
      };
    };

    setupChatMessageListener();
  }, [currentUser, setChatMessages]);

  // NEW: Real-time listener for Notes
  useEffect(() => {
    const setupNotesListener = () => {
      if (notesChannelRef.current) {
        supabase.removeChannel(notesChannelRef.current);
        notesChannelRef.current = null;
      }

      if (!currentUser) {
        return;
      }

      const channel = supabase
        .channel('public:notes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'notes', filter: `user_id=eq.${currentUser.id}` },
          (payload) => {
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              const newNote = payload.new as any;
              const formattedNote: Note = {
                id: newNote.id,
                title: newNote.title,
                content: newNote.content || '',
                document_id: newNote.document_id || null,
                user_id: newNote.user_id,
                category: newNote.category || 'general',
                tags: newNote.tags || [],
                createdAt: new Date(newNote.created_at || Date.now()),
                updatedAt: new Date(newNote.updated_at || Date.now()),
                aiSummary: newNote.ai_summary || ''
              };

              setNotes(prevNotes => {
                const existingIndex = prevNotes.findIndex(note => note.id === formattedNote.id);
                if (existingIndex > -1) {
                  const updatedNotes = [...prevNotes];
                  updatedNotes[existingIndex] = formattedNote;
                  return updatedNotes;
                } else {
                  return [formattedNote, ...prevNotes];
                }
              });
            } else if (payload.eventType === 'DELETE') {
              const deletedId = payload.old.id;
              setNotes(prevNotes => prevNotes.filter(note => note.id !== deletedId));
            }
          }
        )
        .subscribe();

      notesChannelRef.current = channel;

      return () => {
        if (notesChannelRef.current) {
          supabase.removeChannel(notesChannelRef.current);
          notesChannelRef.current = null;
        }
      };
    };

    setupNotesListener();
  }, [currentUser, setNotes]);

  // NEW: Real-time listener for Recordings
  useEffect(() => {
    const setupRecordingsListener = () => {
      if (recordingsChannelRef.current) {
        supabase.removeChannel(recordingsChannelRef.current);
        recordingsChannelRef.current = null;
      }

      if (!currentUser) {
        return;
      }

      const channel = supabase
        .channel('public:class_recordings')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'class_recordings', filter: `user_id=eq.${currentUser.id}` },
          (payload) => {
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              const newRecording = payload.new as any;
              const formattedRecording: ClassRecording = {
                id: newRecording.id,
                title: newRecording.title,
                subject: newRecording.subject,
                date: newRecording.date || new Date().toISOString(),
                duration: newRecording.duration || 0,
                audioUrl: newRecording.audio_url || '',
                transcript: newRecording.transcript || '',
                summary: newRecording.summary || '',
                createdAt: newRecording.created_at || new Date().toISOString(),
                userId: newRecording.user_id,
                document_id: newRecording.document_id
              };

              setRecordings(prevRecordings => {
                const existingIndex = prevRecordings.findIndex(rec => rec.id === formattedRecording.id);
                if (existingIndex > -1) {
                  const updatedRecordings = [...prevRecordings];
                  updatedRecordings[existingIndex] = formattedRecording;
                  return updatedRecordings;
                } else {
                  return [formattedRecording, ...prevRecordings];
                }
              });
            } else if (payload.eventType === 'DELETE') {
              const deletedId = payload.old.id;
              setRecordings(prevRecordings => prevRecordings.filter(rec => rec.id !== deletedId));
            }
          }
        )
        .subscribe();

      recordingsChannelRef.current = channel;

      return () => {
        if (recordingsChannelRef.current) {
          supabase.removeChannel(recordingsChannelRef.current);
          recordingsChannelRef.current = null;
        }
      };
    };

    setupRecordingsListener();
  }, [currentUser, setRecordings]);

  // NEW: Real-time listener for Schedule Items
  useEffect(() => {
    const setupScheduleListener = () => {
      if (scheduleChannelRef.current) {
        supabase.removeChannel(scheduleChannelRef.current);
        scheduleChannelRef.current = null;
      }

      if (!currentUser) {
        return;
      }

      const channel = supabase
        .channel('public:schedule_items')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'schedule_items', filter: `user_id=eq.${currentUser.id}` },
          (payload) => {
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              const newItem = payload.new as any;
              const formattedItem: ScheduleItem = {
                id: newItem.id,
                title: newItem.title,
                subject: newItem.subject,
                startTime: newItem.start_time,
                endTime: newItem.end_time,
                type: newItem.type as 'class' | 'study' | 'assignment' | 'exam' | 'other',
                description: newItem.description || '',
                location: newItem.location || '',
                color: newItem.color || '#3B82F6',
                userId: newItem.user_id,
                createdAt: newItem.created_at || new Date().toISOString()
              };

              setScheduleItems(prevItems => {
                const existingIndex = prevItems.findIndex(item => item.id === formattedItem.id);
                if (existingIndex > -1) {
                  const updatedItems = [...prevItems];
                  updatedItems[existingIndex] = formattedItem;
                  return updatedItems;
                } else {
                  return [formattedItem, ...prevItems];
                }
              });
            } else if (payload.eventType === 'DELETE') {
              const deletedId = payload.old.id;
              setScheduleItems(prevItems => prevItems.filter(item => item.id !== deletedId));
            }
          }
        )
        .subscribe();

      scheduleChannelRef.current = channel;

      return () => {
        if (scheduleChannelRef.current) {
          supabase.removeChannel(scheduleChannelRef.current);
          scheduleChannelRef.current = null;
        }
      };
    };

    setupScheduleListener();
  }, [currentUser, setScheduleItems]);

  // NEW: Real-time listener for User Profile
  useEffect(() => {
    const setupProfileListener = () => {
      if (profileChannelRef.current) {
        supabase.removeChannel(profileChannelRef.current);
        profileChannelRef.current = null;
      }

      if (!currentUser) {
        return;
      }

      const channel = supabase
        .channel('public:profiles')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${currentUser.id}` },
          (payload) => {
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              const newProfile = payload.new as any;
              setUserProfile({
                id: newProfile.id,
                email: newProfile.email || currentUser.email || '',
                full_name: newProfile.full_name || '',
                avatar_url: newProfile.avatar_url || '',
                learning_style: (newProfile.learning_style || 'visual') as 'visual' | 'auditory' | 'kinesthetic' | 'reading',
                learning_preferences: (newProfile.learning_preferences as any) || {
                  explanation_style: 'detailed',
                  examples: true,
                  difficulty: 'intermediate'
                },
                created_at: new Date(newProfile.created_at || Date.now()),
                updated_at: new Date(newProfile.updated_at || Date.now())
              });
            }
            // No DELETE event expected for profile, as profile is always there for a user
          }
        )
        .subscribe();

      profileChannelRef.current = channel;

      return () => {
        if (profileChannelRef.current) {
          supabase.removeChannel(profileChannelRef.current);
          profileChannelRef.current = null;
        }
      };
    };

    setupProfileListener();
  }, [currentUser, setUserProfile]);

  // NEW: Real-time listener for Quizzes
  useEffect(() => {
    const setupQuizzesListener = () => {
      if (quizzesChannelRef.current) {
        supabase.removeChannel(quizzesChannelRef.current);
        quizzesChannelRef.current = null;
      }

      if (!currentUser) {
        return;
      }

      const channel = supabase
        .channel('public:quizzes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'quizzes', filter: `user_id=eq.${currentUser.id}` },
          (payload) => {
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              const newQuiz = payload.new as any;
              const formattedQuiz: Quiz = {
                id: newQuiz.id,
                title: newQuiz.title,
                // Safely parse and cast 'questions' to QuizQuestion[]
                questions: (Array.isArray(newQuiz.questions) ? newQuiz.questions.map((q: any) => ({
                  id: q.id, // Ensure id is mapped if it exists
                  question: q.question,
                  options: q.options,
                  correctAnswer: q.correctAnswer,
                  explanation: q.explanation
                })) : []) as QuizQuestion[],
                classId: newQuiz.class_id,
                userId: newQuiz.user_id,
                createdAt: newQuiz.created_at
              };

              setQuizzes(prevQuizzes => {
                const existingIndex = prevQuizzes.findIndex(quiz => quiz.id === formattedQuiz.id);
                if (existingIndex > -1) {
                  const updatedQuizzes = [...prevQuizzes];
                  updatedQuizzes[existingIndex] = formattedQuiz;
                  return updatedQuizzes;
                } else {
                  return [formattedQuiz, ...prevQuizzes];
                }
              });
            } else if (payload.eventType === 'DELETE') {
              const deletedId = payload.old.id;
              setQuizzes(prevQuizzes => prevQuizzes.filter(quiz => quiz.id !== deletedId));
            }
          }
        )
        .subscribe();

      quizzesChannelRef.current = channel;

      return () => {
        if (quizzesChannelRef.current) {
          supabase.removeChannel(quizzesChannelRef.current);
          quizzesChannelRef.current = null;
        }
      };
    };

    setupQuizzesListener();
  }, [currentUser, setQuizzes]);


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
    quizzes, // Expose quizzes state

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
    setQuizzes, // Expose quizzes setter

    // Functions (none exposed directly from here, as data loading is internal)
  };
};
