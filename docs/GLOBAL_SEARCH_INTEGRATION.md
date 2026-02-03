# Global Search Integration Guide

## Overview
The global search system has been successfully integrated with the database. All search queries now fetch directly from the database using Supabase's PostgREST API with case-insensitive ILIKE pattern matching.

## How It Works

### 1. **Search Service** (`src/services/globalSearchService.ts`)
- Provides `search()` method that queries Supabase tables
- Supports:
  - User filtering (via `user_id`)
  - Multiple search fields (title, content, description, etc.)
  - Custom additional filters (e.g., `is_deleted = false`)
  - Sorting and limiting results
  - Predefined configs for common entities

### 2. **Custom Hook** (`src/hooks/useGlobalSearch.ts`)
- Wraps the search service with React state management
- Features:
  - Debounced search (500ms default)
  - Result caching
  - Error handling
  - Loading states

### 3. **Predefined Configs** (`SEARCH_CONFIGS`)
Available for:
- `notes` - Searches title & content
- `documents` - Searches name & description (excludes deleted)
- `recordings` - Searches title & description
- `schedule` - Searches title & description
- `podcasts` - Searches title & description (excludes deleted)
- `quizzes` - Searches title & description

## Integration Pattern

### For List Components

```tsx
import { useGlobalSearch } from '@/hooks/useGlobalSearch';
import { SEARCH_CONFIGS } from '@/services/globalSearchService';
import { supabase } from '@/integrations/supabase/client';

export const YourListComponent = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  
  // Get user ID
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    };
    getUser();
  }, []);

  // Use global search for your entity type
  const { search, results: searchResults, isSearching } = useGlobalSearch(
    SEARCH_CONFIGS.notes, // Change to your entity type
    userId,
    { debounceMs: 500 }
  );

  // Handle search
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (!value.trim()) {
      setHasSearched(false);
    } else {
      setHasSearched(true);
      search(value);
    }
  };

  // Determine which items to display
  const displayItems = hasSearched && searchQuery.trim() 
    ? searchResults 
    : fallbackItems; // Your local items

  return (
    <div>
      <SearchInput 
        value={searchQuery}
        onChange={handleSearchChange}
        isLoading={isSearching}
      />
      <ItemsList items={displayItems} />
    </div>
  );
};
```

## Components Already Integrated

✅ **NotesList** (`src/components/notes/components/NotesList.tsx`)
- Searches notes by title and content
- Uses global search hook
- Falls back to local items when not searching

## Components to Integrate

### 1. **Documents** - Update DocumentUpload.tsx or similar
Add global search for documents with:
- Search config: `SEARCH_CONFIGS.documents`
- Shows files by name and description

### 2. **Class Recordings** - Update ClassRecordings.tsx
Add global search for recordings with:
- Search config: `SEARCH_CONFIGS.recordings`
- Shows by title and description

### 3. **Schedule** - Update Schedule.tsx
Add global search for schedule items with:
- Search config: `SEARCH_CONFIGS.schedule`
- Shows by title and description

### 4. **Podcasts** - Update PodcastsPage.tsx
Add global search for podcasts with:
- Search config: `SEARCH_CONFIGS.podcasts`
- Shows by title and description

### 5. **Quizzes** - Update Quizzes.tsx
Add global search for quizzes with:
- Search config: `SEARCH_CONFIGS.quizzes`
- Shows by title and description

### 6. **Social Feed** - Update SocialFeed.tsx
Can optionally add search for posts with:
- Create new config: `posts` with fields like title, content, author

## Database Requirements

For each entity type, ensure the table has:
- `user_id` column (for user filtering)
- Search field columns (title, description, content, name, etc.)
- Proper indexes on search fields for performance

Example indexes:
```sql
CREATE INDEX idx_notes_title_search ON notes USING GIN (title gin_trgm_ops);
CREATE INDEX idx_notes_content_search ON notes USING GIN (content gin_trgm_ops);
```

## Performance Considerations

1. **Debounce** - Set appropriate debounce value (500ms is default)
2. **Result Limiting** - Configs limit results to 50 by default
3. **Caching** - Results are cached to avoid duplicate queries
4. **ILIKE Operator** - Case-insensitive substring matching, good for user experience

## Troubleshooting

### Search returns no results
1. Check user ID is set correctly
2. Verify search term matches data in table
3. Check browser console for errors
4. Ensure database has data for that user

### Search is slow
1. Increase debounce delay
2. Check database indexes
3. Consider reducing result limit
4. Add WHERE conditions to filter before search

### Results not updating
1. Verify data is being returned (check network tab)
2. Check if `hasSearched` state is being set
3. Verify search results are being used in render

## Future Enhancements

- [ ] Full-text search using PostgreSQL tsvector
- [ ] Advanced filters (date ranges, categories, tags)
- [ ] Search history/recent searches
- [ ] Search analytics
- [ ] Faceted search (filter results by category, date, etc.)
- [ ] Search suggestions/autocomplete
