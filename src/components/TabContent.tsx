import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { NotesList } from './NotesList';
import { NoteEditor } from './NoteEditor';
import { ClassRecordings } from './ClassRecordings';
import { Schedule } from './Schedule';
import AIChat from './AIChat';
import { DocumentUpload } from './DocumentUpload';
import { LearningStyleSettings } from './LearningStyleSettings';
import { Note } from '../types/Note';
import { ClassRecording, ScheduleItem, Message, Quiz } from '../types/Class';
import { Document, UserProfile } from '../types/Document';
import ErrorBoundary from './ErrorBoundary';
import Mermaid from './Mermaid';
import { Chart, registerables } from 'chart.js';
import { AlertTriangle, Copy, Check, Code, X } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner';
import { lowlight } from 'lowlight';
// DiagramPanel and MemoizedMarkdownRenderer are not used directly in TabContent,
// but their imports might be here if they were previously used or for other reasons.
// For this update, they are not directly relevant to the prop passing.

// Register Chart.js components if not already done globally
Chart.register(...registerables);

// Helper for copy to clipboard (can be moved to a shared utility if needed elsewhere)
const useCopyToClipboard = () => {
  const [copied, setCopied] = useState(false);
  const copy = useCallback((text: string) => {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy text: ', err);
      toast.error('Failed to copy to clipboard.');
    }
  }, []);
  return { copied, copy };
};

// Helper for syntax highlighting (from AIChat, needed for SidePanelViewer)
const escapeHtml = (text: string) => {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
};

const toHtml = (result: any) => {
  const nodeToHtml = (node: any): string => {
    if (node.type === 'text') {
      return escapeHtml(node.value);
    }
    if (node.type === 'element') {
      const { tagName, properties, children } = node;
      const classNames = (properties?.className || []).join(' ');
      const styleMap: { [key: string]: string } = {
        'hljs-comment': 'color: #9ca3af; font-style: italic;', // gray-400
        'hljs-keyword': 'color: #c084fc; font-weight: 600;', // purple-300
        'hljs-string': 'color: #86efac;', // green-300
        'hljs-number': 'color: #fdba74;', // orange-200
        'hljs-built_in': 'color: #93c5fd; font-weight: 500;', // blue-300
        'hljs-function': 'color: #93c5fd; font-weight: 500;', // blue-300
        'hljs-variable': 'color: #bfdbfe;', // blue-200
        'hljs-type': 'color: #5eead4;', // teal-300
        'hljs-class': 'color: #fcd34d;', // amber-300
        'hljs-attr': 'color: #93c5fd;', // blue-300
        'hljs-tag': 'color: #f472b6;', // pink-300
        'hljs-operator': 'color: #fbcfe8;', // pink-200
        'hljs-literal': 'color: #fdba74;', // orange-200
        'hljs-meta': 'color: #7dd3fc;', // sky-300
        'hljs-title': 'color: #86efac;', // green-300
        'hljs-selector-tag': 'color: #c084fc;', // purple-300
        'hljs-regexp': 'color: #f472b6;', // pink-300
        'hljs-symbol': 'color: #fca5a5;', // red-300
        'hljs-bullet': 'color: #fbcfe8;', // pink-200
        'hljs-params': 'color: #fde68a;', // yellow-200
        'hljs-name': 'color: #93c5fd;', // blue-300
        'hljs-attribute': 'color: #fcd34d;', // amber-300
        'hljs-selector-attr': 'color: #67e8f9;', // cyan-300
        'hljs-selector-pseudo': 'color: #fbcfe8;', // pink-200
        'hljs-template-variable': 'color: #bfdbfe;', // blue-200
        'hljs-quote': 'color: #9ca3af; font-style: italic;', // gray-400
        'hljs-deletion': 'color: #f87171; background-color: #450a0a;', // red-400, bg-red-950
        'hljs-addition': 'color: #4ade80; background-color: #064e3b;', // green-400, bg-green-950
        'hljs-meta-keyword': 'color: #7dd3fc; font-weight: 600;', // sky-300
        'hljs-meta-string': 'color: #38bdf8;', // sky-400
        'hljs-subst': 'color: #c084fc;', // purple-300
        'hljs-section': 'color: #86efac;', // green-300
        'hljs-boolean': 'color: #fdba74;', // orange-200
      };

      let style = '';
      classNames.split(' ').forEach(cls => {
        if (styleMap[cls]) {
          style += styleMap[cls] + ' ';
        }
      });

      const childrenHtml = children?.map(nodeToHtml).join('') || '';
      return `<${tagName}${style ? ` style="${style.trim()}"` : ''}>${childrenHtml}</${tagName}>`;
    }
    return '';
  };

  return result.children.map(nodeToHtml).join('');
};

