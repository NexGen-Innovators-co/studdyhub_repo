# Global Search Engine - Visual Architecture

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              UI LAYER                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  NotesList.tsx    DocumentsList    RecordingsList    PodcastsList, etc     │
│  ✅ Complete      ⏳ Soon          ⏳ Soon           ⏳ Soon                │
│                                                                             │
│  Each Component:                                                            │
│  ┌──────────────────────────────────────────────────────┐                  │
│  │ const { search, results, isSearching } =             │                  │
│  │   useEntitySearch('notes', userId)                   │                  │
│  │                                                      │                  │
│  │ <input onChange={(e) => search(e.target.value)} />   │                  │
│  │ {results.map(item => <Item key={item.id} ... />)}    │                  │
│  └──────────────────────────────────────────────────────┘                  │
│                                                                             │
└──────────────────────┬──────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HOOK LAYER                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                     src/hooks/useGlobalSearch.ts                            │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────┐               │
│  │ useGlobalSearch<T>(config, userId, options)            │               │
│  │ - Custom config search                                  │               │
│  │ - Full control over SearchConfig                        │               │
│  │ - Generic <T> for any entity type                       │               │
│  └─────────────────────────────────────────────────────────┘               │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────┐               │
│  │ useEntitySearch<T>(entityType, userId, options)        │               │
│  │ - Predefined entity types: 'notes', 'documents', etc   │               │
│  │ - Uses SEARCH_CONFIGS for configuration                │               │
│  │ - Recommended for most use cases                        │               │
│  └─────────────────────────────────────────────────────────┘               │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────┐               │
│  │ useMultiSearch(userId, { entityTypes: [...] })        │               │
│  │ - Search multiple tables in parallel                    │               │
│  │ - Returns Record<entityType, items[]>                  │               │
│  │ - Optimized for global search features                 │               │
│  └─────────────────────────────────────────────────────────┘               │
│                                                                             │
│  Features Built-in to All Hooks:                                           │
│  ✓ 500ms Debouncing      ✓ Result Caching       ✓ Error Handling          │
│  ✓ Loading States        ✓ Clear Function       ✓ Query Tracking          │
│                                                                             │
└──────────────────────┬──────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      SERVICE LAYER                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                 src/services/globalSearchService.ts                         │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────┐               │
│  │         SearchConfig Interface                          │               │
│  │  ┌──────────────────────────────────────────────────┐   │               │
│  │  │ tableName: string                               │   │               │
│  │  │ searchFields: string[]                          │   │               │
│  │  │ userIdField: string                             │   │               │
│  │  │ sortField: string                               │   │               │
│  │  │ limit: number                                   │   │               │
│  │  │ additionalFilters: Filter[]                     │   │               │
│  │  │ clientFilters: ClientFilter[]                   │   │               │
│  │  └──────────────────────────────────────────────────┘   │               │
│  └─────────────────────────────────────────────────────────┘               │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────┐               │
│  │  globalSearchService.search<T>(config, userId, query)   │               │
│  │  └─ Single table search with typed results              │               │
│  └─────────────────────────────────────────────────────────┘               │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────┐               │
│  │  globalSearchService.searchMultiple<T>(...)            │               │
│  │  └─ Multiple table parallel search                      │               │
│  └─────────────────────────────────────────────────────────┘               │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────┐               │
│  │         SEARCH_CONFIGS Object                           │               │
│  │  ├─ notes       → search title + content               │               │
│  │  ├─ documents   → search name + description            │               │
│  │  ├─ recordings  → search title + description           │               │
│  │  ├─ schedule    → search title + description           │               │
│  │  ├─ podcasts    → search title + description           │               │
│  │  └─ quizzes     → search title + description           │               │
│  │  [+ Custom Configs as Needed]                          │               │
│  └─────────────────────────────────────────────────────────┘               │
│                                                                             │
└──────────────────────┬──────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       DATABASE LAYER                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Supabase PostgreSQL Database                                              │
│                                                                             │
│  For each search query, generates:                                         │
│  ┌──────────────────────────────────────────────────────┐                  │
│  │ SELECT * FROM [tableName]                           │                  │
│  │ WHERE user_id = $userId                             │                  │
│  │   AND [additionalFilters applied]                   │                  │
│  │   AND (                                              │                  │
│  │     [searchField1] ILIKE '%query%'                  │                  │
│  │     OR [searchField2] ILIKE '%query%'               │                  │
│  │     OR [searchField3] ILIKE '%query%'               │                  │
│  │   )                                                  │                  │
│  │ ORDER BY [sortField] DESC                           │                  │
│  │ LIMIT [limit]                                        │                  │
│  └──────────────────────────────────────────────────────┘                  │
│                                                                             │
│  Returns: Typed Results <T> with:                                         │
│  ✓ User-owned data only (RLS enforced)                                    │
│  ✓ Case-insensitive matches (ILIKE)                                       │
│  ✓ Multi-field search results                                             │
│  ✓ Sorted and limited                                                     │
│  ✓ No deleted/soft-deleted items (config filters)                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagram

