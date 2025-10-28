// Modified Index.tsx
import React, { useEffect, useMemo } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { Sidebar } from '../components/layout/Sidebar';
import { Header } from '../components/layout/Header';
import { TabContent } from '../components/layout/TabContent';
import { useAppContext } from '../hooks/useAppContext';
import { useMessageHandlers } from '../hooks/useMessageHandlers';
import { LoadingScreen } from '@/components/ui/bookloader';

const Index = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();

  // Determine activeSocialTab and socialId based on path and params
  let activeSocialTab: string | undefined;
  let socialPostId: string | undefined;
  let socialGroupId: string | undefined;

  if (location.pathname.startsWith('/social/group')) {
    activeSocialTab = 'group';
    socialGroupId = params.groupId;
  } else if (location.pathname.startsWith('/social/post')) {
    activeSocialTab = 'post';
    socialPostId = params.postId;
  } else {
    activeSocialTab = params.tab as string | undefined;
  }

  // Get everything from context
  const {
    user,
    authLoading,
    dataLoading,
    currentTheme,
    isSidebarOpen,
    isAILoading,
    isSubmittingUserMessage,
    isLoadingSessionMessages,
    fileProcessingProgress,
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
    chatSessions,
    activeChatSessionId,
    selectedDocumentIds,
    filteredChatMessages,
    hasMoreMessages,
    hasMoreChatSessions,
    isNotesHistoryOpen,
    currentActiveTab,
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
    appOperations,
    audioProcessing,
    setNotes,
    setRecordings,
    setIsSidebarOpen,
    setActiveNote,
    setSearchQuery,
    setSelectedCategory,
    setActiveTab,
    dispatch,
  } = useAppContext();

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
    activeTab: currentActiveTab as 'notes' | 'recordings' | 'schedule' | 'chat' | 'documents' | 'settings' | 'social', 
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
    activeTab: currentActiveTab as 'notes' | 'recordings' | 'schedule' | 'chat' | 'documents' | 'settings' | 'social', 
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
    // Social Tab Routing
    activeSocialTab,
    socialPostId,
    socialGroupId, // Added
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
    // onDocumentUploaded: appOperations.handleDocumentUploaded,
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
    onLoadMoreDocuments: () => { }, // From context
    hasMoreRecordings: dataPagination.recordings.hasMore,
    isLoadingRecordings: false,
    onLoadMoreRecordings: () => { }, // From context
    onMessageUpdate: handleMessageUpdate,
    handleReplaceOptimisticMessage,
  }), [
    currentActiveTab,
    activeSocialTab,
    socialPostId,
    socialGroupId, // Added
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
    userProfile,
  ]);

  // Determine header visibility based on current path
  const headerClass = useMemo(() => {
    const isNotesTab = currentActiveTab === 'notes';
    return `flex items-center ${isNotesTab ? '' : 'sm:hidden'} justify-between w-full p-0 sm:p-0 shadow-none bg-transparent border-none`;
  }, [currentActiveTab]);

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