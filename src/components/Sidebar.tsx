
import React from 'react';
import { Book, Calculator, FlaskConical, Clock, Globe, FileText, Hash } from 'lucide-react';
import { Button } from './ui/button';
import { NoteCategory } from '../types/Note';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  noteCount: number;
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

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onToggle,
  selectedCategory,
  onCategoryChange,
  noteCount
}) => {
  return (
    <div className={`bg-white border-r border-slate-200 transition-all duration-300 ${
      isOpen ? 'w-64' : 'w-0 lg:w-16'
    } overflow-hidden`}>
      <div className="p-4">
        <div className="flex items-center justify-between mb-6">
          {isOpen && (
            <div>
              <h2 className="font-semibold text-slate-800">Categories</h2>
              <p className="text-sm text-slate-500">{noteCount} notes</p>
            </div>
          )}
        </div>

        <nav className="space-y-2">
          {categories.map((category) => {
            const Icon = category.icon;
            const isActive = selectedCategory === category.id;
            
            return (
              <Button
                key={category.id}
                variant={isActive ? "default" : "ghost"}
                className={`w-full justify-start h-10 ${
                  isActive 
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md' 
                    : 'hover:bg-slate-100 text-slate-700'
                } ${!isOpen && 'px-2'}`}
                onClick={() => onCategoryChange(category.id)}
              >
                <Icon className={`h-4 w-4 ${isOpen ? 'mr-3' : ''}`} />
                {isOpen && <span className="truncate">{category.name}</span>}
              </Button>
            );
          })}
        </nav>
      </div>
    </div>
  );
};
