# Notification & Groups System Architecture

> Last updated: February 10, 2026

## Overview

StuddyHub has **two separate notification systems** that serve different purposes:

| System | Table | Field for read | Hook | Purpose |
|--------|-------|----------------|------|---------|
| **Platform/General** | `notifications` | `read` (boolean) | `useNotifications` | Schedule reminders, quiz due, AI limits, podcast alerts |
| **Social/Feed** | `social_notifications` | `is_read` (boolean) | `useSocialNotifications` | Likes, comments, follows, mentions, shares, group invites |

---

## Database Tables

### 1. `notifications` (Platform Notifications)

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Unique identifier |
| `user_id` | uuid | Target user |
| `type` | string | `schedule_reminder`, `quiz_due`, `assignment_due`, `social_like`, `social_comment`, `social_follow`, `social_mention`, `podcast_share`, `ai_limit_warning`, `general` |
| `title` | string | Notification title |
| `message` | string | Notification body |
| `data` | jsonb | Arbitrary payload (e.g., `{ post_id, actor_id }`) |
| `read` | boolean | Read status (default: `false`) |
| `read_at` | timestamp | When marked as read |
| `created_at` | timestamp | Creation time |
| `expires_at` | timestamp | Optional expiration |

**Created by:** `send-notification` edge function  
**Managed by:** Direct Supabase client calls in `useNotifications` hook  

### 2. `social_notifications` (Social Feed Notifications)

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Unique identifier |
| `user_id` | uuid (FK → social_users) | Target user |
| `actor_id` | uuid (FK → social_users, nullable) | User who triggered the notification |
| `type` | string | `like`, `comment`, `follow`, `mention`, `share`, `group_invite` |
| `title` | string | Notification title |
| `message` | string | Notification body |
| `post_id` | uuid (FK → social_posts, nullable) | Related post |
| `data` | jsonb | Additional payload (e.g., `{ group_id }`) |
| `is_read` | boolean | Read status (default: `false`) |
| `created_at` | timestamp | Creation time |

**Created by:** Edge functions (`toggle-like`, `toggle-follow`, `comment-on-post`, `manage-group-member`)  
**Managed by:** `manage-notifications` edge function via `useSocialNotifications` hook  

### Supporting Tables

- **`notification_preferences`** — Per-user toggle settings (email, push, schedule, social, quiz, assignment, quiet hours)
- **`notification_subscriptions`** — Web Push API subscription records (endpoint, keys, device type)

---

## Notification Types & Navigation

### Social Notifications (in `social_notifications` table)

| Type | Created By | Has `actor_id`? | Has `post_id`? | Navigation Target |
|------|-----------|-----------------|----------------|-------------------|
| `like` | `toggle-like` | ✅ | ✅ | `/social/post/:postId` |
| `comment` | `comment-on-post` | ✅ | ✅ | `/social/post/:postId` |
| `follow` | `toggle-follow` | ✅ | ❌ | `/social/profile/:actorId` |
| `mention` | (future) | ✅ | ✅ | `/social/post/:postId` |
| `share` | (future) | ✅ | ✅ | `/social/post/:postId` |
| `group_invite` | `manage-group-member` | ✅ | ❌ | `/social/group/:groupId` (from `data.group_id`) |

### Platform Notifications (in `notifications` table)

| Type | Navigation Target |
|------|-------------------|
| `schedule_reminder` | `/schedule` |
| `assignment_due` | `/schedule` |
| `quiz_due` | `/quizzes` |
| `social_like/comment/mention` | `/social/post/:postId` (from `data.post_id`) |
| `social_follow` | `/social/profile/:actorId` (from `data.actor_id`) |
| Other | `/social/notifications` |

---

## File Reference

### Hooks

