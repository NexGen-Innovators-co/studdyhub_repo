# Global Search - Developer Quick Reference

## What is Global Search?

A unified search system that allows users to search the database directly from any component in the app. Instead of searching only cached/loaded data, it queries the database in real-time.

## Components Using Global Search (8 Total)

| Component | Search Type | Location | Status |
|-----------|------------|----------|---------|
| Notes | Title + Content | Notes tab | ✅ Active |
| Documents | Name + Description | Documents section | ✅ Active |
| Recordings | Title + Description | Class Recordings | ✅ Active |
| Schedule | Title + Description | Schedule view | ✅ Active |
| Podcasts | Title + Description | Podcasts section | ✅ Active |
| Quizzes | Title + Description | Quizzes list | ✅ Active |
| Social Posts | Content + Title | Social Feed | ✅ Active |
| Note Selector | Title + Content | Quiz generator | ✅ Active |

## For Users - How to Use

1. **Go to any section** (Notes, Documents, Podcasts, etc.)
2. **Type in the search box** (usually at the top)
3. **Results appear automatically** from the database
4. **Click a result** to select or open it
5. **Clear search** to see all items again

## For Developers - Integration Pattern

### Minimal Setup (Copy-Paste Ready)

```typescript
import { useGlobalSearch } from '@/hooks/useGlobalSearch';
import { SEARCH_CONFIGS } from '@/services/globalSearchService';
import { supabase } from '@/integrations/supabase/client';

export const YourComponent = () => {
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

  // Initialize search
  const { search, results: searchResults, isSearching } = useGlobalSearch(
    SEARCH_CONFIGS.documents, // ← Change this per component
    userId,
    { debounceMs: 500 }
  );

  // Handle search input changes
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (!value.trim()) {
      setHasSearched(false);
    } else {
      setHasSearched(true);
      search(value);
    }
  };

  // Decide what to display
  const displayItems = hasSearched && searchQuery.trim() 
    ? searchResults 
    : allItems;

  return (
    <>
      <Input 
        value={searchQuery}
        onChange={(e) => handleSearchChange(e.target.value)}
        placeholder="Search..."
        disabled={isSearching}
      />
      {isSearching && <Loader2 className="animate-spin" />}
      
      {displayItems.map(item => (
        <ItemCard key={item.id} item={item} />
      ))}
    </>
  );
};
```

## Available Search Configs

Use these in your component:

```typescript
SEARCH_CONFIGS.notes       // Search notes by title + content
SEARCH_CONFIGS.documents   // Search documents by name + description
SEARCH_CONFIGS.recordings  // Search recordings by title + description
SEARCH_CONFIGS.schedule    // Search schedule by title + description
SEARCH_CONFIGS.podcasts    // Search podcasts by title + description
SEARCH_CONFIGS.quizzes     // Search quizzes by title + description
SEARCH_CONFIGS.posts       // Search social posts by content + title
```

## useGlobalSearch Hook

### What It Returns

```typescript
const {
  search,        // Function: (query: string) => void - trigger search
  results,       // Array: T[] - search results
  isSearching,   // Boolean: true while searching
  error,         // String | null - error message if any
  query,         // String - current search query
  totalCount,    // Number - result count
  clear          // Function: () => void - clear results
} = useGlobalSearch(config, userId, options);
```

### Parameters

```typescript
useGlobalSearch(
  SEARCH_CONFIGS.documents,  // SearchConfig object
  userId,                     // string | null (user's ID)
  { debounceMs: 500 }        // Options (optional)
)
```

## Key Features

### Debounce (500ms)
Prevents excessive database queries by waiting for user to stop typing.

### Caching
Results cached per search term to avoid duplicate queries.

### Result Limiting
Max 50 results per search for performance.

### User Scoping
Only returns user's own data (filtered by user_id).

### Case Insensitive
Uses ILIKE for flexible matching.

### Substring Matching
Finds partial matches:
- Search "MCMP" finds "MCMP.pdf", "Important MCMP Notes", etc.
- Search "python" finds "Learn Python", "Python Basics", etc.

## Step-by-Step Integration

### Step 1: Import
```typescript
import { useGlobalSearch } from '@/hooks/useGlobalSearch';
import { SEARCH_CONFIGS } from '@/services/globalSearchService';
```

