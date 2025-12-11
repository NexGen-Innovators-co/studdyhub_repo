// supabase/functions/create-social-post/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { 
  SubscriptionValidator, 
  createErrorResponse, 
  extractUserIdFromAuth 
} from '../utils/subscription-validator.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Extract user ID from auth header
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    const userId = await extractUserIdFromAuth(req, supabaseUrl, supabaseServiceKey);
    if (!userId) {
      return createErrorResponse('Unauthorized: Invalid or missing authentication', 401);
    }

    // Initialize validator
    const validator = new SubscriptionValidator(supabaseUrl, supabaseServiceKey);

    // Check subscription for social posting
    const canPost = await validator.canPostSocial(userId);
    if (!canPost.allowed) {
      return createErrorResponse(canPost.message || 'Not allowed to post', 403);
    }

    // Parse request body
    const body = await req.json();
    const { content, privacy = 'public', media = [], group_id = null } = body;

    // Validate content
    if (!content || content.trim().length === 0) {
      return createErrorResponse('Post content cannot be empty', 400);
    }

    if (content.length > 5000) {
      return createErrorResponse('Post content is too long (max 5000 characters)', 400);
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Create the social post (without media_urls - that column doesn't exist)
    const { data: post, error } = await supabase
      .from('social_posts')
      .insert({
        author_id: userId,
        content,
        privacy,
        group_id,
        created_at: new Date().toISOString(),
        likes_count: 0,
        comments_count: 0
      })
      .select('*')
      .single();

    if (error) {
      console.error('Error creating post:', error);
      return createErrorResponse('Failed to create post', 500);
    }

    // Insert media records into social_media table
    if (media && media.length > 0) {
      const mediaRecords = media.map((item: any) => ({
        post_id: post.id,
        type: item.type,
        url: item.url,
        filename: item.filename || 'untitled',
        size_bytes: item.size_bytes || 0,
        mime_type: item.mime_type || 'application/octet-stream',
        thumbnail_url: item.thumbnail_url || null
      }));

      const { error: mediaError } = await supabase
        .from('social_media')
        .insert(mediaRecords);

      if (mediaError) {
        console.error('Error creating media:', mediaError);
        // Don't fail the whole request, just log the error
      }
    }

    return new Response(JSON.stringify({
      success: true,
      post
    }), {
      status: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    console.error('Error in create-social-post:', error);
    return createErrorResponse('Internal server error', 500);
  }
});
