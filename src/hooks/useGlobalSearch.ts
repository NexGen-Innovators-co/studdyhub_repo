import { useState, useCallback, useRef, useEffect } from 'react';
import { globalSearchService, SearchConfig, SearchResult, SEARCH_CONFIGS } from '@/services/globalSearchService';

interface UseGlobalSearchOptions {
  debounceMs?: number;
  cacheResults?: boolean;
}

interface UseGlobalSearchReturn<T = any> {
  search: (query: string) => Promise<void>;
  results: T[];
  isSearching: boolean;
  error: string | null;
  query: string;
  totalCount: number;
  clear: () => void;
}

/**
 * Custom hook for global search functionality
 * Provides debounced search with caching and error handling
 */
export const useGlobalSearch = <T = any>(
  config: SearchConfig,
  userId: string | null,
  options: UseGlobalSearchOptions = {}
): UseGlobalSearchReturn<T> => {
  const { debounceMs = 500, cacheResults = true } = options;

  const [results, setResults] = useState<T[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [totalCount, setTotalCount] = useState(0);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const cacheRef = useRef<Map<string, SearchResult<T>>>(new Map());

  // Clear debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const executeSearch = useCallback(
    async (searchQuery: string) => {
      if (!userId) {
        setError('User not authenticated');
        return;
      }

      // Check cache first
      if (cacheResults && cacheRef.current.has(searchQuery)) {
        const cached = cacheRef.current.get(searchQuery)!;
        setResults(cached.data);
        setTotalCount(cached.totalCount);
        setQuery(searchQuery);
        return;
      }

      setIsSearching(true);
      setError(null);

      try {
        const result = await globalSearchService.search<T>(
          config,
          userId,
          searchQuery
        );

        // Cache the result
        if (cacheResults) {
          cacheRef.current.set(searchQuery, result);
        }

        setResults(result.data);
        setTotalCount(result.totalCount);
        setQuery(searchQuery);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Search failed';
        setError(errorMessage);
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    },
    [config, userId, cacheResults]
  );

  const search = useCallback(
    async (searchQuery: string) => {
      setQuery(searchQuery);

      // Clear existing timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Clear results if search is empty
      if (!searchQuery.trim()) {
        setResults([]);
        setTotalCount(0);
        return;
      }

      // Debounce the search
      debounceTimerRef.current = setTimeout(() => {
        executeSearch(searchQuery);
      }, debounceMs);
    },
    [debounceMs, executeSearch]
  );

  const clear = useCallback(() => {
    setResults([]);
    setQuery('');
    setError(null);
    setTotalCount(0);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
  }, []);

  return {
    search,
    results,
    isSearching,
    error,
    query,
    totalCount,
    clear
  };
};

/**
 * Hook for searching a specific entity type using predefined config
 */
export const useEntitySearch = <T = any>(
  entityType: keyof typeof SEARCH_CONFIGS,
  userId: string | null,
  options?: UseGlobalSearchOptions
): UseGlobalSearchReturn<T> => {
  const config = SEARCH_CONFIGS[entityType] as SearchConfig;
  return useGlobalSearch<T>(config, userId, options);
};

/**
 * Hook for multi-table search across multiple entity types
 */
interface UseMultiSearchOptions extends UseGlobalSearchOptions {
  entityTypes: Array<keyof typeof SEARCH_CONFIGS>;
}

interface UseMultiSearchReturn {
  search: (query: string) => Promise<void>;
  results: Record<string, any[]>;
  isSearching: boolean;
  error: string | null;
  query: string;
  clear: () => void;
}

export const useMultiSearch = (
  userId: string | null,
  options: UseMultiSearchOptions
): UseMultiSearchReturn => {
  const { debounceMs = 500, entityTypes, cacheResults = true } = options;

  const [results, setResults] = useState<Record<string, any[]>>({});
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const cacheRef = useRef<Map<string, Record<string, SearchResult>>>(new Map());

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const executeSearch = useCallback(
    async (searchQuery: string) => {
      if (!userId) {
        setError('User not authenticated');
        return;
      }

      // Check cache first
      if (cacheResults && cacheRef.current.has(searchQuery)) {
        const cached = cacheRef.current.get(searchQuery)!;
        const formattedResults = Object.entries(cached).reduce(
          (acc, [key, result]) => {
            acc[key] = result.data;
            return acc;
          },
          {} as Record<string, any[]>
        );
        setResults(formattedResults);
        return;
      }

      setIsSearching(true);
      setError(null);

      try {
        const configs = entityTypes.map(entityType => ({
          key: entityType,
          config: SEARCH_CONFIGS[entityType]
        }));

        const multiResults = await globalSearchService.searchMultiple(
          configs,
          userId,
          searchQuery
        );

        // Cache the result
        if (cacheResults) {
          cacheRef.current.set(searchQuery, multiResults);
        }

        const formattedResults = Object.entries(multiResults).reduce(
          (acc, [key, result]) => {
            acc[key] = result.data;
            return acc;
          },
          {} as Record<string, any[]>
        );

        setResults(formattedResults);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Search failed';
        setError(errorMessage);
        console.error('Multi-search error:', err);
      } finally {
        setIsSearching(false);
      }
    },
    [userId, entityTypes, cacheResults]
  );

  const search = useCallback(
    async (searchQuery: string) => {
      setQuery(searchQuery);

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      if (!searchQuery.trim()) {
        setResults({});
        return;
      }

      debounceTimerRef.current = setTimeout(() => {
        executeSearch(searchQuery);
      }, debounceMs);
    },
    [debounceMs, executeSearch]
  );

  const clear = useCallback(() => {
    setResults({});
    setQuery('');
    setError(null);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
  }, []);

  return {
    search,
    results,
    isSearching,
    error,
    query,
    clear
  };
};
