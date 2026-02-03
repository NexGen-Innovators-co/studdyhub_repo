import React, { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { useGlobalSearch } from '../../hooks/useGlobalSearch';
import { SearchConfig, SEARCH_CONFIGS } from '../../services/globalSearchService';
import { supabase } from '../../integrations/supabase/client';

interface SearchableListProps<T> {
  entityType: keyof typeof SEARCH_CONFIGS;
  children: (props: {
    items: T[];
    isSearching: boolean;
    searchQuery: string;
    filteredItemsCount: number;
  }) => React.ReactNode;
  fallbackItems?: T[];
  debounceMs?: number;
}

/**
 * Reusable SearchableList component that integrates global search
 * Provides search functionality for any entity type with predefined config
 */
export const SearchableList = React.forwardRef<
  HTMLDivElement,
  SearchableListProps<any>
>(({
  entityType,
  children,
  fallbackItems = [],
  debounceMs = 500
}, ref) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Get user ID
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    };
    getUser();
  }, []);

  // Use global search hook
  const { search, results: searchResults, isSearching } = useGlobalSearch(
    SEARCH_CONFIGS[entityType],
    userId,
    { debounceMs }
  );

  // Handle search input change
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (!value.trim()) {
      setHasSearched(false);
    } else {
      setHasSearched(true);
      search(value);
    }
  };

  // Clear search
  const handleClearSearch = () => {
    setSearchQuery('');
    setHasSearched(false);
  };

  // Use search results if searching, otherwise use fallback items
  const displayItems = hasSearched && searchQuery.trim() ? searchResults : fallbackItems;

  return (
    <div ref={ref} className="flex flex-col h-full">
      {/* Search Input */}
      <div className="px-3 sm:px-4 pt-2 pb-3 border-b border-slate-200 dark:border-gray-800">
        <div className="relative">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={`Search ${entityType}...`}
            className="pl-9 pr-10"
          />
          {isSearching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="h-4 w-4 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
            </div>
          )}
          {searchQuery && !isSearching && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-slate-500"
              onClick={handleClearSearch}
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      {children({
        items: displayItems,
        isSearching,
        searchQuery,
        filteredItemsCount: displayItems.length
      })}
    </div>
  );
});

SearchableList.displayName = 'SearchableList';
