import React from 'react';
import { Search, Plus, Menu, Sparkles, Bell } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onNewNote: () => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  activeTab: 'notes' | 'recordings' | 'schedule' | 'chat' | 'documents' | 'settings' |'dashboard';
  // New props for user avatar
  fullName: string | null;
  avatarUrl: string | null;
}

const tabNames = {
  notes: 'Notes',
  recordings: 'Class Recordings',
  schedule: 'Schedule & Timetable',
  chat: 'AI Study Assistant',
  documents: 'Document Upload',
  settings: 'Learning Settings'
  , dashboard: 'Dashboard'
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
}) => {
  // Function to get initials from full name
  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2); // Get first two initials
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    e.currentTarget.style.display = 'none'; // Hide the broken image
  };

  return (
    <header className="flex items-center justify-between gap-2 sm:gap-4 flex-1 min-w-0  ">
      <div className="flex items-center gap-2 sm:gap-4 min-w-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleSidebar}
          className="lg:hidden p-1.5 sm:p-2 flex-shrink-0 dark:hover:bg-slate-700"
        >
          <Menu className="h-4 w-4 text-slate-600 dark:text-white" />
        </Button>

        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {/* Main App Logo/Title */}
          <div className="flex-shrink-0">
            <h1 className="text-base sm:text-lg md:text-xl font-bold text-slate-800 dark:text-white truncate">studdyhub</h1>
            {/* Display tab name on small screens and up */}
            <p className="text-xs text-slate-500 hidden sm:block truncate">{tabNames[activeTab]}</p>
          </div>
        </div>
      </div>

      {activeTab === 'notes' && (
        // Search bar: visible on small screens and up, adjusted width
        <div className="flex-1 max-w-xs sm:max-w-sm md:max-w-md mx-1 sm:mx-2 md:mx-4 hidden sm:block">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10 bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 focus:bg-white dark:focus:bg-slate-800 transition-colors text-sm w-full"
            />
          </div>
        </div>
      )}

      {/* Right-side actions and user profile */}
      <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
        {activeTab === 'notes' && (
          <Button
            onClick={onNewNote}
            size="sm"
            className="bg-blue-500 hover:bg-blue-600 text-white shadow-md flex-shrink-0"
          >
            <Plus className="h-4 w-4 sm:mr-2" />
            {/* Hide "New Note" text on extra small screens for better fit */}
            <span className="hidden sm:inline">New Note</span>
          </Button>
        )}
        
        {/* User Avatar, Name, and optional actions */}
        <div className="flex items-center gap-2">
           {/* Notification Bell */}
           <Button
            variant="ghost"
            size="sm"
            className="p-1.5 sm:p-2 flex-shrink-0 relative dark:hover:bg-slate-700"
          >
            <Bell className="h-4 w-4 text-slate-600 dark:text-white" />
            {/* Example notification badge */}
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          </Button>

          {/* User Avatar with initials fallback */}
          <div className="relative w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-blue-500 dark:bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
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
    </header>
  );
};
