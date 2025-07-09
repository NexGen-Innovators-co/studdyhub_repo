import React from 'react';
import { NotesList } from './NotesList';
import { NoteEditor } from './NoteEditor';
import { ClassRecordings } from './ClassRecordings';
import { Schedule } from './Schedule';
import { AIChat } from './AIChat';
import { DocumentUpload } from './DocumentUpload';
import { LearningStyleSettings } from './LearningStyleSettings';
import { Note } from '../types/Note';
import { ClassRecording, ScheduleItem, Message } from '../types/Class';
import { Document, UserProfile } from '../types/Document';
import { ChatHistory } from './ChatHistory'; 

interface ChatSession {
  id: string;
  title: string;
  created_at: Date;
  updated_at: Date;
  last_message_at: Date;
  document_ids: string[];
  message_count?: number;
}

interface TabContentProps {
  activeTab: 'notes' | 'recordings' | 'schedule' | 'chat' | 'documents' | 'settings';
  filteredNotes: Note[];
  activeNote: Note | null;
  recordings: ClassRecording[];
  scheduleItems: ScheduleItem[];
  chatMessages: Message[];
  documents: Document[];
  userProfile: UserProfile | null;
  isAILoading: boolean;
  setIsAILoading: (isLoading: boolean) => void;
  onNoteSelect: (note: Note) => void;
  onNoteUpdate: (note: Note) => void;
  onNoteDelete: (noteId: string) => void;
  onAddRecording: (recording: ClassRecording) => void;
  onGenerateQuiz: (classId: string) => Promise<void>;
  onAddScheduleItem: (item: ScheduleItem) => void;
  onUpdateScheduleItem: (item: ScheduleItem) => void;
  onDeleteScheduleItem: (id: string) => void;
  onSendMessage: (message: string) => Promise<void>;
  onDocumentUploaded: (document: Document) => void;
  onDocumentDeleted: (documentId: string) => void;
  onProfileUpdate: (profile: UserProfile) => void;
  // New props for ChatHistory management
  chatSessions: ChatSession[];
  activeChatSessionId: string | null;
  onChatSessionSelect: (sessionId: string) => void;
  onNewChatSession: () => Promise<string | null>;
  onDeleteChatSession: (sessionId: string) => Promise<void>;
  onRenameChatSession: (sessionId: string, newTitle: string) => Promise<void>;
  onSelectedDocumentIdsChange: (ids: string[]) => void;
  selectedDocumentIds: string[];
  // New props for responsive chat history
  isChatHistoryOpen: boolean;
  onToggleChatHistory: () => void;
  onNewMessage: (message: Message) => void;
}
 
export const TabContent: React.FC<TabContentProps> = (props) => {
  const { activeTab, userProfile, isAILoading, isChatHistoryOpen, onToggleChatHistory } = props;

  // Group props for child components
  const notesProps = {
    notes: props.filteredNotes,
    activeNote: props.activeNote ,
    onNoteSelect: props.onNoteSelect,
    onNoteDelete: props.onNoteDelete,
    onNoteUpdate: props.onNoteUpdate,
  };

  const recordingsProps = {
    recordings: props.recordings,
    onAddRecording: props.onAddRecording,
    onGenerateQuiz: props.onGenerateQuiz,
  };

  const scheduleProps = {
    scheduleItems: props.scheduleItems,
    onAddItem: props.onAddScheduleItem,
    onUpdateItem: props.onUpdateScheduleItem,
    onDeleteItem: props.onDeleteScheduleItem,
  };

  // Updated chatProps with new props
  const chatProps = {
    messages: props.chatMessages,
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
    onToggleChatHistory: onToggleChatHistory,
    isLoading: isAILoading,
    setIsLoading: props.setIsAILoading,
    onNewMessage: props.onNewMessage,
    userProfile: userProfile,
  };

  const documentsProps = {
    documents: props.documents,
    onDocumentUploaded: props.onDocumentUploaded,
    onDocumentDeleted: props.onDocumentDeleted,
  };

  // Props for ChatHistory component
  const chatHistoryProps = {
    sessions: props.chatSessions,
    activeSessionId: props.activeChatSessionId,
    onSessionSelect: props.onChatSessionSelect,
    onNewSession: props.onNewChatSession,
    onDeleteSession: props.onDeleteChatSession, // This is already a Promise<void> in Index.tsx
    onRenameSession: props.onRenameChatSession,
    isOpen: isChatHistoryOpen,
    onClose: onToggleChatHistory,
  };

  switch (activeTab) {
    case 'notes':
      return (
        <div className="flex flex-1 min-h-0 flex-col lg:flex-row">
          <div className="w-full lg:w-80 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col max-h-80 lg:max-h-none overflow-y-auto lg:overflow-visible">
            <NotesList {...notesProps} />
          </div>
          <div className="flex-1 bg-white min-h-0">
            {notesProps.activeNote ? (
              <NoteEditor 
                note={notesProps.activeNote} // Pass the active note
                onNoteUpdate={notesProps.onNoteUpdate} // Correct prop name
                userProfile={userProfile} // Pass userProfile 
              />
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 p-4">
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
        <div className="flex-1 p-3 sm:p-6 overflow-y-auto">
          <ClassRecordings {...recordingsProps} />
        </div>
      );

    case 'schedule':
      return (
        <div className="flex-1 p-3 sm:p-6 overflow-y-auto">
          <Schedule {...scheduleProps} />
        </div>
      );

    case 'chat':
      return (
        <div className="flex flex-1 min-h-0 relative">
          {/* Mobile backdrop for chat history */}
          {isChatHistoryOpen && (
            <div 
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
              onClick={onToggleChatHistory}
            />
          )}

          {/* Chat History as a responsive sidebar/drawer */}
          <div className={`${isChatHistoryOpen ? 'translate-x-0' : '-translate-x-full'}
            fixed lg:relative inset-y-0 left-0 z-50 lg:z-auto
            w-80 bg-white border-r border-slate-200 shadow-lg lg:shadow-none
            flex flex-col transition-transform duration-300 ease-in-out
            lg:translate-x-0 lg:w-80`}>
            <ChatHistory {...chatHistoryProps} />
          </div>

          {/* AI Chat content fills remaining space */}
          <div className="flex-1 bg-white min-h-0">
            <AIChat {...chatProps} />
          </div>
        </div>
      );

    case 'documents':
      return (
        <div className="flex-1 p-3 sm:p-6 overflow-y-auto">
          <DocumentUpload {...documentsProps} />
        </div>
      );

    case 'settings':
      return (
        <div className="flex-1 p-3 sm:p-6 overflow-y-auto">
          <LearningStyleSettings 
            profile={props.userProfile}
            onProfileUpdate={props.onProfileUpdate}
          />
        </div>
      );

    default:
      return null;
  }
};
