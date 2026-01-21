// src/components/layout/TabContent.tsx
import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { NotesList } from '../notes/components/NotesList';
import { NoteEditor } from '../notes/NoteEditor';
import { ClassRecordings } from '../classRecordings/ClassRecordings';
import { Schedule } from '../schedules/Schedule';
import AIChat from '../aiChat/AiChat';
import { DocumentUpload } from '../documents/DocumentUpload';
import { UserSettings } from '../userSettings/UserSettings';
import Dashboard from '../dashboard/Dashboard';
import { Note } from '../../types/Note';
import { ClassRecording, ScheduleItem, Message, Quiz } from '../../types/Class';
import { Document, UserProfile } from '../../types/Document';
import ErrorBoundary from './ErrorBoundary';
import { toast } from 'sonner';
import { SocialFeed, SocialFeedHandle } from '../social/SocialFeed';
import { Quizzes } from '../quizzes/Quizzes';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { ChatSessionsListMobile } from '../aiChat/Components/ChatSessionsListMobile';
import { NotificationsPage } from '../notifications/NotificationsPage';
import { CourseLibrary } from '../courseLibrary/CourseLibrary';
// import { PodcastsPage } from '../podcasts/PodcastsPage';

// Lazy load PodcastsPage
const PodcastsPage = React.lazy(() => import('../podcasts/PodcastsPage').then(module => ({ default: module.PodcastsPage })));


interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  last_message_at: string;
  document_ids: string[];
  message_count?: number;
}

import { RefObject } from 'react';

interface TabContentProps {
  socialGroupId?: string; // Added
  activeTab: 'dashboard' | 'notes' | 'recordings' | 'quizzes' | 'schedule' | 'chat' | 'documents' | 'settings' | 'social' | 'podcasts' | 'library';
  activeSocialTab?: string;
  socialPostId?: string;
  podcastId?: string;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  socialSearchQuery?: string;
  onSocialSearchChange?: (query: string) => void;
  filteredNotes: Note[];
  activeNote: Note | null;
  recordings: ClassRecording[] | undefined;
  scheduleItems: ScheduleItem[];
  chatMessages: Message[];
  documents: Document[];
  userProfile: UserProfile | null;
  quizzes: Quiz[];
  isAILoading: boolean;
  setIsAILoading: (loading: boolean) => void;
  onNoteSelect: (note: Note | null) => void;
  onNoteUpdate: (note: Note) => Promise<void>;
  onNoteDelete: (noteId: string) => Promise<void>;
  onAddRecording: (recording: ClassRecording) => void;
  onUpdateRecording: (recording: ClassRecording) => void;
  onGenerateQuiz: (recording: ClassRecording, quiz: Quiz) => Promise<void>;
  onGenerateNote?: (recording: ClassRecording) => Promise<void>;
  onAddScheduleItem: (item: ScheduleItem) => Promise<void>;
  onUpdateScheduleItem: (item: ScheduleItem) => Promise<void>;
  onDeleteScheduleItem: (id: string) => Promise<void>;

  onNavigateToTab?: (tab: string) => void;
  onCreateNew?: (type: 'note' | 'recording' | 'schedule' | 'document') => void;

  onSendMessage: (
    message: string,
    attachedDocumentIds?: string[],
    attachedNoteIds?: string[],
    imageUrl?: string,
    imageMimeType?: string,
    imageDataBase64?: string,
    aiMessageIdToUpdate?: string | null,
    attachedFiles?: Array<{
      name: string;
      mimeType: string;
      data: string | null;
      type: 'image' | 'document' | 'other';
      size: number;
      content: string | null;
      processing_status: string;
      processing_error: string | null;
    }>,
    enableStreaming?: boolean  // NEW: Streaming mode flag
  ) => Promise<void>;

