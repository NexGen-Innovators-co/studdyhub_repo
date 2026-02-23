// supabase/functions/ai-categorize-post/index.ts
// AI-powered post categorization using Gemini
// Called automatically when a new post is created, or can batch-categorize existing posts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { extractUserIdFromAuth, createErrorResponse } from '../utils/subscription-validator.ts';
import { callGeminiJSON } from '../utils/gemini.ts';
import { logSystemError } from '../_shared/errorLogger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Predefined category taxonomy for consistent categorization
const CATEGORIES = [
  'technology', 'programming', 'web-development', 'mobile-dev', 'data-science',
  'ai-ml', 'cybersecurity', 'devops', 'mathematics', 'physics', 'chemistry',
  'biology', 'medicine', 'engineering', 'business', 'finance', 'marketing',
  'design', 'arts', 'music', 'writing', 'language-learning', 'philosophy',
  'psychology', 'history', 'politics', 'law', 'education', 'career',
  'study-tips', 'exam-prep', 'research', 'motivation', 'health', 'lifestyle',
  'sports', 'gaming', 'entertainment', 'news', 'discussion', 'question',
  'tutorial', 'resource-sharing', 'project-showcase', 'meme-humor',
];

interface CategorizeResult {
  categories: string[];
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
  quality_score: number; // 1-10
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { postId, postIds, content, batchUncategorized = false } = body;

    // Mode 1: Single post categorization (called on post create)
    if (postId || content) {
      let postContent = content;
      let targetPostId = postId;

      if (postId && !content) {
        const { data: post } = await supabase
          .from('social_posts')
          .select('id, content')
          .eq('id', postId)
          .single();
        if (!post) {
          return new Response(JSON.stringify({ error: 'Post not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        postContent = post.content;
        targetPostId = post.id;
      }

      const result = await categorizeContent(postContent);

      if (result && targetPostId) {
        await supabase
          .from('social_posts')
          .update({
            ai_categories: result.categories,
            ai_sentiment: result.sentiment,
            ai_quality_score: result.quality_score,
          })
          .eq('id', targetPostId);
      }

      return new Response(JSON.stringify({ success: true, ...result }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Mode 2: Batch categorize specific posts
    if (postIds && Array.isArray(postIds)) {
      const results = await batchCategorize(supabase, postIds);
      return new Response(JSON.stringify({ success: true, processed: results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Mode 3: Batch categorize all uncategorized posts
    if (batchUncategorized) {
      const { data: uncategorized } = await supabase
        .from('social_posts')
        .select('id, content')
        .or('ai_categories.is.null,ai_categories.eq.{}')
        .order('created_at', { ascending: false })
        .limit(50); // Process 50 at a time

      if (!uncategorized || uncategorized.length === 0) {
        return new Response(JSON.stringify({ success: true, processed: 0, message: 'All posts already categorized' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const ids = uncategorized.map(p => p.id);
      const results = await batchCategorize(supabase, ids, uncategorized);
      return new Response(JSON.stringify({ success: true, processed: results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Provide postId, postIds, or batchUncategorized' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    // ── Log to system_error_logs ──
    try {
      const _logClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      await logSystemError(_logClient, {
        severity: 'error',
        source: 'ai-categorize-post',
        message: error?.message || String(error),
        details: { stack: error?.stack },
      });
    } catch (_logErr) { console.error('[ai-categorize-post] Error logging failed:', _logErr); }
    console.error('ai-categorize-post error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function categorizeContent(content: string): Promise<CategorizeResult | null> {
  if (!content || content.trim().length < 5) {
    return { categories: ['discussion'], sentiment: 'neutral', quality_score: 3 };
  }

  const prompt = `Analyze this social media post from an educational/study platform and categorize it.

POST CONTENT:
"""
${content.slice(0, 1000)}
"""

AVAILABLE CATEGORIES (pick 1-3 most relevant):
${CATEGORIES.join(', ')}

Respond in JSON format only:
{
  "categories": ["category1", "category2"],
  "sentiment": "positive" | "neutral" | "negative" | "mixed",
  "quality_score": <1-10, where 10 = highly educational/valuable, 1 = low-effort/spam>
}`;

  const result = await callGeminiJSON<CategorizeResult>(prompt, {
    temperature: 0.1,
    maxOutputTokens: 256,
  });

  if (!result.success || !result.data) {
    // Fallback: return generic categorization
    return { categories: ['discussion'], sentiment: 'neutral', quality_score: 5 };
  }

  // Validate categories against allowed list
  const validCategories = (result.data.categories || [])
    .filter(c => CATEGORIES.includes(c))
    .slice(0, 3);

  return {
    categories: validCategories.length > 0 ? validCategories : ['discussion'],
    sentiment: ['positive', 'neutral', 'negative', 'mixed'].includes(result.data.sentiment)
      ? result.data.sentiment
      : 'neutral',
    quality_score: Math.min(10, Math.max(1, Math.round(result.data.quality_score || 5))),
  };
}

async function batchCategorize(
  supabase: any,
  postIds: string[],
  preloaded?: any[]
): Promise<number> {
  let posts = preloaded;
  if (!posts) {
    const { data } = await supabase
      .from('social_posts')
      .select('id, content')
      .in('id', postIds);
    posts = data || [];
  }

  let processed = 0;

  // Process in chunks of 5 to avoid rate limits
  for (let i = 0; i < posts.length; i += 5) {
    const chunk = posts.slice(i, i + 5);
    const results = await Promise.all(
      chunk.map(async (post: any) => {
        const result = await categorizeContent(post.content);
        if (result) {
          await supabase
            .from('social_posts')
            .update({
              ai_categories: result.categories,
              ai_sentiment: result.sentiment,
              ai_quality_score: result.quality_score,
            })
            .eq('id', post.id);
          processed++;
        }
      })
    );

    // Brief delay between chunks
    if (i + 5 < posts.length) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  return processed;
}