### Step 2: Add State
```typescript
const [userId, setUserId] = useState<string | null>(null);
const [searchQuery, setSearchQuery] = useState('');
const [hasSearched, setHasSearched] = useState(false);
```

### Step 3: Get User
```typescript
useEffect(() => {
  const getUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id || null);
  };
  getUser();
}, []);
```

### Step 4: Initialize Hook
```typescript
const { search, results: searchResults, isSearching } = useGlobalSearch(
  SEARCH_CONFIGS.documents,  // ← Pick your config
  userId,
  { debounceMs: 500 }
);
```

### Step 5: Add Search Handler
```typescript
const handleSearchChange = (value: string) => {
  setSearchQuery(value);
  if (!value.trim()) {
    setHasSearched(false);
  } else {
    setHasSearched(true);
    search(value);
  }
};
```

### Step 6: Wire Up Input
```tsx
<Input 
  onChange={(e) => handleSearchChange(e.target.value)}
  disabled={isSearching}
/>
```

### Step 7: Display Results
```tsx
const displayItems = hasSearched && searchQuery.trim() 
  ? searchResults 
  : items;

{displayItems.map(item => <ItemCard item={item} />)}
```

## Creating New Search Configs

Edit [src/services/globalSearchService.ts](src/services/globalSearchService.ts):

```typescript
export const SEARCH_CONFIGS = {
  // ... existing configs ...
  
  myNewTable: {
    tableName: 'my_table_name',
    searchFields: ['field1', 'field2', 'field3'],
    userIdField: 'user_id',
    sortField: 'created_at',
    limit: 50,
    additionalFilters: [
      { field: 'is_deleted', value: false, operator: 'eq' }
    ]
  } as SearchConfig
};
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| No results | Check if item exists, try partial search |
| Spinner never stops | Check console errors, verify userId |
| Old/stale results | Results are always fresh from database |
| Component not searching | Verify imports, check userId, verify config |

## Security & Privacy

✅ User scoped - only shows user's own data  
✅ No SQL injection - automatic escaping  
✅ Deleted items excluded - where configured  
✅ Real-time queries - never stale  

## Files

- **Hook**: [src/hooks/useGlobalSearch.ts](src/hooks/useGlobalSearch.ts)
- **Service**: [src/services/globalSearchService.ts](src/services/globalSearchService.ts)
- **Full Docs**: [docs/GLOBAL_SEARCH_INTEGRATION_COMPLETE.md](../docs/GLOBAL_SEARCH_INTEGRATION_COMPLETE.md)

## Example: Adding Search to New Component

```tsx
// Before: No search
export const MyList = ({ items }) => {
  return items.map(item => <Item item={item} />);
};

// After: With global search
import { useGlobalSearch } from '@/hooks/useGlobalSearch';
import { SEARCH_CONFIGS } from '@/services/globalSearchService';
import { supabase } from '@/integrations/supabase/client';

export const MyList = ({ items }) => {
  const [userId, setUserId] = useState(null);
  const [query, setQuery] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id || null);
    });
  }, []);

  const { search, results: searchResults, isSearching } = useGlobalSearch(
    SEARCH_CONFIGS.documents, // ← Change this
    userId
  );

  const handleSearch = (value) => {
    setQuery(value);
    if (value.trim()) {
      setHasSearched(true);
      search(value);
    } else {
      setHasSearched(false);
    }
  };

  const display = hasSearched && query.trim() ? searchResults : items;

  return (
    <>
      <input 
        value={query}
        onChange={e => handleSearch(e.target.value)}
        placeholder="Search..."
      />
      {isSearching && <span>Searching...</span>}
      {display.map(item => <Item item={item} />)}
    </>
  );
};
```

## Best Practices

✅ Always initialize hasSearched state  
✅ Always check userId before hook initialization  
✅ Show loading state while searching  
✅ Fall back to local items when not searching  
✅ Clear search when component unmounts  
✅ Use appropriate SEARCH_CONFIG for entity type  

## Limitations & Future Work

- Max 50 results (configurable)
- Title/content fields only (no full-text yet)
- No search history
- No fuzzy matching
- No voice search (yet)

---

**Status**: Production Ready ✅  
**All Components**: 8/8 Integrated ✅  
**Last Updated**: February 2, 2026  
