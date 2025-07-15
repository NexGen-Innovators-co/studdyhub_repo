import React from 'react';
import { Search, Plus, Menu, Sparkles } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';

// Define a union type for all possible application tabs (matching AppTab from Index.tsx)
type AppTab = 'notes' | 'recordings' | 'schedule' | 'chat' | 'documents' | 'settings' | 'sitemap';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onNewNote: () => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  // Updated activeTab type
  activeTab: AppTab;
}

const tabNames: Record<AppTab, string> = {
  notes: 'Notes',
  recordings: 'Class Recordings',
  schedule: 'Schedule & Timetable',
  chat: 'AI Study Assistant',
  documents: 'Document Upload',
  settings: 'Learning Settings',
  sitemap: 'Sitemap XML', // Added sitemap
};

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  onSearchChange,
  onNewNote,
  isSidebarOpen,
  onToggleSidebar,
  activeTab
}) => {
  return (
    <header className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
      <Button
        variant="ghost"
        size="sm"
        onClick={onToggleSidebar}
        className="lg:hidden p-1.5 sm:p-2 flex-shrink-0"
      >
        <Menu className="h-4 w-4" />
      </Button>

      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-shrink">
        <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 flex-shrink-0" />
        <div className="min-w-0 flex-shrink">
          <h1 className="text-base sm:text-lg md:text-xl font-bold text-slate-800 truncate">NoteMind</h1>
          {/* Display tab name on small screens and up */}
          {/* Conditionally render tab name, exclude sitemap from main display */}
          {activeTab !== 'sitemap' && (
            <p className="text-xs text-slate-500 hidden sm:block truncate">{tabNames[activeTab]}</p>
          )}
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
              className="pl-10 bg-slate-50 border-slate-200 focus:bg-white transition-colors text-sm w-full"
            />
          </div>
        </div>
      )}

      {activeTab === 'notes' && (
        <Button
          onClick={onNewNote}
          size="sm"
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-md flex-shrink-0"
        >
          <Plus className="h-4 w-4 sm:mr-2" />
          {/* Hide "New Note" text on extra small screens for better fit */}
          <span className="hidden sm:inline">New Note</span>
        </Button>
      )}
    </header>
  );
};
