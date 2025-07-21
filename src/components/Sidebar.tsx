import React from 'react';
import { Book, Calculator, FlaskConical, Clock, Globe, FileText, Hash, Mic, Calendar, MessageCircle, Upload, Settings, Plus, Trash2, Edit, Loader2, X, Sun, Moon } from 'lucide-react'; // Added Sun and Moon icons
import { Button } from './ui/button';
import { NoteCategory } from '../types/Note';
import { Card, CardContent } from './ui/card'; // Import Card components for the modal

// Define ChatSession interface if not already globally available
interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  last_message_at: string;
  document_ids: string[];
  message_count?: number;
}

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  noteCount: number;
  activeTab: 'notes' | 'recordings' | 'schedule' | 'chat' | 'documents' | 'settings';
  onTabChange: (tab: 'notes' | 'recordings' | 'schedule' | 'chat' | 'documents' | 'settings') => void;
  // New props for chat sessions
  chatSessions: ChatSession[];
  activeChatSessionId: string | null;
  onChatSessionSelect: (sessionId: string) => void;
  onNewChatSession: () => Promise<string | null>;
  onDeleteChatSession: (sessionId: string) => Promise<void>;
  onRenameChatSession: (sessionId: string, newTitle: string) => Promise<void>;
  // Pagination props for chat sessions
  hasMoreChatSessions: boolean;
  onLoadMoreChatSessions: () => void;
  // Theme props
  currentTheme: 'light' | 'dark';
  onThemeChange: (theme: 'light' | 'dark') => void;
}

const categories = [
  { id: 'all', name: 'All Notes', icon: FileText },
  { id: 'general', name: 'General', icon: Book },
  { id: 'math', name: 'Mathematics', icon: Calculator },
  { id: 'science', name: 'Science', icon: FlaskConical },
  { id: 'history', name: 'History', icon: Clock },
  { id: 'language', name: 'Languages', icon: Globe },
  { id: 'other', name: 'Other', icon: Hash },
];

const tabs = [
  { id: 'notes', name: 'Notes', icon: FileText },
  { id: 'recordings', name: 'Recordings', icon: Mic },
  { id: 'schedule', name: 'Schedule', icon: Calendar },
  { id: 'chat', name: 'AI Chat', icon: MessageCircle },
  { id: 'documents', name: 'Documents', icon: Upload },
  { id: 'settings', name: 'Settings', icon: Settings },
];

// Re-usable ConfirmationModal component (can be moved to a shared UI file if needed elsewhere)
interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ isOpen, onClose, onConfirm, title, message }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="bg-white rounded-lg shadow-xl max-w-sm w-full dark:bg-gray-800"> {/* Added dark mode */}
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-3 dark:text-white">{title}</h3> {/* Added dark mode */}
          <p className="text-slate-600 mb-6 dark:text-gray-300">{message}</p> {/* Added dark mode */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose} className="text-slate-600 border-slate-200 hover:bg-slate-50 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700"> {/* Added dark mode */}
              Cancel
            </Button>
            <Button onClick={onConfirm} className="bg-red-600 text-white shadow-md hover:bg-red-700">
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// New RenameModal component
interface RenameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (newTitle: string) => void;
  title: string;
  message: string;
  initialValue: string;
}

const RenameModal: React.FC<RenameModalProps> = ({ isOpen, onClose, onConfirm, title, message, initialValue }) => {
  const [newTitle, setNewTitle] = React.useState(initialValue);

  React.useEffect(() => {
    setNewTitle(initialValue); // Update internal state when initialValue changes
  }, [initialValue]);

  if (!isOpen) return null;

  const handleConfirmClick = () => {
    if (newTitle.trim() !== '' && newTitle.trim() !== initialValue) {
      onConfirm(newTitle.trim());
    }
    onClose(); // Always close after attempt to confirm
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="bg-white rounded-lg shadow-xl max-w-sm w-full dark:bg-gray-800">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-3 dark:text-white">{title}</h3>
          <p className="text-slate-600 mb-4 dark:text-gray-300">{message}</p>
          <input
            type="text"
            className="w-full p-2 border border-slate-300 rounded-md mb-6 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleConfirmClick();
              }
            }}
            autoFocus
          />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose} className="text-slate-600 border-slate-200 hover:bg-slate-50 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700">
              Cancel
            </Button>
            <Button onClick={handleConfirmClick} className="bg-blue-600 text-white shadow-md hover:bg-blue-700">
              Rename
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};


