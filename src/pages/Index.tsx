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
import { Message } from '../types/Class';
import { Document as AppDocument, UserProfile } from '../types/Document';
import { Note } from '../types/Note';
import { User } from '@supabase/supabase-js'; // Import User type
import SitemapPage from './SitemapPage'; // Import the new SitemapPage component

interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  last_message_at: string;
  document_ids: string[];
  message_count?: number;
}

// Define a union type for all possible application tabs
type AppTab = 'notes' | 'recordings' | 'schedule' | 'chat' | 'documents' | 'settings' | 'sitemap';

// Pagination constants
const CHAT_SESSIONS_PER_PAGE = 10;
const CHAT_MESSAGES_PER_PAGE = 20; // Load 20 messages at a time

const Index = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const {
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
    isAILoading,
    filteredNotes,
    loading: dataLoading,
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
    setActiveTab, // This setActiveTab's type needs to be compatible with AppTab
    setIsAILoading,
    loadUserData,
  } = useAppData();

  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [activeChatSessionId, setActiveChatSessionId] = useState<string | null>(null);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [isNotesHistoryOpen, setIsNotesHistoryOpen] = useState(false);
  const [isSubmittingUserMessage, setIsSubmittingUserMessage] = useState(false); // State to prevent double submission

  // Pagination states for chat sessions
  const [chatSessionsLoadedCount, setChatSessionsLoadedCount] = useState(CHAT_SESSIONS_PER_PAGE);
  const [hasMoreChatSessions, setHasMoreChatSessions] = useState(true);

  // Pagination states for chat messages (per session)
  const [hasMoreMessages, setHasMoreMessages] = useState(true); // Tracks if more messages can be loaded for the active session

  // Derive activeTab from URL pathname
  const currentActiveTab: AppTab = useMemo(() => {
    const path = location.pathname.split('/')[1];
    switch (path) {
      case 'notes': return 'notes';
      case 'recordings': return 'recordings';
      case 'schedule': return 'schedule';
      case 'chat': return 'chat';
      case 'documents': return 'documents';
      case 'settings': return 'settings';
      case 'sitemap.xml': return 'sitemap'; // Handle sitemap route
      default: return 'notes';
    }
  }, [location.pathname]);

  useEffect(() => {
    // Cast here as setActiveTab's expected type might be narrower if not updated in useAppData
    setActiveTab(currentActiveTab as any); 
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

  const loadSessionMessages = useCallback(async (sessionId: string) => {
    try {
      if (!user) return;

      // Fetch the latest N messages initially
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('timestamp', { ascending: false }) // Get most recent messages first
        .limit(CHAT_MESSAGES_PER_PAGE);

      if (error) throw error;

      const formattedMessages: Message[] = data.map(msg => ({
        id: msg.id,
        content: msg.content,
        role: msg.role as 'user' | 'assistant',
        timestamp: msg.timestamp || new Date().toISOString(),
        isError: msg.is_error || false, // Ensure isError is populated
      })).reverse(); // Reverse to display oldest first

      setChatMessages(formattedMessages);
      setHasMoreMessages(data.length === CHAT_MESSAGES_PER_PAGE); // If we got exactly limit, there might be more
    } catch (error) {
      console.error('Error loading session messages:', error);
      setChatMessages([]);
      toast.error('Failed to load chat messages for this session.');
    }
  }, [user, setChatMessages]);

  const handleLoadOlderChatMessages = useCallback(async () => {
    if (!activeChatSessionId || !user || chatMessages.length === 0) return;

    const oldestMessageTimestamp = chatMessages[0].timestamp;

    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', activeChatSessionId)
        .lt('timestamp', oldestMessageTimestamp) // Get messages older than the current oldest
        .order('timestamp', { ascending: false }) // Still order desc to get latest of older batch
        .limit(CHAT_MESSAGES_PER_PAGE);

      if (error) throw error;

      const olderMessages: Message[] = data.map(msg => ({
        id: msg.id,
        content: msg.content,
        role: msg.role as 'user' | 'assistant',
        timestamp: msg.timestamp || new Date().toISOString(),
        isError: msg.is_error || false,
      })).reverse(); // Reverse to display oldest first

      setChatMessages(prevMessages => [...olderMessages, ...prevMessages]);
      setHasMoreMessages(data.length === CHAT_MESSAGES_PER_PAGE); // If we got exactly limit, there might be more
    } catch (error) {
      console.error('Error loading older messages:', error);
      toast.error('Failed to load older messages.');
    }
  }, [activeChatSessionId, user, chatMessages, setChatMessages]);


  useEffect(() => {
    if (user) {
      loadChatSessions();
    }
  }, [user, loadChatSessions, chatSessionsLoadedCount]); // Dependency on chatSessionsLoadedCount

  useEffect(() => {
    if (activeChatSessionId) {
      loadSessionMessages(activeChatSessionId);
    } else {
      setChatMessages([]);
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
      console.log('createNewChatSession: User ID for new session:', user.id);

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

      console.log('createNewChatSession: New session created with ID:', newSession.id);

      // Reset loaded count to ensure new session appears at top of list
      setChatSessionsLoadedCount(CHAT_SESSIONS_PER_PAGE);
      // Reload sessions to reflect the new session immediately
      await loadChatSessions();
      console.log('createNewChatSession: Chat sessions reloaded.');

      setActiveChatSessionId(newSession.id);
      setChatMessages([]);
      setHasMoreMessages(false); // New chat, no older messages yet
      console.log('createNewChatSession: Active chat session ID set to:', newSession.id);

      return newSession.id;
    } catch (error: any) {
      console.error('createNewChatSession: Error creating new session:', error);
      toast.error(`Failed to create new chat session: ${error.message || 'Unknown error'}`);
      return null;
    }
  }, [user, selectedDocumentIds, setChatSessionsLoadedCount, loadChatSessions, setActiveChatSessionId, setChatMessages]);

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
            setChatMessages([]);
            setHasMoreMessages(false);
          }
        } else { // If this was the last session
          setActiveChatSessionId(null);
          setChatMessages([]);
          setHasMoreMessages(false);
        }
      }

      toast.success('Chat session deleted.');
    } catch (error: any) {
      console.error('Error deleting session:', error);
      toast.error(`Failed to delete chat session: ${error.message || 'Unknown error'}`);
    }
  }, [user, chatSessions, activeChatSessionId, setChatSessionsLoadedCount, loadChatSessions, setActiveChatSessionId, setChatMessages]);

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

  const buildRichContext = useCallback((selectedIds: string[], allDocuments: AppDocument[], allNotes: Note[]) => {
    const selectedDocs = (allDocuments ?? []).filter(doc => (selectedIds ?? []).includes(doc.id));
    const selectedNotes = (allNotes ?? []).filter(note => (selectedIds ?? []).includes(note.id));

    let context = '';

    if (selectedDocs.length > 0) {
      context += 'DOCUMENTS:\n';
      selectedDocs.forEach(doc => {
        context += `Title: ${doc.title}\n`;
        context += `File: ${doc.file_name}\n`;
        if (doc.content_extracted) {
          const content = doc.content_extracted.length > 2000
            ? doc.content_extracted.substring(0, 2000) + '...'
            : doc.content_extracted;
          context += `Content: ${content}\n`;
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

  // Modified _getAIResponse to accept sessionId as an argument
  const _getAIResponse = useCallback(async (userMessageContent: string, currentUser: User, sessionId: string, aiMessageIdToUpdate: string | null = null) => {
    console.log('_getAIResponse: Called with currentUser:', currentUser?.id, 'sessionId:', sessionId);
    if (!currentUser || !sessionId) { // Use sessionId argument here
      console.error('_getAIResponse: Authentication or active session missing. currentUser:', currentUser, 'sessionId:', sessionId);
      toast.error('Authentication required or no active chat session.');
      return;
    }

    setIsAILoading(true);

    try {
      const context = buildRichContext(selectedDocumentIds, documents, notes);
      const historyToSend = (chatMessages || []).filter(msg => {
        if (aiMessageIdToUpdate && msg.id === aiMessageIdToUpdate) {
          return false;
        }
        return true;
      });

      console.log('_getAIResponse: Invoking gemini-chat function...');
      const { data, error } = await supabase.functions.invoke('gemini-chat', {
        body: {
          message: userMessageContent,
          userId: currentUser.id, // Use currentUser.id
          sessionId: sessionId, // Use sessionId argument here
          learningStyle: userProfile?.learning_style || 'visual',
          learningPreferences: userProfile?.learning_preferences || {
            explanation_style: userProfile?.learning_preferences?.explanation_style || 'detailed',
            examples: userProfile?.learning_preferences?.examples || false,
            difficulty: userProfile?.learning_preferences?.difficulty || 'intermediate',
          },
          context,
          chatHistory: historyToSend,
        },
      });

      if (error) {
        console.error('_getAIResponse: AI service error:', error);
        throw new Error(`AI service error: ${error.message}`);
      }

      const aiResponseContent = data.response;
      if (!aiResponseContent) {
        console.error('_getAIResponse: Empty response from AI service');
        throw new Error('Empty response from AI service');
      }

      console.log('_getAIResponse: AI response received. Content length:', aiResponseContent.length);

      if (aiMessageIdToUpdate) {
        console.log('_getAIResponse: Updating existing AI message with ID:', aiMessageIdToUpdate);
        const { error: updateDbError } = await supabase
          .from('chat_messages')
          .update({
            content: aiResponseContent,
            timestamp: new Date().toISOString(),
            is_error: false,
          })
          .eq('id', aiMessageIdToUpdate)
          .eq('session_id', sessionId); // Use sessionId argument here

        if (updateDbError) {
          console.error('_getAIResponse: Error updating AI message:', updateDbError);
          throw new Error('Failed to save AI response');
        }
        console.log('_getAIResponse: AI message updated in DB.');

        setChatMessages(prev =>
          prev.map(msg =>
            msg.id === aiMessageIdToUpdate
              ? { ...msg, content: aiResponseContent, timestamp: new Date().toISOString(), isError: false }
              : msg
          )
        );
      } else {
        console.log('_getAIResponse: Inserting new AI message...');
        const { data: newAiMessageData, error: insertDbError } = await supabase
          .from('chat_messages')
          .insert({
            session_id: sessionId, // Use sessionId argument here
            user_id: currentUser.id, // Use currentUser.id
            content: aiResponseContent,
            role: 'assistant',
            timestamp: new Date().toISOString(),
            is_error: false,
          })
          .select()
          .single();

        if (insertDbError) {
          console.error('_getAIResponse: Error inserting AI message:', insertDbError);
          throw new Error('Failed to save AI response');
        }
        console.log('_getAIResponse: New AI message inserted with ID:', newAiMessageData?.id);

        const newAiMessage: Message = {
          id: newAiMessageData?.id || crypto.randomUUID(),
          content: aiResponseContent,
          role: 'assistant',
          timestamp: newAiMessageData?.timestamp || new Date().toISOString(),
          isError: false,
        };
        setChatMessages(prev => [...(prev || []), newAiMessage]);
      }

      console.log('_getAIResponse: Updating chat session last_message_at...');
      const { error: updateSessionError } = await supabase
        .from('chat_sessions')
        .update({
          last_message_at: new Date().toISOString(),
          document_ids: selectedDocumentIds,
        })
        .eq('id', sessionId); // Use sessionId argument here

      if (updateSessionError) {
        console.error('_getAIResponse: Error updating session:', updateSessionError);
      }
      console.log('_getAIResponse: Chat session updated.');

      setChatSessions(prev => {
        const updated = prev.map(session =>
          session.id === sessionId // Use sessionId argument here
            ? { ...session, last_message_at: new Date().toISOString(), document_ids: selectedDocumentIds }
            : session
        );
        return updated.sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
      });
    } catch (error: any) {
      console.error('_getAIResponse: Caught error:', error);
      toast.error(`Failed to get AI response: ${error.message || 'Unknown error'}`);

      if (aiMessageIdToUpdate) {
        setChatMessages(prev =>
          prev.map(msg =>
            msg.id === aiMessageIdToUpdate
              ? {
                  ...msg,
                  content: `Failed to regenerate response: ${error.message || 'Unknown error'}. Please try again.`,
                  isError: true,
                  timestamp: new Date().toISOString(),
                }
              : msg
          )
        );
      } else {
        const errorMessage: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `I'm sorry, I couldn't generate a response: ${error.message || 'Unknown error'}. Please try again.`,
          timestamp: new Date().toISOString(),
          isError: true,
          originalUserMessageContent: userMessageContent,
        };
        setChatMessages(prev => [...(prev || []), errorMessage]);
      }
    } finally {
      setIsAILoading(false);
      console.log('_getAIResponse: Finished, isAILoading set to false.');
    }
  }, [setIsAILoading, buildRichContext, selectedDocumentIds, documents, notes, chatMessages, userProfile, setChatMessages, setChatSessions]); // Removed activeChatSessionId from dependencies

  const validateActiveSession = useCallback(async (): Promise<boolean> => {
    if (!activeChatSessionId) {
      console.log('validateActiveSession: No activeChatSessionId, returning false.');
      return false;
    }

    try {
      console.log('validateActiveSession: Checking session ID:', activeChatSessionId, 'for user:', user?.id);
      const { data, error } = await supabase
        .from('chat_sessions')
        .select('id')
        .eq('id', activeChatSessionId)
        .eq('user_id', user?.id)
        .single();

      if (error || !data) {
        console.log('validateActiveSession: Active session no longer exists or unauthorized. Error:', error);
        setActiveChatSessionId(null);
        setChatMessages([]);
        setHasMoreMessages(false); // No active session, no more messages
        return false;
      }
      console.log('validateActiveSession: Session is valid.');
      return true;
    } catch (error) {
      console.error('validateActiveSession: Error validating session:', error);
      return false;
    }
  }, [activeChatSessionId, user, setActiveChatSessionId, setChatMessages]);

  const handleSubmit = useCallback(async (messageContent: string) => {
    console.log('handleSubmit: Initiated with message:', messageContent);
    console.log('handleSubmit: Current isAILoading:', isAILoading, 'isSubmittingUserMessage:', isSubmittingUserMessage);

    // Prevent sending if AI is loading, or if already submitting a user message
    if (!messageContent.trim() || isAILoading || isSubmittingUserMessage) {
      console.log('handleSubmit: Aborting due to empty message, AI loading, or already submitting.');
      return;
    }

    const trimmedMessage = messageContent.trim();
    setIsSubmittingUserMessage(true); // Indicate that a user message submission is in progress
    console.log('handleSubmit: setIsSubmittingUserMessage set to true.');

    try {
      console.log('handleSubmit: Getting current user from Supabase auth...');
      const { data: { user: currentUser } } = await supabase.auth.getUser(); // Get user here
      if (!currentUser) {
        console.error('handleSubmit: No current user found after auth.getUser().');
        toast.error('You must be logged in to chat.');
        return; // Exit if no user
      }
      console.log('handleSubmit: Current user found:', currentUser.id);

      let currentSessionId = activeChatSessionId;
      console.log('handleSubmit: Initial activeChatSessionId:', activeChatSessionId);

      // If no active session, create one. This logic should only run once.
      if (!currentSessionId) {
        console.log('handleSubmit: No active session, creating new one...');
        currentSessionId = await createNewChatSession(); // Await the session creation
        if (!currentSessionId) {
          console.error('handleSubmit: Failed to create chat session.');
          toast.error('Failed to create chat session. Please try again.');
          return; // Exit if session creation failed
        }
        toast.info('New chat session created.');
        console.log('handleSubmit: New session ID after creation:', currentSessionId);
        // activeChatSessionId is already set by createNewChatSession, so no need to set it here again.
        // loadChatSessions is also called within createNewChatSession.
      }

      console.log('handleSubmit: Proceeding with session ID:', currentSessionId);

      // Now that we are sure we have a currentSessionId, proceed to save the user message
      console.log('handleSubmit: Saving user message to DB...');
      const { data: userMessageData, error: userMessageError } = await supabase
        .from('chat_messages')
        .insert({
          session_id: currentSessionId, // Use the confirmed session ID
          user_id: currentUser.id, // Use currentUser.id
          content: trimmedMessage,
          role: 'user',
          timestamp: new Date().toISOString(),
        })
        .select()
        .single();

      if (userMessageError) {
        console.error('handleSubmit: Error saving user message:', userMessageError);
        throw new Error('Failed to save your message');
      }
      console.log('handleSubmit: User message saved. Message ID:', userMessageData.id);

      const newUserMessage: Message = {
        id: userMessageData.id,
        content: userMessageData.content,
        role: userMessageData.role as 'user',
        timestamp: userMessageData.timestamp || new Date().toISOString(),
      };
      setChatMessages(prev => [...(prev || []), newUserMessage]);
      console.log('handleSubmit: User message added to state.');

      // Get AI response for the new user message, passing the validated currentUser and currentSessionId
      console.log('handleSubmit: Calling _getAIResponse...');
      await _getAIResponse(trimmedMessage, currentUser, currentSessionId); // Pass currentSessionId
      console.log('handleSubmit: _getAIResponse call completed.');

    } catch (error: any) {
      console.error('handleSubmit: Caught error:', error);
      toast.error(`Failed to send message: ${error.message || 'Unknown error'}`);
    } finally {
      setIsSubmittingUserMessage(false); // Always reset submission state
      console.log('handleSubmit: setIsSubmittingUserMessage set to false.');
    }
  }, [isAILoading, activeChatSessionId, createNewChatSession, setChatMessages, _getAIResponse, isSubmittingUserMessage]); // Removed 'user' from dependency array as it's fetched internally

  const handleNewMessage = useCallback((message: Message) => {
    setChatMessages(prev => [...(prev || []), message]);
  }, [setChatMessages]);

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

    const lastAssistantMessage = chatMessages.slice().reverse().find(msg => msg.role === 'assistant');

    if (!lastAssistantMessage) {
      toast.info('No previous AI message to regenerate.');
      return;
    }

    setChatMessages(prevMessages =>
      (prevMessages || []).map(msg =>
        msg.id === lastAssistantMessage.id
          ? { ...msg, content: 'AI is thinking...', timestamp: new Date().toISOString(), isError: false }
          : msg
      )
    );

    toast.info('Regenerating response...');

    // Pass the current user object and activeChatSessionId to _getAIResponse
    await _getAIResponse(lastUserMessageContent, user, activeChatSessionId, lastAssistantMessage.id);
  }, [user, activeChatSessionId, chatMessages, setChatMessages, _getAIResponse]);

  const handleRetryFailedMessage = useCallback(async (originalUserMessageContent: string, failedAiMessageId: string) => {
    if (!user || !activeChatSessionId) {
      toast.error('Authentication required or no active chat session.');
      return;
    }

    setChatMessages(prevMessages =>
      (prevMessages || []).map(msg =>
        msg.id === failedAiMessageId
          ? { ...msg, content: 'AI is thinking...', timestamp: new Date().toISOString(), isError: false }
          : msg
      )
    );

    toast.info('Retrying message...');

    // Pass the current user object and activeChatSessionId to _getAIResponse
    await _getAIResponse(originalUserMessageContent, user, activeChatSessionId, failedAiMessageId);
  }, [user, activeChatSessionId, setChatMessages, _getAIResponse]);

  const {
    createNewNote,
    updateNote,
    deleteNote,
    addRecording,
    generateQuiz,
    addScheduleItem,
    updateScheduleItem,
    deleteScheduleItem,
    handleDocumentUploaded,
    handleDocumentDeleted,
    handleProfileUpdate,
  } = useAppOperations({
    notes,
    recordings,
    scheduleItems,
    chatMessages,
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
    activeTab: currentActiveTab as AppTab, // Use AppTab
  }), [searchQuery, setSearchQuery, createNewNote, isSidebarOpen, memoizedOnToggleSidebar, currentActiveTab]);

  // Memoize the sidebar props
  const sidebarProps = useMemo(() => ({
    isOpen: isSidebarOpen,
    onToggle: memoizedOnToggleSidebar,
    selectedCategory: selectedCategory,
    onCategoryChange: memoizedOnCategoryChange,
    noteCount: notes.length,
    activeTab: currentActiveTab as AppTab, // Use AppTab
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
  ]);

  // Memoize the TabContent props
  const tabContentProps = useMemo(() => ({
    activeTab: currentActiveTab as Exclude<AppTab, 'sitemap'>, // Exclude 'sitemap' as TabContent doesn't render it
    filteredNotes,
    activeNote,
    recordings: recordings ?? [],
    scheduleItems,
    chatMessages,
    documents,
    userProfile,
    isAILoading,
    setIsAILoading,
    onNoteSelect: setActiveNote,
    onNoteUpdate: updateNote,
    onNoteDelete: deleteNote,
    onAddRecording: addRecording,
    onGenerateQuiz: generateQuiz,
    onAddScheduleItem: addScheduleItem,
    onUpdateScheduleItem: updateScheduleItem,
    onDeleteScheduleItem: deleteScheduleItem,
    onSendMessage: handleSubmit,
    onDocumentUploaded: handleDocumentUploaded,
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
    hasMoreMessages: hasMoreMessages, // Pass pagination state for messages
    onLoadOlderMessages: handleLoadOlderChatMessages, // Pass load older messages function
  }), [
    currentActiveTab,
    filteredNotes,
    activeNote,
    recordings,
    scheduleItems,
    chatMessages,
    documents,
    userProfile,
    isAILoading,
    setIsAILoading,
    setActiveNote,
    updateNote,
    deleteNote,
    addRecording,
    generateQuiz,
    addScheduleItem,
    updateScheduleItem,
    deleteScheduleItem,
    handleSubmit,
    handleDocumentUploaded,
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
    handleLoadOlderChatMessages,
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

  console.log('Index recordings state:', recordings); // Debug log

  if (loading || dataLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="text-center">
          <Sparkles className="h-12 w-12 text-blue-600 mx-auto mb-4 animate-spin" />
          <p className="text-slate-600">Loading your data...</p>
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

      <div className="flex-1 flex flex-col min-w-0 lg:ml-0">
        <div className="flex items-center justify-between p-3 sm:p-4 border-b-0 shadow-none bg-transparent border-b-0 border-l-0 border-r-0 border-gray-200 dark:border-gray-700">
          <Header {...headerProps} />
          <div className="hidden sm:flex items-center gap-3">
            <span className="text-sm text-slate-600 hidden md:block">Welcome, {user.email}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              className="flex items-center gap-2"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSignOut}
            className="sm:hidden"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>

        {/* Use React Router Routes to render TabContent based on URL */}
        <Routes>
          {/* Add the sitemap route here */}
          <Route path="/sitemap.xml" element={<SitemapPage />} />
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
