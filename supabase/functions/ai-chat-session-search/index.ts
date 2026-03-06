// supabase/functions/ai-chat-session-search/index.ts
// Provides AI-enhanced search over chat_sessions. When the user provides a
// natural-language description of a conversation, this endpoint will return an
// ordered list of matching session ids. For now it falls back to a simple title
// ilike search, but hooks are in place for embedding-based or GPT-based
// retrieval in the future.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { extractUserIdFromAuth, createErrorResponse } from '../utils/subscription-validator.ts';
import { logSystemError } from '../_shared/errorLogger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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

    const body = await req.json().catch(() => ({}));
    const { query } = body;
    if (typeof query !== 'string' || !query.trim()) {
      return createErrorResponse('Query is required', 400);
    }

    // first, load candidate sessions (ids + titles) so we can query the model
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: sessions, error: sessionsError } = await supabase
      .from('chat_sessions')
      .select('id, title')
      .eq('user_id', userId)
      .order('last_message_at', { ascending: false })
      .limit(200); // cap to avoid huge prompts

    if (sessionsError) {
      console.error('ai-chat-session-search error loading sessions', sessionsError);
      return createErrorResponse('Search failed', 500);
    }

    // if no sessions available, return empty
    if (!sessions || sessions.length === 0) {
      return new Response(JSON.stringify({ ids: [] }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // call Gemini to interpret the description and rank sessions
    // build prompt with list of titles
    const titlesList = sessions
      .map((s: any, idx: number) => `${idx + 1}. (${s.id}) ${s.title || 'Untitled'}`)
      .join('\n');

    const { callGeminiJSON } = await import('../utils/gemini.ts');
    const prompt = `You are an assistant that helps users find their chat sessions. ` +
      `The user described what they are looking for: "${query}". ` +
      `Here is a numbered list of the user's chat sessions (id in parentheses):\n${titlesList}\n` +
      `Return a JSON array of session ids (strings) in order of relevance. ` +
      `If none match, return an empty array.`;

    const aiResult = await callGeminiJSON<string[]>(prompt, { maxOutputTokens: 1000 });

    let ids: string[] = [];
    if (aiResult.success && aiResult.data) {
      ids = aiResult.data.filter((id) => typeof id === 'string');
    }

    // fallback to simple title search if AI failed or returned nothing
    if (ids.length === 0) {
      const { data, error } = await supabase
        .from('chat_sessions')
        .select('id')
        .eq('user_id', userId)
        .ilike('title', `%${query}%`)
        .order('last_message_at', { ascending: false })
        .limit(100);

      if (!error && data) {
        ids = data.map((row: any) => row.id);
      }
    }

    return new Response(JSON.stringify({ ids }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (err) {
    logSystemError(createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!), {
      severity: 'error',
      source: 'ai-chat-session-search',
      message: err?.message || String(err),
      details: { stack: err?.stack },
    }).catch(() => {});
    console.error('ai-chat-session-search error:', err);
    return createErrorResponse('Internal server error', 500);
  }
});