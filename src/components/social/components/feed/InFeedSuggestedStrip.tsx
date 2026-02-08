import React, { useEffect, useRef, useMemo, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Loader2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface InFeedSuggestedStripProps {
  users: any[];
  offset: number;
  stripId: string;
  saveScroll: (id: string, pos: number) => void;
  getSavedScroll: (id: string) => number;
  hasMoreSuggestedUsers: boolean;
  isLoadingSuggestedUsers: boolean;
  loadMoreSuggestedUsers: () => void;
  onFollow: (userId: string) => Promise<{ isNowFollowing: boolean }>;
  onSeeAll: () => void;
}

export const InFeedSuggestedStrip: React.FC<InFeedSuggestedStripProps> = ({
  users,
  offset,
  stripId,
  saveScroll,
  getSavedScroll,
  hasMoreSuggestedUsers,
  isLoadingSuggestedUsers,
  loadMoreSuggestedUsers,
  onFollow,
  onSeeAll,
}) => {
  const [loadingIds, setLoadingIds] = useState<Record<string, boolean>>({});
  const containerRef = useRef<HTMLDivElement | null>(null);
  const localObserverRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();

  const handleFollow = async (id: string) => {
    if (loadingIds[id]) return;
    setLoadingIds(prev => ({ ...prev, [id]: true }));
    try {
      await onFollow(id);
      toast.success('Connected');
    } catch {
      toast.error('Failed to connect');
    } finally {
      setLoadingIds(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleViewProfile = (userId: string) => {
    navigate(`/social/profile/${userId}`);
  };

  const list = useMemo(() => {
    if (!users || users.length === 0) return [];
    const n = users.length;
    const o = Math.floor(offset % n);
    return users.slice(o).concat(users.slice(0, o)).slice(0, 12);
  }, [users, offset]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const saved = getSavedScroll(stripId) || 0;
    if (saved && Math.abs(el.scrollLeft - saved) > 2) el.scrollLeft = saved;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Local observer for horizontal infinite scroll
  useEffect(() => {
    if (!localObserverRef.current || !hasMoreSuggestedUsers || isLoadingSuggestedUsers) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMoreSuggestedUsers && !isLoadingSuggestedUsers) {
          loadMoreSuggestedUsers();
        }
      },
      {
        threshold: 0.1,
        root: containerRef.current,
        rootMargin: '0px 100px 0px 0px',
      }
    );

    observer.observe(localObserverRef.current);
    return () => observer.disconnect();
  }, [hasMoreSuggestedUsers, isLoadingSuggestedUsers, loadMoreSuggestedUsers]);

  const onScroll = () => {
    const pos = containerRef.current?.scrollLeft || 0;
    saveScroll(stripId, pos);
  };

  if (!list || list.length === 0) return null;

  return (
    <div className="py-3 px-2 -mx-2 max-w-[680px]">
      <div className="flex items-center justify-between mb-2 px-2">
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Suggested for you</h4>
        <button className="text-xs text-slate-500 hover:underline" onClick={onSeeAll}>
          See all
        </button>
      </div>

      <div
        ref={containerRef}
        onScroll={onScroll}
        className="flex space-x-3 overflow-x-auto scrollbar-hide px-2"
      >
        {list.map((u) => (
          <div key={u.id} className="min-w-[140px] max-w-[180px] bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 p-3 flex-shrink-0">
            <div
              className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => handleViewProfile(u.id)}
            >
              <Avatar className="h-10 w-10">
                <AvatarImage src={u.avatar_url} />
                <AvatarFallback>{u.display_name?.[0]}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="font-semibold text-sm truncate">{u.display_name}</div>
                <div className="text-xs text-slate-500 truncate">@{u.username}</div>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <Button
                size="sm"
                className="flex-1 rounded-full text-xs bg-blue-600 hover:bg-blue-700"
                onClick={() => handleFollow(u.id)}
                disabled={!!loadingIds[u.id]}
              >
                {loadingIds[u.id] ? '...' : 'Connect'}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="ml-2 hover:bg-slate-200"
                onClick={() => handleViewProfile(u.id)}
                title="View Profile"
              >
                <ExternalLink className="h-4 w-4 color-blue-500" />
              </Button>
            </div>
          </div>
        ))}
        {hasMoreSuggestedUsers && (
          <div
            ref={localObserverRef}
            className="h-full min-w-[100px] flex items-center justify-center"
          >
            {isLoadingSuggestedUsers ? (
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            ) : (
              <div className="text-xs text-slate-400">Scroll for more</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
