import { supabase } from '@/integrations/supabase/client';

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

    try {
      // Don't escape or lowercase for now - let Supabase handle it
      const searchTerm = query.trim();

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
        console.error(`Search error for ${config.tableName}:`, error);
        return { data: [], totalCount: 0, query, timestamp: Date.now() };
      }

      if (!data) {
        return { data: [], totalCount: 0, query, timestamp: Date.now() };
      }

      // Apply client-side filters for array fields
      // NOTE: These are ADDITIONAL filters that work in OR with the database filters
      // If no clientFilters are defined, return all database results as-is
      let filteredData = data || [];
      
      if (config.clientFilters && config.clientFilters.length > 0) {
        const searchLower = searchTerm.toLowerCase();
        
        // Filter: return items that match the search in clientFilter fields
        // This is used for fields that the database query couldn't search
        // OR return all items if database already found them through searchFields
        filteredData = filteredData.filter((item: any) => {
          // First, check if item was already matched by database search (searchFields)
          // We assume it was if the database returned it
          // So we DON'T apply additional filtering here - just return all results
          return true;
        });
      }

      return {
        data: filteredData as T[],
        totalCount: filteredData.length,
        query,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error(`Global search error for ${config.tableName}:`, error);
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
    limit: 50
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
  } as SearchConfig
};
