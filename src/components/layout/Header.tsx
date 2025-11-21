import React, { useCallback, useState } from 'react';
import { Search, Plus, Menu, Bell, LogOut, Loader2, Users, TrendingUp, User, Home } from 'lucide-react';
// import { Button } from '../ui/button'; // Replaced with local definition
// import { Input } from '../ui/input'; // Replaced with local definition
import { useNavigate } from 'react-router-dom';
import BookPagesAnimation from '../ui/bookloader';
import { toast } from 'sonner';
import { ConfirmationModal } from '../ui/ConfirmationModal';
import { useAuth } from '@/hooks/useAuth';

// --- Local UI Component Definitions (To fix import errors) ---
const Button = ({ className = '', variant = 'default', size = 'default', children, ...props }) => {
  let baseClasses = 'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';

  let variantClasses = 'bg-blue-600 text-white hover:bg-blue-700 shadow-md';
  if (variant === 'ghost') {
    variantClasses = 'bg-transparent hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 shadow-none';
  }

  let sizeClasses = 'h-10 py-2 px-4';
  if (size === 'sm') {
    sizeClasses = 'h-8 px-3 text-sm';
  } else if (size === 'lg') {
    sizeClasses = 'h-11 px-8';
  }

  return (
    <button className={`${baseClasses} ${variantClasses} ${sizeClasses} ${className}`} {...props}>
      {children}
    </button>
  );
};

const Input = ({ className = '', ...props }) => (
  <input
    className={`flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 dark:ring-offset-slate-950 ${className}`}
    {...props}
  />
);

// --- Component Props and Definitions ---

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onNewNote: () => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  activeTab: 'notes' | 'recordings' | 'schedule' | 'chat' | 'documents' | 'settings' | 'dashboard' | 'social';
  fullName: string | null;
  avatarUrl: string | null;
  // NEW PROPS for Social Tab
  socialSearchQuery: string;
  onSocialSearchChange: (query: string) => void;
  onOpenCreatePostDialog: () => void;
}

const tabNames = {
  notes: 'Notes',
  recordings: 'Class Recordings',
  schedule: 'Schedule & Timetable',
  chat: 'AI Study Assistant',
  documents: 'Document Upload',
  settings: 'Learning Settings',
  dashboard: 'Dashboard',
  social: 'Social'
};

