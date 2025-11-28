// src/components/layout/Header.tsx
import React, { useCallback, useState, useRef, useEffect } from 'react';
import { 
  Search, Plus, Menu, Bell, LogOut, Loader2, Users, TrendingUp, User, Home, 
  Settings, LogOutIcon, BookOpen, Video, Calendar, MessageSquare, FileText, 
  Sliders, LayoutDashboard, Share2, ChevronDown, Download, Upload, 
  Mic, VideoIcon, Clock, BookMarked, Bot, MessageCircle,
  Users2,
  Sparkles
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import BookPagesAnimation from '../ui/bookloader';
import { toast } from 'sonner';
import { ConfirmationModal } from '../ui/ConfirmationModal';
import { useAuth } from '@/hooks/useAuth';

// Local Button & Input (keep your working versions)
const Button = ({ className = '', variant = 'default', size = 'default', children, ...props }: any) => {
  const base = 'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';
  const variants = {
    default: 'bg-blue-600 text-white hover:bg-blue-700 shadow-md',
    ghost: 'bg-transparent hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 shadow-none',
  };
  const sizes = {
    default: 'h-10 py-2 px-4',
    sm: 'h-8 px-3 text-sm',
    lg: 'h-11 px-8',
  };

  return (
    <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {children}
    </button>
  );
};

const Input = ({ className = '', ...props }: any) => (
  <input
    className={`flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 dark:ring-offset-slate-950 ${className}`}
    {...props}
  />
);

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onNewNote: () => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  activeTab: 'notes' | 'recordings' | 'schedule' | 'chat' | 'documents' | 'settings' | 'dashboard' | 'social'|'quizzes';
  fullName: string | null;
  avatarUrl: string | null;
  socialSearchQuery: string;
  onSocialSearchChange: (query: string) => void;
  onOpenCreatePostDialog: () => void;
  // New props for different sections
  onNewRecording?: () => void;
  onUploadDocument?: () => void;
  onNewSchedule?: () => void;
  onNewChat?: () => void;
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

const getInitials = (name: string | null) => {
  if (!name) return 'U';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

// Main navigation items for app routes
const mainNavItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard', tab: 'dashboard' },
  { label: 'Notes', icon: BookOpen, path: '/notes', tab: 'notes' },
  { label: 'Recordings', icon: Video, path: '/recordings', tab: 'recordings' },
  { label: 'Schedule', icon: Calendar, path: '/schedule', tab: 'schedule' },
  { label: 'AI Assistant', icon: MessageSquare, path: '/chat', tab: 'chat' },
  { label: 'Documents', icon: FileText, path: '/documents', tab: 'documents' },
  { label: 'Settings', icon: Sliders, path: '/settings', tab: 'settings' },
  { label: 'Social', icon: Users2, path: '/social', tab: 'social' },
  { label: 'Quizzes', icon: Sparkles, path: '/quizzes', tab: 'quizzes' },
];

// Social navigation items
const socialNavItems = [
  { label: 'Home', icon: Home, path: '/social/feed' },
  { label: 'Trending', icon: TrendingUp, path: '/social/trending' },
  { label: 'Groups', icon: Users, path: '/social/groups' },
  { label: 'Notifications', icon: Bell, path: '/social/notifications' },
  { label: 'Profile', icon: User, path: '/social/profile' },
];

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
}) => {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isAvatarMenuOpen, setIsAvatarMenuOpen] = useState(false);
  const [isAppMenuOpen, setIsAppMenuOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const avatarRef = useRef<HTMLDivElement>(null);
  const appMenuRef = useRef<HTMLDivElement>(null);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) {
        setIsAvatarMenuOpen(false);
      }
      if (appMenuRef.current && !appMenuRef.current.contains(e.target as Node)) {
        setIsAppMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
      toast.success('Signed out successfully');
      navigate('/');
    } catch (err) {
      toast.error('Failed to sign out');
    } finally {
      setIsLoggingOut(false);
      setShowLogoutConfirm(false);
      setIsAvatarMenuOpen(false);
    }
  };

  const handleSocialSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    onSocialSearchChange(value);
    const search = value ? `?search=${encodeURIComponent(value)}` : '';
    navigate(`/social/feed${search}`, { replace: true });
  };

  // Check current route type
  const isSocialRoute = location.pathname.startsWith('/social');
  const isChatRoute = location.pathname.startsWith('/chat');
  const isNotesRoute = location.pathname.startsWith('/notes');
  const isRecordingsRoute = location.pathname.startsWith('/recordings');
  const isScheduleRoute = location.pathname.startsWith('/schedule');
  const isDocumentsRoute = location.pathname.startsWith('/documents');
  const isSettingsRoute = location.pathname.startsWith('/settings');
  const isDashboardRoute = location.pathname === '/dashboard';
  const isQuizzesRoute = location.pathname === 'quizzes'

  // Route-specific actions
  const getRouteSpecificActions = () => {
    if (isNotesRoute) {
      return (
        <Button onClick={onNewNote} size="sm" className="bg-orange-300 dark:bg-orange-900/30 text-white">
          <Plus className="h-4 w-4" />
          <span className=" sm:inline ml-2">New Note</span>
        </Button>
      );
    }

    if (isRecordingsRoute) {
      return (
        <Button onClick={onNewRecording} size="sm" className="bg-green-600 hover:bg-green-700 text-white">
          <Mic className="h-4 w-4" />
          <span className=" sm:inline ml-2">New Recording</span>
        </Button>
      );
    }

    if (isScheduleRoute) {
      return (
        <Button onClick={onNewSchedule} size="sm" className="bg-orange-600 hover:bg-orange-700 text-white">
          <Plus className="h-4 w-4" />
          <span className=" sm:inline ml-2">New Event</span>
        </Button>
      );
    }

    if (isDocumentsRoute) {
      return (
        <Button onClick={onUploadDocument} size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
          <Upload className="h-4 w-4" />
          <span className=" sm:inline ml-2">Upload Document</span>
        </Button>
      );
    }

    if (isChatRoute) {
      return (
        <Button onClick={onNewChat} size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white">
          <MessageCircle className="h-4 w-4" />
          <span className=" sm:inline ml-2">New Chat</span>
        </Button>
      );
    }

    if (isSocialRoute) {
      return (
        <Button onClick={onOpenCreatePostDialog} size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
          <Plus className="h-4 w-4" />
          <span className=" sm:inline ml-2">New Post</span>
        </Button>
      );
    }

   return null;
  };

  // Route-specific search placeholder
  const getSearchPlaceholder = () => {
    if (isNotesRoute) return "Search notes...";
    if (isRecordingsRoute) return "Search recordings...";
    if (isScheduleRoute) return "Search schedule...";
    if (isDocumentsRoute) return "Search documents...";
    if (isChatRoute) return "Search chat history...";
    if (isSocialRoute) return "Search posts, people...";
    if (isDashboardRoute) return "Search dashboard...";
    return "Search...";
  };

  // App Menu Dropdown Component (reusable)
  const AppMenuDropdown = () => (
    <div ref={appMenuRef} className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsAppMenuOpen(prev => !prev)}
        className="flex items-center gap-2 text-slate-700 dark:text-slate-300"
      >
        <LayoutDashboard className="h-4 w-4" />
        <span>App Menu</span>
        <ChevronDown className="h-4 w-4" />
      </Button>

      {/* App Dropdown Menu */}
      {isAppMenuOpen && (
        <div className="absolute left-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-50">
          <div className="p-3 border-b border-slate-200 dark:border-slate-700">
            <p className="font-semibold text-slate-900 dark:text-white">Quick Access</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Navigate to other sections</p>
          </div>
          <div className="py-2">
            {mainNavItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.tab;
              return (
                <button
                  key={item.label}
                  onClick={() => {
                    navigate(item.path);
                    setIsAppMenuOpen(false);
                  }}
                  className={`w-full px-4 py-2.5 text-left flex items-center gap-3 transition-colors ${
                    isActive 
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' 
                      : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      <header className="flex items-center justify-between w-full p-1 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm sticky top-0 z-40">
        {/* Left: Logo + Title + Sidebar Toggle */}
        <div className="flex items-center gap-4">          
            <Button variant="ghost" size="sm" onClick={onToggleSidebar} className="lg:hidden">
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2 hidden lg:flex">
            <AppMenuDropdown/>
            </div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white hidden sm:block">
            {tabNames[activeTab]}
          </h1>
        </div>

        {/* Center: Navigation with App Menu on ALL routes */}
        <div className="hidden md:flex items-center flex-1 justify-center max-w-5xl mx-auto gap-4">
          
          {isSocialRoute ? (
            // Social Route - Additional Social Navigation
            <>
              {/* Divider */}
              <div className="h-8 w-px bg-slate-300 dark:bg-slate-600" />

              {/* Social Navigation - Fully Visible */}
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-full p-1.5 gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <Input
                    placeholder={getSearchPlaceholder()}
                    value={socialSearchQuery}
                    onChange={handleSocialSearch}
                    className="pl-10 pr-4 h-9 w-64 bg-transparent border-0 focus:ring-0 text-sm"
                  />
                </div>
                <div className="h-6 w-px bg-slate-300 dark:bg-slate-600" />
                {socialNavItems.map(item => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path || 
                    location.pathname.startsWith(`${item.path}/`) || 
                    (item.path === '/social/feed' && location.pathname === '/social');
                  return (
                    <Button
                      key={item.label}
                      variant={isActive ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => navigate(item.path)}
                      className={`rounded-full px-4 ${isActive ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-400'}`}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="hidden lg:inline ml-2">{item.label}</span>
                    </Button>
                  );
                })}
              </div>
            </>
          ) : (
            // Non-social routes - App Menu + Search
            <>
              {/* Divider */}
              <div className="h-8 w-px bg-slate-300 dark:bg-slate-600" />

              {/* Search for non-social routes */}
              <div className="flex items-center flex-1 justify-center max-w-md">
                <div className="relative w-full max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <Input
                    placeholder={getSearchPlaceholder()}
                    value={searchQuery}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => onSearchChange(e.target.value)}
                    className="pl-10 pr-4 h-9 w-full bg-slate-100 dark:bg-slate-800 border-0 focus:ring-0"
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right: Route-specific actions + Quick Social Access + Avatar */}
        <div className="flex items-center gap-3">
          {/* Route-specific Actions */}
          <div className=" md:flex">
            {getRouteSpecificActions()}
          </div>
          {/* Avatar with Dropdown */}
          <div ref={avatarRef} className="relative">
            <button
              onClick={() => setIsAvatarMenuOpen(prev => !prev)}
              className="w-10 h-10 rounded-full bg-blue-600 dark:bg-blue-500 flex items-center justify-center text-white font-bold text-sm hover:ring-4 hover:ring-blue-200 dark:hover:ring-blue-800 transition-all overflow-hidden"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span>{getInitials(fullName)}</span>
              )}
            </button>

            {/* Dropdown Menu */}
            {isAvatarMenuOpen && (
              <div className="fixed right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-50">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                  <p className="font-semibold text-slate-900 dark:text-white">{fullName || 'User'}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Student</p>
                </div>
                <div className="py-2">
                  <button
                    onClick={() => { navigate('/social/profile'); setIsAvatarMenuOpen(false); }}
                    className="w-full px-4 py-2.5 text-left flex items-center gap-3 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    <User className="h-4 w-4" />
                    <span>My Profile</span>
                  </button>
                  <button
                    onClick={() => { navigate('/settings'); setIsAvatarMenuOpen(false); }}
                    className="w-full px-4 py-2.5 text-left flex items-center gap-3 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    <Settings className="h-4 w-4" />
                    <span>Settings</span>
                  </button>
                  <hr className="my-2 border-slate-200 dark:border-slate-700" />
                  <button
                    onClick={() => { setShowLogoutConfirm(true); setIsAvatarMenuOpen(false); }}
                    className="w-full px-4 py-2.5 text-left flex items-center gap-3 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-colors"
                  >
                    {isLoggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOutIcon className="h-4 w-4" />}
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Logout Confirmation */}
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