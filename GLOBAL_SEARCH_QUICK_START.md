# Global Search Engine - Developer Quick Start Card

## 🚀 5-Minute Setup

### 1. Import
```typescript
import { useEntitySearch } from '@/hooks/useGlobalSearch';
```

### 2. Initialize
```typescript
const { search, results, isSearching } = useEntitySearch('notes', userId);
```

### 3. Wire Input
```typescript
<input onChange={(e) => search(e.target.value)} />
```

### 4. Show Results
```typescript
{results.map(item => <Item key={item.id} data={item} />)}
```

**Done!** ✅

---

## 🎯 Available Entity Types

| Type | Usage |
|------|-------|
| notes | `useEntitySearch('notes', userId)` |
| documents | `useEntitySearch('documents', userId)` |
| recordings | `useEntitySearch('recordings', userId)` |
| schedule | `useEntitySearch('schedule', userId)` |
| podcasts | `useEntitySearch('podcasts', userId)` |
| quizzes | `useEntitySearch('quizzes', userId)` |

---

## 📦 Hook Return Value

```typescript
{
  search: (query: string) => void,  // Call with search term
  results: T[],                     // Array of items matching search
  isSearching: boolean,             // true while fetching
  error: string | null,             // Error message if any
  query: string,                    // Current search term
  totalCount: number,               // Count of results
  clear: () => void                 // Reset everything
}
```

---

## 💻 Complete Component Example

```typescript
import { useEntitySearch } from '@/hooks/useGlobalSearch';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function MyListComponent() {
  const [userId, setUserId] = useState<string | null>(null);
  
  // Get user ID from auth
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    };
    getUser();
  }, []);

  // Initialize search hook
  const { search, results, isSearching, error } = useEntitySearch(
    'documents',  // Which entity type to search
    userId!       // Current user ID
  );

  if (!userId) return <div>Loading...</div>;

  return (
    <div>
      {/* Search Input */}
      <input
        type="text"
        placeholder="Search documents..."
        onChange={(e) => search(e.target.value)}
      />

      {/* Loading State */}
      {isSearching && <div>Searching...</div>}

      {/* Error State */}
      {error && <div style={{ color: 'red' }}>{error}</div>}

      {/* Results */}
      {results.length === 0 ? (
        <div>No results found</div>
      ) : (
        <ul>
          {results.map((item) => (
            <li key={item.id}>{item.name || item.title}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

---

## ✨ Built-In Features (No Code Needed!)

✅ **Debouncing** - 500ms auto-debounce  
✅ **Caching** - Instant results on repeated searches  
✅ **Error Handling** - Graceful error display  
✅ **User Isolation** - Only your data searched  
✅ **Type Safety** - Full TypeScript support  
✅ **Case Insensitive** - "TODO" finds "todo"  

---

## 🎨 Common Patterns

### Pattern 1: Simple Search Bar
```typescript
const { search, results } = useEntitySearch('notes', userId);
<input onChange={(e) => search(e.target.value)} />
{results.map(note => <NoteCard key={note.id} note={note} />)}
```

### Pattern 2: With Loading Indicator
```typescript
const { search, results, isSearching } = useEntitySearch('documents', userId);
<div>
  <input onChange={(e) => search(e.target.value)} />
  {isSearching && <Spinner />}
  {results.map(doc => <DocCard key={doc.id} doc={doc} />)}
</div>
```

### Pattern 3: Multi-Entity Search
```typescript
const { search, results } = useMultiSearch(userId, {
  entityTypes: ['notes', 'documents', 'recordings']
});
<input onChange={(e) => search(e.target.value)} />
<div>Notes: {results.notes.length}</div>
<div>Docs: {results.documents.length}</div>
<div>Recordings: {results.recordings.length}</div>
```

### Pattern 4: With Clear Button
```typescript
const { search, results, clear } = useEntitySearch('notes', userId);
<input onChange={(e) => search(e.target.value)} />
<button onClick={clear}>Clear Search</button>
{results.map(note => <NoteCard key={note.id} note={note} />)}
```

---

## 🔍 Search Features

| Feature | Details |
|---------|---------|
| **Multi-Field** | Searches title + content in one query |
| **Case-Insensitive** | "TODO" finds "todo" |
| **Debounce** | 500ms delay prevents excessive API calls |
| **Cache** | Same search = instant results |
| **User-Isolated** | Only search your own data |
| **Limit** | Max 50 results per search |
| **Error Handling** | Errors displayed gracefully |

---

## 🛠️ Advanced: Custom Config

For custom tables not in predefined configs:

```typescript
import { useGlobalSearch } from '@/hooks/useGlobalSearch';