| File | Hook | Table | Purpose |
|------|------|-------|---------|
| `src/hooks/useNotifications.ts` | `useNotifications()` | `notifications` | Platform notification CRUD, push subscription, preferences |
| `src/components/social/hooks/useSocialNotifications.ts` | `useSocialNotifications()` | `social_notifications` | Social notification CRUD, realtime, pagination |
| `src/hooks/useSocialData.ts` | `useSocialData()` | `social_notifications` | Realtime listener (delegates to callback, **no toast** — deduped) |

### Components

| File | Component | Description |
|------|-----------|-------------|
| `src/components/social/components/NotificationsSection.tsx` | `<NotificationsSection>` | Main notification list UI with filtering, infinite scroll, navigation |
| `src/components/social/SocialFeed.tsx` | `<SocialFeed>` | Parent component — renders `<NotificationsSection>` in "notifications" tab |

### Adapters & Helpers

| File | Function | Description |
|------|----------|-------------|
| `src/components/social/components/feed/notificationHelpers.ts` | `adaptNotifications()` | Converts `SocialNotification[]` → `SocialNotificationItem[]` for UI |
| `src/components/social/components/feed/notificationHelpers.ts` | `getNotificationTitle()` | Generate title from notification type |
| `src/components/social/components/feed/notificationHelpers.ts` | `getNotificationMessage()` | Generate message from notification type + actor name |
| `src/services/notificationHelpers.ts` | `create*Notification()` | Create platform notifications via `send-notification` edge function |

### Edge Functions

| Function | Table | Action |
|----------|-------|--------|
| `supabase/functions/send-notification/` | `notifications` | INSERT platform notification + web push |
| `supabase/functions/manage-notifications/` | `social_notifications` | mark_read, mark_all_read, delete |
| `supabase/functions/toggle-like/` | `social_notifications` | INSERT `type: 'like'` on post like |
| `supabase/functions/toggle-follow/` | `social_notifications` | INSERT `type: 'follow'` on follow |
| `supabase/functions/comment-on-post/` | `social_notifications` | INSERT `type: 'comment'` on comment |
| `supabase/functions/manage-group-member/` | `social_notifications` | INSERT `type: 'group_invite'` on approve/reject |
| `supabase/functions/delete-social-post/` | `social_notifications` | CASCADE DELETE by post_id |

### Types

| File | Type | Description |
|------|------|-------------|
| `src/types/Notification.ts` | `Notification` | Platform notification interface (`read` field) |
| `src/types/Notification.ts` | `NotificationType` | Union type for all platform notification types |
| `src/components/social/hooks/useSocialNotifications.ts` | `SocialNotification` | Social notification (`is_read` field, `actor?`, `post?`) |
| `src/components/social/components/NotificationsSection.tsx` | `SocialNotificationItem` | UI-adapted notification for display |
| `src/integrations/supabase/types_utf8.ts` | DB types | Auto-generated Supabase table types |

---

## Data Flow

### Creating a Social Notification

```
User Action (like/comment/follow)
  → Frontend calls edge function (toggle-like, comment-on-post, etc.)
    → Edge function INSERTs into `social_notifications` table
      → Supabase Realtime broadcasts INSERT event
        → useSocialNotifications hook receives event
          → Fetches full notification with actor/post JOINs
            → Prepends to state, increments unreadCount
              → Shows toast with "View" action button
        → useSocialData hook also receives event (NO duplicate toast)
          → Calls onNotificationReceived callback (if provided)
```

### Displaying Notifications

```
SocialFeed.tsx
  → calls useSocialNotifications() hook
    → Fetches from social_notifications with actor + post JOINs
  → Passes notifications to filteredNotifications (search filter)
  → Calls adaptNotifications(filteredNotifications) 
    → Converts SocialNotification[] → SocialNotificationItem[]
    → Extracts post_id, actor_id, group_id into data object
  → Renders <NotificationsSection notifications={adapted} />
    → For each notification:
      → Shows actor avatar with type icon overlay (or just icon if no actor)
      → Shows title, message, @username, time ago, type badge
      → On click: navigates based on type + resolved IDs
```