const highlightCode = (code: string, language: string) => {
  try {
    const result = lowlight.highlight(language, code);
    return toHtml(result);
  } catch (error) {
    console.warn('Syntax highlighting failed:', error);
    return escapeHtml(code);
  }
};

interface ChartRendererProps {
  chartConfig: any;
}

const ChartRenderer: React.FC<ChartRendererProps> = ({ chartConfig }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<any>(null);

  useEffect(() => {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        if (chartInstance.current) {
          chartInstance.current.destroy();
        }
        chartInstance.current = new Chart(ctx, chartConfig);
      }
    }

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [chartConfig]);

  return (
    <div className="relative w-full h-80 bg-gray-700 p-4 rounded-lg shadow-inner">
      <canvas ref={canvasRef}></canvas>
    </div>
  );
};

interface SidePanelViewerProps {
  code?: string;
  language?: string;
  imageUrl?: string;
  type: 'mermaid' | 'dot' | 'chartjs' | 'code' | 'image' | 'unknown' | 'document-text' | 'threejs';
  onClose: () => void;
  onMermaidError: (error: string) => void;
  onSuggestAiCorrection: (prompt?: string) => void;
}

const SidePanelViewer: React.FC<SidePanelViewerProps> = ({ code, language, imageUrl, type, onClose, onMermaidError, onSuggestAiCorrection }) => {
  const { copied, copy } = useCopyToClipboard();

  const renderContent = () => {
    if (type === 'mermaid' && code) {
      return <Mermaid chart={code} onMermaidError={onMermaidError} onSuggestAiCorrection={() => onSuggestAiCorrection()} diagramRef={null} />;
    } else if (type === 'chartjs' && code) {
      try {
        const chartConfig = JSON.parse(code);
        return <ChartRenderer chartConfig={chartConfig} />;
      } catch (e) {
        return (
          <div className="my-4 p-4 bg-red-900 border border-red-700 rounded-lg">
            <div className="flex items-center gap-2 text-red-300">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">Chart.js Error</span>
            </div>
            <p className="text-sm text-red-400 mt-1">
              Invalid Chart.js JSON configuration. Please check the code.
            </p>
            <pre className="text-sm text-gray-300 mt-2 p-2 bg-gray-800 rounded overflow-x-auto">
              {code}
            </pre>
          </div>
        );
      }
    } else if (type === 'dot' && code) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-4">
          <p className="text-gray-300 mb-2">DOT Graph Rendering Not Available Here. Displaying raw code:</p>
          <pre className="bg-gray-800 p-3 rounded-md text-sm overflow-x-auto max-w-full text-gray-200">
            {code}
          </pre>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSuggestAiCorrection(`Can you fix or generate a DOT graph for me? Here's the code: ${code}`)}
            className="mt-4 bg-blue-700 text-white hover:bg-blue-800"
          >
            Suggest AI Correction
          </Button>
        </div>
      );
    } else if (type === 'code' && code && language) {
      return (
        <div className="relative my-4 rounded-lg overflow-hidden shadow-sm border border-gray-700">
          <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-300 uppercase tracking-wide">
                {language}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copy(code)}
                className="h-6 w-6 p-0 text-gray-400 hover:text-gray-100 hover:bg-gray-700"
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </Button>
            </div>
          </div>
          <div className="p-4 bg-gray-900 overflow-x-auto">
            <pre className="font-mono text-sm leading-relaxed">
              <code
                className="text-gray-100"
                dangerouslySetInnerHTML={{
                  __html: highlightCode(code, language)
                }}
              />
            </pre>
          </div>
        </div>
      );
    } else if (type === 'image' && imageUrl) {
      return (
        <div className="flex items-center justify-center h-full w-full p-2 bg-gray-900">
          <img
            src={imageUrl}
            alt="Full size image"
            className="max-w-full max-h-full object-contain rounded-lg shadow-md"
            onError={(e) => {
              e.currentTarget.src = 'https://placehold.co/400x300/e0e0e0/666666?text=Image+Load+Error';
              e.currentTarget.alt = 'Image failed to load';
            }}
          />
        </div>
      );
    } else if (type === 'document-text' && code) {
      return (
        <div className="prose dark:prose-invert max-w-none">
          <div dangerouslySetInnerHTML={{ __html: code }} />
        </div>
      );
    }
    else {
      return (
        <div className="flex flex-col items-center justify-center h-full text-gray-400">
          <AlertTriangle className="h-8 w-8 mb-2" />
          <p>Unsupported Content Type</p>
          <pre className="bg-gray-800 p-3 rounded-md text-sm overflow-x-auto max-w-full mt-2 text-gray-300">
            {code || 'No content provided.'}
          </pre>
        </div>
      );
    }
  };

  return (
    <div className="flex flex-col bg-slate-50 border-l border-slate-200 shadow-xl dark:bg-gray-900 dark:border-gray-800">
      <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white dark:bg-gray-900 dark:border-gray-800">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-gray-100">Content Viewer: {type === 'image' ? 'Image' : (language || type)}</h3>
        <Button variant="ghost" size="icon" onClick={onClose} title="Close Panel" className="dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100">
          <X className="h-5 w-5 text-slate-500 hover:text-slate-700 dark:text-gray-400 dark:hover:text-gray-100" />
        </Button>
      </div>
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        {renderContent()}
      </div>
    </div>
  );
};


interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  last_message_at: string;
  document_ids: string[];
  message_count?: number;
}

interface TabContentProps {
  activeTab: 'notes' | 'recordings' | 'schedule' | 'chat' | 'documents' | 'settings';
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
  onSendMessage: (message: string, attachedDocumentIds?: string[], attachedNoteIds?: string[], imageUrl?: string, imageMimeType?: string, imageDataBase64?: string, aiMessageIdToUpdate?: string | null) => Promise<void>;
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
  onNewMessage: (message: Message) => void;
  isNotesHistoryOpen: boolean;
  onRegenerateResponse: (lastUserMessageContent: string) => Promise<void>;
  onDeleteMessage: (messageId: string) => Promise<void>;
  onToggleNotesHistory: () => void;
  onRetryFailedMessage: (originalUserMessageContent: string, failedAiMessageId: string) => Promise<void>;
  isSubmittingUserMessage: boolean;
  hasMoreMessages: boolean;
  onLoadOlderMessages: () => Promise<void>;
  isLoadingSessionMessages: boolean;
  onReprocessAudio: (audioUrl: string, documentId: string) => Promise<void>; // Add reprocessAudio prop
  onDeleteRecording: (recordingId: string, documentId: string | null, audioUrl: string | null) => Promise<void>; // Add deleteRecording prop
}

