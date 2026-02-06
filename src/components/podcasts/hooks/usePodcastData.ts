// usePodcastData.ts - Data fetching hook extracted from PodcastPanel
import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '../../../integrations/supabase/client';
import type { PodcastData } from '../podcastTypes';

export interface CreatorInfo {
  id: string;
  display_name: string;
  avatar_url: string | null;
  full_name?: string;
}

export interface RelatedPodcast {
  id: string;
  title: string;
  description?: string;
  cover_image_url?: string;
  duration?: number;
  duration_minutes?: number;
  listen_count?: number;
  podcast_type?: string;
  tags?: string[];
  created_at?: string;
  user_id?: string;
}

export interface ListenerEntry {
  id: string;
  display_name: string;
  avatar_url: string | null;
  joined_at: string;
}

export interface UsePodcastDataOptions {
  podcast: PodcastData | null;
  isOpen: boolean;
}

export interface UsePodcastDataReturn {
  creatorInfo: CreatorInfo | null;
  relatedPodcasts: RelatedPodcast[];
  relatedPage: number;
  relatedHasMore: boolean;
  relatedLoading: boolean;
  relatedSentinelRef: React.MutableRefObject<HTMLDivElement | null>;
  listenersList: ListenerEntry[];
  listenersPage: number;
  listenersHasMore: boolean;
  listenersLoading: boolean;
  listenersSentinelRef: React.MutableRefObject<HTMLDivElement | null>;
  displayListenCount: number;
  creatorLoading: boolean;
}

const RELATED_PAGE_SIZE = 6;
const LISTENERS_PAGE_SIZE = 10;

