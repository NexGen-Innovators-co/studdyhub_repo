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
import { Message } from '../types/Class'; // Assuming Message type is here
import { Document as AppDocument, UserProfile } from '../types/Document';
import { Note } from '../types/Note';
import { User } from '@supabase/supabase-js'; // Import User type
import { generateId } from '@/utils/helpers'; // Assuming this is where generateId comes from

interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  last_message_at: string;
  document_ids: string[];
  message_count?: number;
}

// Pagination constants
const CHAT_SESSIONS_PER_PAGE = 10;
const CHAT_MESSAGES_PER_PAGE = 20; // Load 20 messages at a time

const Index = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = new URL(window.location.href); // Use URL object for location

  // Theme state
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark'>(() => {
    // Initialize theme from localStorage or default to 'dark'
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('theme') as 'light' | 'dark') || 'dark';
    }
    return 'dark';
  });

  // Effect to apply theme class to HTML element
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const html = document.documentElement;
      if (currentTheme === 'dark') {
        html.classList.add('dark');
      } else {
        html.classList.remove('dark');
      }
      localStorage.setItem('theme', currentTheme); // Persist theme
    }
  }, [currentTheme]);

  const handleThemeChange = useCallback((theme: 'light' | 'dark') => {
    setCurrentTheme(theme);
  }, []);

  const {
    notes,
    recordings,
    scheduleItems,
    chatMessages: allChatMessages, // Renamed to avoid conflict and signify it's the global list
    documents, // Get documents from useAppData
    userProfile,
    activeNote,
    searchQuery,
    selectedCategory,
    isSidebarOpen,
    isAILoading,
    filteredNotes,
    loading: dataLoading,
    setNotes,
    setRecordings,
    setScheduleItems,
    setChatMessages, // Still need this setter from useAppData
    setDocuments, // Get setDocuments from useAppData
    setUserProfile,
    setActiveNote,
    setSearchQuery,
    setSelectedCategory,
    setIsSidebarOpen,
    setActiveTab,
    setIsAILoading,
    quizzes, // Added quizzes from useAppData
  } = useAppData();

  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [activeChatSessionId, setActiveChatSessionId] = useState<string | null>(null);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [isNotesHistoryOpen, setIsNotesHistoryOpen] = useState(false);
  const [isSubmittingUserMessage, setIsSubmittingUserMessage] = useState(false); // State to prevent double submission
  // NEW: State for loading messages when a session is selected
  const [isLoadingSessionMessages, setIsLoadingSessionMessages] = useState(false);

  // Pagination states for chat sessions
  const [chatSessionsLoadedCount, setChatSessionsLoadedCount] = useState(CHAT_SESSIONS_PER_PAGE);
  const [hasMoreChatSessions, setHasMoreChatSessions] = useState(true);

  // Pagination states for chat messages (per session)
  const [hasMoreMessages, setHasMoreMessages] = useState(true); // Tracks if more messages can be loaded for the active session

  // Derive activeTab from URL pathname
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
        .range(0, chatSessionsLoadedCount - 1); // Fetch up to chatSessionsLoadedCount

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
      setHasMoreChatSessions(formattedSessions.length === chatSessionsLoadedCount); // Check if more sessions exist
    } catch (error) {
      console.error('Error loading chat sessions:', error);
      toast.error('Failed to load chat sessions.');
    }
  }, [user, setChatSessions, chatSessionsLoadedCount]);

  const handleLoadMoreChatSessions = useCallback(() => {
    setChatSessionsLoadedCount(prevCount => prevCount + CHAT_SESSIONS_PER_PAGE);
  }, []);

  // NEW: Filter chat messages based on activeChatSessionId
  const filteredChatMessages = useMemo(() => {
    if (!activeChatSessionId) {
      return [];
    }
    return allChatMessages.filter(msg => msg.session_id === activeChatSessionId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [allChatMessages, activeChatSessionId]);


  // IMPORTANT: loadSessionMessages now fetches messages for the specific session
  // and updates the global `allChatMessages` state.
  const loadSessionMessages = useCallback(async (sessionId: string) => {
    if (!user) return;
    setIsLoadingSessionMessages(true);

    try {
      // Fetch messages for the specific session
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('timestamp', { ascending: true }) // Get oldest first
        .limit(CHAT_MESSAGES_PER_PAGE); // Load initial batch

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

      // Update the global allChatMessages state with these fetched messages
      // Ensure we don't add duplicates if real-time listener already added some
      setChatMessages(prevAllMessages => {
        const newMessagesToAdd = fetchedMessages.filter(
          fm => !prevAllMessages.some(pm => pm.id === fm.id)
        );
        return [...prevAllMessages, ...newMessagesToAdd].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      });

      setHasMoreMessages(data.length === CHAT_MESSAGES_PER_PAGE); // If we got exactly limit, there might be more

    } catch (error) {
      console.error('Error loading session messages:', error);
      toast.error('Failed to load chat messages for this session.');
    } finally {
      setIsLoadingSessionMessages(false);
    }
  }, [user, setChatMessages]); // Depends on user and setChatMessages


  const handleLoadOlderChatMessages = useCallback(async () => {
    if (!activeChatSessionId || !user || filteredChatMessages.length === 0) return;

    const oldestMessageTimestamp = filteredChatMessages[0].timestamp;

    try {
      setIsLoadingSessionMessages(true); // Indicate loading
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', activeChatSessionId)
        .lt('timestamp', oldestMessageTimestamp) // Get messages older than the current oldest
        .order('timestamp', { ascending: false }) // Still order desc to get latest of older batch
        .limit(CHAT_MESSAGES_PER_PAGE);

      if (error) throw error;

      const olderMessages: Message[] = data.map((msg: any) => ({ // Cast msg to any
        id: msg.id,
        content: msg.content,
        role: msg.role as 'user' | 'assistant',
        timestamp: msg.timestamp || new Date().toISOString(),
        isError: msg.is_error || false,
        // Corrected property names from snake_case to camelCase for Message interface
        attachedDocumentIds: msg.attached_document_ids || [],
        attachedNoteIds: msg.attached_note_ids || [],
        imageUrl: msg.image_url || undefined,
        imageMimeType: msg.image_mime_type || undefined,
        session_id: msg.session_id, // Ensure session_id is included
      })).reverse(); // Reverse to display oldest first

      // Add older messages to the global allChatMessages state
      setChatMessages(prevAllMessages => {
        const newMessagesToAdd = olderMessages.filter(
          om => !prevAllMessages.some(pm => pm.id === om.id)
        );
        return [...prevAllMessages, ...newMessagesToAdd].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      });

      setHasMoreMessages(data.length === CHAT_MESSAGES_PER_PAGE); // If we got exactly limit, there might be more
    } catch (error) {
      console.error('Error loading older messages:', error);
      toast.error('Failed to load older messages.');
    } finally {
      setIsLoadingSessionMessages(false); // End loading
    }
  }, [activeChatSessionId, user, filteredChatMessages, setChatMessages]);


  useEffect(() => {
    if (user) {
      loadChatSessions();
    }
  }, [user, loadChatSessions, chatSessionsLoadedCount]); // Dependency on chatSessionsLoadedCount

  useEffect(() => {
    if (activeChatSessionId) {
      // When activeChatSessionId changes, trigger a load of messages for that session.
      loadSessionMessages(activeChatSessionId);
    } else {
      // If no active session, ensure filtered messages are cleared
      // This is handled by filteredChatMessages useMemo returning []
      setHasMoreMessages(false); // No active session, no more messages
    }
  }, [activeChatSessionId, user, loadSessionMessages]);

  useEffect(() => {
    if (activeChatSessionId && chatSessions.length > 0) {
      const currentSession = chatSessions.find(s => s.id === activeChatSessionId);
      if (currentSession) {
        setSelectedDocumentIds(currentSession.document_ids || []);
      }
    } else if (!activeChatSessionId) {
      setSelectedDocumentIds([]);
    }
  }, [activeChatSessionId, chatSessions]);

  const createNewChatSession = useCallback(async (): Promise<string | null> => {
    console.log('createNewChatSession: Attempting to create new session...');
    try {
      if (!user) {
        console.log('createNewChatSession: User is null, cannot create session.');
        toast.error('Please sign in to create a new chat session.');
        return null;
      }


      const { data, error } = await supabase
        .from('chat_sessions')
        .insert({
          user_id: user.id,
          title: 'New Chat',
          document_ids: selectedDocumentIds,
        })
        .select()
        .single();

      if (error) {
        console.error('createNewChatSession: Database error creating session:', error);
        throw error;
      }

      if (!data) {
        console.error('createNewChatSession: No data returned from session creation');
        throw new Error('No data returned from session creation');
      }

      const newSession: ChatSession = {
        id: data.id,
        title: data.title,
        created_at: data.created_at,
        updated_at: data.updated_at,
        last_message_at: data.last_message_at,
        document_ids: data.document_ids || [],
      };

     

      // Reset loaded count to ensure new session appears at top of list
      setChatSessionsLoadedCount(CHAT_SESSIONS_PER_PAGE);
      // Reload sessions to reflect the new session immediately
      await loadChatSessions();
     

      setActiveChatSessionId(newSession.id);
      setHasMoreMessages(false); // New chat, no older messages yet


      return newSession.id;
    } catch (error: any) {
      console.error('createNewChatSession: Error creating new session:', error);
      toast.error(`Failed to create new chat session: ${error.message || 'Unknown error'}`);
      return null;
    }
  }, [user, selectedDocumentIds, setChatSessionsLoadedCount, loadChatSessions, setActiveChatSessionId]);

  const deleteChatSession = useCallback(async (sessionId: string) => {
    try {
      if (!user) return;

      const { error } = await supabase
        .from('chat_sessions')
        .delete()
        .eq('id', sessionId)
        .eq('user_id', user.id);

      if (error) throw error;

      // After deleting, reset loaded count and reload to ensure correct pagination
      setChatSessionsLoadedCount(CHAT_SESSIONS_PER_PAGE);
      await loadChatSessions();

      if (activeChatSessionId === sessionId) {
        if (chatSessions.length > 1) { // If there are other sessions, pick the most recent one
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
        } else { // If this was the last session
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

  // Updated buildRichContext to accept specific document and note IDs
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
        // IMPORTANT: For image documents, use content_extracted if available
        if (doc.type === 'image' && doc.content_extracted) {
          const content = doc.content_extracted.length > 2000
            ? doc.content_extracted.substring(0, 2000) + '...'
            : doc.content_extracted;
          context += `Content (Image Description): ${content}\n`;
        } else if (doc.content_extracted) { // For text documents
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
  // Refresh a single document and update state


  // FIX: Added explicit type casting for processing_error and processing_status
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

    // Explicitly convert String objects to primitive strings if they exist
    // This addresses the 'String' vs 'string' type incompatibility.
    const refreshedDocData: AppDocument = {
      ...(data as AppDocument), // Spread existing properties
      processing_error: typeof (data as any).processing_error === 'string'
        ? (data as any).processing_error
        : (data as any).processing_error?.toString() || undefined,
      processing_status: typeof (data as any).processing_status === 'string'
        ? (data as any).processing_status
        : (data as any).processing_status?.toString() || 'unknown', // Provide a default if conversion fails
    };

    setDocuments((prev) =>
      prev.map((doc) => (doc.id === docId ? refreshedDocData : doc))
    );

    return refreshedDocData; // Return the correctly typed data
  };


  // Modified handleSubmit to accept attachedDocumentIds and attachedNoteIds, and image data
  const handleSubmit = useCallback(async (
    messageContent: string,
    attachedDocumentIds?: string[],
    attachedNoteIds?: string[],
    imageUrl?: string, // Public URL for display
    imageMimeType?: string, // MIME type for image
    imageDataBase64?: string, // Base64 data for AI consumption
    aiMessageIdToUpdate: string | null = null, // For retry/regenerate
  ) => {


    if (!messageContent.trim() && (!attachedDocumentIds || attachedDocumentIds.length === 0) && (!attachedNoteIds || attachedNoteIds.length === 0) && !imageUrl || isAILoading || isSubmittingUserMessage) {
      console.log('handleSubmit: Aborting due to empty message/no attachments/no image, AI loading, or already submitting.');
      return;
    }

    const trimmedMessage = messageContent.trim();
    setIsSubmittingUserMessage(true);
    setIsAILoading(true); // Start AI loading immediately
    console.log('handleSubmit: setIsSubmittingUserMessage set to true, setIsAILoading set to true.');

    let attachedImageDocumentId: string | undefined = undefined;
    let uploadedFilePath: string | undefined = undefined;
    let imageDescriptionForAI: string | undefined;

    try {
      console.log('handleSubmit: Getting current user from Supabase auth...');
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        console.error('handleSubmit: No current user found after auth.getUser().');
        toast.error('You must be logged in to chat.');
        return;
      }


      let currentSessionId = activeChatSessionId;


      if (!currentSessionId) {
        console.log('handleSubmit: No active session, creating new one...');
        currentSessionId = await createNewChatSession();
        if (!currentSessionId) {
          console.error('handleSubmit: Failed to create chat session.');
          toast.error('Failed to create chat session. Please try again.');
          return;
        }
        toast.info('New chat session created.');

      }

      let finalAttachedDocumentIds = attachedDocumentIds || [];
      const finalAttachedNoteIds = attachedNoteIds || [];

      // If an image was just uploaded and has an ID, ensure its content_extracted is fresh
      if (imageUrl && finalAttachedDocumentIds.length > 0) {
        const imageDoc = documents.find(d => d.type === 'image' && d.file_url === imageUrl);
        if (imageDoc) {
          attachedImageDocumentId = imageDoc.id;
          uploadedFilePath = imageDoc.file_url;
        }

        if (attachedImageDocumentId) {
          console.log(`handleSubmit: Refreshing document with ID ${attachedImageDocumentId} to ensure latest content_extracted.`);
          const refreshedDoc = await refreshUploadedDocument(attachedImageDocumentId);
          if (refreshedDoc) {
            imageDescriptionForAI = refreshedDoc.content_extracted;
            console.log(`handleSubmit: Document ${attachedImageDocumentId} refreshed and state updated. Extracted content length: ${imageDescriptionForAI?.length || 0}`);
          } else {
            console.warn(`handleSubmit: Failed to refresh document ${attachedImageDocumentId}. AI might not get full image context.`);
          }
        }
      }

      setSelectedDocumentIds(finalAttachedDocumentIds);



      // Prepare chat history for AI (only historical messages)
      // If aiMessageIdToUpdate is present, it means we are regenerating/retrying,
      // so we should exclude the AI message that is being updated from the history sent to AI.
      const historicalMessagesForAI = allChatMessages
        .filter(msg => msg.session_id === currentSessionId)
        .filter(msg => !(aiMessageIdToUpdate && msg.id === aiMessageIdToUpdate));

      const chatHistoryForAI: Array<{ role: string; parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> }> = [];

      historicalMessagesForAI.forEach(msg => {
        if (msg.role === 'user') {
          const userParts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [{ text: msg.content }];
          // Add historical document/note context
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

      // Prepare files for the current message to be sent to the edge function
      const filesForEdgeFunction = [];
      if (imageDataBase64 && imageMimeType) {
        filesForEdgeFunction.push({
          name: 'uploaded_image', // Placeholder name
          mimeType: imageMimeType,
          data: imageDataBase64.split(',')[1], // Send only base64 data
          type: 'image', // Custom type for edge function processing
          size: 0, // Placeholder size
          content: imageDescriptionForAI || null, // Pass extracted description
          processing_status: imageDescriptionForAI ? 'completed' : 'pending',
          processing_error: null,
        });
      }

      // Add current context from selected documents/notes to the message content for AI
      let finalUserMessageContent = trimmedMessage;
      const currentAttachedContext = buildRichContext(finalAttachedDocumentIds, finalAttachedNoteIds, documents, notes);
      if (currentAttachedContext) {
        finalUserMessageContent += `\n\nContext for current query:\n${currentAttachedContext}`;
      }
      // If it's a new message with an image, and we have the description, add it here for the AI to process immediately.
      // For regeneration/retry, imageDescriptionForAI is already included in finalUserMessageContent if available.
      if (!aiMessageIdToUpdate && imageDescriptionForAI) {
        finalUserMessageContent += `\n\nAttached Image Description: ${imageDescriptionForAI}`;
      }


      console.log('handleSubmit: Invoking gemini-chat function...');
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
          chatHistory: chatHistoryForAI, // Only historical messages
          message: finalUserMessageContent, // Current user message with context
          files: filesForEdgeFunction, // Current image file data
          // Pass attachedDocumentIds and attachedNoteIds so edge function can save them with user message
          attachedDocumentIds: finalAttachedDocumentIds,
          attachedNoteIds: finalAttachedNoteIds,
          imageUrl: imageUrl, // Pass imageUrl for edge function to save with user message
          imageMimeType: imageMimeType, // Pass imageMimeType for edge function to save with user message
          aiMessageIdToUpdate: aiMessageIdToUpdate, // Pass the ID of the AI message to update (for regenerate/retry)
        },
      });

      if (error) {
        console.error('handleSubmit: AI service error:', error);
        throw new Error(`AI service error: ${error.message}`);
      }

      const aiResponseContent = data.response;
      if (!aiResponseContent) {
        console.error('handleSubmit: Empty response from AI service');
        throw new Error('Empty response from AI service');
      }



      // The Edge Function has already saved both the user and assistant messages.
      // The real-time listener in useAppData will pick them up and update the state.
      // So, no local state updates for messages are needed here.

      // Update chat session locally for immediate UI responsiveness (last_message_at, document_ids)
      setChatSessions(prev => {
        const updated = prev.map(session =>
          session.id === currentSessionId
            ? { ...session, last_message_at: new Date().toISOString(), document_ids: finalAttachedDocumentIds }
            : session
        );
        return updated.sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
      });

    } catch (error: any) {
      console.error('handleSubmit: Caught error:', error);
      toast.error(`Failed to send message: ${error.message || 'Unknown error'}`);
      // Clean up if initial upload or registration fails
      if (attachedImageDocumentId) {
        await supabase.from('documents').delete().eq('id', attachedImageDocumentId);
        setDocuments(prevDocs => prevDocs.filter(doc => doc.id !== attachedImageDocumentId));
      }
      if (uploadedFilePath) {
        await supabase.storage.from('documents').remove([uploadedFilePath]);
      }
    } finally {
      setIsSubmittingUserMessage(false);
      setIsAILoading(false); // Ensure AI loading is stopped
      console.log('handleSubmit: setIsSubmittingUserMessage set to false, setIsAILoading set to false.');
    }
  }, [isAILoading, activeChatSessionId, createNewChatSession, isSubmittingUserMessage, documents, setSelectedDocumentIds, notes, refreshUploadedDocument, setDocuments, allChatMessages, userProfile, setChatSessions, setIsAILoading]);


  const handleNewMessage = useCallback((message: Message) => {
    // This function is no longer directly used for new messages, as useAppData's listener handles it.
    // It might be used for optimistic updates if you reintroduce them, or for other message types.
    // setChatMessages(prev => [...(prev || []), message]); // REMOVED: This was causing double insertion if also called by listener
  }, []);

  const handleDeleteMessage = useCallback(async (messageId: string) => {
    try {
      if (!user || !activeChatSessionId) {
        toast.error('Authentication required or no active chat session.');
        return;
      }

      // Optimistically remove from UI
      setChatMessages(prevMessages => (prevMessages || []).filter(msg => msg.id !== messageId));
      toast.info('Deleting message...');

      const { error } = await supabase
        .from('chat_messages')
        .delete()
        .eq('id', messageId)
        .eq('session_id', activeChatSessionId)
        .eq('user_id', user.id); // Corrected: using 'user_id' as column name

      if (error) {
        console.error('Error deleting message from DB:', error);
        toast.error('Failed to delete message from database.');
        // Revert UI if DB deletion fails
        // This would require fetching the message back or storing it before optimistic delete
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

    // Optimistically update the AI message to a "thinking" state
    setChatMessages(prevAllMessages =>
      (prevAllMessages || []).map(msg =>
        msg.id === lastAssistantMessage.id
          ? { ...msg, content: 'AI is thinking...', timestamp: new Date().toISOString(), isError: false }
          : msg
      )
    );

    toast.info('Regenerating response...');
    // Call handleSubmit with the original user message content and the ID of the AI message to update
    await handleSubmit(
      lastUserMessageContent,
      lastUserMessage.attachedDocumentIds,
      lastUserMessage.attachedNoteIds,
      lastUserMessage.imageUrl,
      lastUserMessage.imageMimeType,
      undefined, // imageDataBase64 is not available for regeneration
      lastAssistantMessage.id // Pass the ID of the AI message to update
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

    // Optimistically update the failed AI message to a "thinking" state
    setChatMessages(prevAllMessages =>
      (prevAllMessages || []).map(msg =>
        msg.id === failedAiMessageId
          ? { ...msg, content: 'AI is thinking...', timestamp: new Date().toISOString(), isError: false }
          : msg
      )
    );

    toast.info('Retrying message...');
    // Call handleSubmit with the original user message content and the ID of the failed AI message to update
    await handleSubmit(
      originalUserMessageContent,
      lastUserMessage.attachedDocumentIds,
      lastUserMessage.attachedNoteIds,
      lastUserMessage.imageUrl,
      lastUserMessage.imageMimeType,
      undefined, // imageDataBase64 is not available for retry
      failedAiMessageId // Pass the ID of the AI message to update
    );
  }, [user, activeChatSessionId, filteredChatMessages, setChatMessages, handleSubmit]);


  const {
    createNewNote,
    updateNote,
    deleteNote,
    addRecording,
    onUpdateRecording, // Destructure onUpdateRecording from useAppOperations
    generateQuiz,
    addScheduleItem,
    updateScheduleItem,
    deleteScheduleItem,
    handleDocumentUploaded,
    updateDocument, // Get the new updateDocument function
    handleDocumentDeleted,
    handleProfileUpdate,
  } = useAppOperations({
    notes,
    recordings,
    scheduleItems,
    chatMessages: allChatMessages, // Pass the global chatMessages
    documents, // Pass documents
    userProfile,
    activeNote,
    setNotes,
    setRecordings,
    setScheduleItems,
    setChatMessages, // Pass setChatMessages
    setDocuments, // Pass setDocuments
    setUserProfile,
    setActiveNote,
    setActiveTab,
    setIsAILoading,
  });

  // Memoize the onToggleSidebar and onCategoryChange functions
  const memoizedOnToggleSidebar = useCallback(() => setIsSidebarOpen(prev => !prev), [setIsSidebarOpen]);
  const memoizedOnCategoryChange = useCallback((category: string) => setSelectedCategory(category), [setSelectedCategory]);

  // Modified onTabChange to use navigate
  const memoizedOnTabChange = useCallback((tab: string) => {
    navigate(`/${tab}`); // Navigate to the new tab's URL
    setIsSidebarOpen(false); // Close sidebar on tab change for mobile
  }, [navigate, setIsSidebarOpen]);

  // Memoize the header props
  const headerProps = useMemo(() => ({
    searchQuery,
    onSearchChange: setSearchQuery,
    onNewNote: createNewNote,
    isSidebarOpen,
    onToggleSidebar: memoizedOnToggleSidebar,
    activeTab: currentActiveTab as 'notes' | 'recordings' | 'schedule' | 'chat' | 'documents' | 'settings', // Explicitly cast
  }), [searchQuery, setSearchQuery, createNewNote, isSidebarOpen, memoizedOnToggleSidebar, currentActiveTab]);

  // Memoize the sidebar props
  const sidebarProps = useMemo(() => ({
    isOpen: isSidebarOpen,
    onToggle: memoizedOnToggleSidebar,
    selectedCategory: selectedCategory,
    onCategoryChange: memoizedOnCategoryChange,
    noteCount: notes.length,
    activeTab: currentActiveTab as 'notes' | 'recordings' | 'schedule' | 'chat' | 'documents' | 'settings', // Explicitly cast
    onTabChange: memoizedOnTabChange,
    // Pass chat session props to Sidebar
    chatSessions: chatSessions,
    activeChatSessionId: activeChatSessionId,
    onChatSessionSelect: setActiveChatSessionId,
    onNewChatSession: createNewChatSession,
    onDeleteChatSession: deleteChatSession,
    onRenameChatSession: renameChatSession,
    hasMoreChatSessions: hasMoreChatSessions, // Pass pagination state
    onLoadMoreChatSessions: handleLoadMoreChatSessions, // Pass load more function
    // Theme props
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
    currentTheme, // Add currentTheme to dependencies
    handleThemeChange, // Add handleThemeChange to dependencies
  ]);

  // Memoize the TabContent props
  const tabContentProps = useMemo(() => ({
    activeTab: currentActiveTab as 'notes' | 'recordings' | 'schedule' | 'chat' | 'documents' | 'settings', // Pass derived activeTab
    filteredNotes,
    activeNote,
    recordings: recordings ?? [],
    scheduleItems,
    chatMessages: filteredChatMessages, // Pass the FILTERED chat messages
    documents,
    userProfile,
    isAILoading,
    setIsAILoading,
    onNoteSelect: setActiveNote,
    onNoteUpdate: updateNote,
    onNoteDelete: deleteNote,
    onAddRecording: addRecording,
    onUpdateRecording: onUpdateRecording, // Explicitly pass onUpdateRecording
    onGenerateQuiz: generateQuiz,
    onAddScheduleItem: addScheduleItem,
    onUpdateScheduleItem: updateScheduleItem,
    onDeleteScheduleItem: deleteScheduleItem,
    onSendMessage: handleSubmit, // This is where the updated handleSubmit is passed
    onDocumentUploaded: handleDocumentUploaded,
    onDocumentUpdated: updateDocument, // Pass the new updateDocument function
    onDocumentDeleted: handleDocumentDeleted,
    onProfileUpdate: handleProfileUpdate,
    chatSessions,
    activeChatSessionId,
    onChatSessionSelect: setActiveChatSessionId,
    onNewChatSession: createNewChatSession,
    onDeleteChatSession: deleteChatSession,
    onRenameChatSession: renameChatSession,
    onSelectionChange: setSelectedDocumentIds, // Explicitly pass this prop
    selectedDocumentIds: selectedDocumentIds,
    onNewMessage: handleNewMessage, // This is still here but its usage might change
    isNotesHistoryOpen: isNotesHistoryOpen,
    onToggleNotesHistory: () => setIsNotesHistoryOpen(prev => !prev),
    onDeleteMessage: handleDeleteMessage,
    onRegenerateResponse: handleRegenerateResponse,
    isSubmittingUserMessage: isSubmittingUserMessage,
    onRetryFailedMessage: handleRetryFailedMessage,
    hasMoreMessages: hasMoreMessages, // Pass pagination state for messages
    onLoadOlderMessages: handleLoadOlderChatMessages, // Pass load older messages function
    isLoadingSessionMessages: isLoadingSessionMessages, // NEW: Add to dependencies
    quizzes: quizzes, // Pass quizzes to TabContent
  }), [
    currentActiveTab,
    filteredNotes,
    activeNote,
    recordings,
    scheduleItems,
    filteredChatMessages, // Dependency for filtered messages
    documents,
    userProfile,
    isAILoading,
    setIsAILoading,
    setActiveNote,
    updateNote,
    deleteNote,
    addRecording,
    onUpdateRecording, // Add onUpdateRecording to dependencies
    generateQuiz,
    addScheduleItem,
    updateScheduleItem,
    deleteScheduleItem,
    handleSubmit, // Ensure this is the updated handleSubmit
    handleDocumentUploaded,
    updateDocument, // Ensure updateDocument is in dependencies
    handleDocumentDeleted,
    handleProfileUpdate,
    chatSessions,
    activeChatSessionId,
    setActiveChatSessionId,
    createNewChatSession,
    deleteChatSession,
    renameChatSession,
    setSelectedDocumentIds, // This is now correctly handled
    selectedDocumentIds,
    handleNewMessage,
    isNotesHistoryOpen,
    handleDeleteMessage,
    handleRegenerateResponse,
    isSubmittingUserMessage,
    handleRetryFailedMessage,
    hasMoreMessages,
    handleLoadOlderChatMessages,
    isLoadingSessionMessages, // NEW: Add to dependencies
    quizzes, // Add quizzes to dependencies
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
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-900 dark:to-gray-800"> {/* Added dark mode */}
        <div className="text-center">
          <img src='/siteimage.png' className="h-16 w-16 text-blue-600 mx-auto mb-4 animate-spin" />
          <p className="text-slate-600 dark:text-gray-300">Loading your data...</p> {/* Added dark mode */}
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

      <div className="flex-1 flex flex-col min-w-0 lg:ml-0 bg-slate-50 dark:bg-gray-900"> {/* Added dark mode background */}
        <div className="flex items-center justify-between p-3 sm:p-2 border-b-0 shadow-none bg-transparent border-b-0 border-l-0 border-r-0 border-gray-200 dark:border-gray-700">
          <Header {...headerProps} />
          <div className="hidden sm:flex items-center gap-3">
            <span className="text-sm text-slate-600 hidden md:block dark:text-gray-300">Welcome, {user.email}</span> {/* Added dark mode */}
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

        {/* Use React Router Routes to render TabContent based on URL */}
        <Routes>
          <Route path="/notes" element={<TabContent {...tabContentProps} activeTab="notes" />} />
          <Route path="/recordings" element={<TabContent {...tabContentProps} activeTab="recordings" />} />
          <Route path="/schedule" element={<TabContent {...tabContentProps} activeTab="schedule" />} />
          <Route path="/chat" element={<TabContent {...tabContentProps} activeTab="chat" />} />
          <Route path="/documents" element={<TabContent {...tabContentProps} activeTab="documents" />} />
          <Route path="/settings" element={<TabContent {...tabContentProps} activeTab="settings" />} />
          {/* Default route, redirects to /notes */}
          <Route path="/" element={<TabContent {...tabContentProps} activeTab="notes" />} />
          <Route path="*" element={<TabContent {...tabContentProps} activeTab="notes" />} /> {/* Fallback for unknown paths */}
        </Routes>
      </div>
    </div>
  );
};

export default Index;
