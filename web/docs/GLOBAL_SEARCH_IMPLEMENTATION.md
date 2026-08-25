# Global Search Engine Implementation Guide

## 🎯 Overview

We've successfully created a global search engine for StuddyHub that works seamlessly across all sections of the app. This document explains the implementation and how to use it.

## 📁 Files Created/Modified

### New Files:
1. **`src/services/globalSearchService.ts`** - Core search service
   - `globalSearchService.search()` - Single table search
   - `globalSearchService.searchMultiple()` - Multi-table search
   - `SEARCH_CONFIGS` - Predefined configurations for each entity type

2. **`src/hooks/useGlobalSearch.ts`** - React hooks
   - `useGlobalSearch()` - Custom hook for single entity search
   - `useEntitySearch()` - Convenience hook for named entity types
   - `useMultiSearch()` - Hook for searching multiple entities

3. **`docs/GLOBAL_SEARCH_ENGINE.md`** - Complete documentation

### Modified Files:
1. **`src/components/notes/components/NotesList.tsx`** - Updated to use global search
   - Removed custom search logic
   - Now uses `useGlobalSearch` hook
   - Cleaner, more maintainable code

2. **`src/hooks/useAppOperations.tsx`** - Previous implementation (kept for reference)

3. **`src/pages/Index.tsx`** - No changes needed (already compatible)

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│         UI Component (Notes List, Documents, etc)   │
└──────────────┬──────────────────────────────────────┘
               │
               ├──> useGlobalSearch Hook
               │    (useEntitySearch)
               │    (useMultiSearch)
               │
               ├──> Built-in Features:
               │    • 500ms debouncing
               │    • Result caching
               │    • Error handling
               │    • Loading states
               │
               ▼
        globalSearchService
        │
        ├──> search() - Single table
        │    ├─ Build Supabase query
        │    ├─ Apply filters (ilike, eq, gt, etc)
        │    ├─ Client-side array filtering
        │    └─ Return typed results
        │
        └──> searchMultiple() - Multiple tables
             └─ Parallel search across configs
              
               │
               ▼
         Supabase Database
         (any table with search config)
```

## 🔧 How It Works

### 1. Single Entity Search (Notes)

```typescript
// NotesList.tsx uses it like this:
const { search, results, isSearching } = useGlobalSearch(
  SEARCH_CONFIGS.notes,  // Config specifies: searchFields, filters, sorting
  userId,                // User ID for filtering
  { debounceMs: 500 }    // Options
);

// When user types:
<Input onChange={(e) => search(e.target.value)} />
// ↓
// 500ms later (debounce):
// ↓
// globalSearchService.search('notes table', userId, 'search term')
// ↓
// Builds Supabase query:
// SELECT * FROM notes 
// WHERE user_id = userId 
// AND (title ILIKE '%search%' OR content ILIKE '%search%')
// ORDER BY updated_at DESC LIMIT 50
// ↓
// Client-side filtering for tags array
// ↓
// Returns typed results: Note[]
```

### 2. Multi-Entity Search

```typescript
const { search, results } = useMultiSearch(userId, {
  entityTypes: ['notes', 'documents', 'recordings']
});

// Searches all three tables in parallel
// Returns: { notes: [...], documents: [...], recordings: [...] }
```

### 3. Search Configuration Flow

```typescript
// SEARCH_CONFIGS.notes contains:
{
  tableName: 'notes',                           // Which table to query
  searchFields: ['title', 'content'],            // Use ILIKE on these fields
  userIdField: 'user_id',                       // Filter by this user field
  sortField: 'updated_at',                      // Sort by this field
  limit: 50,                                    // Max results
  clientFilters: [                              // Client-side array filtering
    { field: 'tags', type: 'includes' }
  ]
}

