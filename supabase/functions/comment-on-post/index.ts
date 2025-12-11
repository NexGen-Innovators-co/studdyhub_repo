import { serve } from "https://deno.land/std@0.170.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { 
  createSubscriptionValidator, 
  createErrorResponse as createSubErrorResponse, 
  extractUserIdFromAuth 
} from '../utils/subscription-validator.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface CommentRequest {
  postId: string;
  content: string;
}

interface ErrorResponse {
  error: string;
}

interface SuccessResponse {
  success: boolean;
  comment?: {
    id: string;
    post_id: string;
    user_id: string;
    content: string;
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
    // Extract user ID from auth header
    const userId = await extractUserIdFromAuth(req, supabaseUrl, supabaseServiceKey);
    if (!userId) {
      return createSubErrorResponse('Unauthorized: Invalid or missing authentication', 401);
    }

    // Initialize validator
    const validator = createSubscriptionValidator();

    // Check subscription for commenting
    const canComment = await validator.canAccessCommunity(userId);
    if (!canComment.allowed) {
      return createSubErrorResponse(canComment.message || 'Not allowed to comment', 403);
    }

    // Parse request body
    const { postId, content }: CommentRequest = await req.json();

    if (!postId || !content) {
      return createSubErrorResponse("Post ID and comment content are required", 400);
    }

    // Validate content length
    if (content.trim().length === 0) {
      return createSubErrorResponse("Comment cannot be empty", 400);
    }

    if (content.length > 1000) {
      return createSubErrorResponse("Comment must be less than 1000 characters", 400);
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify post exists
    const { data: post, error: postError } = await supabase
      .from("social_posts")
      .select("id")
      .eq("id", postId)
      .single();

    if (postError || !post) {
      return createSubErrorResponse("Post not found", 404);
    }

    // Create comment
    const { data: comment, error: insertError } = await supabase
      .from("social_comments")
      .insert({
        post_id: postId,
        author_id: userId,
        content: content.trim(),
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating comment:", insertError);
      return createSubErrorResponse("Failed to create comment", 500);
    }

    return createSuccessResponse(
      {
        success: true,
        comment: comment,
      },
      201
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return createSubErrorResponse("Internal server error", 500);
  }
});