```
User Types in Search Input
       │
       ▼
[Input onChange Event]
       │
       ▼
search(value) function called
       │
       ├─ Debounce Timer Set (500ms)
       │
       └─ Wait 500ms...
           (User may type more letters)
                │
                ▼
       [500ms Passed, No More Typing]
       
       ├─ Check Cache
       │   ├─ Cache HIT? → Return cached results instantly ✅
       │   └─ Cache MISS? → Continue below
       │
       ▼
[Call globalSearchService.search()]
       │
       ├─ Build SearchConfig
       ├─ Build Supabase Query
       ├─ Apply User ID Filter
       ├─ Apply Additional Filters
       ├─ Apply ILIKE Search (OR all fields)
       ├─ Apply Client-side Filtering
       ├─ Sort by specified field
       └─ Limit results
       │
       ▼
[Supabase Query Executed]
       │
       ├─ Database checks RLS policies
       ├─ Verifies user ownership
       ├─ Executes query
       └─ Returns matching rows
       │
       ▼
[Results Received]
       │
       ├─ Cache results (map by query string)
       ├─ Update hook state
       │   ├─ results = data
       │   ├─ totalCount = count
       │   ├─ isSearching = false
       │   ├─ error = null
       │   └─ query = search term
       │
       ▼
[Component Re-renders]
       │
       ├─ Stop showing loading spinner
       ├─ Display results
       │   └─ results.map(item => <ItemComponent />)
       ├─ Show count: "Found X results"
       └─ Display clear button
       │
       ▼
[UI Updated with Results]
```

---

## Component Interaction Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    Your Component                              │
│  (NotesList, DocumentsList, etc)                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Imports:                                                       │
│  ├─ useEntitySearch from '@/hooks/useGlobalSearch'             │
│  ├─ SEARCH_CONFIGS from '@/services/globalSearchService'       │
│  └─ supabase from '@/integrations/supabase/client'             │
│                                                                 │
│  Component Body:                                               │
│  ├─ Get userId from supabase.auth.getUser()                   │
│  ├─ Initialize: useEntitySearch('notes', userId)              │
│  │                                                              │
│  │  Returns: { search, results, isSearching, error, ... }      │
│  │                                                              │
│  └─ Render:                                                    │
│     ├─ Search Input tied to search() function                  │
│     ├─ Loading state tied to isSearching                       │
│     ├─ Results list tied to results array                      │
│     └─ Error display tied to error state                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
         │                                │                 │
         ▼                                ▼                 ▼
    [User Types] ──────┬─────────────────────────────────┐
                       │                                  │
                       ▼                                  ▼
          [onChange → search()] ──────────────────────────────────┐
                       │                                          │
                       ▼                                          ▼
              [Debounce 500ms] ──────────────────────────────────┐
                       │                                         │
                       ▼                                         ▼
           [Check Cache / Query] ─────────────────────────────────────┐
                       │                                              │
                       ▼                                              ▼
              [Supabase Query] ─────────────────────────────────────────┐
                       │                                               │
                       ▼                                               ▼
           [Update Hook State] ─────────────────────────────────────────┐
           ├─ results = data                                           │
           ├─ totalCount = count                                       │
           ├─ isSearching = false                                      │
           └─ error = null                                             │
                       │                                               │
                       └───────────────────────────────────────────────┤
                                                                       │
                       ▼                                               ▼
           [Component Re-render]
           ├─ Loading spinner hides
           ├─ Results display
           └─ UI updates
