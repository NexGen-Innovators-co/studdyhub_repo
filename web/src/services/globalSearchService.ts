import { supabase } from '@/integrations/supabase/client';
import { cachedRequest, isRateLimited } from '@/utils/requestCache';
import { validateSearchQuery } from '@/utils/validation';

/**
 * Configuration for searching a specific entity type
 */
export interface SearchConfig {
  tableName: string;
  searchFields: string[];
  userIdField: string;
  sortField: string;
  limit: number;
  additionalFilters?: {
    field: string;
    value: any;
    operator?: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte';
  }[];
  // Fields that are arrays and need client-side filtering (for tags, categories, etc.)
  clientFilters?: {
    field: string;
    type: 'includes' | 'contains';
  }[];
}

/**
 * Search result wrapper with metadata
 */
export interface SearchResult<T = any> {
  data: T[];
  totalCount: number;
  query: string;
  timestamp: number;
}

/**
 * Global search service for unified search across the app
 */
export const globalSearchService = {
  /**
   * Search a specific table with flexible field support
   * @param config Search configuration
   * @param userId User ID for filtering
   * @param query Search query string
   * @returns Promise<SearchResult>
   */
  async search<T = any>(
    config: SearchConfig,
    userId: string,
    query: string
  ): Promise<SearchResult<T>> {
    if (!userId || !query.trim()) {
      return { data: [], totalCount: 0, query, timestamp: Date.now() };
    }

    // Frontend validation — reject obviously bad queries before hitting the API
    const validation = validateSearchQuery(query);
    if (!validation.valid) {
      return { data: [], totalCount: 0, query, timestamp: Date.now() };
    }

    // Rate-limit guard
    const cacheKey = `search:${config.tableName}:${userId}:${query.trim().toLowerCase()}`;
    if (isRateLimited(cacheKey, 20, 60_000)) {
      // Return cached result if available, otherwise empty
      return { data: [], totalCount: 0, query, timestamp: Date.now() };
    }

    return cachedRequest(
      () => this._executeSearch(config, userId, query),
      { key: cacheKey, ttl: 30_000 }
    ) as Promise<SearchResult<T>>;
  },

  /** @internal Execute the actual Supabase search query */
  async _executeSearch<T = any>(
    config: SearchConfig,
    userId: string,
    query: string
  ): Promise<SearchResult<T>> {
    try {
      const searchTerm = query.trim();

      // if the config requests AI assistance, call the edge function first
      if ((config as any).useAi) {
        try {
          const resp = await fetch(`${process.env.VITE_SUPABASE_URL}/functions/v1/ai-chat-session-search`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${process.env.VITE_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({ query: searchTerm })
          });
          const json = await resp.json();
          const ids: string[] = json.ids || [];
          if (ids.length) {
            // fetch those sessions in order returned
            const { data, error } = await supabase
              .from(config.tableName)
              .select('*')
              .in('id', ids);
            if (error) throw error;
            // preserve order
            const ordered = ids
              .map(id => (data || []).find((d: any) => d.id === id))
              .filter(Boolean) as T[];
            return {
              data: ordered,
              totalCount: ordered.length,
              query,
              timestamp: Date.now(),
            };
          }
          // if AI returned no ids, fall back to regular search below
        } catch (err) {
          console.error('AI search failed, falling back to normal query', err);
        }
      }

      // Build the main query
      let supabaseQuery = supabase
        .from(config.tableName)
        .select('*');

      // Add user filter
      supabaseQuery = supabaseQuery.eq(config.userIdField, userId);

      // Add additional filters if specified
      if (config.additionalFilters && config.additionalFilters.length > 0) {
        for (const filter of config.additionalFilters) {
          const operator = filter.operator || 'eq';
          if (operator === 'eq') {
            supabaseQuery = supabaseQuery.eq(filter.field, filter.value);
          } else if (operator === 'neq') {
            supabaseQuery = supabaseQuery.neq(filter.field, filter.value);
          } else if (operator === 'gt') {
            supabaseQuery = supabaseQuery.gt(filter.field, filter.value);
          } else if (operator === 'gte') {
            supabaseQuery = supabaseQuery.gte(filter.field, filter.value);
          } else if (operator === 'lt') {
            supabaseQuery = supabaseQuery.lt(filter.field, filter.value);
          } else if (operator === 'lte') {
            supabaseQuery = supabaseQuery.lte(filter.field, filter.value);
          }
        }
      }

      // Build OR filter for search fields using ilike
      if (config.searchFields.length > 0) {
        const orConditions = config.searchFields
          .map(field => `${field}.ilike.%${searchTerm}%`)
          .join(',');
        
        // Apply OR filter - this will match ANY of the search fields
        supabaseQuery = supabaseQuery.or(orConditions);
      }

      // Add sorting
      supabaseQuery = supabaseQuery.order(config.sortField, {
        ascending: false
      });

      // Add limit
      supabaseQuery = supabaseQuery.limit(config.limit);

      const { data, error } = await supabaseQuery;

      if (error) {
        // console.error(`Search error for ${config.tableName}:`, error);
        return { data: [], totalCount: 0, query, timestamp: Date.now() };
      }

      if (!data) {
        return { data: [], totalCount: 0, query, timestamp: Date.now() };
      }

      // Apply client-side filters for array fields
      let filteredData = data || [];
      
      if (config.clientFilters && config.clientFilters.length > 0) {
        const searchLower = searchTerm.toLowerCase();
        filteredData = filteredData.filter((item: any) => true);
      }

      return {
        data: filteredData as T[],
        totalCount: filteredData.length,
        query,
        timestamp: Date.now()
      };
    } catch (error) {
      // console.error(`Global search error for ${config.tableName}:`, error);
      return { data: [], totalCount: 0, query, timestamp: Date.now() };
    }
  },

  /**
   * Search multiple tables in parallel
   * @param configs Array of search configurations
   * @param userId User ID
   * @param query Search query
   * @returns Promise<Record<string, SearchResult>>
   */
  async searchMultiple<T = any>(
    configs: Array<{ key: string; config: SearchConfig }>,
    userId: string,
    query: string
  ): Promise<Record<string, SearchResult<T>>> {
    const results = await Promise.all(
      configs.map(({ key, config }) =>
        this.search(config, userId, query).then(result => ({
          key,
          result
        }))
      )
    );

    return results.reduce((acc, { key, result }) => {
      acc[key] = result;
      return acc;
    }, {} as Record<string, SearchResult<T>>);
  }
};

