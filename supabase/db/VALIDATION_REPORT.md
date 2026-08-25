# Schema Validation Report — against the REAL remote database

Pulled the **live** schema from `vykidardmwtxwjtijjap` via the Management API (source of truth, not
hand-maintained lists) on 2026-08-11. Raw dumps live in `supabase/db/real_*.json`.

| Artifact | Count |
|---|---|
| Tables (with RLS) | 105 |
| Columns | 1090 |
| Functions / RPCs | 279 (250 unique names) |
| Triggers | 63 |
| Policies | 580 |
| Enums | 25 (6 distinct) |
| Views | 4 |
| Indexes | 141 |

Pull scripts (reusable): `supabase/db/pull_real_schema.ps1`, `supabase/db/query_data.ps1`.
Validation scripts: `supabase/db/validate_schema.mjs`, `supabase/db/validate_references.mjs`.

---

## 1. Planner schema (`db_schema.ts`) — REGENERATED from real data

Both copies (`supabase/functions/gemini-chat/db_schema.ts` and `src/db_schema.ts`) were
hand-maintained lists that had drifted. Regenerated from the real dump via
`supabase/db/generate_db_schema.mjs`:

- **Deduplicated** `user_learning_goals` (was listed twice: #67 and #79)
- **Added 31 missing tables** (app_ratings, countries, course_enrollments, curricula,
  examinations, institutions, social_user_signals, user_education_profiles, etc.)
- **Fixed column drift on ~20 tables** (documents now has processing_* + folder columns,
  courses has institution/country/education_level FKs, social_users has verification columns,
  live_quiz_* updated to the real live-quiz schema, etc.)
- Now **105/105 tables, 1058 column lines**, every column matching the real schema; `(pk)`/`(fk)`
  annotations derived from the real PK/FK catalog.
- **Read-only aggregate views** (chat_session_memory_stats, chat_session_summaries, flashcard_stats,
  system_error_summary) intentionally excluded — they aren't writable targets.
- `src/db_schema.ts`'s helper exports (`ARRAY_COLUMNS`, `TABLE_ALIASES`,
  `validateAndRepairActionParams`) were preserved from the backup after regeneration.

`validate_schema.mjs` now reports: **0 tables missing, 0 extra, 0 column diffs** for both copies.

## 2. Edge functions — 3 real bugs found + fixed

1. **`like-post`** used `social_post_likes` (doesn't exist; real table is `social_likes`) and read
   `users.subscription_tier` (no `users` table in public; real source is `subscriptions.plan_type`).
   → Fixed both; like/unlike now hits `social_likes`, and the Scholar+ gate reads the real
   `subscriptions` table with `plan_type`/`status`.
2. **`toggle-bookmark`** called nonexistent RPCs `increment_counter` / `decrement_counter` (the
   `.then(null, fallback)` silently swallowed the failure). `social_posts.bookmarks_count` is a real
   plain column → replaced the RPC calls with the direct counter update.
3. **`send-message`** (legacy) wrote `chat_session_id`/`message_content`/`attachments`/`is_read` to
   the AI-chat `chat_messages` table (columns don't exist) and queried a guessed
   `chat_session_participants` table. → Rewrote to the real social-chat schema:
   `social_chat_sessions` (user_id1/user_id2) + `social_chat_messages`
   (`session_id`/`sender_id`/`content`) + `social_group_members` for groups, preserving its
   participant-notification feature.

**Bonus:** `utils/subscription-validator.ts` (both copies) read `subscriptions.subscription_tier`,
but the real column is `plan_type`. That meant **every tier check compared `undefined === 'free'` →
all users were treated as Scholar/Genius** (paywall bypass). Now maps `plan_type`/`status` →
`subscription_tier`, and non-canceled rows resolve correctly.

`validate_references.mjs`: edge functions now reference **0 missing tables, 0 missing RPCs**.

## 3. Android app (`BackendApiService.kt`) — 4 real bugs found + fixed

1. **`class_recordings`**: sent `duration_seconds` → real column is `duration` (every recording
   sync would 400). Fixed.
2. **`ai_podcasts`**: sent `topic` (doesn't exist) and dropped `script`/`style`/`duration_minutes`/
   `status` (all real). Fixed.
3. **`schedule_items`**: sent `color_hex` (doesn't exist; real is `color`) — this alone would fail
   the whole schedule-item INSERT. Removed; keeps `color`.
4. **`notes`**: deliberately dropped `tags`/`ai_summary`/`document_id` based on a stale `fulldb.sql`
   comment — the real `notes` table has all three. Now synced. **Review catch:** `notes.tags` is a
   `text[]` column, so the comma-separated local value is split into a `JSONArray` (a plain string
   would 22P02 the whole insert).

Payload column spot-check now verifies all 26 key tables: **0 mismatches**.

**Review follow-ups (all verified against the real DB):**
- `subscriptions` **has** a "Users can view their own subscription" RLS policy
  (`auth.uid() = user_id`) — the like-post tier read is safe.
- `social_group_members.status` defaults to `'active'` (and join-leave-group never sets it), so
  `send-message` now checks plain membership, not `status = 'approved'`.
- `db_schema.ts` regeneration now annotates `user_id` columns as `(fk -> auth.users)` (the FK
  catalog can't see cross-schema auth.users references).
- Code-review fixes applied; `db_schema.ts.bak` clutter removed.

## 4. Android Room layer — CLEAN

All 16 Room entities + DAO queries map to tables that exist in the real schema
(`sync_queue` is a local-only table, correctly not in the cloud). No changes needed.

## 5. Deployment

All **42 affected edge functions redeployed** (the 4 directly-fixed + 38 that bundle the shared
`subscription-validator.ts`). `BackendApiService.kt` changes ship with the next Android build.

## 6. How to stay in sync

1. Re-pull whenever you change the DB: `powershell -File supabase/db/pull_real_schema.ps1`
2. Re-validate: `node supabase/db/validate_schema.mjs && node supabase/db/validate_references.mjs`
3. Regenerate the planner schema after intentional schema changes:
   `node supabase/db/generate_db_schema.mjs`
