import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  memo,
  useMemo,
} from 'react';
import {
  Book,
  Calculator,
  FlaskConical,
  Clock,
  Globe,
  FileText,
  Hash,
  Mic,
  Calendar,
  MessageCircle,
  Upload,
  Settings,
  Plus,
  Trash2,
  Edit,
  Loader2,
  X,
  Sun,
  Moon,
  Users,
  Bell,
  LogOut,
} from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

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
  activeTab:
  | 'notes'
  | 'recordings'
  | 'schedule'
  | 'chat'
  | 'documents'
  | 'settings'
  | 'dashboard'
  | 'social';
  onTabChange: (
    tab:
      | 'notes'
      | 'recordings'
      | 'schedule'
      | 'chat'
      | 'documents'
      | 'settings'
      | 'dashboard'
      | 'social'
      | string,
  ) => void; // Allow string for dynamic chat path
  chatSessions: ChatSession[];
  activeChatSessionId: string | null;
  onChatSessionSelect: (sessionId: string) => void;
  onNewChatSession: () => Promise<string | null>;
  onDeleteChatSession: (sessionId: string) => Promise<void>;
  onRenameChatSession: (sessionId: string, newTitle: string) => Promise<void>;
  hasMoreChatSessions: boolean;
  onLoadMoreChatSessions: () => void;
  currentTheme: 'light' | 'dark';
  onThemeChange: (theme: 'light' | 'dark') => void;
  fullName: string | null;
  avatarUrl: string | null;
}

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
}

interface RenameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (newTitle: string) => void;
  title: string;
  message: string;
  initialValue: string;
}

const CategoriesList = memo(
  ({
    categories,
    selectedCategory,
    onCategoryChange,
    isOpen,
  }: {
    categories: { id: string; name: string; icon: any }[];
    selectedCategory: string;
    onCategoryChange: (category: string) => void;
    isOpen: boolean;
  }) => (
    <nav className="space-y-1">
      {categories.map((category) => {
        const Icon = category.icon;
        const isActive = selectedCategory === category.id;

        return (
          <Button
            key={category.id}
            variant={isActive ? 'secondary' : 'ghost'}
            className={`w-full justify-start h-9 text-sm ${isActive
              ? 'bg-slate-100 text-slate-800 dark:bg-gray-700 dark:text-white'
              : 'hover:bg-slate-50 text-slate-600 dark:hover:bg-gray-800 dark:text-gray-300'
              } ${!isOpen && 'px-2'}`}
            onClick={() => onCategoryChange(category.id)}
          >
            <Icon
              className={`h-3 w-3 ${isOpen ? 'mr-2' : 'lg:group-hover:mr-2 lg:transition-all lg:duration-300'
                }`}
            />
            <span
              className={`truncate ${isOpen
                ? ''
                : 'lg:opacity-0 lg:group-hover:opacity-100 lg:transition-opacity lg:duration-300 lg:pointer-events-none'
                }`}
            >
              {category.name}
            </span>
          </Button>
        );
      })}
    </nav>
  ),
);

