import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { Sidebar } from '../components/layout/Sidebar';
import { Header } from '../components/layout/Header';
import { TabContent } from '../components/layout/TabContent';
import { useAppContext } from '../hooks/useAppContext';
import { useMessageHandlers } from '../hooks/useMessageHandlers';
import { LoadingScreen } from '@/components/ui/bookloader';
import { clearCache } from '@/utils/socialCache';
import { QuickTips } from '@/components/notes/components/QuickTip';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { set } from 'date-fns';

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
    dataErrors,
    retryLoading,
    clearError,
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

  // Filter critical errors - moved BEFORE any conditional returns
  const criticalErrors = useMemo(() => {
    if (!dataErrors) return {};
    
    const critical: Record<string, string> = {};
    Object.entries(dataErrors).forEach(([key, value]) => {
      // Consider notes and profile as critical, documents as less critical
      if (key === 'notes' || key === 'profile') {
        critical[key] = value;
      }
    });
    return critical;
  }, [dataErrors]);

  // Enhanced header props with error awareness
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
    // Add error indicators
    hasDataErrors: Object.keys(dataErrors || {}).length > 0,
  }), [
    searchQuery, appOperations.createNewNote, isSidebarOpen, setIsSidebarOpen,
    currentActiveTab, userProfile, activeSocialTab, socialPostId,
    socialGroupId, socialSearchQuery, navigate, dataErrors,
  ]);

  // Enhanced sidebar props with error handling
  const sidebarProps = useMemo(() => ({
    isOpen: isSidebarOpen,
    onToggle: () => setIsSidebarOpen(prev => !prev),
    selectedCategory,
    onCategoryChange: setSelectedCategory,
    noteCount: notes?.length || 0,
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
    dataErrors,
    onRetryData: retryLoading,
  }), [
    isSidebarOpen, setIsSidebarOpen, selectedCategory, setSelectedCategory,
    notes?.length, currentActiveTab, activeSocialTab, navigate, chatSessions,
    activeChatSessionId, dispatch, createNewChatSession, deleteChatSession,
    renameChatSession, hasMoreChatSessions, handleLoadMoreChatSessions,
    currentTheme, handleThemeChange, userProfile, dataErrors, retryLoading,
  ]);

  // Enhanced tabContentProps with error handling and safe data access
  const tabContentProps = useMemo(() => ({
    activeTab: currentActiveTab as any,
    activeSocialTab,
    socialPostId,
    socialGroupId,
    filteredNotes: filteredNotes || [],
    activeNote,
    recordings: recordings ?? [],
    scheduleItems: scheduleItems ?? [],
    chatMessages: filteredChatMessages ?? [],
    documents: documents ?? [],
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
    onDocumentUpdated: appOperations.updateDocument,
    onDocumentDeleted: appOperations.handleDocumentDeleted,
    onProfileUpdate: appOperations.handleProfileUpdate,
    chatSessions: chatSessions ?? [],
    activeChatSessionId,
    onChatSessionSelect: (sessionId: string) =>
      dispatch({ type: 'SET_ACTIVE_CHAT_SESSION', payload: sessionId }),
    onNewChatSession: createNewChatSession,
    onDeleteChatSession: deleteChatSession,
    onRenameChatSession: renameChatSession,
    onSelectedDocumentIdsChange: (ids: string[]) =>
      dispatch({ type: 'SET_SELECTED_DOCUMENT_IDS', payload: ids }),
    selectedDocumentIds: selectedDocumentIds ?? [],
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
    quizzes: quizzes ?? [],
    onReprocessAudio: audioProcessing.triggerAudioProcessing,
    onDeleteRecording: appOperations.deleteRecording,
    onGenerateNote: audioProcessing.handleGenerateNoteFromAudio,
    onNavigateToTab: handleNavigateToTab,
    onCreateNew: handleCreateNew,
    onMessageUpdate: handleMessageUpdate,
    handleReplaceOptimisticMessage,
    hasMoreDocuments: dataPagination?.documents?.hasMore ?? false,
    isLoadingDocuments: detailedDataLoading?.documents ?? false,
    onLoadMoreDocuments: loadMoreDocuments,
    hasMoreRecordings: dataPagination?.recordings?.hasMore ?? false,
    isLoadingRecordings: detailedDataLoading?.recordings ?? false,
    onLoadMoreRecordings: loadMoreRecordings,
    hasMoreNotes: dataPagination?.notes?.hasMore ?? false,
    isLoadingNotes: detailedDataLoading?.notes ?? false,
    onLoadMoreNotes: loadMoreNotes,
    dataErrors: dataErrors || {},
    onRetryData: retryLoading,
    onClearError: clearError,
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
    dataErrors,
    retryLoading,
    clearError,
  ]);

  const headerClass = useMemo(() => {
    const isNotesTab = currentActiveTab === 'notes';
    return `flex items-center ${isNotesTab ? '' : ''} justify-between w-full p-0 sm:p-0 shadow-none bg-white dark:bg-gray-600 border-none`;
  }, [currentActiveTab]);


  if (!user) return null;

  // Show error screen if critical data failed to load
  if (dataErrors?.profile) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-700">
        <div className="text-center p-8 max-w-md">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Failed to Load Profile
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            We couldn't load your user profile. This may be due to network issues.
          </p>
          <div className="space-y-3">
            <Button 
              onClick={() => retryLoading('profile')}
              className="w-full flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </Button>
            <Button 
              variant="outline"
              onClick={() => window.location.reload()}
              className="w-full"
            >
              Refresh Page
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:bg-gradient-to-br dark:from-gray-900 dark:via-gray-800 dark:to-gray-700 overflow-hidden">
      {/* Smart Responsive Header */}
      <header className={`
        sticky top-0 
        bg-white dark:bg-slate-900 
        border-b border-slate-200 dark:border-slate-800 
        shadow-sm z-20
        ${(currentActiveTab !== 'chat')
          ? '  lg:z-20 '
          : 'block lg:hidden'}
      `}>
        <Header {...headerProps} />
      </header>
      
      <div className="flex-1 flex relative lg:z-10">
        <div className={`z-30 ${currentActiveTab !== 'chat' ? 'lg:hidden ' : 'block'}`}>
          <Sidebar {...sidebarProps} />
        </div>
        <div className={`h-screen z-10 w-full dark:bg-gradient-to-br dark:from-gray-900 dark:via-gray-800 dark:to-gray-700 overflow-y-auto modern-scrollbar animate-in slide-in-from-top-2 fade-in duration-500`}>
          <TabContent {...tabContentProps} />
        </div>
      </div>
      <QuickTips />
    </div>
  );
};

export default Index;