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
  Home,
  TrendingUp,
  User,
  Lightbulb
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

// Define interfaces
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
    | 'quizzes'
    | 'schedule'
    | 'chat'
    | 'documents'
    | 'settings'
    | 'dashboard'
    | 'social'
    | string;
  activeSocialTab?: string; // New prop for social sub-navigation
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
      | 'quizzes'
      | string,
  ) => void;
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

// Memoized CategoriesList component
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
            className={`w-full justify-start h-9 text-sm ${
              isActive
                ? 'bg-slate-100 text-slate-800 dark:bg-gray-700 dark:text-white'
                : 'hover:bg-slate-50 text-slate-600 dark:hover:bg-gray-800 dark:text-gray-300'
            } ${!isOpen && 'px-2'}`}
            onClick={() => onCategoryChange(category.id)}
          >
            <Icon
              className={`h-3 w-3 ${
                isOpen ? 'mr-2' : 'lg:group-hover:mr-2 lg:transition-all lg:duration-300'
              }`}
            />
            <span
              className={`truncate ${
                isOpen
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

// Memoized SocialNavList component
const SocialNavList = memo(
  ({
    items,
    activeSocialTab,
    onTabChange,
    isOpen,
  }: {
    items: { id: string; name: string; icon: any; path: string }[];
    activeSocialTab: string;
    onTabChange: (path: string) => void;
    isOpen: boolean;
  }) => (
    <nav className="space-y-1">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = activeSocialTab === item.id;

        return (
          <Button
            key={item.id}
            variant={isActive ? 'secondary' : 'ghost'}
            className={`w-full justify-start h-9 text-sm ${
              isActive
                ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                : 'hover:bg-slate-50 text-slate-600 dark:hover:bg-gray-800 dark:text-gray-300'
            } ${!isOpen && 'px-2'}`}
            onClick={() => onTabChange(item.path)}
          >
            <Icon
              className={`h-4 w-4 ${
                isOpen ? 'mr-2' : 'lg:group-hover:mr-2 lg:transition-all lg:duration-300'
              }`}
            />
            <span
              className={`truncate ${
                isOpen
                  ? ''
                  : 'lg:opacity-0 lg:group-hover:opacity-100 lg:transition-opacity lg:duration-300 lg:pointer-events-none'
              }`}
            >
              {item.name}
            </span>
          </Button>
        );
      })}
    </nav>
  ),
);

// Memoized TabsList component
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
        const isChatTab = tab.id === 'chat';
        // Check if the tab is active, accounting for chat session paths
        const isActive = isChatTab
          ? activeTab === 'chat' || activeTab.startsWith('chat/')
          : activeTab === tab.id;

        return (
          <Button
            key={tab.id}
            variant={isActive ? 'default' : 'ghost'}
            className={`w-full justify-start h-10 ${
              isActive
                ? 'bg-blue-600 text-white font-bold text-lg py-3 rounded-lg shadow-lg hover:bg-blue-700 transition-all duration-300 transform hover:scale-[1.005] disabled:opacity-50 disabled:cursor-not-allowed h-12'
                : 'hover:bg-slate-100 text-slate-700 dark:text-gray-300 dark:hover:bg-gray-800'
            } ${!isOpen && 'px-2'}`}
            onClick={() => {
              if (isChatTab) {
                onTabChange(
                  activeChatSessionId ? `chat/${activeChatSessionId}` : 'chat',
                );
              } else {
                onTabChange(tab.id);
              }
            }}
          >
            <Icon
              className={`h-4 w-4 ${
                isOpen ? 'mr-3' : 'lg:group-hover:mr-3 lg:transition-all lg:duration-300'
              }`}
            />
            <span
              className={`truncate ${
                isOpen
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

// Memoized ChatSessionsList component
const ChatSessionsList = memo(
  ({
    chatSessions,
    activeChatSessionId,
    onChatSessionSelect,
    onDeleteChatClick,
    onRenameChatClick,
    isOpen,
    isDeletingSession,
    isRenamingSession,
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
    isDeletingSession: string | null;
    isRenamingSession: string | null;
  }) => (
    <div className="space-y-1">
      {chatSessions.length === 0 && isOpen ? (
        <p className="text-sm text-slate-500 py-2 lg:opacity-0 lg:group-hover:opacity-100 lg:transition-opacity lg:duration-300 dark:text-gray-400">
          No chat sessions yet.
        </p>
      ) : (
        chatSessions.map((session) => {
          const isActive = activeChatSessionId === session.id;
          const isDeleting = isDeletingSession === session.id;
          const isRenaming = isRenamingSession === session.id;

          return (
            <div
              key={session.id}
              className={`flex items-center justify-between group cursor-pointer rounded-lg transition-colors duration-200 ${
                isActive
                  ? 'bg-slate-100 text-slate-800 dark:bg-gray-700 dark:text-white'
                  : 'hover:bg-slate-50 text-slate-600 dark:hover:bg-gray-800 dark:text-gray-300'
              } ${isDeleting || isRenaming ? 'opacity-60 pointer-events-none' : ''}`}
              onClick={() => !isDeleting && !isRenaming && onChatSessionSelect(session.id)}
            >
              <Button
                variant="ghost"
                className={`flex-1 justify-start h-10 text-sm truncate ${
                  !isOpen && 'px-2'
                }`}
                title={session.title}
                style={{ maxWidth: '160px' }}
                disabled={isDeleting || isRenaming}
              >
                {isRenaming ? (
                  <Loader2
                    className={`h-4 w-4 animate-spin ${
                      isOpen ? 'mr-3' : 'lg:group-hover:mr-3 lg:transition-all lg:duration-300'
                    }`}
                  />
                ) : (
                  <MessageCircle
                    className={`h-4 w-4 ${
                      isOpen ? 'mr-3' : 'lg:group-hover:mr-3 lg:transition-all lg:duration-300'
                    }`}
                  />
                )}
                <span
                  className={`truncate ${
                    isOpen
                      ? ''
                      : 'lg:opacity-0 lg:group-hover:opacity-100 lg:transition-opacity lg:duration-300 lg:pointer-events-none'
                  }`}
                >
                  {session.title}
                </span>
              </Button>
              {isOpen && (
                <div
                  className={`flex items-center gap-1 transition-opacity duration-300 mr-2 ${
                    isDeleting || isRenaming ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  }`}
                >
                  {isDeleting ? (
                    <div className="h-7 w-14 flex items-center justify-center">
                      <Loader2 className="h-4 w-4 animate-spin text-red-600" />
                    </div>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => onRenameChatClick(session.id, session.title, e)}
                        className="h-7 w-7 p-0 text-slate-500 hover:text-blue-600 hover:bg-slate-200 dark:text-gray-400 dark:hover:text-blue-400 dark:hover:bg-gray-700"
                        title="Rename"
                        disabled={isRenaming}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => onDeleteChatClick(session.id, e)}
                        className="h-7 w-7 p-0 text-slate-500 hover:text-red-600 hover:bg-slate-200 dark:text-gray-400 dark:hover:text-red-400 dark:hover:bg-gray-700"
                        title="Delete"
                        disabled={isRenaming}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  ),
);

// Memoized ThemeToggle component
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
      className={`w-full justify-start h-10 text-slate-700 hover:bg-slate-100 dark:text-gray-300 dark:hover:bg-gray-800 ${
        !isOpen && 'px-2'
      }`}
      onClick={onThemeChange}
      title="Toggle Theme"
    >
      {currentTheme === 'light' ? (
        <Moon
          className={`h-4 w-4 ${
            isOpen ? 'mr-3' : 'lg:group-hover:mr-3 lg:transition-all lg:duration-300'
          }`}
        />
      ) : (
        <Sun
          className={`h-4 w-4 ${
            isOpen ? 'mr-3' : 'lg:group-hover:mr-3 lg:transition-all lg:duration-300'
          }`}
        />
      )}
      <span
        className={`truncate ${
          isOpen
            ? ''
            : 'lg:opacity-0 lg:group-hover:opacity-100 lg:transition-opacity lg:duration-300 lg:pointer-events-none'
        }`}
      >
        {currentTheme === 'light' ? 'Dark Mode' : 'Light Mode'}
      </span>
    </Button>
  ),
);

// Memoized UserAvatar component
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
      className="relative w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-blue-500 dark:bg-blue-600 flex items-center justify-center text-white font-bold text-sm cursor-pointer hover:opacity-80 transition-opacity"
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

// Memoized AvatarMenu component
const AvatarMenu = memo(
  ({
    isOpen,
    onLogoutClick,
    isLoggingOut,
  }: {
    isOpen: boolean;
    onLogoutClick: () => void;
    isLoggingOut: boolean;
  }) => (
    <>
      {isOpen && (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="p-1.5 sm:p-2 flex-shrink-0 relative dark:hover:bg-slate-700 transition-colors"
            title="Notifications"
            disabled={isLoggingOut}
          >
            {/* <Bell className="h-4 w-4 text-slate-600 dark:text-white" />
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 animate-pulse" /> */}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onLogoutClick}
            className="p-1.5 sm:p-2 flex-shrink-0 dark:hover:bg-slate-700 text-slate-600 dark:text-white transition-colors"
            disabled={isLoggingOut}
            title="Sign Out"
          >
            {isLoggingOut ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="h-4 w-4" />
            )}
            <span className="hidden sm:inline ml-2">
              {isLoggingOut ? 'Signing Out...' : 'Sign Out'}
            </span>
          </Button>
        </div>
      )}
    </>
  ),
);

// ConfirmationModal component
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
            <Button
              onClick={onConfirm}
              className="bg-red-600 text-white shadow-md hover:bg-red-700"
            >
              Confirm
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// RenameModal component
const RenameModal: React.FC<RenameModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  initialValue,
}) => {
  const [newTitle, setNewTitle] = useState(initialValue);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setNewTitle(initialValue);
  }, [initialValue]);

  if (!isOpen) return null;

  const handleConfirmClick = async () => {
    if (newTitle.trim() !== '' && newTitle.trim() !== initialValue && !isSubmitting) {
      setIsSubmitting(true);
      try {
        await onConfirm(newTitle.trim());
      } finally {
        setIsSubmitting(false);
      }
    }
    if (!isSubmitting) {
      onClose();
    }
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
            className="w-full p-2 border border-slate-300 rounded-md mb-6 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white disabled:opacity-50"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !isSubmitting) {
                handleConfirmClick();
              }
            }}
            autoFocus
            disabled={isSubmitting}
          />
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              className="text-slate-600 border-slate-200 hover:bg-slate-50 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700"
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmClick}
              className="bg-blue-600 text-white shadow-md hover:bg-blue-700 disabled:opacity-50"
              disabled={isSubmitting || newTitle.trim() === '' || newTitle.trim() === initialValue}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Renaming...
                </>
              ) : (
                'Rename'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Sidebar component
export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onToggle,
  selectedCategory,
  onCategoryChange,
  noteCount,
  activeTab,
  activeSocialTab,
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
  const [sessionToDeleteId, setSessionToDeleteId] = useState<string | null>(null);
  const [isDeletingSession, setIsDeletingSession] = useState<string | null>(null);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [sessionToRenameId, setSessionToRenameId] = useState<string | null>(null);
  const [sessionToRenameTitle, setSessionToRenameTitle] = useState<string>('');
  const [isRenamingSession, setIsRenamingSession] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isTogglingSidebar, setIsTogglingSidebar] = useState(false);

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
    setIsLoggingOut(true);
    try {
      await signOut();
      toast.success('Signed out successfully');
      navigate('/');
    } catch (error) {
      toast.error('Error signing out');
    } finally {
      setIsLoggingOut(false);
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

  const handleToggleSidebar = useCallback(() => {
    if (isTogglingSidebar) return;
    setIsTogglingSidebar(true);
    onToggle();
    setTimeout(() => setIsTogglingSidebar(false), 300); // Match transition duration
  }, [onToggle, isTogglingSidebar]);

  // Ref for the scrollable chat sessions container
  const chatSessionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const currentChatSessionsRef = chatSessionsRef.current;

    const handleScroll = () => {
      if (currentChatSessionsRef && hasMoreChatSessions && !isLoadingMore) {
        const { scrollTop, scrollHeight, clientHeight } = currentChatSessionsRef;
        if (scrollTop + clientHeight >= scrollHeight - 5) {
          handleLoadMore();
        }
      }
    };

    if (currentChatSessionsRef) {
      currentChatSessionsRef.addEventListener('scroll', handleScroll);
    }

    return () => {
      if (currentChatSessionsRef) {
        currentChatSessionsRef.removeEventListener('scroll', handleScroll);
      }
    };
  }, [hasMoreChatSessions, isLoadingMore, activeTab]);

  const handleLoadMore = useCallback(async () => {
    if (isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      await onLoadMoreChatSessions();
    } finally {
      setIsLoadingMore(false);
    }
  }, [onLoadMoreChatSessions, isLoadingMore]);

  const handleNewChat = useCallback(async () => {
    if (isNewChatLoading) return;
    setIsNewChatLoading(true);
    try {
      const newSessionId = await onNewChatSession();
      if (newSessionId) {
        onTabChange(`chat/${newSessionId}`);
      } else {
        onTabChange('chat');
      }
    } finally {
      setIsNewChatLoading(false);
    }
  }, [onNewChatSession, onTabChange, isNewChatLoading]);

  const handleDeleteChatClick = useCallback(
    (sessionId: string, event: React.MouseEvent) => {
      event.stopPropagation();
      setSessionToDeleteId(sessionId);
      setShowDeleteConfirm(true);
    },
    [],
  );

  const handleConfirmDelete = useCallback(async () => {
    if (sessionToDeleteId && !isDeletingSession) {
      setIsDeletingSession(sessionToDeleteId);
      try {
        await onDeleteChatSession(sessionToDeleteId);
        toast.success('Chat session deleted successfully');
      } catch (error) {
        toast.error('Error deleting chat session');
      } finally {
        setIsDeletingSession(null);
        setSessionToDeleteId(null);
        setShowDeleteConfirm(false);
      }
    }
  }, [onDeleteChatSession, sessionToDeleteId, isDeletingSession]);

  const handleRenameChatClick = useCallback(
    (sessionId: string, currentTitle: string, event: React.MouseEvent) => {
      event.stopPropagation();
      setSessionToRenameId(sessionId);
      setSessionToRenameTitle(currentTitle);
      setShowRenameModal(true);
    },
    [],
  );

  const handleConfirmRename = useCallback(
    async (newTitle: string) => {
      if (sessionToRenameId && newTitle.trim() !== '' && !isRenamingSession) {
        setIsRenamingSession(sessionToRenameId);
        try {
          await onRenameChatSession(sessionToRenameId, newTitle.trim());
          toast.success('Chat session renamed successfully');
        } catch (error) {
          toast.error('Error renaming chat session');
        } finally {
          setIsRenamingSession(null);
          setSessionToRenameId(null);
          setSessionToRenameTitle('');
          setShowRenameModal(false);
        }
      }
    },
    [onRenameChatSession, sessionToRenameId, isRenamingSession],
  );

  const handleThemeToggle = useCallback(() => {
    onThemeChange(currentTheme === 'light' ? 'dark' : 'light');
  }, [currentTheme, onThemeChange]);

  const tabs = useMemo(
    () => [
      { id: 'dashboard', name: 'Dashboard', icon: Book },
      { id: 'notes', name: 'Notes', icon: FileText },
      { id: 'recordings', name: 'Recordings', icon: Mic },
      { id: 'quizzes', name: 'Quizzes', icon: Lightbulb },
      { id: 'schedule', name: 'Schedule', icon: Calendar },
      { id: 'chat', name: 'AI Chat', icon: MessageCircle },
      { id: 'documents', name: 'Documents', icon: Upload },
      { id: 'social', name: 'Social Feed', icon: Users },
      { id: 'settings', name: 'Settings', icon: Settings },
    ],
    [],
  );

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

  const socialNavProps = useMemo(
    () => ({
      items: [
        { id: 'feed', name: 'Home', icon: Home, path: 'social/feed' },
        { id: 'trending', name: 'Trending', icon: TrendingUp, path: 'social/trending' },
        { id: 'groups', name: 'Groups', icon: Users, path: 'social/groups' },
        { id: 'notifications', name: 'Notifications', icon: Bell, path: 'social/notifications' },
        { id: 'profile', name: 'Profile', icon: User, path: 'social/profile' },
      ],
      activeSocialTab: activeSocialTab || 'feed',
      onTabChange,
      isOpen,
    }),
    [activeSocialTab, onTabChange, isOpen],
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
      isDeletingSession,
      isRenamingSession,
    }),
    [
      chatSessions,
      activeChatSessionId,
      onChatSessionSelect,
      handleDeleteChatClick,
      handleRenameChatClick,
      isOpen,
      isDeletingSession,
      isRenamingSession,
    ],
  );

  const themeToggleProps = useMemo(
    () => ({
      currentTheme,
      onThemeChange: handleThemeToggle,
      isOpen,
    }),
    [currentTheme, handleThemeToggle, isOpen],
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
      isLoggingOut,
    }),
    [isAvatarMenuOpen, handleLogoutClick, isLoggingOut],
  );

  return (
    <>
      <div
        className={`bg-white border-r h-full border-slate-200 transition-transform duration-300 ease-in-out ${
          isOpen
            ? 'translate-x-0 w-72 md:w-64'
            : '-translate-x-full md:translate-x-0 md:w-14 md:hover:w-64'
        } fixed inset-y-0 left-0 z-10 flex flex-col shadow-lg md:shadow-none md:translate-x-0 md:relative md:translate-x-0 md:w-16 lg:shadow-none lg:translate-x-0 lg:relative lg:translate-x-0 lg:w-16 lg:hover:w-64 group overflow-hidden dark:bg-gray-900 dark:border-gray-600 overflow-y-scroll modern-scrollbar`}
      >
        <div className="p-6 sm:p-4 flex-1">
          {/* Toggle Button for Mobile */}
          <div className="flex justify-end mb-4 md:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleToggleSidebar}
              className="text-slate-600 dark:text-gray-300"
              disabled={isTogglingSidebar}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="mb-2">
            {isOpen && (
              <h2 className="font-semibold text-slate-800 lg:opacity-0 lg:group-hover:opacity-100 lg:transition-opacity lg:duration-300 dark:text-gray-200">
                Navigation
              </h2>
            )}
            <TabsList {...tabsListProps} />
          </div>

          <div className="mt-4 mb-2 border-t border-slate-200 pt-4 dark:border-gray-700">
            <ThemeToggle {...themeToggleProps} />
          </div>

          {/* Social Navigation Section */}
          {activeTab === 'social' && (
            <div className="mt-6 mb-2 border-t border-slate-200 pt-4 dark:border-gray-700">
              {isOpen && (
                <div className="mb-2 lg:opacity-0 lg:group-hover:opacity-100 lg:transition-opacity lg:duration-300">
                   <h2 className="font-semibold text-slate-800 dark:text-gray-200">
                    Social
                  </h2>
                </div>
              )}
              <SocialNavList {...socialNavProps} />
            </div>
          )}

          {/* Chat Sessions Section */}
          {activeTab === 'chat' || activeTab.startsWith('chat/') ? (
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
                  className={`text-slate-600 hover:bg-slate-100 dark:text-gray-300 dark:hover:bg-gray-800 ${
                    !isOpen && 'px-2'
                  }`}
                  title="New Chat"
                  disabled={isNewChatLoading}
                >
                  {isNewChatLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className={`h-4 w-4 ${isOpen ? 'mr-2' : ''}`} />
                  )}
                  <span
                    className={`${
                      isOpen
                        ? ''
                        : 'lg:opacity-0 lg:group-hover:opacity-100 lg:transition-opacity lg:duration-300 lg:absolute lg:left-9 lg:w-full lg:pl-1 lg:pointer-events-none'
                    }`}
                  >
                    New Chat
                  </span>
                </Button>
              </div>
              <div
                ref={chatSessionsRef}
                className={`space-y-1 transition-all duration-300 ease-in-out ${
                  isOpen
                    ? 'max-h-[50vh] overflow-y-auto modern-scrollbar'
                    : 'max-h-0 overflow-hidden'
                } lg:group-hover:max-h-[31vh] lg:group-hover:overflow-y-auto lg:group-hover:modern-scrollbar lg:max-h-0 lg:overflow-hidden`}
              >
                <ChatSessionsList {...chatSessionsListProps} />
                {hasMoreChatSessions && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLoadMore}
                    className={`w-full text-slate-600 hover:bg-slate-100 dark:text-gray-300 dark:hover:bg-gray-800 ${
                      !isOpen && 'px-2'
                    }`}
                    disabled={isLoadingMore}
                  >
                    {isLoadingMore ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      'Load More'
                    )}
                  </Button>
                )}
              </div>
            </div>
          ) : null}

          {/* Notes Categories Section */}
          {activeTab === 'notes' && (
            <div className="mt-6 mb-2 border-t border-slate-200 pt-4 dark:border-gray-700">
              {isOpen && (
                <div className="mb-2 lg:opacity-0 lg:group-hover:opacity-100 lg:transition-opacity lg:duration-300">
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
          className={`flex-shrink-0 border-t border-slate-200 p-4 dark:border-gray-700 transition-all duration-300 ease-in-out ${
            isOpen ? 'flex items-center gap-2' : 'flex justify-center'
          } lg:group-hover:flex lg:group-hover:items-center lg:group-hover:gap-2 lg:flex lg:justify-center`}
        >
          <AvatarMenu {...avatarMenuProps} />
          <UserAvatar {...userAvatarProps} />
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
    </>
  );
};