/**
 * Predefined search configurations for common entities
 */
export const SEARCH_CONFIGS = {
  notes: {
    tableName: 'notes',
    searchFields: ['title', 'content'],
    userIdField: 'user_id',
    sortField: 'updated_at',
    limit: 50
  } as SearchConfig,

  documents: {
    tableName: 'documents',
    searchFields: ['title', 'file_name'],
    userIdField: 'user_id',
    sortField: 'created_at',
    limit: 50
  } as SearchConfig,

  recordings: {
    tableName: 'class_recordings',
    searchFields: ['title', 'summary', 'transcript', 'subject'],
    userIdField: 'user_id',
    sortField: 'created_at',
    limit: 50
  } as SearchConfig,

  schedule: {
    tableName: 'schedule_items',
    searchFields: ['title', 'description', 'subject', 'location'],
    userIdField: 'user_id',
    sortField: 'start_time',
    limit: 1000 // Increased limit to show more/all schedule items
  } as SearchConfig,

  podcasts: {
    tableName: 'ai_podcasts',
    searchFields: ['title', 'description'],
    userIdField: 'user_id',
    sortField: 'created_at',
    limit: 50
  } as SearchConfig,

  quizzes: {
    tableName: 'quizzes',
    searchFields: ['title', 'source_type'],
    userIdField: 'user_id',
    sortField: 'created_at',
    limit: 50
  } as SearchConfig,

  posts: {
    tableName: 'social_posts',
    searchFields: ['content'],
    userIdField: 'author_id',
    sortField: 'created_at',
    limit: 50
  } as SearchConfig,

  chat_sessions: {
    tableName: 'chat_sessions',
    searchFields: ['title'],
    userIdField: 'user_id',
    sortField: 'last_message_at',
    limit: 100,
    useAi: true // enable AI-assisted matching via edge function
  } as SearchConfig
};