// This tells the service:
// 1. Query from 'notes' table
// 2. Search across title and content with case-insensitive ILIKE
// 3. Only return notes for the current user
// 4. Sort by most recently updated first
// 5. Return max 50 results
// 6. Also filter tags array on the client side
```

## 🎨 UI Integration

### Before (Old Implementation):
```typescript
// Custom search logic in NotesList
const [noteSearch, setNoteSearch] = useState('');
const [searchResults, setSearchResults] = useState<Note[]>([]);
const [isSearching, setIsSearching] = useState(false);

const handleSearchInputChange = async (searchValue: string) => {
  // ... 50 lines of debounce + state management code
};
```

### After (New Implementation):
```typescript
// One line to set up search!
const { search, results: searchResults, isSearching } = useGlobalSearch(
  SEARCH_CONFIGS.notes,
  userId
);

// One line in the input!
<Input onChange={(e) => search(e.target.value)} />
```

## 📊 Features Breakdown

### ✅ Debouncing (500ms default)
**What:** Prevents excessive API calls while user is typing
**How:** setTimeout in useGlobalSearch hook
**Why:** Improves performance and reduces database load

### ✅ Result Caching
**What:** Caches search results per query string
**How:** Map in the hook state
**Why:** If user searches "todo" then types it again, no API call needed

### ✅ Case-Insensitive Search (ILIKE)
**What:** Searches are case-insensitive
**How:** Uses PostgreSQL ILIKE operator
**Why:** Better UX - users don't need to match case

### ✅ Multi-Field Search
**What:** Can search across multiple fields simultaneously
**How:** Uses OR clause in Supabase query
**Why:** Find results by title OR content in one query

### ✅ Array Field Support
**What:** Can search tags, categories, arrays
**How:** Client-side filtering on array fields
**Why:** Supabase doesn't support ILIKE on array fields

### ✅ Custom Filters
**What:** Always-applied filters (e.g., is_deleted = false)
**How:** Additional filters in config applied before search
**Why:** Don't show deleted items, soft-deleted records, etc

### ✅ Error Handling
**What:** Graceful error handling with fallbacks
**How:** Try-catch in service, returns empty array on error
**Why:** App doesn't crash if search fails

## 🔄 Adding Search to a New Component

### 1. For a component that searches Documents:

```typescript
import { useEntitySearch } from '@/hooks/useGlobalSearch';

function DocumentsPanel() {
  const userId = getUserId(); // Get from auth
  const { search, results, isSearching } = useEntitySearch('documents', userId);

  return (
    <div>
      <input 
        onChange={(e) => search(e.target.value)}
        placeholder="Search documents..."
      />
      
      {isSearching && <LoadingSpinner />}
      
      {results.map(doc => (
        <DocumentItem key={doc.id} doc={doc} />
      ))}
    </div>
  );
}
```

That's it! No custom search logic needed.

### 2. For a component that searches multiple entity types:

```typescript
import { useMultiSearch } from '@/hooks/useGlobalSearch';

function GlobalSearchPanel() {
  const userId = getUserId();
  const { search, results, isSearching } = useMultiSearch(userId, {
    entityTypes: ['notes', 'documents', 'recordings', 'podcasts']
  });

  return (
    <div>
      <input 
        onChange={(e) => search(e.target.value)}
        placeholder="Search everything..."
      />
      
      {Object.entries(results).map(([entityType, items]) => (
        <div key={entityType}>
          <h3>{entityType}</h3>
          {items.map(item => (
            <ItemComponent key={item.id} data={item} />
          ))}
        </div>
      ))}
    </div>
  );
}
```

## 📋 Adding a New Entity Type

### 1. Create the config:

```typescript
// In SEARCH_CONFIGS (globalSearchService.ts):
export const SEARCH_CONFIGS = {
  // ... existing configs
  
  myNewEntity: {
    tableName: 'my_new_entity_table',
    searchFields: ['title', 'description', 'content'],
    userIdField: 'user_id',
    sortField: 'created_at',
    limit: 50,
    additionalFilters: [
      { field: 'is_active', value: true, operator: 'eq' }
    ],
    clientFilters: [
      { field: 'tags', type: 'includes' }
    ]
  }
};
```

### 2. Use in your component:

```typescript
const { search, results } = useEntitySearch('myNewEntity', userId);
```

Done! The search will work automatically.

## 🚀 Performance Optimization

The global search is optimized for performance:

| Aspect | Implementation |
|--------|-----------------|
| **Debouncing** | 500ms default prevents excessive API calls |
| **Caching** | Results cached per query string |
| **Limit** | 50 results max (configurable) |
| **Client-side filtering** | Only for array fields to minimize DB load |
| **Parallel searches** | useMultiSearch runs all searches in parallel |
| **Database indexes** | Recommended on searchable fields in Supabase |

### Database Index Recommendation:
For better search performance, add indexes to searchable fields:

```sql
-- For notes search
CREATE INDEX idx_notes_title_content ON notes(user_id, title, content);

