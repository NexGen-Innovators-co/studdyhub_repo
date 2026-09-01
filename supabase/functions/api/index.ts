import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, prefer",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
};

// ═══════════════════════════════════════════════════════════════════════════════
// RESPONSE HELPERS — consistent format for ALL clients
// ═══════════════════════════════════════════════════════════════════════════════

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function ok(data: any, status = 200, meta?: any) {
  return jsonResponse({ success: true, data, error: null, meta: { ...meta, timestamp: new Date().toISOString() } }, status);
}

function err(error: string, status = 400) {
  return jsonResponse({ success: false, error, data: null, timestamp: new Date().toISOString() }, status);
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUERY HELPERS — clean param parsing (no PostgREST syntax)
// ═══════════════════════════════════════════════════════════════════════════════

function getParam(url: URL, key: string, defaultVal?: string): string | undefined {
  return url.searchParams.get(key) || defaultVal;
}

function getLimit(url: URL, defaultLimit = 50, maxLimit = 200): number {
  const raw = parseInt(url.searchParams.get("limit") || "", 10);
  return isNaN(raw) ? defaultLimit : Math.min(Math.max(raw, 1), maxLimit);
}

function getOffset(url: URL): number {
  const raw = parseInt(url.searchParams.get("offset") || "", 10);
  return isNaN(raw) ? 0 : Math.max(raw, 0);
}

function applyOrder(query: any, url: URL, defaultOrder = "created_at.desc") {
  const raw = getParam(url, "order", defaultOrder);
  const [col, dir] = raw.split(".");
  return query.order(col, { ascending: dir !== "desc" });
}

function applyFilters(query: any, url: URL, allowedFilters: string[]) {
  for (const key of allowedFilters) {
    const val = url.searchParams.get(key);
    if (val !== null && val !== "") {
      query = query.eq(key, val);
    }
  }
  return query;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN ROUTER
// ═══════════════════════════════════════════════════════════════════════════════

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  const v1Index = pathParts.lastIndexOf("v1");
  const resource = v1Index !== -1 && pathParts[v1Index + 1] ? pathParts[v1Index + 1] : "";
  const subPath = v1Index !== -1 ? pathParts.slice(v1Index + 2) : [];
  const method = req.method.toUpperCase();
  const subId = subPath[0] || null;

  console.log(`[API] ${method} /v1/${resource}${subPath.length ? "/" + subPath.join("/") : ""}`);

  // ── Auth ──────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return err("Missing or invalid Authorization header", 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return err("Unauthorized: Invalid token", 401);
  const userId = user.id;

  try {
    if (!resource) return err("API resource not specified", 400);

    // ════════════════════════════════════════════════════════════════════════
    // 0. RPC CALLS — /v1/rpc/:functionName
    // ════════════════════════════════════════════════════════════════════════
    if (resource === "rpc") {
      const fn = subPath[0];
      if (!fn) return err("RPC function name required", 400);
      const body = method === "POST" ? await req.json().catch(() => ({})) : {};
      const { data, error } = await supabase.rpc(fn, body);
      if (error) throw error;
      return ok(data);
    }

    // ════════════════════════════════════════════════════════════════════════
    // 1. PROFILE — /v1/profile (current user), /v1/profiles (lookups)
    // ════════════════════════════════════════════════════════════════════════
    if (resource === "profile") {
      if (method === "GET") {
        const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
        if (error) throw error;
        return ok(data);
      }
      if (method === "PATCH" || method === "PUT") {
        const body = await req.json().catch(() => ({}));
        const { data, error } = await supabase.from("profiles").update(body).eq("id", userId).select().single();
        if (error) throw error;
        return ok(data);
      }
    }

    if (resource === "profiles") {
      if (method === "GET") {
        // Profile lookups by id or email (for login, leaderboard, etc.)
        let query = supabase.from("profiles").select("*");
        const idParam = getParam(url, "id");
        const emailParam = getParam(url, "email");
        if (idParam) query = query.eq("id", idParam);
        if (emailParam) query = query.eq("email", emailParam);
        const limit = getLimit(url, 10);
        query = query.limit(limit);
        const { data, error } = await query;
        if (error) throw error;
        return ok(data);
      }
      if (method === "POST") {
        const body = await req.json().catch(() => ({}));
        const { data, error } = await supabase.from("profiles").upsert(body, { onConflict: "id" }).select().single();
        if (error) throw error;
        return ok(data, 201);
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // 2. NOTES — /v1/notes, /v1/notes/:id
    // ════════════════════════════════════════════════════════════════════════
    if (resource === "notes") {
      if (method === "GET" && !subId) {
        let query = supabase.from("notes").select("*", { count: "exact" }).eq("user_id", userId);
        const folderId = getParam(url, "folder_id");
        if (folderId) query = query.eq("folder_id", folderId);
        const search = getParam(url, "search");
        if (search) query = query.ilike("title", `%${search}%`);
        query = applyOrder(query, url, "updated_at.desc");
        const limit = getLimit(url);
        const offset = getOffset(url);
        query = query.range(offset, offset + limit - 1);
        const { data, count, error } = await query;
        if (error) throw error;
        return ok(data, 200, { total: count || data.length });
      }
      if (method === "GET" && subId) {
        const { data, error } = await supabase.from("notes").select("*").eq("id", subId).eq("user_id", userId).single();
        if (error) return err("Note not found", 404);
        return ok(data);
      }
      if (method === "POST" && !subId) {
        const body = await req.json().catch(() => ({}));
        const newNote = { id: body.id || crypto.randomUUID(), user_id: userId, title: body.title || "Untitled", content: body.content || "", category: body.category || "General", tags: body.tags || [], document_id: body.document_id || null };
        const { data, error } = await supabase.from("notes").upsert(newNote, { onConflict: "id" }).select().single();
        if (error) throw error;
        try { await supabase.rpc("award_xp", { p_user_id: userId, p_xp_amount: 10, p_reason: "note_created" }); } catch (_) {}
        return ok(data, 201);
      }
      if ((method === "PATCH" || method === "PUT") && subId) {
        const updates = await req.json().catch(() => ({}));
        const { data, error } = await supabase.from("notes").update(updates).eq("id", subId).eq("user_id", userId).select().single();
        if (error) throw error;
        return ok(data);
      }
      if (method === "DELETE" && subId) {
        const { error } = await supabase.from("notes").delete().eq("id", subId).eq("user_id", userId);
        if (error) throw error;
        return ok({ deleted: true, id: subId });
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // 3. DOCUMENTS — /v1/documents, /v1/documents/:id
    // ════════════════════════════════════════════════════════════════════════
    if (resource === "documents") {
      if (method === "GET" && !subId) {
        let query = supabase.from("documents").select("*").eq("user_id", userId);
        const folderId = getParam(url, "folder_id");
        if (folderId) query = query.eq("folder_id", folderId);
        query = applyOrder(query, url);
        query = query.limit(getLimit(url));
        const { data, error } = await query;
        if (error) throw error;
        return ok(data);
      }
      if (method === "GET" && subId) {
        const { data, error } = await supabase.from("documents").select("*").eq("id", subId).eq("user_id", userId).single();
        if (error) return err("Document not found", 404);
        return ok(data);
      }
      if (method === "POST") {
        const body = await req.json().catch(() => ({}));
        const { data, error } = await supabase.from("documents").upsert({ ...body, user_id: userId }, { onConflict: "id" }).select();
        if (error) throw error;
        return ok(data?.[0] || body, 201);
      }
      if ((method === "PATCH" || method === "PUT") && subId) {
        const body = await req.json().catch(() => ({}));
        const { data, error } = await supabase.from("documents").update(body).eq("id", subId).eq("user_id", userId).select().single();
        if (error) throw error;
        return ok(data);
      }
      if (method === "DELETE" && subId) {
        const { error } = await supabase.from("documents").delete().eq("id", subId).eq("user_id", userId);
        if (error) throw error;
        return ok({ deleted: true, id: subId });
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // 4. DOCUMENT FOLDERS — /v1/document-folders, /v1/document-folders/:id
    // ════════════════════════════════════════════════════════════════════════
    if (resource === "document-folder-items") {
      if (method === "POST") {
        const body = await req.json().catch(() => ({}));
        const items = Array.isArray(body) ? body : [body];
        const rows = items.map((item: any) => ({ id: crypto.randomUUID(), ...item }));
        const { data, error } = await supabase.from("document_folder_items").insert(rows).select();
        if (error) throw error;
        return ok(data, 201);
      }
    }

    if (resource === "document-folders") {
      if (method === "GET" && !subId) {
        const { data, error } = await supabase.from("document_folders").select("*").eq("user_id", userId).order("created_at", { ascending: true });
        if (error) throw error;
        return ok(data);
      }
      if (method === "POST") {
        const body = await req.json().catch(() => ({}));
        const { data, error } = await supabase.from("document_folders").upsert({ ...body, user_id: userId }, { onConflict: "id" }).select();
        if (error) throw error;
        return ok(data?.[0] || body, 201);
      }
      if ((method === "PATCH" || method === "PUT") && subId) {
        const body = await req.json().catch(() => ({}));
        const { data, error } = await supabase.from("document_folders").update(body).eq("id", subId).eq("user_id", userId).select().single();
        if (error) throw error;
        return ok(data);
      }
      if (method === "DELETE" && subId) {
        const { error } = await supabase.from("document_folders").delete().eq("id", subId).eq("user_id", userId);
        if (error) throw error;
        return ok({ deleted: true, id: subId });
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // 5. FLASHCARDS — /v1/flashcards, /v1/flashcards/decks, /v1/flashcards/cards/:id
    // ════════════════════════════════════════════════════════════════════════
    if (resource === "flashcards") {
      const sub = subPath[0];
      if (method === "GET" && sub === "decks") {
        const { data, error } = await supabase.from("flashcard_decks").select("*").eq("user_id", userId);
        if (error) throw error;
        return ok(data);
      }
      if (method === "POST" && sub === "cards") {
        const body = await req.json().catch(() => ({}));
        const card = { id: body.id || crypto.randomUUID(), user_id: userId, front: body.front, back: body.back, category: body.category || "General", difficulty: body.difficulty || "medium", hint: body.hint || "" };
        const { data, error } = await supabase.from("flashcards").upsert(card, { onConflict: "id" }).select().single();
        if (error) throw error;
        return ok(data, 201);
      }
      if (method === "DELETE" && sub === "cards" && subPath[1]) {
        const { error } = await supabase.from("flashcards").delete().eq("id", subPath[1]).eq("user_id", userId);
        if (error) throw error;
        return ok({ deleted: true, id: subPath[1] });
      }
      if (method === "GET" && !sub) {
        let query = supabase.from("flashcards").select("*").eq("user_id", userId);
        query = applyOrder(query, url, "created_at.desc");
        query = query.limit(getLimit(url));
        const { data, error } = await query;
        if (error) throw error;
        return ok(data);
      }
      if (method === "POST" && sub === "review") {
        const body = await req.json().catch(() => ({}));
        // Flashcard review — placeholder for spaced repetition logic
        return ok({ reviewed: true, card_id: body.card_id, rating: body.rating });
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // 6. QUIZZES — /v1/quizzes, /v1/quizzes/:id, /v1/quizzes/:id/submit
    // ════════════════════════════════════════════════════════════════════════
    if (resource === "quizzes") {
      const sub = subPath[1];
      if (method === "GET" && !subId) {
        const { data, error } = await supabase.from("quizzes").select("*").eq("user_id", userId);
        if (error) throw error;
        return ok(data);
      }
      if (method === "POST" && !subId) {
        const body = await req.json().catch(() => ({}));
        if (!body.title) return err("Quiz title is required", 400);
        const quiz = { id: body.id || crypto.randomUUID(), user_id: userId, title: body.title, source_type: body.source_type || "ai", questions: body.questions || [] };
        const { data, error } = await supabase.from("quizzes").upsert(quiz, { onConflict: "id" }).select().single();
        if (error) throw error;
        return ok(data, 201);
      }
      if (method === "DELETE" && subId && !sub) {
        await supabase.from("quiz_attempts").delete().eq("quiz_id", subId);
        const { error } = await supabase.from("quizzes").delete().eq("id", subId).eq("user_id", userId);
        if (error) throw error;
        return ok({ deleted: true, id: subId });
      }
      if (method === "POST" && subId && sub === "submit") {
        const body = await req.json().catch(() => ({}));
        const attempt = { id: body.id || crypto.randomUUID(), quiz_id: subId, user_id: userId, score: body.score || 0, total_questions: body.total_questions || 1, percentage: body.percentage || 0, time_taken_seconds: body.time_taken_seconds || 0, answers: body.answers || [], xp_earned: body.xp_earned || 0, live_results: body.live_results || null };
        const { data, error } = await supabase.from("quiz_attempts").upsert(attempt, { onConflict: "id" }).select().single();
        if (error) throw error;
        if (attempt.xp_earned > 0) {
          try { await supabase.rpc("award_xp", { p_user_id: userId, p_xp_amount: attempt.xp_earned, p_reason: "quiz_completed" }); } catch (_) {}
        }
        return ok(data, 201);
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // 7. LEADERBOARD — /v1/leaderboard
    // ════════════════════════════════════════════════════════════════════════
    if (resource === "leaderboard") {
      if (method === "GET") {
        const tier = getParam(url, "tier", "all");
        const school = getParam(url, "school", "");
        const academicLevel = getParam(url, "academic_level", "");
        const limit = getLimit(url, 50);
        const offset = getOffset(url);

        // Query profiles with user_stats for XP — show ALL users regardless of tier
        let profileQuery = supabase.from("profiles").select("id, full_name, school, points_balance, avatar_url, academic_tier, academic_level");
        if (tier && tier !== "all") profileQuery = profileQuery.eq("academic_tier", tier);
        if (school) profileQuery = profileQuery.eq("school", school);
        if (academicLevel) profileQuery = profileQuery.eq("academic_level", academicLevel);
        profileQuery = profileQuery.limit(Math.min(limit * 3, 200));
        const { data: profiles, error: pErr } = await profileQuery;
        if (pErr) throw pErr;
        if (!profiles || profiles.length === 0) return ok([]);

        // Get actual XP from user_stats (server-authoritative)
        const userIds = profiles.map((p: any) => p.id);
        const { data: stats } = await supabase.from("user_stats").select("user_id, total_xp, level").in("user_id", userIds);
        const statsMap: Record<string, { total_xp: number; level: number }> = {};
        if (stats) for (const s of stats as any[]) statsMap[s.user_id] = { total_xp: s.total_xp || 0, level: s.level || 1 };

        // Merge and sort by total_xp descending
        const merged = profiles.map((p: any) => ({
          id: p.id, full_name: p.full_name || "Scholar", school: p.school || "",
          avatar_url: p.avatar_url || null,
          academic_tier: p.academic_tier || null,
          total_xp: statsMap[p.id]?.total_xp || p.points_balance || 0,
          level: statsMap[p.id]?.level || 1,
        }));
        merged.sort((a: any, b: any) => (b.total_xp || 0) - (a.total_xp || 0));

        // Add rank and paginate
        const ranked = merged.map((entry: any, index: number) => ({
          ...entry,
          rank: offset + index + 1,
        }));

        return ok(ranked.slice(0, limit));
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // 8. USER STATS — /v1/user-stats
    // ════════════════════════════════════════════════════════════════════════
    if (resource === "user-stats") {
      if (method === "GET") {
        const targetUserId = getParam(url, "user_id", userId);
        const { data, error } = await supabase.from("user_stats").select("*").eq("user_id", targetUserId).limit(1).single();
        if (error) return err("No stats found", 404);
        return ok(data);
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // 9. SCHEDULE — /v1/schedule, /v1/schedule/:id
    // ════════════════════════════════════════════════════════════════════════
    if (resource === "schedule") {
      if (method === "GET" && !subId) {
        const { data, error } = await supabase.from("schedule_items").select("*").eq("user_id", userId).order("start_time", { ascending: true });
        if (error) throw error;
        return ok(data);
      }
      if (method === "POST") {
        const body = await req.json().catch(() => ({}));
        const { data, error } = await supabase.from("schedule_items").upsert({ ...body, user_id: userId }, { onConflict: "id" }).select();
        if (error) throw error;
        return ok(data?.[0] || body, 201);
      }
      if (method === "DELETE" && subId) {
        const { error } = await supabase.from("schedule_items").delete().eq("id", subId).eq("user_id", userId);
        if (error) throw error;
        return ok({ deleted: true, id: subId });
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // 10. CHAT SESSIONS — /v1/chat/sessions, /v1/chat/sessions/:id
    // ════════════════════════════════════════════════════════════════════════
    if (resource === "chat") {
      const sub = subPath[0]; // "sessions" or "messages"
      const subId2 = subPath[1];

      if (sub === "sessions") {
        if (method === "GET" && !subId2) {
          const { data, error } = await supabase.from("chat_sessions").select("*").eq("user_id", userId).order("created_at", { ascending: false });
          if (error) throw error;
          return ok(data);
        }
        if (method === "POST") {
          const body = await req.json().catch(() => ({}));
          const session = { id: body.id || crypto.randomUUID(), user_id: userId, title: body.title || "New Chat" };
          const { data, error } = await supabase.from("chat_sessions").upsert(session, { onConflict: "id" }).select().single();
          if (error) throw error;
          return ok(data, 201);
        }
        if (method === "DELETE" && subId2) {
          const { error } = await supabase.from("chat_sessions").delete().eq("id", subId2).eq("user_id", userId);
          if (error) throw error;
          return ok({ deleted: true, id: subId2 });
        }
      }

      if (sub === "messages") {
        if (method === "GET" && !subId2) {
          const sessionId = getParam(url, "session_id");
          if (!sessionId) return err("session_id is required", 400);
          const { data, error } = await supabase.from("chat_messages").select("*").eq("session_id", sessionId).order("timestamp", { ascending: true });
          if (error) throw error;
          return ok(data);
        }
        if (method === "POST") {
          const body = await req.json().catch(() => ({}));
          const msg = { id: body.id || crypto.randomUUID(), user_id: userId, session_id: body.session_id, role: body.role || "user", content: body.content || "" };
          const { data, error } = await supabase.from("chat_messages").upsert(msg, { onConflict: "id" }).select().single();
          if (error) throw error;
          return ok(data, 201);
        }
        if (method === "DELETE" && subId2) {
          const { error } = await supabase.from("chat_messages").delete().eq("id", subId2).eq("user_id", userId);
          if (error) throw error;
          return ok({ deleted: true, id: subId2 });
        }
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // 11. SOCIAL POSTS — /v1/social/posts, /v1/social/posts/:id
    // ════════════════════════════════════════════════════════════════════════
    if (resource === "social") {
      const sub = subPath[0]; // posts, likes, bookmarks, comments, groups, group-members, events, follows, chat-messages

      // ── Social Feed ──
      if (sub === "feed" && method === "GET") {
        const limit = getLimit(url, 15);
        const offset = getOffset(url);
        let query = supabase.from("social_posts").select("*, social_users(display_name, avatar_url)").order("created_at", { ascending: false }).range(offset, offset + limit - 1);
        const { data, error } = await query;
        if (error) throw error;
        return ok(data);
      }

      // ── Posts ──
      if (sub === "posts") {
        if (method === "POST") {
          const body = await req.json().catch(() => ({}));
          const post = { id: body.id || crypto.randomUUID(), author_id: userId, content: body.content || "", privacy: body.privacy || "public", ai_categories: body.ai_categories || [], metadata: body.metadata || {} };
          const { data, error } = await supabase.from("social_posts").insert(post).select().single();
          if (error) throw error;
          return ok(data, 201);
        }
        if (method === "DELETE" && subPath[1]) {
          const postId = subPath[1];
          await Promise.all([
            supabase.from("social_likes").delete().eq("post_id", postId),
            supabase.from("social_comments").delete().eq("post_id", postId),
            supabase.from("social_bookmarks").delete().eq("post_id", postId),
          ]);
          const { error } = await supabase.from("social_posts").delete().eq("id", postId).eq("author_id", userId);
          if (error) throw error;
          return ok({ deleted: true, id: postId });
        }
      }

      // social_likes.user_id and social_comments.author_id FK into social_users.
      // A user can have a profiles row but no social profile yet, which makes
      // every like/comment fail with FK 23503. Self-heal the row on demand —
      // same approach as the toggle-like edge function.
      const ensureSocialUser = async () => {
        const { data: su } = await supabase.from("social_users").select("id").eq("id", userId).maybeSingle();
        if (su) return;
        const { data: profile } = await supabase.from("profiles").select("full_name, username, email").eq("id", userId).single();
        await supabase.from("social_users").upsert({
          id: userId,
          username: profile?.username || `user_${userId.substring(0, 8)}`,
          display_name: profile?.full_name || "User",
          email: profile?.email,
          status: "active",
        }, { onConflict: "id" });
      };

      // ── Likes ──
      if (sub === "likes") {
        if (method === "GET") {
          const postId = getParam(url, "post_id");
          let query = supabase.from("social_likes").select("*").eq("user_id", userId);
          if (postId) query = query.eq("post_id", postId);
          const { data, error } = await query;
          if (error) throw error;
          return ok(data);
        }
        if (method === "POST") {
          const body = await req.json().catch(() => ({}));
          await ensureSocialUser();
          const payload = { post_id: body.post_id, user_id: userId };
          // Check-then-insert: avoids ON CONFLICT issues with PostgREST schema cache.
          let data: any = null;
          const existing = await supabase.from("social_likes").select("*").eq("post_id", payload.post_id).eq("user_id", userId).maybeSingle();
          if (existing.data) {
            data = existing.data;
          } else {
            const ins = await supabase.from("social_likes").insert(payload).select();
            if (ins.error) {
              if ((ins.error as any).code === "23505") {
                // Race condition duplicate — treat as success
                data = existing.data;
              } else {
                throw ins.error;
              }
            } else {
              data = ins.data?.[0] ?? null;
            }
          }
          return ok(data || body, 201);
        }
        if (method === "DELETE") {
          const postId = getParam(url, "post_id");
          if (!postId) return err("post_id is required", 400);
          const { error } = await supabase.from("social_likes").delete().eq("post_id", postId).eq("user_id", userId);
          if (error) throw error;
          return ok({ deleted: true });
        }
      }

      // ── Bookmarks ──
      if (sub === "bookmarks") {
        if (method === "GET") {
          const postId = getParam(url, "post_id");
          let query = supabase.from("social_bookmarks").select("*").eq("user_id", userId);
          if (postId) query = query.eq("post_id", postId);
          const { data, error } = await query;
          if (error) throw error;
          return ok(data);
        }
        if (method === "POST") {
          const body = await req.json().catch(() => ({}));
          const payload = { post_id: body.post_id, user_id: userId };
          // Same 42P10 resilience as likes (see comment there).
          let data: any = null;
          const up = await supabase.from("social_bookmarks").upsert(payload, { onConflict: "post_id,user_id" }).select();
          if (up.error && (up.error as any).code === "42P10") {
            const existing = await supabase.from("social_bookmarks").select("*").eq("post_id", payload.post_id).eq("user_id", userId).maybeSingle();
            if (existing.data) {
              data = existing.data;
            } else {
              const ins = await supabase.from("social_bookmarks").insert(payload).select();
              if (ins.error) throw ins.error;
              data = ins.data?.[0] ?? null;
            }
          } else if (up.error) {
            throw up.error;
          } else {
            data = up.data?.[0] ?? null;
          }
          return ok(data || body, 201);
        }
        if (method === "DELETE") {
          const postId = getParam(url, "post_id");
          if (!postId) return err("post_id is required", 400);
          const { error } = await supabase.from("social_bookmarks").delete().eq("post_id", postId).eq("user_id", userId);
          if (error) throw error;
          return ok({ deleted: true });
        }
      }

      // ── Comments ──
      if (sub === "comments") {
        if (method === "GET") {
          const postId = getParam(url, "post_id");
          if (!postId) return err("post_id is required", 400);
          const { data, error } = await supabase.from("social_comments").select("*, social_users(display_name, avatar_url)").eq("post_id", postId).order("created_at", { ascending: true });
          if (error) throw error;
          return ok(data);
        }
        if (method === "POST") {
          const body = await req.json().catch(() => ({}));
          // social_comments' author column is author_id (renamed from user_id in
          // migration 20260314) — inserting user_id here failed every gateway
          // comment with PGRST204 "column not found".
          await ensureSocialUser();
          const comment = { id: body.id || crypto.randomUUID(), post_id: body.post_id, author_id: userId, content: body.content || "" };
          const { data, error } = await supabase.from("social_comments").insert(comment).select().single();
          if (error) throw error;
          // Notification parity with comment-on-post (fire-and-forget, never fails the comment)
          try {
            const [postResult, actorResult] = await Promise.all([
              supabase.from("social_posts").select("author_id").eq("id", body.post_id).single(),
              supabase.from("social_users").select("display_name").eq("id", userId).single(),
            ]);
            if (postResult.data && postResult.data.author_id !== userId) {
              await supabase.from("social_notifications").insert({
                user_id: postResult.data.author_id,
                actor_id: userId,
                type: "comment",
                title: "New Comment",
                message: `${actorResult.data?.display_name || "Someone"} commented on your post`,
                post_id: body.post_id,
                is_read: false,
              });
            }
          } catch (_) { /* ignore notification failures */ }
          return ok(data, 201);
        }
      }

      // ── Groups ──
      if (sub === "groups") {
        if (method === "GET" && !subPath[1]) {
          const { data, error } = await supabase.from("social_groups").select("*");
          if (error) throw error;
          return ok(data);
        }
        if (method === "POST") {
          const body = await req.json().catch(() => ({}));
          const group = { id: body.id || crypto.randomUUID(), name: body.name || "Group", created_by: userId, ...body };
          const { data, error } = await supabase.from("social_groups").insert(group).select().single();
          if (error) throw error;
          return ok(data, 201);
        }
      }

      // ── Group Members ──
      if (sub === "group-members") {
        if (method === "GET") {
          const groupId = getParam(url, "group_id");
          let query = supabase.from("social_group_members").select("*").eq("user_id", userId);
          if (groupId) query = query.eq("group_id", groupId);
          const { data, error } = await query;
          if (error) throw error;
          return ok(data);
        }
        if (method === "POST") {
          const body = await req.json().catch(() => ({}));
          const { data, error } = await supabase.from("social_group_members").insert({ group_id: body.group_id, user_id: userId }).select();
          if (error) throw error;
          return ok(data?.[0] || body, 201);
        }
        if (method === "DELETE") {
          const groupId = getParam(url, "group_id");
          if (!groupId) return err("group_id is required", 400);
          const { error } = await supabase.from("social_group_members").delete().eq("group_id", groupId).eq("user_id", userId);
          if (error) throw error;
          return ok({ deleted: true });
        }
      }

      // ── Events ──
      if (sub === "events") {
        if (method === "GET") {
          const groupId = getParam(url, "group_id");
          let query = supabase.from("social_events").select("*");
          if (groupId) query = query.eq("group_id", groupId);
          query = applyOrder(query, url);
          const { data, error } = await query;
          if (error) throw error;
          return ok(data);
        }
        if (method === "POST") {
          const body = await req.json().catch(() => ({}));
          const event = { id: body.id || crypto.randomUUID(), created_by: userId, ...body };
          const { data, error } = await supabase.from("social_events").insert(event).select().single();
          if (error) throw error;
          return ok(data, 201);
        }
      }

      // ── Follows ──
      if (sub === "follows") {
        if (method === "GET") {
          let query = supabase.from("social_follows").select("*").eq("follower_id", userId);
          const followingId = getParam(url, "following_id");
          if (followingId) query = query.eq("following_id", followingId);
          const { data, error } = await query;
          if (error) throw error;
          return ok(data);
        }
        if (method === "POST") {
          const body = await req.json().catch(() => ({}));
          const { data, error } = await supabase.from("social_follows").insert({ follower_id: userId, following_id: body.following_id }).select();
          if (error) throw error;
          return ok(data?.[0] || body, 201);
        }
        if (method === "DELETE") {
          const followingId = getParam(url, "following_id");
          if (!followingId) return err("following_id is required", 400);
          const { error } = await supabase.from("social_follows").delete().eq("follower_id", userId).eq("following_id", followingId);
          if (error) throw error;
          return ok({ deleted: true });
        }
      }

      // ── Chat Messages (social) ──
      if (sub === "chat-messages") {
        if (method === "GET") {
          const groupId = getParam(url, "group_id");
          if (!groupId) return err("group_id is required", 400);
          const { data, error } = await supabase.from("social_chat_messages").select("*, social_users(display_name, avatar_url)").eq("group_id", groupId).order("created_at", { ascending: true });
          if (error) throw error;
          return ok(data);
        }
        if (method === "POST") {
          const body = await req.json().catch(() => ({}));
          const msg = { id: body.id || crypto.randomUUID(), group_id: body.group_id, user_id: userId, content: body.content || "" };
          const { data, error } = await supabase.from("social_chat_messages").insert(msg).select().single();
          if (error) throw error;
          return ok(data, 201);
        }
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // 12. SOCIAL USERS — /v1/social-users (ensure profile exists)
    // ════════════════════════════════════════════════════════════════════════
    if (resource === "social-users") {
      if (method === "POST") {
        const body = await req.json().catch(() => ({}));
        const socialUser = { id: userId, username: body.username || `user_${userId.slice(0, 8)}`, display_name: body.display_name || "Scholar", avatar_url: body.avatar_url || null, bio: body.bio || "New to the community!", interests: body.interests || ["learning"] };
        const { data, error } = await supabase.from("social_users").upsert(socialUser, { onConflict: "id" }).select().single();
        if (error) throw error;
        return ok(data, 201);
      }
      if (method === "GET") {
        const targetId = getParam(url, "user_id", userId);
        const { data, error } = await supabase.from("social_users").select("*").eq("id", targetId).single();
        if (error) return err("Social user not found", 404);
        return ok(data);
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // 13. PEER CHEERS — /v1/peer-cheers
    // ════════════════════════════════════════════════════════════════════════
    if (resource === "peer-cheers") {
      if (method === "POST") {
        const body = await req.json().catch(() => ({}));
        const cheer = { id: body.id || crypto.randomUUID(), sender_id: userId, recipient_id: body.recipient_id, emoji: body.emoji || "👏", created_at: new Date().toISOString() };
        const { data, error } = await supabase.from("peer_cheers").insert(cheer).select().single();
        if (error) throw error;
        return ok(data, 201);
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // 14. LIVE QUIZ SESSIONS — /v1/live-quiz-sessions
    // ════════════════════════════════════════════════════════════════════════
    if (resource === "live-quiz-sessions") {
      if (method === "GET") {
        const status = getParam(url, "status");
        let query = supabase.from("live_quiz_sessions").select("*, quizzes(title)");
        if (status) query = query.eq("status", status);
        query = applyOrder(query, url).limit(getLimit(url, 15));
        const { data, error } = await query;
        if (error) throw error;
        return ok(data);
      }
      if (method === "POST") {
        const body = await req.json().catch(() => ({}));
        const session = { ...body, host_user_id: userId };
        const { data, error } = await supabase.from("live_quiz_sessions").upsert(session, { onConflict: "id" }).select();
        if (error) throw error;
        return ok(data?.[0] || session, 201);
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // 15. CLASS RECORDINGS — /v1/class-recordings, /v1/class-recordings/:id
    // ════════════════════════════════════════════════════════════════════════
    if (resource === "class-recordings") {
      if (method === "GET" && !subId) {
        let query = supabase.from("class_recordings").select("*").eq("user_id", userId);
        const documentId = getParam(url, "document_id");
        if (documentId) query = query.eq("document_id", documentId);
        query = applyOrder(query, url, "created_at.desc");
        const { data, error } = await query;
        if (error) throw error;
        return ok(data);
      }
      if (method === "POST") {
        const body = await req.json().catch(() => ({}));
        const { data, error } = await supabase.from("class_recordings").upsert({ ...body, user_id: userId }, { onConflict: "id" }).select();
        if (error) throw error;
        return ok(data?.[0] || body, 201);
      }
      if ((method === "PATCH" || method === "PUT") && subId) {
        const body = await req.json().catch(() => ({}));
        const { data, error } = await supabase.from("class_recordings").update(body).eq("id", subId).eq("user_id", userId).select().single();
        if (error) throw error;
        return ok(data);
      }
      if (method === "DELETE" && subId) {
        const { error } = await supabase.from("class_recordings").delete().eq("id", subId).eq("user_id", userId);
        if (error) throw error;
        return ok({ deleted: true, id: subId });
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // 16. AI PODCASTS — /v1/ai-podcasts, /v1/ai-podcasts/:id
    // ════════════════════════════════════════════════════════════════════════
    if (resource === "ai-podcasts") {
      if (method === "GET" && !subId) {
        const { data, error } = await supabase.from("ai_podcasts").select("*").eq("user_id", userId).order("created_at", { ascending: false });
        if (error) throw error;
        return ok(data);
      }
      if (method === "POST") {
        const body = await req.json().catch(() => ({}));
        const podcast = { id: body.id || crypto.randomUUID(), user_id: userId, title: body.title || "Podcast", script: body.script || "", style: body.style || "default", duration_minutes: body.duration_minutes || 5, status: body.status || "draft", sources: body.sources || [], audio_segments: body.audio_segments || [], ...body };
        const { data, error } = await supabase.from("ai_podcasts").upsert(podcast, { onConflict: "id" }).select();
        if (error) throw error;
        return ok(data?.[0] || podcast, 201);
      }
      if (method === "DELETE" && subId) {
        const { error } = await supabase.from("ai_podcasts").delete().eq("id", subId).eq("user_id", userId);
        if (error) throw error;
        return ok({ deleted: true, id: subId });
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // 17. COURSE ENROLLMENTS — /v1/course-enrollments
    // ════════════════════════════════════════════════════════════════════════
    if (resource === "course-enrollments") {
      if (method === "GET") {
        const courseId = getParam(url, "course_id");
        let query = supabase.from("course_enrollments").select("*, courses(*)").eq("user_id", userId);
        if (courseId) query = query.eq("course_id", courseId);
        const { data, error } = await query;
        if (error) throw error;
        return ok(data);
      }
      if (method === "POST") {
        const body = await req.json().catch(() => ({}));
        const { data, error } = await supabase.from("course_enrollments").upsert({ user_id: userId, course_id: body.course_id }, { onConflict: "user_id,course_id" }).select();
        if (error) throw error;
        return ok(data?.[0] || body, 201);
      }
      if (method === "DELETE") {
        const courseId = getParam(url, "course_id");
        if (!courseId) return err("course_id is required", 400);
        const { error } = await supabase.from("course_enrollments").delete().eq("user_id", userId).eq("course_id", courseId);
        if (error) throw error;
        return ok({ deleted: true });
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // 18. COURSE MATERIALS — /v1/course-materials
    // ════════════════════════════════════════════════════════════════════════
    if (resource === "course-materials") {
      if (method === "GET") {
        const groupId = getParam(url, "course_id");
        let query = supabase.from("course_materials").select("*");
        if (groupId) query = query.eq("course_id", groupId);
        query = applyOrder(query, url);
        const { data, error } = await query;
        if (error) throw error;
        return ok(data);
      }
      if (method === "POST") {
        const body = await req.json().catch(() => ({}));
        const material = { id: body.id || crypto.randomUUID(), ...body };
        const { data, error } = await supabase.from("course_materials").insert(material).select().single();
        if (error) throw error;
        return ok(data, 201);
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // 19. USER EDUCATION — /v1/user-education-profiles, /v1/user-subjects
    // ════════════════════════════════════════════════════════════════════════
    if (resource === "user-education-profiles") {
      if (method === "GET") {
        const { data, error } = await supabase.from("user_education_profiles").select("*").eq("user_id", userId).limit(1);
        if (error) throw error;
        return ok(data?.[0] || null);
      }
      if (method === "POST") {
        const body = await req.json().catch(() => ({}));
        const { data, error } = await supabase.from("user_education_profiles").upsert({ ...body, user_id: userId }, { onConflict: "user_id" }).select().single();
        if (error) throw error;
        return ok(data, 201);
      }
    }

    if (resource === "user-subjects") {
      if (method === "GET") {
        const profileId = getParam(url, "user_education_profile_id");
        let query = supabase.from("user_subjects").select("*");
        if (profileId) query = query.eq("user_education_profile_id", profileId);
        const { data, error } = await query;
        if (error) throw error;
        return ok(data);
      }
      if (method === "POST") {
        const body = await req.json().catch(() => ({}));
        const { data, error } = await supabase.from("user_subjects").insert({ id: body.id || crypto.randomUUID(), ...body }).select().single();
        if (error) throw error;
        return ok(data, 201);
      }
      if (method === "DELETE") {
        const profileId = getParam(url, "user_education_profile_id");
        if (profileId) {
          const { error } = await supabase.from("user_subjects").delete().eq("user_education_profile_id", profileId);
          if (error) throw error;
        }
        return ok({ deleted: true });
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // 20. GAME PROGRESS — /v1/game-progress
    // ════════════════════════════════════════════════════════════════════════
    if (resource === "game-progress") {
      if (method === "GET") {
        const { data, error } = await supabase.from("game_progress").select("*").eq("user_id", userId);
        if (error) throw error;
        return ok(data);
      }
      if (method === "POST") {
        const body = await req.json().catch(() => ({}));
        const { data, error } = await supabase.from("game_progress").upsert({ ...body, user_id: userId }, { onConflict: "user_id,game_key" }).select();
        if (error) throw error;
        return ok(data?.[0] || body, 201);
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // 21. KID ROADMAP STEPS — /v1/roadmap-steps, /v1/roadmap-steps/:id
    // ════════════════════════════════════════════════════════════════════════
    if (resource === "roadmap-steps") {
      if (method === "GET" && !subId) {
        const { data, error } = await supabase.from("kid_roadmap_steps").select("*").eq("user_id", userId).order("week", { ascending: true }).order("day", { ascending: true }).order("step_index", { ascending: true });
        if (error) throw error;
        return ok(data);
      }
      if (method === "POST") {
        const body = await req.json().catch(() => ({}));
        // Client may send { steps: [...] } for batch upsert or a single step object
        const steps = body.steps || [body];
        const rows = steps.map((s: any) => ({ ...s, user_id: userId }));
        const { data, error } = await supabase.from("kid_roadmap_steps").upsert(rows, { onConflict: "id" }).select();
        if (error) throw error;
        return ok(data || rows, 201);
      }
      if ((method === "PATCH" || method === "PUT") && subId) {
        const body = await req.json().catch(() => ({}));
        const { data, error } = await supabase.from("kid_roadmap_steps").update(body).eq("id", subId).eq("user_id", userId).select().single();
        if (error) throw error;
        return ok(data);
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // 22. QUIZ ATTEMPTS — /v1/quiz-attempts
    // ════════════════════════════════════════════════════════════════════════
    if (resource === "quiz-attempts") {
      if (method === "GET") {
        const { data, error } = await supabase.from("quiz_attempts").select("*").eq("user_id", userId).order("created_at", { ascending: false });
        if (error) throw error;
        return ok(data);
      }
      if (method === "DELETE") {
        const quizId = getParam(url, "quiz_id");
        if (!quizId) return err("quiz_id is required", 400);
        const { error } = await supabase.from("quiz_attempts").delete().eq("quiz_id", quizId).eq("user_id", userId);
        if (error) throw error;
        return ok({ deleted: true });
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // 23. ACTIVE COUNTRIES — /v1/active-countries (public lookup)
    // ════════════════════════════════════════════════════════════════════════
    if (resource === "active-countries") {
      if (method === "GET") {
        const { data, error } = await supabase.rpc("get_active_countries");
        if (error) throw error;
        return ok(data);
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // 24. ADMIN STATUS — /v1/admin/status
    // ════════════════════════════════════════════════════════════════════════
    if (resource === "admin") {
      const sub = subPath[0];
      if (sub === "status" && method === "GET") {
        const { data, error } = await supabase.from("admin_users").select("id, is_active").eq("user_id", userId).eq("is_active", true).maybeSingle();
        if (error) throw error;
        return ok({ is_admin: !!data });
      }
      if (sub === "users" && method === "GET") {
        // Admin-only: list all users with stats
        const { data: adminCheck } = await supabase.from("admin_users").select("id").eq("user_id", userId).eq("is_active", true).maybeSingle();
        if (!adminCheck) return err("Forbidden: not an admin", 403);
        const limit = getLimit(url, 50);
        const offset = getOffset(url);
        const { data, count, error } = await supabase.from("profiles").select("*", { count: "exact" }).range(offset, offset + limit - 1);
        if (error) throw error;
        return ok(data, 200, { total: count || 0 });
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // 25. SUBSCRIPTIONS — /v1/subscriptions
    // ════════════════════════════════════════════════════════════════════════
    if (resource === "subscriptions") {
      if (method === "GET") {
        const { data, error } = await supabase.from("user_subscriptions").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (error) throw error;
        return ok(data || null);
      }
      if (method === "POST") {
        const body = await req.json().catch(() => ({}));
        const sub = { id: body.id || crypto.randomUUID(), user_id: userId, ...body };
        const { data, error } = await supabase.from("user_subscriptions").upsert(sub, { onConflict: "user_id" }).select().single();
        if (error) throw error;
        return ok(data, 201);
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // 26. NOTIFICATION PREFERENCES — /v1/notification-preferences
    // ════════════════════════════════════════════════════════════════════════
    if (resource === "notification-preferences") {
      if (method === "GET") {
        const { data, error } = await supabase.from("notification_preferences").select("*").eq("user_id", userId).maybeSingle();
        if (error) throw error;
        return ok(data || null);
      }
      if (method === "POST" || method === "PATCH" || method === "PUT") {
        const body = await req.json().catch(() => ({}));
        const { data, error } = await supabase.from("notification_preferences").upsert({ ...body, user_id: userId }, { onConflict: "user_id" }).select().single();
        if (error) throw error;
        return ok(data, 201);
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // 27. TESTIMONIALS — /v1/testimonials (public)
    // ════════════════════════════════════════════════════════════════════════
    if (resource === "testimonials") {
      if (method === "GET") {
        const { data, error } = await supabase.rpc("get_approved_testimonials", { p_limit: parseInt(getParam(url, "limit", "20")) });
        if (error) throw error;
        return ok(data);
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // 28. APP RATINGS — /v1/app-ratings (public)
    // ════════════════════════════════════════════════════════════════════════
    if (resource === "app-ratings") {
      if (method === "GET") {
        const targetUserId = getParam(url, "user_id");
        if (targetUserId) {
          const { data, error } = await supabase.from("app_ratings").select("rating").eq("user_id", targetUserId).maybeSingle();
          if (error) throw error;
          return ok(data || null);
        }
        const { data, error } = await supabase.rpc("get_app_rating_stats");
        if (error) throw error;
        return ok(data);
      }
      if (method === "POST") {
        const body = await req.json().catch(() => ({}));
        const { data, error } = await supabase.from("app_ratings").upsert({ ...body, user_id: userId }, { onConflict: "user_id" }).select().single();
        if (error) throw error;
        return ok(data, 201);
      }
    }

    if (resource === "app-testimonials") {
      if (method === "GET") {
        const targetUserId = getParam(url, "user_id", userId);
        const { data, error } = await supabase.from("app_testimonials").select("content, rating, is_approved").eq("user_id", targetUserId).maybeSingle();
        if (error) throw error;
        return ok(data || null);
      }
      if (method === "POST") {
        const body = await req.json().catch(() => ({}));
        const { data, error } = await supabase.from("app_testimonials").upsert({ ...body, user_id: userId }, { onConflict: "user_id" }).select().single();
        if (error) throw error;
        return ok(data, 201);
      }
    }

    if (resource === "user-learning-goals") {
      if (method === "GET") {
        let query = supabase.from("user_learning_goals").select("*").eq("user_id", userId);
        query = applyOrder(query, url, "created_at.desc");
        const { data, error } = await query;
        if (error) throw error;
        return ok(data);
      }
      if (method === "POST") {
        const body = await req.json().catch(() => ({}));
        const goal = { id: body.id || crypto.randomUUID(), user_id: userId, ...body };
        const { data, error } = await supabase.from("user_learning_goals").insert(goal).select().single();
        if (error) throw error;
        return ok(data, 201);
      }
      if ((method === "PATCH" || method === "PUT") && subId) {
        const body = await req.json().catch(() => ({}));
        const { data, error } = await supabase.from("user_learning_goals").update(body).eq("id", subId).eq("user_id", userId).select().single();
        if (error) throw error;
        return ok(data);
      }
      if (method === "DELETE" && subId) {
        const { error } = await supabase.from("user_learning_goals").delete().eq("id", subId).eq("user_id", userId);
        if (error) throw error;
        return ok({ deleted: true, id: subId });
      }
    }

    if (resource === "achievements") {
      if (method === "GET") {
        const { data, error } = await supabase.from("achievements").select("*, badges(*)").eq("user_id", userId).order("earned_at", { ascending: false });
        if (error) throw error;
        return ok(data);
      }
    }

    if (resource === "institutions") {
      if (method === "GET") {
        let query = supabase.from("institutions").select("id,name");
        const isActive = getParam(url, "is_active");
        if (isActive === "true") query = query.eq("is_active", true);
        const type = getParam(url, "type");
        if (type) query = query.eq("type", type);
        const { data, error } = await query;
        if (error) throw error;
        return ok(data);
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // 29. NOTIFICATIONS — /v1/notifications
    // ════════════════════════════════════════════════════════════════════════
    if (resource === "notifications") {
      if (method === "GET") {
        let query = supabase.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false });
        query = query.limit(getLimit(url, 50));
        const { data, error } = await query;
        if (error) throw error;
        return ok(data);
      }
      if (method === "PATCH" || method === "PUT") {
        const body = await req.json().catch(() => ({}));
        if (body.id) {
          const { data, error } = await supabase.from("notifications").update({ is_read: true }).eq("id", body.id).eq("user_id", userId).select().single();
          if (error) throw error;
          return ok(data);
        }
        // Mark all as read
        const { error } = await supabase.from("notifications").update({ is_read: true }).eq("user_id", userId).eq("is_read", false);
        if (error) throw error;
        return ok({ marked_all_read: true });
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // FALLBACK — Unknown resource → 404
    // ════════════════════════════════════════════════════════════════════════
    return err(`Route not found: ${method} /v1/${resource}`, 404);

  } catch (err2: any) {
    console.error(`[API Error] ${method} /v1/${resource}:`, err2);
    return err(err2.message || "Internal server error", 500);
  }
});
