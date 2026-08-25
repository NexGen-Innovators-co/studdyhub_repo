# API Contract Reference

> **Single source of truth for all API endpoints.** Any client (Android, Web, iOS) must use these exact endpoints.

## Base URL

```
https://<project-ref>.supabase.co/functions/v1/api/v1
```

## Authentication

All requests require:
```
Authorization: Bearer <JWT>
apikey: <supabase-anon-key>
```

## Response Format

All endpoints return:
```json
{
  "success": true | false,
  "data": <object|array|null>,
  "error": <string|null>,
  "meta": { "timestamp": "<ISO-8601>" }
}
```

---

## Profile

### GET /profile
Get current user's profile.
- **Auth:** Required (uses JWT userId)
- **Response:** `data` = profile object

### PATCH /profile
Update current user's profile.
- **Body:** `{ full_name?, school?, academic_level?, academic_tier?, learning_style?, personal_context?, avatar_url?, username? }`
- **Response:** `data` = updated profile

### GET /profiles?id=<uuid>
Lookup profile by ID.
- **Response:** `data` = array of profiles

### GET /profiles?email=<email>
Lookup profile by email.
- **Response:** `data` = array of profiles

---

## Notes

### GET /notes
List current user's notes.
- **Query:** `folder_id`, `search`, `order` (default: `updated_at.desc`), `limit` (default: 50), `offset`
- **Response:** `data` = array of notes

### POST /notes
Create a note.
- **Body:** `{ title, content, category?, tags?, folder_id?, document_id? }`
- **Response:** `data` = created note

### PATCH /notes/:id
Update a note.
- **Body:** `{ title?, content?, category?, tags? }`
- **Response:** `data` = updated note

### DELETE /notes/:id
Delete a note.
- **Response:** `{ deleted: true, id }`

---

## Documents

### GET /documents
List current user's documents.
- **Query:** `folder_id`, `order` (default: `created_at.desc`), `limit`
- **Response:** `data` = array of documents

### POST /documents
Create or update a document.
- **Body:** `{ id?, title, type, file_name?, content_extracted?, folder_id?, ... }`
- **Response:** `data` = document

### PATCH /documents/:id
Update a document.
- **Body:** `{ title?, content_extracted?, folder_id?, ... }`
- **Response:** `data` = updated document

### DELETE /documents/:id
Delete a document.
- **Response:** `{ deleted: true, id }`

---

## Document Folders

### GET /document-folders
List current user's folders.
- **Response:** `data` = array of folders

### POST /document-folders
Create or update a folder.
- **Body:** `{ id?, name, color?, ... }`
- **Response:** `data` = folder

### PATCH /document-folders/:id
Update a folder.
- **Body:** `{ name?, color? }`
- **Response:** `data` = updated folder

### DELETE /document-folders/:id
Delete a folder.
- **Response:** `{ deleted: true, id }`

---

## Flashcards

### GET /flashcards
List current user's flashcards.
- **Query:** `order`, `limit`
- **Response:** `data` = array of cards

### GET /flashcards/decks
List current user's decks.
- **Response:** `data` = array of decks

### POST /flashcards/cards
Create a flashcard.
- **Body:** `{ front, back, category?, difficulty?, hint? }`
- **Response:** `data` = created card

### DELETE /flashcards/cards/:id
Delete a flashcard.
- **Response:** `{ deleted: true, id }`

---

## Quizzes

### GET /quizzes
List current user's quizzes.
- **Response:** `data` = array of quizzes

### POST /quizzes
Create a quiz.
- **Body:** `{ title, source_type?, questions? }`
- **Response:** `data` = created quiz

### DELETE /quizzes/:id
Delete a quiz and its attempts.
- **Response:** `{ deleted: true, id }`

### POST /quizzes/:id/submit
Submit a quiz attempt.
- **Body:** `{ score, total_questions, percentage, time_taken_seconds, answers?, xp_earned?, live_results? }`
- **Response:** `data` = created attempt

---

## Leaderboard

### GET /leaderboard
Get tier/school scoped leaderboard.
- **Query:** `tier` (default: `all`), `school`, `academic_level`, `limit` (default: 50)
- **Response:** `data` = array of `{ id, full_name, school, total_xp, avatar_url, academic_tier, points_balance }`

---

## Schedule

### GET /schedule
List current user's schedule items.
- **Response:** `data` = array of items

### POST /schedule
Create or update a schedule item.
- **Body:** `{ id?, title, subject, type, start_time, end_time, location?, description?, color?, ... }`
- **Response:** `data` = item

### DELETE /schedule/:id
Delete a schedule item.
- **Response:** `{ deleted: true, id }`

