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
    // The main container for the sidebar.
    // On mobile, it slides in/out based on 'isOpen'.
    // On desktop (lg breakpoint), it's narrow by default (w-16) and expands on hover (group-hover:w-64).
    // 'group' class is essential for group-hover to work on child elements.
    <div className={`bg-white border-r h-full border-slate-200 transition-all duration-300 ease-in-out ${
      isOpen ? 'translate-x-0' : '-translate-x-full'
    } fixed inset-y-0 left-0 z-50 flex flex-col shadow-lg lg:shadow-none
    lg:relative lg:translate-x-0 lg:w-16 lg:hover:w-64 group overflow-hidden`}>
      
      {/* Content area, takes up remaining vertical space and allows scrolling */}
      <div className="p-2 sm:p-3 flex-1 overflow-hidden"> 
        {/* Main Navigation Section */}
        <div className="mb-2">
          {/* "Navigation" heading: visible when 'isOpen' (mobile) or on desktop hover */}
          {(isOpen || window.innerWidth >= 1024) && ( // Check for isOpen or desktop view
            <h2 className="font-semibold text-slate-800 mb-2 
              lg:opacity-0 lg:group-hover:opacity-100 lg:transition-opacity lg:duration-300">
              Navigation
            </h2>
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
                  {/* Icon: has margin when 'isOpen' (mobile) or on desktop hover */}
                  <Icon className={`h-4 w-4 ${isOpen ? 'mr-3' : 'lg:group-hover:mr-3 lg:transition-all lg:duration-300'}`} />
                  {/* Text label: visible when 'isOpen' (mobile) or on desktop hover */}
                  <span className={`truncate ${
                    isOpen ? '' : 'lg:opacity-0 lg:group-hover:opacity-100 lg:transition-opacity lg:duration-300 lg:absolute lg:left-10 lg:w-full lg:pl-1 lg:pointer-events-none'
                  }`}>
                    {tab.name}
                  </span>
                </Button>
              );
            })}
          </nav>
        </div>

        {/* Categories Section (only shown when Notes tab is active) */}
        {activeTab === 'notes' && (
          <div>
            {/* "Categories" heading: visible when 'isOpen' (mobile) or on desktop hover */}
            {(isOpen || window.innerWidth >= 1024) && ( // Check for isOpen or desktop view
              <div className="mb-2 
                lg:opacity-0 lg:group-hover:opacity-100 lg:transition-opacity lg:duration-300">
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
                    {/* Icon: has margin when 'isOpen' (mobile) or on desktop hover */}
                    <Icon className={`h-3 w-3 ${isOpen ? 'mr-2' : 'lg:group-hover:mr-2 lg:transition-all lg:duration-300'}`} />
                    {/* Text label: visible when 'isOpen' (mobile) or on desktop hover */}
                    <span className={`truncate ${
                      isOpen ? '' : 'lg:opacity-0 lg:group-hover:opacity-100 lg:transition-opacity lg:duration-300 lg:absolute lg:left-9 lg:w-full lg:pl-1 lg:pointer-events-none'
                    }`}>
                      {category.name}
                    </span>
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
