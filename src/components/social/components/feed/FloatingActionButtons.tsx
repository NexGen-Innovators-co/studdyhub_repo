import React, { useState } from 'react';
import { RefreshCw, ArrowUp, Sparkles, MessageCircle, Lightbulb, ChevronUp, ChevronDown } from 'lucide-react';

interface FloatingActionButtonsProps {
  isScrolled: boolean;
  isScrolledDeep: boolean;
  isRefreshing: boolean;
  isLoading: boolean;
  hasNewPosts: boolean;
  newPostsCount: number;
  totalUnread: number;
  showChatList: boolean;
  onRefresh: () => void;
  onScrollToTop: () => void;
  onShowNewPosts: () => void;
  onToggleChatList: () => void;
}

export const FloatingActionButtons: React.FC<FloatingActionButtonsProps> = ({
  isScrolled,
  isScrolledDeep,
  isRefreshing,
  isLoading,
  hasNewPosts,
  newPostsCount,
  totalUnread,
  showChatList,
  onRefresh,
  onScrollToTop,
  onShowNewPosts,
  onToggleChatList,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className="fixed bottom-16 right-2 flex flex-col gap-3 z-40 pointer-events-none">
      <div className="flex flex-col items-center gap-3 pointer-events-auto">
        {/* Tips Button */}
        {(window as any).__toggleTips && isMenuOpen && (
          <button
            onClick={() => {
              (window as any).__toggleTips?.();
              setIsMenuOpen(false);
            }}
            className="h-11 w-11 rounded-full text-blue-500 dark:text-yellow-400 hover:text-yellow-600 dark:hover:text-yellow-300 transition-all hover:scale-110 cursor-pointer backdrop-blur-sm flex items-center justify-center animate-in fade-in slide-in-from-bottom-2 duration-200"
            style={{
              filter: 'drop-shadow(0 0 8px rgba(36, 190, 251, 0.6))',
              animation: 'glow 2s ease-in-out infinite',
            }}
            title="Quick Tips"
          >
            <Lightbulb className="w-6 h-6 fill-current" />
          </button>
        )}

        {/* New Posts Banner */}
        {hasNewPosts && isMenuOpen && (
          <button
            onClick={() => {
              onShowNewPosts();
              setIsMenuOpen(false);
            }}
            className="animate-bounce bg-blue-600 text-white px-5 py-2.5 rounded-full shadow-xl font-medium text-sm hover:bg-blue-700 transition-all flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200"
          >
            <Sparkles className="h-4 w-4" />
            {newPostsCount} new {newPostsCount === 1 ? 'post' : 'posts'}
          </button>
        )}

        {/* Refresh Button */}
        {isMenuOpen && (
          <button
            onClick={() => {
              onRefresh();
              setIsMenuOpen(false);
            }}
            className="h-11 w-11 rounded-full bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 shadow-lg hover:shadow-xl transition-all flex items-center justify-center border border-slate-100 dark:border-slate-800 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2 duration-200"
            aria-label="Refresh feed"
            title="Refresh"
          >
            <RefreshCw className={`${isRefreshing || isLoading ? 'animate-spin' : ''} h-5 w-5 text-blue-600`} />
          </button>
        )}

        {/* Scroll to Top */}
        {isMenuOpen && isScrolledDeep && (
          <button
            onClick={() => {
              onScrollToTop();
              setIsMenuOpen(false);
            }}
            className="h-11 w-11 rounded-full  bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 shadow-lg hover:shadow-xl transition-all flex items-center justify-center backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2 duration-200"
            aria-label="Scroll to top"
            title="Back to top"
          >
            <ArrowUp className="h-6 w-6  text-blue-600" />
          </button>
        )}

        {/* Open Chats Button */}
        {isMenuOpen && (
          <button
            onClick={() => {
              onToggleChatList();
              setIsMenuOpen(false);
            }}
            className="relative h-11 w-11 rounded-full  bg-white dark:bg-slate-900 text-slate-700 shadow-lg dark:text-slate-200 transition-all flex items-center justify-center backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2 duration-200"
            aria-label="Open messages"
            title="Messages"
          >
            <MessageCircle className="h-5 w-5  text-blue-600" />
            {totalUnread > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center animate-pulse ring-2 ring-white">
                {totalUnread > 99 ? '99+' : totalUnread}
              </span>
            )}
          </button>
        )}

        {/* Expand Button - Always Visible */}
        <button
          onClick={() => setIsMenuOpen(prev => !prev)}
          className="relative h-11 w-11 rounded-full  bg-blue-600 dark:bg-slate-900 text-slate-700 shadow-lg dark:text-slate-200 hover:shadow-xl transition-all flex items-center justify-center backdrop-blur-sm"
          aria-label={isMenuOpen ? 'Close actions' : 'Open actions'}
          title={isMenuOpen ? 'Close' : 'More options'}
        >
          {isMenuOpen ? <ChevronDown className="h-5 w-5  text-white" /> : <ChevronUp className="h-5 w-5  text-white" />}
        </button>
      </div>
    </div>
  );
};
