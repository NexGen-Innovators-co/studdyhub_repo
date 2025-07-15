import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react'; // Import useState and useCallback
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
// import { ChatHistory } from './ChatHistory'; // Removed ChatHistory import
import ErrorBoundary from './ErrorBoundary';
import Mermaid from './Mermaid'; // Import Mermaid here for SidePanelViewer
import { Chart, registerables } from 'chart.js'; // Import Chart and registerables for SidePanelViewer
import { AlertTriangle, Copy, Check, Code, X } from 'lucide-react'; // Import necessary icons for SidePanelViewer
import { Button } from './ui/button'; // Import Button for SidePanelViewer
import { toast } from 'sonner'; // Import toast for SidePanelViewer
import { lowlight } from 'lowlight'; // Make sure lowlight is imported if used directly here

// Register Chart.js components if not already done globally
Chart.register(...registerables);

// Helper for copy to clipboard (can be moved to a shared utility if needed elsewhere)
const useCopyToClipboard = () => {
  const [copied, setCopied] = useState(false);
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Code copied to clipboard!');
    } catch (err) {
      toast.error('Failed to copy code');
    }
  };
  return { copied, copy };
};

// Helper for syntax highlighting (from AIChat, needed for SidePanelViewer)
const highlightCode = (code: string, language: string) => {
  try {
    // Ensure lowlight is available in this scope
    // This assumes lowlight and its languages are registered globally or available
    const result = lowlight.highlight(language, code);
    return toHtml(result);
  } catch (error) {
    console.warn('Syntax highlighting failed:', error);
    return escapeHtml(code);
  }
};

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
        'hljs-comment': 'color: #6b7280; font-style: italic;',
        'hljs-keyword': 'color: #7c3aed; font-weight: 600;',
        'hljs-string': 'color: #059669;',
        'hljs-number': 'color: #ea580c;',
        'hljs-built_in': 'color: #2563eb; font-weight: 500;',
        'hljs-function': 'color: #1d4ed8;',
        'hljs-variable': 'color: #1e40af;',
        'hljs-type': 'color: #0d9488;',
        'hljs-class': 'color: #d97706;',
        'hljs-attr': 'color: #d97706;',
        'hljs-tag': 'color: #dc2626;',
        'hljs-operator': 'color: #db2777;',
        'hljs-literal': 'color: #ea580c;',
        'hljs-meta': 'color: #0284c7;',
        'hljs-title': 'color: #059669;',
        'hljs-selector-tag': 'color: #7c3aed;',
        'hljs-selector-class': 'color: #059669;',
        'hljs-selector-id': 'color: #dc2626;',
        'hljs-regexp': 'color: #be185d;',
        'hljs-symbol': 'color: #dc2626;',
        'hljs-bullet': 'color: #db2777;',
        'hljs-params': 'color: #b45309;',
        'hljs-name': 'color: #1d4ed8;',
        'hljs-attribute': 'color: #d97706;',
        'hljs-selector-attr': 'color: #0891b2;',
        'hljs-selector-pseudo': 'color: #db2777;',
        'hljs-template-variable': 'color: #1e40af;',
        'hljs-quote': 'color: #6b7280; font-style: italic;',
        'hljs-deletion': 'color: #b91c1c; background-color: #fef2f2;',
        'hljs-addition': 'color: #166534; background-color: #f0fdf4;',
        'hljs-meta-keyword': 'color: #0284c7; font-weight: 600;',
        'hljs-meta-string': 'color: #0369a1;',
        'hljs-subst': 'color: #7c3aed;',
        'hljs-section': 'color: #059669;',
        'hljs-boolean': 'color: #ea580c;',
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
    <div className="relative w-full h-80 bg-white p-4 rounded-lg shadow-inner">
      <canvas ref={canvasRef}></canvas>
    </div>
  );
};


interface SidePanelViewerProps {
  code: string;
  language: string;
  onClose: () => void;
  onMermaidError: (code: string, errorType: 'syntax' | 'rendering') => void;
  onSuggestAiCorrection: (prompt: string) => void;
}