export const TabContent: React.FC<TabContentProps> = (props) => {
  const { activeTab, userProfile, isAILoading, isNotesHistoryOpen, onToggleNotesHistory } = props;

  const [activeSidePanelContent, setActiveSidePanelContent] = useState<{ code?: string, language?: string, imageUrl?: string, type: 'mermaid' | 'dot' | 'chartjs' | 'code' | 'image' | 'unknown' | 'document-text' | 'threejs' } | null>(null);
  const isSidePanelOpen = !!activeSidePanelContent;

  const handleViewContent = useCallback((type: 'mermaid' | 'dot' | 'chartjs' | 'code' | 'image' | 'unknown' | 'document-text' | 'threejs', content?: string, language?: string, imageUrl?: string) => {
    setActiveSidePanelContent({ type, code: content, language, imageUrl });
  }, []);

  const handleMermaidError = useCallback((error: string) => {
    toast.info(`Mermaid diagram encountered an error: ${error}. Click 'AI Fix' to get help.`);
  }, []);

  const handleSuggestAiCorrection = useCallback((prompt?: string) => {
    toast.info(`AI correction feature for diagrams is coming soon! Prompt: ${prompt || 'No specific prompt'}`);
  }, []);

  const handleCloseSidePanel = useCallback(() => {
    setActiveSidePanelContent(null);
  }, []);


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
    onReprocessAudio: props.onReprocessAudio, // Pass reprocessAudio
    onDeleteRecording: props.onDeleteRecording, // Pass onDeleteRecording
  }), [
    props.recordings,
    props.onAddRecording,
    props.onUpdateRecording,
    props.onGenerateQuiz,
    props.onGenerateNote,
    props.quizzes,
    props.onReprocessAudio, // Add to dependencies
    props.onDeleteRecording, // Add to dependencies
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
    onNewMessage: props.onNewMessage,
    onDeleteMessage: props.onDeleteMessage,
    onRegenerateResponse: props.onRegenerateResponse,
    onRetryFailedMessage: props.onRetryFailedMessage,
    isSubmittingUserMessage: props.isSubmittingUserMessage,
    userProfile: userProfile,
    onViewContent: handleViewContent,
    onMermaidError: handleMermaidError,
    onSuggestAiCorrection: handleSuggestAiCorrection,
    hasMoreMessages: props.hasMoreMessages,
    onLoadOlderMessages: props.onLoadOlderMessages,
    onDocumentUpdated: props.onDocumentUpdated,
    isLoadingSessionMessages: props.isLoadingSessionMessages,
    learningStyle: userProfile?.learning_style || 'visual',
    learningPreferences: userProfile?.learning_preferences || {},
    onSendMessageToBackend: props.onSendMessage,
  }), [
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
    props.onNewMessage,
    props.onDeleteMessage,
    props.onRegenerateResponse,
    props.onRetryFailedMessage,
    props.isSubmittingUserMessage,
    userProfile,
    handleViewContent,
    handleMermaidError,
    handleSuggestAiCorrection,
    props.hasMoreMessages,
    props.onLoadOlderMessages,
    props.onDocumentUpdated,
    props.isLoadingSessionMessages,
    userProfile?.learning_style,
    userProfile?.learning_preferences,
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


  switch (activeTab) {
    case 'notes':
      return (
        <div className="flex flex-1 min-h-0 relative">
          {isNotesHistoryOpen && (
            <div
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
              onClick={onToggleNotesHistory}
            />
          )}

          <div className={`${isNotesHistoryOpen ? 'translate-x-0' : '-translate-x-full'}
            fixed lg:relative inset-y-0 left-0 z-50 lg:z-auto
            w-80 bg-white border-r border-slate-200 shadow-lg lg:shadow-none
            flex flex-col transition-transform duration-300 ease-in-out
            lg:translate-x-0 lg:w-80
            dark:bg-gray-900 dark:border-gray-800 dark:shadow-none`}>
            <NotesList
              {...notesHistoryProps}
              isOpen={isNotesHistoryOpen}
              onClose={onToggleNotesHistory}
            />
          </div>

          <div className="flex-1 bg-white min-h-0 dark:bg-gray-900">
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
        <div className="flex-1 p-3 sm:p-6 overflow-y-auto  modern-scrollbar dark:bg-gray-900">
          <ErrorBoundary>
            <ClassRecordings {...recordingsProps} />
          </ErrorBoundary>
        </div>
      );

    case 'schedule':
      return (
        <div className="flex-1 p-3 sm:p-6 overflow-y-auto  modern-scrollbar dark:bg-gray-900">
          <Schedule {...scheduleProps} />
        </div>
      );

    case 'chat':
      return (
        <div className="flex flex-1 min-h-0 relative">
          <div className={`flex-1 flex min-h-0 transition-all duration-300 ease-in-out
            ${isSidePanelOpen ? 'lg:w-2/3' : 'lg:w-full'}`}>

            <div className={`flex-1 flex flex-col  min-w-0 ${isSidePanelOpen ? 'lg:w-1/2' : 'w-full'} dark:bg-gray-900`}>
              <AIChat {...chatProps} />
            </div>

            {isSidePanelOpen && (
              <div className={`hidden lg:flex lg:w-1/2 flex-shrink-0 min-h-0 max-w-sm `}>
                <SidePanelViewer
                  type={activeSidePanelContent!.type}
                  code={activeSidePanelContent!.code}
                  language={activeSidePanelContent!.language}
                  imageUrl={activeSidePanelContent!.imageUrl}
                  onClose={handleCloseSidePanel}
                  onMermaidError={handleMermaidError}
                  onSuggestAiCorrection={handleSuggestAiCorrection}
                />
              </div>
            )}

            {isSidePanelOpen && (
              <div
                className="fixed inset-0 bg-black/50 z-30 lg:hidden"
                onClick={handleCloseSidePanel}
              />
            )}
            {isSidePanelOpen && (
              <div className="fixed inset-y-0 right-0 w-full max-w-sm bg-slate-50 border-l border-slate-200 shadow-xl flex flex-col z-40 lg:hidden dark:bg-gray-900 dark:border-gray-800">
                <SidePanelViewer
                  type={activeSidePanelContent!.type}
                  code={activeSidePanelContent!.code}
                  language={activeSidePanelContent!.language}
                  imageUrl={activeSidePanelContent!.imageUrl}
                  onClose={handleCloseSidePanel}
                  onMermaidError={handleMermaidError}
                  onSuggestAiCorrection={handleSuggestAiCorrection}
                />
              </div>
            )}
          </div>
        </div>
      );

    case 'documents':
      return (
        <div className="flex-1 p-3 sm:p-6 overflow-y-auto  modern-scrollbar modern-scrollbar dark:bg-gray-900">
          <DocumentUpload {...documentsProps} />
        </div>
      );

    case 'settings':
      return (
        <div className="flex-1 p-3 sm:p-6 overflow-y-auto  modern-scrollbar bardark:bg-gray-900">
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
