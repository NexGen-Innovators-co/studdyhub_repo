import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  last_message_at: string;
  document_ids: string[];
  message_count?: number;
}

const Index = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();

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
    activeTab,
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
    setActiveTab,
    setIsAILoading,
    loadUserData,
  } = useAppData();

  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [activeChatSessionId, setActiveChatSessionId] = useState<string | null>(null);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [isChatHistoryOpen, setIsChatHistoryOpen] = useState(false);
  const [isSubmittingUserMessage, setIsSubmittingUserMessage] = useState(false);

  useEffect(() => {
    if (user) {
      loadChatSessions();
    }
  }, [user]);

  useEffect(() => {
    if (activeChatSessionId) {
      loadSessionMessages(activeChatSessionId);
    } else {
      setChatMessages([]);
    }
  }, [activeChatSessionId, user]);

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

  const loadChatSessions = async () => {
    try {
      if (!user) return;

      const { data, error } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('last_message_at', { ascending: false });

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
    } catch (error) {
      console.error('Error loading chat sessions:', error);
      toast.error('Failed to load chat sessions.');
    }
  };

  const loadSessionMessages = async (sessionId: string) => {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('timestamp', { ascending: true });

      if (error) throw error;

      const formattedMessages: Message[] = data.map(msg => ({
        id: msg.id,
        content: msg.content,
        role: msg.role as 'user' | 'assistant',
        timestamp: msg.timestamp || new Date().toISOString(),
      }));

      setChatMessages(formattedMessages);
    } catch (error) {
      console.error('Error loading session messages:', error);
      setChatMessages([]);
      toast.error('Failed to load chat messages for this session.');
    }
  };

  const createNewChatSession = async (): Promise<string | null> => {
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
          document_ids: selectedDocumentIds,
        })
        .select()
        .single();

      if (error) {
        console.error('Database error creating session:', error);
        throw error;
      }

      if (!data) {
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

      setChatSessions(prev => [newSession, ...prev]);
      setActiveChatSessionId(newSession.id);
      setChatMessages([]);

      toast.success('New chat session created!');
      setIsChatHistoryOpen(false);

      return newSession.id;
    } catch (error: any) {
      console.error('Error creating new session:', error);
      toast.error(`Failed to create new chat session: ${error.message || 'Unknown error'}`);
      return null;
    }
  };

  const deleteChatSession = async (sessionId: string) => {
    try {
      if (!user) return;

      const { error } = await supabase
        .from('chat_sessions')
        .delete()
        .eq('id', sessionId)
        .eq('user_id', user.id);

      if (error) throw error;

      const remainingSessions = chatSessions.filter(s => s.id !== sessionId);
      setChatSessions(remainingSessions);

      if (activeChatSessionId === sessionId) {
        if (remainingSessions.length > 0) {
          const mostRecent = remainingSessions.sort((a, b) =>
            new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
          )[0];
          setActiveChatSessionId(mostRecent.id);
        } else {
          setActiveChatSessionId(null);
          setChatMessages([]);
        }
      }

      toast.success('Chat session deleted.');
    } catch (error: any) {
      console.error('Error deleting session:', error);
      toast.error(`Failed to delete chat session: ${error.message || 'Unknown error'}`);
    }
  };

  const renameChatSession = async (sessionId: string, newTitle: string) => {
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
  };

  const _getAIResponse = async (userMessageContent: string, aiMessageIdToUpdate: string | null = null) => {
    if (!user || !activeChatSessionId) {
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

      const { data, error } = await supabase.functions.invoke('gemini-chat', {
        body: {
          message: userMessageContent,
          userId: user.id,
          sessionId: activeChatSessionId,
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
        throw new Error(`AI service error: ${error.message}`);
      }

      const aiResponseContent = data.response;
      if (!aiResponseContent) {
        throw new Error('Empty response from AI service');
      }

      if (aiMessageIdToUpdate) {
        const { error: updateDbError } = await supabase
          .from('chat_messages')
          .update({
            content: aiResponseContent,
            timestamp: new Date().toISOString(),
            is_error: false,
          })
          .eq('id', aiMessageIdToUpdate)
          .eq('session_id', activeChatSessionId);

        if (updateDbError) {
          console.error('Error updating AI message:', updateDbError);
          throw new Error('Failed to save AI response');
        }

        setChatMessages(prev =>
          prev.map(msg =>
            msg.id === aiMessageIdToUpdate
              ? { ...msg, content: aiResponseContent, timestamp: new Date().toISOString(), isError: false }
              : msg
          )
        );
      } else {
        const { data: newAiMessageData, error: insertDbError } = await supabase
          .from('chat_messages')
          .insert({
            session_id: activeChatSessionId,
            user_id: user.id,
            content: aiResponseContent,
            role: 'assistant',
            timestamp: new Date().toISOString(),
            is_error: false,
          })
          .select()
          .single();

        if (insertDbError) {
          console.error('Error inserting AI message:', insertDbError);
          throw new Error('Failed to save AI response');
        }

        const newAiMessage: Message = {
          id: newAiMessageData?.id || crypto.randomUUID(),
          content: aiResponseContent,
          role: 'assistant',
          timestamp: newAiMessageData?.timestamp || new Date().toISOString(),
          isError: false,
        };
        setChatMessages(prev => [...(prev || []), newAiMessage]);
      }

      const { error: updateSessionError } = await supabase
        .from('chat_sessions')
        .update({
          last_message_at: new Date().toISOString(),
          document_ids: selectedDocumentIds,
        })
        .eq('id', activeChatSessionId);

      if (updateSessionError) {
        console.error('Error updating session:', updateSessionError);
      }

      setChatSessions(prev => {
        const updated = prev.map(session =>
          session.id === activeChatSessionId
            ? { ...session, last_message_at: new Date().toISOString(), document_ids: selectedDocumentIds }
            : session
        );
        return updated.sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
      });
    } catch (error: any) {
      console.error('Error in _getAIResponse:', error);
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
    }
  };

  const validateActiveSession = async (): Promise<boolean> => {
    if (!activeChatSessionId) return false;

    try {
      const { data, error } = await supabase
        .from('chat_sessions')
        .select('id')
        .eq('id', activeChatSessionId)
        .eq('user_id', user?.id)
        .single();

      if (error || !data) {
        console.log('Active session no longer exists');
        setActiveChatSessionId(null);
        setChatMessages([]);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error validating session:', error);
      return false;
    }
  };

  const handleSubmit = async (messageContent: string) => {
    if (!messageContent.trim() || isAILoading) return;

    const trimmedMessage = messageContent.trim();
    setIsSubmittingUserMessage(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('You must be logged in to chat.');
        return;
      }

      let currentSessionId = activeChatSessionId;

      if (!currentSessionId) {
        console.log('No active session, creating new one...');
        currentSessionId = await createNewChatSession();
        if (!currentSessionId) {
          toast.error('Failed to create chat session. Please try again.');
          return;
        }
        toast.info('New chat session created.');
      }

      const sessionExists = chatSessions.some(s => s.id === currentSessionId);
      if (!sessionExists && currentSessionId !== activeChatSessionId) {
        console.log("Session doesn't exist in state, refreshing...");
        await loadChatSessions();
        const refreshedSessionExists = chatSessions.some(s => s.id === currentSessionId);
        if (!refreshedSessionExists) {
          toast.error('Session no longer exists after refresh. Creating a new one...');
          currentSessionId = await createNewChatSession();
          if (!currentSessionId) {
            toast.error('Failed to create new session.');
            return;
          }
        }
      }

      const { data: userMessageData, error: userMessageError } = await supabase
        .from('chat_messages')
        .insert({
          session_id: currentSessionId,
          user_id: user.id,
          content: trimmedMessage,
          role: 'user',
          timestamp: new Date().toISOString(),
        })
        .select()
        .single();

      if (userMessageError) {
        console.error('Error saving user message:', userMessageError);
        throw new Error('Failed to save your message');
      }

      const newUserMessage: Message = {
        id: userMessageData.id,
        content: userMessageData.content,
        role: userMessageData.role as 'user',
        timestamp: userMessageData.timestamp || new Date().toISOString(),
      };
      setChatMessages(prev => [...(prev || []), newUserMessage]);

      await _getAIResponse(trimmedMessage);
    } catch (error: any) {
      console.error('Error in handleSubmit:', error);
      toast.error(`Failed to send message: ${error.message || 'Unknown error'}`);
    } finally {
      setIsSubmittingUserMessage(false);
    }
  };

  const buildRichContext = (selectedIds: string[], allDocuments: AppDocument[], allNotes: Note[]) => {
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
  };

  const handleNewMessage = (message: Message) => {
    setChatMessages(prev => [...(prev || []), message]);
  };

  const handleDeleteMessage = async (messageId: string) => {
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
        loadSessionMessages(activeChatSessionId);
      } else {
        toast.success('Message deleted successfully.');
      }
    } catch (error: any) {
      console.error('Error in handleDeleteMessage:', error);
      toast.error(`Error deleting message: ${error.message || 'Unknown error'}`);
    }
  };

  const handleRegenerateResponse = async (lastUserMessageContent: string) => {
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

    await _getAIResponse(lastUserMessageContent, lastAssistantMessage.id);
  };

  const handleRetryFailedMessage = async (originalUserMessageContent: string, failedAiMessageId: string) => {
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

    await _getAIResponse(originalUserMessageContent, failedAiMessageId);
  };

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

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Signed out successfully');
      navigate('/auth');
    } catch (error) {
      toast.error('Error signing out');
    }
  };

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
    <div className="h-screen flex bg-gradient-to-br from-slate-50 to-blue-50 overflow-hidden">
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
        <Sidebar
          isOpen={isSidebarOpen}
          onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          noteCount={notes.length}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      </div>

      <div className="flex-1 flex flex-col min-w-0 lg:ml-0">
        <div className="flex items-center justify-between p-3 sm:p-4 bg-white border-b border-slate-200">
          <Header
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onNewNote={createNewNote}
            isSidebarOpen={isSidebarOpen}
            onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
            activeTab={activeTab}
          />
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

        <TabContent
          activeTab={activeTab}
          filteredNotes={filteredNotes}
          activeNote={activeNote}
          recordings={recordings ?? []} // Defensive check
          scheduleItems={scheduleItems}
          chatMessages={chatMessages}
          documents={documents}
          userProfile={userProfile}
          isAILoading={isAILoading}
          setIsAILoading={setIsAILoading}
          onNoteSelect={setActiveNote}
          onNoteUpdate={updateNote}
          onNoteDelete={deleteNote}
          onAddRecording={addRecording}
          onGenerateQuiz={generateQuiz}
          onAddScheduleItem={addScheduleItem}
          onUpdateScheduleItem={updateScheduleItem}
          onDeleteScheduleItem={deleteScheduleItem}
          onSendMessage={handleSubmit}
          onDocumentUploaded={handleDocumentUploaded}
          onDocumentDeleted={handleDocumentDeleted}
          onProfileUpdate={handleProfileUpdate}
          chatSessions={chatSessions}
          activeChatSessionId={activeChatSessionId}
          onChatSessionSelect={setActiveChatSessionId}
          onNewChatSession={createNewChatSession}
          onDeleteChatSession={deleteChatSession}
          onRenameChatSession={renameChatSession}
          onSelectedDocumentIdsChange={setSelectedDocumentIds}
          selectedDocumentIds={selectedDocumentIds}
          isChatHistoryOpen={isChatHistoryOpen}
          onToggleChatHistory={() => setIsChatHistoryOpen(!isChatHistoryOpen)}
          onNewMessage={handleNewMessage}
          isNotesHistoryOpen={isChatHistoryOpen}
          onToggleNotesHistory={() => setIsChatHistoryOpen(!isChatHistoryOpen)}
          onDeleteMessage={handleDeleteMessage}
          onRegenerateResponse={handleRegenerateResponse}
          isSubmittingUserMessage={isSubmittingUserMessage}
          onRetryFailedMessage={handleRetryFailedMessage}
        />
      </div>
    </div>
  );
};

export default Index;