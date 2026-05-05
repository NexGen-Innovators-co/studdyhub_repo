import React, { useState, useRef, useEffect } from 'react';
import { Plus, Menu, Bell, LogOut, Users, TrendingUp, User, Home,
  Settings, BookOpen, Video, Calendar, MessageSquare, FileText,
  Sliders, LayoutDashboard, ChevronDown, Upload, Mic, Sparkles,
  Users2, MessageCircle, Loader2, Sun, Moon, Download, Play,
  History, BarChart3, Clipboard,
  Clock, Brain, Target, Trophy, Shield,
  Smartphone, CheckCircle,
  Lock,
  Podcast,
  Radio,
  School,
  Globe,
  Library,
  Image,
  Headphones,
  WifiOff,
  GraduationCap } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '../../ui/components/button';

import { toast } from 'sonner';
import { ConfirmationModal } from '../../ui/components/ConfirmationModal';
import { useAuth } from '@/hooks/useAuth';
import { useAppContext } from '@/hooks/useAppContext';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { PlanType } from '@/hooks/useSubscription';
import { Badge } from '../../ui/components/badge';
import { SubscriptionGuard } from '../../subscription/components/SubscriptionGuard';
import { NotificationCenter } from '../../notifications/components/NotificationCenter';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

interface HeaderProps {
  onNewNote: () => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  activeTab: 'notes' | 'recordings' | 'schedule' | 'chat' | 'documents' | 'settings' | 'dashboard' | 'social' | 'quizzes' | 'podcasts' | 'library';
  fullName: string | null;
  avatarUrl: string | null;
  onOpenCreatePostDialog: () => void;
  onNewRecording?: () => void;
  onUploadDocument?: () => void;
  onNewSchedule?: () => void;
  onNewChat?: () => void;
  onGoLive?: () => void;
  onCreatePodcast?: () => void;
  currentTheme: 'light' | 'dark';
  onThemeChange: (theme: 'light' | 'dark') => void;
  subscriptionTier: PlanType;
  subscriptionLoading: boolean;
  daysRemaining: number;
  onNavigateToSubscription: () => void;
}

const tabNames: Record<HeaderProps['activeTab'], string> = {
  notes: 'Notes',
  recordings: 'Class Recordings',
  schedule: 'Schedule & Timetable',
  chat: 'AI Study Assistant',
  podcasts: 'AI Podcasts',
  documents: 'Document Upload',
  settings: 'Learning Settings',
  dashboard: 'Dashboard',
  social: 'Social',
  quizzes: 'Quizzes',
  library: 'Course Library'
};

const mainNavItems = [
  { label: 'Dashboard', icon: LayoutDashboard, tab: 'dashboard' },
  { label: 'Notes', icon: BookOpen, tab: 'notes' },
  { label: 'Recordings', icon: Video, tab: 'recordings' },
  { label: 'Schedule', icon: Calendar, tab: 'schedule' },
  { label: 'AI Chat', icon: MessageSquare, tab: 'chat' },
  { label: 'Documents', icon: FileText, tab: 'documents' },
  { label: 'Quizzes', icon: Sparkles, tab: 'quizzes' },
  { label: 'Social', icon: Users2, tab: 'social' },
  { label: 'Settings', icon: Sliders, tab: 'settings' },
  { label: 'Podcasts', icon: Podcast, tab: 'podcasts' },
  { label: 'Library', icon: Clipboard, tab: 'library' },
] as const;