```

---

## Configuration Flow Diagram

```
SEARCH_CONFIGS Object
│
├─ SEARCH_CONFIGS.notes
│  ├─ tableName: 'notes'
│  ├─ searchFields: ['title', 'content']
│  ├─ userIdField: 'user_id'
│  ├─ sortField: 'updated_at'
│  ├─ limit: 50
│  ├─ additionalFilters: []
│  └─ clientFilters: [{ field: 'tags', type: 'includes' }]
│
├─ SEARCH_CONFIGS.documents
│  ├─ tableName: 'documents'
│  ├─ searchFields: ['name', 'description']
│  ├─ userIdField: 'user_id'
│  ├─ sortField: 'updated_at'
│  ├─ limit: 50
│  ├─ additionalFilters: [{ field: 'is_deleted', value: false, operator: 'eq' }]
│  └─ clientFilters: []
│
├─ SEARCH_CONFIGS.recordings
│  ├─ tableName: 'class_recordings'
│  ├─ searchFields: ['title', 'description']
│  ├─ userIdField: 'user_id'
│  ├─ sortField: 'created_at'
│  ├─ limit: 50
│  ├─ additionalFilters: []
│  └─ clientFilters: []
│
├─ SEARCH_CONFIGS.schedule
│  ├─ tableName: 'schedule_items'
│  ├─ searchFields: ['title', 'description']
│  ├─ userIdField: 'user_id'
│  ├─ sortField: 'start_date'
│  ├─ limit: 50
│  ├─ additionalFilters: []
│  └─ clientFilters: []
│
├─ SEARCH_CONFIGS.podcasts
│  ├─ tableName: 'podcasts'
│  ├─ searchFields: ['title', 'description']
│  ├─ userIdField: 'user_id'
│  ├─ sortField: 'created_at'
│  ├─ limit: 50
│  ├─ additionalFilters: [{ field: 'is_deleted', value: false, operator: 'eq' }]
│  └─ clientFilters: []
│
└─ SEARCH_CONFIGS.quizzes
   ├─ tableName: 'quizzes'
   ├─ searchFields: ['title', 'description']
   ├─ userIdField: 'user_id'
   ├─ sortField: 'updated_at'
   ├─ limit: 50
   ├─ additionalFilters: []
   └─ clientFilters: []

Each Config is Passed to:
↓
useEntitySearch('entityType', userId)
↓
useGlobalSearch(SEARCH_CONFIGS[entityType], userId)
↓
globalSearchService.search(config, userId, query)
↓
Generates Supabase Query Based on Config
```

---

## Performance Optimization Flow

```
User Input Event
       │
       ▼
[check if debounce timer is running]
       │
       ├─ YES: Cancel previous timer ✗
       └─ NO: Continue
       │
       ▼
[Set new debounce timer: 500ms]
       │
       ▼
[Wait for user to stop typing for 500ms]
       │
       ├─ User types more? → Restart timer
       │
       └─ 500ms passed with no more typing
       │
       ▼
[Check Result Cache]
       │
       ├─ Cache KEY = search query
       │
       ├─ Cache HIT (same query recently searched)?
       │   └─ Return cached results INSTANTLY ⚡
       │       (No API call needed)
       │
       └─ Cache MISS (new query or expired)
           │
           ▼
       [Make API Request to Supabase]
           │
           ├─ Send: config, userId, query
           ├─ Supabase builds SQL query
           ├─ Database executes query
           └─ Results returned
           │
           ▼
       [Cache Results]
           │
           ├─ Store in cacheRef[query] = results
           ├─ Add timestamp
           └─ Future same-query searches instant
           │
           ▼
       [Update Component State]
           │
           ├─ results = data
           ├─ isSearching = false
           └─ Component re-renders
