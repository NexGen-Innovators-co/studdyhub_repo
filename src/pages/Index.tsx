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
  created_at: Date;
  updated_at: Date;
  last_message_at: Date;
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
  // Initialize activeChatSessionId as null to show empty chat initially
  const [activeChatSessionId, setActiveChatSessionId] = useState<string | null>(null);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [isChatHistoryOpen, setIsChatHistoryOpen] = useState(false);

  useEffect(() => {
    if (user) {
      loadChatSessions();
    }
  }, [user]);

  useEffect(() => {
    // Only load messages if an active session is explicitly selected
    if (activeChatSessionId) {
      loadSessionMessages(activeChatSessionId);
    } else {
      // Clear messages if no session is active (e.g., initial load or after deleting last session)
      setChatMessages([]);
    }
  }, [activeChatSessionId, user]); // Added user to dependency array

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
        created_at: new Date(session.created_at),
        updated_at: new Date(session.updated_at),
        last_message_at: new Date(session.last_message_at),
        document_ids: session.document_ids || []
      }));

      setChatSessions(formattedSessions);
      // Do NOT set activeChatSessionId here. It will be set explicitly by user selection or new chat creation.
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
        timestamp: new Date(msg.timestamp || Date.now())
      }));

      setChatMessages(formattedMessages);
    } catch (error) {
      console.error('Error loading session messages:', error);
      setChatMessages([]); // Clear messages on error
      toast.error('Failed to load chat messages for this session.');
    }
  };

  const createNewChatSession = async () => {
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
          document_ids: selectedDocumentIds
        })
        .select()
        .single();

      if (error) throw error;

      const newSession: ChatSession = {
        id: data.id,
        title: data.title,
        created_at: new Date(data.created_at),
        updated_at: new Date(data.updated_at),
        last_message_at: new Date(data.last_message_at),
        document_ids: data.document_ids || []
      };

      setChatSessions(prev => [newSession, ...prev]);
      setActiveChatSessionId(newSession.id); // Set the new session as active
      setChatMessages([]); // Clear messages for the new session
      toast.success('New chat session created!');
      setIsChatHistoryOpen(false); // Close history sidebar on mobile

      return newSession.id;
    } catch (error) {
      console.error('Error creating new session:', error);
      toast.error('Failed to create new chat session');
      return null;
    }
  };

  const deleteChatSession = async (sessionId: string) => {
    try {
      if (!user) return;

      // Delete from database
      const { error } = await supabase
        .from('chat_sessions')
        .delete()
        .eq('id', sessionId)
        .eq('user_id', user.id);

      if (error) throw error;

      // Update state
      setChatSessions(prev => prev.filter(s => s.id !== sessionId));

      if (activeChatSessionId === sessionId) {
        const remainingSessions = chatSessions.filter(s => s.id !== sessionId);
        if (remainingSessions.length > 0) {
          setActiveChatSessionId(remainingSessions[0].id); // Set active to the first remaining session
        } else {
          setActiveChatSessionId(null); // No sessions left, set to null
        }
      }
      toast.success('Chat session deleted.');
    } catch (error) {
      console.error('Error deleting session:', error);
      toast.error('Failed to delete chat session');
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

      setChatSessions(prev => prev.map(s =>
        s.id === sessionId ? { ...s, title: newTitle } : s
      ));
      toast.success('Chat session renamed.');
    } catch (error) {
      console.error('Error renaming session:', error);
      toast.error('Failed to rename chat session');
    }
  };

  const handleSendMessage = async (messageContent: string) => {
    if (!user) {
      toast.error("User not authenticated.");
      return;
    }

    // 1. Immediately add user message to local state
    const newUserMessage: Message = {
      id: crypto.randomUUID(),
      content: messageContent,
      role: 'user',
      timestamp: new Date(),
    };
    setChatMessages(prevMessages => [...(prevMessages || []), newUserMessage]);
    setIsAILoading(true);
    // 2. Add a temporary AI loading message
    // const aiLoadingMessage: Message = {
    //   id: 'loading-ai-response',
    //   content: 'AI is thinking...',
    //   role: 'assistant',
    //   timestamp: new Date(),
    // };
    // setChatMessages(prevMessages => [...(prevMessages || [])]);
    try {
      const context = buildRichContext(selectedDocumentIds, documents, notes);

      // Prepare chat history to send to the Edge Function
      const historyToSend = (chatMessages || []).filter(msg => msg.id !== 'loading-ai-response');

      const { data, error } = await supabase.functions.invoke('gemini-chat', {
        body: {
          message: messageContent,
          userId: user.id,
          sessionId: activeChatSessionId,
          learningStyle: userProfile?.learning_style || 'visual',
          learningPreferences: userProfile?.learning_preferences || {
            explanation_style: userProfile?.learning_preferences?.explanation_style || 'detailed',
            examples: userProfile?.learning_preferences?.examples || 'yes',
            difficulty: userProfile?.learning_preferences?.difficulty || 'medium',
          },
          context,
          chatHistory: historyToSend
        }
      });

      if (error) {
        throw new Error('Failed to get AI response: ' + error.message);
      }

      const aiResponseContent = data.response;

      // 3. Replace loading message with actual AI response
      setChatMessages(prevMessages => {
        const currentMessages = prevMessages || [];
        const updatedMessages = currentMessages.filter(msg => msg.id !== 'loading-ai-response');
        const newAiMessage: Message = {
          id: crypto.randomUUID(),
          content: aiResponseContent,
          role: 'assistant',
          timestamp: new Date(),
        };
        return [...updatedMessages, newAiMessage];
      });

      // Update session last_message_at and document_ids in DB
      const { error: updateError } = await supabase
        .from('chat_sessions')
        .update({
          last_message_at: new Date().toISOString(),
          document_ids: selectedDocumentIds
        })
        .eq('id', activeChatSessionId);

      if (updateError) {
        console.error('Error updating chat session:', updateError);
        toast.error('Failed to update chat session details.');
      }

      // Directly update the specific session in state and re-sort
      setChatSessions(prevSessions => {
        const updatedSessions = prevSessions.map(session =>
          session.id === activeChatSessionId
            ? { ...session, last_message_at: new Date(), document_ids: selectedDocumentIds }
            : session
        );
        return updatedSessions.sort((a, b) => b.last_message_at.getTime() - a.last_message_at.getTime());
      });

    } catch (error: any) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message: ' + error.message);
      setChatMessages(prevMessages => (prevMessages || []).filter(msg => msg.id !== 'loading-ai-response'));
    } finally {
      setIsAILoading(false);
    }
  };

  // Helper function to build rich context
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
      {/* Mobile backdrop for main sidebar */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        fixed lg:relative inset-y-0 left-0 z-50 lg:z-auto
        transition-transform duration-300 ease-in-out`}>
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

      {/* Main content */}
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
          recordings={recordings}
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
          onSendMessage={handleSendMessage}
          onDocumentUploaded={handleDocumentUploaded}
          onDocumentDeleted={handleDocumentDeleted}
          onProfileUpdate={handleProfileUpdate}
          // Pass chat session props
          chatSessions={chatSessions}
          activeChatSessionId={activeChatSessionId}
          onChatSessionSelect={setActiveChatSessionId}
          onNewChatSession={createNewChatSession}
          onDeleteChatSession={deleteChatSession}
          onRenameChatSession={renameChatSession}
          onSelectedDocumentIdsChange={setSelectedDocumentIds}
          selectedDocumentIds={selectedDocumentIds}
          // Pass responsive chat history state and toggle
          isChatHistoryOpen={isChatHistoryOpen}
          onToggleChatHistory={() => setIsChatHistoryOpen(!isChatHistoryOpen)}
          onNewMessage={handleNewMessage}
          isNotesHistoryOpen={isChatHistoryOpen} // New prop
          onToggleNotesHistory={() => setIsChatHistoryOpen(!isChatHistoryOpen)}
        />
      </div>
    </div>
  );
};

export default Index;
