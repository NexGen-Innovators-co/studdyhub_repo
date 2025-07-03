
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
  activeTab: 'notes' | 'recordings' | 'schedule' | 'chat';
}

const tabNames = {
  notes: 'Notes',
  recordings: 'Class Recordings',
  schedule: 'Schedule & Timetable', 
  chat: 'AI Study Assistant'
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
    <header className="flex items-center gap-4 flex-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={onToggleSidebar}
        className="lg:hidden"
      >
        <Menu className="h-4 w-4" />
      </Button>

      <div className="flex items-center gap-3">
        <Sparkles className="h-6 w-6 text-blue-600" />
        <div>
          <h1 className="text-xl font-bold text-slate-800">NoteMind</h1>
          <p className="text-xs text-slate-500">{tabNames[activeTab]}</p>
        </div>
      </div>

      {activeTab === 'notes' && (
        <div className="flex-1 max-w-md mx-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10 bg-slate-50 border-slate-200 focus:bg-white transition-colors"
            />
          </div>
        </div>
      )}

      {activeTab === 'notes' && (
        <Button 
          onClick={onNewNote}
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-md"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Note
        </Button>
      )}
    </header>
  );
};
