# Global Search Quick Reference

## ⚡ 60-Second Setup

### Step 1: Import the hook
```typescript
import { useEntitySearch } from '@/hooks/useGlobalSearch';
```

### Step 2: Initialize in your component
```typescript
const { search, results, isSearching } = useEntitySearch('notes', userId);
```

### Step 3: Wire up the search input
```typescript
<input onChange={(e) => search(e.target.value)} />
```

### Step 4: Display results
```typescript
{results.map(item => <ItemComponent key={item.id} data={item} />)}
```

**That's it!** No debounce logic, no caching, no error handling needed. It's all built-in.

---

## 🎯 Available Entity Types

| Entity | Hook | Config |
|--------|------|--------|
| Notes | `useEntitySearch('notes', userId)` | Searches: title, content |
| Documents | `useEntitySearch('documents', userId)` | Searches: name, description |
| Recordings | `useEntitySearch('recordings', userId)` | Searches: title, description |
| Schedule Items | `useEntitySearch('schedule', userId)` | Searches: title, description |
| Podcasts | `useEntitySearch('podcasts', userId)` | Searches: title, description |
| Quizzes | `useEntitySearch('quizzes', userId)` | Searches: title, description |

---

## 🔄 Multi-Entity Search

Search multiple tables at once:

```typescript
const { search, results } = useMultiSearch(userId, {
  entityTypes: ['notes', 'documents', 'recordings']
});

// Results structure:
// {
//   notes: [...],
//   documents: [...],
//   recordings: [...]
// }
```

---

## 📝 Hook Return Values

```typescript
{
  search: (query: string) => void,    // Call this with search term
  results: T[],                       // Array of matching items
  isSearching: boolean,               // true while fetching
  error: string | null,               // Error message if any
  query: string,                      // Current search term
  totalCount: number,                 // Number of results
  clear: () => void                   // Clear all results
}
```

---

## 🎨 Common Patterns

### Pattern 1: Basic search bar
```typescript
const { search, results } = useEntitySearch('notes', userId);

return (
  <>
    <input onChange={(e) => search(e.target.value)} />
    {results.map(note => <NoteCard key={note.id} note={note} />)}
  </>
);
```

### Pattern 2: Search with loading state
```typescript
const { search, results, isSearching } = useEntitySearch('documents', userId);

return (
  <>
    <input onChange={(e) => search(e.target.value)} />
    {isSearching && <Spinner />}
    {results.map(doc => <DocCard key={doc.id} doc={doc} />)}
  </>
);
```

### Pattern 3: Search with error handling
```typescript
const { search, results, error } = useEntitySearch('podcasts', userId);

return (
  <>
    <input onChange={(e) => search(e.target.value)} />
    {error && <Alert color="error">{error}</Alert>}
    {results.map(pod => <PodcastCard key={pod.id} pod={pod} />)}
  </>
);
```

### Pattern 4: Tabbed search results
```typescript
const { search, results } = useMultiSearch(userId, {
  entityTypes: ['notes', 'documents', 'podcasts']
});

return (
  <>
    <input onChange={(e) => search(e.target.value)} />
    <Tabs>
      <Tab label="Notes">{results.notes.map(...)}</Tab>
      <Tab label="Documents">{results.documents.map(...)}</Tab>
      <Tab label="Podcasts">{results.podcasts.map(...)}</Tab>
    </Tabs>
  </>
);
```

---

## ✨ Built-In Features

- ✅ **Debounce (500ms)** - No extra API calls while typing
- ✅ **Caching** - Same query = no new API call
- ✅ **Error Handling** - Graceful error states
- ✅ **Type Safety** - Full TypeScript support
- ✅ **User Isolation** - Only your data searched
- ✅ **Case Insensitive** - "TODO" finds "todo"
- ✅ **Multi-Field** - Searches title AND content at once
- ✅ **Parallel Search** - useMultiSearch queries in parallel

---

## 📁 Files & Locations

| File | Purpose |
|------|---------|
| `src/services/globalSearchService.ts` | Core search logic |
| `src/hooks/useGlobalSearch.ts` | React hooks |
| `docs/GLOBAL_SEARCH_ENGINE.md` | Full documentation |
| `docs/GLOBAL_SEARCH_IMPLEMENTATION.md` | This guide (expanded) |
| `src/components/notes/components/NotesList.tsx` | Example implementation |

---

## 🚀 Adding Search to Your Component

### Before (your component):
```typescript
// Old way - lots of code
const [search, setSearch] = useState('');
const [results, setResults] = useState([]);
const [loading, setLoading] = useState(false);
// ... 50 lines of search logic
```

### After (with useGlobalSearch):
```typescript
// New way - 1 line!
const { search, results, isSearching } = useEntitySearch('documents', userId);
```

**You save ~50 lines of code per component!**

---

## 🎯 FAQ

**Q: How do I get the userId?**
```typescript
const { user } = await supabase.auth.getUser();
const userId = user?.id;
```

**Q: Can I customize the debounce time?**
```typescript
useEntitySearch('notes', userId, { debounceMs: 300 })
```

**Q: How do I disable caching?**
```typescript
useEntitySearch('notes', userId, { cacheResults: false })
```

**Q: Can I add custom filters?**
Yes! See docs/GLOBAL_SEARCH_ENGINE.md for custom configs.

**Q: What if search fails?**
The `error` property will contain the error message.

**Q: How many results max?**
Default 50 per entity. Configurable via SEARCH_CONFIGS.

---

## 💡 Pro Tips

1. **Use useEntitySearch for single tables** - It's simpler
2. **Use useMultiSearch for global search** - It's faster (parallel)
3. **Cache is automatic** - No need to manage it
4. **Error states are important** - Always display error if present
5. **Show loading spinner** - Use isSearching for better UX

---

## 🔗 Need More?

- **Full API Reference**: See `docs/GLOBAL_SEARCH_ENGINE.md`
- **Examples**: See `src/components/notes/components/NotesList.tsx`
- **Custom Config**: See `docs/GLOBAL_SEARCH_ENGINE.md` → "Custom Search Configs"

---

**Last Updated:** After global search implementation  
**Status:** ✅ Production Ready  
**Coverage:** 6 entity types + extensible for more