const customConfig = {
  tableName: 'my_table',
  searchFields: ['title', 'description', 'content'],
  userIdField: 'user_id',
  sortField: 'updated_at',
  limit: 50,
  additionalFilters: [],
  clientFilters: []
};

const { search, results } = useGlobalSearch(customConfig, userId);
```

---

## 📚 Documentation

| Doc | Purpose | Time |
|-----|---------|------|
| [GLOBAL_SEARCH_QUICK_REFERENCE.md](GLOBAL_SEARCH_QUICK_REFERENCE.md) | Quick patterns & FAQ | 5 min |
| [GLOBAL_SEARCH_IMPLEMENTATION.md](GLOBAL_SEARCH_IMPLEMENTATION.md) | How it works | 10 min |
| [GLOBAL_SEARCH_ENGINE.md](GLOBAL_SEARCH_ENGINE.md) | Full API | 15 min |
| [GLOBAL_SEARCH_INTEGRATION_CHECKLIST.md](GLOBAL_SEARCH_INTEGRATION_CHECKLIST.md) | Add to component | 10 min |
| [GLOBAL_SEARCH_ARCHITECTURE.md](GLOBAL_SEARCH_ARCHITECTURE.md) | Visual diagrams | 10 min |

---

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| No results returned | Check data exists in DB, verify user owns it |
| Search is slow | Add database index on search fields |
| Too many API calls | Debounce is working - check network tab |
| TypeScript error | Verify entity type is in SEARCH_CONFIGS |
| Getting other users' data | Check Supabase RLS policies |

---

## 🎓 Quick Learning Path

1. **This card** (2 min)
2. **NotesList.tsx** - See working example (5 min)
3. **Apply pattern to your component** (10 min)
4. **Read full docs** if needed (30 min)

---

## ✅ Pre-Integration Checklist

- [ ] You have userId from `supabase.auth.getUser()`
- [ ] You know which entity type to search ('notes', 'documents', etc)
- [ ] You have an input field to bind to `search()` function
- [ ] You have a place to display `results` array
- [ ] You want to show loading state with `isSearching`

---

## 🚀 Integration Checklist

- [ ] Import useEntitySearch hook
- [ ] Get userId from auth
- [ ] Initialize hook with entity type and userId
- [ ] Wire input onChange to search() function
- [ ] Display results array
- [ ] Show loading spinner when isSearching=true
- [ ] Test with real search queries
- [ ] Verify user isolation (see own data only)

---

## 💡 Tips & Tricks

**Tip 1:** Call `clear()` to reset search  
**Tip 2:** Use `isSearching` to show loading indicator  
**Tip 3:** Check `error` for search failures  
**Tip 4:** Use `query` to show current search term  
**Tip 5:** Use `totalCount` to show result count  

---

## 🔒 Security

All built-in - nothing extra to do:
- ✅ User isolation via user_id filtering
- ✅ Supabase RLS enforcement  
- ✅ Parameterized queries (no SQL injection)
- ✅ No cross-user data leakage

---

## 📞 Need Help?

1. **Quick question?** → Check FAQ in quick reference
2. **How to use?** → See NotesList.tsx example
3. **API details?** → Read GLOBAL_SEARCH_ENGINE.md
4. **Visual diagram?** → See GLOBAL_SEARCH_ARCHITECTURE.md
5. **Step-by-step guide?** → Follow GLOBAL_SEARCH_INTEGRATION_CHECKLIST.md

---

## 🎉 You're Ready!

Your search engine is:
- ✅ Complete
- ✅ Production-ready
- ✅ Easy to use
- ✅ Well-documented

**Pick an entity type and add search to your component in 5 minutes!**

---

**Print This Card** 🖨️  
Keep it handy for quick reference while integrating search!

---

**File:** This quick reference  
**Location:** Bookmark GLOBAL_SEARCH_INDEX.md  
**Updated:** After complete implementation  
**Status:** ✅ Ready to Use
