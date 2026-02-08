// supabase/functions/edit-social-post/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { extractUserIdFromAuth, createErrorResponse } from '../utils/subscription-validator.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function extractHashtags(content: string): string[] {
  const regex = /#(\w+)/g;
  const matches: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    matches.push(match[1].toLowerCase());
  }
  return [...new Set(matches)];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    const userId = await extractUserIdFromAuth(req, supabaseUrl, supabaseServiceKey);
    if (!userId) {
      return createErrorResponse('Unauthorized', 401);
    }

    const body = await req.json();
    const { post_id, content } = body;

    if (!post_id) {
      return createErrorResponse('post_id is required', 400);
    }
    if (!content || !content.trim()) {
      return createErrorResponse('Post content cannot be empty', 400);
    }
    if (content.length > 5000) {
      return createErrorResponse('Post content is too long (max 5000 characters)', 400);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify ownership and get old content
    const { data: post, error: fetchError } = await supabase
      .from('social_posts')
      .select('author_id, content')
      .eq('id', post_id)
      .single();

    if (fetchError || !post) {
      return createErrorResponse('Post not found', 404);
    }
    if (post.author_id !== userId) {
      return createErrorResponse('You can only edit your own posts', 403);
    }

    // Update the post
    const { error: updateError } = await supabase
      .from('social_posts')
      .update({ content: content.trim(), updated_at: new Date().toISOString() })
      .eq('id', post_id);

    if (updateError) throw updateError;

    // Handle hashtag changes — all server-side now
    const newHashtags = extractHashtags(content);

    // Remove old hashtag associations
    await supabase.from('social_post_hashtags').delete().eq('post_id', post_id);

    // Upsert new hashtags and create associations
    for (const tag of newHashtags) {
      const { data: hashtag, error: hashtagError } = await supabase
        .from('social_hashtags')
        .upsert({ name: tag }, { onConflict: 'name' })
        .select()
        .single();

      if (!hashtagError && hashtag) {
        await supabase.from('social_post_hashtags').insert({
          post_id: post_id,
          hashtag_id: hashtag.id,
          created_at: new Date().toISOString(),
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true, content: content.trim() }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('edit-social-post error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