  // onDocumentUploaded: (document: Document) => Promise<void>;
  onDocumentDeleted: (documentId: string) => Promise<void>;
  onDocumentUpdated: (document: Document) => void;
  onProfileUpdate: (profile: UserProfile) => Promise<void>;
  chatSessions: ChatSession[];
  activeChatSessionId: string | null;
  onChatSessionSelect: React.Dispatch<React.SetStateAction<string | null>>;
  onNewChatSession: () => Promise<string | null>;
  onDeleteChatSession: (sessionId: string) => Promise<void>;
  onRenameChatSession: (sessionId: string, newTitle: string) => Promise<void>;
  onSelectedDocumentIdsChange: React.Dispatch<React.SetStateAction<string[]>>;
  selectedDocumentIds: string[];
  isNotesHistoryOpen: boolean;
  onRegenerateResponse: (lastUserMessageContent: string) => Promise<void>;
  onDeleteMessage: (messageId: string) => Promise<void>;
  onToggleNotesHistory: () => void;
  onRetryFailedMessage: (originalUserMessageContent: string, failedAiMessageId: string) => Promise<void>;
  onInterruptMessage?: () => void;
  onPauseGeneration?: () => void;
  onResumeGeneration?: (lastUserMessageContent: string, lastAssistantMessageId: string) => Promise<void>;
  onEditAndResendMessage?: (
    editedUserMessageContent: string,
    originalUserMessageId: string,
    originalAssistantMessageId: string | null,
    attachedDocumentIds: string[],
    attachedNoteIds: string[],
    imageUrl: string | null,
    imageMimeType: string | null
  ) => Promise<void>;
  streamingState?: any;
  isSubmittingUserMessage: boolean;
  hasMoreMessages: boolean;
  onLoadOlderMessages: () => Promise<void>;
  isLoadingSessionMessages: boolean;
  onReprocessAudio: (audioUrl: string, documentId: string) => Promise<void>;
  onDeleteRecording: (recordingId: string, documentId: string | null, audioUrl: string | null) => Promise<void>;
  onMessageUpdate: (message: Message) => void;

  hasMoreDocuments: boolean;
  isLoadingDocuments: boolean;
  onLoadMoreDocuments: () => void;
  hasMoreRecordings: boolean;
  isLoadingRecordings: boolean;
  onLoadMoreRecordings: () => void;
  handleReplaceOptimisticMessage: (tempId: string, newMessage: Message) => void;
  hasMoreNotes?: boolean;
  isLoadingNotes?: boolean;
  onLoadMoreNotes?: () => void;
  hasMoreChatSessions: boolean;
  onLoadMoreChatSessions: () => void;
  dispatch: React.Dispatch<any>;
  isLoadingChatSessions?: boolean;
  onRefresh?: () => void;
  refreshNotes?: () => Promise<void>;
  navigateToNote: (noteId: string | null) => void; // Fix the syntax error
  setSocialFeedRef?: (ref: RefObject<SocialFeedHandle>) => void;
  onSuggestAiCorrection?: (prompt: string) => Promise<void>;
}

