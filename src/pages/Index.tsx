import React, { useEffect, useMemo, useState, useTransition } from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { Sidebar } from '../components/layout/Sidebar';
import LivePodcastViewer from '@/components/podcasts/LivePodcastViewer';
import LivePodcastHost from '@/components/podcasts/LivePodcastHost';
import { fetchFullPodcastData, fetchLightPodcastData } from '@/hooks/usePodcasts';
// Lazy-load PodcastPanel so the shell can show a podcast-shaped skeleton while it loads
const PodcastPanel = React.lazy(() => import('@/components/podcasts/PodcastPanel').then(m => ({ default: m.PodcastPanel })));
import { Header } from '../components/layout/Header';
import { TabContent } from '../components/layout/TabContent';
import { useRef } from 'react';
import { SocialFeedHandle } from '../components/social/SocialFeed';
import { useAppContext } from '../hooks/useAppContext';
import { useMessageHandlers } from '../hooks/useMessageHandlers';
import BookPagesAnimation from '@/components/ui/bookloader';
import { QuickTips } from '@/components/notes/components/QuickTip';
import { AlertTriangle, Bot, FileText, Home, Mic, RefreshCw, Users2, X, Grid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import AIBot from '@/components/ui/aibot';
import { Helmet } from 'react-helmet-async';
import { SubscriptionStatusBar } from '@/components/subscription/SubscriptionStatusBar';
import { initializePushNotifications, getNotificationPermissionStatus, requestNotificationPermission } from '@/services/notificationInitService';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useNotifications } from '@/hooks/useNotifications';
import { Document } from '@/types/Document';
import { supabase } from '@/integrations/supabase/client';
import { MobileMenu } from '@/components/layout/MobileMenu';

