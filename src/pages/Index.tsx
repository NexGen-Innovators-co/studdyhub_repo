import React, { useEffect, useMemo, useState } from 'react';
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

  // Social routing
  let activeSocialTab: string | undefined;
  let socialPostId: string | undefined;
  let socialGroupId: string | undefined;

  if (location.pathname.startsWith('/social/group/')) {
    activeSocialTab = 'group';
    socialGroupId = params.groupId;
  } else if (location.pathname.startsWith('/social/post/')) {
    activeSocialTab = 'post';
    socialPostId = params.postId;
  } else {
    activeSocialTab = params.tab as string | undefined;
  }

  // Context
  const {
    user,
    authLoading,
    dataLoading,
    currentTheme,
    isSidebarOpen,
    isAILoading,
    isSubmittingUserMessage,
    isLoadingSessionMessages,
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
    handleLoadOlderChatMessages,
    handleMessageUpdate,
    handleReplaceOptimisticMessage,
    handleNavigateToTab,
    handleCreateNew,
    appOperations,
    audioProcessing,
    setIsSidebarOpen,
    setActiveNote,
    setSearchQuery,
    setSelectedCategory,
    dispatch,
    detailedDataLoading,
    loadMoreDocuments,
    loadMoreRecordings,
    loadMoreNotes,
  } = useAppContext();

  const {
    handleSubmitMessage,
    handleDeleteMessage,
    handleRegenerateResponse,
    handleRetryFailedMessage,
  } = useMessageHandlers();

  // Auth redirect
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  const [socialSearchQuery, setSocialSearchQuery] = useState('');

  const headerProps = useMemo(() => ({
    searchQuery,
    onSearchChange: setSearchQuery,
    onNewNote: appOperations.createNewNote,
    isSidebarOpen,
    onToggleSidebar: () => setIsSidebarOpen(prev => !prev),
    activeTab: currentActiveTab as any,
    fullName: userProfile?.full_name || '',
    avatarUrl: userProfile?.avatar_url || '',
    activeSocialTab,
    socialPostId,
    socialGroupId,
    socialSearchQuery,
    onSocialSearchChange: (q: string) => setSocialSearchQuery(q),
    onOpenCreatePostDialog: () => navigate('/social?openCreate=true'),
  }), [
    searchQuery, appOperations.createNewNote, isSidebarOpen, setIsSidebarOpen,
    currentActiveTab, userProfile, activeSocialTab, socialPostId,
    socialGroupId, socialSearchQuery, navigate,
  ]);

  const sidebarProps = useMemo(() => ({
    isOpen: isSidebarOpen,
    onToggle: () => setIsSidebarOpen(prev => !prev),
    selectedCategory,
    onCategoryChange: setSelectedCategory,
    noteCount: notes.length,
    activeTab: currentActiveTab as any,
    activeSocialTab: activeSocialTab || 'feed',
    onTabChange: (tab: string) => {
      if (tab.startsWith('chat/') && activeChatSessionId) {
        navigate(`/${tab}`);
      } else if (tab === 'chat' && activeChatSessionId) {
        navigate(`/chat/${activeChatSessionId}`);
      } else if (tab === 'social' || tab.startsWith('social/')) {
        navigate(`/${tab}`);
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
    isSidebarOpen, setIsSidebarOpen, selectedCategory, setSelectedCategory,
    notes.length, currentActiveTab, activeSocialTab, navigate, chatSessions,
    activeChatSessionId, dispatch, createNewChatSession, deleteChatSession,
    renameChatSession, hasMoreChatSessions, handleLoadMoreChatSessions,
    currentTheme, handleThemeChange, userProfile,
  ]);

  // Clean tabContentProps – no duplicates, correct typo, real loading state
  const tabContentProps = useMemo(() => ({
    activeTab: currentActiveTab as any,
    activeSocialTab,
    socialPostId,
    socialGroupId,
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
    onAddScheduleItem: appOperations.addScheduleItem,           // Fixed typo
    onUpdateScheduleItem: appOperations.updateScheduleItem,
    onDeleteScheduleItem: appOperations.deleteScheduleItem,
    onSendMessage: handleSubmitMessage,
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
    onNavigateToTab: handleNavigateToTab,
    onCreateNew: handleCreateNew,
    onMessageUpdate: handleMessageUpdate,
    handleReplaceOptimisticMessage,

    // Infinite scroll – real values from context
    hasMoreDocuments: dataPagination.documents.hasMore,
    isLoadingDocuments: detailedDataLoading.documents,
    onLoadMoreDocuments: loadMoreDocuments,

    hasMoreRecordings: dataPagination.recordings.hasMore,
    isLoadingRecordings: detailedDataLoading.recordings,
    onLoadMoreRecordings: loadMoreRecordings,

    hasMoreNotes: dataPagination.notes.hasMore,
    isLoadingNotes: detailedDataLoading.notes,
    onLoadMoreNotes: loadMoreNotes,
  }), [
    currentActiveTab,
    activeSocialTab,
    socialPostId,
    socialGroupId,
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
    detailedDataLoading,
    loadMoreDocuments,
    loadMoreRecordings,
    loadMoreNotes,
  ]);

  const headerClass = useMemo(() => {
    const isNotesTab = currentActiveTab === 'notes';
    return `flex items-center ${isNotesTab ? '' : ''} justify-between w-full p-0 sm:p-0 shadow-none bg-white dark:bg-gray-600 border-none`;
  }, [currentActiveTab]);

  if (authLoading) return <LoadingScreen message="Authenticating..." progress={50} phase='initial' />;
  if (dataLoading) return <LoadingScreen message="Loading data..." progress={80} phase='core' />;
  if (!user) return null;

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:bg-gradient-to-br dark:from-gray-900 dark:via-gray-800 dark:to-gray-700 overflow-hidden">
      <div className={headerClass}>
        <Header {...headerProps} />
      </div>
      <div className="flex-1 flex">
        <Sidebar {...sidebarProps} />
        <div className="max-h-[95vh] w-full bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:bg-gradient-to-br dark:from-gray-900 dark:via-gray-800 dark:to-gray-700 overflow-y-auto modern-scrollbar">
          <TabContent {...tabContentProps} />
        </div>
      </div>
    </div>
  );
};

export default Index;