export const TabContent: React.FC<TabContentProps> = (props) => {
  // Shared ref for SocialFeed, available in both social and podcasts tabs
  const socialFeedRef = useRef<SocialFeedHandle>(null);
  const { activeTab, userProfile, isAILoading, isNotesHistoryOpen, onToggleNotesHistory, activeSocialTab, socialPostId, podcastId } = props;
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Check if we should show notifications view
  const showNotifications = activeTab === 'dashboard' && searchParams.get('view') === 'notifications';


  // Add this function to handle note updates from the NotesList
  const handleNoteUpdateFromList = useCallback(async (noteId: string, updates: Partial<Note>) => {
    // Find the note in the filtered notes
    const noteToUpdate = props.filteredNotes.find(note => note.id === noteId);
    if (!noteToUpdate) return;

    // Create the updated note
    const updatedNote: Note = {
      ...noteToUpdate,
      ...updates
    };

    // Call the parent's onNoteUpdate function
    await props.onNoteUpdate(updatedNote);
  }, [props.filteredNotes, props.onNoteUpdate]);

  const handleDocumentsScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (!props.isLoadingDocuments && props.hasMoreDocuments) {
      const el = e.currentTarget;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 300) {  // was 120 → now 300
        props.onLoadMoreDocuments();
      }
    }
  }, [props.isLoadingDocuments, props.hasMoreDocuments, props.onLoadMoreDocuments]);

  const handleRecordingsScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (!props.isLoadingRecordings && props.hasMoreRecordings) {
      const el = e.currentTarget;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 120) {
        props.onLoadMoreRecordings();
      }
    }
  }, [props.isLoadingRecordings, props.hasMoreRecordings, props.onLoadMoreRecordings]);

  const notesProps = useMemo(() => ({
    notes: props.filteredNotes,
    activeNote: props.activeNote,
    onNoteSelect: props.onNoteSelect,
    onNoteUpdate: props.onNoteUpdate,
  }), [props.filteredNotes, props.activeNote, props.onNoteSelect, props.onNoteUpdate]);

  const recordingsProps = useMemo(() => ({
    recordings: props.recordings ?? [],
    onAddRecording: props.onAddRecording,
    onUpdateRecording: props.onUpdateRecording,
    onGenerateQuiz: props.onGenerateQuiz,
    onGenerateNote: props.onGenerateNote,
    quizzes: props.quizzes,
    onReprocessAudio: props.onReprocessAudio,
    onDeleteRecording: props.onDeleteRecording,
    searchQuery: props.searchQuery,
    onSearchChange: props.onSearchChange,
  }), [
    props.recordings,
    props.onAddRecording,
    props.onUpdateRecording,
    props.onGenerateQuiz,
    props.onGenerateNote,
    props.quizzes,
    props.onReprocessAudio,
    props.onDeleteRecording,
    props.searchQuery,
    props.onSearchChange,
  ]);

  const scheduleProps = useMemo(() => ({
    scheduleItems: props.scheduleItems,
    onAddItem: props.onAddScheduleItem,
    onUpdateItem: props.onUpdateScheduleItem,
    onDeleteItem: props.onDeleteScheduleItem,
  }), [props.scheduleItems, props.onAddScheduleItem, props.onUpdateScheduleItem, props.onDeleteScheduleItem]);

  const chatProps = useMemo(() => ({
    messages: props.activeChatSessionId ? props.chatMessages : [],
    documents: props.documents,
    onSendMessage: props.onSendMessage,
    notes: props.filteredNotes,
    selectedDocumentIds: props.selectedDocumentIds,
    onSelectionChange: props.onSelectedDocumentIdsChange,
    activeChatSessionId: props.activeChatSessionId,
    onNewChatSession: props.onNewChatSession,
    onDeleteChatSession: props.onDeleteChatSession,
    onRenameChatSession: props.onRenameChatSession,
    onChatSessionSelect: props.onChatSessionSelect,
    chatSessions: props.chatSessions,
    isLoading: isAILoading,
    setIsLoading: props.setIsAILoading,
    onDeleteMessage: props.onDeleteMessage,
    onRegenerateResponse: props.onRegenerateResponse,
    onRetryFailedMessage: props.onRetryFailedMessage,
    onInterruptMessage: props.onInterruptMessage,
    onPauseGeneration: props.onPauseGeneration,
    onResumeGeneration: props.onResumeGeneration,
    onEditAndResendMessage: props.onEditAndResendMessage,
    streamingState: props.streamingState,
    isSubmittingUserMessage: props.isSubmittingUserMessage,
    userProfile: userProfile,
    onSuggestAiCorrection: props.onSuggestAiCorrection,
    hasMoreMessages: props.hasMoreMessages,
    onLoadOlderMessages: props.onLoadOlderMessages,
    onDocumentUpdated: props.onDocumentUpdated,
    isLoadingSessionMessages: props.isLoadingSessionMessages,
    learningStyle: userProfile?.learning_style || 'visual',
    learningPreferences: userProfile?.learning_preferences || {},
    onSendMessageToBackend: async (
      messageContent: string,
      attachedDocumentIds?: string[],
      attachedNoteIds?: string[],
      attachedFiles?: Array<{
        name: string;
        mimeType: string;
        data: string | null;
        type: 'image' | 'document' | 'other';
        size: number;
        content: string | null;
        processing_status: string;
        processing_error: string | null;
      }>
    ) => {
      let imageUrl: string | undefined;
      let imageMimeType: string | undefined;
      let imageDataBase64: string | undefined;

      if (attachedFiles && attachedFiles.length > 0) {
        const imageFile = attachedFiles.find(file => file.type === 'image');
        if (imageFile && imageFile.data) {
          imageUrl = imageFile.data;
          imageMimeType = imageFile.mimeType;
          imageDataBase64 = imageFile.data;
        }
      }

      await props.onSendMessage(
        messageContent,
        attachedDocumentIds,
        attachedNoteIds,
        imageUrl,
        imageMimeType,
        imageDataBase64,
        null, // aiMessageIdToUpdate
        attachedFiles,
        localStorage.getItem('ai-streaming-mode') === 'true' // Read streaming mode from localStorage
      );
    },
    onMessageUpdate: props.onMessageUpdate,
    onReplaceOptimisticMessage: props.handleReplaceOptimisticMessage,
    onLoadMoreDocuments: props.onLoadMoreDocuments,
    hasMoreDocuments: props.hasMoreDocuments,
    isLoadingDocuments: props.isLoadingDocuments

  }),
    [
      props.activeChatSessionId,
      props.chatMessages,
      props.documents,
      props.onSendMessage,
      props.filteredNotes,
      props.selectedDocumentIds,
      props.onSelectedDocumentIdsChange,
      props.onNewChatSession,
      props.onDeleteChatSession,
      props.onRenameChatSession,
      props.onChatSessionSelect,
      props.chatSessions,
      isAILoading,
      props.setIsAILoading,
      props.onDeleteMessage,
      props.onRegenerateResponse,
      props.onRetryFailedMessage,
      props.isSubmittingUserMessage,
      userProfile,
      props.onSuggestAiCorrection,
      props.hasMoreMessages,
      props.onLoadOlderMessages,
      props.onDocumentUpdated,
      props.isLoadingSessionMessages,
      userProfile?.learning_style,
      userProfile?.learning_preferences,
      props.onMessageUpdate,
      props.hasMoreDocuments,
      props.onLoadMoreDocuments,
      props.isLoadingDocuments,
      props.onInterruptMessage,
      props.onPauseGeneration,
      props.onResumeGeneration,
      props.onEditAndResendMessage,
      props.streamingState
    ]);

  const documentsProps = useMemo(() => ({
    documents: props.documents,
    // onDocumentUploaded: props.onDocumentUploaded,
    onDocumentDeleted: props.onDocumentDeleted,
    onDocumentUpdated: props.onDocumentUpdated,
    searchQuery: props.searchQuery,
    onSearchChange: props.onSearchChange,
  }), [
    props.documents,
    props.onDocumentDeleted,
    props.onDocumentUpdated,
    props.searchQuery,
    props.onSearchChange
  ]);

  const notesHistoryProps = useMemo(() => ({
    notes: props.filteredNotes,
    activeNote: props.activeNote,
    onNoteSelect: props.onNoteSelect,
    onNoteDelete: props.onNoteDelete,
    onNoteUpdate: handleNoteUpdateFromList, // Add this line for inline editing
    isOpen: isNotesHistoryOpen,
    onClose: onToggleNotesHistory,
    hasMore: props.hasMoreNotes,
    isLoadingMore: props.isLoadingNotes,
    onLoadMore: props.onLoadMoreNotes,
    onRefresh: props.refreshNotes,
    isLoading: props.isLoadingNotes && !props.filteredNotes.length,
    navigateToNote: props.navigateToNote
  }), [
    props.filteredNotes,
    props.activeNote,
    props.onNoteSelect,
    props.onNoteDelete,
    handleNoteUpdateFromList, // Add this
    isNotesHistoryOpen,
    onToggleNotesHistory,
    props.hasMoreNotes,
    props.isLoadingNotes,
    props.onLoadMoreNotes,
    props.onRefresh,
    props.refreshNotes,
    props.navigateToNote
  ]);

  const dashboardProps = useMemo(() => ({
    notes: props.filteredNotes,
    recordings: props.recordings ?? [],
    documents: props.documents,
    scheduleItems: props.scheduleItems,
    chatMessages: props.chatMessages,
    userProfile: props.userProfile,
    onNavigateToTab: props.onNavigateToTab || (() => { }),
    onCreateNew: props.onCreateNew || (() => { }),
  }), [
    props.filteredNotes,
    props.recordings,
    props.documents,
    props.scheduleItems,
    props.chatMessages,
    props.userProfile,
    props.onNavigateToTab,
    props.onCreateNew,
  ]);

  // Keep track of visited tabs to maintain state/cache
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(new Set());

  // Update visited tabs
  useEffect(() => {
    setVisitedTabs(prev => {
      const newCtx = new Set(prev);
      newCtx.add(activeTab);
      return newCtx;
    });
  }, [activeTab]);

  // Always connect the ref when it exists (SocialFeed is mounted hidden)
  useEffect(() => {
    if (props.setSocialFeedRef && socialFeedRef.current) {
      props.setSocialFeedRef(socialFeedRef);
    }
  });

  const isSocialOrPodcastActive = activeTab === 'social' || activeTab === 'podcasts';
  const shouldRenderSocial = activeTab === 'social' || visitedTabs.has('social') || isSocialOrPodcastActive;
  const shouldRenderPodcasts = activeTab === 'podcasts' || visitedTabs.has('podcasts') || isSocialOrPodcastActive;

  return (
    <>
      {/* OTHER TABS - Controlled by Switch (Unmount when inactive) */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden" style={{ display: !isSocialOrPodcastActive ? 'flex' : 'none' }}>
        {(() => {
          switch (activeTab) {
            case 'dashboard':
              // Check if we should show notifications view
              if (showNotifications) {
                return (
                  <div className="flex-1 overflow-y-auto modern-scrollbar dark:bg-transparent">
                    <ErrorBoundary>
                      <NotificationsPage />
                    </ErrorBoundary>
                  </div>
                );
              }
              return (
                <div className="flex-1 pb-6 p-3 sm:p-6 overflow-y-auto modern-scrollbar dark:bg-transparent">
                  <ErrorBoundary>
                    <Dashboard {...dashboardProps} />
                  </ErrorBoundary>
                </div>
              );

            case 'notes':
              return (
                <div className="h-full w-full flex items-center justify-center dark:bg-transparent overflow-hidden">
                  {/* Centered Container with max-width */}
                  <div className="w-full h-full max-w-[1400px] mx-auto flex relative lg:shadow-2xl">
                    {/* Click overlay for mobile when sidebar is open */}
                    {isNotesHistoryOpen && (
                      <div
                        className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
                        onClick={onToggleNotesHistory}
                      />
                    )}

                    {/* Notes List - Sidebar */}
                    <div className={`
                        ${isNotesHistoryOpen ? 'translate-x-0' : '-translate-x-full'}
                        lg:translate-x-0 lg:static lg:w-80 lg:flex-shrink-0
                        fixed inset-y-0 left-0 lg:z-0 z-30 w-72 bg-white dark:bg-slate-900 shadow-lg lg:shadow-none
                        transition-transform duration-300 ease-in-out lg:transition-none
                        lg:border-r lg:border-gray-200 lg:dark:border-gray-700 lg:max-h-[90vh]
                      `}>
                      <NotesList
                        {...notesHistoryProps}
                        isOpen={isNotesHistoryOpen}
                        onClose={onToggleNotesHistory}
                      />
                    </div>

                    {/* Editor Area - Centered content */}
                    <div className="flex-1 h-full lg:max-h-[90vh] bg-white dark:bg-gradient-to-br dark:from-gray-900 dark:via-gray-800 dark:to-gray-700 overflow-hidden">
                      {notesProps.activeNote ? (
                        <NoteEditor
                          note={notesProps.activeNote}
                          onNoteUpdate={notesProps.onNoteUpdate}
                          userProfile={userProfile}
                          onToggleNotesHistory={onToggleNotesHistory}
                          isNotesHistoryOpen={isNotesHistoryOpen}
                        />
                      ) : (
                        <div className="h-full flex items-center justify-center text-slate-400 p-4 dark:text-gray-500">
                          <div className="text-center">
                            <div className="text-4xl sm:text-6xl mb-4">📝</div>
                            <h3 className="text-lg sm:text-xl font-medium mb-2">No note selected</h3>
                            <p className="text-sm sm:text-base">Select a note to start editing or create a new one</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );

            case 'recordings':
              return (
                <div className="flex-1 p-3 sm:p-0 overflow-y-auto modern-scrollbar dark:bg-transparent" onScroll={handleRecordingsScroll}>
                  <ErrorBoundary>
                    <ClassRecordings {...recordingsProps} />
                  </ErrorBoundary>
                </div>
              );

            case 'quizzes':
              return (
                <div className="flex-1 overflow-y-auto modern-scrollbar dark:bg-transparent">
                  <ErrorBoundary>
                    <Quizzes
                      quizzes={props.quizzes}
                      recordings={props.recordings ?? []}
                      onGenerateQuiz={props.onGenerateQuiz}
                      userId={props.userProfile?.id || ''}
                    />
                  </ErrorBoundary>
                </div>
              );

            case 'schedule':
              return (
                <div className="flex-1 p-3 sm:p-0 overflow-y-auto modern-scrollbar dark:bg-transparent">
                  <Schedule {...scheduleProps} />
                </div>
              );

            case 'chat':
              const isMobile = window.innerWidth < 1024;
              const showSessionList = isMobile && (location.pathname === '/chat' || !props.activeChatSessionId);

              return showSessionList ? (
                // Mobile: Full screen session list
                <div className="flex-1 flex flex-col min-h-0 bg-gray-50 dark:bg-slate-900">
                  <ChatSessionsListMobile
                    chatSessions={props.chatSessions ?? []}
                    activeChatSessionId={props.activeChatSessionId}
                    onSessionSelect={(sessionId) => {
                      props.dispatch({ type: 'SET_ACTIVE_CHAT_SESSION', payload: sessionId });
                      navigate(`/chat/${sessionId}`);
                    }}
                    onNewChatSession={async () => {
                      const newId = await props.onNewChatSession();
                      if (newId) navigate(`/chat/${newId}`);
                    }}
                    onDeleteChatSession={props.onDeleteChatSession}
                    onRenameChatSession={props.onRenameChatSession}
                    hasMoreChatSessions={props.hasMoreChatSessions}
                    onLoadMoreChatSessions={props.onLoadMoreChatSessions}
                    isLoading={props.isLoadingChatSessions ?? false}
                  />
                </div>
              ) : (
                // Desktop: Side-by-side OR Mobile: Full chat
                <div className="flex-1 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800">
                  <AIChat {...chatProps} setIsLoading={props.setIsAILoading} />
                </div>
              );
            case 'documents':
              return (
                <div className="flex-1 p-3 sm:p-0 overflow-y-hidden dark:bg-transparent" onScroll={handleDocumentsScroll}>
                  <DocumentUpload {...documentsProps} />
                </div>
              );

            case 'library':
              return (
                <div className="flex-1 p-3 sm:p-0 overflow-y-auto modern-scrollbar dark:bg-transparent">
                  <ErrorBoundary>
                    <CourseLibrary />
                  </ErrorBoundary>
                </div>
              );

            case 'settings':
              return (
                <div className="flex-1 p-3 sm:p-0 overflow-y-auto modern-scrollbar dark:bg-transparent">
                  <UserSettings
                    profile={props.userProfile}
                    onProfileUpdate={props.onProfileUpdate}
                  />
                </div>
              );

            default:
              return null;
          }
        })()}
      </div>

      {/* PERSISTENT VIEWS: Social & Podcasts (Load once, keep alive) */}
      {shouldRenderSocial && (
        <div className="flex-1 p-0 sm:p-0 overflow-y-scroll  modern-scrollbar dark:bg-transparent" style={{ display: activeTab === 'social' ? 'block' : 'none', height: activeTab === 'social' ? '100%' : '0px' }}>
          <ErrorBoundary>
            <SocialFeed
              key="social-feed-component"
              ref={socialFeedRef}
              activeTab={props.activeSocialTab}
              postId={props.socialPostId}
              searchQuery={props.socialSearchQuery}
              onSearchChange={props.onSocialSearchChange}
            />
          </ErrorBoundary>
        </div>
      )}

      {shouldRenderPodcasts && (
        <div className="flex-1 overflow-hidden" style={{ display: activeTab === 'podcasts' ? 'block' : 'none', height: activeTab === 'podcasts' ? '100%' : '0px' }}>
          <ErrorBoundary>
            <React.Suspense fallback={
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
              </div>
            }>
              <PodcastsPage
                searchQuery={props.searchQuery}
                podcastId={podcastId}
                onGoLive={() => {
                  if ((window as any).__podcastGoLive) {
                    (window as any).__podcastGoLive();
                  }
                }}
                onCreatePodcast={() => {
                  if ((window as any).__podcastCreate) {
                    (window as any).__podcastCreate();
                  }
                }}
                socialFeedRef={socialFeedRef}
                onNavigateToTab={props.onNavigateToTab}
              />
            </React.Suspense>
          </ErrorBoundary>
        </div>
      )}
    </>
  );
};