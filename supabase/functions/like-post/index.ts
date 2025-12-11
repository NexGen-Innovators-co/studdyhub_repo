import { serve } from "https://deno.land/std@0.170.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

interface LikePostRequest {
  postId: string;
  isLiked: boolean;
}

interface ErrorResponse {
  error: string;
}

interface SuccessResponse {
  success: boolean;
  like?: {
    id: string;
    post_id: string;
    user_id: string;
    created_at: string;
  };
  message?: string;
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

const extractUserIdFromAuth = (authHeader: string): string | null => {
  try {
    if (!authHeader.startsWith("Bearer ")) {
      return null;
    }

    // In a real app, you would verify the JWT token here
    // For now, we'll rely on Supabase's auth context
    return authHeader.slice(7);
  } catch {
    return null;
  }
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
    const { postId, isLiked }: LikePostRequest = await req.json();

    if (!postId) {
      return createErrorResponse("Post ID is required", 400);
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

      // Check if user can like posts (Scholar+ tier only)
      if (userSub.subscription_tier === "free") {
        return createErrorResponse(
          "Liking posts is only available for Scholar and Genius plans. Upgrade to interact with posts!",
          403
        );
      }
    }

    // Verify post exists
    const { data: post, error: postError } = await supabase
      .from("social_posts")
      .select("id")
      .eq("id", postId)
      .single();

    if (postError || !post) {
      return createErrorResponse("Post not found", 404);
    }

    if (isLiked) {
      // Remove like
      const { error: deleteError } = await supabase
        .from("social_post_likes")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", userId);

      if (deleteError) {
        console.error("Error removing like:", deleteError);
        return createErrorResponse("Failed to unlike post", 500);
      }

      return createSuccessResponse({
        success: true,
        message: "Post unliked successfully",
      });
    } else {
      // Add like
      const { data: like, error: insertError } = await supabase
        .from("social_post_likes")
        .insert({
          post_id: postId,
          user_id: userId,
        })
        .select()
        .single();

      if (insertError) {
        console.error("Error adding like:", insertError);
        return createErrorResponse("Failed to like post", 500);
      }

      return createSuccessResponse(
        {
          success: true,
          like: like,
          message: "Post liked successfully",
        },
        201
      );
    }
  } catch (error) {
    console.error("Unexpected error:", error);
    return createErrorResponse("Internal server error", 500);
  }
});