```

---

## Integration Steps Visualization

```
BEFORE: Each Component Had Custom Search
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  NotesList.tsx   │  │ DocumentsList    │  │ RecordingsList   │
│                  │  │                  │  │                  │
│ [50+ lines of    │  │ [50+ lines of    │  │ [50+ lines of    │
│  custom search]  │  │  custom search]  │  │  custom search]  │
│                  │  │                  │  │                  │
│ [Debounce]       │  │ [Debounce]       │  │ [Debounce]       │
│ [Caching]        │  │ [Caching]        │  │ [Caching]        │
│ [Error handling] │  │ [Error handling] │  │ [Error handling] │
│ [State mgmt]     │  │ [State mgmt]     │  │ [State mgmt]     │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

```
AFTER: All Components Use Global Search
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  NotesList.tsx   │  │ DocumentsList    │  │ RecordingsList   │
│                  │  │                  │  │                  │
│ useEntitySearch( │  │ useEntitySearch( │  │ useEntitySearch( │
│   'notes',       │  │   'documents',   │  │   'recordings',  │
│   userId         │  │   userId         │  │   userId         │
│ )                │  │ )                │  │ )                │
│                  │  │                  │  │                  │
│ [3 lines total!]◄◄─┴─► [Shared Services] ◄───────────────────┘
│                  │  │                  │
└──────────────────┘  │ globalSearch     │
                      │ Service.ts       │
                      │                  │
                      │ useGlobalSearch  │
                      │ .ts              │
                      │                  │
                      │ [Debounce]       │
                      │ [Caching]        │
                      │ [Error handling] │
                      │ [State mgmt]     │
                      │                  │
                      │ [Shared Once!]   │
                      │ [All services]   │
                      │ benefit]         │
                      └──────────────────┘
```

---

## Hook Return Value Structure

```typescript
const hookReturn = useEntitySearch('notes', userId);

// Structure:
{
  // Search function - call with user query
  search: (query: string) => void
  
  // Results from search
  results: Note[]  // Typed array matching config.tableName
  
  // Search state
  isSearching: boolean     // true while API call in progress
  error: string | null     // Error message if search fails
  query: string            // Current search term
  totalCount: number       // Number of results found
  
  // Control function
  clear: () => void        // Clears results and resets state
}

// Usage:
search('my search term')   // Triggers search after debounce
const items = results      // Use results in JSX
if (isSearching) { ... }   // Show loading state
if (error) { ... }         // Show error state
clear()                    // Reset everything
```

---

## File Relationship Diagram

```
src/
│
├─ services/
│  └─ globalSearchService.ts ✅
│     ├─ SearchConfig interface
│     ├─ SearchResult<T> interface
│     ├─ search<T>() method
│     ├─ searchMultiple<T>() method
│     └─ SEARCH_CONFIGS object
│
├─ hooks/
│  └─ useGlobalSearch.ts ✅
│     ├─ useGlobalSearch<T>() hook
│     ├─ useEntitySearch<T>() hook
│     └─ useMultiSearch() hook
│     │
│     └─ imports: globalSearchService
│
└─ components/
   └─ notes/
      └─ components/
         └─ NotesList.tsx ✅ (Updated)
            ├─ imports: useGlobalSearch
            ├─ imports: SEARCH_CONFIGS
            ├─ uses: useEntitySearch('notes', userId)
            └─ wires: search input, displays results

docs/
├─ GLOBAL_SEARCH_ENGINE.md
├─ GLOBAL_SEARCH_IMPLEMENTATION.md
├─ GLOBAL_SEARCH_QUICK_REFERENCE.md
├─ GLOBAL_SEARCH_INTEGRATION_CHECKLIST.md
├─ GLOBAL_SEARCH_FILE_REFERENCE.md
└─ GLOBAL_SEARCH_SUMMARY.md (this file)
```

---

**This architecture provides a clean, maintainable, and scalable global search solution across all sections of StuddyHub! 🎉**