const TabsList = memo(
  ({
    tabs,
    activeTab,
    onTabChange,
    activeChatSessionId,
    isOpen,
  }: {
    tabs: { id: string; name: string; icon: any }[];
    activeTab: string;
    onTabChange: (tab: string) => void;
    activeChatSessionId: string | null;
    isOpen: boolean;
  }) => (
    <nav className="space-y-1">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        // For the chat tab, we need special handling for the active state and navigation
        const isChatTab = tab.id === 'chat';
        const isActive = isChatTab
          ? activeTab === 'chat' // If on chat tab, check if activeTab is 'chat'
          : activeTab === tab.id; // Otherwise, standard check

        return (
          <Button
            key={tab.id}
            variant={isActive ? 'default' : 'ghost'}
            className={`w-full justify-start h-10 ${isActive
              ? 'bg-blue-600 text-white font-bold text-lg py-3 rounded-lg shadow-lg hover:bg-blue-700 transition-all duration-300 transform hover:scale-[1.005] disabled:opacity-50 disabled:cursor-not-allowed h-12'
              : 'hover:bg-slate-100 text-slate-700 dark:text-gray-300 dark:hover:bg-gray-800'
              } ${!isOpen && 'px-2'}`}
            onClick={() => {
              if (isChatTab) {
                // If 'AI Chat' tab is clicked, navigate to the active session if one exists, else to '/chat'
                onTabChange(
                  activeChatSessionId ? `chat/${activeChatSessionId}` : 'chat',
                );
              } else {
                onTabChange(tab.id);
              }
            }}
          >
            <Icon
              className={`h-4 w-4 ${isOpen ? 'mr-3' : 'lg:group-hover:mr-3 lg:transition-all lg:duration-300'
                }`}
            />
            <span
              className={`truncate ${isOpen
                ? ''
                : 'lg:opacity-0 lg:group-hover:opacity-100 lg:transition-opacity lg:duration-300 lg:pointer-events-none'
                }`}
            >
              {tab.name}
            </span>
          </Button>
        );
      })}
    </nav>
  ),
);

