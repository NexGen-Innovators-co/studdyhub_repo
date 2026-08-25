-- ═══════════════════════════════════════════════════════════════════════════
-- Run these ONE AT A TIME in the OLD project's SQL Editor
-- Save each result as the specified JSON file
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────
-- 1. PROFILES (user names, schools, avatars, etc.)
-- Save as: scripts/export/profiles.json
-- ─────────────────────────────────────────────────────────────────────────
SELECT json_agg(row_to_json(p)) AS profiles FROM (
  SELECT id, full_name, email, avatar_url, school, points_balance,
         academic_tier, academic_level, onboarding_completed,
         referral_code, referred_by, created_at, updated_at
  FROM profiles
) p;


-- ─────────────────────────────────────────────────────────────────────────
-- 2. SOCIAL USERS (social profiles, followers, etc.)
-- Save as: scripts/export/social_users.json
-- ─────────────────────────────────────────────────────────────────────────
SELECT json_agg(row_to_json(s)) AS social_users FROM (
  SELECT id, username, display_name, avatar_url, bio, interests,
         is_verified, is_contributor, followers_count, following_count,
         posts_count, last_active, created_at, updated_at, email,
         is_public, status, last_login_at, last_logout_at
  FROM social_users
) s;


-- ─────────────────────────────────────────────────────────────────────────
-- 3. NOTES (all user notes)
-- Save as: scripts/export/notes.json
-- ─────────────────────────────────────────────────────────────────────────
SELECT json_agg(row_to_json(n)) AS notes FROM (
  SELECT id, user_id, title, content, category, tags, document_id,
         ai_summary, created_at, updated_at
  FROM notes
) n;


-- ─────────────────────────────────────────────────────────────────────────
-- 4. DOCUMENTS (uploaded documents)
-- Save as: scripts/export/documents.json
-- ─────────────────────────────────────────────────────────────────────────
SELECT json_agg(row_to_json(d)) AS documents FROM (
  SELECT id, user_id, title, file_name, type, file_size,
         processing_status, content_extracted, folder_id,
         created_at, updated_at
  FROM documents
) d;


-- ─────────────────────────────────────────────────────────────────────────
-- 5. QUIZZES + QUIZ ATTEMPTS
-- Save as: scripts/export/quizzes.json
-- ─────────────────────────────────────────────────────────────────────────
SELECT json_agg(row_to_json(q)) AS quizzes FROM (
  SELECT id, user_id, title, source_type, questions,
         created_at, updated_at
  FROM quizzes
) q;


-- ─────────────────────────────────────────────────────────────────────────
-- 6. QUIZ ATTEMPTS
-- Save as: scripts/export/quiz_attempts.json
-- ─────────────────────────────────────────────────────────────────────────
SELECT json_agg(row_to_json(qa)) AS quiz_attempts FROM (
  SELECT id, quiz_id, user_id, score, total_questions, percentage,
         time_taken_seconds, answers, xp_earned, created_at
  FROM quiz_attempts
) qa;


-- ─────────────────────────────────────────────────────────────────────────
-- 7. SCHEDULE ITEMS
-- Save as: scripts/export/schedule_items.json
-- ─────────────────────────────────────────────────────────────────────────
SELECT json_agg(row_to_json(si)) AS schedule_items FROM (
  SELECT id, user_id, title, description, start_time, end_time,
         color, recurrence, created_at
  FROM schedule_items
) si;


-- ─────────────────────────────────────────────────────────────────────────
-- 8. CHAT SESSIONS + MESSAGES
-- Save as: scripts/export/chat_sessions.json
-- ─────────────────────────────────────────────────────────────────────────
SELECT json_agg(row_to_json(cs)) AS chat_sessions FROM (
  SELECT id, user_id, title, document_ids, message_count,
         last_message_at, created_at, updated_at
  FROM chat_sessions
) cs;


-- ─────────────────────────────────────────────────────────────────────────
-- 9. USER STATS
-- Save as: scripts/export/user_stats.json
-- ─────────────────────────────────────────────────────────────────────────
SELECT json_agg(row_to_json(us)) AS user_stats FROM (
  SELECT user_id, total_xp, level, quizzes_taken, avg_score,
         current_streak, longest_streak, credits_balance,
         created_at, updated_at
  FROM user_stats
) us;


-- ─────────────────────────────────────────────────────────────────────────
-- 10. CLASS RECORDINGS
-- Save as: scripts/export/class_recordings.json
-- ─────────────────────────────────────────────────────────────────────────
SELECT json_agg(row_to_json(cr)) AS class_recordings FROM (
  SELECT id, user_id, title, duration, file_url, status,
         created_at, updated_at
  FROM class_recordings
) cr;


-- ─────────────────────────────────────────────────────────────────────────
-- 11. AI PODCASTS
-- Save as: scripts/export/ai_podcasts.json
-- ─────────────────────────────────────────────────────────────────────────
SELECT json_agg(row_to_json(ap)) AS ai_podcasts FROM (
  SELECT id, user_id, title, script, style, duration_minutes,
         status, sources, audio_segments, visual_assets,
         is_live, created_at, updated_at
  FROM ai_podcasts
) ap;


-- ─────────────────────────────────────────────────────────────────────────
-- 12. FLASHCARDS + DECKS
-- Save as: scripts/export/flashcards.json
-- ─────────────────────────────────────────────────────────────────────────
SELECT json_agg(row_to_json(fc)) AS flashcards FROM (
  SELECT id, user_id, front, back, category, difficulty, hint,
         deck_id, created_at
  FROM flashcards
) fc;


-- ─────────────────────────────────────────────────────────────────────────
-- 13. SUBSCRIPTIONS
-- Save as: scripts/export/subscriptions.json
-- ─────────────────────────────────────────────────────────────────────────
SELECT json_agg(row_to_json(sub)) AS subscriptions FROM (
  SELECT id, user_id, plan_type, status, started_at, expires_at,
         created_at, updated_at
  FROM user_subscriptions
) sub;


-- ─────────────────────────────────────────────────────────────────────────
-- 14. ACHIEVEMENTS / BADGES
-- Save as: scripts/export/achievements.json
-- ─────────────────────────────────────────────────────────────────────────
SELECT json_agg(row_to_json(a)) AS achievements FROM (
  SELECT id, user_id, badge_name, badge_icon, unlocked_at,
         created_at
  FROM achievements
) a;
