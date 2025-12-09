// src/components/layout/Header.tsx - Updated with SubscriptionGuard on all buttons
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
  Lock
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { toast } from 'sonner';
import { ConfirmationModal } from '../ui/ConfirmationModal';
import { useAuth } from '@/hooks/useAuth';
import { useAppContext } from '@/hooks/useAppContext';
import { PlanType } from '@/hooks/useSubscription';
import { Badge } from '../ui/badge';
import { SubscriptionGuard } from '../subscription/SubscriptionGuard';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onNewNote: () => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  activeTab: 'notes' | 'recordings' | 'schedule' | 'chat' | 'documents' | 'settings' | 'dashboard' | 'social' | 'quizzes';
  fullName: string | null;
  avatarUrl: string | null;
  socialSearchQuery: string;
  onSocialSearchChange: (query: string) => void;
  onOpenCreatePostDialog: () => void;
  onNewRecording?: () => void;
  onUploadDocument?: () => void;
  onNewSchedule?: () => void;
  onNewChat?: () => void;
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
  documents: 'Document Upload',
  settings: 'Learning Settings',
  dashboard: 'Dashboard',
  social: 'Social',
  quizzes: 'Quizzes'
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
    { id: 'history', label: 'History', icon: History },
  ],
  recordings: [
    { id: 'all', label: 'All Recordings', icon: FileText },
    { id: 'record', label: 'Record', icon: Mic },
    { id: 'upload', label: 'Upload', icon: Upload },
  ],
  notes: [
    // { id: 'all', label: 'All Notes', icon: BookOpen },
    // { id: 'favorites', label: 'Favorites', icon: Sparkles },
    // { id: 'recent', label: 'Recent', icon: Clock },
    // { id: 'archived', label: 'Archived', icon: FileText },
  ],
  chat: [
    // { id: 'all', label: 'All Chats', icon: MessageCircle },
    // { id: 'recent', label: 'Recent', icon: Clock },
    // { id: 'starred', label: 'Starred', icon: Sparkles },
  ],
  documents: [
    // { id: 'all', label: 'All Documents', icon: FileText },
    // { id: 'upload', label: 'Upload', icon: Upload },
    // { id: 'recent', label: 'Recent', icon: Clock },
  ],
  schedule: [
    { id: 'upcoming', label: 'Upcoming', icon: Calendar },
    { id: 'today', label: 'Today', icon: Clock },
    { id: 'past', label: 'Past', icon: History },
  ],
  dashboard: [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'activity', label: 'Activity', icon: TrendingUp },
  ],
  settings: [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'learning', label: 'Learning', icon: Brain },
    { id: 'goals', label: 'Goals', icon: Target },
    { id: 'achievements', label: 'Achievements', icon: Trophy },
    { id: 'study', label: 'Study', icon: Clock },
    { id: 'privacy', label: 'Privacy', icon: Shield },
    { id: 'security', label: 'Security', icon: Lock }
  ],
};

// Search placeholders for each section
const searchPlaceholders: Record<HeaderProps['activeTab'], string> = {
  notes: 'Search notes by title, content, or tags...',
  recordings: 'Search recordings by title, subject, or duration...',
  schedule: 'Search schedule items by title, subject, or location...',
  chat: 'Search chat messages or sessions...',
  documents: 'Search documents by name, type, or status...',
  settings: 'Search settings...',
  dashboard: 'Search dashboard...',
  social: 'Search posts, people, or groups...',
  quizzes: 'Search quizzes by title, subject, or difficulty...'
};