const ChatSessionsList = memo(
  ({
    chatSessions,
    activeChatSessionId,
    onChatSessionSelect,
    onDeleteChatClick,
    onRenameChatClick,
    isOpen,
  }: {
    chatSessions: ChatSession[];
    activeChatSessionId: string | null;
    onChatSessionSelect: (sessionId: string) => void;
    onDeleteChatClick: (sessionId: string, event: React.MouseEvent) => void;
    onRenameChatClick: (
      sessionId: string,
      currentTitle: string,
      event: React.MouseEvent,
    ) => void;
    isOpen: boolean;
  }) => (
    <div className="space-y-1">
      {chatSessions.length === 0 && isOpen ? (
        <p className="text-sm text-slate-500 py-2 lg:opacity-0 lg:group-hover:opacity-100 lg:transition-opacity lg:duration-300 dark:text-gray-400">
          No chat sessions yet.
        </p>
      ) : (
        chatSessions.map((session) => {
          const isActive = activeChatSessionId === session.id;

          return (
            <div
              key={session.id}
              className={`flex items-center justify-between group cursor-pointer rounded-lg transition-colors duration-200 ${isActive
                ? 'bg-slate-100 text-slate-800 dark:bg-gray-700 dark:text-white'
                : 'hover:bg-slate-50 text-slate-600 dark:hover:bg-gray-800 dark:text-gray-300'
                }`}
              // Only call onChatSessionSelect here, as it handles navigation
              onClick={() => onChatSessionSelect(session.id)}
            >
              <Button
                variant="ghost"
                className={`flex-1 justify-start h-10 text-sm truncate ${!isOpen && 'px-2'
                  }`}
                title={session.title}
                style={{ maxWidth: '160px' }}
              >
                <MessageCircle
                  className={`h-4 w-4 ${isOpen ? 'mr-3' : 'lg:group-hover:mr-3 lg:transition-all lg:duration-300'
                    }`}
                />
                <span
                  className={`truncate ${isOpen
                    ? ''
                    : 'lg:opacity-0 lg:group-hover:opacity-100 lg:transition-opacity lg:duration-300 lg:pointer-events-none'
                    }`}
                >
                  {session.title}
                </span>
              </Button>
              {isOpen && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300 mr-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => onRenameChatClick(session.id, session.title, e)}
                    className="h-7 w-7 p-0 text-slate-500 hover:text-blue-600 hover:bg-slate-200 dark:text-gray-400 dark:hover:text-blue-400 dark:hover:bg-gray-700"
                    title="Rename"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => onDeleteChatClick(session.id, e)}
                    className="h-7 w-7 p-0 text-slate-500 hover:text-red-600 hover:bg-slate-200 dark:text-gray-400 dark:hover:text-red-400 dark:hover:bg-gray-700"
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
    </div>
  ),
);

const ThemeToggle = memo(
  ({
    currentTheme,
    onThemeChange,
    isOpen,
  }: {
    currentTheme: string;
    onThemeChange: () => void;
    isOpen: boolean;
  }) => (
    <Button
      variant="ghost"
      className={`w-full justify-start h-10 text-slate-700 hover:bg-slate-100 dark:text-gray-300 dark:hover:bg-gray-800 ${!isOpen && 'px-2'
        }`}
      onClick={onThemeChange}
      title="Toggle Theme"
    >
      {currentTheme === 'light' ? (
        <Moon
          className={`h-4 w-4 ${isOpen ? 'mr-3' : 'lg:group-hover:mr-3 lg:transition-all lg:duration-300'
            }`}
        />
      ) : (
        <Sun
          className={`h-4 w-4 ${isOpen ? 'mr-3' : 'lg:group-hover:mr-3 lg:transition-all lg:duration-300'
            }`}
        />
      )}
      <span
        className={`truncate ${isOpen
          ? ''
          : 'lg:opacity-0 lg:group-hover:opacity-100 lg:transition-opacity lg:duration-300 lg:pointer-events-none'
          }`}
      >
        {currentTheme === 'light' ? 'Dark Mode' : 'Light Mode'}
      </span>
    </Button>
  ),
);

const UserAvatar = memo(
  ({
    fullName,
    avatarUrl,
    getInitials,
    onAvatarClick,
    handleImageError,
    isAvatarMenuOpen,
  }: {
    fullName: string | null;
    avatarUrl: string | null;
    getInitials: (name: string | null) => string;
    onAvatarClick: () => void;
    handleImageError: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
    isAvatarMenuOpen: boolean;
  }) => (
    <div
      className="relative w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-blue-500 dark:bg-blue-600 flex items-center justify-center text-white font-bold text-sm cursor-pointer hover:opacity-80"
      onClick={onAvatarClick}
      title={isAvatarMenuOpen ? 'Close Menu' : 'Open Menu'}
    >
      <span>{getInitials(fullName || '')}</span>
      {avatarUrl && (
        <img
          src={avatarUrl}
          alt="User Avatar"
          className="w-full h-full object-cover absolute top-0 left-0"
          onError={handleImageError}
        />
      )}
    </div>
  ),
);

const AvatarMenu = memo(
  ({
    isOpen,
    onLogoutClick,
  }: {
    isOpen: boolean;
    onLogoutClick: () => void;
  }) => (
    <>
      {isOpen && (
        <>
          <Button
            variant="ghost"
            size="sm"
            className="p-1.5 sm:p-2 flex-shrink-0 relative dark:hover:bg-slate-700"
          >
            <Bell className="h-4 w-4 text-slate-600 dark:text-white" />
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onLogoutClick}
            className="p-1.5 sm:p-2 flex-shrink-0 dark:hover:bg-slate-700 text-slate-600 dark:text-white"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline ml-2">Sign Out</span>
          </Button>
        </>
      )}
    </>
  ),
);

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="bg-white rounded-lg shadow-xl max-w-sm w-full dark:bg-gray-800">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-3 dark:text-white">
            {title}
          </h3>
          <p className="text-slate-600 mb-6 dark:text-gray-300">{message}</p>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              className="text-slate-600 border-slate-200 hover:bg-slate-50 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700"
            >
              Cancel
            </Button>
            <Button onClick={onConfirm} className="bg-red-600 text-white shadow-md hover:bg-red-700">
              confirm
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const RenameModal: React.FC<RenameModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  initialValue,
}) => {
  const [newTitle, setNewTitle] = useState(initialValue);

  useEffect(() => {
    setNewTitle(initialValue);
  }, [initialValue]);

  if (!isOpen) return null;

  const handleConfirmClick = () => {
    if (newTitle.trim() !== '' && newTitle.trim() !== initialValue) {
      onConfirm(newTitle.trim());
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="bg-white rounded-lg shadow-xl max-w-sm w-full dark:bg-gray-800">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-3 dark:text-white">
            {title}
          </h3>
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
            <Button
              variant="outline"
              onClick={onClose}
              className="text-slate-600 border-slate-200 hover:bg-slate-50 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700"
            >
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
  chatSessions,
  activeChatSessionId,
  onChatSessionSelect,
  onNewChatSession,
  onDeleteChatSession,
  onRenameChatSession,
  hasMoreChatSessions,
  onLoadMoreChatSessions,
  currentTheme,
  onThemeChange,
  fullName,
  avatarUrl,
}) => {
  const [isNewChatLoading, setIsNewChatLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [sessionToDeleteId, setSessionToDeleteId] = useState<string | null>(
    null,
  );
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [sessionToRenameId, setSessionToRenameId] = useState<string | null>(
    null,
  );
  const [sessionToRenameTitle, setSessionToRenameTitle] = useState<string>(
    '',
  );

  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isAvatarMenuOpen, setIsAvatarMenuOpen] = useState(false);

  const getInitials = useCallback((name: string | null) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  }, []);

  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
      toast.success('Signed out successfully');
      navigate('/auth');
    } catch (error) {
      toast.error('Error signing out');
    }
  }, [signOut, navigate]);

  const handleImageError = useCallback((e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    e.currentTarget.style.display = 'none';
  }, []);

  const handleAvatarClick = useCallback(() => {
    setIsAvatarMenuOpen((prev) => !prev);
  }, []);

  const handleLogoutClick = useCallback(() => {
    setIsAvatarMenuOpen(false);
    setShowLogoutConfirm(true);
  }, []);

  const handleConfirmLogout = useCallback(() => {
    handleSignOut();
    setShowLogoutConfirm(false);
  }, [handleSignOut]);

  // Ref for the scrollable chat sessions container
  const chatSessionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const currentChatSessionsRef = chatSessionsRef.current;

    const handleScroll = () => {
      if (currentChatSessionsRef && hasMoreChatSessions) {
        // Check if the user has scrolled to the bottom
        const { scrollTop, scrollHeight, clientHeight } = currentChatSessionsRef;
        if (scrollTop + clientHeight >= scrollHeight - 5) {
          // -5 for a small buffer
          onLoadMoreChatSessions();
        }
      }
    };

    if (currentChatSessionsRef) {
      currentChatSessionsRef.addEventListener('scroll', handleScroll);
    }

    // Clean up the event listener
    return () => {
      if (currentChatSessionsRef) {
        currentChatSessionsRef.removeEventListener('scroll', handleScroll);
      }
    };
  }, [hasMoreChatSessions, onLoadMoreChatSessions, activeTab]); // Re-run effect if these dependencies change

  const handleNewChat = useCallback(async () => {
    setIsNewChatLoading(true);
    try {
      const newSessionId = await onNewChatSession();
      if (newSessionId) {
        // After creating a new session, navigate directly to it
        onTabChange(`chat/${newSessionId}`);
      } else {
        // Fallback to generic chat if new session creation failed
        onTabChange('chat');
      }
    } finally {
      setIsNewChatLoading(false);
    }
  }, [onNewChatSession, onTabChange]);

  const handleDeleteChatClick = useCallback((sessionId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setSessionToDeleteId(sessionId);
    setShowDeleteConfirm(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (sessionToDeleteId) {
      await onDeleteChatSession(sessionToDeleteId);
      setSessionToDeleteId(null);
      setShowDeleteConfirm(false);
    }
  }, [onDeleteChatSession, sessionToDeleteId]);
  const tabs = useMemo(
    () => [
      { id: 'dashboard', name: 'Dashboard', icon: Book },
      { id: 'notes', name: 'Notes', icon: FileText },
      { id: 'recordings', name: 'Recordings', icon: Mic },
      { id: 'schedule', name: 'Schedule', icon: Calendar },
      { id: 'chat', name: 'AI Chat', icon: MessageCircle },
      { id: 'documents', name: 'Documents', icon: Upload },
      { id: 'social', name: 'Social Feed', icon: Users },
      { id: 'settings', name: 'Settings', icon: Settings },
    ],
    []
  );
  const handleRenameChatClick = useCallback((sessionId: string, currentTitle: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setSessionToRenameId(sessionId);
    setSessionToRenameTitle(currentTitle);
    setShowRenameModal(true);
  }, []);

  const handleConfirmRename = useCallback(async (newTitle: string) => {
    if (sessionToRenameId && newTitle.trim() !== '') {
      await onRenameChatSession(sessionToRenameId, newTitle.trim());
    }
    setSessionToRenameId(null);
    setSessionToRenameTitle('');
    setShowRenameModal(false);
  }, [onRenameChatSession, sessionToRenameId]);

  const handleThemeToggle = useCallback(() => {
    onThemeChange(currentTheme === 'light' ? 'dark' : 'light');
  }, [currentTheme, onThemeChange]);

  const categoriesListProps = useMemo(
    () => ({
      categories: [
        { id: 'all', name: 'All Notes', icon: Book },
        { id: 'math', name: 'Math', icon: Calculator },
        { id: 'science', name: 'Science', icon: FlaskConical },
        { id: 'history', name: 'History', icon: Clock },
        { id: 'geography', name: 'Geography', icon: Globe },
        { id: 'literature', name: 'Literature', icon: FileText },
        { id: 'programming', name: 'Programming', icon: Hash },
      ],
      selectedCategory,
      onCategoryChange,
      isOpen,
    }),
    [selectedCategory, onCategoryChange, isOpen],
  );

  const tabsListProps = useMemo(
    () => ({
      tabs,
      activeTab,
      onTabChange,
      activeChatSessionId,
      isOpen,
    }),
    [tabs, activeTab, onTabChange, activeChatSessionId, isOpen],
  );

  const chatSessionsListProps = useMemo(
    () => ({
      chatSessions,
      activeChatSessionId,
      onChatSessionSelect,
      onDeleteChatClick: handleDeleteChatClick,
      onRenameChatClick: handleRenameChatClick,
      isOpen,
    }),
    [
      chatSessions,
      activeChatSessionId,
      onChatSessionSelect,
      handleDeleteChatClick,
      handleRenameChatClick,
      isOpen,
    ],
  );

  const themeToggleProps = useMemo(
    () => ({
      currentTheme,
      onThemeChange: handleThemeToggle,
      isOpen,
    }),
    [currentTheme, handleThemeToggle, isOpen]
  );



  const userAvatarProps = useMemo(
    () => ({
      fullName,
      avatarUrl,
      getInitials,
      onAvatarClick: handleAvatarClick,
      handleImageError,
      isAvatarMenuOpen,
    }),
    [fullName, avatarUrl, getInitials, handleAvatarClick, handleImageError, isAvatarMenuOpen],
  );

  const avatarMenuProps = useMemo(
    () => ({
      isOpen: isAvatarMenuOpen,
      onLogoutClick: handleLogoutClick,
    }),
    [isAvatarMenuOpen, handleLogoutClick],
  );

  return (
    <div
      className={`bg-white border-r h-full border-slate-200 transition-transform duration-300 ease-in-out
  ${isOpen ? 'translate-x-0' : '-translate-x-full'}
  fixed inset-y-0 left-0 z-50 flex flex-col shadow-lg lg:shadow-none
  lg:relative lg:translate-x-0 lg:w-16 lg:hover:w-64 group overflow-hidden
  dark:bg-gray-900 dark:border-gray-600`}
    >
      <div className="p-6 sm:p-4 flex-1 overflow-y-auto modern-scrollbar">
        <div className="mb-2">
          {isOpen && (
            <h2 className="font-semibold text-slate-800
  lg:opacity-0 lg:group-hover:opacity-100 lg:transition-opacity lg:duration-300
  dark:text-gray-200">
              Navigation
            </h2>
          )}
          <TabsList {...tabsListProps} />
        </div>

        <div className="mt-4 mb-2 border-t border-slate-200 pt-4 dark:border-gray-700">
          <ThemeToggle {...themeToggleProps} />
        </div>

        {/* Chat Sessions Section - Conditionally rendered based on activeTab */}
        {activeTab === 'chat' && (
          <div className="mt-6 mb-2 border-t border-slate-200 pt-4 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
              {isOpen && (
                <h2 className="font-semibold text-slate-800 lg:opacity-0 lg:group-hover:opacity-100 lg:transition-opacity lg:duration-300 dark:text-gray-200">
                  Chat Sessions
                </h2>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNewChat}
                className={`text-slate-600 hover:bg-slate-100 dark:text-gray-300 dark:hover:bg-gray-800 ${!isOpen && 'px-2'
                  }`}
                title="New Chat"
                disabled={isNewChatLoading}
              >
                {isNewChatLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className={`h-4 w-4 ${isOpen ? 'mr-2' : ''}`} />
                )}
                <span className={`${isOpen ? '' : 'lg:opacity-0 lg:group-hover:opacity-100 lg:transition-opacity lg:duration-300 lg:absolute lg:left-9 lg:w-full lg:pl-1 lg:pointer-events-none'
                  }`}>
                  New Chat
                </span>
              </Button>
            </div>
            {/* Scrollable container for chat sessions */}
            <div
              ref={chatSessionsRef}
              className={`space-y-1 transition-all duration-300 ease-in-out
  ${isOpen
                  ? 'max-h-[50vh] overflow-y-auto modern-scrollbar'
                  : 'max-h-0 overflow-hidden'
                }
  lg:group-hover:max-h-[50vh] lg:group-hover:overflow-y-auto lg:group-hover:modern-scrollbar
  lg:max-h-0 lg:overflow-hidden`}
            >
              <ChatSessionsList {...chatSessionsListProps} />
              {/* The "Load More" button itself is removed, as loading is now triggered by scroll.
  You can keep it if you want it as a fallback or for visual indication,
  but its click handler won't be the primary trigger anymore.
  */}
            </div>
          </div>
        )}

        {activeTab === 'notes' && (
          <div className="mt-6 mb-2 border-t border-slate-200 pt-4 dark:border-gray-700">
            {isOpen && (
              <div className="mb-2
  lg:opacity-0 lg:group-hover:opacity-100 lg:transition-opacity lg:duration-300">
                <h2 className="font-semibold text-slate-800 dark:text-gray-200">
                  Categories
                </h2>
                <p className="text-sm text-slate-500 dark:text-gray-400">
                  {noteCount} notes
                </p>
              </div>
            )}

            <CategoriesList {...categoriesListProps} />
          </div>
        )}
      </div>
      <div
        className={`flex-shrink-0 border-t border-slate-200 p-4
  dark:border-gray-700 transition-all duration-300 ease-in-out`}
      >
        <div className="flex items-center gap-2">
          <AvatarMenu {...avatarMenuProps} />
          <UserAvatar {...userAvatarProps} />
        </div>
      </div>
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Chat Session"
        message="Are you sure you want to delete this chat session? All messages within it will also be deleted. This action cannot be undone."
      />

      <RenameModal
        isOpen={showRenameModal}
        onClose={() => setShowRenameModal(false)}
        onConfirm={handleConfirmRename}
        title="Rename Chat Session"
        message="Enter a new title for your chat session:"
        initialValue={sessionToRenameTitle}
      />
      <ConfirmationModal
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={handleConfirmLogout}
        title="Sign Out"
        message="Are you sure you want to sign out? You will be redirected to the login page."
      />
    </div>
  );
};