### Navigation Resolution (in `handleNotificationClick`)

```
1. Resolve IDs from multiple sources:
   postId  = data.post_id || data.post?.id
   actorId = data.actor_id || notification.actor?.id || data.actor?.id
   groupId = data.group_id

2. Route by type:
   like/comment/mention/share → /social/post/:postId
   follow                     → /social/profile/:actorId  
   group_invite               → /social/group/:groupId (or /social/groups fallback)
   default                    → /social/feed
```

---

## Known Design Decisions

### Why Two Tables?

- **`notifications`**: Platform-wide alerts (schedule reminders, quiz due dates) — created by the `send-notification` edge function, supports web push via service worker, has expiration.
- **`social_notifications`**: Social interactions only — created by individual action edge functions, has foreign keys to `social_users` and `social_posts` for JOIN queries, managed via `manage-notifications` edge function.

### Duplicate Toast Prevention

- `useSocialData.ts` subscribes to `social_notifications` realtime but does **NOT** show toasts (removed to prevent duplicates)
- Only `useSocialNotifications.ts` shows toasts on new notifications
- Both subscriptions use different channel names (`user_notifications` vs `user_notifications_{userId}`) to avoid Supabase channel conflicts

### Notification Insert Requirements

All INSERTs into `social_notifications` **MUST** include:
- `user_id` (required) — target user
- `actor_id` (required when available) — who triggered it
- `type` (required) — one of: `like`, `comment`, `follow`, `mention`, `share`, `group_invite`
- `title` (required) — short title
- `message` (required) — descriptive message
- `is_read` (required) — always `false` for new notifications
- `post_id` (optional) — if related to a post
- `data` (optional) — additional JSON payload (e.g., `{ group_id }`)

---

## Implementation Steps for New Developers

### Adding a New Notification Type

1. **Update the type union** in `src/components/social/hooks/useSocialNotifications.ts`:
   ```ts
   type: 'like' | 'comment' | 'follow' | 'mention' | 'share' | 'group_invite' | 'YOUR_NEW_TYPE';
   ```

2. **Add the icon** in `NotificationsSection.tsx` → `getNotificationIcon()`:
   ```ts
   case 'your_new_type':
     return <YourIcon className="h-5 w-5 text-color-500" />;
   ```

3. **Add title/message** in `notificationHelpers.ts` → `getNotificationTitle()` and `getNotificationMessage()`

4. **Add navigation** in `NotificationsSection.tsx` → `handleNotificationClick()`:
   ```ts
   case 'your_new_type':
     navigate(`/your/route/${relevantId}`);
     break;
   ```

5. **Add toast navigation** in `useSocialNotifications.ts` → realtime handler toast action

6. **Create the notification** in your edge function:
   ```ts
   await supabase.from('social_notifications').insert({
     user_id: targetUserId,
     actor_id: currentUserId,
     type: 'your_new_type',
     title: 'Your Title',
     message: 'Your message',
     is_read: false,
     post_id: postId || null,
     data: { custom_key: value }
   });
   ```

### Modifying Navigation

Navigation is handled in two places:
1. **Click handler**: `NotificationsSection.tsx` → `handleNotificationClick()` — for list item clicks
2. **Toast action**: `useSocialNotifications.ts` → realtime INSERT handler → `toast.info(..., { action })` — for toast "View" button

Both must be updated when changing navigation behavior.

### Edge Function Changes

After modifying edge functions in `supabase/functions/`, deploy with:
```bash
supabase functions deploy <function-name>
```

For example:
```bash
supabase functions deploy manage-group-member
supabase functions deploy manage-notifications
```

---

## Private Group Join Flow

### How It Works

Private groups require admin approval before a user becomes a member. The flow is:

```
User clicks "Join" on a private group card
  → useSocialActions.joinGroup() inserts into social_group_members with status: 'pending'
  → Frontend state updates: is_member: false, member_status: 'pending'
  → UI shows amber "Pending" button on the group card
  → Admin approves via manage-group-member edge function
    → approve_group_member RPC sets status to 'active'
    → DB trigger _social_groups_recalc_members_count_for() fires
      → Recalculates members_count counting ONLY status='active' rows
    → Approval notification sent to user (type: 'group_invite')
  → On next data fetch, get-social-groups returns is_member: true, member_status: 'active'
  → UI shows "View" button, member count reflects corrected number
```

### Key Files

| File | Role |
|------|------|
| `src/components/social/hooks/useSocialActions.ts` → `joinGroup()` | Inserts pending membership, updates frontend state |
| `src/components/social/components/GroupsSection.tsx` | Renders group cards with 3 states: Join / Pending / View |
| `supabase/functions/get-social-groups/index.ts` | Fetches groups with correct `members_count` and `is_member` |
| `supabase/functions/join-leave-group/index.ts` | Handles public group joins (active immediately) |
| `supabase/functions/manage-group-member/index.ts` | Admin approve/reject with notifications |
| `scripts/all_rls_triggers_func.json` | DB trigger `_social_groups_recalc_members_count_for` |

### UI States on Group Card

| `member_status` | `is_member` | Button | Card Clickable | 
|-----------------|-------------|--------|----------------|
| `null` | `false` | **Join** (dark) | No |
| `'pending'` | `false` | **Pending** (amber, disabled, spinner) | No |
| `'active'` | `true` | **View →** (blue ghost) | Yes → navigates to `/social/group/:id` |

### Member Count Accuracy

The `members_count` column on `social_groups` is maintained by a DB trigger that fires on any INSERT/UPDATE/DELETE on `social_group_members`:

```sql
-- Trigger function: _social_groups_recalc_members_count_for(p_group_id)
UPDATE public.social_groups g
SET members_count = COALESCE(sub.cnt, 0)
FROM (
  SELECT COUNT(*) AS cnt
  FROM public.social_group_members
  WHERE status = 'active' AND group_id = p_group_id
) AS sub
WHERE g.id = p_group_id;
```

The `get-social-groups` edge function uses this DB-maintained value rather than an unfiltered aggregate count, ensuring pending and banned users are never counted.

### `is_member` Resolution

The `get-social-groups` edge function determines membership as:
```ts
is_member: membership?.status === 'active'  // NOT !!membership
```

This ensures users with `pending` or `banned` status are not treated as members.

---

## Recent Fixes (February 2026)

### Notification Fixes

1. **Fixed `group_invite` type missing from TypeScript union** — Added to `SocialNotification.type`
2. **Fixed navigation for all notification types** — Uses `data.post_id`, `data.actor_id`, `data.group_id` with fallbacks
3. **Fixed duplicate toasts** — Removed `toast.info()` from `useSocialData.ts` realtime handler
4. **Fixed `manage-group-member` edge function** — Now includes `actor_id` and `is_read: false`
5. **Added approval notification** — `manage-group-member` now sends notifications for both approvals and rejections
6. **Added notification type icons** — `mention` (AtSign), `share` (Share2), `group_invite` (purple Users)
7. **Added avatar type overlay** — Small icon badge on actor avatars showing the notification type
8. **Added type badge** — Visual badge showing notification category (like, comment, follow, etc.)
9. **Improved username display** — Styled `@username` with font-weight and proper null checks
10. **Improved `adaptNotifications`** — Flattens `post_id`, `actor_id`, `group_id` into `data` for reliable navigation

### Private Group Join Fixes

11. **Fixed inflated member count** — `get-social-groups` now uses DB-maintained `members_count` (active-only) instead of unfiltered `social_group_members(count)` aggregate
12. **Fixed `is_member` for pending users** — Changed from `!!membership` to `membership?.status === 'active'`
13. **Added pending state UI** — Group cards now show 3 states: Join / Pending (amber spinner) / View, instead of only Join / View
14. **Blocked card navigation for non-members** — Only active members can click the card to navigate to the group detail page
