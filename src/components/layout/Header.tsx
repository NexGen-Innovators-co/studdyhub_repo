import React, { useState, useRef, useEffect } from 'react';
import {
  Search, Plus, Menu, Bell, LogOut, Users, TrendingUp, User, Home,
  Settings, BookOpen, Video, Calendar, MessageSquare, FileText,
  Sliders, LayoutDashboard, ChevronDown, Upload, Mic, Sparkles,
  Users2, MessageCircle, Loader2, Sun, Moon, Download, Play,
  History, BarChart3, Clipboard,
  Clock, Filter, X, Hash, Brain, Target, Trophy, Shield, Zap,
  Smartphone, CheckCircle, AlertCircle,
  MapPin,
  Lock,
  Podcast,
  Radio,
  School,
  Globe,
  Library,
  List,
  Image,
  Headphones,
  WifiOff
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { toast } from 'sonner';
import { ConfirmationModal } from '../ui/ConfirmationModal';
import { useAuth } from '@/hooks/useAuth';
import { useAppContext } from '@/hooks/useAppContext';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { PlanType } from '@/hooks/useSubscription';
import { Badge } from '../ui/badge';
import { SubscriptionGuard } from '../subscription/SubscriptionGuard';
import { NotificationCenter } from '../notifications/NotificationCenter';
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
    { id: 'recordings', label: 'Recordings', icon: Play },
    { id: 'notes', label: 'Notes', icon: FileText },
    {id: 'ai', label: 'AI Generated', icon: Sparkles },
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
  // notes: [
  //   // { id: 'all', label: 'All Notes', icon: BookOpen },
  //   // { id: 'favorites', label: 'Favorites', icon: Sparkles },
  //   // { id: 'recent', label: 'Recent', icon: Clock },
  //   // { id: 'archived', label: 'Archived', icon: FileText },
  // ],
  // chat: [
  //   // { id: 'all', label: 'All Chats', icon: MessageCircle },
  //   // { id: 'recent', label: 'Recent', icon: Clock },
  //   // { id: 'starred', label: 'Starred', icon: Sparkles },
  // ],
  // documents: [
  //   // { id: 'all', label: 'All Documents', icon: FileText },
  //   // { id: 'upload', label: 'Upload', icon: Upload },
  //   // { id: 'recent', label: 'Recent', icon: Clock },
  // ],
  schedule: [
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'upcoming', label: 'Upcoming', icon:  TrendingUp },
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
    { id: 'learning', label: 'Learning', icon: Brain },
    { id: 'goals', label: 'Goals', icon: Target },
    { id: 'achievements', label: 'Achievements', icon: Trophy },
    { id: 'study', label: 'Study', icon: Clock },
    { id: 'privacy', label: 'Privacy', icon: Shield },
    { id: 'security', label: 'Security', icon: Lock },
    {id:'notifications', label:'notifications', icon:Bell }
  ],
};

