// supabase/functions/delete-user-data/index.ts
// Erases the authenticated user's data across all user-scoped tables (study data + social
// activity). Uses the service role so deletes bypass RLS.
//
// The profiles + social_users identity rows are deleted too, so signing back in starts a
// true fresh start: login recreates a blank profile (no points, onboarding not completed)
// and the app routes the user through the onboarding flow again. Only the auth user record
// (email/password) is kept so the account can still sign in.
//
// IMPORTANT: social content tables are keyed by author/sender/organizer ids, NOT user_id
// (social_posts.author_id, social_comments.author_id, social_chat_messages.sender_id,
// social_chat_sessions.user_id1/user_id2, social_events.organizer_id,
// social_notifications.user_id/actor_id, social_follows.follower_id/following_id).
// Mirrors supabase/migrations/delete.sql's purge_user_data() ordering, child-first.
//
// Deploy: supabase functions deploy --no-verify-jwt delete-user-data
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extractUserIdFromAuth } from "../utils/subscription-validator.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: "Server not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = await extractUserIdFromAuth(req, supabaseUrl, supabaseServiceKey);
    if (!userId) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, supabaseServiceKey);
    const deleted: Record<string, number> = {};

    // --- Helpers ------------------------------------------------------------
    // Delete rows where column = value. Non-fatal: unknown tables/columns log a
    // warning and the rest of the erase continues.
    const delEq = async (table: string, column: string, value: string, key = table): Promise<void> => {
      try {
        const { count, error } = await admin
          .from(table)
          .delete({ count: "exact" })
          .eq(column, value);
        if (error) {
          console.warn(`delete-user-data: ${table}: ${error.message}`);
        } else {
          deleted[key] = (deleted[key] ?? 0) + (count ?? 0);
        }
      } catch (e) {
        console.warn(`delete-user-data: ${table}: ${e instanceof Error ? e.message : e}`);
      }
    };
    // Delete rows where column IN values. Skips when the list is empty.
    const delIn = async (table: string, column: string, values: string[], key = table): Promise<void> => {
      if (values.length === 0) return;
      try {
        const { count, error } = await admin
          .from(table)
          .delete({ count: "exact" })
          .in(column, values);
        if (error) {
          console.warn(`delete-user-data: ${table}: ${error.message}`);
        } else {
          deleted[key] = (deleted[key] ?? 0) + (count ?? 0);
        }
      } catch (e) {
        console.warn(`delete-user-data: ${table}: ${e instanceof Error ? e.message : e}`);
      }
    };
    // Delete rows matching an OR filter like "a.eq.X,b.eq.X".
    const delOr = async (table: string, orFilter: string, key = table): Promise<void> => {
      try {
        const { count, error } = await admin
          .from(table)
          .delete({ count: "exact" })
          .or(orFilter);
        if (error) {
          console.warn(`delete-user-data: ${table}: ${error.message}`);
        } else {
          deleted[key] = (deleted[key] ?? 0) + (count ?? 0);
        }
      } catch (e) {
        console.warn(`delete-user-data: ${table}: ${e instanceof Error ? e.message : e}`);
      }
    };
    const fetchIds = async (table: string, column: string, value: string): Promise<string[]> => {
      try {
        const { data, error } = await admin.from(table).select("id").eq(column, value);
        if (error) {
          console.warn(`delete-user-data: ${table}: ${error.message}`);
          return [];
        }
        return (data ?? []).map((r: { id: string }) => r.id);
      } catch {
        return [];
      }
    };
    const fetchIdsIn = async (table: string, column: string, values: string[]): Promise<string[]> => {
      if (values.length === 0) return [];
      try {
        const { data, error } = await admin.from(table).select("id").in(column, values);
        if (error) {
          console.warn(`delete-user-data: ${table}: ${error.message}`);
          return [];
        }
        return (data ?? []).map((r: { id: string }) => r.id);
      } catch {
        return [];
      }
    };

    // --- 1) Collect parent ids needed for child-first deletes -----------------
    const sessionIds = await fetchIds("chat_sessions", "user_id", userId);           // AI chat
    const eduIds = await fetchIds("user_education_profiles", "user_id", userId);
    const folderIds = await fetchIds("document_folders", "user_id", userId);
    const scheduleIds = await fetchIds("schedule_items", "user_id", userId);
    const enrollmentIds = await fetchIds("course_enrollments", "user_id", userId);
    const podcastIds = await fetchIds("ai_podcasts", "user_id", userId);
    const courseIds = await fetchIds("courses", "created_by", userId);
    const postIds = await fetchIds("social_posts", "author_id", userId);             // note: author_id
    const commentIds = await fetchIds("social_comments", "author_id", userId);       // note: author_id
    const chatMessageIds = await fetchIds("social_chat_messages", "sender_id", userId); // note: sender_id
    const hostedSessionIds = await fetchIds("live_quiz_sessions", "host_user_id", userId);
    const hostedQuestionIds = await fetchIdsIn("live_quiz_questions", "session_id", hostedSessionIds);
    // Player rows for the user (needed to wipe their progress inside OTHERS' sessions).
    const playerIds = await fetchIds("live_quiz_players", "user_id", userId);

    // --- 2) Child tables (children before parents) ----------------------------
    // AI chat messages belong to sessions — wipe by session ids first, then sessions.
    await delIn("chat_messages", "session_id", sessionIds, "chat_messages");

    // Education: subjects under each profile, then profiles.
    await delIn("user_subjects", "education_profile_id", eduIds, "user_subjects");

    // Documents: folder items then folders.
    await delIn("document_folder_items", "folder_id", folderIds, "document_folder_items");

    // Schedule: reminders then items.
    await delIn("schedule_reminders", "schedule_id", scheduleIds, "schedule_reminders");

    // Courses: progress under enrollments, materials under owned courses, then parents.
    await delIn("course_progress", "enrollment_id", enrollmentIds, "course_progress");
    await delIn("course_materials", "course_id", courseIds, "course_materials");

    // Podcasts: audio segments/chunks/recordings under the user's podcasts.
    await delIn("audio_segments", "podcast_id", podcastIds, "audio_segments");
    await delIn("podcast_chunks", "podcast_id", podcastIds, "podcast_chunks");
    await delIn("podcast_recordings", "podcast_id", podcastIds, "podcast_recordings");

    // Live quiz children: progress → answers → questions → players → sessions.
    // Progress/answers keyed by the user's player row (covers other hosts' sessions too).
    await delIn("player_question_progress", "player_id", playerIds, "player_question_progress_player");
    await delIn("player_question_progress", "question_id", hostedQuestionIds, "player_question_progress_hosted");
    await delEq("live_quiz_answers", "user_id", userId, "live_quiz_answers_user");
    await delIn("live_quiz_answers", "session_id", hostedSessionIds, "live_quiz_answers_hosted");
    await delIn("live_quiz_questions", "session_id", hostedSessionIds, "live_quiz_questions");
    await delEq("live_quiz_players", "user_id", userId, "live_quiz_players_user");
    await delIn("live_quiz_players", "session_id", hostedSessionIds, "live_quiz_players_hosted");

    // Social content children (media/hashtags/tags under the user's posts).
    await delIn("social_media", "post_id", postIds, "social_media");
    await delIn("social_post_hashtags", "post_id", postIds, "social_post_hashtags");
    await delIn("social_post_tags", "post_id", postIds, "social_post_tags");
    await delIn("social_comment_media", "comment_id", commentIds, "social_comment_media");
    await delIn("social_chat_message_resources", "message_id", chatMessageIds, "social_chat_message_resources");
    await delIn("social_chat_message_media", "message_id", chatMessageIds, "social_chat_message_media");

    // --- 3) Rows keyed by the user's own id ------------------------------------
    const userKeyed = [
      "notes",
      "documents",
      "document_folders",
      "flashcards",
      "chat_sessions",
      "chat_messages",
      "course_enrollments",
      "class_recordings",
      "ai_podcasts",
      "quizzes",
      "quiz_attempts",
      "schedule_items",
      "game_progress",
      "kid_roadmap_steps",
      "user_education_profiles",
      "social_likes",
      "social_bookmarks",
      "social_group_members",
      "social_post_views",
      "social_shares",
      "social_event_attendees",
      "social_user_signals",
      "social_chat_message_reads",
      "user_learning_goals",
      "ai_user_memory",
      "learning_topic_connections",
      "notification_subscriptions",
      "notification_preferences",
      "notifications",
      "calendar_integrations",
      "achievements",
      "user_stats",
      "user_daily_activity",
      "daily_notification_log",
      "audio_processing_results",
      "app_ratings",
      "podcast_credit_transactions",
      "podcast_credits",
      "podcast_listeners",
      "platform_update_reads",
    ];
    for (const table of userKeyed) {
      await delEq(table, "user_id", userId);
    }

    // --- 4) Social content keyed by author/sender/organizer --------------------
    await delEq("social_comments", "author_id", userId);
    await delEq("social_posts", "author_id", userId);
    await delEq("social_chat_messages", "sender_id", userId);
    await delOr("social_chat_sessions", `user_id1.eq.${userId},user_id2.eq.${userId}`, "social_chat_sessions");
    await delEq("social_events", "organizer_id", userId);
    await delOr("social_notifications", `user_id.eq.${userId},actor_id.eq.${userId}`, "social_notifications");
    await delOr("social_follows", `follower_id.eq.${userId},following_id.eq.${userId}`, "social_follows");
    await delOr("podcast_members", `user_id.eq.${userId},invited_by.eq.${userId}`, "podcast_members");
    await delOr("podcast_invites", `inviter_id.eq.${userId},invitee_id.eq.${userId}`, "podcast_invites");
    await delOr("referrals", `referrer_id.eq.${userId},referee_id.eq.${userId}`, "referrals");

    // --- 5) Hosted live-quiz sessions (last, after their children) -------------
    await delIn("live_quiz_sessions", "id", hostedSessionIds, "live_quiz_sessions");

    // --- 6) Content the user created (created_by columns) ----------------------
    await delEq("courses", "created_by", userId, "courses_created");
    await delEq("course_resources", "created_by", userId, "course_resources_created");
    await delOr("platform_updates", `created_by.eq.${userId},updated_by.eq.${userId}`, "platform_updates");

    // --- 7) Identity rows (LAST, after every child table) ----------------------
    // Delete the profile + social identity so the next sign-in is a blank slate: login
    // recreates a fresh profile row (points 0, onboarding not completed) and the app
    // re-runs the onboarding flow. The auth.users record is intentionally kept so the
    // same email/password can sign in again.
    await delEq("profiles", "id", userId, "profiles");
    await delEq("social_users", "id", userId, "social_users");

    console.log(`delete-user-data: erased data for ${userId}`, deleted);
    return new Response(JSON.stringify({ ok: true, deleted }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("delete-user-data failed:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