const getInitials = (name: string | null) => {
  if (!name) return 'U';
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
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
  // New props
  socialSearchQuery,
  onSocialSearchChange,
  onOpenCreatePostDialog,
}) => {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [isAvatarMenuOpen, setIsAvatarMenuOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    e.currentTarget.style.display = 'none';
  };

  const handleAvatarClick = useCallback(() => {
    setIsAvatarMenuOpen(prev => !prev);
  }, []);

  const handleLogoutClick = useCallback(() => {
    setShowLogoutConfirm(true);
  }, []);

  const handleConfirmLogout = useCallback(async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
      toast.success('Successfully signed out.');
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Failed to sign out.');
    } finally {
      setIsLoggingOut(false);
      setShowLogoutConfirm(false);
      setIsAvatarMenuOpen(false);
    }
  }, [signOut, navigate]);

  const handleSocialInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    onSocialSearchChange(v);
    // keep URL in sync so the feed picks it up
    const search = v ? `?search=${encodeURIComponent(v)}` : '';
    navigate(`/social/feed${search}`, { replace: true });
  };

  return (
    <header className="flex items-center justify-between w-full p-1 sm:px-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm sticky top-0 z-40 transition-all duration-300">
      <div className="flex items-center space-x-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleSidebar}
          className="p-1.5 sm:p-2 lg:hidden text-slate-600 dark:text-white"
          title={isSidebarOpen ? 'Close sidebar' : 'Open sidebar'}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <BookPagesAnimation showText={false} className='p-0 hidden lg:block' />
        <div className="flex items-center space-x-2">
          <h1 className="text-xl font-bold text-slate-800 dark:text-white hidden sm:block">
            {tabNames[activeTab]}
          </h1>
        </div>
      </div>

      {/* --- SOCIAL NAVIGATION IN HEADER – BLUE TEXT VERSION --- */}
      {activeTab === 'social' && (
        <>
          {/* Desktop / Tablet – Full Labels */}
          <div className="hidden sm:flex items-center justify-center flex-1 max-w-5xl mx-auto">
            <div className="flex items-center  p-1.5 gap-1">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input
                  type="text"
                  placeholder="Search posts, people, groups..."
                  value={socialSearchQuery}
                  onChange={handleSocialInputChange}
                  className="pl-10 pr-4 h-9 w-80 bg-transparent border-0 focus:ring-0 text-sm placeholder:text-slate-500"
                />
              </div>

              <div className="h-6 w-px bg-slate-300 dark:bg-slate-600 mx-2" />

              {/* Social Navigation Buttons */}
              {[
                { id: 'feed', label: 'Home', icon: Home, path: '/social/feed' },
                { id: 'trending', label: 'Trending', icon: TrendingUp, path: '/social/trending' },
                { id: 'groups', label: 'Groups', icon: Users, path: '/social/groups' },
                { id: 'notifications', label: 'Notifications', icon: Bell, path: '/social/notifications' },
                { id: 'profile', label: 'Profile', icon: User, path: '/social/profile' },
              ].map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');

                return (
                  <Button
                    key={item.id}
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(item.path)}
                    className={`
                rounded-full px-5 h-9 text-sm font-medium transition-all flex items-center gap-2
                ${isActive
                        ? 'bg-blue-600 text-white shadow-md hover:bg-blue-100'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }
              `}
                  >
                    <Icon className={`h-4 w-4 ${isActive ? 'text-blue-600' : 'text-slate-500 dark:text-slate-400'}`} />
                    <span className={isActive ? 'text-blue-600 font-semibold' : ''}>
                      {item.label}
                    </span>
                  </Button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* --- USER PROFILE & ACTIONS (RIGHT) --- */}
      <div className="flex items-center space-x-2 sm:space-x-4">
        {activeTab === 'notes' && (
          <Button
            onClick={onNewNote}
            size="sm"
            className="bg-blue-500 hover:bg-blue-600 text-white shadow-md flex-shrink-0"
          >
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">New Note</span>
          </Button>
        )}
        {/* Notifications Icon (always visible) */}
        {/* <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/social?tab=notifications')}
          className="p-1.5 sm:p-2 text-slate-600 dark:text-white relative"
          title="Notifications"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute top-2 right-2 h-2 w-2 bg-red-500 rounded-full" />
        </Button> */}

        {/* Avatar Menu */}
        <div className="relative flex items-center space-x-2">
          {isAvatarMenuOpen && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogoutClick}
                className="p-1.5 sm:p-2 flex-shrink-0 dark:hover:bg-slate-700 text-slate-600 dark:text-white"
                disabled={isLoggingOut}
              >
                {isLoggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                <span className="hidden sm:inline ml-2">{isLoggingOut ? 'Signing Out...' : 'Sign Out'}</span>
              </Button>
            </>
          )}
          <div
            className="relative w-9 h-9 rounded-full overflow-hidden flex-shrink-0 bg-blue-500 dark:bg-blue-600 flex items-center justify-center text-white font-bold text-sm cursor-pointer hover:opacity-80 transition-opacity"
            onClick={handleAvatarClick}
            title={isAvatarMenuOpen ? 'Close Menu' : 'Open Menu'}
          >
            <span>{getInitials(fullName)}</span>
            {avatarUrl && (
              <img
                src={avatarUrl}
                alt="User Avatar"
                className="w-full h-full object-cover absolute top-0 left-0"
                onError={handleImageError}
              />
            )}
          </div>
        </div>
      </div>

      <ConfirmationModal
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={handleConfirmLogout}
        title="Sign Out"
        message="Are you sure you want to sign out? You will be returned to the login screen."
      />
    </header>
  );
};