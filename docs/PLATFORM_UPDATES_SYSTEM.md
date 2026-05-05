# Platform Updates & Announcements System

> **Date**: February 23, 2026  
> **Version**: v2.5.0  
> **Status**: Production-ready (pending SQL migration)

---

## Overview

The Platform Updates system enables admins to communicate directly with users about new features, improvements, bug fixes, maintenance windows, and breaking changes. Users see a smart notification banner at the top of their dashboard and can drill into full changelogs with embedded video, documentation links, and rich markdown content.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     ADMIN SIDE                              │
│                                                             │
│  Admin Dashboard → "Updates" tab → PlatformUpdates.tsx      │
│      • Create / Edit / Delete updates                       │
│      • Set type, priority, status, media                    │
│      • Markdown content editor with live preview            │
│      • Schedule for future publish, set expiry              │
│      • View read counts per update                          │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                     DATABASE                                │
│                                                             │
│  platform_updates          platform_update_reads            │
│  ├─ id (UUID PK)           ├─ id (UUID PK)                 │
│  ├─ title                  ├─ update_id (FK)               │
│  ├─ summary                ├─ user_id (FK)                 │
│  ├─ content (markdown)     ├─ read_at                      │
│  ├─ update_type            ├─ dismissed (bool)             │
│  ├─ priority               └─ UNIQUE(update_id, user_id)   │
│  ├─ video_url                                               │
│  ├─ documentation_url                                       │
│  ├─ image_url                                               │
│  ├─ version_tag                                             │
│  ├─ status (lifecycle)                                      │
│  ├─ scheduled_for                                           │
│  ├─ published_at                                            │
│  ├─ expires_at                                              │
│  ├─ created_by (FK)                                         │
│  └─ updated_by (FK)                                         │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                     USER SIDE                               │
│                                                             │
│  Dashboard (Index.tsx)                                      │
│      └─ <PlatformUpdateBanner />                            │
│          • Gradient banner with priority-based coloring     │
│          • Dismiss / Read More                              │
│          • Detail modal with markdown, video embed, docs    │
│          • Navigate between multiple updates                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### `platform_updates` table

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Auto-generated |
| `title` | TEXT | Update headline (required) |
| `summary` | TEXT | Short banner text, max ~200 chars (required) |
| `content` | TEXT | Full markdown body — changelogs, docs, instructions |
| `update_type` | TEXT | `feature` · `improvement` · `bugfix` · `maintenance` · `announcement` · `breaking` |
| `priority` | TEXT | `low` · `normal` · `high` · `critical` |
| `video_url` | TEXT | YouTube or direct video link |
| `documentation_url` | TEXT | External docs or in-app page link |
| `image_url` | TEXT | Banner image URL |
| `version_tag` | TEXT | e.g. `v2.5.0`, `March 2026 Update` |
| `status` | TEXT | `draft` → `scheduled` → `published` → `archived` |
| `scheduled_for` | TIMESTAMPTZ | Auto-publish time (for scheduled updates) |
| `published_at` | TIMESTAMPTZ | When it was actually published |
| `expires_at` | TIMESTAMPTZ | Optional auto-archive date |
| `created_by` | UUID (FK) | Admin who created it |
| `updated_by` | UUID (FK) | Admin who last edited it |
| `created_at` | TIMESTAMPTZ | Auto-set |
| `updated_at` | TIMESTAMPTZ | Auto-updated via trigger |

### `platform_update_reads` table

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Auto-generated |
| `update_id` | UUID (FK) | References `platform_updates.id` |
| `user_id` | UUID (FK) | References `auth.users.id` |
| `read_at` | TIMESTAMPTZ | When the user viewed the update |
| `dismissed` | BOOLEAN | Whether the user dismissed the banner |

**Unique constraint**: `(update_id, user_id)` — one read record per user per update.

### RLS Policies

| Policy | Table | Effect |
|--------|-------|--------|
| `admin_full_access_platform_updates` | `platform_updates` | Admins can CRUD all updates |
| `users_read_published_updates` | `platform_updates` | Authenticated users can SELECT where status = 'published' |
| `users_manage_own_reads` | `platform_update_reads` | Users can INSERT/UPDATE their own read records |
| `admin_view_all_reads` | `platform_update_reads` | Admins can SELECT all read records (analytics) |

### Helper Functions

