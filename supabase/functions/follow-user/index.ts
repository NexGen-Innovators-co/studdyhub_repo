import { serve } from "https://deno.land/std@0.170.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

interface FollowRequest {
  targetUserId: string;
}

interface ErrorResponse {
  error: string;
}

interface SuccessResponse {
  success: boolean;
  follow?: {
    id: string;
    follower_id: string;
    following_id: string;
    created_at: string;
  };
}

const createErrorResponse = (error: string, status: number = 400): Response => {
  return new Response(
    JSON.stringify({ error }),
    {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
};

const createSuccessResponse = (data: SuccessResponse, status: number = 200): Response => {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) {
      return createErrorResponse("Unauthorized: Missing authorization header", 401);
    }

    // Create Supabase client with auth token
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    // Get current user from auth
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return createErrorResponse("Unauthorized: Invalid or expired token", 401);
    }

    const userId = user.id;

    // Parse request body
    const { targetUserId }: FollowRequest = await req.json();

    if (!targetUserId) {
      return createErrorResponse("Target user ID is required", 400);
    }

    // Cannot follow yourself
    if (userId === targetUserId) {
      return createErrorResponse("You cannot follow yourself", 400);
    }

    // Check if user is an admin (admins have full access)
    const { data: adminUser } = await supabase
      .from("admin_users")
      .select("id, is_active")
      .eq("user_id", userId)
      .eq("is_active", true)
      .single();

    const isAdmin = !!adminUser;

    // Check user's subscription tier (skip for admins)
    if (!isAdmin) {
      const { data: userSub, error: subError } = await supabase
        .from("users")
        .select("subscription_tier")
        .eq("id", userId)
        .single();

      if (subError || !userSub) {
        return createErrorResponse("User not found", 404);
      }

      // Check if user can follow (Scholar+ tier only)
      if (userSub.subscription_tier === "free") {
        return createErrorResponse(
          "Following users is only available for Scholar and Genius plans. Upgrade to build your network!",
          403
        );
      }
    }

    // Verify target user exists
    const { data: targetUser, error: targetError } = await supabase
      .from("users")
      .select("id")
      .eq("id", targetUserId)
      .single();

    if (targetError || !targetUser) {
      return createErrorResponse("Target user not found", 404);
    }

    // Check if already following
    const { data: existingFollow, error: checkError } = await supabase
      .from("social_follows")
      .select("id")
      .eq("follower_id", userId)
      .eq("following_id", targetUserId)
      .single();

    if (!checkError && existingFollow) {
      return createErrorResponse("You are already following this user", 400);
    }

    // Create follow relationship
    const { data: follow, error: insertError } = await supabase
      .from("social_follows")
      .insert({
        follower_id: userId,
        following_id: targetUserId,
      })
      .select()
      .single();

    if (insertError) {
      // console.error("Error creating follow:", insertError);
      return createErrorResponse("Failed to follow user", 500);
    }

    return createSuccessResponse(
      {
        success: true,
        follow: follow,
      },
      201
    );
  } catch (error) {
    // console.error("Unexpected error:", error);
    return createErrorResponse("Internal server error", 500);
  }
});

