# Global Search Engine - Complete File Reference

## 📦 What Was Created

### Core Service (globalSearchService.ts)

**Location:** `src/services/globalSearchService.ts`

**Purpose:** Core search engine with database queries and predefined configs

**Key Exports:**
- `SearchConfig` - Interface defining search configuration
- `SearchResult<T>` - Interface for search results
- `globalSearchService.search<T>()` - Search single table
- `globalSearchService.searchMultiple<T>()` - Search multiple tables
- `SEARCH_CONFIGS` - Predefined configurations for 6 entity types

**File Size:** ~200 lines

**Dependencies:** 
- `supabase` - Database client
- TypeScript generics for type safety

---

### React Hooks (useGlobalSearch.ts)

**Location:** `src/hooks/useGlobalSearch.ts`

**Purpose:** React hooks for integrating search into components

**Key Exports:**
- `useGlobalSearch<T>()` - Generic search hook
- `useEntitySearch<T>()` - Named entity type hook
- `useMultiSearch()` - Multi-table search hook

**Features:**
- Built-in debouncing (500ms configurable)
- Result caching (can disable if needed)
- Error handling
- Loading states
- Clear functionality

**File Size:** ~220 lines

**Dependencies:**
- `React` - useState, useRef, useCallback, useEffect
- `globalSearchService` - Core service
- TypeScript generics

---

### Example Implementation (NotesList.tsx)

**Location:** `src/components/notes/components/NotesList.tsx`

**Purpose:** Working example of how to use global search

**What Changed:**
- Removed ~50 lines of custom search logic
- Added 1-line hook initialization: `useGlobalSearch(SEARCH_CONFIGS.notes, userId)`
- Updated search input: `onChange={(e) => search(e.target.value)}`
- Updated results display: `{searchResults.map(...)}`

**Before:** 350 lines with custom search logic  
**After:** 300 lines with global search hook

**Impact:** Cleaner, more maintainable code

---

### Documentation Files

| File | Purpose | Size |
|------|---------|------|
| `docs/GLOBAL_SEARCH_ENGINE.md` | Complete API reference and guide | 400+ lines |
| `docs/GLOBAL_SEARCH_IMPLEMENTATION.md` | Implementation guide with examples | 350+ lines |
| `docs/GLOBAL_SEARCH_QUICK_REFERENCE.md` | Quick reference card | 200+ lines |
| `docs/GLOBAL_SEARCH_INTEGRATION_CHECKLIST.md` | Component integration checklist | 300+ lines |

---

## 🎯 File Purposes

### globalSearchService.ts - The Engine
```
┌─────────────────────────────────────────┐
│   GlobalSearchService (searchEngine)     │
├─────────────────────────────────────────┤
│ • Builds Supabase queries               │
│ • Handles user isolation (user_id)      │
│ • Applies filters (eq, gt, lte, etc)    │
│ • Case-insensitive search (ILIKE)       │
│ • Client-side array filtering           │
│ • Parallel multi-table search           │
│ • Returns typed results <T>             │
└─────────────────────────────────────────┘
         ↓ Used by ↓
    React Hooks
```

### useGlobalSearch.ts - The Integration
```
┌─────────────────────────────────────────┐
│        useGlobalSearch Hooks            │
├─────────────────────────────────────────┤
│ • useGlobalSearch<T>()                  │
│   - Generic custom config search        │
│                                         │
│ • useEntitySearch<T>()                  │
│   - Named entity type (notes, docs...)  │
│                                         │
│ • useMultiSearch()                      │
│   - Multiple tables in parallel         │
├─────────────────────────────────────────┤
│ Built-in Features:                      │
│ ✓ 500ms debounce                        │
│ ✓ Result caching                        │
│ ✓ Error handling                        │
│ ✓ Loading states                        │
│ ✓ Clear function                        │
└─────────────────────────────────────────┘
```