const SidePanelViewer: React.FC<SidePanelViewerProps> = ({ code, language, onClose, onMermaidError, onSuggestAiCorrection }) => {
  const { copied, copy } = useCopyToClipboard();

  const renderContent = () => {
    if (language === 'mermaid') {
      return <Mermaid chart={code} onMermaidError={onMermaidError} onSuggestAiCorrection={onSuggestAiCorrection} diagramRef={null} />;
    } else if (language === 'chartjs') {
      try {
        const chartConfig = JSON.parse(code);
        return <ChartRenderer chartConfig={chartConfig} />;
      } catch (e) {
        return (
          <div className="my-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">Chart.js Error</span>
            </div>
            <p className="text-sm text-red-600 mt-1">
              Invalid Chart.js JSON configuration. Please check the code.
            </p>
            <pre className="text-sm text-gray-600 mt-2 p-2 bg-gray-50 rounded overflow-x-auto">
              {code}
            </pre>
          </div>
        );
      }
    } else if (language === 'dot') { // Handle DOT graphs in side panel
      return (
        <div className="flex flex-col items-center justify-center h-full p-4">
          <p className="text-slate-600 mb-2">DOT Graph Rendering Coming Soon!</p>
          <pre className="bg-gray-100 p-3 rounded-md text-sm overflow-x-auto max-w-full">
            {code}
          </pre>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSuggestAiCorrection(`Can you fix or generate a DOT graph for me? Here's the code: ${code}`)}
            className="mt-4 bg-blue-500 text-white hover:bg-blue-600"
          >
            Suggest AI Correction
          </Button>
        </div>
      );
    }
    else {
      return (
        <div className="relative my-4 rounded-lg overflow-hidden shadow-sm border border-gray-200">
          <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-400"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
              <div className="w-3 h-3 rounded-full bg-green-400"></div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                {language}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copy(code)}
                className="h-6 w-6 p-0 text-gray-500 hover:text-gray-700 hover:bg-gray-100"
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </Button>
            </div>
          </div>
          <div className="p-4 bg-white overflow-x-auto">
            <pre className="font-mono text-sm leading-relaxed">
              <code 
                className="text-gray-800"
                dangerouslySetInnerHTML={{
                  __html: highlightCode(code, language)
                }}
              />
            </pre>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="flex flex-col bg-slate-50 border-l border-slate-200 shadow-xl"> {/* Removed fixed positioning */}
      <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white">
        <h3 className="text-lg font-semibold text-slate-800">Code Viewer: {language}</h3>
        <Button variant="ghost" size="icon" onClick={onClose} title="Close Panel">
          <X className="h-5 w-5 text-slate-500 hover:text-slate-700" />
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
  activeTab: 'notes' | 'recordings' | 'schedule' | 'chat' | 'documents' | 'settings'; // Still explicitly passed from Routes
  filteredNotes: Note[];
  activeNote: Note | null;
  recordings: ClassRecording[] | undefined; // Allow undefined
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
  chatSessions: ChatSession[];
  activeChatSessionId: string | null;
  onChatSessionSelect: (sessionId: string) => void;
  onNewChatSession: () => Promise<string | null>;
  onDeleteChatSession: (sessionId: string) => Promise<void>;
  onRenameChatSession: (sessionId: string, newTitle: string) => Promise<void>;
  onSelectedDocumentIdsChange: (ids: string[]) => void;
  selectedDocumentIds: string[];
  // Removed isChatHistoryOpen and onToggleChatHistory
  onNewMessage: (message: Message) => void;
  isNotesHistoryOpen: boolean;
  onRegenerateResponse: (lastUserMessageContent: string) => Promise<void>;
  onDeleteMessage: (messageId: string) => void;
  onToggleNotesHistory: () => void;
  onRetryFailedMessage: (originalUserMessageContent: string, failedAiMessageId: string) => Promise<void>;
  isSubmittingUserMessage: boolean;
  // New props for message pagination (added to TabContentProps)
  hasMoreMessages: boolean;
  onLoadOlderMessages: () => Promise<void>;
}

export const TabContent: React.FC<TabContentProps> = (props) => {
  const { activeTab, userProfile, isAILoading, isNotesHistoryOpen, onToggleNotesHistory } = props; // Removed isChatHistoryOpen, onToggleChatHistory

  // State for the side-out code/diagram panel
  const [activeSidePanelContent, setActiveSidePanelContent] = useState<{ code: string, language: string } | null>(null);
  const isSidePanelOpen = !!activeSidePanelContent; // Derived state

  // Callbacks for side panel management
  const handleViewCodeBlock = useCallback((code: string, language: string) => {
    setActiveSidePanelContent({ code, language });
  }, []);

  const handleCloseSidePanel = useCallback(() => {
    setActiveSidePanelContent(null);
  }, []);

  const handleMermaidError = useCallback((code: string, errorType: 'syntax' | 'rendering') => {
    toast.info(`Mermaid diagram encountered a ${errorType} error. Click 'AI Fix' to get help.`);
  }, []);

  const handleSuggestAiCorrection = useCallback((prompt: string) => {
    // This will be passed to AIChat, which then sets its inputMessage
    // We don't directly set inputMessage here in TabContent
    // The AIChat component will handle setting its own input field
  }, []);


  console.log('TabContent received recordings prop:', props.recordings);

  const notesProps = useMemo(() => ({
    notes: props.filteredNotes,
    activeNote: props.activeNote,
    onNoteSelect: props.onNoteSelect,
    onNoteDelete: props.onNoteDelete,
    onNoteUpdate: props.onNoteUpdate,
  }), [props.filteredNotes, props.activeNote, props.onNoteSelect, props.onNoteDelete, props.onNoteUpdate]);

  const recordingsProps = useMemo(() => ({
    recordings: props.recordings ?? [],
    onAddRecording: props.onAddRecording,
    onGenerateQuiz: (recording: ClassRecording) => {
      props.onGenerateQuiz(recording.id);
    },
  }), [props.recordings, props.onAddRecording, props.onGenerateQuiz]);

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
    onSelectionChange: props.onSelectedDocumentIdsChange, // This is the correct prop
    activeChatSessionId: props.activeChatSessionId,
    onNewChatSession: props.onNewChatSession,
    onDeleteChatSession: props.onDeleteChatSession,
    onRenameChatSession: props.onRenameChatSession,
    onChatSessionSelect: props.onChatSessionSelect,
    chatSessions: props.chatSessions,
    // Removed onToggleChatHistory
    isLoading: isAILoading,
    setIsLoading: props.setIsAILoading, // Corrected prop name here
    onNewMessage: props.onNewMessage,
    onDeleteMessage: props.onDeleteMessage,
    onRegenerateResponse: props.onRegenerateResponse, // This is now correctly typed
    onRetryFailedMessage: props.onRetryFailedMessage,
    isSubmittingUserMessage: props.isSubmittingUserMessage,
    userProfile: userProfile,
    onViewDiagram: handleViewCodeBlock, // Renamed from onViewCodeBlock to onViewDiagram for clarity
    onMermaidError: handleMermaidError, // Pass down for Mermaid component within AIChat
    onSuggestAiCorrection: handleSuggestAiCorrection, // Pass down for Mermaid component within AIChat
    hasMoreMessages: props.hasMoreMessages, // Pass new prop
    onLoadOlderMessages: props.onLoadOlderMessages, // Pass new prop
  }), [
    props.activeChatSessionId,
    props.chatMessages,
    props.documents,
    props.onSendMessage,
    props.filteredNotes,
    props.selectedDocumentIds,
    props.onSelectedDocumentIdsChange, // Dependency
    props.onNewChatSession,
    props.onDeleteChatSession,
    props.onRenameChatSession,
    props.onChatSessionSelect,
    props.chatSessions,
    isAILoading,
    props.setIsAILoading, // Dependency
    props.onNewMessage,
    props.onDeleteMessage,
    props.onRegenerateResponse,
    props.onRetryFailedMessage,
    props.isSubmittingUserMessage,
    userProfile,
    handleViewCodeBlock, // Dependency
    handleMermaidError, // Dependency
    handleSuggestAiCorrection, // Dependency
    props.hasMoreMessages, // Dependency
    props.onLoadOlderMessages, // Dependency
  ]);

  const documentsProps = useMemo(() => ({
    documents: props.documents,
    onDocumentUploaded: props.onDocumentUploaded,
    onDocumentDeleted: props.onDocumentDeleted,
  }), [props.documents, props.onDocumentUploaded, props.onDocumentDeleted]);

  // Removed chatHistoryProps as ChatHistory component is removed

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
            lg:translate-x-0 lg:w-80`}>
            <NotesList 
              {...notesProps} 
              isOpen={isNotesHistoryOpen}
              onClose={onToggleNotesHistory}
            />
          </div>

          <div className="flex-1 bg-white min-h-0">
            {notesProps.activeNote ? (
              <NoteEditor 
                note={notesProps.activeNote}
                onNoteUpdate={notesProps.onNoteUpdate}
                userProfile={userProfile}
                onToggleNotesHistory={onToggleNotesHistory}
                isNotesHistoryOpen={isNotesHistoryOpen}
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
          <ErrorBoundary>
            <ClassRecordings {...recordingsProps} />
          </ErrorBoundary>
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
          {/* Removed isChatHistoryOpen overlay and ChatHistory component */}
          {/* Main content area for chat and side panel */}
          <div className={`flex-1 flex min-h-0 transition-all duration-300 ease-in-out
            ${isSidePanelOpen ? 'lg:w-2/3' : 'lg:w-full'}`}> {/* Adjust width based on side panel */}
            
            <div className={`flex-1 flex flex-col  min-w-0 ${isSidePanelOpen ? 'lg:w-1/2' : 'w-full'}`}>
              <AIChat {...chatProps} />
            </div>

            {isSidePanelOpen && (
              <div className={`hidden lg:flex lg:w-1/2 flex-shrink-0 min-h-0 max-w-sm `}> {/* Side panel on desktop */}
                <SidePanelViewer
                  code={activeSidePanelContent!.code}
                  language={activeSidePanelContent!.language}
                  onClose={handleCloseSidePanel}
                  onMermaidError={handleMermaidError}
                  onSuggestAiCorrection={handleSuggestAiCorrection}
                />
              </div>
            )}

            {/* Overlay for mobile when side panel is open */}
            {isSidePanelOpen && (
              <div
                className="fixed inset-0 bg-black/50 z-30 lg:hidden" // Lower z-index than panel, higher than chat history
                onClick={handleCloseSidePanel}
              />
            )}
            {/* Mobile side panel (fixed position) */}
            {isSidePanelOpen && (
              <div className="fixed inset-y-0 right-0 w-full max-w-sm bg-slate-50 border-l border-slate-200 shadow-xl flex flex-col z-40 lg:hidden">
                <SidePanelViewer
                  code={activeSidePanelContent!.code}
                  language={activeSidePanelContent!.language}
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
