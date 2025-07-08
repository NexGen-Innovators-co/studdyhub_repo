import React from 'react';
import { Search, Plus, Menu, Sparkles } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onNewNote: () => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  activeTab: 'notes' | 'recordings' | 'schedule' | 'chat' | 'documents' | 'settings';
}

const tabNames = {
  notes: 'Notes',
  recordings: 'Class Recordings',
  schedule: 'Schedule & Timetable', 
  chat: 'AI Study Assistant',
  documents: 'Document Upload',
  settings: 'Learning Settings'
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
    <header className="flex items-center gap-2 sm:gap-4 flex-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={onToggleSidebar}
        className="lg:hidden p-2"
      >
        <Menu className="h-4 w-4" />
      </Button>

      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 flex-shrink-0" />
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold text-slate-800 truncate">NoteMind</h1>
          <p className="text-xs text-slate-500 hidden sm:block truncate">{tabNames[activeTab]}</p>
        </div>
      </div>

      {activeTab === 'notes' && (
        <div className="flex-1 max-w-sm sm:max-w-md mx-2 sm:mx-4 hidden md:block">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10 bg-slate-50 border-slate-200 focus:bg-white transition-colors text-sm"
            />
          </div>
        </div>
      )}

      {activeTab === 'notes' && (
        <Button 
          onClick={onNewNote}
          size="sm"
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-md"
        >
          <Plus className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">New Note</span>
        </Button>
      )}
    </header>
  );
};