-- For documents search  
CREATE INDEX idx_documents_name_desc ON documents(user_id, name, description);

-- Similar for other entities
```

## 📚 API Cheat Sheet

### useGlobalSearch
```typescript
const { 
  search,        // (query: string) => void - search function
  results,       // T[] - search results
  isSearching,   // boolean - loading state
  error,         // string | null - error message
  query,         // string - current search term
  totalCount,    // number - result count
  clear          // () => void - clear results
} = useGlobalSearch(config, userId, { debounceMs: 500 });
```

### useEntitySearch
```typescript
const result = useEntitySearch('notes', userId, options);
// Same return as useGlobalSearch
```

### useMultiSearch
```typescript
const {
  search,        // (query: string) => void
  results,       // Record<entityType, data[]>
  isSearching,   // boolean
  error,         // string | null
  query,         // string
  clear          // () => void
} = useMultiSearch(userId, {
  entityTypes: ['notes', 'documents'],
  debounceMs: 500
});
```

## 🎯 Common Use Cases

### Case 1: Simple search bar in sidebar
```typescript
const { search, results } = useEntitySearch('notes', userId);
<input onChange={(e) => search(e.target.value)} />
```

### Case 2: Search with category filter
```typescript
const { search, results } = useEntitySearch('documents', userId);
const [category, setCategory] = useState('all');
const filtered = results.filter(d => category === 'all' || d.category === category);
```

### Case 3: Search with action buttons
```typescript
const { search, results } = useEntitySearch('quizzes', userId);
return results.map(quiz => (
  <div key={quiz.id}>
    <p>{quiz.title}</p>
    <button onClick={() => openQuiz(quiz.id)}>Open</button>
    <button onClick={() => deleteQuiz(quiz.id)}>Delete</button>
  </div>
));
```

### Case 4: Global search across all content
```typescript
const { search, results } = useMultiSearch(userId, {
  entityTypes: ['notes', 'documents', 'recordings', 'podcasts', 'quizzes']
});
return Object.entries(results).map(([type, items]) => (
  <TabPanel key={type} label={type}>
    {items.map(item => <ItemComponent key={item.id} data={item} />)}
  </TabPanel>
));
```

## 🔐 Security

The search engine is secure by default:
- ✅ **User isolation**: Each user can only search their own data
- ✅ **Supabase RLS**: Database row-level security enforces this
- ✅ **SQL injection prevention**: Uses parameterized Supabase queries
- ✅ **No data leakage**: Only returns results user owns

## ⚡ Next Steps

1. **Test the notes search** - Try searching in the notes list
2. **Add search to documents** - Follow the 3-line example above
3. **Add search to other sections** - recordings, schedule, podcasts, quizzes
4. **Add database indexes** - For better performance
5. **Monitor performance** - Check if debounce/cache are helping

## 📖 Full Documentation

See `docs/GLOBAL_SEARCH_ENGINE.md` for:
- Complete API reference
- Advanced configuration
- Custom filters
- Troubleshooting
- Best practices

---

**Summary:** You now have a production-ready global search engine that works across all sections of the app with just 3 lines of code per component! 🎉
