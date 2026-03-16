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
import { CreateNoteFlowDialog } from '../notes/components/CreateNoteFlowDialog';
import { Card } from '../ui/card';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookMarked,
  Lightbulb,
  Globe,
  Headphones,
  Users,
  Archive,
  Sparkles,
  ArrowRight,
  ChevronRight,
  Play,
  Plus,
} from 'lucide-react';
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
  onCreateNoteWithData?: (title: string, content: string, category: any) => void;

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
  onSearchNotes?: (searchQuery: string) => Promise<Note[]>;
}


export const EmptyNotesState: React.FC<{ 
  recordings?: ClassRecording[];
  documents?: Document[];
  onCreateNote?: () => void;
  onToggleSidebar?: () => void;
  onCreateNoteWithTemplate?: (data: { title: string; content: string; category: any }) => void;
}> = ({ recordings, documents, onCreateNote, onToggleSidebar, onCreateNoteWithTemplate }) => {
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  
  const features = [
    {
      id: 'organization',
      icon: BookMarked,
      title: 'Smart Organization',
      description: 'Categorize by subject, add tags, and find notes with powerful search',
      color: 'from-blue-500 to-blue-600',
      accentColor: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-950/20',
    },
    {
      id: 'ai-insights',
      icon: Sparkles,
      title: 'AI-Powered Insights',
      description: 'Get summaries, explanations, and study guides instantly',
      color: 'from-purple-500 to-purple-600',
      accentColor: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-50 dark:bg-purple-950/20',
    },
    {
      id: 'languages',
      icon: Globe,
      title: 'Multi-Language',
      description: 'Study in 100+ languages with instant translation',
      color: 'from-emerald-500 to-emerald-600',
      accentColor: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-50 dark:bg-emerald-950/20',
    },
    {
      id: 'audio',
      icon: Headphones,
      title: 'Audio Learning',
      description: 'Listen to your notes with natural-sounding text-to-speech',
      color: 'from-orange-500 to-orange-600',
      accentColor: 'text-orange-600 dark:text-orange-400',
      bgColor: 'bg-orange-50 dark:bg-orange-950/20',
    },
    {
      id: 'collaborate',
      icon: Users,
      title: 'Collaborate',
      description: 'Share with classmates and build study groups together',
      color: 'from-pink-500 to-pink-600',
      accentColor: 'text-pink-600 dark:text-pink-400',
      bgColor: 'bg-pink-50 dark:bg-pink-950/20',
    },
    {
      id: 'export',
      icon: Archive,
      title: 'Export & Share',
      description: 'Download as PDF, export to different formats',
      color: 'from-indigo-500 to-indigo-600',
      accentColor: 'text-indigo-600 dark:text-indigo-400',
      bgColor: 'bg-indigo-50 dark:bg-indigo-950/20',
    },
  ];

  const hasRecordings = recordings && recordings.length > 0;
  const hasDocuments = documents && documents.length > 0;

  return (
    <>
      <CreateNoteFlowDialog
        isOpen={isTemplateDialogOpen}
        onClose={() => setIsTemplateDialogOpen(false)}
        onCreateNote={(data) => {
          setIsTemplateDialogOpen(false);
          onCreateNoteWithTemplate?.(data);
        }}
      />
      
      <div className="h-full w-full overflow-y-auto pb-24 sm:pb-0">
        <div className="min-h-full bg-gradient-to-br from-white via-blue-50/30 to-white dark:from-slate-900 dark:via-slate-800/50 dark:to-slate-900">
          {/* Hero Header - Mobile optimized */}
          <div className="px-4 sm:px-6 lg:px-8 pt-6 sm:pt-12 lg:pt-16 pb-4 sm:pb-8 border-b border-slate-200/50 dark:border-slate-700/50">
            <div className="max-w-6xl mx-auto text-center">
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <div className="flex justify-center mb-3 sm:mb-4">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-500 rounded-2xl opacity-10 blur-xl"></div>
                    <BookMarked className="relative h-10 w-10 sm:h-16 sm:w-16 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
                
                <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-600 dark:from-gray-100 dark:to-gray-300 mb-2">
                  Start Taking Notes
                </h1>
                <p className="text-sm sm:text-base lg:text-lg text-slate-600 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">
                  {hasRecordings && !hasDocuments && `You have ${recordings?.length} recording${recordings?.length !== 1 ? 's' : ''}. Create your first note.`}
                  {hasDocuments && !hasRecordings && `You have ${documents?.length} document${documents?.length !== 1 ? 's' : ''}. Organize your learning.`}
                  {hasRecordings && hasDocuments && `You have ${recordings?.length} recording${recordings?.length !== 1 ? 's' : ''} and ${documents?.length} document${documents?.length !== 1 ? 's' : ''}.`}
                  {!hasRecordings && !hasDocuments && "Begin your learning journey with powerful organization and AI."}
                </p>
              </motion.div>
            </div>
          </div>

          {/* Main Content */}
          <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-12 lg:py-16 pb-8">
            <div className="max-w-6xl mx-auto">
              {/* Action Button - Mobile First (moved up) */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="flex justify-center mb-8 sm:mb-12"
              >
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setIsTemplateDialogOpen(true)}
                  className="w-full sm:w-auto relative px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl sm:rounded-2xl font-semibold text-base sm:text-lg shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center gap-2 overflow-hidden group"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-700 to-blue-800 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <BookMarked className="h-5 w-5 sm:h-6 sm:w-6 relative" />
                  <span className="relative">Create with Template</span>
                </motion.button>
              </motion.div>

              {/* Feature Cards Grid - Mobile optimized with fewer cards showing */}
              <motion.div
                layout
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5 lg:gap-6 mb-8 sm:mb-12"
              >
                <AnimatePresence>
                  {features.map((feature, idx) => {
                    // Only show first 3 features on mobile, all on larger screens
                    const isMobileHidden = idx >= 3 && typeof window !== 'undefined' && window.innerWidth < 640;
                    if (isMobileHidden) return null;

                    const Icon = feature.icon;
                    return (
                      <motion.div
                        key={feature.id}
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.4, delay: idx * 0.05 }}
                        className="h-full group hidden sm:block lg:block"
                        onMouseEnter={() => setHoveredCard(feature.id)}
                        onMouseLeave={() => setHoveredCard(null)}
                      >
                        <Card className="overflow-hidden h-full relative bg-white dark:bg-slate-900/70 border border-slate-200/60 dark:border-slate-700/60 transition-all duration-300 hover:shadow-lg hover:border-slate-300/80 dark:hover:border-slate-600/80 cursor-pointer">
                          {/* Background Gradient */}
                          <motion.div
                            className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-5 transition-opacity duration-500`}
                          />

                          {/* Content */}
                          <div className="relative p-4 sm:p-5 lg:p-6 flex flex-col h-full">
                            {/* Icon Container */}
                            <motion.div
                              className={`mb-3 ${feature.bgColor} rounded-lg p-2.5 sm:p-3 lg:p-4 w-fit`}
                              animate={{
                                y: hoveredCard === feature.id ? -4 : 0,
                              }}
                              transition={{ duration: 0.3 }}
                            >
                              <Icon className={`h-5 w-5 sm:h-6 sm:w-6 lg:h-7 lg:w-7 ${feature.accentColor} transition-transform duration-300 group-hover:scale-110`} />
                            </motion.div>

                            {/* Text Content */}
                            <div className="flex-1">
                              <h3 className="text-base sm:text-lg lg:text-xl font-bold text-slate-800 dark:text-gray-100 mb-1.5 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r transition-all duration-300" style={{backgroundImage: hoveredCard === feature.id ? `linear-gradient(to right, var(--color-start), var(--color-end))` : 'none'}}>
                                {feature.title}
                              </h3>
                              <p className="text-xs sm:text-sm lg:text-base text-slate-600 dark:text-gray-400 leading-snug">
                                {feature.description}
                              </p>
                            </div>
                          </div>

                          {/* Hover Border Accent */}
                          <motion.div
                            className={`absolute bottom-0 left-0 h-1 bg-gradient-to-r ${feature.color}`}
                            animate={{
                              width: hoveredCard === feature.id ? '100%' : '0%',
                            }}
                            transition={{ duration: 0.4 }}
                          />
                        </Card>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </motion.div>

              {/* Mobile-only: Show feature highlights as simple list */}
              <div className="sm:hidden mb-8 space-y-3">
                {features.slice(0, 3).map((feature, idx) => {
                  const Icon = feature.icon;
                  return (
                    <motion.div
                      key={feature.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: idx * 0.1 }}
                      className={`flex gap-3 p-3 rounded-lg ${feature.bgColor} border border-slate-200/40 dark:border-slate-700/40`}
                    >
                      <Icon className={`h-5 w-5 flex-shrink-0 mt-0.5 ${feature.accentColor}`} />
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-slate-800 dark:text-gray-100">{feature.title}</h3>
                        <p className="text-xs text-slate-600 dark:text-gray-400 leading-snug">{feature.description}</p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Quick Suggestion Banner */}
              {(hasRecordings || hasDocuments) && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="bg-gradient-to-r from-blue-50/80 to-purple-50/80 dark:from-blue-950/30 dark:to-purple-950/30 border border-blue-200/60 dark:border-blue-800/40 rounded-xl sm:rounded-2xl p-4 sm:p-6 lg:p-7 mb-8 sm:mb-12 backdrop-blur-sm"
                >
                  <div className="flex items-start gap-3 sm:gap-4">
                    <Lightbulb className="h-5 w-5 sm:h-6 sm:w-6 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-slate-800 dark:text-gray-100 mb-1 text-sm sm:text-base">Quick Suggestion</h3>
                      {hasRecordings && (
                        <p className="text-xs sm:text-sm text-slate-700 dark:text-gray-300 leading-snug">
                          You have <strong>{recordings?.length} recording{recordings?.length !== 1 ? 's' : ''}</strong> ready. Create a note and reference them later.
                        </p>
                      )}
                      {hasDocuments && (
                        <p className="text-xs sm:text-sm text-slate-700 dark:text-gray-300 leading-snug">
                          You have <strong>{documents?.length} document{documents?.length !== 1 ? 's' : ''}</strong> ready. Organize your learning now.
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

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
    navigateToNote: props.navigateToNote,
    onSearchNotes: props.onSearchNotes
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
    props.navigateToNote,
    props.onSearchNotes
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

  const isSocialOrPodcastActive = activeTab === 'social' || activeTab === 'podcasts' || activeTab === 'library';
  const shouldRenderSocial = activeTab === 'social' || visitedTabs.has('social');
  const shouldRenderPodcasts = activeTab === 'podcasts' || visitedTabs.has('podcasts');
  const shouldRenderLibrary = activeTab === 'library' || visitedTabs.has('library');

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
                <ErrorBoundary>
                  <div className="h-full w-full flex items-center justify-center dark:bg-transparent overflow-hidden">
                    {/* Centered Container with max-width */}
                    <div className="w-full h-full max-w-[1400px] mx-auto flex relative lg:shadow-2xl">
                      {/* Click overlay for mobile when sidebar is open */}
                      {isNotesHistoryOpen && (
                        <div
                          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
                          onClick={onToggleNotesHistory}
                        />
                      )}

                      {/* Notes List - Sidebar */}
                      <div className={`
                        ${isNotesHistoryOpen ? 'translate-x-0' : '-translate-x-full'}
                        lg:translate-x-0 lg:static lg:w-80 lg:flex-shrink-0
                        fixed inset-y-0 left-0 lg:z-0 z-50 w-72 bg-white dark:bg-slate-900 shadow-lg lg:shadow-none
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
                      <div className="flex-1 h-full lg:max-h-[90vh] bg-white dark:bg-gradient-to-br dark:from-gray-900 dark:via-gray-800 dark:to-gray-700 overflow-y-auto">
                        {notesProps.activeNote ? (
                          <NoteEditor
                            note={notesProps.activeNote}
                            onNoteUpdate={notesProps.onNoteUpdate}
                            userProfile={userProfile}
                            onToggleNotesHistory={onToggleNotesHistory}
                            isNotesHistoryOpen={isNotesHistoryOpen}
                            readOnly={!!userProfile?.id && notesProps.activeNote.user_id !== userProfile.id}
                          />
                        ) : (
                          <EmptyNotesState 
                            recordings={props.recordings}
                            documents={props.documents}
                            onCreateNote={() => props.onCreateNew?.('note')}
                            onToggleSidebar={onToggleNotesHistory}
                            onCreateNoteWithTemplate={(data) => {
                              props.onCreateNoteWithData?.(data.title, data.content, data.category);
                            }}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </ErrorBoundary>
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
                  <ErrorBoundary>
                    <Schedule {...scheduleProps} />
                  </ErrorBoundary>
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
                  <ErrorBoundary>
                    <AIChat {...chatProps} setIsLoading={props.setIsAILoading} />
                  </ErrorBoundary>
                </div>
              );
            case 'documents':
              return (
                <div className="flex-1 p-3 sm:p-0 overflow-y-hidden dark:bg-transparent" onScroll={handleDocumentsScroll}>
                  <ErrorBoundary>
                    <DocumentUpload {...documentsProps} />
                  </ErrorBoundary>
                </div>
              );

            case 'settings':
              return (
                <div className="flex-1 p-3 sm:p-0 overflow-y-auto modern-scrollbar dark:bg-transparent">
                  <ErrorBoundary>
                    <UserSettings
                      profile={props.userProfile}
                      onProfileUpdate={props.onProfileUpdate}
                    />
                  </ErrorBoundary>
                </div>
              );

            default:
              return null;
          }
        })()}
      </div>

      {/* PERSISTENT VIEWS: Social, Podcasts & Library (Load once, keep alive) */}
      {shouldRenderLibrary && (
        <div className="flex-1 p-3 sm:p-0 overflow-y-auto modern-scrollbar dark:bg-transparent" style={{ display: activeTab === 'library' ? 'block' : 'none', height: activeTab === 'library' ? '100%' : '0px' }}>
          <ErrorBoundary>
            <CourseLibrary />
          </ErrorBoundary>
        </div>
      )}

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
              <div className="flex items-center justify-center h-full opacity-0">
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