---

## Chat

### GET /chat/sessions
List current user's chat sessions.
- **Response:** `data` = array of sessions

### POST /chat/sessions
Create a chat session.
- **Body:** `{ id?, title }`
- **Response:** `data` = session

### DELETE /chat/sessions/:id
Delete a chat session.
- **Response:** `{ deleted: true, id }`

### GET /chat/messages
List messages for a session.
- **Query:** `session_id` (required), `order` (default: `timestamp.asc`)
- **Response:** `data` = array of messages

### POST /chat/messages
Create a chat message.
- **Body:** `{ id?, session_id, role, content, thinking_steps? }`
- **Response:** `data` = message

### DELETE /chat/messages/:id
Delete a chat message.
- **Response:** `{ deleted: true, id }`

---

## Social

### GET /social/feed
Get social feed with author data.
- **Query:** `limit` (default: 15), `offset`
- **Response:** `data` = array of posts with joined `social_users`

### POST /social/posts
Create a post.
- **Body:** `{ content, privacy?, category?, group_id? }`
- **Response:** `data` = created post

### DELETE /social/posts/:id
Delete a post (cascades likes, comments, bookmarks).
- **Response:** `{ deleted: true, id }`

### GET /social/likes
Get current user's likes.
- **Query:** `post_id` (optional filter)
- **Response:** `data` = array of likes

### POST /social/likes
Toggle like on a post.
- **Body:** `{ post_id }`
- **Response:** `data` = like record

### DELETE /social/likes?post_id=<uuid>
Remove like from a post.
- **Response:** `{ deleted: true }`

### GET /social/bookmarks
Get current user's bookmarks.
- **Query:** `post_id` (optional filter)
- **Response:** `data` = array of bookmarks

### POST /social/bookmarks
Toggle bookmark on a post.
- **Body:** `{ post_id }`
- **Response:** `data` = bookmark record

### DELETE /social/bookmarks?post_id=<uuid>
Remove bookmark from a post.
- **Response:** `{ deleted: true }`

### GET /social/comments
List comments for a post.
- **Query:** `post_id` (required)
- **Response:** `data` = array of comments with joined `social_users`

### POST /social/comments
Create a comment.
- **Body:** `{ post_id, content }`
- **Response:** `data` = comment

### GET /social/groups
List groups.
- **Response:** `data` = array of groups

### POST /social/groups
Create a group.
- **Body:** `{ name, description? }`
- **Response:** `data` = group

### GET /social/group-members
Get current user's group memberships.
- **Query:** `group_id` (optional filter)
- **Response:** `data` = array of memberships

### POST /social/group-members
Join a group.
- **Body:** `{ group_id }`
- **Response:** `data` = membership

### DELETE /social/group-members?group_id=<uuid>
Leave a group.
- **Response:** `{ deleted: true }`

### GET /social/events
List events.
- **Query:** `group_id` (optional filter), `order`
- **Response:** `data` = array of events

### POST /social/events
Create an event.
- **Body:** `{ group_id, title, description?, start_time, end_time? }`
- **Response:** `data` = event

### GET /social/follows
Get current user's follow relationships.
- **Query:** `following_id` (optional filter)
- **Response:** `data` = array of follows

### POST /social/follows
Follow a user.
- **Body:** `{ following_id }`
- **Response:** `data` = follow record

### DELETE /social/follows?following_id=<uuid>
Unfollow a user.
- **Response:** `{ deleted: true }`

### GET /social/chat-messages
List group chat messages.
- **Query:** `group_id` (required)
- **Response:** `data` = array of messages with joined `social_users`

### POST /social/chat-messages
Send a group chat message.
- **Body:** `{ group_id, content }`
- **Response:** `data` = message

---

## User Stats

### GET /user-stats
Get current user's stats.
- **Query:** `user_id` (optional, defaults to current user)
- **Response:** `data` = stats object

---

## Game Progress

### GET /game-progress
Get current user's game progress.
- **Response:** `data` = array of game progress records

### POST /game-progress
Upsert game progress.
- **Body:** `{ game_key, unlocked_level, stars_by_level, best_scores, total_xp_earned }`
- **Response:** `data` = progress record

---

## Roadmap Steps

### GET /roadmap-steps
Get current user's roadmap steps.
- **Query:** `order` (default: `week.asc,day.asc,step_index.asc`)
- **Response:** `data` = array of steps

### POST /roadmap-steps
Upsert a roadmap step.
- **Body:** `{ id, subject_code, subject_name, week, day, step_index, title, step_type, ref_id?, xp_reward, is_completed, completed_at?, lesson_json? }`
- **Response:** `data` = step

