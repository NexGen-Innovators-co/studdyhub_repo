import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { NotesList } from './NotesList';
import { NoteEditor } from './NoteEditor';
import { ClassRecordings } from './ClassRecordings';
import { Schedule } from './Schedule';
import AIChat from './AIChat';
import { DocumentUpload } from './DocumentUpload';
import { UserSettings } from './UserSettings';
import Dashboard from './Dashboard'; // FIXED: Import the Dashboard component
import { Note } from '../types/Note';
import { ClassRecording, ScheduleItem, Message, Quiz } from '../types/Class';
import { Document, UserProfile } from '../types/Document';
import ErrorBoundary from './ErrorBoundary';
import { toast } from 'sonner';
import { SocialFeed } from './SocialFeed';

interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  last_message_at: string;
  document_ids: string[];
  message_count?: number;
}

// FIXED: Updated TabContentProps to include dashboard and navigation handlers
interface TabContentProps {
  activeTab: 'dashboard' | 'notes' | 'recordings' | 'schedule' | 'chat' | 'documents' | 'settings' | 'social'; // Added 'social'

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

  // FIXED: Dashboard navigation handlers
  onNavigateToTab?: (tab: string) => void;
  onCreateNew?: (type: 'note' | 'recording' | 'schedule' | 'document') => void;

  // FIXED: Updated onSendMessage to include attachedFiles parameter
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
    }>
  ) => Promise<void>;

  onDocumentUploaded: (document: Document) => Promise<void>;
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
  // onNewMessage: (message: Message) => void;
  isNotesHistoryOpen: boolean;
  onRegenerateResponse: (lastUserMessageContent: string) => Promise<void>;
  onDeleteMessage: (messageId: string) => Promise<void>;
  onToggleNotesHistory: () => void;
  onRetryFailedMessage: (originalUserMessageContent: string, failedAiMessageId: string) => Promise<void>;
  isSubmittingUserMessage: boolean;
  hasMoreMessages: boolean;
  onLoadOlderMessages: () => Promise<void>;
  isLoadingSessionMessages: boolean;
  onReprocessAudio: (audioUrl: string, documentId: string) => Promise<void>;
  onDeleteRecording: (recordingId: string, documentId: string | null, audioUrl: string | null) => Promise<void>;
  onMessageUpdate: (message: Message) => void; // New prop for message updates

  // Infinite scroll controls
  hasMoreDocuments: boolean;
  isLoadingDocuments: boolean;
  onLoadMoreDocuments: () => void;
  hasMoreRecordings: boolean;
  isLoadingRecordings: boolean;
  onLoadMoreRecordings: () => void;
}