| Function | Purpose |
|----------|---------|
| `publish_scheduled_updates()` | Publishes updates where `scheduled_for <= now()` and status = 'scheduled'. Returns count. |
| `archive_expired_updates()` | Archives updates where `expires_at <= now()` and status = 'published'. Returns count. |

---

## Files Reference

### Admin Side

| File | Purpose |
|------|---------|
| `src/components/admin/PlatformUpdates.tsx` | Full admin UI — CRUD form, preview, stats, filter by status, read counts |
| `src/components/admin/adminDashboard.tsx` | Main dashboard — "Updates" tab (10th tab) |
| `src/components/admin/AdminLayout.tsx` | Sidebar — "Updates" nav item with Megaphone icon |

### User Side

| File | Purpose |
|------|---------|
| `src/components/updates/PlatformUpdateBanner.tsx` | Banner + detail modal for users |
| `src/pages/Index.tsx` | Dashboard — renders `<PlatformUpdateBanner />` below subscription bar |

### Database

| File | Purpose |
|------|---------|
| `sql/20260303_platform_updates.sql` | Complete migration — tables, indexes, RLS, triggers, helper functions |

### Routing

| Route | Component | Access |
|-------|-----------|--------|
| `/admin/updates` | `PlatformUpdates` | Admins with `canManageSettings` |

---

## How to Use (Admin)

### 1. Create an Update

1. Navigate to **Admin Panel → Updates** tab (or `/admin/updates`)
2. Click **"New Update"**
3. Fill in required fields:
   - **Title**: Headline for the update
   - **Summary**: Short text shown in the user banner (≤200 chars)
4. Optionally add:
   - **Full Content**: Markdown body with changelog details, instructions, etc.
   - **Video URL**: Link to a YouTube/Loom explainer video
   - **Documentation URL**: Link to docs page
   - **Banner Image**: Cover image URL
   - **Version Tag**: e.g. `v2.5.0`
5. Set **Type** (Feature / Improvement / Bug Fix / Maintenance / Announcement / Breaking Change)
6. Set **Priority** (Low / Normal / High / Critical) — affects banner color
7. Choose **Status**:
   - **Draft** — not visible to users, save for later
   - **Scheduled** — set a "Schedule For" datetime, will auto-publish
   - **Published** — visible immediately
8. Click **Save** / **Publish Now**

### 2. Manage Updates

- **Publish** a draft → click the green Send icon
- **Archive** a published update → click the Archive icon
- **Edit** any update → click the Edit icon
- **Delete** permanently → click the Trash icon (with confirmation)
- **Preview** content → toggle the Preview button in the form

### 3. Monitor Engagement

- Each update card shows **read count** (number of users who viewed it)
- Stats cards at the top show total, published, scheduled, and draft counts
- Filter updates by status using the filter tabs

---

## How It Works (User Side)

1. When a user visits the dashboard, `PlatformUpdateBanner` fetches all published updates
2. It checks `platform_update_reads` for which updates the user has dismissed
3. The latest unread update appears as a **colored gradient banner** at the top:
   - Blue = normal priority
   - Orange = high priority
   - Red = critical priority
4. User can:
   - **"Read More"** → opens a detail modal with full content, video embed, docs link
   - **"+N more"** badge → shows other recent updates
   - **"X" dismiss** → hides that update, recorded in `platform_update_reads`
5. Inside the detail modal, users can navigate between all recent updates

---

## Deployment Checklist

- [ ] Run `sql/20260303_platform_updates.sql` against your Supabase database
- [ ] Verify RLS policies are active (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`)
- [ ] Deploy frontend (PlatformUpdates.tsx + PlatformUpdateBanner.tsx already in build)
- [ ] (Optional) Set up a Supabase cron job to call `publish_scheduled_updates()` and `archive_expired_updates()` periodically
- [ ] Create your first update and verify it appears on the user dashboard

---

## Light & Dark Mode

The entire admin UI is fully compatible with both light and dark themes:
- All backgrounds use `bg-white dark:bg-gray-800` / `bg-gray-50 dark:bg-gray-900` patterns
- Text uses `text-gray-900 dark:text-white` and `text-gray-500 dark:text-gray-400`
- Inputs, selects, badges, and action buttons all have dual-mode styling
- Cards have `shadow-sm` for light mode depth

## Responsive Design

- Stats cards: 2-column on mobile, 4-column on desktop
- Form inputs: single column on mobile, multi-column on larger screens
- Action buttons: icon-only on mobile, icon+text on desktop
- Meta row text wraps gracefully with hidden labels on small screens
- URLs truncated to prevent overflow
