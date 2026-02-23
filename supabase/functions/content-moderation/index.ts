import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { logSystemError } from '../_shared/errorLogger.ts';
import { callOpenRouterFallback } from '../_shared/openRouterFallback.ts';

// Model fallback chain for quota/rate-limit resilience
const MODEL_CHAIN = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-2.5-pro',
  'gemini-3-pro-preview',
];

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ModerationRequest {
  content: string;
  contentType: 'post' | 'comment' | 'document';
  userId: string;
  strictness?: 'low' | 'medium' | 'high';
}

interface ModerationResult {
  approved: boolean;
  isEducational: boolean;
  confidence: number;
  category?: string;
  reason?: string;
  suggestions?: string[];
  topics?: string[];
  educationalValue: {
    score: number;
    reasoning: string;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify authentication
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { content, contentType, userId, strictness = 'medium' }: ModerationRequest = await req.json();

    if (!content || !contentType) {
      throw new Error('Content and contentType are required');
    }

    // Initialize Gemini AI with model chain fallback
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GEMINI_API_KEY_VERTEX');
    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    // Fetch system settings for moderation
    const { data: settings } = await supabase
      .from('system_settings')
      .select('*')
      .eq('key', 'content_moderation')
      .single();

    const moderationSettings = settings?.value || {
      enabled: true,
      strictness: 'medium',
      allowedCategories: [
        'Science', 'Mathematics', 'Technology', 'Engineering',
        'History', 'Literature', 'Language Learning', 'Arts',
        'Business', 'Economics', 'Health', 'Medicine',
        'Philosophy', 'Psychology', 'Social Sciences',
        'Study Tips', 'Exam Preparation', 'Career Guidance'
      ],
      blockedKeywords: ['spam', 'advertisement', 'buy now', 'click here'],
      minEducationalScore: strictness === 'high' ? 0.8 : strictness === 'medium' ? 0.6 : 0.4
    };

    // Check for blocked keywords first
    const lowerContent = content.toLowerCase();
    const hasBlockedKeywords = moderationSettings.blockedKeywords.some((keyword: string) =>
      lowerContent.includes(keyword.toLowerCase())
    );

    if (hasBlockedKeywords) {
      const result: ModerationResult = {
        approved: false,
        isEducational: false,
        confidence: 1.0,
        reason: 'Content contains blocked keywords or spam-like patterns',
        suggestions: [
          'Remove promotional or spam-like language',
          'Focus on educational value',
          'Share knowledge or ask genuine questions'
        ],
        educationalValue: {
          score: 0,
          reasoning: 'Content flagged for spam-like keywords'
        }
      };

      // Log the moderation decision
      await supabase.from('content_moderation_log').insert({
        user_id: userId,
        content_preview: content.substring(0, 200),
        content_type: contentType,
        decision: 'rejected',
        reason: result.reason,
        confidence: result.confidence,
        ai_analysis: result
      });

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // AI-powered educational content analysis
    const prompt = `You are an educational content moderator for StuddyHub, a learning platform.

Analyze the following ${contentType} and determine if it is educational in nature.

CONTENT TO ANALYZE:
"""
${content}
"""

EVALUATION CRITERIA:
1. Is this content related to learning, education, academics, or skill development?
2. Does it provide educational value (teaching, explaining, asking genuine questions, sharing study resources)?
3. Does it belong to these categories: ${moderationSettings.allowedCategories.join(', ')}
4. Is it free from spam, advertisements, inappropriate content, or off-topic discussions?

STRICTNESS LEVEL: ${strictness}
- low: Allow broadly educational content including casual study discussions
- medium: Require clear educational intent and value
- high: Only allow highly focused academic and educational content

Respond in JSON format:
{
  "isEducational": boolean,
  "confidence": number (0-1),
  "category": string (one of the allowed categories or "Other"),
  "topics": array of strings (specific topics covered),
  "educationalValue": {
    "score": number (0-1),
    "reasoning": string (explain why educational or not)
  },
  "reason": string (brief explanation),
  "suggestions": array of strings (how to improve if rejected)
}

Be encouraging but maintain quality standards. For borderline cases at medium strictness, give benefit of doubt to educational intent.`;

    // Call Gemini with model chain fallback
    let responseText = '';
    const requestBody = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 2048, topK: 40, topP: 0.95 },
    };

    for (let attempt = 0; attempt < MODEL_CHAIN.length; attempt++) {
      const currentModel = MODEL_CHAIN[attempt];
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${geminiApiKey}`;

      try {
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        if (resp.status === 429 || resp.status === 503) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }

        if (!resp.ok) continue;

        const data = await resp.json();
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (content) {
          responseText = content;
          break;
        }
      } catch (err) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
    }

    if (!responseText) {
      // OpenRouter fallback
      const orResult = await callOpenRouterFallback(requestBody.contents, { source: 'content-moderation' });
      if (orResult.success && orResult.content) {
        responseText = orResult.content;
      } else {
        throw new Error('All AI models failed (Gemini + OpenRouter)');
      }
    }
    
    // Extract JSON from markdown code blocks if present
    let jsonText = responseText.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/g, '').trim();
    }
    
    const aiAnalysis = JSON.parse(jsonText);

    // Determine if content should be approved
    const minScore = moderationSettings.minEducationalScore;
    const approved = aiAnalysis.isEducational && 
                    aiAnalysis.educationalValue.score >= minScore &&
                    aiAnalysis.confidence >= 0.5;

    const moderationResult: ModerationResult = {
      approved,
      isEducational: aiAnalysis.isEducational,
      confidence: aiAnalysis.confidence,
      category: aiAnalysis.category,
      reason: approved 
        ? 'Content meets educational standards'
        : aiAnalysis.reason || 'Content does not meet educational standards',
      suggestions: aiAnalysis.suggestions || [],
      topics: aiAnalysis.topics || [],
      educationalValue: aiAnalysis.educationalValue
    };

    // Log the moderation decision
    await supabase.from('content_moderation_log').insert({
      user_id: userId,
      content_preview: content.substring(0, 200),
      content_type: contentType,
      decision: approved ? 'approved' : 'rejected',
      reason: moderationResult.reason,
      confidence: moderationResult.confidence,
      ai_analysis: moderationResult,
      educational_score: aiAnalysis.educationalValue.score,
      category: aiAnalysis.category,
      topics: aiAnalysis.topics
    });

    // Track user's moderation history for repeat offenders
    if (!approved) {
      const { data: recentRejections } = await supabase
        .from('content_moderation_log')
        .select('id')
        .eq('user_id', userId)
        .eq('decision', 'rejected')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if (recentRejections && recentRejections.length >= 5) {
        // Flag user for admin review
        await supabase.from('content_moderation_queue').insert({
          content_id: userId,
          content_type: 'user',
          reason: `Multiple rejected posts (5+ in 24 hours). Last content type: ${contentType}`,
          status: 'pending',
          priority: 10
        });
      }
    }

    return new Response(JSON.stringify(moderationResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error: any) {
    // ── Log to system_error_logs ──
    try {
      const _logClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      await logSystemError(_logClient, {
        severity: 'error',
        source: 'content-moderation',
        message: error?.message || String(error),
        details: { stack: error?.stack },
      });
    } catch (_logErr) { console.error('[content-moderation] Error logging failed:', _logErr); }
    // console.error('Content moderation error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      approved: false,
      reason: 'Moderation service error'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});