// Search filters for each section
const searchFilters: Record<HeaderProps['activeTab'], { id: string; label: string; icon?: React.ElementType }[]> = {
  notes: [
    { id: 'title', label: 'Title', icon: FileText },
    { id: 'content', label: 'Content', icon: BookOpen },
    { id: 'tags', label: 'Tags', icon: Hash },
  ],
  recordings: [
    { id: 'title', label: 'Title', icon: FileText },
    { id: 'subject', label: 'Subject', icon: BookOpen },
    { id: 'duration', label: 'Duration', icon: Clock },
  ],
  schedule: [
    { id: 'title', label: 'Title', icon: FileText },
    { id: 'subject', label: 'Subject', icon: BookOpen },
    { id: 'location', label: 'Location', icon: MapPin },
  ],
  chat: [
    { id: 'messages', label: 'Messages', icon: MessageSquare },
    { id: 'sessions', label: 'Sessions', icon: MessageCircle },
  ],
  documents: [
    { id: 'name', label: 'Name', icon: FileText },
    { id: 'type', label: 'Type', icon: Filter },
    { id: 'status', label: 'Status', icon: Clock },
  ],
  settings: [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'learning', label: 'Learning', icon: Brain },
    { id: 'security', label: 'Security', icon: Shield },
  ],
  dashboard: [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'activity', label: 'Activity', icon: TrendingUp },
  ],
  social: [
    { id: 'posts', label: 'Posts', icon: FileText },
    { id: 'people', label: 'People', icon: Users },
    { id: 'groups', label: 'Groups', icon: Users2 },
  ],
  quizzes: [
    { id: 'title', label: 'Title', icon: FileText },
    { id: 'subject', label: 'Subject', icon: BookOpen },
    { id: 'difficulty', label: 'Difficulty', icon: Target },
  ],
};

