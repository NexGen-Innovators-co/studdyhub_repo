// supabase/functions/auth-onboarding/index.ts
// ═══════════════════════════════════════════════════════════════════════════════
// Single source of truth for auth + onboarding across ALL clients
// (Android app, Web app, future iOS).
//
// Routes:
//   POST /get-profile     → Returns the user's full profile from cloud
//   POST /complete-onboarding → Atomically sets all onboarding fields + marks complete
//   POST /sync-profile    → Safe merge of local data → cloud
//
// All routes require a valid Supabase JWT (Authorization: Bearer <token>).
// ═══════════════════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { logSystemError } from "../_shared/errorLogger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** Extract the authenticated user from the Authorization header. */
async function getUser(
  req: Request,
  supabaseUrl: string,
  serviceKey: string
): Promise<{ id: string; email: string } | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.substring(7);
  const client = createClient(supabaseUrl, serviceKey);
  const {
    data: { user },
    error,
  } = await client.auth.getUser(token);
  if (error || !user) return null;
  return { id: user.id, email: user.email ?? "" };
}

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function errorResp(message: string, status = 400) {
  return jsonResp({ success: false, error: message }, status);
}

serve(async (req: Request) => {
  const startTime = Date.now();
  // ── CORS preflight ──────────────────────────────────────────────────────
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";

  if (!supabaseUrl || !serviceKey) {
    console.error("[auth-onboarding] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return errorResp("Server configuration error", 500);
  }

  try {
    // ── Authenticate ────────────────────────────────────────────────────
    // Extract the JWT from the Authorization header
    const authHeader = req.headers.get("authorization");
    const jwt = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : "";

    const user = await getUser(req, supabaseUrl, serviceKey);
    if (!user) {
      console.warn("[auth-onboarding] Authentication failed — no valid user from token");
      return errorResp("Authentication required. Please sign in.", 401);
    }
    console.log(`[auth-onboarding] Authenticated user: ${user.id} (${user.email})`);

    // ── Parse body ──────────────────────────────────────────────────────
    const body = await req.json().catch(() => ({}));
    const action = (body.action as string) || "get-profile";
    console.log(`[auth-onboarding] Action: ${action}, payload keys: ${Object.keys(body).join(', ')}`);

    // CRITICAL: Create client with the USER's JWT (not service role key)
    // so that auth.uid() inside RPCs returns the correct user ID.
    // Service role key has no user context → auth.uid() returns NULL → RPCs fail.
    const client = jwt ? createClient(supabaseUrl, anonKey || serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${jwt}` } }
    }) : createClient(supabaseUrl, serviceKey);
    console.log(`[auth-onboarding] Using ${jwt ? 'user JWT' : 'service role'} client for RPC calls`);

    // ── Route: get-profile ──────────────────────────────────────────────
    if (action === "get-profile") {
      console.log(`[auth-onboarding] Calling RPC get_profile for user ${user.id}`);
      const { data, error } = await client.rpc("get_profile");

      if (error) {
        console.error(`[auth-onboarding] get_profile RPC FAILED: code=${error.code}, message=${error.message}, details=${JSON.stringify(error.details || {})}, hint=${error.hint || 'none'}`);
        await logSystemError(client as any, {
          severity: "error",
          source: "auth-onboarding",
          component: "get-profile",
          message: `RPC get_profile failed: ${error.code} — ${error.message}`,
          user_id: user.id,
          details: { code: error.code, details: error.details, hint: error.hint },
        });
        return errorResp(`Failed to fetch profile: ${error.code} — ${error.message}`, 500);
      }

      console.log(`[auth-onboarding] get_profile RPC succeeded in ${Date.now() - startTime}ms`);
      return jsonResp(data);
    }

    // ── Route: complete-onboarding ──────────────────────────────────────
    if (action === "complete-onboarding") {
      const {
        full_name,
        school,
        academic_level,
        academic_tier,
        learning_style,
        learning_preferences,
        quiz_preferences,
        personal_context,
      } = body;

      console.log(`[auth-onboarding] complete-onboarding: tier=${academic_tier}, level=${academic_level}, style=${learning_style}, name=${full_name}`);

      // Validate academic_tier if provided
      const validTiers = ["explorer", "achiever", "scholar"];
      if (academic_tier && !validTiers.includes(academic_tier)) {
        console.error(`[auth-onboarding] Invalid tier: "${academic_tier}"`);
        return errorResp(
          `Invalid academic_tier "${academic_tier}". Must be one of: ${validTiers.join(", ")}`
        );
      }

      const { data, error } = await client.rpc("complete_onboarding", {
        p_full_name: full_name || null,
        p_school: school || null,
        p_academic_level: academic_level || null,
        p_academic_tier: academic_tier || null,
        p_learning_style: learning_style || null,
        p_learning_preferences: learning_preferences || null,
        p_quiz_preferences: quiz_preferences || null,
        p_personal_context: personal_context || null,
      });

      if (error) {
        console.error(`[auth-onboarding] complete_onboarding RPC FAILED: code=${error.code}, message=${error.message}, details=${JSON.stringify(error.details || {})}, hint=${error.hint || 'none'}`);
        await logSystemError(client as any, {
          severity: "error",
          source: "auth-onboarding",
          component: "complete-onboarding",
          message: `RPC complete_onboarding failed: ${error.code} — ${error.message}`,
          user_id: user.id,
          details: { code: error.code, details: error.details, hint: error.hint, body },
        });
        return errorResp(
          `Failed to save onboarding: ${error.code} — ${error.message}`,
          500
        );
      }

      console.log(`[auth-onboarding] complete_onboarding RPC succeeded in ${Date.now() - startTime}ms`);
      return jsonResp(data);
    }

    // ── Route: sync-profile ─────────────────────────────────────────────
    if (action === "sync-profile") {
      const {
        full_name,
        school,
        academic_level,
        academic_tier,
        learning_style,
        learning_preferences,
        quiz_preferences,
        personal_context,
        avatar_url,
        bio,
        username,
        onboarding_completed,
        points_balance,
      } = body;

      console.log(`[auth-onboarding] sync-profile: tier=${academic_tier}, level=${academic_level}, style=${learning_style}, completed=${onboarding_completed}`);

      const { data, error } = await client.rpc("sync_profile", {
        p_full_name: full_name || null,
        p_school: school || null,
        p_academic_level: academic_level || null,
        p_academic_tier: academic_tier || null,
        p_learning_style: learning_style || null,
        p_learning_preferences: learning_preferences || null,
        p_quiz_preferences: quiz_preferences || null,
        p_personal_context: personal_context || null,
        p_avatar_url: avatar_url || null,
        p_bio: bio || null,
        p_username: username || null,
        p_onboarding_completed:
          onboarding_completed !== undefined ? onboarding_completed : null,
        p_points_balance:
          points_balance !== undefined ? points_balance : null,
      });

      if (error) {
        console.error(`[auth-onboarding] sync_profile RPC FAILED: code=${error.code}, message=${error.message}, details=${JSON.stringify(error.details || {})}, hint=${error.hint || 'none'}`);
        await logSystemError(client as any, {
          severity: "error",
          source: "auth-onboarding",
          component: "sync-profile",
          message: `RPC sync_profile failed: ${error.code} — ${error.message}`,
          user_id: user.id,
          details: { code: error.code, details: error.details, hint: error.hint, body },
        });
        return errorResp(`Failed to sync profile: ${error.code} — ${error.message}`, 500);
      }

      console.log(`[auth-onboarding] sync_profile RPC succeeded in ${Date.now() - startTime}ms`);
      return jsonResp(data);
    }

    // ── Unknown action ──────────────────────────────────────────────────
    return errorResp(`Unknown action: "${action}"`, 400);
  } catch (err) {
    const message = err?.message || String(err);
    console.error("[auth-onboarding] Unhandled error:", message);

    try {
      const client = createClient(supabaseUrl, serviceKey);
      await logSystemError(client as any, {
        severity: "error",
        source: "auth-onboarding",
        component: "unhandled",
        message,
        details: { stack: err?.stack },
      });
    } catch (_) {
      /* logging failure is non-fatal */
    }

    return errorResp("Something went wrong. Please try again.", 500);
  }
});