export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onToggle,
  selectedCategory,
  onCategoryChange,
  noteCount,
  activeTab,
  onTabChange,
  // Destructure new chat session props
  chatSessions,
  activeChatSessionId,
  onChatSessionSelect,
  onNewChatSession,
  onDeleteChatSession,
  onRenameChatSession,
  // Pagination props
  hasMoreChatSessions,
  onLoadMoreChatSessions,
  // Theme props
  currentTheme,
  onThemeChange,
}) => {

  const [isNewChatLoading, setIsNewChatLoading] = React.useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [sessionToDeleteId, setSessionToDeleteId] = React.useState<string | null>(null);
  // State for rename modal
  const [showRenameModal, setShowRenameModal] = React.useState(false);
  const [sessionToRenameId, setSessionToRenameId] = React.useState<string | null>(null);
  const [sessionToRenameTitle, setSessionToRenameTitle] = React.useState<string>('');


  const handleNewChat = async () => {
    setIsNewChatLoading(true);
    try {
      await onNewChatSession();
      onTabChange('chat'); // Automatically switch to chat tab
    } finally {
      setIsNewChatLoading(false);
    }
  };

  const handleDeleteChatClick = (sessionId: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent selecting the chat session
    setSessionToDeleteId(sessionId);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (sessionToDeleteId) {
      await onDeleteChatSession(sessionToDeleteId);
      setSessionToDeleteId(null);
      setShowDeleteConfirm(false);
    }
  };

  const handleRenameChatClick = (sessionId: string, currentTitle: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent selecting the chat session
    setSessionToRenameId(sessionId);
    setSessionToRenameTitle(currentTitle);
    setShowRenameModal(true);
  };

  const handleConfirmRename = async (newTitle: string) => {
    if (sessionToRenameId && newTitle.trim() !== '') {
      await onRenameChatSession(sessionToRenameId, newTitle.trim());
    }
    setSessionToRenameId(null);
    setSessionToRenameTitle('');
    setShowRenameModal(false);
  };

  const handleThemeToggle = () => {
    onThemeChange(currentTheme === 'light' ? 'dark' : 'light');
  };

  return (
    // The main container for the sidebar.
    // On mobile, it slides in/out based on 'isOpen'.
    // On desktop (lg breakpoint), it's narrow by default (w-16) and expands on hover (group-hover:w-64).
    // 'group' class is essential for group-hover to work on child elements.
    <div className={`bg-white border-r h-full border-slate-200 transition-all duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'
      } fixed inset-y-0 left-0 z-50 flex flex-col shadow-lg lg:shadow-none
    lg:relative lg:translate-x-0 lg:w-16 lg:hover:w-64 group overflow-hidden
    dark:bg-gray-900 dark:border-gray-700`}> {/* Added dark mode classes */}

      {/* Content area, takes up remaining vertical space and allows scrolling */}
      <div className="p-6 sm:p-4 flex-1 overflow-y-auto modern-scrollbar"> {/* Added overflow-y-auto and custom-scrollbar */}
        {/* Main Navigation Section */}
        <div className="mb-2">
          {/* "Navigation" heading: visible when 'isOpen' (mobile) or on desktop hover */}
          {(isOpen || window.innerWidth >= 1024) && ( // Check for isOpen or desktop view
            <h2 className="font-semibold text-slate-800
              lg:opacity-0 lg:group-hover:opacity-100 lg:transition-opacity lg:duration-300
              dark:text-gray-200"> {/* Added dark mode text */}
              Navigation
            </h2>
          )}
          <nav className="space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <Button
                  key={tab.id}
                  variant={isActive ? "default" : "ghost"}
                  className={`w-full justify-start h-10 ${isActive
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md'
                      : 'hover:bg-slate-100 text-slate-700 dark:text-gray-300 dark:hover:bg-gray-800' // Added dark mode
                    } ${!isOpen && 'px-2'}`}
                  onClick={() => onTabChange(tab.id as 'notes' | 'recordings' | 'schedule' | 'chat' | 'documents' | 'settings')} // Explicitly cast tab.id
                >
                  {/* Icon: has margin when 'isOpen' (mobile) or on desktop hover */}
                  <Icon className={`h-4 w-4 ${isOpen ? 'mr-3' : 'lg:group-hover:mr-3 lg:transition-all lg:duration-300'}`} />
                  {/* Text label: visible when 'isOpen' (mobile) or on desktop hover */}
                  <span className={`truncate ${isOpen ? '' : 'lg:opacity-0 lg:group-hover:opacity-100 lg:transition-opacity lg:duration-300  lg:pointer-events-none'
                    }`}>
                    {tab.name}
                  </span>
                </Button>
              );
            })}
          </nav>
        </div>

        {/* Theme Toggle Button */}
        <div className="mt-4 mb-2 border-t border-slate-200 pt-4 dark:border-gray-700"> {/* Added dark mode border */}
          <Button
            variant="ghost"
            className={`w-full justify-start h-10 text-slate-700 hover:bg-slate-100 dark:text-gray-300 dark:hover:bg-gray-800 ${!isOpen && 'px-2'}`}
            onClick={handleThemeToggle}
            title="Toggle Theme"
          >
            {currentTheme === 'light' ? (
              <Moon className={`h-4 w-4 ${isOpen ? 'mr-3' : 'lg:group-hover:mr-3 lg:transition-all lg:duration-300'}`} />
            ) : (
              <Sun className={`h-4 w-4 ${isOpen ? 'mr-3' : 'lg:group-hover:mr-3 lg:transition-all lg:duration-300'}`} />
            )}
            <span className={`truncate ${isOpen ? '' : 'lg:opacity-0 lg:group-hover:opacity-100 lg:transition-opacity lg:duration-300  lg:pointer-events-none'
              }`}>
              {currentTheme === 'light' ? 'Dark Mode' : 'Light Mode'}
            </span>
          </Button>
        </div>

        {/* Chat Sessions Section - Conditionally rendered based on activeTab */}
        {activeTab === 'chat' && (
          <div className="mt-6 mb-2 border-t border-slate-200 pt-4 dark:border-gray-700"> {/* Added dark mode border */}
            <div className="flex items-center justify-between mb-2">
              {(isOpen || window.innerWidth >= 1024) && (
                <h2 className="font-semibold text-slate-800 lg:opacity-0 lg:group-hover:opacity-100 lg:transition-opacity lg:duration-300 dark:text-gray-200"> {/* Added dark mode text */}
                  Chat Sessions
                </h2>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNewChat}
                className={`text-slate-600 hover:bg-slate-100 dark:text-gray-300 dark:hover:bg-gray-800 ${!isOpen && 'px-2'}`}
                title="New Chat"
                disabled={isNewChatLoading}
              >
                {isNewChatLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className={`h-4 w-4 ${isOpen ? 'mr-2' : ''}`} />
                )}
                <span className={`${isOpen ? '' : 'lg:opacity-0 lg:group-hover:opacity-100 lg:transition-opacity lg:duration-300 lg:absolute lg:left-9 lg:w-full lg:pl-1 lg:pointer-events-none'}`}>
                  New Chat
                </span>
              </Button>
            </div>
            {/* Dynamic max-height and overflow for scrollability and hiding when collapsed */}
            <nav className={`space-y-1 transition-all duration-300 ease-in-out
              ${isOpen // If sidebar is open (mobile or desktop explicitly opened)
                ? 'max-h-[50vh] overflow-y-auto custom-scrollbar'
                : 'max-h-0 overflow-hidden' // If sidebar is closed (mobile) or collapsed (desktop)
              }
              lg:group-hover:max-h-[50vh] lg:group-hover:overflow-y-auto lg:group-hover:custom-scrollbar
              lg:max-h-0 lg:overflow-hidden // Default for desktop when not hovered
            `}>
              {chatSessions.length === 0 && (isOpen || window.innerWidth >= 1024) ? (
                <p className="text-sm text-slate-500 py-2  lg:opacity-0 lg:group-hover:opacity-100 lg:transition-opacity lg:duration-300 dark:text-gray-400"> {/* Added dark mode text */}
                  No chat sessions yet.
                </p>
              ) : (
                chatSessions.map((session) => {
                  const isActive = activeChatSessionId === session.id;
                  // const lastMessageDate = session.last_message_at ? new Date(session.last_message_at).toLocaleDateString() : 'No messages';
                  // const lastMessageTime = session.last_message_at ? new Date(session.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

                  return (
                    <div
                      key={session.id}
                      className={`flex items-center justify-between group cursor-pointer rounded-lg transition-colors duration-200 ${isActive
                          ? 'bg-slate-100 text-slate-800 dark:bg-gray-700 dark:text-white' // Added dark mode
                          : 'hover:bg-slate-50 text-slate-600 dark:hover:bg-gray-800 dark:text-gray-300' // Added dark mode
                        }`}
                      onClick={() => { onChatSessionSelect(session.id); onTabChange('chat'); }} // Select and switch to chat tab
                    >
                      <Button
                        variant="ghost"
                        className={`flex-1 justify-start h-10 text-sm truncate ${!isOpen && 'px-2'}`}
                        title={session.title}
                      >
                        <MessageCircle className={`h-4 w-4 ${isOpen ? 'mr-3' : 'lg:group-hover:mr-3 lg:transition-all lg:duration-300'}`} />
                        <span className={`truncate ${isOpen ? '' : 'lg:opacity-0 lg:group-hover:opacity-100 lg:transition-opacity lg:duration-300  lg:pointer-events-none'
                          }`}>
                          {session.title}
                        </span>
                      </Button>
                      {(isOpen || window.innerWidth >= 1024) && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300 mr-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => handleRenameChatClick(session.id, session.title, e)} // Changed to handleRenameChatClick
                            className="h-7 w-7 p-0 text-slate-500 hover:text-blue-600 hover:bg-slate-200 dark:text-gray-400 dark:hover:text-blue-400 dark:hover:bg-gray-700" // Added dark mode
                            title="Rename"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => handleDeleteChatClick(session.id, e)} // Changed to handleDeleteChatClick
                            className="h-7 w-7 p-0 text-slate-500 hover:text-red-600 hover:bg-slate-200 dark:text-gray-400 dark:hover:text-red-400 dark:hover:bg-gray-700" // Added dark mode
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              {hasMoreChatSessions && (isOpen || window.innerWidth >= 1024) && (
                <Button
                  variant="ghost"
                  className="w-full justify-center h-10 text-sm text-slate-600 hover:bg-slate-100 dark:text-gray-300 dark:hover:bg-gray-800" // Added dark mode
                  onClick={onLoadMoreChatSessions}
                >
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Load More
                </Button>
              )}
            </nav>
          </div>
        )}

        {/* Categories Section (only shown when Notes tab is active) */}
        {activeTab === 'notes' && (
          <div className="mt-6 mb-2 border-t border-slate-200 pt-4 dark:border-gray-700"> {/* Added dark mode border */}
            {/* "Categories" heading: visible when 'isOpen' (mobile) or on desktop hover */}
            {(isOpen || window.innerWidth >= 1024) && ( // Check for isOpen or desktop view
              <div className="mb-2
                lg:opacity-0 lg:group-hover:opacity-100 lg:transition-opacity lg:duration-300">
                <h2 className="font-semibold text-slate-800 dark:text-gray-200">Categories</h2> {/* Added dark mode text */}
                <p className="text-sm text-slate-500 dark:text-gray-400">{noteCount} notes</p> {/* Added dark mode text */}
              </div>
            )}

            <nav className="space-y-1">
              {categories.map((category) => {
                const Icon = category.icon;
                const isActive = selectedCategory === category.id;

                return (
                  <Button
                    key={category.id}
                    variant={isActive ? "secondary" : "ghost"}
                    className={`w-full justify-start h-9 text-sm ${isActive
                        ? 'bg-slate-100 text-slate-800 dark:bg-gray-700 dark:text-white' // Added dark mode
                        : 'hover:bg-slate-50 text-slate-600 dark:hover:bg-gray-800 dark:text-gray-300' // Added dark mode
                      } ${!isOpen && 'px-2'}`}
                    onClick={() => onCategoryChange(category.id)}
                  >
                    {/* Icon: has margin when 'isOpen' (mobile) or on desktop hover */}
                    <Icon className={`h-3 w-3 ${isOpen ? 'mr-2' : 'lg:group-hover:mr-2 lg:transition-all lg:duration-300'}`} />
                    {/* Text label: visible when 'isOpen' (mobile) or on desktop hover */}
                    <span className={`truncate ${isOpen ? '' : 'lg:opacity-0 lg:group-hover:opacity-100 lg:transition-opacity lg:duration-300  lg:pointer-events-none'
                      }`}>
                      {category.name}
                    </span>
                  </Button>
                );
              })}
            </nav>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Chat Session"
        message="Are you sure you want to delete this chat session? All messages within it will also be deleted. This action cannot be undone."
      />

      {/* Rename Modal */}
      <RenameModal
        isOpen={showRenameModal}
        onClose={() => setShowRenameModal(false)}
        onConfirm={handleConfirmRename}
        title="Rename Chat Session"
        message="Enter a new title for your chat session:"
        initialValue={sessionToRenameTitle}
      />
    </div>
  );
};