export const TabContent: React.FC<TabContentProps> = (props) => {
  const { activeTab, userProfile, isAILoading, isNotesHistoryOpen, onToggleNotesHistory } = props;

  const handleSuggestAiCorrection = useCallback((prompt?: string) => {
    toast.info(`AI correction feature for diagrams is coming soon! Prompt: ${prompt || 'No specific prompt'}`);
  }, []);

  const handleDocumentsScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (!props.isLoadingDocuments && props.hasMoreDocuments) {
      const el = e.currentTarget;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 120) {
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
  }), [
    props.recordings,
    props.onAddRecording,
    props.onUpdateRecording,
    props.onGenerateQuiz,
    props.onGenerateNote,
    props.quizzes,
    props.onReprocessAudio,
    props.onDeleteRecording,
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
    // onNewMessage: props.onNewMessage,
    onDeleteMessage: props.onDeleteMessage,
    onRegenerateResponse: props.onRegenerateResponse,
    onRetryFailedMessage: props.onRetryFailedMessage,
    isSubmittingUserMessage: props.isSubmittingUserMessage,
    userProfile: userProfile,
    onSuggestAiCorrection: handleSuggestAiCorrection,
    hasMoreMessages: props.hasMoreMessages,
    onLoadOlderMessages: props.onLoadOlderMessages,
    onDocumentUpdated: props.onDocumentUpdated,
    isLoadingSessionMessages: props.isLoadingSessionMessages,
    learningStyle: userProfile?.learning_style || 'visual',
    learningPreferences: userProfile?.learning_preferences || {}, // Ensure this is always an object
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
      // Handle backward compatibility for single image
      let imageUrl: string | undefined;
      let imageMimeType: string | undefined;
      let imageDataBase64: string | undefined;

      if (attachedFiles && attachedFiles.length > 0) {
        const imageFile = attachedFiles.find(file => file.type === 'image');
        if (imageFile && imageFile.data) {
          imageUrl = `data:${imageFile.mimeType};base64,${imageFile.data}`;
          imageMimeType = imageFile.mimeType;
          imageDataBase64 = imageUrl;
        }
      }

      // FIXED: Now properly pass attachedFiles to the handleSubmit function
      await props.onSendMessage(
        messageContent,
        attachedDocumentIds,
        attachedNoteIds,
        imageUrl,
        imageMimeType,
        imageDataBase64,
        null, // aiMessageIdToUpdate
        attachedFiles // FIXED: Pass attachedFiles as the 8th parameter
      );
    },
    onMessageUpdate: props.onMessageUpdate, // Pass new prop here
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
      // props.onNewMessage,
      props.onDeleteMessage,
      props.onRegenerateResponse,
      props.onRetryFailedMessage,
      props.isSubmittingUserMessage,
      userProfile,
      handleSuggestAiCorrection,
      props.hasMoreMessages,
      props.onLoadOlderMessages,
      props.onDocumentUpdated,
      props.isLoadingSessionMessages,
      userProfile?.learning_style,
      userProfile?.learning_preferences,
      props.onMessageUpdate, // Add to dependencies
    ]);

  const documentsProps = useMemo(() => ({
    documents: props.documents,
    onDocumentUploaded: props.onDocumentUploaded,
    onDocumentDeleted: props.onDocumentDeleted,
    onDocumentUpdated: props.onDocumentUpdated,
  }), [props.documents, props.onDocumentUploaded, props.onDocumentDeleted, props.onDocumentUpdated]);

  const notesHistoryProps = useMemo(() => ({
    notes: props.filteredNotes,
    activeNote: props.activeNote,
    onNoteSelect: props.onNoteSelect,
    onNoteDelete: props.onNoteDelete,
    isOpen: isNotesHistoryOpen,
    onClose: onToggleNotesHistory,
  }), [props.filteredNotes, props.activeNote, props.onNoteSelect, props.onNoteDelete, isNotesHistoryOpen, onToggleNotesHistory]);

  // FIXED: Dashboard props
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

  switch (activeTab) {
    case 'dashboard': // FIXED: Add dashboard case
      return (
        <div className="flex-1 p-3 sm:p-6 overflow-y-auto modern-scrollbar dark:bg-transparent">
          <ErrorBoundary>
            <Dashboard {...dashboardProps} />
          </ErrorBoundary>
        </div>
      );

    case 'notes':
      return (
        <div className="flex flex-1 min-h-0 relative">
          {isNotesHistoryOpen && (
            <div
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
              onClick={onToggleNotesHistory}
            />
          )}

          <div className={`${isNotesHistoryOpen ? 'translate-x-0' : '-translate-x-full'} fixed lg:relative inset-y-0 left-0 z-50 lg:z-auto w-80 bg-transparent border-r border-slate-200 shadow-lg lg:shadow-none flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 lg:w-80 dark:bg-transparent dark:border-gray-800 dark:shadow-none`}>
            <NotesList
              {...notesHistoryProps}
              isOpen={isNotesHistoryOpen}
              onClose={onToggleNotesHistory}
            />
          </div>

          <div className="flex-1 bg-transparent min-h-0 dark:bg-transparent">
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
      );

    case 'recordings':
      return (
        <div className="flex-1 p-3 sm:p-0 overflow-y-auto modern-scrollbar dark:bg-transparent" onScroll={handleRecordingsScroll}>
          <ErrorBoundary>
            <ClassRecordings {...recordingsProps} />
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
      return (
        <div className="flex flex-1 min-h-0 relative overflow-hidden">  
          <div className={`flex-1 flex flex-col min-w-0 dark:bg-transparent`}>
            <AIChat {...chatProps} />
          </div>
        </div>
      );

    case 'documents':
      return (
        <div className="flex-1 p-3 sm:p-0 overflow-y-auto modern-scrollbar dark:bg-transparent" onScroll={handleDocumentsScroll}>
          <DocumentUpload {...documentsProps} />
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

    case 'social':
      return (
        <div className="flex-1 p-3 sm:p-0 overflow-y-auto modern-scrollbar dark:bg-transparent">
          <ErrorBoundary>
            <SocialFeed userProfile={props.userProfile} />
          </ErrorBoundary>
        </div>
      );

    default:
      return null;
  }
};
