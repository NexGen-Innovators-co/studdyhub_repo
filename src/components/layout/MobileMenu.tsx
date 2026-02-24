import React from 'react';
import { 
  LayoutDashboard, BookOpen, Video, Calendar, 
  MessageSquare, FileText, Sparkles, Users2, Sliders, 
  Podcast, Clipboard, GraduationCap, Star
} from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { RateAppDialog } from '@/components/ratings/RateAppDialog';
import { Button } from '@/components/ui/button';

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: string) => void;
  activeTab: string;
}

const itemClasses = "flex flex-col items-center justify-center gap-2 p-3 rounded-xl transition-all duration-200 border min-h-[44px] min-w-[44px] touch-manipulation";

const mainNavItems = [
  { label: 'Dashboard', icon: LayoutDashboard, tab: 'dashboard' },
  { label: 'Library', icon: Clipboard, tab: 'library' },
  { label: 'AI Chat', icon: MessageSquare, tab: 'chat' },
  { label: 'Notes', icon: BookOpen, tab: 'notes' },
  { label: 'Recordings', icon: Video, tab: 'recordings' },
  { label: 'Documents', icon: FileText, tab: 'documents' },
  { label: 'Social', icon: Users2, tab: 'social' },
  { label: 'Quizzes', icon: Sparkles, tab: 'quizzes' },
  { label: 'Schedule', icon: Calendar, tab: 'schedule' },
  { label: 'Podcasts', icon: Podcast, tab: 'podcasts' },
  { label: 'Settings', icon: Sliders, tab: 'settings' },
  { label: 'Educator', icon: GraduationCap, tab: 'educator' },
];

export const MobileMenu: React.FC<MobileMenuProps> = ({ 
  isOpen, 
  onClose, 
  onNavigate,
  activeTab 
}) => {
  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="h-[80vh] rounded-t-[20px] px-6 pt-8 pb-0 overflow-hidden flex flex-col bg-white dark:bg-slate-950">
        <SheetHeader className="mb-6 text-left">
          <SheetTitle className="text-2xl font-bold text-slate-900 dark:text-white">
            App Features
          </SheetTitle>
        </SheetHeader>
        
        <div className="flex-1 overflow-y-auto pb-8 scrollbar-hide">
            <div className="grid grid-cols-3 gap-4">
            {mainNavItems.map((item) => {
                const isActive = activeTab === item.tab;
                return (
                <button
                    key={item.tab}
                    onClick={() => {
                        onNavigate(item.tab);
                        onClose();
                    }}
                    className={`
                        ${itemClasses}
                        ${isActive 
                            ? 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400' 
                            : 'bg-slate-50 border-transparent text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800'
                        }
                    `}
                >
                    <div className={`
                        p-4 rounded-full 
                        ${isActive 
                            ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400' 
                            : 'bg-white text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                        }
                        shadow-sm
                    `}>
                        <item.icon className="h-6 w-6" />
                    </div>
                    <span className="text-xs font-semibold text-center">{item.label}</span>
                </button>
                );
            })}
            </div>

            {/* Rate App */}
            <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-center">
              <RateAppDialog
                trigger={
                  <Button variant="outline" size="sm" className="gap-2 text-yellow-600 dark:text-yellow-400 border-yellow-300 dark:border-yellow-700 hover:bg-yellow-50 dark:hover:bg-yellow-900/20">
                    <Star className="h-4 w-4 fill-yellow-400" />
                    Rate StuddyHub
                  </Button>
                }
              />
            </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
