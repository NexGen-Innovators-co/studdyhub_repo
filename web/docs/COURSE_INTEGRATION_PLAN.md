# Course Integration Plan — StuddyHub

> **Goal:** Transform the course library from a static document viewer into a full learning hub where enrolling in a course gives students access to all platform features (quizzes, podcasts, notes, discussions, AI chat, schedule) scoped to that course.

**Status:** 🟡 In Progress  
**Created:** 2026-02-09  
**Last Updated:** 2026-02-09  
**Owner:** —  

---

## Table of Contents

1. [Current State (As-Is)](#1-current-state-as-is)
2. [Target State (To-Be)](#2-target-state-to-be)
3. [Architecture Overview](#3-architecture-overview)
4. [New Database Tables](#4-new-database-tables)
5. [Phase 1 — Enrollment System & Core Tables](#5-phase-1--enrollment-system--core-tables)
6. [Phase 2 — Course Dashboard UI](#6-phase-2--course-dashboard-ui)
7. [Phase 3 — Admin Resource Linking](#7-phase-3--admin-resource-linking)
8. [Phase 4 — Progress Tracking](#8-phase-4--progress-tracking)
9. [Phase 5 — AI & Generation Integration](#9-phase-5--ai--generation-integration)
10. [File Reference Map](#10-file-reference-map)
11. [Database Table Reference](#11-database-table-reference)
12. [Key Architectural Decisions](#12-key-architectural-decisions)

---

## 1. Current State (As-Is)

### What exists today

| Feature | Status | How it works |
|---------|--------|--------------|
| **Course Library** | ✅ Exists | Tab inside `/library` page. Lists courses filtered by school/global/all |
| **Course Detail** | ✅ Exists | Inline component (no dedicated route). Shows documents grouped by category |
| **Course Materials** | ✅ Exists | `course_materials` table → links `courses` to `documents` only |
| **Enrollment** | ❌ Missing | No enrollment mechanism. Users just browse materials |
| **Course → Quizzes** | ❌ Missing | Quizzes link to `class_recordings`, not courses |
| **Course → Podcasts** | ❌ Missing | `ai_podcasts` has no `course_id` column |
| **Course → Notes** | ❌ Missing | `notes` has no `course_id` column |
| **Course → Schedule** | ❌ Missing | `schedule_items` has no `course_id` column |
| **Course → Discussions** | ❌ Missing | Social posts have no course association |
| **Course Dashboard** | ❌ Missing | No `/course/:id` route. Detail is inline state swap |
| **Progress Tracking** | ❌ Missing | No `course_progress` or enrollment progress |

### Current routes

| Route | Component | Purpose |
|-------|-----------|---------|
| `/library` | `<Index />` → `<CourseLibrary />` | Browse courses |
| `/library/:tab` | `<Index />` → `<CourseLibrary />` | Filter by school/global/all |
| `/admin/courses` | `<CourseManagement />` | CRUD courses & materials |

### Current data flow

```
courses
  └── course_materials (1:N)
        └── documents (1:1, via document_id)
```

No other feature tables link to courses.

---

## 2. Target State (To-Be)

### After integration

```
courses
  ├── course_enrollments (1:N) — users enrolled in course
  ├── course_resources (1:N) — links to ANY feature
  │     ├── type: 'document'  → documents.id
  │     ├── type: 'quiz'      → quizzes.id
  │     ├── type: 'podcast'   → ai_podcasts.id
  │     ├── type: 'note'      → notes.id
  │     └── type: 'recording' → class_recordings.id
  ├── course_materials (1:N) — existing, kept for backward compat
  └── course_progress (1:N) — per-user per-resource completion
```

### New route: `/course/:courseId`

A dedicated course dashboard with tabs:

| Tab | Content |
|-----|---------|
| **Overview** | Course info, enrollment stats, progress ring, recent activity |
| **Materials** | Documents (existing course_materials + new doc resources) |
| **Quizzes** | Course quizzes + "Generate Quiz" for this course |
| **Podcasts** | Course podcasts + "Generate Podcast" for this topic |
| **Notes** | Shared course notes + user's course-specific notes |
| **Discussions** | Course discussion feed (social posts tagged to course) |
| **Schedule** | Schedule items linked to this course |
| **AI Tutor** | Chat scoped to all course documents |

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    /course/:courseId                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  CourseDashboard.tsx                                  │   │
│  │  ┌─────────┬─────────┬──────┬────────┬──────┬──────┐ │   │
│  │  │Overview │Materials│Quiz  │Podcast │Notes │Chat  │ │   │
│  │  └─────────┴─────────┴──────┴────────┴──────┴──────┘ │   │
│  │                                                       │   │
│  │  Each tab renders existing components with             │   │
│  │  course_id filter applied via hooks                    │   │
│  └──────────────────────────────────────────────────────┘   │
│                          │                                   │
│                          ▼                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  useCourseResources(courseId)                          │   │
│  │  useCourseEnrollment(courseId)                         │   │
│  │  useCourseProgress(courseId, userId)                   │   │
│  └──────────────────────────────────────────────────────┘   │
│                          │                                   │
│                          ▼                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Supabase Tables                                      │   │
│  │  course_enrollments | course_resources | course_progress│  │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. New Database Tables

### `course_enrollments`

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `course_id` | `uuid` | FK → `courses.id` ON DELETE CASCADE, NOT NULL | |
| `user_id` | `uuid` | FK → `profiles.id` ON DELETE CASCADE, NOT NULL | |
| `enrolled_at` | `timestamptz` | default `now()` | When they enrolled |
| `progress_percent` | `integer` | default `0`, CHECK 0-100 | Overall course progress |
| `last_accessed_at` | `timestamptz` | nullable | Last time user opened course |
| `status` | `text` | default `'active'`, CHECK IN ('active','completed','dropped') | |

**Unique constraint:** `(course_id, user_id)`  
**RLS:** Users can read/insert/update their own enrollments only.

### `course_resources`

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `course_id` | `uuid` | FK → `courses.id` ON DELETE CASCADE, NOT NULL | |
| `resource_type` | `text` | NOT NULL, CHECK IN ('document','quiz','podcast','note','recording') | |
| `resource_id` | `uuid` | NOT NULL | Points to document/quiz/podcast/note/recording id |
| `title` | `text` | NOT NULL | Display title (can differ from resource's own title) |
| `description` | `text` | nullable | |
| `category` | `text` | nullable | Grouping label (e.g., "Week 1", "Midterm Prep") |
| `sort_order` | `integer` | default `0` | Ordering within course |
| `is_required` | `boolean` | default `false` | Must complete for course progress |
| `created_at` | `timestamptz` | default `now()` | |
| `created_by` | `uuid` | FK → `profiles.id`, nullable | Admin who linked it |

**Unique constraint:** `(course_id, resource_type, resource_id)`  
**RLS:** Anyone can read. Only admins can insert/update/delete.

### `course_progress`

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `enrollment_id` | `uuid` | FK → `course_enrollments.id` ON DELETE CASCADE, NOT NULL | |
| `resource_id` | `uuid` | FK → `course_resources.id` ON DELETE CASCADE, NOT NULL | |
| `completed` | `boolean` | default `false` | |
| `completed_at` | `timestamptz` | nullable | |
| `score` | `integer` | nullable | For quizzes: percentage score |
| `time_spent_seconds` | `integer` | default `0` | Time spent on resource |
| `last_accessed_at` | `timestamptz` | nullable | |

**Unique constraint:** `(enrollment_id, resource_id)`  
**RLS:** Users can only read/update their own progress (via enrollment ownership).

---

## 5. Phase 1 — Enrollment System & Core Tables

> **Priority:** P0 — Foundation for everything else  
> **Estimated effort:** 1–2 days  

### Checklist

- [x] **5.1** Create SQL migration file `sql/course_integration_phase1.sql`
  - [x] Create `course_enrollments` table with constraints
  - [x] Create `course_resources` table with constraints  
  - [x] Create `course_progress` table with constraints
  - [x] Add indexes: `course_enrollments(course_id)`, `course_enrollments(user_id)`, `course_resources(course_id)`, `course_resources(resource_type, resource_id)`, `course_progress(enrollment_id)`
  - [x] Add RLS policies for all 3 tables
  - [x] Add trigger: auto-update `course_enrollments.last_accessed_at` when progress changes
  - [x] Add function: `calculate_course_progress(enrollment_id)` → recalculates `progress_percent`

- [x] **5.2** Run SQL migration in Supabase dashboard

- [x] **5.3** Regenerate Supabase TypeScript types
  - [x] Run `supabase gen types typescript --project-id <id> > src/integrations/supabase/types.ts`
  - [x] Verify new tables appear in `Database['public']['Tables']`

- [x] **5.4** Create enrollment hook: `src/hooks/useCourseEnrollment.ts`
  - [x] `useEnrollment(courseId)` — check if current user is enrolled
  - [x] `useEnrollInCourse()` — mutation to enroll
  - [x] `useUnenrollFromCourse()` — mutation to drop
  - [x] `useCourseEnrollmentCount(courseId)` — total enrolled students
  - [x] `useMyEnrollments()` — all courses user is enrolled in

- [x] **5.5** Create resources hook: `src/hooks/useCourseResources.ts`
  - [x] `useCourseResources(courseId)` — fetch all linked resources
  - [x] `useCourseResourcesByType(courseId, type)` — filtered by type
  - [x] `useAddCourseResource()` — admin mutation
  - [x] `useRemoveCourseResource()` — admin mutation

- [x] **5.6** Create progress hook: `src/hooks/useCourseProgress.ts`
  - [x] `useCourseProgress(enrollmentId)` — all progress for enrollment
  - [x] `useMarkResourceComplete()` — mutation
  - [x] `useResourceProgress(enrollmentId, resourceId)` — single resource

- [x] **5.7** Add "Enroll" button to existing `CourseDetail.tsx`
  - [x] Show "Enroll" if not enrolled, "Continue Learning" if enrolled
  - [x] "Continue Learning" navigates to `/course/:courseId` (Phase 2)
  - [x] Show enrollment count badge

- [x] **5.8** Add `/course/:courseId` route to `src/App.tsx`
  - [x] Import new `CourseDashboard` page component
  - [x] Route: `/course/:courseId` → `<CourseDashboard />`
  - [x] Protected route (requires auth)

---

## 6. Phase 2 — Course Dashboard UI

> **Priority:** P0 — Core user experience  
> **Estimated effort:** 2–3 days  

### Checklist

- [x] **6.1** Create course dashboard page: `src/pages/CourseDashboard.tsx`
  - [x] Read `courseId` from URL params
  - [x] Fetch course data from `courses` table
  - [x] Check enrollment status (redirect to library if not enrolled)
  - [x] Update `last_accessed_at` on load
  - [x] Render tabbed layout

- [ ] **6.2** Create dashboard shell: `src/components/course/dashboard/CourseDashboardShell.tsx`
  - [ ] Course header (title, code, department, progress ring)
  - [ ] Tab navigation (Overview, Materials, Quizzes, Podcasts, Notes, Discussions, Schedule, AI Tutor)
  - [ ] Mobile-responsive tab scrolling

- [x] **6.3** Overview tab: `src/components/course/dashboard/CourseOverview.tsx`
  - [x] Course description
  - [x] Progress ring with percentage
  - [x] Enrollment stats (total students)
  - [x] Recent activity (last 5 resources accessed)
  - [x] Quick action cards ("Take a Quiz", "Listen to Podcast", "Ask AI")

- [x] **6.4** Materials tab: `src/components/course/dashboard/CourseMaterials.tsx`
  - [x] List `course_resources` where `resource_type = 'document'`
  - [x] Also include existing `course_materials` (backward compat)
  - [x] Group by `category`
  - [x] "View" and "Ask AI" actions per document
  - [x] Show completion checkmark per resource

- [x] **6.5** Quizzes tab: `src/components/course/dashboard/CourseQuizzes.tsx`
  - [x] List `course_resources` where `resource_type = 'quiz'`
  - [ ] For each, fetch quiz data from `quizzes` table
  - [x] Show quiz title, question count, best score (from `quiz_attempts`)
  - [x] "Take Quiz" button → opens `QuizModal` with quiz data
  - [ ] "Generate Quiz" button → generates quiz from course documents (Phase 5)
  - [ ] Mark complete on quiz attempt with score ≥ passing threshold

- [x] **6.6** Podcasts tab: `src/components/course/dashboard/CoursePodcasts.tsx`
  - [x] List `course_resources` where `resource_type = 'podcast'`
  - [ ] Render `PodcastCard` for each
  - [x] Listen action opens `PodcastPanel`
  - [ ] "Generate Podcast" button → generates from course content (Phase 5)
  - [ ] Mark complete on listen

- [x] **6.7** Notes tab: `src/components/course/dashboard/CourseNotes.tsx`
  - [x] List `course_resources` where `resource_type = 'note'`
  - [ ] Show shared course notes
  - [ ] "My Notes" section — user's notes with `document_id` matching any course document
  - [ ] "Create Note" → opens NoteEditor, auto-tags with course info

- [x] **6.8** Discussions tab: `src/components/course/dashboard/CourseDiscussions.tsx`
  - [x] Filter `social_posts` by a course hashtag (e.g., `#course-{courseCode}`)
  - [ ] OR create a `social_group` per course and show group feed
  - [x] "New Post" button scoped to course group/hashtag
  - [x] Reuse existing `PostCard` component

- [ ] **6.9** Schedule tab: `src/components/course/dashboard/CourseSchedule.tsx`
  - [ ] Filter `schedule_items` where `subject` matches course title or an added `course_id`
  - [ ] Show timeline/calendar view of upcoming items
  - [ ] "Add to Schedule" to create study blocks for this course

- [x] **6.10** AI Tutor tab: `src/components/course/dashboard/CourseAITutor.tsx`
  - [ ] Embed `AiChat` component
  - [x] Pre-select all course documents as context (`selectedDocumentIds`)
  - [x] Set session title to course name
  - [ ] Course-aware system prompt

---

## 7. Phase 3 — Admin Resource Linking

> **Priority:** P1 — Required for admins to populate course content  
> **Estimated effort:** 1–2 days  

### Checklist

- [x] **7.1** Add "Manage Resources" section to `CourseManagement.tsx`
  - [x] Below existing materials section
  - [x] Shows all `course_resources` for selected course
  - [x] Delete resource button

- [x] **7.2** Create "Link Resource" dialog: `src/components/admin/LinkResourceDialog.tsx`
  - [x] Resource type selector (Document, Quiz, Podcast, Note, Recording)
  - [x] Search/browse existing resources of that type
  - [x] Set title override, description, category, sort_order, is_required
  - [x] Creates `course_resources` row

- [ ] **7.3** Add "Generate for Course" buttons
  - [ ] "Generate Quiz from Course Materials" → calls existing quiz generation with course docs
  - [ ] "Generate Podcast from Course Materials" → calls existing podcast generation with course docs
  - [ ] Auto-links generated resource to course via `course_resources`

- [x] **7.4** Bulk import existing `course_materials` into `course_resources`
  - [x] Migration script: `sql/migrate_course_materials_to_resources.sql`
  - [x] Uses `ON CONFLICT DO NOTHING` to be safely re-runnable

- [x] **7.5** Update `GenerateModulesDialog.tsx`
  - [x] After creating documents + notes, also create `course_resources` rows
  - [x] Link generated notes as `resource_type = 'note'`

---

## 8. Phase 4 — Progress Tracking

> **Priority:** P1 — Gamification & completion tracking  
> **Estimated effort:** 1–2 days  

### Checklist

- [x] **8.1** Auto-track document views
  - [x] When user opens a document viewer for a course resource, insert/update `course_progress`
  - [x] `openPreview()` in `DocumentUpload.tsx` calls `trackCourseResourceAccess()`

- [x] **8.2** Auto-track quiz completion
  - [x] After `quiz_attempts` insert, check if quiz is a course resource
  - [x] `useQuizTracking.ts` calls `trackCourseResourceCompletion(userId, 'quiz', quizId, { score: percentage })`
  - [x] Client-side fire-and-forget hook

- [x] **8.3** Auto-track podcast listens
  - [x] After `podcast_listeners` insert / listen count increment
  - [x] `PodcastsPage.tsx` calls `trackCourseResourceCompletion(currentUser.id, 'podcast', podcastId)`

- [x] **8.4** Auto-track note views
  - [x] `NotesList.tsx` `handleNoteSelect` calls `trackCourseResourceAccess(userId, 'note', note.id)`

- [x] **8.5** Recalculate course progress
  - [x] DB trigger `trg_recalculate_course_progress` fires `calculate_course_progress()` on any `course_progress` change
  - [x] Updates `course_enrollments.progress_percent`
  - [x] DB trigger created in Phase 1 SQL migration

- [x] **8.6** Progress UI components
  - [x] `<ProgressRing percent={n} />` — circular progress indicator in `CourseDashboard.tsx`
  - [x] Completion checkmarks on resource cards in CourseDashboard
  - [x] Progress bar in course card on library page

- [x] **8.7** Update enrollment status
  - [x] When `progress_percent = 100`, set `status = 'completed'` (handled in `calculate_course_progress()` SQL function)
  - [x] Show completion celebration banner on course dashboard

---

## 9. Phase 5 — AI & Generation Integration

> **Priority:** P2 — Enhanced experience  
> **Estimated effort:** 2–3 days  

### Checklist

- [ ] **9.1** Course-scoped quiz generation
  - [ ] "Generate Quiz" button on Course Dashboard → Quizzes tab
  - [ ] Collects all course document content as source material
  - [ ] Calls `generate-quiz` edge function (or `generate-inline-content`)
  - [ ] Auto-creates `quizzes` row + `course_resources` link

- [ ] **9.2** Course-scoped podcast generation
  - [ ] "Generate Podcast" button on Course Dashboard → Podcasts tab
  - [ ] Uses course title + description + document summaries as script source
  - [ ] Calls `generate-podcast` edge function
  - [ ] Auto-creates `ai_podcasts` row + `course_resources` link

- [ ] **9.3** Course-scoped AI chat
  - [ ] AI Tutor tab pre-loads all course document IDs
  - [ ] System prompt includes: "You are a tutor for {course.title} ({course.code})..."
  - [ ] Chat session auto-tagged with course metadata
  - [ ] "Ask about this resource" button on each resource card → opens AI chat with that doc selected

- [ ] **9.4** Course-scoped note generation
  - [ ] "Generate Study Notes" from course materials
  - [ ] Calls `generate-inline-content` with document content
  - [ ] Creates `notes` row + `course_resources` link

- [ ] **9.5** Course-scoped flashcard generation
  - [ ] "Generate Flashcards" from course notes
  - [ ] Uses existing flashcard generation logic
  - [ ] Links flashcards to course notes

- [ ] **9.6** Smart recommendations
  - [ ] Based on progress, suggest next resource to study
  - [ ] "You completed 3/5 quizzes — try Quiz: Midterm Review next"
  - [ ] Based on quiz scores, suggest review materials

---

## 10. File Reference Map

### Files to CREATE

| File | Purpose | Phase |
|------|---------|-------|
| `sql/course_integration_phase1.sql` | DB migration for 3 new tables | 1 |
| `src/hooks/useCourseEnrollment.ts` | Enrollment queries & mutations | 1 |
| `src/hooks/useCourseResources.ts` | Resource linking queries & mutations | 1 |
| `src/hooks/useCourseProgress.ts` | Progress tracking queries & mutations | 1 |
| `src/pages/CourseDashboard.tsx` | Main course dashboard page | 2 |
| `src/components/course/dashboard/CourseDashboardShell.tsx` | Dashboard layout with tabs | 2 |
| `src/components/course/dashboard/CourseOverview.tsx` | Overview tab | 2 |
| `src/components/course/dashboard/CourseMaterials.tsx` | Materials tab | 2 |
| `src/components/course/dashboard/CourseQuizzes.tsx` | Quizzes tab | 2 |
| `src/components/course/dashboard/CoursePodcasts.tsx` | Podcasts tab | 2 |
| `src/components/course/dashboard/CourseNotes.tsx` | Notes tab | 2 |
| `src/components/course/dashboard/CourseDiscussions.tsx` | Discussions tab | 2 |
| `src/components/course/dashboard/CourseSchedule.tsx` | Schedule tab | 2 |
| `src/components/course/dashboard/CourseAITutor.tsx` | AI tutor tab | 2 |
| `src/components/admin/LinkResourceDialog.tsx` | Admin resource linking dialog | 3 |
| `src/components/course/dashboard/ProgressRing.tsx` | Circular progress component | 4 |

### Files to MODIFY

| File | Change | Phase |
|------|--------|-------|
| `src/integrations/supabase/types.ts` | Regenerate with new tables | 1 |
| `src/components/courseLibrary/CourseDetail.tsx` | Add Enroll button, enrollment count | 1 |
| `src/App.tsx` | Add `/course/:courseId` route | 1 |
| `src/components/admin/CourseManagement.tsx` | Add resource management section | 3 |
| `src/components/admin/GenerateModulesDialog.tsx` | Also create `course_resources` rows | 3 |
| `src/components/quizzes/components/QuizModal.tsx` | After attempt, check course_resources link | 4 |
| `src/components/podcasts/PodcastsPage.tsx` | After listen, check course_resources link | 4 |

---

## 11. Database Table Reference

### Existing tables involved

| Table | Location in types.ts | Key Fields | Course Link |
|-------|---------------------|------------|-------------|
| `courses` | Line ~834 | `id, code, title, department, level, semester` | — (root) |
| `course_materials` | Line ~786 | `course_id, document_id, title, category` | FK to courses |
| `documents` | Line ~947 | `id, title, file_url, content_extracted, type` | Via course_materials/course_resources |
| `quizzes` | Line ~2168 | `id, title, questions (Json), class_id, source_type` | Via course_resources (new) |
| `quiz_attempts` | Line ~2121 | `quiz_id, user_id, score, percentage` | Via quiz → course_resources |
| `ai_podcasts` | Line ~173 | `id, title, audio_segments, status, listen_count` | Via course_resources (new) |
| `notes` | Line ~1445 | `id, title, content, category, document_id` | Via course_resources (new) |
| `class_recordings` | Line ~625 | `id, title, subject, transcript, audio_url` | Via course_resources (new) |
| `social_posts` | Line ~3264 | `id, content, user_id, hashtags` | Via hashtag/group (Phase 2) |
| `schedule_items` | Line ~2255 | `id, title, subject, type, start_time, end_time` | Via subject match or future course_id |
| `profiles` | Varies | `id, full_name, avatar_url` | Via enrollments |

### New tables (Phase 1)

| Table | Purpose | Key Relationships |
|-------|---------|-------------------|
| `course_enrollments` | Track who's taking which course | `courses.id` + `profiles.id` |
| `course_resources` | Link any feature to a course | `courses.id` + polymorphic `resource_type` + `resource_id` |
| `course_progress` | Track per-resource completion | `course_enrollments.id` + `course_resources.id` |

---

## 12. Key Architectural Decisions

### Decision 1: Polymorphic `course_resources` vs. adding `course_id` to every table

**Chosen:** Polymorphic junction table  
**Why:**  
- No schema changes to existing tables (quizzes, podcasts, notes, etc.)
- One resource can belong to multiple courses
- Admin can link/unlink without touching the resource itself
- Decoupled — existing features keep working independently

**Trade-off:** Requires joining through `course_resources` to filter by course, slightly more complex queries.

### Decision 2: Keep `course_materials` alongside `course_resources`

**Chosen:** Keep both, migrate data  
**Why:**  
- `course_materials` has download counts, existing data, and admin UI
- Avoiding a breaking migration on existing users
- Phase 3.4 creates matching `course_resources` rows for backward compatibility

### Decision 3: Dedicated `/course/:courseId` route vs. expanding inline detail

**Chosen:** Dedicated route  
**Why:**  
- Course dashboard is too complex for inline state toggle
- Deep linking to specific course tabs (e.g., `/course/abc/quizzes`)
- Browser back button works naturally
- Shareable URLs

### Decision 4: Social integration via hashtags vs. dedicated course groups

**Chosen:** Start with hashtag approach (`#course-{code}`), optionally add course groups later  
**Why:**  
- Hashtags work with existing social infrastructure
- No new tables needed for basic discussion
- Can upgrade to auto-created `social_groups` per course in a follow-up

### Decision 5: Progress tracking via DB triggers vs. client-side hooks

**Chosen:** Hybrid — client-side hooks with DB trigger for recalculation  
**Why:**  
- Client hooks give immediate UI feedback
- DB trigger ensures `progress_percent` stays consistent even if client misses an update
- Trigger on `course_progress` INSERT/UPDATE → calls `calculate_course_progress()`

---

## Quick Start for Contributors

### Prerequisites
- Node.js 18+, pnpm/bun
- Supabase CLI (for migrations)
- Access to Supabase project dashboard (for SQL execution)

### How to pick up this work

1. Read this document top to bottom
2. Check the checklists — find the next unchecked item
3. Look at the [File Reference Map](#10-file-reference-map) for what files to create/modify
4. Implement the item, test it locally
5. Check the box in this file and commit with a message like: `feat(course): Phase 1.3 — regenerate supabase types`
6. Move to the next item

### Running locally
```bash
# Install deps
bun install

# Start dev server
bun run dev

# Generate Supabase types (after DB changes)
supabase gen types typescript --project-id <PROJECT_ID> > src/integrations/supabase/types.ts
```

### Commit convention
```
feat(course): Phase X.Y — short description
fix(course): Phase X.Y — what was fixed
```

---

## Change Log

| Date | Phase | Items | Author |
|------|-------|-------|--------|
| 2026-02-09 | — | Created integration plan document | — |
| 2026-02-09 | 1 | SQL migration, 3 hooks, enroll button, route, CourseDashboard page | — |
| 2026-02-09 | 1,3 | Run SQL migration, regen types, LinkResourceDialog, admin resources section, GenerateModulesDialog update | — |

---

> **Next step:** Start implementing **Phase 1** — create the SQL migration and run it in Supabase.