### NotesList.tsx - The Example
```
┌─────────────────────────────────────────┐
│         NotesList Component             │
├─────────────────────────────────────────┤
│ Uses: useGlobalSearch hook              │
│ With: SEARCH_CONFIGS.notes              │
│       userId from auth                  │
├─────────────────────────────────────────┤
│ Behavior:                               │
│ 1. User types in search box             │
│ 2. Hook debounces 500ms                 │
│ 3. Service queries Supabase             │
│ 4. Results cached                       │
│ 5. Component re-renders                 │
└─────────────────────────────────────────┘
```

---

## 🔗 File Dependencies

```
NotesList.tsx
    ↓
    ├── useGlobalSearch hook
    │       ↓
    │       ├── globalSearchService
    │       │       ↓
    │       │       └── supabase client
    │       │
    │       └── React hooks (useState, useRef, etc)
    │
    └── SEARCH_CONFIGS (notes config)
            ↓
            └── globalSearchService (contains configs)
```

---

## 📂 Directory Structure

```
src/
├── components/
│   └── notes/
│       └── components/
│           └── NotesList.tsx ............... ✨ Updated to use global search
│
├── hooks/
│   ├── useGlobalSearch.ts ................ ✨ NEW - React hooks
│   ├── useAuth.tsx
│   ├── useAppData.tsx
│   └── ... other hooks
│
└── services/
    ├── globalSearchService.ts ............ ✨ NEW - Core service
    └── ... other services

docs/
├── GLOBAL_SEARCH_ENGINE.md .............. ✨ Complete documentation
├── GLOBAL_SEARCH_IMPLEMENTATION.md ...... ✨ Implementation guide
├── GLOBAL_SEARCH_QUICK_REFERENCE.md .... ✨ Quick ref card
└── GLOBAL_SEARCH_INTEGRATION_CHECKLIST.md ✨ Integration checklist
```

---

## 💻 Code Examples

### globalSearchService.ts - Core Concepts

```typescript
// Define what's searchable
interface SearchConfig {
  tableName: string;              // 'notes', 'documents', etc
  searchFields: string[];         // ['title', 'content']
  userIdField: string;            // 'user_id'
  sortField: string;              // 'updated_at'
  limit: number;                  // 50
  additionalFilters: Filter[];    // [{ field: 'is_deleted', value: false, operator: 'eq' }]
  clientFilters: ClientFilter[];  // [{ field: 'tags', type: 'includes' }]
}

// Main search function
async search<T>(
  config: SearchConfig,
  userId: string,
  query: string
): Promise<SearchResult<T>>

// Multi-table search
async searchMultiple<T>(
  configs: SearchConfig[],
  userId: string,
  query: string
): Promise<Record<string, T[]>>
```

### useGlobalSearch.ts - Hook Patterns

```typescript
// Pattern 1: Generic with custom config
const { search, results, isSearching } = useGlobalSearch(
  customConfig,  // Your SearchConfig
  userId
);

// Pattern 2: Named entity type (recommended)
const { search, results, isSearching } = useEntitySearch(
  'notes',       // Predefined entity type
  userId
);

// Pattern 3: Multiple entities
const { search, results } = useMultiSearch(
  userId,
  { entityTypes: ['notes', 'documents'] }
);
```

---

## 🔧 How to Use Each File

### 1. Using globalSearchService Directly

```typescript
import { globalSearchService, SEARCH_CONFIGS } from '@/services/globalSearchService';

// Single search
const results = await globalSearchService.search(
  SEARCH_CONFIGS.notes,
  userId,
  'my search term'
);

// Multi-search
const results = await globalSearchService.searchMultiple(
  [SEARCH_CONFIGS.notes, SEARCH_CONFIGS.documents],
  userId,
  'search term'
);
```

### 2. Using useGlobalSearch Hook (Recommended)

```typescript
import { useEntitySearch } from '@/hooks/useGlobalSearch';

// In your component
const { search, results, isSearching } = useEntitySearch('notes', userId);

// In JSX
<input onChange={(e) => search(e.target.value)} />
{results.map(item => <ItemComponent key={item.id} data={item} />)}
```

### 3. Learning from NotesList.tsx