const Index = () => {
  const isOnline = useOnlineStatus();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const navState = (location.state || null) as { podcast?: any } | null;

  // Context
  const {
    pendingAttachment,
    setPendingAttachment,
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
    refreshNotes,
    navigateToNote,
    subscription,
    subscriptionLoading,
    subscriptionTier,
    subscriptionLimits,
    checkSubscriptionAccess,
    refreshSubscription,
    daysRemaining,
    bonusAiCredits,
  } = useAppContext();

  // Notifications modal state and logic (now inside Index to access 'user')

  const { preferences } = useNotifications();
  // Onboarding modal controls: unified flow to request notifications, mic, camera
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [requestingPermission, setRequestingPermission] = useState(false);
  const ONBOARDING_KEY = 'studdyhub_onboarding_completed_v1';

  // Show unified onboarding modal when the user prefers notifications but hasn't
  // completed onboarding. Persist in localStorage to avoid repeat prompts.
  useEffect(() => {
    if (!user) return;
    try {
      const done = localStorage.getItem(ONBOARDING_KEY);
      if (done === '1') return; // already completed
    } catch (e) {
      // ignore localStorage errors
    }

    if (preferences?.push_notifications) {
      const permission = getNotificationPermissionStatus();
      if (permission === 'default') {
        setShowOnboardingModal(true);
      }
    }
  }, [user, preferences]);

  // Unified handler: request notifications, microphone, and camera in sequence
  const handleEnableAllPermissions = async () => {
    setRequestingPermission(true);
    try {
      // Notifications
      try {
        await requestNotificationPermission();
      } catch (e) {
        // console.warn('Notification permission request failed', e);
      }

      // Microphone
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          await navigator.mediaDevices.getUserMedia({ audio: true });
        }
      } catch (e) {
        // // console.warn('Microphone permission request failed or denied', e);
      }

      // Camera
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          await navigator.mediaDevices.getUserMedia({ video: true });
        }
      } catch (e) {
        //console.warn('Camera permission request failed or denied', e);
      }

      // Optionally: request other permissions here (geolocation, clipboard, etc.)
    } finally {
      setRequestingPermission(false);
      setShowOnboardingModal(false);
      try { localStorage.setItem(ONBOARDING_KEY, '1'); } catch (e) { /* ignore */ }
    }
  };

  // If the user dismisses onboarding, mark as completed for now so it doesn't retrigger immediately
  const handleDismissOnboarding = () => {
    try { localStorage.setItem(ONBOARDING_KEY, '1'); } catch (e) { /* ignore */ }
    setShowOnboardingModal(false);
  };

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

  const {
    handleSubmitMessage,
    handleDeleteMessage,
    handleRegenerateResponse,
    handleRetryFailedMessage,
    handleInterruptMessage,
    handlePauseGeneration,
    handleResumeGeneration,
    handleEditAndResendMessage,
    handleSuggestAiCorrection,
    streamingState,
  } = useMessageHandlers();

  const [externalDocuments, setExternalDocuments] = useState<Document[]>([]);

  // Handle documentId from URL query params (fetch if missing)
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const documentId = searchParams.get('documentId');
    const previewId = searchParams.get('preview');

    const idsToFetch: string[] = [];
    if (documentId && !documents.find(d => d.id === documentId) && !externalDocuments.find(d => d.id === documentId)) {
      idsToFetch.push(documentId);
    }
    if (previewId && !documents.find(d => d.id === previewId) && !externalDocuments.find(d => d.id === previewId)) {
      if (!idsToFetch.includes(previewId)) {
        idsToFetch.push(previewId);
      }
    }

    if (idsToFetch.length > 0) {
      const fetchDocs = async () => {
        const { data, error } = await supabase
          .from('documents')
          .select('*')
          .in('id', idsToFetch);

        if (data) {
          setExternalDocuments(prev => {
            const existingIds = new Set(prev.map(d => d.id));
            const newDocs = (data as Document[]).filter(d => !existingIds.has(d.id));
            return [...prev, ...newDocs];
          });
        }
      };
      fetchDocs();
    }

    // Always attempt to select the document if it's in the URL
    // We do this independently of fetching to ensure the UI state reflects the URL intent immediately
    const courseId = searchParams.get('courseId');
    const courseTitle = searchParams.get('courseTitle');
    const courseCode = searchParams.get('courseCode');

    if (courseId) {
      dispatch({ type: 'SET_CURRENT_COURSE', payload: { id: courseId, title: courseTitle || undefined, code: courseCode || undefined } });
    } else {
      // Clear if not provided
      dispatch({ type: 'SET_CURRENT_COURSE', payload: null });
    }

    if (documentId) {
      // Clear pendingAttachment if present
      if (pendingAttachment) setPendingAttachment(null);
      // Force new chat mode if we are in a session
      if (activeChatSessionId) {
        dispatch({ type: 'SET_ACTIVE_CHAT_SESSION', payload: null });
      }
      if (!selectedDocumentIds.includes(documentId)) {
        dispatch({ type: 'SET_SELECTED_DOCUMENT_IDS', payload: [documentId] });
      }
    } else if (pendingAttachment && pendingAttachment.length > 0) {
      // If no documentId in URL but pendingAttachment exists, use it
      dispatch({ type: 'SET_SELECTED_DOCUMENT_IDS', payload: pendingAttachment });
      setPendingAttachment(null);
    }
  }, [location.search, documents, externalDocuments, dispatch, selectedDocumentIds, activeChatSessionId, pendingAttachment, setPendingAttachment]);

  const allDocuments = useMemo(() => {
    const existingIds = new Set(documents.map(d => d.id));
    const newDocs = externalDocuments.filter(d => !existingIds.has(d.id));
    return [...documents, ...newDocs];
  }, [documents, externalDocuments]);

  // Extract IDs from URL
  const sessionId = params.sessionId;
  const postId = params.postId;
  const groupId = params.groupId;
  const userId = params.userId;
  const tab = params.tab;
  const podcastId = params.podcastId;
  const liveId = params.id; // for /podcast/live/:id or /podcast/:id

  // Detect live route
  const isLiveRoute = location.pathname.startsWith('/podcast/live/');
  const liveQuery = new URLSearchParams(location.search);
  const liveHostMode = liveQuery.get('host') === '1' || liveQuery.get('live') === 'host';

  const isPodcastPage = location.pathname.startsWith('/podcast/') && !isLiveRoute;
  const podcastPageId = isPodcastPage ? params.id : null;
  const [podcastPageData, setPodcastPageData] = useState<any | null>(null);
  const [isPending, startTransition] = useTransition();

  // Load podcast data when visiting /podcast/:id. Use navigation state if available to avoid flash.
  useEffect(() => {
    let mounted = true;

    // Only clear podcastPageData if the podcastPageId actually changes
    setPodcastPageData(prev => (prev && prev.id !== podcastPageId ? null : prev));

    // If the navigator passed the podcast data in state, use it immediately
    if (navState?.podcast && podcastPageId && navState.podcast.id === podcastPageId) {
      setPodcastPageData(navState.podcast);
      return () => { mounted = false; };
    }

    (async () => {
      if (!podcastPageId) return;
      try {
        // First try to fetch lightweight data for fast render
        const light = await fetchLightPodcastData(podcastPageId);
        if (mounted && light) {
          // Merge with existing minimal shape expected by PodcastPanel
          setPodcastPageData(prev => ({ ...(prev || {}), ...light }));
        }

        // Then fetch full data in background and hydrate
        const full = await fetchFullPodcastData(podcastPageId);
        if (mounted && full) {
          setPodcastPageData(full);
        }
      } catch (e) {
        // // console.warn('Failed to load podcast page data', e);
        // podcastPageData will remain null, so no stale data is shown
      }
    })();
    return () => { mounted = false; };
  }, [podcastPageId, navState]);

  // // Provide a minimal placeholder podcast object while full data is loading
  // const placeholderPodcast = useMemo(() => ({
  //   id: podcastPageId || 'loading',
  //   title: 'Loading podcast…',
  //   description: '',
  //   audioSegments: [],
  //   duration: 0,
  //   visual_assets: [],
  //   cover_image_url: null,
  //   tags: [],
  //   audio_url: null,
  // }), [podcastPageId]);

  if (location.pathname.startsWith('/social/group/')) {
    activeSocialTab = 'group';
    socialGroupId = groupId;
  } else if (location.pathname.startsWith('/social/post/')) {
    activeSocialTab = 'post';
    socialPostId = postId;
  } else if (location.pathname.startsWith('/social/profile/')) {
    activeSocialTab = 'profile';
  } else {
    activeSocialTab = tab as string | undefined;
  }
  const [socialSearchQuery, setSocialSearchQuery] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const getPageSEO = () => {
    const pathname = location.pathname;

    // If it's a social route, let DynamicHead handle it
    if (pathname.startsWith('/social/')) {
      return null; // DynamicHead will handle this
    }

    // App page SEO
    const pageData = {
      dashboard: {
        title: 'Dashboard | StuddyHub',
        description: 'Your personalized study dashboard with AI-powered insights',
      },
      notes: {
        title: 'Smart Notes | StuddyHub',
        description: 'Create, organize, and summarize your study notes with AI assistance',
      },
      recordings: {
        title: 'Class Recordings | StuddyHub',
        description: 'Record, transcribe, and summarize your lectures with AI',
      },
      schedule: {
        title: 'Study Schedule | StuddyHub',
        description: 'Plan and organize your study sessions',
      },
      chat: {
        title: 'AI Study Assistant | StuddyHub',
        description: 'Get instant help with your studies from our AI assistant',
      },
      social: {
        title: 'Social Learning | StuddyHub',
        description: 'Connect with other students, share notes, and collaborate',
      },
      podcasts: {
        title: 'AI Podcasts | StuddyHub',
        description: 'Discover and create AI-powered podcast conversations from your study materials',
      },
      settings: {
        title: 'Settings | StuddyHub',
        description: 'Customize your StuddyHub experience',
      },
      quizzes: {
        title: 'Quizzes | StuddyHub',
        description: 'Test your knowledge with AI-generated quizzes',
      },
    };

    return pageData[currentActiveTab as keyof typeof pageData] || pageData.dashboard;
  };

  const pageSEO = getPageSEO();

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
    onNewNote: appOperations.createNewNote,
    isSidebarOpen,
    onToggleSidebar: () => setIsSidebarOpen(prev => !prev),
    activeTab: currentActiveTab as any,
    fullName: userProfile?.full_name || '',
    avatarUrl: userProfile?.avatar_url || '',
    activeSocialTab,
    socialPostId,
    socialGroupId,
    onOpenCreatePostDialog: () => navigate('/social?openCreate=true'),
    onGoLive: () => {
      if ((window as any).__podcastGoLive) {
        (window as any).__podcastGoLive();
      }
    },
    onUploadDocument: () => {
      if (currentActiveTab !== 'documents') {
        handleNavigateToTab('documents');
        setTimeout(() => {
          window.dispatchEvent(new Event('trigger-document-upload'));
        }, 300);
      } else {
        window.dispatchEvent(new Event('trigger-document-upload'));
      }
    },
    onCreatePodcast: () => {
      if ((window as any).__podcastCreate) {
        (window as any).__podcastCreate();
      } else {
        navigate('/chat');
      }
    },
    // Add error indicators
    hasDataErrors: Object.keys(dataErrors || {}).length > 0,
    currentTheme: currentTheme,
    onThemeChange: handleThemeChange,
    subscriptionTier,
    subscriptionLoading,
    daysRemaining,
    onNavigateToSubscription: () => handleNavigateToTab('subscription'),
  }), [subscriptionTier, subscriptionLoading, daysRemaining,
    appOperations.createNewNote, isSidebarOpen, setIsSidebarOpen,
    currentActiveTab, userProfile, activeSocialTab, socialPostId,
    socialGroupId, navigate, dataErrors, currentTheme, handleThemeChange,
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

  // SocialFeed ref for cross-tab post creation
  const socialFeedRef = useRef<SocialFeedHandle>(null);

  // Enhanced tabContentProps with error handling and safe data access
  const tabContentProps = useMemo(() => ({
    activeTab: currentActiveTab as any,
    activeSocialTab,
    socialPostId,
    socialGroupId,
    podcastId,
    searchQuery,
    onSearchChange: setSearchQuery,
    socialSearchQuery,
    onSocialSearchChange: (q: string) => setSocialSearchQuery(q),
    filteredNotes: filteredNotes || [],
    activeNote,
    recordings: recordings ?? [],
    scheduleItems: scheduleItems ?? [],
    chatMessages: filteredChatMessages ?? [],
    documents: allDocuments ?? [],
    userProfile,
    isAILoading,
    setIsAILoading: (loading: boolean) => dispatch({ type: 'SET_IS_AI_LOADING', payload: loading }),
    onNoteSelect: setActiveNote,
    onNoteUpdate: appOperations.updateNote,
    onNoteDelete: appOperations.deleteNote,
    onAddRecording: appOperations.addRecording,
    setSocialFeedRef: (ref: React.RefObject<SocialFeedHandle>) => {
      // Only set if not already set
      if (ref && ref !== socialFeedRef) {
        socialFeedRef.current = ref.current;
      }
    },
    socialFeedRef,
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
    onResumeGeneration: handleResumeGeneration,
    onEditAndResendMessage: handleEditAndResendMessage,
    onSuggestAiCorrection: handleSuggestAiCorrection,
    streamingState,
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
    hasMoreChatSessions: hasMoreChatSessions ?? false,
    onLoadMoreChatSessions: handleLoadMoreChatSessions,
    dispatch,                                         // ← from useAppContext()
    isLoadingChatSessions: isLoadingSessionMessages, // ← rename for clarity
    onRefresh: () => retryLoading('notes'),
    refreshNotes,
    navigateToNote,
    subscriptionTier,
    subscriptionLimits,
    checkSubscriptionAccess,
    onSearchNotes: appOperations?.searchNotesFromDB,
  }), [
    currentActiveTab,
    activeSocialTab,
    socialPostId,
    socialGroupId,
    podcastId,
    searchQuery,
    socialSearchQuery,
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
    refreshNotes,
    navigateToNote,
    subscriptionTier,
    subscriptionLimits,
    checkSubscriptionAccess
  ]);

  // Auth redirect (existing)
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  // Initialize push notifications after user is authenticated
  useEffect(() => {
    if (user && !authLoading) {
      // Small delay to ensure service worker is registered
      const timer = setTimeout(() => {
        initializePushNotifications().catch(error => {
          //console.error('Failed to initialize push notifications:', error);
        });
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [user, authLoading]);

  const headerClass = useMemo(() => {
    const isNotesTab = currentActiveTab === 'notes';
    return `flex items-center ${isNotesTab ? '' : ''} justify-between w-full p-0 sm:p-0 shadow-none bg-white dark:bg-gray-600 border-none`;
  }, [currentActiveTab]);

  if (!user) return null;

  // // Show error screen if critical data failed to load
  // if (dataErrors?.profile) {
  //   return (
  //     <div className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-700">
  //       <div className="text-center p-8 max-w-md">
  //         <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
  //         <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
  //           Failed to Load Profile
  //         </h2>
  //         <p className="text-gray-600 dark:text-gray-400 mb-6">
  //           We couldn't load your user profile. This may be due to network issues.
  //         </p>
  //         <div className="space-y-3">
  //           <Button
  //             onClick={() => retryLoading('profile')}
  //             className="w-full flex items-center justify-center gap-2"
  //           >
  //             <RefreshCw className="w-4 h-4" />
  //             Try Again
  //           </Button>
  //           <Button
  //             variant="outline"
  //             onClick={() => window.location.reload()}
  //             className="w-full"
  //           >
  //             Refresh Page
  //           </Button>
  //         </div>
  //       </div>
  //     </div>
  //   );
  // }

  return (

    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:bg-gradient-to-br dark:from-gray-900 dark:via-gray-800 dark:to-gray-700 overflow-hidden">

      {/* Unified Onboarding Modal (Notifications + Microphone + Camera) */}
      <Dialog open={showOnboardingModal} onOpenChange={setShowOnboardingModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Get the best StuddyHub experience</DialogTitle>
            <DialogDescription>
              To provide reminders, live audio features, and inline media, we'd like permission to send notifications and access your microphone and camera. You can change these later in Settings.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-2">
            <div className="text-sm text-gray-600">What we'll request:</div>
            <ul className="list-disc ml-5 text-sm text-gray-700">
              <li>Push notifications for reminders and social updates</li>
              <li>Microphone access for voice messages and recordings</li>
              <li>Camera access for profile photos and live sessions</li>
            </ul>
          </div>
          <DialogFooter>
            <Button onClick={handleDismissOnboarding} variant="outline" disabled={requestingPermission}>
              Not Now
            </Button>
            <Button onClick={handleEnableAllPermissions} disabled={requestingPermission}>
              {requestingPermission ? 'Enabling...' : 'Enable All'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Smart Responsive Header */}
      {pageSEO && (
        <Helmet>
          <title>{pageSEO.title}</title>
          <meta name="description" content={pageSEO.description} />
          <meta property="og:title" content={pageSEO.title} />
          <meta property="og:description" content={pageSEO.description} />
        </Helmet>
      )}
      {/* Hide the header on podcast pages and live podcast routes */}
      {!(isLiveRoute || isPodcastPage) && (
        <header className={`
          sticky top-0 
          bg-white dark:bg-slate-900 
          border-b border-slate-200 dark:border-slate-800 
          shadow-sm z-40
          ${(currentActiveTab !== 'chat')
            ? '  lg:z-40 '
            : 'block lg:hidden'}
        `}>
          <Header onThemeChange={handleThemeChange} {...headerProps} />
        </header>
      )}

      {/* Subscription Status Bar for free users */}
      <SubscriptionStatusBar />

      <div className="flex-1 flex relative overflow-hidden">
        <div className={`${currentActiveTab === 'chat' ? 'block' : 'lg:hidden'}`}>
          <Sidebar {...sidebarProps} />
        </div>

        {/* Main Content */}
        <div className="flex-1 h-full overflow-y-auto modern-scrollbar bg-gray-50 dark:bg-slate-900">
          <div className="min-h-full">
            {isLiveRoute && liveId ? (
              // Render the live page inline instead of a modal
              liveHostMode ? (
                <LivePodcastHost podcastId={liveId} onEndStream={() => navigate('/podcasts')} />
              ) : (
                <LivePodcastViewer podcastId={liveId} onClose={() => navigate('/podcasts')} />
              )
            ) : isPodcastPage && podcastPageId ? (
              // Render podcast detail page inline; lazy-load the panel and show a podcast-shaped skeleton while loading
              <React.Suspense fallback={
                <div className="p-6 animate-pulse">
                  <div className="h-8 bg-gray-200 dark:bg-slate-700 rounded w-1/3 mb-4" />
                  <div className="h-56 bg-gray-200 dark:bg-slate-700 rounded mb-4" />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="h-6 bg-gray-200 dark:bg-slate-700 rounded" />
                    <div className="h-6 bg-gray-200 dark:bg-slate-700 rounded" />
                  </div>
                  <div className="mt-4 h-36 bg-gray-200 dark:bg-slate-700 rounded" />
                </div>
              }>
                {podcastPageData === null ? (
                  <div className="p-6 animate-pulse">
                    <div className="h-8 bg-gray-200 dark:bg-slate-700 rounded w-1/3 mb-4" />
                    <div className="h-56 bg-gray-200 dark:bg-slate-700 rounded mb-4" />
                    <div className="grid grid-cols-2 gap-4">
                      <div className="h-6 bg-gray-200 dark:bg-slate-700 rounded" />
                      <div className="h-6 bg-gray-200 dark:bg-slate-700 rounded" />
                    </div>
                    <div className="mt-4 h-36 bg-gray-200 dark:bg-slate-700 rounded" />
                  </div>
                ) : (
                  <PodcastPanel
                    podcast={podcastPageData}
                    onClose={() => startTransition(() => navigate('/podcasts'))}
                    onPodcastSelect={(id) => startTransition(() => navigate(`/podcast/${id}`))}
                    isOpen={true}
                  />
                )}
              </React.Suspense>
            ) : (
              <TabContent {...tabContentProps} />
            )}
          </div>
        </div>
      </div>

      {/* Bottom Navigation - Hide when inside a chat session on mobile */}
      {!(
        (currentActiveTab === 'chat' && activeChatSessionId && location.pathname === '/chat/' + activeChatSessionId)
        || isLiveRoute
        || isPodcastPage
      ) && (
          <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 z-20 shadow-2xl">
            <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
              {[
                { tab: 'dashboard', label: 'Home', icon: Home },
                { tab: 'notes', label: 'Notes', icon: FileText },
                {
                  tab: 'chat',
                  icon: AIBot,
                  size: "lg" as const, // Pass "lg" size to AIBot
                  isSpecial: true
                },
                { tab: 'social', label: 'Social', icon: Users2 },
                { tab: 'more', label: 'More', icon: Grid },
              ].map(({ tab, label, icon: Icon, size = undefined, isSpecial = false }) => {
                const isActive =
                  currentActiveTab === tab ||
                  (tab === 'chat' && location.pathname.startsWith('/chat')) ||
                  (tab === 'social' && location.pathname.startsWith('/social'));

                return (
                  <button
                    key={tab}
                    onClick={() => {
                      if (tab === 'chat') {
                        handleNavigateToTab('chat');
                      } else if (tab === 'more') {
                        setIsMobileMenuOpen(true);
                      } else {
                        handleNavigateToTab(tab);
                      }
                    }}
                    className={`
                    relative flex flex-col items-center justify-center flex-1 h-full py-2
                    transition-all duration-300
                    ${isActive
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                      }
                  `}
                  >
                    {/* AIBot gets special styling and size prop */}
                    <div className={`relative ${isActive ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                      {isSpecial ? (
                        // Pass size prop to AIBot component
                        <Icon size={size} className="mb-1" />
                      ) : (
                        <Icon className="h-6 w-6 mb-1" />
                      )}

                      {/* Add a subtle glow effect for active AI tab */}
                      {isActive && tab === 'chat' && (
                        <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-md -z-10"></div>
                      )}
                    </div>
                    <span className={`text-xs font-medium ${isActive ? 'font-bold' : ''}`}>
                      {label}
                    </span>

                    {/* Active Indicator */}
                    {isActive && (
                      <motion.div
                        layoutId="bottomNavIndicator"
                        className="absolute bottom-0 w-12 h-1 bg-blue-600 dark:bg-blue-400 rounded-t-full"
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </nav>
        )}

      <MobileMenu
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        onNavigate={(tab) => {
          handleNavigateToTab(tab);
          setIsMobileMenuOpen(false);
        }}
        activeTab={currentActiveTab}
      />

      <QuickTips />
    </div>
  );
};

export default Index;
