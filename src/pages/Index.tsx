// Index.tsx - Refactored to use AppContext
import React, { useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Sidebar } from '../components/layout/Sidebar';
import { Header } from '../components/layout/Header';
import { TabContent } from '../components/layout/TabContent';
import { useAppContext } from '../contexts/AppContext';
import { useMessageHandlers } from '../hooks/useAppContext';
import { LoadingScreen } from '@/components/ui/bookloader';

const Index = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get everything from context
  const {
    // Auth & loading states
    user,
    authLoading,
    dataLoading,
    
    // UI state
    currentTheme,
    isSidebarOpen,
    isAILoading,
    isSubmittingUserMessage,
    isLoadingSessionMessages,
    fileProcessingProgress,
    
    // Data
    notes,
    recordings,
    scheduleItems,
    documents,
    userProfile,
    activeNote,
    searchQuery,
    selectedCategory,
    filteredNotes,
    quizzes,
    dataPagination,
    
    // Chat data
    chatSessions,
    activeChatSessionId,
    selectedDocumentIds,
    filteredChatMessages,
    hasMoreMessages,
    hasMoreChatSessions,
    isNotesHistoryOpen,
    
    // Computed values
    currentActiveTab,
    
    // Actions
    handleThemeChange,
    createNewChatSession,
    deleteChatSession,
    renameChatSession,
    handleLoadMoreChatSessions,
    loadSessionMessages,
    handleLoadOlderChatMessages,
    handleMessageUpdate,
    handleReplaceOptimisticMessage,
    handleNavigateToTab,
    handleCreateNew,
    
    // App operations
    appOperations,
    
    // Audio processing
    audioProcessing,
    
    // Data setters
    setNotes,
    setRecordings,
    setIsSidebarOpen,
    setActiveNote,
    setSearchQuery,
    setSelectedCategory,
    setActiveTab,
    
    // Dispatch for direct state updates
    dispatch,
  } = useAppContext();

  // Get message handlers
  const {
    handleSubmitMessage,
    handleDeleteMessage,
    handleRegenerateResponse,
    handleRetryFailedMessage,
  } = useMessageHandlers();

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  // Memoized props to prevent unnecessary re-renders
  const headerProps = useMemo(() => ({
    searchQuery,
    onSearchChange: setSearchQuery,
    onNewNote: appOperations.createNewNote,
    isSidebarOpen,
    onToggleSidebar: () => setIsSidebarOpen(prev => !prev),
    activeTab: currentActiveTab as 'notes' | 'recordings' | 'schedule' | 'chat' | 'documents' | 'settings',
    fullName: userProfile?.full_name || '',
    avatarUrl: userProfile?.avatar_url || '',
  }), [
    searchQuery, 
    setSearchQuery, 
    appOperations.createNewNote, 
    isSidebarOpen, 
    setIsSidebarOpen, 
    currentActiveTab, 
    userProfile
  ]);

  const sidebarProps = useMemo(() => ({
    isOpen: isSidebarOpen,
    onToggle: () => setIsSidebarOpen(prev => !prev),
    selectedCategory,
    onCategoryChange: setSelectedCategory,
    noteCount: notes.length,
    activeTab: currentActiveTab as 'notes' | 'recordings' | 'schedule' | 'chat' | 'documents' | 'settings',
    onTabChange: (tab: string) => {
      if (tab.startsWith('chat/') && activeChatSessionId) {
        navigate(`/${tab}`);
      } else if (tab === 'chat' && activeChatSessionId) {
        navigate(`/chat/${activeChatSessionId}`);
      } else {
        navigate(`/${tab}`);
      }
      setIsSidebarOpen(false);
    },
    chatSessions,
    onChatSessionSelect: (sessionId: string) => {
      dispatch({ type: 'SET_ACTIVE_CHAT_SESSION', payload: sessionId });
      navigate(`/chat/${sessionId}`, { replace: true });
    },
    onNewChatSession: createNewChatSession,
    onDeleteChatSession: deleteChatSession,
    onRenameChatSession: renameChatSession,
    hasMoreChatSessions,
    onLoadMoreChatSessions: handleLoadMoreChatSessions,
    currentTheme,
    onThemeChange: handleThemeChange,
    fullName: userProfile?.full_name || '',
    avatarUrl: userProfile?.avatar_url || '',
    activeChatSessionId,
  }), [
    isSidebarOpen,
    setIsSidebarOpen,
    selectedCategory,
    setSelectedCategory,
    notes.length,
    currentActiveTab,
    navigate,
    chatSessions,
    activeChatSessionId,
    dispatch,
    createNewChatSession,
    deleteChatSession,
    renameChatSession,
    hasMoreChatSessions,
    handleLoadMoreChatSessions,
    currentTheme,
    handleThemeChange,
    userProfile,
  ]);

  const tabContentProps = useMemo(() => ({
    activeTab: currentActiveTab as 'dashboard' | 'notes' | 'recordings' | 'schedule' | 'chat' | 'documents' | 'settings' | 'social',
    filteredNotes,
    activeNote,
    recordings: recordings ?? [],
    scheduleItems,
    chatMessages: filteredChatMessages,
    documents,
    userProfile,
    isAILoading,
    setIsAILoading: (loading: boolean) => dispatch({ type: 'SET_IS_AI_LOADING', payload: loading }),
    onNoteSelect: setActiveNote,
    onNoteUpdate: appOperations.updateNote,
    onNoteDelete: appOperations.deleteNote,
    onAddRecording: appOperations.addRecording,
    onUpdateRecording: appOperations.updateRecording,
    onGenerateQuiz: appOperations.generateQuiz,
    onAddScheduleItem: appOperations.addScheduleItem,
    onUpdateScheduleItem: appOperations.updateScheduleItem,
    onDeleteScheduleItem: appOperations.deleteScheduleItem,
    onSendMessage: handleSubmitMessage,
    onDocumentUploaded: appOperations.handleDocumentUploaded,
    onDocumentUpdated: appOperations.updateDocument,
    onDocumentDeleted: appOperations.handleDocumentDeleted,
    onProfileUpdate: appOperations.handleProfileUpdate,
    chatSessions,
    activeChatSessionId,
    onChatSessionSelect: (sessionId: string) => 
      dispatch({ type: 'SET_ACTIVE_CHAT_SESSION', payload: sessionId }),
    onNewChatSession: createNewChatSession,
    onDeleteChatSession: deleteChatSession,
    onRenameChatSession: renameChatSession,
    onSelectedDocumentIdsChange: (ids: string[]) => 
      dispatch({ type: 'SET_SELECTED_DOCUMENT_IDS', payload: ids }),
    selectedDocumentIds,
    isNotesHistoryOpen,
    onToggleNotesHistory: () => 
      dispatch({ type: 'SET_IS_NOTES_HISTORY_OPEN', payload: !isNotesHistoryOpen }),
    onDeleteMessage: handleDeleteMessage,
    onRegenerateResponse: handleRegenerateResponse,
    isSubmittingUserMessage,
    onRetryFailedMessage: handleRetryFailedMessage,
    hasMoreMessages,
    onLoadOlderMessages: handleLoadOlderChatMessages,
    isLoadingSessionMessages,
    quizzes,
    onReprocessAudio: audioProcessing.triggerAudioProcessing,
    onDeleteRecording: appOperations.deleteRecording,
    onGenerateNote: audioProcessing.handleGenerateNoteFromAudio,
    // Dashboard specific props
    onNavigateToTab: handleNavigateToTab,
    onCreateNew: handleCreateNew,
    // Infinite scroll controls
    hasMoreDocuments: dataPagination.documents.hasMore,
    isLoadingDocuments: false,
    onLoadMoreDocuments: () => {}, // From context
    hasMoreRecordings: dataPagination.recordings.hasMore,
    isLoadingRecordings: false,
    onLoadMoreRecordings: () => {}, // From context
    onMessageUpdate: handleMessageUpdate,
    handleReplaceOptimisticMessage,
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
    dispatch,
    setActiveNote,
    appOperations,
    handleSubmitMessage,
    chatSessions,
    activeChatSessionId,
    selectedDocumentIds,
    isNotesHistoryOpen,
    handleDeleteMessage,
    handleRegenerateResponse,
    isSubmittingUserMessage,
    handleRetryFailedMessage,
    hasMoreMessages,
    handleLoadOlderChatMessages,
    isLoadingSessionMessages,
    quizzes,
    audioProcessing,
    handleNavigateToTab,
    handleCreateNew,
    handleMessageUpdate,
    handleReplaceOptimisticMessage,
    dataPagination,
  ]);

  // Determine header visibility based on current path
  const headerClass = useMemo(() => {
    const isNotesTab = location.pathname.startsWith('/notes');
    return isNotesTab
      ? 'hidden lg:block' 
      : "flex items-center sm:hidden justify-between w-full p-0 sm:p-0 shadow-none bg-transparent border-none";
  }, [location.pathname]);

  // Loading states
  if (authLoading) {
    return <LoadingScreen message="Authenticating..." progress={50} phase='initial' />;
  }

  if (dataLoading) {
    return <LoadingScreen message="Loading data..." progress={80} phase='core' />;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <div className={headerClass}>
        <Header {...headerProps} />
      </div>
      <div className="flex-1 flex overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:bg-gradient-to-br dark:from-gray-900 dark:via-gray-800 dark:to-gray-700">
        <Sidebar {...sidebarProps} />
        <TabContent {...tabContentProps} />
      </div>
    </div>
  );
};

export default Index;