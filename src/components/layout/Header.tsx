// src/components/layout/Header.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  Search, Plus, Menu, Bell, LogOut, Users, TrendingUp, User, Home,
  Settings, BookOpen, Video, Calendar, MessageSquare, FileText,
  Sliders, LayoutDashboard, ChevronDown, Upload, Mic, Sparkles,
  Users2, MessageCircle, Loader2, Sun, Moon
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { toast } from 'sonner';
import { ConfirmationModal } from '../ui/ConfirmationModal';
import { useAuth } from '@/hooks/useAuth';
import { useAppContext } from '@/hooks/useAppContext';

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
  // New theme-related props
  currentTheme: 'light' | 'dark';
  onThemeChange: (theme: 'light' | 'dark') => void;
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

const socialNavItems = [
  { label: 'Feed', icon: Home, path: '/social' },
  { label: 'Trending', icon: TrendingUp, path: '/social/trending' },
  { label: 'Groups', icon: Users, path: '/social/groups' },
  { label: 'Notifications', icon: Bell, path: '/social/notifications' },
];

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
  // New theme props
  currentTheme,
  onThemeChange,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();
  const { handleNavigateToTab, createNewChatSession } = useAppContext();

  const [isAvatarMenuOpen, setIsAvatarMenuOpen] = useState(false);
  const [isAppMenuOpen, setIsAppMenuOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const avatarRef = useRef<HTMLDivElement>(null);
  const appMenuRef = useRef<HTMLDivElement>(null);

  const isSocialRoute = location.pathname.startsWith('/social');

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

  // Theme toggle handler
  const handleThemeToggle = () => {
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    onThemeChange(newTheme);
    toast.success(`Switched to ${newTheme} mode`);
  };

  const getPrimaryAction = () => {
    switch (activeTab) {
      case 'notes':
        return (
          <Button
            onClick={onNewNote}
            className="bg-gradient-to-r from-orange-500 to-blue-500 hover:from-orange-600 hover:to-blue-600"
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">New Note</span>
          </Button>
        );
      case 'recordings':
        return (
          <Button
            onClick={() => onNewRecording?.()}
            className="bg-green-600 hover:bg-green-700"
            size="sm"
          >
            <Mic className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Record</span>
          </Button>
        );
      case 'documents':
        return (
          <Button
            onClick={() => onUploadDocument?.()}
            className="bg-blue-600 hover:bg-blue-700"
            size="sm"
          >
            <Upload className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Upload</span>
          </Button>
        );
      case 'schedule':
        return (
          <Button
            onClick={() => onNewSchedule?.()}
            className="bg-blue-600 hover:bg-blue-700"
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Add Event</span>
          </Button>
        );
      case 'chat':
        return (
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
        );
      case 'social':
        return (
          <Button
            onClick={onOpenCreatePostDialog}
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Post</span>
          </Button>
        );
      default:
        return null;
    }
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

            {/* App Menu Dropdown - Hidden on mobile */}
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
                </div>
              )}
            </div>

            <h1 className="text-lg font-bold hidden sm:block">{tabNames[activeTab]}</h1>
          </div>

          {/* Center: Search + Social Nav */}
          <div className="flex-1 flex items-center justify-center px-4 lg:px-8">
            {isSocialRoute ? (
              <div className="hidden lg:flex items-center bg-slate-100 dark:bg-slate-800 rounded-full p-2 gap-3 max-w-4xl w-full">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <Input
                    placeholder="Search posts, people..."
                    value={socialSearchQuery}
                    onChange={(e) => onSocialSearchChange(e.target.value)}
                    className="pl-10 bg-transparent border-0 focus:ring-0 h-9"
                  />
                </div>
                <div className="h-8 w-px bg-slate-300 dark:bg-slate-600" />
                <div className="flex gap-1">
                  {socialNavItems.map(({ label, icon: Icon, path }) => {
                    const isActive = location.pathname === path || location.pathname.startsWith(path + '/social');
                    return (
                      <Button
                        key={path}
                        variant={isActive ? 'outline' : 'ghost'}
                        size="sm"
                        onClick={() => navigate(path)}
                        className={`${isActive
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                          } rounded-full`}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="hidden lg:inline ml-2">{label}</span>
                      </Button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="relative w-full max-w-md hidden lg:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input
                  placeholder={`Search ${tabNames[activeTab].toLowerCase()}...`}
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="pl-10 bg-slate-100 dark:bg-slate-800 border-0 h-10"
                />
              </div>
            )}
          </div>

          {/* Right: Create Button + Avatar - Show create button on all screens */}
          <div className="flex items-center gap-3">
            {/* Create Button - Now visible on all screens */}
            <div>
              {getPrimaryAction()}
            </div>

            {/* Avatar - Always visible */}
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