// Define section-specific tabs
const sectionTabs = {
  social: [
    { id: 'feed', label: 'Feed', icon: Home, path: '/social' },
    { id: 'trending', label: 'Trending', icon: TrendingUp, path: '/social/trending' },
    { id: 'groups', label: 'Groups', icon: Users, path: '/social/groups' },
    { id: 'notifications', label: 'Notifications', icon: Bell, path: '/social/notifications' },
    { id: 'profile', label: 'Profile', icon: User, path: '/social/profile' },
  ],
  quizzes: [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'live', label: 'Live', icon: Users2 },
    { id: 'recordings', label: 'Recordings', icon: Play },
    { id: 'notes', label: 'Notes', icon: FileText },
    { id: 'ai', label: 'AI Generated', icon: Sparkles },
    { id: 'history', label: 'History', icon: History },
  ],
  recordings: [
    { id: 'all', label: 'All Recordings', icon: FileText },
    { id: 'record', label: 'Record', icon: Mic },
    { id: 'upload', label: 'Upload', icon: Upload },
  ],
  podcasts: [
    { id: 'discover', label: 'Discover', icon: TrendingUp },
    { id: 'my-podcasts', label: 'My Podcasts', icon: Podcast },
    { id: 'live', label: 'Live Now', icon: Radio },
    { id: 'audio', label: 'Audio', icon: Headphones },
    { id: 'video', label: 'Video', icon: Video },
    { id: 'image-audio', label: 'Image + Audio', icon: Image },
  ],
  schedule: [
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'upcoming', label: 'Upcoming', icon: TrendingUp },
    { id: 'today', label: 'Today', icon: Clock },
    { id: 'past', label: 'Past', icon: History },
  ],
  dashboard: [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'activity', label: 'Activity', icon: TrendingUp },
  ],
  library: [
    { id: 'my-school', label: 'My School', icon: School },
    { id: 'global', label: 'Global', icon: Globe },
    { id: 'all', label: 'Browse All', icon: Library },
  ],
  settings: [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'education', label: 'Education', icon: GraduationCap },
    { id: 'learning', label: 'Learning', icon: Brain },
    { id: 'personalization', label: 'AI Context', icon: Sparkles },
    { id: 'goals', label: 'Goals', icon: Target },
    { id: 'achievements', label: 'Achievements', icon: Trophy },
    { id: 'privacy', label: 'Privacy', icon: Shield },
    { id: 'security', label: 'Security', icon: Lock },
    { id: 'notifications', label: 'notifications', icon: Bell },
  ],
};

