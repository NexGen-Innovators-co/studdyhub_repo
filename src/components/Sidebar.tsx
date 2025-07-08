import React from 'react';
import { Book, Calculator, FlaskConical, Clock, Globe, FileText, Hash, Mic, Calendar, MessageCircle, Upload, Settings } from 'lucide-react';
import { Button } from './ui/button';
import { NoteCategory } from '../types/Note';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  noteCount: number;
  activeTab: 'notes' | 'recordings' | 'schedule' | 'chat' | 'documents' | 'settings';
  onTabChange: (tab: 'notes' | 'recordings' | 'schedule' | 'chat' | 'documents' | 'settings') => void;
}

const categories = [
  { id: 'all', name: 'All Notes', icon: FileText },
  { id: 'general', name: 'General', icon: Book },
  { id: 'math', name: 'Mathematics', icon: Calculator },
  { id: 'science', name: 'Science', icon: FlaskConical },
  { id: 'history', name: 'History', icon: Clock },
  { id: 'language', name: 'Languages', icon: Globe },
  { id: 'other', name: 'Other', icon: Hash },
];

const tabs = [
  { id: 'notes', name: 'Notes', icon: FileText },
  { id: 'recordings', name: 'Recordings', icon: Mic },
  { id: 'schedule', name: 'Schedule', icon: Calendar },
  { id: 'chat', name: 'AI Chat', icon: MessageCircle },
  { id: 'documents', name: 'Documents', icon: Upload },
  { id: 'settings', name: 'Settings', icon: Settings },
];

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onToggle,
  selectedCategory,
  onCategoryChange,
  noteCount,
  activeTab,
  onTabChange
}) => {
  return (
    <div className={`bg-white border-r border-slate-200 transition-all duration-300 ${
      isOpen ? 'w-64' : 'w-0 lg:w-16'
    } overflow-hidden h-full flex flex-col shadow-lg lg:shadow-none relative`}>
      <div className="p-3 sm:p-4">
        {/* Main Navigation */}
        <div className="mb-6">
          {isOpen && (
            <h2 className="font-semibold text-slate-800 mb-3">Navigation</h2>
          )}
          <nav className="space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              
              return (
                <Button
                  key={tab.id}
                  variant={isActive ? "default" : "ghost"}
                  className={`w-full justify-start h-10 ${
                    isActive 
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md' 
                      : 'hover:bg-slate-100 text-slate-700'
                  } ${!isOpen && 'px-2'}`}
                  onClick={() => onTabChange(tab.id as any)}
                >
                  <Icon className={`h-4 w-4 ${isOpen ? 'mr-3' : ''}`} />
                  {isOpen && <span className="truncate">{tab.name}</span>}
                </Button>
              );
            })}
          </nav>
        </div>

        {/* Categories (only shown when Notes tab is active) */}
        {activeTab === 'notes' && (
          <div>
            {isOpen && (
              <div className="mb-3">
                <h2 className="font-semibold text-slate-800">Categories</h2>
                <p className="text-sm text-slate-500">{noteCount} notes</p>
              </div>
            )}

            <nav className="space-y-1">
              {categories.map((category) => {
                const Icon = category.icon;
                const isActive = selectedCategory === category.id;
                
                return (
                  <Button
                    key={category.id}
                    variant={isActive ? "secondary" : "ghost"}
                    className={`w-full justify-start h-9 text-sm ${
                      isActive 
                        ? 'bg-slate-100 text-slate-800' 
                        : 'hover:bg-slate-50 text-slate-600'
                    } ${!isOpen && 'px-2'}`}
                    onClick={() => onCategoryChange(category.id)}
                  >
                    <Icon className={`h-3 w-3 ${isOpen ? 'mr-2' : ''}`} />
                    {isOpen && <span className="truncate">{category.name}</span>}
                  </Button>
                );
              })}
            </nav>
          </div>
        )}
      </div>
    </div>
  );
};