const getInitials = (name: string | null) => {
  if (!name) return 'U';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

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
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isPwaInstalled, setIsPwaInstalled] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const isOnline = useOnlineStatus();

  const avatarRef = useRef<HTMLDivElement>(null);
  const appMenuRef = useRef<HTMLDivElement>(null);

  // Handle outside clicks
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
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isAppMenuOpen, isAvatarMenuOpen]);

  // Check if PWA is already installed
  useEffect(() => {
    const checkPWAInstall = () => {
      // Check if running in standalone mode (installed PWA)
      if (window.matchMedia('(display-mode: standalone)').matches) {
        setIsPwaInstalled(true);
      }

      // TypeScript-safe check for iOS standalone mode
      const nav = window.navigator as any;
      if (nav.standalone === true) {
        setIsPwaInstalled(true);
      }
    };

    checkPWAInstall();
  }, []);

  // Listen for beforeinstallprompt event
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault();
      // Stash the event so it can be triggered later
      setDeferredPrompt(e);
      setShowInstallPrompt(true);

      // Update UI to notify user they can install
      toast.info('You can install StuddyHub as a mobile app!', {
        action: {
          label: 'Install',
          onClick: () => handleInstallApp(),
        },
      });
    };

    const handleAppInstalled = () => {
      setIsPwaInstalled(true);
      setShowInstallPrompt(false);
      setDeferredPrompt(null);
      toast.success('StuddyHub installed successfully! 🎉');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Listen for section tab changes
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

  // Handle Web App installation
  const handleInstallApp = async () => {
    if (!deferredPrompt) {
      // Show instructions for manual installation
      showInstallInstructions();
      return;
    }

    setIsInstalling(true);

    try {
      // Show the install prompt
      deferredPrompt.prompt();

      // Wait for the user to respond to the prompt
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        toast.success('Installing StuddyHub as a mobile app...');
        setIsPwaInstalled(true);
      } else {
        toast.info('Installation cancelled. You can install later from the menu.');
      }

      // Clear the deferred prompt
      setDeferredPrompt(null);
      setShowInstallPrompt(false);
    } catch (error) {
      // console.error('Error installing app:', error);
      toast.error('Failed to install app. Please try manual installation.');
      showInstallInstructions();
    } finally {
      setIsInstalling(false);
    }
  };

  // Show installation instructions
  const showInstallInstructions = () => {
    toast(
      <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        <h3 className="font-bold text-lg mb-2">Install StuddyHub on Mobile</h3>
        <div className="space-y-2 text-sm">
          <p className="flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-blue-500" />
            <strong>iOS (Safari):</strong> Tap Share → Add to Home Screen
          </p>
          <p className="flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-green-500" />
            <strong>Android (Chrome):</strong> Tap Menu → Install App
          </p>
          <p className="flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-purple-500" />
            <strong>Other Browsers:</strong> Look for "Install" in the menu
          </p>
        </div>
      </div>,
      {
        duration: 10000,
        position: 'bottom-center',
      }
    );
  };

  // Check if device is mobile
  const isMobileDevice = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  };

  // Handle section tab clicks
  const handleSectionTabClick = (tabId: string, path?: string) => {
    setActiveSectionTab(tabId);

    // Dispatch event to notify components
    window.dispatchEvent(
      new CustomEvent('section-tab-change', {
        detail: { section: activeTab, tab: tabId }
      })
    );

    // Handle navigation for social tabs
    if (activeTab === 'social' && path) {
      navigate(path);
    }
    
    // Handle navigation for podcasts (no path needed, handled by event listener)
    if (activeTab === 'podcasts') {
      // Just dispatch the event, PodcastsPage will handle the tab change
    }
  };
  
  useEffect(() => {
  // Podcasts tab sync
  if (activeTab === 'podcasts') {
    if (location.pathname === '/podcasts' || location.pathname === '/podcasts/discover') {
      setActiveSectionTab('discover');
    } else if (location.pathname.startsWith('/podcasts/my')) {
      setActiveSectionTab('my-podcasts');
    } else if (location.pathname.startsWith('/podcasts/live')) {
      setActiveSectionTab('live');
    }
  }
  // Social tab sync (already handled by socialActiveTab)
}, [activeTab, location.pathname]);

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
    chatSessions
  } = useAppContext();

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
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
              size="sm"
               variant='ghost'
            >
              <Plus className="h-4 w-4 mr-2" />
              <span className="hidden md:inline">New Note</span>
            </Button>
          </SubscriptionGuard>
        );
      // case 'recordings':
      //   return (
      //     <SubscriptionGuard
      //       feature="Class Recordings"
      //       limitFeature="maxRecordings"
      //       currentCount={recordings?.length || 0}
      //     >
      //       <Button
      //         onClick={() => onNewRecording?.()}
      //         className="bg-green-600 hover:bg-green-700"
      //         size="sm"
      //       >
      //         <Mic className="h-4 w-4 mr-2" />
      //         <span className="hidden md:inline">Record</span>
      //       </Button>
      //     </SubscriptionGuard>
      //   );
      case 'documents':
        return (
          <SubscriptionGuard
            feature="Documents"
            limitFeature="maxDocUploads"
            currentCount={documents?.length || 0}
          >
            <Button
              onClick={() => onUploadDocument?.()}
              className="bg-blue-600 hover:bg-blue-700"
              size="sm"
               variant='ghost'
            >
              <Upload className="h-4 w-4 mr-2" />
              <span className="hidden md:inline">Upload</span>
            </Button>
          </SubscriptionGuard>
        );
      // case 'schedule':
      //   return (
      //     <SubscriptionGuard
      //       feature="Schedule Items"
      //       limitFeature="maxScheduleItems"
      //       currentCount={scheduleItems?.length || 0}
      //     >
      //       <Button
      //         onClick={() => onNewSchedule?.()}
      //         className="bg-blue-600 hover:bg-blue-700"
      //         size="sm"
      //       >
      //         <Plus className="h-4 w-4 mr-2" />
      //         <span className="hidden md:inline">Add Event</span>
      //       </Button>
      //     </SubscriptionGuard>
      //   );
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
              className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700"
              size="sm"
               variant='ghost'
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              <span className="hidden md:inline">New Chat</span>
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
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
            size="sm"
            variant='ghost'
            disabled={!canCreatePosts}
            title={!canCreatePosts ? 'Upgrade to Scholar or Genius to create posts' : 'Create a new post'}
          >
            {!canCreatePosts && <Lock className="h-4 w-4 mr-2" />}
            <Plus className={!canCreatePosts ? '' : 'h-4 w-4 mr-2'} />
            <span className="hidden md:inline">Post</span>
          </Button>
        );
      case 'podcasts':
        return (
          <div className="flex gap-2">
            {/* <Button
              onClick={() => onGoLive?.()}
              variant="outline"
              size="sm"
              className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400"
            >
              <Radio className="h-4 w-4 mr-2" />
              <span className="hidden md:inline">Go Live</span>
            </Button> */}
            <Button
              onClick={() => onCreatePodcast?.()}
              className=" text-gray-600"
              size="sm"
              variant='ghost'
            >
             <Radio className="h-4 w-4 mr-2" />
              <span className="hidden md:inline">Create</span>
            </Button>
          </div>
        );
      default:
        return null;
    }
  };

  // Get current section tabs
  const currentSectionTabs = sectionTabs[activeTab as keyof typeof sectionTabs];
  const showSectionTabs = !!currentSectionTabs;

  // Determine active section tab for social
  const isSocialRoute = location.pathname.startsWith('/social');
  const socialActiveTab = isSocialRoute
    ? sectionTabs.social.find(tab =>
      location.pathname === tab.path ||
      (tab.path !== '/social' && location.pathname.startsWith(tab.path))
    )?.id || 'feed'
    : 'feed';

  const SubscriptionBadge = () => {
    if (subscriptionLoading) {
      return (
        <Badge variant="outline" className="animate-pulse text-xs sm:text-sm">
          Loading...
        </Badge>
      );
    }

    const tierConfig = {
      free: { label: 'Free', color: 'bg-gray-100 text-gray-800' },
      scholar: { label: 'Scholar', color: 'bg-blue-100 text-blue-800' },
      genius: { label: 'Genius', color: 'bg-amber-100 text-amber-800' },
    };

    const config = tierConfig[subscriptionTier];

    return (
      <button
        onClick={onNavigateToSubscription}
        className={`inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs font-medium ${config.color} hover:opacity-90 transition-opacity`}
      >
        {config.label}
        {subscriptionTier !== 'free' && daysRemaining > 0 && (
          <span className="ml-1 text-xs opacity-75">
            • {daysRemaining}d
          </span>
        )}
      </button>
    );
  };

  // Install App Button Component
  const InstallAppButton = () => {
    // Only show if installed or if installation is possible (prompt available)
    if (!isPwaInstalled && !deferredPrompt) return null;

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

  return (
    <>
      <header className="sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 z-50">
        {/* Main Header Row */}
        <div className="flex items-center justify-between min-h-16 px-3 sm:px-4 py-3 sm:py-0 gap-2 sm:gap-3">
          {/* Left: Toggle + App Menu + Title */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-shrink-0">
            <button onClick={onToggleSidebar} className="lg:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex-shrink-0">
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
                      onClick={() => {
                        handleNavigateToTab(tab);
                        setIsAppMenuOpen(false);
                      }}
                      className={`w-full px-4 py-3 flex items-center gap-3 transition-colors ${activeTab === tab
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                    >
                      <Icon className="h-5 w-5 flex-shrink-0" />
                      <span>{label}</span>
                      {activeTab === tab && <div className="ml-auto w-2 h-2 bg-blue-600 rounded-full flex-shrink-0" />}
                    </button>
                  ))}

                  {/* Install App in Menu */}
                  <div className="p-3 border-t border-slate-200 dark:border-slate-700">
                    <button
                      onClick={handleInstallApp}
                      disabled={isInstalling || isPwaInstalled}
                      className={`w-full px-4 py-3 flex items-center gap-3 transition-colors rounded-lg ${isPwaInstalled
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

          {/* Center: Section Tabs - Hidden on mobile */}
          <div className="flex-1 hidden lg:flex items-center justify-center px-2 xl:px-8 min-w-0">
            {showSectionTabs && (
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full p-2 overflow-x-auto scrollbar-hide">
                <div className="flex gap-1 min-w-max justify-center">
                  {currentSectionTabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === 'social'
                      ? socialActiveTab === tab.id
                      : activeSectionTab === tab.id;

                    return (
                      <Button
                        key={tab.id}
                        variant={isActive ? 'outline' : 'ghost'}
                        size="sm"
                        onClick={() => handleSectionTabClick(tab.id, tab.path)}
                        className={`${isActive
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

          {/* Right: Install App + Create Button + Notifications + Avatar */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            {/* Install App Button - Hidden on smaller screens */}
            <div className="hidden md:block">
              <InstallAppButton />
            </div>
            
            {/* Subscription Badge - Hidden on mobile */}
            <div className="hidden sm:block">
              <SubscriptionBadge />
            </div>

            {/* Offline Indicator in Header */}
            {!isOnline && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-destructive/10 text-destructive rounded-full border border-destructive/20 text-xs font-medium animate-pulse">
                <WifiOff className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Offline</span>
              </div>
            )}

            {/* Notification Center */}
            <NotificationCenter />

            {/* Create Button - Icons only on mobile */}
            <div className="truncate max-w-[60px] sm:max-w-[80px] md:max-w-none">
              {getPrimaryAction()}
            </div>

            {/* Avatar */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* {isAdmin && (
                <div className="hidden sm:flex items-center gap-1.5 bg-gradient-to-r from-purple-500 to-blue-600 text-white px-2.5 py-1 rounded-full text-xs font-semibold shadow-lg">
                  <Shield className="h-3.5 w-3.5" />
                  <span>Admin</span>
                </div>
              )} */}
              <div ref={avatarRef} className="relative">
                <button
                  onClick={() => setIsAvatarMenuOpen(!isAvatarMenuOpen)}
                  className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm hover:ring-4 hover:ring-blue-300 dark:hover:ring-blue-800 transition-all overflow-hidden shadow-lg flex-shrink-0"
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
                      {currentTheme === 'light' ? (
                        <Moon className="h-5 w-5 flex-shrink-0" />
                      ) : (
                        <Sun className="h-5 w-5 flex-shrink-0" />
                      )}
                      {currentTheme === 'light' ? 'Dark Mode' : 'Light Mode'}
                    </button>

                    {/* Install App in Avatar Menu */}
                    {!isPwaInstalled && (
                      <button
                        onClick={() => {
                          handleInstallApp();
                          setIsAvatarMenuOpen(false);
                        }}
                        disabled={isInstalling}
                        className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm sm:text-base"
                      >
                        {isInstalling ? (
                          <Loader2 className="h-5 w-5 animate-spin flex-shrink-0" />
                        ) : (
                          <Smartphone className="h-5 w-5 flex-shrink-0" />
                        )}
                        {isInstalling ? 'Installing...' : 'Install App'}
                      </button>
                    )}

                    <hr className="my-2 border-slate-200 dark:border-slate-700" />
                    <button
                      onClick={() => { setShowLogoutConfirm(true); setIsAvatarMenuOpen(false); }}
                      className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 text-sm sm:text-base"
                    >
                      {isLoggingOut ? <Loader2 className="h-5 w-5 animate-spin flex-shrink-0" /> : <LogOut className="h-5 w-5 flex-shrink-0" />}
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Section Tabs (for sections that have tabs) */}
        {showSectionTabs && (
          <div className="lg:hidden border-t border-slate-200 dark:border-slate-700">
            <div className="px-3 sm:px-4 py-2 overflow-x-auto">
              <div className="flex gap-2 min-w-max">
                {currentSectionTabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === 'social'
                    ? socialActiveTab === tab.id
                    : activeSectionTab === tab.id;

                  return (
                    <Button
                      key={tab.id}
                      variant={isActive ? 'outline' : 'ghost'}
                      size="sm"
                      onClick={() => handleSectionTabClick(tab.id, tab.path)}
                      className={`${isActive
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

      {/* Install Prompt Toast (when browser prompts) */}
      {showInstallPrompt && !isPwaInstalled && (
        <div className="fixed bottom-52 right-4 z-50 animate-in slide-in-from-bottom">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 p-4 max-w-sm">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                {isMobileDevice() ? (
                  <Smartphone className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                ) : (
                  <Download className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-lg">Install StuddyHub</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                  {isMobileDevice()
                    ? 'Install as a mobile app for better experience and offline access.'
                    : 'Install the app for better experience and offline access.'}
                </p>
                <div className="flex gap-2 mt-3">
                  <Button
                    onClick={handleInstallApp}
                    disabled={isInstalling}
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                    size="sm"
                  >
                    {isInstalling ? 'Installing...' : 'Install Now'}
                  </Button>
                  <Button
                    onClick={() => setShowInstallPrompt(false)}
                    variant="outline"
                    size="sm"
                  >
                    Later
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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