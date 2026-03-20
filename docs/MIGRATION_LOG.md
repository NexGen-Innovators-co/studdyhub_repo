# StuddyHub — Module Restructure Migration Log

> Tracks every structural change made during the modular monolith refactor.  
> Use this as the reference when debugging import issues or understanding why a file lives where it does.

---

## Migration Phases

### Phase 0 — Baseline (Before)

**Structure:** Flat `src/components/<featureName>/` folders, e.g.:
```
src/components/
  admin/
  aiChat/
  classRecordings/
  dashboard/
  notes/
  quizzes/
  social/
  ...
```
All hooks in `src/hooks/`, all services in `src/services/`, all utils in `src/utils/`.

**Problem:** No enforced module boundaries. Any component could import from any other. Cross-feature coupling was invisible. Dead code undetectable.

---

### Phase 1 — Move components → modules

**Script used:** Manual move + `fix-imports.cjs`

Every `src/components/<feature>/` folder was moved to `src/modules/<feature>/`. Files were placed flat inside the module folder initially.

**Key renames:**
| Old path | New path |
|---|---|
| `src/components/admin/` | `src/modules/admin/components/` |
| `src/components/aiChat/AiChat.tsx` | `src/modules/aiChat/Components/AiChat.tsx` |
| `src/components/notes/NoteEditor.tsx` | `src/modules/notes/components/NoteEditor.tsx` |
| `src/components/social/SocialFeed.tsx` | `src/modules/social/components/SocialFeed.tsx` |
| `src/components/ui/` | `src/modules/ui/components/` |
| *(all other features)* | `src/modules/<feature>/components/` |

**Import pattern rewritten:** `@/components/<feature>/<File>` → `@/modules/<feature>/components/<File>`

---

### Phase 2 — Fix path mismatches

**Script used:** `fix-imports.cjs` (v1 → v2)

**v1 problem:** Pattern matching on `/components/` in path strings caused:
- Same-basename files (StatsPanel, BadgesPanel) resolving to wrong module
- Barrel `export * from './components'` treated as broken file imports
- Already-correct paths being rewritten

**v2 fix:** Switched to real filesystem resolution — only rewrites imports that fail to resolve on disk. Added same-module priority scoring (+100 bonus) so `quizzes/Quizzes.tsx` importing `StatsPanel` always picks `quizzes/StatsPanel`, not `classRecordings/StatsPanel`.

**Files fixed:** 11 files, 0 false positives.

---

### Phase 3 — Fix 4 misplaced files

**Script used:** `fix-misplaced-files.cjs`

| File | Was | Moved to | Reason |
|---|---|---|---|
| `UserManagement.tsx` | `admin/hooks/` | `admin/components/` | React component not a hook |
| `UserSettings.tsx` | `userSettings/hooks/` | `userSettings/components/` | React component not a hook |
| `PodcastCreditStore.tsx` | `subscription/services/` | `subscription/components/` | React component not a service |
| `LearningGoals.tsx` | `userSettings/components.tsx/` | `userSettings/components/` | Parent folder had `.tsx` extension in name (typo) |

Malformed `components.tsx/` folder was deleted after move.

---

### Phase 4 — Resolve all broken imports

**Script used:** `fix-all-broken-imports.cjs`

Full filesystem-based resolver. Indexed all 287 source files by basename, tried to resolve every import against the real filesystem, rewrote only those that failed.

**Result:** 892 import edges all resolving correctly. 1 unresolvable: `src/types/index.ts` importing `./Social` — this file does not exist anywhere and was likely a leftover type re-export. Removed manually.

---

### Phase 5 — Correct module subfolder structure

**Script used:** `fix-module-structure.cjs`

Classified every file in `src/modules/` by its actual content and moved any that were in the wrong subfolder type:

**Classification rules:**
- `use*` prefix → `hooks/`
- `.tsx` with JSX → `components/`
- `.ts` with only `type`/`interface` exports → `types/`
- `.ts` with `async function` or Supabase calls → `services/`
- `.ts` with `UPPER_CASE` const exports only → `config/`
- `.ts` with exported helper functions → `utils/`

---

### Phase 6 — Move feature hooks out of global `src/hooks/`

**Script used:** `fix-global-to-module.cjs`

Detected feature-specific hooks by:
1. Name contains module keyword (e.g. `useCourseLibrary` → `courseLibrary`)
2. Only imported by files inside one module (importer-based detection)
3. Both signals agree → "confirmed" confidence

**Hooks moved (18 total):**

| Hook | From | To |
|---|---|---|
| `useImageGenerationDetector` | `src/hooks/` | `aiChat/hooks/` |
| `useInstantMessage` | `src/hooks/` | `aiChat/hooks/` |
| `useMessageHandlers` | `src/hooks/` | `aiChat/hooks/` |
| `useTypingAnimation` | `src/hooks/` | `aiChat/hooks/` |
| `useCourseProgress` | `src/hooks/` | `courseLibrary/hooks/` |
| `useCourseResources` | `src/hooks/` | `courseLibrary/hooks/` |
| `useEducatorCourses` | `src/hooks/` | `educator/hooks/` |
| `useEducatorPermissions` | `src/hooks/` | `educator/hooks/` |
| `useInstitution` | `src/hooks/` | `educator/hooks/` |
| `useInstitutionMembers` | `src/hooks/` | `educator/hooks/` |
| `useRoleVerification` | `src/hooks/` | `educator/hooks/` |
| `useGlobalSearch` | `src/hooks/` | `layout/hooks/` |
| `useEducationContext` | `src/hooks/` | `onboarding/hooks/` |
| `useEducationFramework` | `src/hooks/` | `onboarding/hooks/` |
| `usePodcastCredits` | `src/hooks/` | `podcasts/hooks/` |
| `usePodcasts` | `src/hooks/` | `podcasts/hooks/` |
| `useWebRTC` | `src/hooks/` | `podcasts/hooks/` |
| `useDailyQuizTracker` | `src/hooks/` | `quizzes/hooks/` |

