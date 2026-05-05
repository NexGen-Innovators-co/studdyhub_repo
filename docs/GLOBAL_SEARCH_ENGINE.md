# Global Search Engine Documentation

## Overview

The global search engine provides a unified, reusable search solution across the entire StuddyHub application. It supports searching across multiple entity types (notes, documents, recordings, schedule items, podcasts, quizzes) with flexible configuration and consistent behavior.

## Architecture

### Core Components

1. **globalSearchService** (`src/services/globalSearchService.ts`)
   - Core search logic using Supabase
   - Handles multi-table searches
   - Configurable search fields and filters

2. **useGlobalSearch Hook** (`src/hooks/useGlobalSearch.ts`)
   - React hook wrapper for search functionality
   - Built-in debouncing (500ms default)
   - Result caching
   - Error handling

3. **Search Configs** (`SEARCH_CONFIGS`)
   - Predefined configurations for each entity type
   - Specifies searchable fields, filters, sorting, limits

## Usage Guide

### Basic Search for a Single Entity Type

```typescript
import { useGlobalSearch } from '@/hooks/useGlobalSearch';
import { SEARCH_CONFIGS } from '@/services/globalSearchService';

function MyComponent() {
  const userId = 'user-123'; // Get from auth
  const { search, results, isSearching, query } = useGlobalSearch(
    SEARCH_CONFIGS.notes,
    userId,
    { debounceMs: 500 }
  );

  return (
    <div>
      <input 
        onChange={(e) => search(e.target.value)}
        placeholder="Search notes..."
      />
      
      {isSearching && <div>Searching...</div>}
      
      {results.map(note => (
        <div key={note.id}>{note.title}</div>
      ))}
    </div>
  );
}
```

### Search Using Predefined Entity Type

```typescript
import { useEntitySearch } from '@/hooks/useGlobalSearch';

function DocumentsSearch() {
  const userId = 'user-123';
  const { search, results, isSearching } = useEntitySearch('documents', userId);

  return (
    <div>
      <input onChange={(e) => search(e.target.value)} />
      {results.map(doc => <div key={doc.id}>{doc.name}</div>)}
    </div>
  );
}
```

### Multi-Table Search

```typescript
import { useMultiSearch } from '@/hooks/useGlobalSearch';

function GlobalSearch() {
  const userId = 'user-123';
  const { search, results, isSearching, query } = useMultiSearch(userId, {
    entityTypes: ['notes', 'documents', 'recordings']
  });

  return (
    <div>
      <input onChange={(e) => search(e.target.value)} />
      
      {Object.entries(results).map(([entityType, items]) => (
        <div key={entityType}>
          <h3>{entityType}</h3>
          {items.map(item => (
            <div key={item.id}>{item.title || item.name}</div>
          ))}
        </div>
      ))}
    </div>
  );
}
```

## Search Configurations

### Available Predefined Configs

```typescript
SEARCH_CONFIGS = {
  notes: {
    tableName: 'notes',
    searchFields: ['title', 'content'],
    userIdField: 'user_id',
    sortField: 'updated_at',
    limit: 50,
    clientFilters: [{ field: 'tags', type: 'includes' }]
  },
  
  documents: {
    tableName: 'documents',
    searchFields: ['name', 'description'],
    userIdField: 'user_id',
    sortField: 'created_at',
    limit: 50,
    additionalFilters: [
      { field: 'is_deleted', value: false, operator: 'eq' }
    ]
  },
  
  recordings: {
    tableName: 'class_recordings',
    searchFields: ['title', 'description'],
    userIdField: 'user_id',
    sortField: 'recorded_at',
    limit: 50
  },
  
  schedule: {
    tableName: 'schedule_items',
    searchFields: ['title', 'description'],
    userIdField: 'user_id',
    sortField: 'date_time',
    limit: 50
  },
  
  podcasts: {
    tableName: 'ai_podcasts',
    searchFields: ['title', 'description'],
    userIdField: 'user_id',
    sortField: 'created_at',
    limit: 50,
    additionalFilters: [
      { field: 'is_deleted', value: false, operator: 'eq' }
    ]
  },
  
  quizzes: {
    tableName: 'quizzes',
    searchFields: ['title', 'description'],
    userIdField: 'user_id',
    sortField: 'created_at',
    limit: 50
  }
}
```

## Creating Custom Search Configs

### For a New Entity Type

```typescript
import { SearchConfig } from '@/services/globalSearchService';

const customSearchConfig: SearchConfig = {
  tableName: 'my_custom_table',
  searchFields: ['field1', 'field2', 'field3'],
  userIdField: 'user_id',
  sortField: 'created_at',
  limit: 100,
  
  // Optional: Add filters that always apply
  additionalFilters: [
    { field: 'is_active', value: true, operator: 'eq' },
    { field: 'created_at', value: '2024-01-01', operator: 'gt' }
  ],
  
  // Optional: Fields with array values that need client-side filtering
  clientFilters: [
    { field: 'tags', type: 'includes' },
    { field: 'categories', type: 'contains' }
  ]
};

// Use it
const { search, results } = useGlobalSearch(customSearchConfig, userId);
```

## Search Config Properties