export function usePodcastData({ podcast, isOpen }: UsePodcastDataOptions): UsePodcastDataReturn {
  // Creator
  const [creatorInfo, setCreatorInfo] = useState<CreatorInfo | null>(null);
  const [creatorLoading, setCreatorLoading] = useState(false);

  // Related
  const [relatedPodcasts, setRelatedPodcasts] = useState<RelatedPodcast[]>([]);
  const [relatedPage, setRelatedPage] = useState(0);
  const [relatedHasMore, setRelatedHasMore] = useState(true);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const relatedSentinelRef = useRef<HTMLDivElement | null>(null);

  // Listeners
  const [listenersList, setListenersList] = useState<ListenerEntry[]>([]);
  const [listenersPage, setListenersPage] = useState(0);
  const [listenersHasMore, setListenersHasMore] = useState(true);
  const [listenersLoading, setListenersLoading] = useState(false);
  const listenersSentinelRef = useRef<HTMLDivElement | null>(null);
  const [displayListenCount, setDisplayListenCount] = useState(0);

  // Fetch creator info
  useEffect(() => {
    if (!isOpen || !podcast?.user_id) return;
    let cancelled = false;
    setCreatorLoading(true);
    (async () => {
      try {
        const { data } = await supabase
          .from('social_users')
          .select('id, display_name, avatar_url')
          .eq('id', podcast.user_id)
          .single();
        if (!cancelled && data) setCreatorInfo(data);
      } catch (_e) {}
      if (!cancelled) setCreatorLoading(false);
    })();
    return () => { cancelled = true; };
  }, [podcast?.user_id, isOpen]);

  // Fetch related podcasts page
  const fetchRelatedPage = useCallback(async (page: number) => {
    if (!podcast?.id || relatedLoading) return;
    setRelatedLoading(true);
    try {
      let query = supabase
        .from('ai_podcasts')
        .select('id, title, description, cover_image_url, duration_minutes, listen_count, podcast_type, tags, created_at, user_id')
        .neq('id', podcast.id)
        .order('listen_count', { ascending: false })
        .range(page * RELATED_PAGE_SIZE, (page + 1) * RELATED_PAGE_SIZE - 1);
      if (podcast.tags && podcast.tags.length > 0) {
        query = query.overlaps('tags', podcast.tags);
      }
      const { data } = await query;
      if (data && data.length > 0) {
        setRelatedPodcasts(prev => {
          const ids = new Set(prev.map(p => p.id));
          const unique = data.filter(p => {
            if (ids.has(p.id)) return false;
            ids.add(p.id); // also prevent within-batch duplicates
            return true;
          });
          return [...prev, ...unique];
        });
        setRelatedPage(page);
        if (data.length < RELATED_PAGE_SIZE) setRelatedHasMore(false);
      } else {
        setRelatedHasMore(false);
      }
    } catch (_e) {}
    setRelatedLoading(false);
  }, [podcast?.id, podcast?.tags, relatedLoading]);

  // Fetch listeners page
  const fetchListenersPage = useCallback(async (page: number) => {
    if (!podcast?.id || listenersLoading) return;
    setListenersLoading(true);
    try {
      const { data } = await supabase
        .from('podcast_listeners')
        .select('id, user_id, joined_at')
        .eq('podcast_id', podcast.id)
        .order('joined_at', { ascending: false })
        .range(page * LISTENERS_PAGE_SIZE, (page + 1) * LISTENERS_PAGE_SIZE - 1);
      if (data && data.length > 0) {
        // Fetch user info separately since there's no FK from podcast_listeners to social_users
        const userIds = [...new Set(data.map((item: any) => item.user_id).filter(Boolean))];
        const { data: users } = userIds.length > 0
          ? await supabase.from('social_users').select('id, display_name, avatar_url').in('id', userIds)
          : { data: [] };
        const userMap = new Map((users || []).map((u: any) => [u.id, u]));
        const mapped: ListenerEntry[] = data.map((item: any) => {
          const user = userMap.get(item.user_id);
          return {
            id: item.id, // use unique podcast_listeners row ID to avoid duplicate keys
            display_name: user?.display_name || 'Anonymous',
            avatar_url: user?.avatar_url || null,
            joined_at: item.joined_at,
          };
        });
        setListenersList(prev => {
          const ids = new Set(prev.map(l => l.id));
          const unique = mapped.filter(l => {
            if (ids.has(l.id)) return false;
            ids.add(l.id); // also prevent within-batch duplicates
            return true;
          });
          return [...prev, ...unique];
        });
        setListenersPage(page);
        if (data.length < LISTENERS_PAGE_SIZE) setListenersHasMore(false);
      } else {
        setListenersHasMore(false);
      }
    } catch (_e) {}
    setListenersLoading(false);
  }, [podcast?.id, listenersLoading]);

  // Initialize pages
  useEffect(() => {
    if (!isOpen || !podcast?.id) return;
    setRelatedPodcasts([]);
    setRelatedPage(0);
    setRelatedHasMore(true);
    setListenersList([]);
    setListenersPage(0);
    setListenersHasMore(true);
    fetchRelatedPage(0);
    fetchListenersPage(0);
  }, [podcast?.id, isOpen]);

  // Listener count
  useEffect(() => {
    if (!isOpen || !podcast) return;
    setDisplayListenCount(podcast.listen_count || 0);
    if (!podcast.id) return;
    let cancelled = false;
    (async () => {
      try {
        const { count } = await supabase
          .from('podcast_listeners')
          .select('*', { count: 'exact', head: true })
          .eq('podcast_id', podcast.id);
        if (!cancelled && typeof count === 'number') setDisplayListenCount(count);
      } catch (_e) {}
    })();
    return () => { cancelled = true; };
  }, [podcast?.id, isOpen]);

  // IntersectionObserver for related podcasts infinite scroll
  useEffect(() => {
    if (!isOpen || !relatedSentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && relatedHasMore && !relatedLoading) {
          fetchRelatedPage(relatedPage + 1);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(relatedSentinelRef.current);
    return () => observer.disconnect();
  }, [isOpen, relatedPage, relatedHasMore, relatedLoading, fetchRelatedPage]);

  // IntersectionObserver for listeners infinite scroll
  useEffect(() => {
    if (!isOpen || !listenersSentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && listenersHasMore && !listenersLoading) {
          fetchListenersPage(listenersPage + 1);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(listenersSentinelRef.current);
    return () => observer.disconnect();
  }, [isOpen, listenersPage, listenersHasMore, listenersLoading, fetchListenersPage]);

  return {
    creatorInfo, creatorLoading,
    relatedPodcasts, relatedPage, relatedHasMore, relatedLoading, relatedSentinelRef,
    listenersList, listenersPage, listenersHasMore, listenersLoading, listenersSentinelRef,
    displayListenCount,
  };
}
