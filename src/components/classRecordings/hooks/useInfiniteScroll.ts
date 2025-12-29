// src/components/classRecordings/hooks/useInfiniteScroll.ts
import { useState, useEffect, useRef, useCallback } from 'react';

interface UseInfiniteScrollOptions {
  loadMore: () => Promise<void>;
  hasMore: boolean;
  isLoading: boolean;
  threshold?: number;
}

export const useInfiniteScroll = ({
  loadMore,
  hasMore,
  isLoading,
  threshold = 0.8
}: UseInfiniteScrollOptions) => {
  const observerTarget = useRef<HTMLDivElement>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const handleObserver = useCallback(async (entries: IntersectionObserverEntry[]) => {
    const [target] = entries;

    if (target.isIntersecting && hasMore && !isLoading && !isLoadingMore) {
      setIsLoadingMore(true);
      try {
        await loadMore();
      } catch (error) {

      } finally {
        setIsLoadingMore(false);
      }
    }
  }, [hasMore, isLoading, isLoadingMore, loadMore]);

  useEffect(() => {
    const element = observerTarget.current;
    if (!element) return;

    const observer = new IntersectionObserver(handleObserver, {
      threshold,
      rootMargin: '100px'
    });

    observer.observe(element);

    return () => {
      if (element) {
        observer.unobserve(element);
      }
    };
  }, [handleObserver, threshold]);

  return { observerTarget, isLoadingMore };
};