const getInitials = (name: string | null) => {
  if (!name) return 'U';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

// ─── Global PWA prompt store ──────────────────────────────────────────────────
// beforeinstallprompt fires exactly once per page load. By stashing it on
// window.__pwaPrompt we share it across any component that mounts later
// (e.g. Header mounts after AppHeader already captured the event on the
// landing page).
const getPwaPrompt = (): any => (window as any).__pwaPrompt ?? null;
const setPwaPrompt = (val: any) => { (window as any).__pwaPrompt = val; };

export const Header: React.FC<HeaderProps> = ({
  onNewNote,
  isSidebarOpen,
  onToggleSidebar,
  activeTab,
  fullName,
  avatarUrl,
  onOpenCreatePostDialog,
  onNewRecording,
  onUploadDocument,
  onNewSchedule,
  onNewChat,
  onGoLive,
  onCreatePodcast,
  currentTheme,
  onThemeChange,
  subscriptionTier,
  subscriptionLoading,
  daysRemaining,
  onNavigateToSubscription,
}) => {
  const navigate = useNavigate();
  const { isAdmin, canPostSocials } = useFeatureAccess();
  const canCreatePosts = canPostSocials();
  const location = useLocation();
  const { signOut } = useAuth();
  const { handleNavigateToTab, createNewChatSession } = useAppContext();

  const [isAvatarMenuOpen, setIsAvatarMenuOpen] = useState(false);
  const [isAppMenuOpen, setIsAppMenuOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [activeSectionTab, setActiveSectionTab] = useState<string>('');
  const [isInstalling, setIsInstalling] = useState(false);
  const [isPwaInstalled, setIsPwaInstalled] = useState(false);
  // Local prompt ref — used when Header itself catches beforeinstallprompt
  // (e.g. user navigates directly to the dashboard without visiting landing page)
  const localPromptRef = useRef<any>(null);
  const isOnline = useOnlineStatus();

  const avatarRef = useRef<HTMLDivElement>(null);
  const appMenuRef = useRef<HTMLDivElement>(null);

  // ── Outside click handler ────────────────────────────────────────────────
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (appMenuRef.current && !appMenuRef.current.contains(event.target as Node)) {
        setIsAppMenuOpen(false);
      }
      if (avatarRef.current && !avatarRef.current.contains(event.target as Node)) {
        setIsAvatarMenuOpen(false);
      }
    };
    if (isAppMenuOpen || isAvatarMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => { document.removeEventListener('mousedown', handleClickOutside); };
  }, [isAppMenuOpen, isAvatarMenuOpen]);

  // ── PWA install state ────────────────────────────────────────────────────
  useEffect(() => {
    // Already installed?
    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      (window as any).__pwaInstalled === true  
    ) {
      setIsPwaInstalled(true);
    }

    // If Header is the first component to see beforeinstallprompt (direct
    // dashboard navigation, no landing page visit), stash the prompt both
    // locally and globally.
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      localPromptRef.current = e;
      setPwaPrompt(e); // share globally for any other component
    };

    const onAppInstalled = () => {
      setIsPwaInstalled(true);
      localPromptRef.current = null;
      setPwaPrompt(null);
      toast.success('StuddyHub installed successfully! 🎉');
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  // ── Section tab sync ─────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.section === activeTab && detail?.tab) {
        setActiveSectionTab(detail.tab);
      }
    };
    window.addEventListener('section-tab-active', handler as EventListener);
    return () => window.removeEventListener('section-tab-active', handler as EventListener);
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'podcasts') {
      if (location.pathname === '/podcasts' || location.pathname === '/podcasts/discover') {
        setActiveSectionTab('discover');
      } else if (location.pathname.startsWith('/podcasts/my')) {
        setActiveSectionTab('my-podcasts');
      } else if (location.pathname.startsWith('/podcasts/live')) {
        setActiveSectionTab('live');
      }
    }
  }, [activeTab, location.pathname]);

  // ── PWA install handler ──────────────────────────────────────────────────
  // Resolution order:
  //   1. Local ref (Header caught beforeinstallprompt directly)
  //   2. window.__pwaPrompt (AppHeader / LayoutComponents caught it first)
  const handleInstallApp = async () => {
    if (isInstalling) {
      toast.info('Installation in progress...');
      return;
    }

    const prompt = localPromptRef.current ?? getPwaPrompt();

    if (!prompt) {
      // No native prompt available — show manual instructions
      toast(
        <div className="p-4">
          <h3 className="font-bold text-lg mb-2">Install StuddyHub</h3>
          <div className="space-y-2 text-sm">
            <p><strong>iOS (Safari):</strong> Tap Share → Add to Home Screen</p>
            <p><strong>Android (Chrome):</strong> Tap Menu → Install App</p>
          </div>
        </div>,
        { duration: 8000, position: 'bottom-center' }
      );
      return;
    }

    setIsInstalling(true);
    try {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === 'accepted') {
        toast.success('StuddyHub installed successfully!');
        setIsPwaInstalled(true);
      } else {
        toast.info('Installation cancelled. You can install later from the menu.');
      }
    } catch (err) {
      // console.error('PWA install error:', err);
      toast.error('Failed to install. Please use your browser\'s "Add to Home Screen" option.');
    } finally {
      setIsInstalling(false);
      localPromptRef.current = null;
      setPwaPrompt(null);
    }
  };

  // ── Helpers ──────────────────────────────────────────────────────────────
  const isMobileDevice = () =>
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  const handleSectionTabClick = (tabId: string, path?: string) => {
    setActiveSectionTab(tabId);
    window.dispatchEvent(
      new CustomEvent('section-tab-change', { detail: { section: activeTab, tab: tabId } })
    );
    if (activeTab === 'social' && path) navigate(path);
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
      toast.success('Signed out successfully');
      navigate('/');
    } catch {
      toast.error('Failed to sign out');
    } finally {
      setIsLoggingOut(false);
      setShowLogoutConfirm(false);
    }
  };

  const handleThemeToggle = () => {
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    onThemeChange(newTheme);
    toast.success(`Switched to ${newTheme} mode`);
  };

  const {
    notes,
    recordings,
    documents,
    scheduleItems,
    chatSessions,
  } = useAppContext();

  // ── Primary action button per tab ────────────────────────────────────────
  const getPrimaryAction = () => {
    switch (activeTab) {
      case 'notes':
        return (
          <SubscriptionGuard
            feature="Notes"
            limitFeature="maxNotes"
            currentCount={notes?.length || 0}
            message="You've reached the limit of notes for your plan."
          >
            <Button
              onClick={onNewNote}
              size="sm"
              variant="ghost"
              className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              title="New Note"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </SubscriptionGuard>
        );
      case 'documents':
        return (
          <SubscriptionGuard
            feature="Documents"
            limitFeature="maxDocUploads"
            currentCount={documents?.length || 0}
          >
            <Button
              onClick={() => onUploadDocument?.()}
              size="sm"
              variant="ghost"
              className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              title="Upload Document"
            >
              <Upload className="h-4 w-4" />
            </Button>
          </SubscriptionGuard>
        );
      case 'chat':
        return (
          <SubscriptionGuard
            feature="Chat Sessions"
            limitFeature="maxChatSessions"
            currentCount={chatSessions?.length || 0}
          >
            <Button
              onClick={async () => {
                const id = await createNewChatSession?.();
                if (id) navigate(`/chat/${id}`);
              }}
              size="sm"
              variant="ghost"
              className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              title="New Chat"
            >
              <MessageCircle className="h-4 w-4" />
            </Button>
          </SubscriptionGuard>
        );
      case 'social':
        return (
          <Button
            onClick={() => {
              if (!canCreatePosts) {
                toast.error('Posts are available for Scholar and Genius plans');
                return;
              }
              onOpenCreatePostDialog();
            }}
            size="sm"
            variant="ghost"
            disabled={!canCreatePosts}
            className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
            title={!canCreatePosts ? 'Upgrade to Scholar or Genius to create posts' : 'Create a new post'}
          >
            {!canCreatePosts ? (
              <Lock className="h-4 w-4" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
          </Button>
        );
      case 'podcasts':
        return (
          <Button
            onClick={() => onCreatePodcast?.()}
            size="sm"
            variant="ghost"
            className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            title="Create Podcast"
          >
            <Radio className="h-4 w-4" />
          </Button>
        );
      default:
        return null;
    }
  };

  // ── Section tab config ───────────────────────────────────────────────────
  const currentSectionTabs = sectionTabs[activeTab as keyof typeof sectionTabs];
  const showSectionTabs = !!currentSectionTabs;

  const isSocialRoute = location.pathname.startsWith('/social');
  const socialActiveTab = isSocialRoute
    ? sectionTabs.social.find(
        tab =>
          location.pathname === tab.path ||
          (tab.path !== '/social' && location.pathname.startsWith(tab.path))
      )?.id || 'feed'
    : 'feed';

  // ── Sub-components ───────────────────────────────────────────────────────
  const SubscriptionBadge = () => {
    if (subscriptionLoading) {
      return (
        <Badge variant="outline" className="animate-pulse text-xs sm:text-sm">
          Loading...
        </Badge>
      );
    }
    const tierConfig = {
      free:    { label: 'Free',    color: 'bg-gray-100 text-gray-800' },
      scholar: { label: 'Scholar', color: 'bg-blue-100 text-blue-800' },
      genius:  { label: 'Genius',  color: 'bg-amber-100 text-amber-800' },
    };
    const config = tierConfig[subscriptionTier];
    return (
      <button
        onClick={onNavigateToSubscription}
        className={`inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs font-medium ${config.color} hover:opacity-90 transition-opacity`}
      >
        {config.label}
        {subscriptionTier !== 'free' && daysRemaining > 0 && (
          <span className="ml-1 text-xs opacity-75">• {daysRemaining}d</span>
        )}
      </button>
    );
  };

  // Show "Install App" button only when a prompt is available (either locally
  // captured or carried over from AppHeader via window.__pwaPrompt).
  const hasInstallPrompt = !isPwaInstalled && (!!localPromptRef.current || !!getPwaPrompt());

  const InstallAppButton = () => {
    if (isPwaInstalled) {
      return (
        <Button
          variant="outline"
          size="sm"
          className="hidden md:inline-flex bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-200 dark:border-emerald-800 hover:from-green-500/20 hover:to-emerald-500/20 text-green-700 dark:text-emerald-200 rounded-full cursor-default text-xs sm:text-sm"
          disabled
        >
          <CheckCircle className="h-4 w-4 mr-2 flex-shrink-0" />
          <span className="hidden xl:inline">Installed</span>
        </Button>
      );
    }
    if (!hasInstallPrompt) return null;
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handleInstallApp}
        disabled={isInstalling}
        className="hidden md:inline-flex bg-gradient-to-r from-indigo-500/10 to-blue-500/10 border-indigo-200 dark:border-indigo-800 hover:from-indigo-500/20 hover:to-blue-500/20 text-indigo-700 dark:text-indigo-200 rounded-full text-xs sm:text-sm"
      >
        {isInstalling ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin flex-shrink-0" />
        ) : isMobileDevice() ? (
          <Smartphone className="h-4 w-4 mr-2 flex-shrink-0" />
        ) : (
          <Download className="h-4 w-4 mr-2 flex-shrink-0" />
        )}
        <span className="lg:inline hidden xl:inline">
          {isInstalling ? 'Installing...' : isMobileDevice() ? 'Add to Home' : 'Install App'}
        </span>
      </Button>
    );
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      <header className="bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 relative">
        {/* Main Header Row */}
        <div className="flex items-center justify-between min-h-16 px-3 sm:px-4 py-3 sm:py-0 gap-2 sm:gap-3">

          {/* Left: Toggle + App Menu + Title */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-shrink-0">
            <button
              type="button"
              onClick={onToggleSidebar}
              className="lg:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex-shrink-0 cursor-pointer touch-manipulation"
              aria-label="Toggle sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* App Menu Dropdown */}
            <div ref={appMenuRef} className="relative hidden lg:block flex-shrink-0">
              <Button
                variant="ghost"
                onClick={() => setIsAppMenuOpen(!isAppMenuOpen)}
                className="flex items-center gap-2 font-medium px-2 sm:px-4"
              >
                <LayoutDashboard className="h-5 w-5 flex-shrink-0" />
                <span className="hidden sm:inline">App</span>
                <ChevronDown className={`h-4 w-4 transition-transform flex-shrink-0 ${isAppMenuOpen ? 'rotate-180' : ''}`} />
              </Button>

              {isAppMenuOpen && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in slide-in-from-top-2 z-50 max-h-[80vh] overflow-y-auto modern-scrollbar">
                  <div className="p-3 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10">
                    <p className="font-semibold">Quick Navigation</p>
                  </div>
                  {mainNavItems.map(({ label, icon: Icon, tab }) => (
                    <button
                      key={tab}
                      onClick={() => { handleNavigateToTab(tab); setIsAppMenuOpen(false); }}
                      className={`w-full px-4 py-3 flex items-center gap-3 transition-colors ${
                        activeTab === tab
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      <Icon className="h-5 w-5 flex-shrink-0" />
                      <span>{label}</span>
                      {activeTab === tab && <div className="ml-auto w-2 h-2 bg-blue-600 rounded-full flex-shrink-0" />}
                    </button>
                  ))}

                  {/* Educator Portal */}
                  <div className="border-t border-slate-200 dark:border-slate-700">
                    <button
                      onClick={() => { navigate('/educator'); setIsAppMenuOpen(false); }}
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                      <GraduationCap className="h-5 w-5 flex-shrink-0 text-blue-500" />
                      <span>Educator Portal</span>
                    </button>
                  </div>

                  {/* Install App in menu */}
                  <div className="p-3 border-t border-slate-200 dark:border-slate-700">
                    <button
                      onClick={() => { handleInstallApp(); setIsAppMenuOpen(false); }}
                      disabled={isInstalling || isPwaInstalled}
                      className={`w-full px-4 py-3 flex items-center gap-3 transition-colors rounded-lg ${
                        isPwaInstalled
                          ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 cursor-default'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      {isPwaInstalled ? (
                        <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                      ) : isInstalling ? (
                        <Loader2 className="h-5 w-5 animate-spin flex-shrink-0" />
                      ) : (
                        <Download className="h-5 w-5 flex-shrink-0" />
                      )}
                      <span>{isPwaInstalled ? 'App Installed' : isInstalling ? 'Installing...' : 'Install App'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <h1 className="text-sm sm:text-lg font-bold hidden sm:block truncate">{tabNames[activeTab]}</h1>
          </div>

          {/* Center: Section Tabs — desktop only */}
          <div className="flex-1 hidden lg:flex items-center justify-center px-2 xl:px-8 min-w-0">
            {showSectionTabs && (
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full p-2 overflow-x-auto scrollbar-hide">
                <div className="flex gap-1 min-w-max justify-center">
                  {currentSectionTabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive =
                      activeTab === 'social' ? socialActiveTab === tab.id : activeSectionTab === tab.id;
                    return (
                      <Button
                        key={tab.id}
                        variant={isActive ? 'outline' : 'ghost'}
                        size="sm"
                        onClick={() => handleSectionTabClick(tab.id, (tab as any).path)}
                        className={`${
                          isActive
                            ? 'text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-700'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                        } rounded-full whitespace-nowrap text-sm flex-shrink-0`}
                        title={tab.label}
                      >
                        <Icon className="h-4 w-4 flex-shrink-0" />
                        <span className="ml-2 truncate hidden lg:inline max-w-[120px]">{tab.label}</span>
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right: Install + Badge + Offline + Notifications + Action + Avatar */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <div className="hidden md:block">
              <InstallAppButton />
            </div>

            <div className="hidden sm:block">
              <SubscriptionBadge />
            </div>

            {/* Mobile subscription indicator */}
            <div className="sm:hidden">
              <button
                onClick={onNavigateToSubscription}
                className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold transition-colors ${
                  subscriptionTier === 'genius' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                  subscriptionTier === 'scholar' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                  'bg-gray-100 text-gray-800 border-gray-200'
                }`}
                title="Subscription Plan"
              >
                {subscriptionTier === 'genius' ? 'G' : subscriptionTier === 'scholar' ? 'S' : 'F'}
              </button>
            </div>

            {!isOnline && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-destructive/10 text-destructive rounded-full border border-destructive/20 text-xs font-medium animate-pulse">
                <WifiOff className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Offline</span>
              </div>
            )}

            <NotificationCenter />

            <div className="truncate max-w-[60px] sm:max-w-[80px] md:max-w-none">
              {getPrimaryAction()}
            </div>

            {/* Avatar */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <div ref={avatarRef} className="relative">
                <button
                  onClick={() => setIsAvatarMenuOpen(!isAvatarMenuOpen)}
                  className={`w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm hover:ring-4 transition-all overflow-hidden shadow-lg flex-shrink-0 ${
                    subscriptionTier === 'genius' ? 'ring-2 ring-amber-400 dark:ring-amber-500' :
                    subscriptionTier === 'scholar' ? 'ring-2 ring-blue-400 dark:ring-blue-500' :
                    'hover:ring-blue-300 dark:hover:ring-blue-800'
                  }`}
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span>{getInitials(fullName)}</span>
                  )}
                </button>
                {isAdmin && (
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-purple-600 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900">
                    <Shield className="h-3 w-3 text-white" />
                  </div>
                )}

                {isAvatarMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 sm:w-64 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in slide-in-from-top-2 z-50 max-h-[80vh] overflow-y-auto modern-scrollbar">
                    <div className="p-4 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10">
                      <p className="font-semibold truncate">{fullName || 'User'}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Active Learner</p>
                    </div>
                    <div className="py-2">
                      <button onClick={() => { navigate('/social/profile'); setIsAvatarMenuOpen(false); }} className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm sm:text-base">
                        <User className="h-5 w-5 flex-shrink-0" /> My Profile
                      </button>
                      <button onClick={() => { navigate('/podcasts'); setIsAvatarMenuOpen(false); }} className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm sm:text-base">
                        <Podcast className="h-5 w-5 flex-shrink-0" /> Podcasts
                      </button>
                      <button onClick={() => { onGoLive?.(); setIsAvatarMenuOpen(false); }} className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 text-sm sm:text-base">
                        <Radio className="h-5 w-5 flex-shrink-0" /> Go Live
                      </button>
                      <button onClick={() => { navigate('/settings'); setIsAvatarMenuOpen(false); }} className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm sm:text-base">
                        <Settings className="h-5 w-5 flex-shrink-0" /> Settings
                      </button>
                      {isAdmin && (
                        <button onClick={() => { navigate('/admin'); setIsAvatarMenuOpen(false); }} className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-purple-50 dark:hover:bg-purple-900/20 text-purple-600 dark:text-purple-400 text-sm sm:text-base">
                          <Shield className="h-5 w-5 flex-shrink-0" /> Admin Panel
                        </button>
                      )}
                      <button
                        onClick={handleThemeToggle}
                        className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm sm:text-base"
                      >
                        {currentTheme === 'light'
                          ? <Moon className="h-5 w-5 flex-shrink-0" />
                          : <Sun className="h-5 w-5 flex-shrink-0" />}
                        {currentTheme === 'light' ? 'Dark Mode' : 'Light Mode'}
                      </button>

                      {/* Install App in avatar menu */}
                      {!isPwaInstalled && (
                        <button
                          onClick={() => { handleInstallApp(); setIsAvatarMenuOpen(false); }}
                          disabled={isInstalling}
                          className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm sm:text-base"
                        >
                          {isInstalling
                            ? <Loader2 className="h-5 w-5 animate-spin flex-shrink-0" />
                            : <Smartphone className="h-5 w-5 flex-shrink-0" />}
                          {isInstalling ? 'Installing...' : 'Install App'}
                        </button>
                      )}

                      <hr className="my-2 border-slate-200 dark:border-slate-700" />
                      <button
                        onClick={() => { setShowLogoutConfirm(true); setIsAvatarMenuOpen(false); }}
                        className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 text-sm sm:text-base"
                      >
                        {isLoggingOut
                          ? <Loader2 className="h-5 w-5 animate-spin flex-shrink-0" />
                          : <LogOut className="h-5 w-5 flex-shrink-0" />}
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Section Tabs */}
        {showSectionTabs && (
          <div className="lg:hidden border-t border-slate-200 dark:border-slate-700">
            <div className="px-3 sm:px-4 py-2 overflow-x-auto">
              <div className="flex gap-2 min-w-max">
                {currentSectionTabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive =
                    activeTab === 'social' ? socialActiveTab === tab.id : activeSectionTab === tab.id;
                  return (
                    <Button
                      key={tab.id}
                      variant={isActive ? 'outline' : 'ghost'}
                      size="sm"
                      onClick={() => handleSectionTabClick(tab.id, (tab as any).path)}
                      className={`${
                        isActive
                          ? 'text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-700'
                          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                      } rounded-full whitespace-nowrap text-xs sm:text-sm truncate`}
                      title={tab.label}
                    >
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      <span className="ml-2 hidden lg:inline truncate max-w-[100px]">{tab.label}</span>
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </header>

      <ConfirmationModal
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={handleLogout}
        title="Sign Out"
        message="Are you sure you want to sign out?"
      />
    </>
  );
};