Open `src/components/notes/components/NotesList.tsx` to see:
- How to import hooks
- How to get userId from auth
- How to initialize useGlobalSearch
- How to wire up the search input
- How to handle loading states
- How to display results

---

## 📊 Predefined Search Configs

All in `globalSearchService.ts` as `SEARCH_CONFIGS`:

### SEARCH_CONFIGS.notes
```typescript
{
  tableName: 'notes',
  searchFields: ['title', 'content'],
  userIdField: 'user_id',
  sortField: 'updated_at',
  limit: 50,
  additionalFilters: [],
  clientFilters: [{ field: 'tags', type: 'includes' }]
}
```

### SEARCH_CONFIGS.documents
```typescript
{
  tableName: 'documents',
  searchFields: ['name', 'description'],
  userIdField: 'user_id',
  sortField: 'updated_at',
  limit: 50,
  additionalFilters: [{ field: 'is_deleted', value: false, operator: 'eq' }],
  clientFilters: []
}
```

*(Similar configs for: recordings, schedule, podcasts, quizzes)*

---

## 🚀 Quick Integration Steps

### For Any New Component:

1. **Import the hook**
   ```typescript
   import { useEntitySearch } from '@/hooks/useGlobalSearch';
   ```

2. **Initialize in component**
   ```typescript
   const { search, results, isSearching } = useEntitySearch('documents', userId);
   ```

3. **Wire the input**
   ```typescript
   <input onChange={(e) => search(e.target.value)} />
   ```

4. **Display results**
   ```typescript
   {results.map(item => <ItemComponent key={item.id} data={item} />)}
   ```

That's all! No other code needed.

---

## ✅ Quality Checklist

| Item | Status |
|------|--------|
| TypeScript compilation | ✅ Zero errors |
| globalSearchService.ts | ✅ Complete & tested |
| useGlobalSearch.ts | ✅ Complete & tested |
| NotesList.tsx integration | ✅ Complete & tested |
| Documentation (3 guides) | ✅ Complete |
| Quick reference card | ✅ Complete |
| Integration checklist | ✅ Complete |
| Type safety | ✅ Full TypeScript |
| Error handling | ✅ Built-in |
| Debouncing | ✅ 500ms default |
| Caching | ✅ Automatic |
| User isolation | ✅ Verified |

---

## 📞 Need Help?

**Quick questions?**
→ See `GLOBAL_SEARCH_QUICK_REFERENCE.md`

**How does it work?**
→ See `GLOBAL_SEARCH_IMPLEMENTATION.md`

**Full API details?**
→ See `GLOBAL_SEARCH_ENGINE.md`

**Adding to a component?**
→ See `GLOBAL_SEARCH_INTEGRATION_CHECKLIST.md`

**How does this component work?**
→ See `src/components/notes/components/NotesList.tsx`

---

## 🎓 Learning Path

1. **Start Here** → `GLOBAL_SEARCH_QUICK_REFERENCE.md` (5 min)
2. **Understand Architecture** → `GLOBAL_SEARCH_IMPLEMENTATION.md` (10 min)
3. **See Working Example** → `src/components/notes/components/NotesList.tsx` (5 min)
4. **Learn API** → `GLOBAL_SEARCH_ENGINE.md` (15 min)
5. **Integrate to Your Component** → `GLOBAL_SEARCH_INTEGRATION_CHECKLIST.md` (10 min)

**Total Learning Time:** ~45 minutes

---

## 💡 Key Takeaways

✅ **One global search service** - Works for all entity types  
✅ **Three hook patterns** - Choose what fits your needs  
✅ **Predefined configs** - 6 entity types ready to use  
✅ **Built-in optimization** - Debounce + caching + error handling  
✅ **Type-safe** - Full TypeScript support throughout  
✅ **Easy integration** - Just 4 lines of code per component  
✅ **Well documented** - Multiple guides and examples  
✅ **Production ready** - Zero compilation errors  

---

**You now have everything you need to add seamless search to any section of the app! 🎉**
