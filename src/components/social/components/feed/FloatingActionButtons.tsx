import React from 'react';
import { RefreshCw, ArrowUp, Sparkles, MessageCircle, Lightbulb } from 'lucide-react';

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
  return (
    <div className="fixed bottom-16 right-2 flex flex-col gap-3 z-40 pointer-events-none">
      <div className="flex flex-col items-center gap-3 pointer-events-auto">
        {/* Tips Button */}
        {(window as any).__toggleTips && (
          <button
            onClick={() => (window as any).__toggleTips?.()}
            className="h-11 w-11 rounded-full shadow-lg text-blue-500 dark:text-yellow-400 hover:text-yellow-600 dark:hover:text-yellow-300 transition-all duration-300 hover:scale-110 cursor-pointer bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 backdrop-blur-sm flex items-center justify-center"
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
        {hasNewPosts && (
          <button
            onClick={onShowNewPosts}
            className="animate-bounce bg-blue-600 text-white px-5 py-2.5 rounded-full shadow-xl font-medium text-sm hover:bg-blue-700 transition-all flex items-center gap-2"
          >
            <Sparkles className="h-4 w-4" />
            {newPostsCount} new {newPostsCount === 1 ? 'post' : 'posts'}
          </button>
        )}

        {/* Refresh Button */}
        <button
          onClick={onRefresh}
          className={`
            h-11 w-11 rounded-full bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200
            shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center
            border border-slate-100 dark:border-slate-800 backdrop-blur-sm
            ${isScrolled || hasNewPosts ? 'translate-y-0 opacity-100 pointer-events-auto' : 'translate-y-0 opacity-0 pointer-events-none'}
          `}
          aria-label="Refresh feed"
          title="Refresh"
        >
          <RefreshCw className={`${isRefreshing || isLoading ? 'animate-spin' : ''} h-5 w-5 text-blue-600`} />
        </button>

        {/* Scroll to Top */}
        <button
          onClick={onScrollToTop}
          className={`
            h-12 w-12 rounded-full bg-blue-600 text-white shadow-lg hover:shadow-xl
            transition-all duration-300 flex items-center justify-center backdrop-blur-sm
            ${isScrolledDeep ? 'translate-y-0 opacity-100 scale-100 pointer-events-auto' : 'translate-y-0 opacity-0 scale-50 pointer-events-none'}
          `}
          aria-label="Scroll to top"
          title="Back to top"
        >
          <ArrowUp className="h-6 w-6" />
        </button>

        {/* Open Chats Button */}
        <button
          onClick={onToggleChatList}
          className={`
            relative h-14 w-14 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600
            text-white shadow-lg hover:shadow-2xl transition-all duration-300
            flex items-center justify-center backdrop-blur-sm ring-4 ring-blue-500/20
            ${isScrolled || showChatList || totalUnread > 0
              ? 'translate-y-0 opacity-100 scale-100 pointer-events-auto'
              : 'translate-y-0 opacity-0 scale-75 pointer-events-none'}
          `}
          aria-label="Open messages"
          title="Messages"
        >
          <MessageCircle className="h-7 w-7" />
          {totalUnread > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center animate-pulse ring-2 ring-white">
              {totalUnread > 99 ? '99+' : totalUnread}
            </span>
          )}
        </button>
      </div>
    </div>
  );
};