const getInitials = (name: string | null) => {
  if (!name) return 'U';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  onSearchChange,
  onNewNote,
  isSidebarOpen,
  onToggleSidebar,
  activeTab,
  fullName,
  avatarUrl,
  socialSearchQuery,
  onSocialSearchChange,
  onOpenCreatePostDialog,
  onNewRecording,
  onUploadDocument,
  onNewSchedule,
  onNewChat,
  currentTheme,
  onThemeChange,
  subscriptionTier,
  subscriptionLoading,
  daysRemaining,
  onNavigateToSubscription,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();
  const { handleNavigateToTab, createNewChatSession } = useAppContext();

  const [isAvatarMenuOpen, setIsAvatarMenuOpen] = useState(false);
  const [isAppMenuOpen, setIsAppMenuOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [activeSectionTab, setActiveSectionTab] = useState<string>('');
  const [showSearchFilters, setShowSearchFilters] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([]);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isPwaInstalled, setIsPwaInstalled] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  const avatarRef = useRef<HTMLDivElement>(null);
  const appMenuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

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

  // Close search filters when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchFilters(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Generate search suggestions based on active tab
  useEffect(() => {
    const generateSuggestions = () => {
      const suggestions: string[] = [];

      switch (activeTab) {
        case 'notes':
          suggestions.push('Recent notes', 'Study materials', 'Meeting notes', 'Lecture summaries');
          break;
        case 'recordings':
          suggestions.push('Class lectures', 'Meeting recordings', 'Interview prep', 'Language practice');
          break;
        case 'quizzes':
          suggestions.push('Math quiz', 'Science test', 'History review', 'Vocabulary practice');
          break;
        case 'schedule':
          suggestions.push('Today\'s classes', 'Upcoming exams', 'Study sessions', 'Group meetings');
          break;
        case 'chat':
          suggestions.push('AI tutor', 'Homework help', 'Concept explanation', 'Study tips');
          break;
        case 'documents':
          suggestions.push('PDF notes', 'Text files', 'Images', 'Presentations');
          break;
        case 'social':
          suggestions.push('Study groups', 'Learning tips', 'Resource sharing', 'Q&A');
          break;
        case 'dashboard':
          suggestions.push('Activity stats', 'Progress reports', 'Learning insights', 'Performance metrics');
          break;
        case 'settings':
          suggestions.push('Learning style', 'Notification settings', 'Privacy controls', 'Account preferences');
          break;
      }

      return suggestions;
    };

    setSearchSuggestions(generateSuggestions());
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
      console.error('Error installing app:', error);
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
              className="bg-gradient-to-r from-orange-500 to-blue-500 hover:from-orange-600 hover:to-blue-600"
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">New Note</span>
            </Button>
          </SubscriptionGuard>
        );
      case 'recordings':
        return (
          <SubscriptionGuard
            feature="Class Recordings"
            limitFeature="maxRecordings"
            currentCount={recordings?.length || 0}
          >
            <Button
              onClick={() => onNewRecording?.()}
              className="bg-green-600 hover:bg-green-700"
              size="sm"
            >
              <Mic className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Record</span>
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
              className="bg-blue-600 hover:bg-blue-700"
              size="sm"
            >
              <Upload className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Upload</span>
            </Button>
          </SubscriptionGuard>
        );
      case 'schedule':
        return (
          <SubscriptionGuard
            feature="Schedule Items"
            limitFeature="maxScheduleItems"
            currentCount={scheduleItems?.length || 0}
          >
            <Button
              onClick={() => onNewSchedule?.()}
              className="bg-blue-600 hover:bg-blue-700"
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Add Event</span>
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
              className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700"
              size="sm"
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">New Chat</span>
            </Button>
          </SubscriptionGuard>
        );
      case 'social':
        return (
          <SubscriptionGuard
            feature="Social Posts"
            limitFeature="canPostSocials"
            currentCount={0}
          >
            <Button
              onClick={onOpenCreatePostDialog}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Post</span>
            </Button>
          </SubscriptionGuard>
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

  // Get search placeholder for current tab
  const currentSearchPlaceholder = searchPlaceholders[activeTab];
  const currentFilters = searchFilters[activeTab];

  // Handle search with filters
  const handleSearchWithFilter = (query: string) => {
    if (activeTab === 'social') {
      onSocialSearchChange(query);
    } else {
      onSearchChange(query);
    }

    // Dispatch search event for components to listen to
    window.dispatchEvent(new CustomEvent('search-performed', {
      detail: { query, filter: activeFilter, section: activeTab }
    }));
  };

  // Handle suggestion click
  const handleSuggestionClick = (suggestion: string) => {
    handleSearchWithFilter(suggestion);
    setShowSearchFilters(false);
  };

  const SubscriptionBadge = () => {
    if (subscriptionLoading) {
      return (
        <Badge variant="outline" className="animate-pulse">
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
        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${config.color} hover:opacity-90 transition-opacity`}
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

  // Clear search
  const handleClearSearch = () => {
    if (activeTab === 'social') {
      onSocialSearchChange('');
    } else {
      onSearchChange('');
    }
    setActiveFilter('all');
    setShowSearchFilters(false);
  };

  // Enhanced search bar component
  const EnhancedSearchBar = () => (
    <div ref={searchRef} className="relative w-full max-w-2xl">
      <div className={`relative flex items-center bg-white dark:bg-slate-800 rounded-xl border transition-all duration-300 ${isSearchFocused ? 'border-blue-500 shadow-lg ring-2 ring-blue-500/20' : 'border-gray-300 dark:border-gray-600'}`}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 dark:text-gray-400" />

        <Input
          value={activeTab === 'social' ? socialSearchQuery : searchQuery}
          onChange={(e) => handleSearchWithFilter(e.target.value)}
          onFocus={() => setIsSearchFocused(true)}
          onBlur={() => setIsSearchFocused(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (activeTab === 'social' ? socialSearchQuery : searchQuery).trim()) {
              handleSearchWithFilter((activeTab === 'social' ? socialSearchQuery : searchQuery).trim());
              setShowSearchFilters(false);
            }
          }}
          placeholder={currentSearchPlaceholder}
          className="w-full pl-10 pr-24 border-0 focus:ring-0 h-10 bg-transparent"
        />

        <div className="absolute right-2 flex items-center gap-1">
          {(activeTab === 'social' ? socialSearchQuery : searchQuery) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearSearch}
              className="h-6 w-6 p-0 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <X className="h-4 w-4" />
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSearchFilters(!showSearchFilters)}
            className="h-6 px-2 text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white"
          >
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline ml-1 text-xs">Filter</span>
          </Button>
        </div>
      </div>

      {/* Search Filters Dropdown */}
      {showSearchFilters && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
          {/* Filters */}
          <div className="p-3 border-b border-gray-100 dark:border-gray-700">
            <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">SEARCH FILTERS</p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={activeFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveFilter('all')}
                className="text-xs"
              >
                All
              </Button>
              {currentFilters.map((filter) => (
                <Button
                  key={filter.id}
                  variant={activeFilter === filter.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveFilter(filter.id)}
                  className="text-xs"
                >
                  {filter.icon && <filter.icon className="h-3 w-3 mr-1" />}
                  {filter.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Suggestions */}
          <div className="p-3">
            <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">QUICK SUGGESTIONS</p>
            <div className="space-y-1">
              {searchSuggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 flex items-center gap-2"
                >
                  <Search className="h-3 w-3 text-gray-500" />
                  {suggestion}
                </button>
              ))}
            </div>
          </div>

          {/* Search Tips */}
          <div className="p-3 bg-gray-50 dark:bg-slate-900/50 border-t border-gray-100 dark:border-gray-700">
            <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">SEARCH TIPS</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Press Enter to search • Use filters for precise results • Try different keywords
            </p>
          </div>
        </div>
      )}
    </div>
  );

  // Install App Button Component
  const InstallAppButton = () => {
    if (isPwaInstalled) {
      return (
        <Button
          variant="outline"
          size="sm"
          className="hidden sm:inline-flex bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-200 dark:border-emerald-800 hover:from-green-500/20 hover:to-emerald-500/20 text-green-700 dark:text-emerald-200 rounded-full cursor-default"
          disabled
        >
          <CheckCircle className="h-4 w-4 mr-2" />
          Installed
        </Button>
      );
    }

    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handleInstallApp}
        disabled={isInstalling}
        className="hidden sm:inline-flex bg-gradient-to-r from-indigo-500/10 to-blue-500/10 border-indigo-200 dark:border-indigo-800 hover:from-indigo-500/20 hover:to-blue-500/20 text-indigo-700 dark:text-indigo-200 rounded-full"
      >
        {isInstalling ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : isMobileDevice() ? (
          <Smartphone className="h-4 w-4 mr-2" />
        ) : (
          <Download className="h-4 w-4 mr-2" />
        )}
        {isInstalling ? 'Installing...' : isMobileDevice() ? 'Add to Home' : 'Install App'}
      </Button>
    );
  };

  return (
    <>
      <header className="sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 z-50">
        <div className="flex items-center justify-between h-16 px-4">
          {/* Left: Toggle + App Menu + Title */}
          <div className="flex items-center gap-3">
            <button onClick={onToggleSidebar} className="lg:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
              <Menu className="h-5 w-5" />
            </button>

            {/* App Menu Dropdown */}
            <div ref={appMenuRef} className="relative hidden lg:block">
              <Button
                variant="ghost"
                onClick={() => setIsAppMenuOpen(!isAppMenuOpen)}
                className="flex items-center gap-2 font-medium"
              >
                <LayoutDashboard className="h-5 w-5" />
                <span>App</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${isAppMenuOpen ? 'rotate-180' : ''}`} />
              </Button>

              {isAppMenuOpen && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in slide-in-from-top-2 z-50">
                  <div className="p-3 border-b border-slate-200 dark:border-slate-700">
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
                      <Icon className="h-5 w-5" />
                      <span>{label}</span>
                      {activeTab === tab && <div className="ml-auto w-2 h-2 bg-blue-600 rounded-full" />}
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
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : isInstalling ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Download className="h-5 w-5" />
                      )}
                      <span>{isPwaInstalled ? 'App Installed' : isInstalling ? 'Installing...' : 'Install App'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <h1 className="text-lg font-bold hidden sm:block">{tabNames[activeTab]}</h1>
          </div>

          {/* Center: Search + Section Tabs */}
          <div className="flex-1 flex items-center justify-center px-4 lg:px-8">
            {showSectionTabs ? (
              <div className="hidden lg:flex items-center bg-slate-100 dark:bg-slate-800 rounded-full p-2 gap-3 w-full">
                {/* Search Bar */}
                <div className="relative flex-1">
                  <EnhancedSearchBar />
                </div>

                <div className="h-8 bg-slate-300 dark:bg-slate-600" />

                {/* Section Tabs */}
                <div className="flex gap-1">
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
                          } rounded-full`}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="hidden lg:inline ml-2">{tab.label}</span>
                      </Button>
                    );
                  })}
                </div>
              </div>
            ) : (
              // Universal search bar for all sections
              <div className="hidden lg:block w-full max-w-2xl">
                <EnhancedSearchBar />
              </div>
            )}
          </div>

          {/* Right: Install App + Create Button + Avatar */}
          <div className="flex items-center gap-3">
            {/* Install App Button */}
            <InstallAppButton />
            <SubscriptionBadge />
            {/* Create Button */}
            <div>
              {getPrimaryAction()}
            </div>

            {/* Avatar */}
            <div ref={avatarRef} className="relative">
              <button
                onClick={() => setIsAvatarMenuOpen(!isAvatarMenuOpen)}
                className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm hover:ring-4 hover:ring-blue-300 dark:hover:ring-blue-800 transition-all overflow-hidden shadow-lg"
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span>{getInitials(fullName)}</span>
                )}
              </button>

              {isAvatarMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in slide-in-from-top-2 z-50">
                  <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                    <p className="font-semibold truncate">{fullName || 'User'}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Active Learner</p>
                  </div>
                  <div className="py-2">
                    <button onClick={() => { navigate('/social/profile'); setIsAvatarMenuOpen(false); }} className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-slate-100 dark:hover:bg-slate-700">
                      <User className="h-5 w-5" /> My Profile
                    </button>
                    <button onClick={() => { navigate('/settings'); setIsAvatarMenuOpen(false); }} className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-slate-100 dark:hover:bg-slate-700">
                      <Settings className="h-5 w-5" /> Settings
                    </button>
                    <button
                      onClick={handleThemeToggle}
                      className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                      {currentTheme === 'light' ? (
                        <Moon className="h-5 w-5" />
                      ) : (
                        <Sun className="h-5 w-5" />
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
                        className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-slate-100 dark:hover:bg-slate-700"
                      >
                        {isInstalling ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <Smartphone className="h-5 w-5" />
                        )}
                        {isInstalling ? 'Installing...' : 'Install App'}
                      </button>
                    )}

                    <hr className="my-2 border-slate-200 dark:border-slate-700" />
                    <button
                      onClick={() => { setShowLogoutConfirm(true); setIsAvatarMenuOpen(false); }}
                      className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400"
                    >
                      {isLoggingOut ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogOut className="h-5 w-5" />}
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Section Tabs (for sections that have tabs) */}
        {showSectionTabs && (
          <div className="lg:hidden border-t border-slate-200 dark:border-slate-700">
            <div className="px-4 py-2 overflow-x-auto">
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
                        } rounded-full whitespace-nowrap`}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="ml-2">{tab.label}</span>
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Mobile Search (for sections without tabs) */}
        {!showSectionTabs && (
          <div className="lg:hidden border-t border-slate-200 dark:border-slate-700 px-4 py-2">
            <EnhancedSearchBar />
          </div>
        )}
      </header>

      {/* Install Prompt Toast (when browser prompts) */}
      {showInstallPrompt && !isPwaInstalled && (
        <div className="fixed bottom-52 right-4 z-50 animate-in slide-in-from-bottom">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 p-4 max-w-sm">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <Smartphone className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-lg">Install StuddyHub</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                  Install as a mobile app for better experience and offline access.
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