### PATCH /roadmap-steps/:id
Update a roadmap step.
- **Body:** `{ is_completed?, completed_at?, lesson_json? }`
- **Response:** `data` = updated step

---

## Live Quiz Sessions

### GET /live-quiz-sessions
List active quiz lobbies.
- **Query:** `status` (e.g., `waiting`), `order`, `limit`
- **Response:** `data` = array of sessions with joined `quizzes(title)`

### POST /live-quiz-sessions
Create a live quiz session.
- **Body:** `{ quiz_id, join_code, status?, allow_late_join? }`
- **Response:** `data` = session

---

## Class Recordings

### GET /class-recordings
List current user's recordings.
- **Response:** `data` = array of recordings

### POST /class-recordings
Create a recording.
- **Body:** `{ id?, title, subject, duration, audio_url, transcript, summary, processing_status }`
- **Response:** `data` = recording

### DELETE /class-recordings/:id
Delete a recording.
- **Response:** `{ deleted: true, id }`

---

## AI Podcasts

### GET /ai-podcasts
List current user's podcasts.
- **Response:** `data` = array of podcasts

### POST /ai-podcasts
Create a podcast.
- **Body:** `{ id?, title, script, style, duration_minutes, status }`
- **Response:** `data` = podcast

### DELETE /ai-podcasts/:id
Delete a podcast.
- **Response:** `{ deleted: true, id }`

---

## Course Enrollments

### GET /course-enrollments
Get current user's enrollments.
- **Query:** `course_id` (optional filter)
- **Response:** `data` = array with joined `courses(*)`

### POST /course-enrollments
Enroll in a course.
- **Body:** `{ course_id }`
- **Response:** `data` = enrollment

### DELETE /course-enrollments?course_id=<uuid>
Unenroll from a course.
- **Response:** `{ deleted: true }`

---

## RPC Endpoints

All RPCs are called via `POST /rpc/<function_name>` with JSON body.

### award_xp
Award XP, update level, update credits.
- **Body:** `{ p_user_id, p_xp_amount, p_reason? }`
- **Response:** `{ success, xp_awarded, total_xp, level, points_balance, reason }`
- **Rules:** Max 500 XP per award, level = (total_xp / 500) + 1

### submit_quiz_result
Submit quiz result — updates quiz stats, XP, streak atomically.
- **Body:** `{ p_user_id, p_score, p_total, p_time_seconds? }`
- **Response:** `{ success, xp_awarded, total_xp, level, points_balance, quizzes_attempted, quizzes_completed, average_score, current_streak, longest_streak, percentage }`
- **Rules:** XP = (score * 25) + 50, capped at 500

### spend_credits
Spend credits atomically.
- **Body:** `{ p_user_id, p_cost, p_item? }`
- **Response:** `{ success, balance, spent, item }` or `{ success: false, error: "insufficient_credits" }`
- **Rules:** Atomic SELECT ... FOR UPDATE

### record_activity
Record activity for streak update.
- **Body:** `{ p_user_id }`
- **Response:** `{ success, current_streak, longest_streak }`
- **Rules:** Uses server CURRENT_DATE

### claim_daily_quest
Claim daily quest reward.
- **Body:** `{ p_user_id, p_points }`
- **Response:** `{ success, points, details }` or `{ success: false, error: "already_claimed_today" }`
- **Rules:** One claim per day, server date check

### claim_badge
Claim a badge with eligibility check.
- **Body:** `{ p_user_id, p_badge_name }`
- **Response:** `{ success, badge, all_badges, xp_details }` or `{ success: false, error: "badge_already_earned" }`
- **Rules:** Awards 50 XP, dedup check

### submit_game_result
Submit game result — stars, XP, progress, streak.
- **Body:** `{ p_user_id, p_game_key, p_level, p_score, p_total }`
- **Response:** `{ success, stars, xp_awarded, unlocked_level, total_xp_earned, stats }`
- **Rules:** ≥90% = 3★, ≥70% = 2★, ≥40% = 1★

### purchase_streak_freeze
Buy a streak freeze (atomic credit deduction + freeze grant).
- **Body:** `{ p_user_id, p_cost? }` (default cost: 100)
- **Response:** `{ success, balance, streak_freezes }`
- **Rules:** Deducts credits first, then grants freeze

---

## Error Responses

```json
{
  "success": false,
  "data": null,
  "error": "Error message describing what went wrong",
  "timestamp": "2026-08-24T..."
}
```

Common errors:
- `401` — Invalid or missing JWT
- `400` — Invalid input / missing required field
- `404` — Resource not found
- `500` — Server error
