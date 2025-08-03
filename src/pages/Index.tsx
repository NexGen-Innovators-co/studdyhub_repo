// Index.tsx
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useLocation, Routes, Route } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { TabContent } from '../components/TabContent';
import { useAuth } from '../hooks/useAuth';
import { useAppData } from '../hooks/useAppData';
import { useAppOperations } from '../hooks/useAppOperations';
import { Button } from '../components/ui/button';
import { LogOut, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Message, Quiz, ClassRecording } from '../types/Class'; // Import ClassRecording
import { Document as AppDocument, UserProfile } from '../types/Document';
import { Note } from '../types/Note';
import { User } from '@supabase/supabase-js';
import { generateId } from '@/utils/helpers';
import { useAudioProcessing } from '../hooks/useAudioProcessing'; // Import useAudioProcessing to get handleGenerateNoteFromAudio and triggerAudioProcessing

interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  last_message_at: string;
  document_ids: string[];
  message_count?: number;
}

const CHAT_SESSIONS_PER_PAGE = 10;
const CHAT_MESSAGES_PER_PAGE = 20;

const Index = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = new URL(window.location.href);

  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('theme') as 'light' | 'dark') || 'dark';
    }
    return 'dark';
  });

  useEffect(() => {
    if (typeof document !== 'undefined') {
      const html = document.documentElement;
      if (currentTheme === 'dark') {
        html.classList.add('dark');
      } else {
        html.classList.remove('dark');
      }
      localStorage.setItem('theme', currentTheme);
    }
  }, [currentTheme]);

  const handleThemeChange = useCallback((theme: 'light' | 'dark') => {
    setCurrentTheme(theme);
  }, []);

  const {
    notes,
    recordings,
    scheduleItems,
    chatMessages: allChatMessages,
    documents,
    userProfile,
    activeNote,
    searchQuery,
    selectedCategory,
    isSidebarOpen,
    isAILoading,
    filteredNotes,
    loading: dataLoading,
    quizzes,
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
  } = useAppData();

  // Get audio processing handlers from useAudioProcessing hook
  const {
    handleGenerateNoteFromAudio, // This is the function we need to pass down
    triggerAudioProcessing, // This is the function for reprocessing audio
  } = useAudioProcessing({ onAddRecording: (rec) => setRecordings(prev => [...prev, rec]), onUpdateRecording: (rec) => setRecordings(prev => prev.map(r => r.id === rec.id ? rec : r)) });


  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [activeChatSessionId, setActiveChatSessionId] = useState<string | null>(null);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [isNotesHistoryOpen, setIsNotesHistoryOpen] = useState(false);
  const [isSubmittingUserMessage, setIsSubmittingUserMessage] = useState(false);
  const [isLoadingSessionMessages, setIsLoadingSessionMessages] = useState(false);

  const [chatSessionsLoadedCount, setChatSessionsLoadedCount] = useState(CHAT_SESSIONS_PER_PAGE);
  const [hasMoreChatSessions, setHasMoreChatSessions] = useState(true);

  const [hasMoreMessages, setHasMoreMessages] = useState(true);

  const currentActiveTab = useMemo(() => {
    const path = location.pathname.split('/')[1];
    switch (path) {
      case 'notes': return 'notes';
      case 'recordings': return 'recordings';
      case 'schedule': return 'schedule';
      case 'chat': return 'chat';
      case 'documents': return 'documents';
      case 'settings': return 'settings';
      default: return 'notes';
    }
  }, [location.pathname]);

  useEffect(() => {
    setActiveTab(currentActiveTab);
  }, [currentActiveTab, setActiveTab]);

  const loadChatSessions = useCallback(async () => {
    try {
      if (!user) return;

      const { data, error } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('last_message_at', { ascending: false })
        .range(0, chatSessionsLoadedCount - 1);

      if (error) throw error;

      const formattedSessions: ChatSession[] = data.map(session => ({
        id: session.id,
        title: session.title,
        created_at: session.created_at,
        updated_at: session.updated_at,
        last_message_at: session.last_message_at,
        document_ids: session.document_ids || [],
      }));

      setChatSessions(formattedSessions);
      setHasMoreChatSessions(formattedSessions.length === chatSessionsLoadedCount);
    } catch (error) {
      console.error('Error loading chat sessions:', error);
      toast.error('Failed to load chat sessions.');
    }
  }, [user, setChatSessions, chatSessionsLoadedCount]);

  const handleLoadMoreChatSessions = useCallback(() => {
    setChatSessionsLoadedCount(prevCount => prevCount + CHAT_SESSIONS_PER_PAGE);
  }, []);

  // Replace the filteredChatMessages useMemo in Index.tsx with this improved version:

  const filteredChatMessages = useMemo(() => {
    console.log('Filtering messages - Active session:', activeChatSessionId);
    console.log('Total messages to filter:', allChatMessages.length);

    if (!activeChatSessionId) {
      console.log('No active session, returning empty array');
      return [];
    }

    const filtered = allChatMessages
      .filter(msg => {
        const matches = msg.session_id === activeChatSessionId;
        if (!matches) {
          console.log(`Message ${msg.id} session ${msg.session_id} doesn't match active session ${activeChatSessionId}`);
        }
        return matches;
      })
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    console.log('Filtered messages count:', filtered.length);
    console.log('Filtered messages:', filtered.map(m => ({
      id: m.id.substring(0, 8),
      role: m.role,
      timestamp: new Date(m.timestamp).toLocaleTimeString(),
      session_id: m.session_id
    })));

    return filtered;
  }, [allChatMessages, activeChatSessionId]);
  const loadSessionMessages = useCallback(async (sessionId: string) => {
    if (!user) return;
    setIsLoadingSessionMessages(true);

    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('timestamp', { ascending: true })
        .limit(CHAT_MESSAGES_PER_PAGE);

      if (error) throw error;

      const fetchedMessages: Message[] = data.map((msg: any) => ({
        id: msg.id,
        content: msg.content,
        role: msg.role as 'user' | 'assistant',
        timestamp: msg.timestamp || new Date().toISOString(),
        isError: msg.is_error || false,
        attachedDocumentIds: msg.attached_document_ids || [],
        attachedNoteIds: msg.attached_note_ids || [],
        imageUrl: msg.image_url || undefined,
        imageMimeType: msg.image_mime_type || undefined,
        session_id: msg.session_id,
      }));

      setChatMessages(prevAllMessages => {
        const newMessagesToAdd = fetchedMessages.filter(
          fm => !prevAllMessages.some(pm => pm.id === fm.id)
        );
        return [...prevAllMessages, ...newMessagesToAdd].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      });

      setHasMoreMessages(data.length === CHAT_MESSAGES_PER_PAGE);

    } catch (error) {
      console.error('Error loading session messages:', error);
      toast.error('Failed to load chat messages for this session.');
    } finally {
      setIsLoadingSessionMessages(false);
    }
  }, [user, setChatMessages]);
  // Add this debug useEffect near the top of your Index component:

  useEffect(() => {
    console.log('=== DEBUG: Index.tsx data state ===');
    console.log('User:', user?.email);
    console.log('Loading states:', { loading, dataLoading });
    console.log('Data counts:', {
      notes: notes.length,
      recordings: recordings.length,
      scheduleItems: scheduleItems.length,
      chatMessages: allChatMessages.length,
      documents: documents.length,
      quizzes: quizzes.length,
      userProfile: !!userProfile
    });
    console.log('Active states:', {
      activeNote: !!activeNote,
      activeChatSessionId,
      currentActiveTab
    });
    console.log('Chat sessions:', chatSessions.length);
    console.log('Filtered chat messages:', filteredChatMessages.length);
    console.log('===================================');
  }, [user, loading, dataLoading, notes, recordings, scheduleItems, allChatMessages, documents, quizzes, userProfile, activeNote, activeChatSessionId, currentActiveTab, chatSessions, filteredChatMessages]);

  // Add this debug useEffect to your Index.tsx component to monitor chat message updates:

  useEffect(() => {
    console.log('=== CHAT DEBUG: Index.tsx ===');
    console.log('All chat messages count:', allChatMessages.length);
    console.log('Active chat session ID:', activeChatSessionId);
    console.log('Filtered chat messages count:', filteredChatMessages.length);
    console.log('Recent messages:', allChatMessages.slice(-3).map(m => ({
      id: m.id.substring(0, 8),
      role: m.role,
      session_id: m.session_id,
      content: m.content.substring(0, 50) + '...',
      timestamp: new Date(m.timestamp).toLocaleTimeString()
    })));
    console.log('================================');
  }, [allChatMessages, activeChatSessionId, filteredChatMessages]);

  // Also add this to monitor when messages are passed to AIChat
  useEffect(() => {
    console.log('=== AIChat Props Debug ===');
    console.log('Messages passed to AIChat:', filteredChatMessages.length);
    console.log('Is AI Loading:', isAILoading);
    console.log('Is Submitting:', isSubmittingUserMessage);
    console.log('============================');
  }, [filteredChatMessages, isAILoading, isSubmittingUserMessage]);
  const handleLoadOlderChatMessages = useCallback(async () => {
    if (!activeChatSessionId || !user || filteredChatMessages.length === 0) return;

    const oldestMessageTimestamp = filteredChatMessages[0].timestamp;

    try {
      setIsLoadingSessionMessages(true);
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', activeChatSessionId)
        .lt('timestamp', oldestMessageTimestamp)
        .order('timestamp', { ascending: false })
        .limit(CHAT_MESSAGES_PER_PAGE);

      if (error) throw error;

      const olderMessages: Message[] = data.map((msg: any) => ({
        id: msg.id,
        content: msg.content,
        role: msg.role as 'user' | 'assistant',
        timestamp: msg.timestamp || new Date().toISOString(),
        isError: msg.is_error || false,
        attachedDocumentIds: msg.attached_document_ids || [],
        attachedNoteIds: msg.attached_note_ids || [],
        imageUrl: msg.image_url || undefined,
        imageMimeType: msg.image_mime_type || undefined,
        session_id: msg.session_id,
      })).reverse();

      setChatMessages(prevAllMessages => {
        const newMessagesToAdd = olderMessages.filter(
          om => !prevAllMessages.some(pm => pm.id === om.id)
        );
        return [...prevAllMessages, ...newMessagesToAdd].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      });

      setHasMoreMessages(data.length === CHAT_MESSAGES_PER_PAGE);
    } catch (error) {
      console.error('Error loading older messages:', error);
      toast.error('Failed to load older messages.');
    } finally {
      setIsLoadingSessionMessages(false);
    }
  }, [activeChatSessionId, user, filteredChatMessages, setChatMessages]);

  useEffect(() => {
    if (user) {
      loadChatSessions();
    }
  }, [user, loadChatSessions, chatSessionsLoadedCount]);

  useEffect(() => {
    if (activeChatSessionId) {
      loadSessionMessages(activeChatSessionId);
    } else {
      setHasMoreMessages(false);
    }
  }, [activeChatSessionId, user, loadSessionMessages]);

  useEffect(() => {
    if (activeChatSessionId && chatSessions.length > 0) {
      const currentSession = chatSessions.find(s => s.id === activeChatSessionId);
      if (currentSession) {
        setSelectedDocumentIds(currentSession.document_ids || []); // Load document_ids from session
      }
    } else if (!activeChatSessionId) {
      setSelectedDocumentIds([]); // Clear only if no session is active
    }
  }, [activeChatSessionId, chatSessions, setSelectedDocumentIds]);

  const createNewChatSession = useCallback(async (): Promise<string | null> => {
    try {
      if (!user) {
        toast.error('Please sign in to create a new chat session.');
        return null;
      }

      const { data, error } = await supabase
        .from('chat_sessions')
        .insert({
          user_id: user.id,
          title: 'New Chat',
          document_ids: selectedDocumentIds, // Ensure selectedDocumentIds are included
        })
        .select()
        .single();

      if (error) throw error;
      if (!data) throw new Error('No data returned from session creation');

      const newSession: ChatSession = {
        id: data.id,
        title: data.title,
        created_at: data.created_at,
        updated_at: data.updated_at,
        last_message_at: data.last_message_at,
        document_ids: data.document_ids || [],
      };

      setChatSessions(prev => [...prev, newSession].sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()));
      setChatSessionsLoadedCount(CHAT_SESSIONS_PER_PAGE);
      await loadChatSessions();

      setActiveChatSessionId(newSession.id);
      setSelectedDocumentIds(newSession.document_ids || []); // Explicitly set selectedDocumentIds
      setHasMoreMessages(false);

      toast.success('New chat session created with selected documents.');
      return newSession.id;
    } catch (error: any) {
      console.error('Error creating new session:', error);
      toast.error(`Failed to create new chat session: ${error.message || 'Unknown error'}`);
      return null;
    }
  }, [user, selectedDocumentIds, setChatSessions, setChatSessionsLoadedCount, loadChatSessions, setActiveChatSessionId, setSelectedDocumentIds]);
  const deleteChatSession = useCallback(async (sessionId: string) => {
    try {
      if (!user) return;

      const { error } = await supabase
        .from('chat_sessions')
        .delete()
        .eq('id', sessionId)
        .eq('user_id', user.id);

      if (error) throw error;

      setChatSessionsLoadedCount(CHAT_SESSIONS_PER_PAGE);
      await loadChatSessions();

      if (activeChatSessionId === sessionId) {
        if (chatSessions.length > 1) {
          const remainingSessions = chatSessions.filter(s => s.id !== sessionId);
          if (remainingSessions.length > 0) {
            const mostRecent = remainingSessions.sort((a, b) =>
              new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
            )[0];
            setActiveChatSessionId(mostRecent.id);
          } else {
            setActiveChatSessionId(null);
            setHasMoreMessages(false);
          }
        } else {
          setActiveChatSessionId(null);
          setHasMoreMessages(false);
        }
      }

      toast.success('Chat session deleted.');
    } catch (error: any) {
      console.error('Error deleting session:', error);
      toast.error(`Failed to delete chat session: ${error.message || 'Unknown error'}`);
    }
  }, [user, chatSessions, activeChatSessionId, setChatSessionsLoadedCount, loadChatSessions, setActiveChatSessionId]);

  const renameChatSession = useCallback(async (sessionId: string, newTitle: string) => {
    try {
      if (!user) return;

      const { error } = await supabase
        .from('chat_sessions')
        .update({ title: newTitle })
        .eq('id', sessionId)
        .eq('user_id', user.id);

      if (error) throw error;

      setChatSessions(prev =>
        prev.map(s => (s.id === sessionId ? { ...s, title: newTitle } : s))
      );
      toast.success('Chat session renamed.');
    } catch (error) {
      console.error('Error renaming session:', error);
      toast.error('Failed to rename chat session');
    }
  }, [user, setChatSessions]);

  const buildRichContext = useCallback((
    documentIdsToInclude: string[],
    noteIdsToInclude: string[],
    allDocuments: AppDocument[],
    allNotes: Note[]
  ) => {
    const selectedDocs = (allDocuments ?? []).filter(doc => (documentIdsToInclude ?? []).includes(doc.id));
    const selectedNotes = (allNotes ?? []).filter(note => (noteIdsToInclude ?? []).includes(note.id));

    let context = '';

    if (selectedDocs.length > 0) {
      context += 'DOCUMENTS:\n';
      selectedDocs.forEach(doc => {
        context += `Title: ${doc.title}\n`;
        context += `File: ${doc.file_name}\n`;
        if (doc.type === 'image') {
          context += `Type: Image\n`;
        } else if (doc.type === 'text') {
          context += `Type: Text Document\n`;
        }
        if (doc.type === 'image' && doc.content_extracted) {
          const content = doc.content_extracted.length > 2000
            ? doc.content_extracted.substring(0, 2000) + '...'
            : doc.content_extracted;
          context += `Content (Image Description): ${content}\n`;
        } else if (doc.content_extracted) {
          const content = doc.content_extracted.length > 2000
            ? doc.content_extracted.substring(0, 2000) + '...'
            : doc.content_extracted;
          context += `Content: ${content}\n`;
        } else {
          if (doc.type === 'image' && doc.processing_status !== 'completed') {
            context += `Content: Image processing ${doc.processing_status || 'pending'}. No extracted text yet.\n`;
          } else if (doc.type === 'image' && doc.processing_status === 'completed' && !doc.content_extracted) {
            context += `Content: Image analysis completed, but no text or detailed description was extracted.\n`;
          } else {
            context += `Content: No content extracted or available.\n`;
          }
        }
        context += '\n';
      });
    }

    if (selectedNotes.length > 0) {
      context += 'NOTES:\n';
      selectedNotes.forEach(note => {
        context += `Title: ${note.title}\n`;
        context += `Category: ${note.category}\n`;
        if (note.content) {
          const content = note.content.length > 1500
            ? note.content.substring(0, 1500) + '...'
            : note.content;
          context += `Content: ${content}\n`;
        }
        if (note.aiSummary) {
          context += `AI Summary: ${note.aiSummary}\n`;
        }
        if ((note.tags ?? []).length > 0) {
          context += `Tags: ${(note.tags ?? []).join(', ')}\n`;
        }
        context += '\n';
      });
    }

    return context;
  }, []);

  const refreshUploadedDocument = async (docId: string) => {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', docId)
      .single();

    if (error) {
      console.error('Failed to refresh uploaded document:', error.message);
      return null;
    }

    const refreshedDocData: AppDocument = {
      ...(data as AppDocument),
      processing_error: typeof (data as any).processing_error === 'string'
        ? (data as any).processing_error
        : (data as any).processing_error?.toString() || undefined,
      processing_status: typeof (data as any).processing_status === 'string'
        ? (data as any).processing_status
        : (data as any).processing_status?.toString() || 'unknown',
    };

    setDocuments((prev) =>
      prev.map((doc) => (doc.id === docId ? refreshedDocData : doc))
    );

    return refreshedDocData;
  };

  const handleSubmit = useCallback(async (
    messageContent: string,
    attachedDocumentIds?: string[],
    attachedNoteIds?: string[],
    imageUrl?: string,
    imageMimeType?: string,
    imageDataBase64?: string,
    aiMessageIdToUpdate: string | null = null,
  ) => {
    if (!messageContent && (!attachedDocumentIds || attachedDocumentIds.length === 0) && (!attachedNoteIds || attachedNoteIds.length === 0) && !imageUrl || isAILoading || isSubmittingUserMessage) {
      return;
    }

    const trimmedMessage = messageContent;
    setIsSubmittingUserMessage(true);
    setIsAILoading(true);

    let attachedImageDocumentId: string | undefined = undefined;
    let uploadedFilePath: string | undefined = undefined;
    let imageDescriptionForAI: string | undefined;

    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        toast.error('You must be logged in to chat.');
        return;
      }

      let currentSessionId = activeChatSessionId;

      if (!currentSessionId) {
        currentSessionId = await createNewChatSession();
        if (!currentSessionId) {
          toast.error('Failed to create chat session. Please try again.');
          return;
        }
        toast.info('New chat session created.');
      }

      let finalAttachedDocumentIds = attachedDocumentIds || [];
      const finalAttachedNoteIds = attachedNoteIds || [];

      if (imageUrl && finalAttachedDocumentIds.length > 0) {
        const imageDoc = documents.find(d => d.type === 'image' && d.file_url === imageUrl);
        if (imageDoc) {
          attachedImageDocumentId = imageDoc.id;
          uploadedFilePath = imageDoc.file_url;
        }

        if (attachedImageDocumentId) {
          const refreshedDoc = await refreshUploadedDocument(attachedImageDocumentId);
          if (refreshedDoc) {
            imageDescriptionForAI = refreshedDoc.content_extracted;
          }
        }
      }

      setSelectedDocumentIds(finalAttachedDocumentIds);

      const historicalMessagesForAI = allChatMessages
        .filter(msg => msg.session_id === currentSessionId)
        .filter(msg => !(aiMessageIdToUpdate && msg.id === aiMessageIdToUpdate));

      const chatHistoryForAI: Array<{ role: string; parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> }> = [];

      historicalMessagesForAI.forEach(msg => {
        if (msg.role === 'user') {
          const userParts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [{ text: msg.content }];
          if (msg.attachedDocumentIds && msg.attachedDocumentIds.length > 0 || msg.attachedNoteIds && msg.attachedNoteIds.length > 0) {
            const historicalContext = buildRichContext(msg.attachedDocumentIds || [], msg.attachedNoteIds || [], documents, notes);
            if (historicalContext) {
              userParts.push({ text: `\n\nContext from previous attachments:\n${historicalContext}` });
            }
          }
          chatHistoryForAI.push({ role: 'user', parts: userParts });
        } else if (msg.role === 'assistant') {
          chatHistoryForAI.push({ role: 'model', parts: [{ text: msg.content }] });
        }
      });

      const filesForEdgeFunction = [];
      if (imageDataBase64 && imageMimeType) {
        filesForEdgeFunction.push({
          name: 'uploaded_image',
          mimeType: imageMimeType,
          data: imageDataBase64.split(',')[1],
          type: 'image',
          size: 0,
          content: imageDescriptionForAI || null,
          processing_status: imageDescriptionForAI ? 'completed' : 'pending',
          processing_error: null,
        });
      }

      let finalUserMessageContent = trimmedMessage;
      const currentAttachedContext = buildRichContext(finalAttachedDocumentIds, finalAttachedNoteIds, documents, notes);
      if (currentAttachedContext) {
        finalUserMessageContent += `\n\nContext for current query:\n${currentAttachedContext}`;
      }
      if (!aiMessageIdToUpdate && imageDescriptionForAI) {
        finalUserMessageContent += `\n\nAttached Image Description: ${imageDescriptionForAI}`;
      }

      const { data, error } = await supabase.functions.invoke('gemini-chat', {
        body: {
          userId: currentUser.id,
          sessionId: currentSessionId,
          learningStyle: userProfile?.learning_style || 'visual',
          learningPreferences: userProfile?.learning_preferences || {
            explanation_style: userProfile?.learning_preferences?.explanation_style || 'detailed',
            examples: userProfile?.learning_preferences?.examples || false,
            difficulty: userProfile?.learning_preferences?.difficulty || 'intermediate',
          },
          chatHistory: chatHistoryForAI,
          message: finalUserMessageContent,
          files: filesForEdgeFunction,
          attachedDocumentIds: finalAttachedDocumentIds,
          attachedNoteIds: finalAttachedNoteIds,
          imageUrl: imageUrl,
          imageMimeType: imageMimeType,
          aiMessageIdToUpdate: aiMessageIdToUpdate,
        },
      });

      if (error) throw new Error(`AI service error: ${error.message}`);
      if (!data || !data.response) throw new Error('Empty response from AI service');

      setChatSessions(prev => {
        const updated = prev.map(session =>
          session.id === currentSessionId
            ? { ...session, last_message_at: new Date().toISOString(), document_ids: finalAttachedDocumentIds }
            : session
        );
        return updated.sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
      });

    } catch (error: any) {
      toast.error(`Failed to send message: ${error.message || 'Unknown error'}`);
      if (attachedImageDocumentId) {
        await supabase.from('documents').delete().eq('id', attachedImageDocumentId);
        setDocuments(prevDocs => prevDocs.filter(doc => doc.id !== attachedImageDocumentId));
      }
      if (uploadedFilePath) {
        await supabase.storage.from('documents').remove([uploadedFilePath]);
      }
    } finally {
      setIsSubmittingUserMessage(false);
      setIsAILoading(false);
    }
  }, [isAILoading, activeChatSessionId, createNewChatSession, isSubmittingUserMessage, documents, setSelectedDocumentIds, notes, refreshUploadedDocument, setDocuments, allChatMessages, userProfile, setChatSessions, setIsAILoading]);

  const handleNewMessage = useCallback((message: Message) => {
    // This function is no longer directly used for new messages, as useAppData's listener handles it.
  }, []);

  const handleDeleteMessage = useCallback(async (messageId: string) => {
    try {
      if (!user || !activeChatSessionId) {
        toast.error('Authentication required or no active chat session.');
        return;
      }

      setChatMessages(prevMessages => (prevMessages || []).filter(msg => msg.id !== messageId));
      toast.info('Deleting message...');

      const { error } = await supabase
        .from('chat_messages')
        .delete()
        .eq('id', messageId)
        .eq('session_id', activeChatSessionId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error deleting message from DB:', error);
        toast.error('Failed to delete message from database.');
      } else {
        toast.success('Message deleted successfully.');
      }
    } catch (error: any) {
      console.error('Error in handleDeleteMessage:', error);
      toast.error(`Error deleting message: ${error.message || 'Unknown error'}`);
    }
  }, [user, activeChatSessionId, setChatMessages]);

  const handleRegenerateResponse = useCallback(async (lastUserMessageContent: string) => {
    if (!user || !activeChatSessionId) {
      toast.error('Authentication required or no active chat session.');
      return;
    }

    const lastAssistantMessage = filteredChatMessages.slice().reverse().find(msg => msg.role === 'assistant');
    const lastUserMessage = filteredChatMessages.slice().reverse().find(msg => msg.role === 'user');

    if (!lastUserMessage) {
      toast.info('No previous user message to regenerate from.');
      return;
    }

    if (!lastAssistantMessage) {
      toast.info('No previous AI message to regenerate.');
      return;
    }

    setChatMessages(prevAllMessages =>
      (prevAllMessages || []).map(msg =>
        msg.id === lastAssistantMessage.id
          ? { ...msg, content: 'AI is thinking...', timestamp: new Date().toISOString(), isError: false }
          : msg
      )
    );

    toast.info('Regenerating response...');
    await handleSubmit(
      lastUserMessageContent,
      lastUserMessage.attachedDocumentIds,
      lastUserMessage.attachedNoteIds,
      lastUserMessage.imageUrl,
      lastUserMessage.imageMimeType,
      undefined,
      lastAssistantMessage.id
    );
  }, [user, activeChatSessionId, filteredChatMessages, setChatMessages, handleSubmit]);

  const handleRetryFailedMessage = useCallback(async (originalUserMessageContent: string, failedAiMessageId: string) => {
    if (!user || !activeChatSessionId) {
      toast.error('Authentication required or no active chat session.');
      return;
    }

    const lastUserMessage = filteredChatMessages.slice().reverse().find(msg => msg.role === 'user' && msg.content === originalUserMessageContent);
    if (!lastUserMessage) {
      toast.error('Could not find original user message to retry.');
      return;
    }

    setChatMessages(prevAllMessages =>
      (prevAllMessages || []).map(msg =>
        msg.id === failedAiMessageId
          ? { ...msg, content: 'AI is thinking...', timestamp: new Date().toISOString(), isError: false }
          : msg
      )
    );

    toast.info('Retrying message...');
    await handleSubmit(
      originalUserMessageContent,
      lastUserMessage.attachedDocumentIds,
      lastUserMessage.attachedNoteIds,
      lastUserMessage.imageUrl,
      lastUserMessage.imageMimeType,
      undefined,
      failedAiMessageId
    );
  }, [user, activeChatSessionId, filteredChatMessages, setChatMessages, handleSubmit]);

  const {
    createNewNote,
    updateNote,
    deleteNote,
    addRecording,
    updateRecording,
    deleteRecording,
    generateQuiz,
    addScheduleItem,
    updateScheduleItem,
    deleteScheduleItem,
    handleDocumentUploaded,
    updateDocument,
    handleDocumentDeleted,
    handleProfileUpdate,
  } = useAppOperations({
    notes,
    recordings,
    scheduleItems,
    chatMessages: allChatMessages,
    documents,
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
  });

  const memoizedOnToggleSidebar = useCallback(() => setIsSidebarOpen(prev => !prev), [setIsSidebarOpen]);
  const memoizedOnCategoryChange = useCallback((category: string) => setSelectedCategory(category), [setSelectedCategory]);

  const memoizedOnTabChange = useCallback((tab: string) => {
    navigate(`/${tab}`);
    setIsSidebarOpen(false);
  }, [navigate, setIsSidebarOpen]);

  const headerProps = useMemo(() => ({
    searchQuery,
    onSearchChange: setSearchQuery,
    onNewNote: createNewNote,
    isSidebarOpen,
    onToggleSidebar: memoizedOnToggleSidebar,
    activeTab: currentActiveTab as 'notes' | 'recordings' | 'schedule' | 'chat' | 'documents' | 'settings',
  }), [searchQuery, setSearchQuery, createNewNote, isSidebarOpen, memoizedOnToggleSidebar, currentActiveTab]);

  const sidebarProps = useMemo(() => ({
    isOpen: isSidebarOpen,
    onToggle: memoizedOnToggleSidebar,
    selectedCategory: selectedCategory,
    onCategoryChange: memoizedOnCategoryChange,
    noteCount: notes.length,
    activeTab: currentActiveTab as 'notes' | 'recordings' | 'schedule' | 'chat' | 'documents' | 'settings',
    onTabChange: memoizedOnTabChange,
    chatSessions: chatSessions,
    activeChatSessionId: activeChatSessionId,
    onChatSessionSelect: setActiveChatSessionId,
    onNewChatSession: createNewChatSession,
    onDeleteChatSession: deleteChatSession,
    onRenameChatSession: renameChatSession,
    hasMoreChatSessions: hasMoreChatSessions,
    onLoadMoreChatSessions: handleLoadMoreChatSessions,
    currentTheme: currentTheme,
    onThemeChange: handleThemeChange,
  }), [
    isSidebarOpen,
    memoizedOnToggleSidebar,
    selectedCategory,
    memoizedOnCategoryChange,
    notes.length,
    currentActiveTab,
    memoizedOnTabChange,
    chatSessions,
    activeChatSessionId,
    setActiveChatSessionId,
    createNewChatSession,
    deleteChatSession,
    renameChatSession,
    hasMoreChatSessions,
    handleLoadMoreChatSessions,
    currentTheme,
    handleThemeChange,
  ]);

  const tabContentProps = useMemo(() => ({
    activeTab: currentActiveTab as 'notes' | 'recordings' | 'schedule' | 'chat' | 'documents' | 'settings',
    filteredNotes,
    activeNote,
    recordings: recordings ?? [],
    scheduleItems,
    chatMessages: filteredChatMessages,
    documents,
    userProfile,
    isAILoading,
    setIsAILoading,
    onNoteSelect: setActiveNote,
    onNoteUpdate: updateNote,
    onNoteDelete: deleteNote,
    onAddRecording: addRecording,
    onUpdateRecording: updateRecording,
    onGenerateQuiz: generateQuiz,
    onAddScheduleItem: addScheduleItem,
    onUpdateScheduleItem: updateScheduleItem,
    onDeleteScheduleItem: deleteScheduleItem,
    onSendMessage: handleSubmit,
    onDocumentUploaded: handleDocumentUploaded,
    onDocumentUpdated: updateDocument,
    onDocumentDeleted: handleDocumentDeleted,
    onProfileUpdate: handleProfileUpdate,
    chatSessions,
    activeChatSessionId,
    onChatSessionSelect: setActiveChatSessionId,
    onNewChatSession: createNewChatSession,
    onDeleteChatSession: deleteChatSession,
    onRenameChatSession: renameChatSession,
    onSelectedDocumentIdsChange: setSelectedDocumentIds,
    selectedDocumentIds: selectedDocumentIds,
    onNewMessage: handleNewMessage,
    isNotesHistoryOpen: isNotesHistoryOpen,
    onToggleNotesHistory: () => setIsNotesHistoryOpen(prev => !prev),
    onDeleteMessage: handleDeleteMessage,
    onRegenerateResponse: handleRegenerateResponse,
    isSubmittingUserMessage: isSubmittingUserMessage,
    onRetryFailedMessage: handleRetryFailedMessage,
    hasMoreMessages: hasMoreMessages,
    onLoadOlderMessages: handleLoadOlderChatMessages, // Corrected here
    isLoadingSessionMessages: isLoadingSessionMessages,
    quizzes: quizzes,
    onReprocessAudio: triggerAudioProcessing, // Pass triggerAudioProcessing for reprocess
    onDeleteRecording: deleteRecording, // Pass deleteRecording
    onGenerateNote: handleGenerateNoteFromAudio, // Pass handleGenerateNoteFromAudio
  }), [
    currentActiveTab,
    filteredNotes,
    activeNote,
    recordings,
    scheduleItems,
    filteredChatMessages,
    documents,
    userProfile,
    isAILoading,
    setIsAILoading,
    setActiveNote,
    updateNote,
    deleteNote,
    addRecording,
    updateRecording,
    generateQuiz,
    addScheduleItem,
    updateScheduleItem,
    deleteScheduleItem,
    handleSubmit,
    handleDocumentUploaded,
    updateDocument,
    handleDocumentDeleted,
    handleProfileUpdate,
    chatSessions,
    activeChatSessionId,
    setActiveChatSessionId,
    createNewChatSession,
    deleteChatSession,
    renameChatSession,
    setSelectedDocumentIds,
    selectedDocumentIds,
    handleNewMessage,
    isNotesHistoryOpen,
    handleDeleteMessage,
    handleRegenerateResponse,
    isSubmittingUserMessage,
    handleRetryFailedMessage,
    hasMoreMessages,
    handleLoadOlderChatMessages, // Dependency for onLoadOlderMessages
    isLoadingSessionMessages,
    quizzes,
    triggerAudioProcessing,
    deleteRecording,
    handleGenerateNoteFromAudio,
  ]);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
      toast.success('Signed out successfully');
      navigate('/auth');
    } catch (error) {
      toast.error('Error signing out');
    }
  }, [signOut, navigate]);

  if (loading || dataLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <img src='/siteimage.png' className="h-16 w-16 text-blue-600 mx-auto mb-4 animate-spin" />
          <p className="text-slate-600 dark:text-gray-300">Loading your data...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="h-screen flex  overflow-hidden">
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <div
        className={`${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        fixed lg:relative inset-y-0 left-0 z-50 lg:z-auto
        transition-transform duration-300 ease-in-out`}
      >
        <Sidebar {...sidebarProps} />
      </div>

      <div className="flex-1 flex flex-col min-w-0 lg:ml-0 bg-slate-50 dark:bg-gray-900">
        <div className="flex items-center justify-between p-3 sm:p-2 border-b-0 shadow-none bg-transparent border-b-0 border-l-0 border-r-0 border-gray-200 dark:border-gray-700">
          <Header {...headerProps} />
          <div className="hidden sm:flex items-center gap-3">
            <span className="text-sm text-slate-600 hidden md:block dark:text-gray-300">Welcome, {user.email}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              className="flex items-center gap-2 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSignOut}
            className="sm:hidden dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>

        <Routes>
          <Route path="/notes" element={<TabContent {...tabContentProps} activeTab="notes" />} />
          <Route path="/recordings" element={<TabContent {...tabContentProps} activeTab="recordings" />} />
          <Route path="/schedule" element={<TabContent {...tabContentProps} activeTab="schedule" />} />
          <Route path="/chat" element={<TabContent {...tabContentProps} activeTab="chat" />} />
          <Route path="/documents" element={<TabContent {...tabContentProps} activeTab="documents" />} />
          <Route path="/settings" element={<TabContent {...tabContentProps} activeTab="settings" />} />
          <Route path="/" element={<TabContent {...tabContentProps} activeTab="notes" />} />
          <Route path="*" element={<TabContent {...tabContentProps} activeTab="notes" />} />
        </Routes>
      </div>
    </div>
  );
};

export default Index;