**Bug in v1:** Script moved files one at a time and tried to read already-moved files. Fixed in v2 by separating into 3 strict phases: plan → rewrite all imports → move all files.

---

### Phase 7 — Move feature services/utils/constants/contexts

**Script used:** `fix-global-stragglers.cjs`

Based on real import graph analysis (every file's `importedBy` checked).

**Services moved (7):**

| Service | From | To | Import graph evidence |
|---|---|---|---|
| `contentModerationService` | `src/services/` | `social/services/` | 1 importer: social |
| `courseAIGenerationService` | `src/services/` | `courseLibrary/services/` | 1 importer: courseLibrary |
| `imageGenerationService` | `src/services/` | `aiChat/services/` | 1 importer: aiChat |
| `liveQuizService` | `src/services/` | `quizzes/services/` | 12 importers, all quizzes |
| `podcastLiveService` | `src/services/` | `podcasts/services/` | all importers: podcasts |
| `podcastModerationService` | `src/services/` | `podcasts/services/` | podcasts + dashboard/PodcastButton |
| `transcriptionService` | `src/services/` | `podcasts/services/` | all importers: podcasts |

**Utils moved (5):**

| Util | From | To | Import graph evidence |
|---|---|---|---|
| `adminActivityLogger` | `src/utils/` | `admin/utils/` | 4 importers, all admin |
| `calculateTypyingSpeed` | `src/utils/` | `aiChat/utils/` | 1 importer: aiChat/MarkdownRenderer |
| `markdownUtils` | `src/utils/` | `notes/utils/` | 2 importers, both notes |
| `tokenCounter` | `src/utils/` | `aiChat/utils/` | 1 importer: useMessageHandlers (in aiChat) |
| `validation` | `src/utils/` | `social/utils/` | 6 of 7 importers are social |

**Constants moved (1):**

| File | From | To |
|---|---|---|
| `aiSuggestions.ts` | `src/constants/` | `notes/config/` |

**Contexts moved (1):**

| File | From | To |
|---|---|---|
| `EducatorContext.tsx` | `src/contexts/` | `educator/context/` |

---

### Phase 8 — Fix TS2308 duplicate Toaster export

**Script used:** `fix-ui-barrel.cjs`

**Error:** `Module './sonner' has already exported a member named 'Toaster'`

**Root cause:** Both `sonner.tsx` (sonner notification library) and `toaster.tsx` (shadcn toaster) export a component named `Toaster`. The `ui/components/index.ts` barrel used `export * from './sonner'` which pulled in the name conflict.

**Fix:** Changed to explicit named re-export:
```ts
// before
export * from './sonner'

// after
export { Toaster as SonnerToaster } from './sonner'
```

The shadcn `Toaster` (from `toaster.tsx`) remains the canonical `Toaster` export. The sonner one is available as `SonnerToaster`.

**If you use sonner notifications**, update your import:
```ts
// before
import { Toaster } from '@/modules/ui'  // was ambiguous

// after
import { SonnerToaster } from '@/modules/ui'
// or import directly:
import { Toaster } from '@/modules/ui/components/sonner'
```

---

## Final State

**287 source files** across **22 modules**  
**892 import edges** — all resolving correctly  
**0 TypeScript errors** (after Phase 8 fix)

### What remains in global folders

```
src/hooks/       — 14 truly global hooks
src/services/    — 8 cross-cutting services  
src/utils/       — 6 app-wide utilities
src/contexts/    — AppContext + appReducer (root-level)
src/types/       — 8 shared type files
src/integrations/— supabase client (71 dependents)
```

### Dead code identified (not imported by anything)

These files have zero importers and can be safely deleted:
- `src/utils/audioMixer.ts`
- `src/utils/avatarCache.ts`
- `src/utils/codeHighlighting.ts`
- `src/utils/detectCodeBlock.ts`
- `src/utils/serviceHelpers.ts`
- `src/utils/syntaxHighlighting.ts`
- `src/utils/messageUtils.ts`

---

## Rollback Instructions

All scripts support `--dry-run`. If a script was applied incorrectly:

1. Revert with git: `git checkout src/`
2. Re-run scripts selectively from the phase you need to redo
3. Each script is idempotent — running twice skips already-completed moves

```bash
git diff --stat HEAD~1   # see what changed in last commit
git checkout HEAD~1 -- src/path/to/file   # restore single file
```

---

## Future Maintenance Rules

1. **New feature?** Create `src/modules/<feature>/` with the full subfolder structure from day one.
2. **New hook?** If it's only used in one module, put it in `module/hooks/` — never in global `src/hooks/`.
3. **New service?** Same rule — module-specific services belong in `module/services/`.
4. **Cross-module import?** Only via `module/index.ts` barrel. Never import internal files directly.
5. **Run before every PR:**
   ```bash
   npx tsc --noEmit
   node dependency-map.cjs
   npx madge --circular --extensions ts,tsx src/
   ```