| Property | Type | Description |
|----------|------|-------------|
| `tableName` | string | Supabase table name |
| `searchFields` | string[] | Fields to search (uses ILIKE) |
| `userIdField` | string | Field name for user filtering |
| `sortField` | string | Field to sort results by |
| `limit` | number | Max results to return |
| `additionalFilters` | Filter[] | (Optional) Always-applied filters |
| `clientFilters` | ClientFilter[] | (Optional) Client-side array field filters |

## Filter Operations

Supported operators for `additionalFilters`:
- `eq` - equals
- `neq` - not equals
- `gt` - greater than
- `gte` - greater than or equal
- `lt` - less than
- `lte` - less than or equal

## Hook Options

```typescript
interface UseGlobalSearchOptions {
  debounceMs?: number;      // Default: 500ms
  cacheResults?: boolean;   // Default: true
}
```

## API Reference

### globalSearchService.search()

```typescript
async search<T>(
  config: SearchConfig,
  userId: string,
  query: string
): Promise<SearchResult<T>>
```

**Returns:**
```typescript
interface SearchResult<T> {
  data: T[];
  totalCount: number;
  query: string;
  timestamp: number;
}
```

### globalSearchService.searchMultiple()

```typescript
async searchMultiple<T>(
  configs: Array<{ key: string; config: SearchConfig }>,
  userId: string,
  query: string
): Promise<Record<string, SearchResult<T>>>
```

## Features

✅ **Case-Insensitive Search** - Uses SQL ILIKE for flexible matching
✅ **Multi-Field Search** - Search across multiple fields simultaneously
✅ **Debouncing** - Prevents excessive API calls (500ms default)
✅ **Caching** - Caches results to avoid duplicate searches
✅ **Error Handling** - Graceful error handling with fallbacks
✅ **Array Field Support** - Client-side filtering for array fields (tags, categories)
✅ **Custom Filters** - Support for static filters that always apply
✅ **Type-Safe** - Full TypeScript support
✅ **Reusable** - Works across all entity types
✅ **Extensible** - Easy to add new entity types or search configs

## Examples

### Search with Loading Indicator

```typescript
function SearchComponent() {
  const { search, results, isSearching, error } = useEntitySearch('notes', userId);

  return (
    <div>
      <input onChange={(e) => search(e.target.value)} />
      
      {isSearching && <LoadingSpinner />}
      {error && <ErrorMessage>{error}</ErrorMessage>}
      
      <ResultsList items={results} />
    </div>
  );
}
```

### Combining with Local Filtering

```typescript
function AdvancedSearch() {
  const { search, results, query } = useEntitySearch('notes', userId);
  const [category, setCategory] = useState('all');

  const filtered = results.filter(note =>
    category === 'all' || note.category === category
  );

  return (
    <div>
      <input onChange={(e) => search(e.target.value)} />
      <select onChange={(e) => setCategory(e.target.value)}>
        <option value="all">All Categories</option>
        <option value="math">Math</option>
        <option value="science">Science</option>
      </select>
      
      {filtered.map(note => <NoteItem key={note.id} note={note} />)}
    </div>
  );
}
```

### Search Different Entity Based on Tab

```typescript
function TabbedSearch() {
  const [tab, setTab] = useState('notes');
  const { search, results } = useEntitySearch(tab as any, userId);

  return (
    <div>
      <Tabs value={tab} onChange={setTab}>
        <TabList>
          <Tab value="notes">Notes</Tab>
          <Tab value="documents">Documents</Tab>
          <Tab value="recordings">Recordings</Tab>
        </TabList>
      </Tabs>

      <input onChange={(e) => search(e.target.value)} />
      <ResultsList items={results} />
    </div>
  );
}
```

## Adding a New Entity Type

1. **Create/Update the Database Table** with appropriate fields

2. **Add Search Config to SEARCH_CONFIGS:**
```typescript
export const SEARCH_CONFIGS = {
  // ... existing configs
  myNewEntity: {
    tableName: 'my_new_entity_table',
    searchFields: ['field1', 'field2'],
    userIdField: 'user_id',
    sortField: 'created_at',
    limit: 50
  }
};
```

3. **Use in Component:**
```typescript
const { search, results } = useEntitySearch('myNewEntity', userId);
```

## Performance Considerations

- **Debouncing**: Default 500ms prevents excessive API calls
- **Caching**: Results are cached per query to avoid duplicates
- **Limit**: 50 results returned by default (configurable)
- **Client-Side Filtering**: Used only for array fields to minimize API complexity
- **Database Indexes**: Ensure searchable fields have appropriate indexes in Supabase

## Troubleshooting

### Search not working
- Ensure `userId` is not null
- Check that table name in config matches actual table
- Verify search fields exist in the table
- Check Supabase RLS policies allow the user to query

### Too many results
- Increase specificity of search query
- Reduce `limit` in config
- Add more `additionalFilters` to narrow results

### Slow searches
- Add database indexes to searchable fields
- Reduce number of searchable fields
- Increase `debounceMs` to reduce API calls

## Best Practices

1. **Use predefined configs** when available
2. **Set appropriate debounceMs** based on UX needs (200-1000ms)
3. **Always validate userId** before searching
4. **Add error boundaries** around search components
5. **Cache results** for frequently searched queries
6. **Document custom configs** for team reference
7. **Test with large datasets** to ensure performance
8. **Use client-side filtering** sparingly (database queries preferred)

---

For questions or improvements, please refer to the service and hook source files.
