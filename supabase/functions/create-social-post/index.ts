// supabase/functions/create-social-post/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { 
  SubscriptionValidator, 
  createErrorResponse, 
  extractUserIdFromAuth 
} from '../utils/subscription-validator.ts';
import { getEducationContext } from '../_shared/educationContext.ts';
import { logSystemError } from '../_shared/errorLogger.ts';
import { callOpenRouterFallback } from '../_shared/openRouterFallback.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

serve(async (req) => {
  // console.log('create-social-post function called:', req.method);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // console.log('Starting post creation process...');
    
    // Extract config and parse body early so we can accept author_id fallback
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    // Parse request body early so an explicit author_id can be used as a fallback
    const body = await req.json();
    // console.log('Request body parsed (early):', { contentLength: body.content?.length, privacy: body.privacy, author_id_present: !!body.author_id });

    let userId = await extractUserIdFromAuth(req, supabaseUrl, supabaseServiceKey);
    // console.log('User ID extracted from auth:', userId);

    // If no authenticated user but the client provided an explicit author_id, accept it as a fallback
    if (!userId && body && body.author_id) {
      userId = String(body.author_id);
      // console.warn('No auth header present — using provided body.author_id as fallback for author identification. Ensure this is intended.');
    }

    if (!userId) {
      return createErrorResponse('Unauthorized: Invalid or missing authentication', 401);
    }

    // Initialize validator
    const validator = new SubscriptionValidator(supabaseUrl, supabaseServiceKey);

    // Check subscription for social posting
    const canPost = await validator.canPostSocial(userId);
    // console.log('Subscription check result:', canPost);
    
    if (!canPost.allowed) {
      return createErrorResponse(canPost.message || 'Not allowed to post', 403);
    }

    // Body was parsed earlier; reuse it here
    const { content, privacy = 'public', media = [], group_id = null, metadata = null } = body;

    // Validate content
    if (!content || content.trim().length === 0) {
      return createErrorResponse('Post content cannot be empty', 400);
    }

    if (content.length > 5000) {
      return createErrorResponse('Post content is too long (max 5000 characters)', 400);
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ===== CONTENT MODERATION: Check if content is educational =====
    try {
      // console.log('Starting content moderation...');
      
      // Get moderation settings
      const { data: settings } = await supabase
        .from('system_settings')
        .select('*')
        .eq('key', 'content_moderation')
        .single();

      // console.log('Moderation settings:', settings ? 'found' : 'not found');

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
        minEducationalScore: 0.6
      };

      // console.log('Moderation enabled:', moderationSettings.enabled);

      if (moderationSettings.enabled) {
        // console.log('Starting keyword check...');
        
        // Quick keyword check
        const lowerContent = content.toLowerCase();
        const hasBlockedKeywords = moderationSettings.blockedKeywords.some((keyword: string) =>
          lowerContent.includes(keyword.toLowerCase())
        );

        if (hasBlockedKeywords) {
          // Log the rejection
          await supabase.from('content_moderation_log').insert({
            user_id: userId,
            content_preview: content.substring(0, 200),
            content_type: 'post',
            decision: 'rejected',
            reason: 'Content contains blocked keywords or spam-like patterns',
            confidence: 1.0,
            educational_score: 0
          });

          return new Response(JSON.stringify({
            success: false,
            moderation: {
              approved: false,
              reason: 'Content contains spam-like keywords or promotional language',
              suggestions: [
                'Remove promotional or spam-like language',
                'Focus on educational value',
                'Share knowledge or ask genuine questions'
              ]
            }
          }), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          });
        }

        // console.log('Keyword check passed, starting AI analysis...');
        
        // AI-powered educational analysis using direct API
        const geminiApiKey = Deno.env.get('GEMINI_API_KEY') || '';

        const prompt = `You are an educational content moderator for StuddyHub, a learning platform.

Analyze this post and determine if it is educational in nature.

CONTENT TO ANALYZE:
"""
${content}
"""

EVALUATION CRITERIA:
1. Is this content related to learning, education, academics, or skill development?
2. Does it provide educational value (teaching, explaining, asking genuine questions, sharing study resources)?
3. Does it belong to these categories: ${moderationSettings.allowedCategories.join(', ')}
4. Is it free from spam, advertisements, inappropriate content, or off-topic discussions?

STRICTNESS: ${moderationSettings.strictness || 'medium'}

Respond in JSON format:
{
  "isEducational": boolean,
  "confidence": number (0-1),
  "category": string,
  "topics": array of strings,
  "educationalValue": {
    "score": number (0-1),
    "reasoning": string
  },
  "reason": string,
  "suggestions": array of strings
}`;

        // console.log('Calling Gemini API...');

        const MODEL_CHAIN = [
          'gemini-2.5-flash',
          'gemini-2.0-flash',
          'gemini-2.0-flash-lite',
          'gemini-2.5-pro',
          'gemini-3-pro-preview'
        ];

        async function callGeminiWithModelChain(requestBody: any, apiKey: string, maxAttempts = 3): Promise<any> {
          for (let attempt = 0; attempt < Math.min(maxAttempts, MODEL_CHAIN.length); attempt++) {
            const model = MODEL_CHAIN[attempt % MODEL_CHAIN.length];
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            try {
              const resp = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
              });
              if (resp.ok) return await resp.json();
              const txt = await resp.text();
              // console.warn(`Gemini ${model} returned ${resp.status}: ${txt.substring(0,200)}`);
              if (resp.status === 429 || resp.status === 503) await new Promise(r => setTimeout(r, 1000*(attempt+1)));
            } catch (err) {
              // console.error(`Error calling Gemini ${model}:`, err);
              if (attempt < maxAttempts - 1) await new Promise(r => setTimeout(r, 1000*(attempt+1)));
            }
          }
          // OpenRouter fallback
          const orResult = await callOpenRouterFallback(requestBody.contents, { source: 'create-social-post' });
          if (orResult.success && orResult.content) {
            return { candidates: [{ content: { parts: [{ text: orResult.content }] } }] };
          }
          throw new Error('All AI models failed (Gemini + OpenRouter)');
        }

        const result = await callGeminiWithModelChain({ contents: [{ parts: [{ text: prompt }] }] }, geminiApiKey);
        // console.log('Gemini API result received, parsing...');
        
        const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
        
        if (!responseText) {
          // console.error('Empty response from Gemini API:', JSON.stringify(result));
          throw new Error('Empty response from Gemini API');
        }
        
        // console.log('Response text length:', responseText.length);
        let jsonText = responseText.trim();
        if (jsonText.startsWith('```json')) {
          jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        } else if (jsonText.startsWith('```')) {
          jsonText = jsonText.replace(/```\n?/g, '').trim();
        }
        
        // console.log('Parsing AI analysis JSON...');
        const aiAnalysis = JSON.parse(jsonText);
        // console.log('AI analysis result:', aiAnalysis.isEducational, 'score:', aiAnalysis.educationalValue?.score);
        // console.log('AI analysis parsed, isEducational:', aiAnalysis.isEducational);

        const approved = aiAnalysis.isEducational && 
                        aiAnalysis.educationalValue.score >= moderationSettings.minEducationalScore &&
                        aiAnalysis.confidence >= 0.5;

        // Log the moderation decision
        await supabase.from('content_moderation_log').insert({
          user_id: userId,
          content_preview: content.substring(0, 200),
          content_type: 'post',
          decision: approved ? 'approved' : 'rejected',
          reason: approved ? 'Content meets educational standards' : aiAnalysis.reason,
          confidence: aiAnalysis.confidence,
          ai_analysis: aiAnalysis,
          educational_score: aiAnalysis.educationalValue.score,
          category: aiAnalysis.category,
          topics: aiAnalysis.topics
        });

        if (!approved) {
          // Check for repeat offenders
          const { data: recentRejections } = await supabase
            .from('content_moderation_log')
            .select('id')
            .eq('user_id', userId)
            .eq('decision', 'rejected')
            .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

          if (recentRejections && recentRejections.length >= 5) {
            await supabase.from('content_moderation_queue').insert({
              content_id: userId,
              content_type: 'user',
              reason: 'Multiple rejected posts (5+ in 24 hours)',
              status: 'pending',
              priority: 10
            });
          }

          return new Response(JSON.stringify({
            success: false,
            moderation: {
              approved: false,
              isEducational: aiAnalysis.isEducational,
              confidence: aiAnalysis.confidence,
              category: aiAnalysis.category,
              reason: aiAnalysis.reason,
              suggestions: aiAnalysis.suggestions || [],
              topics: aiAnalysis.topics || [],
              educationalValue: aiAnalysis.educationalValue
            }
          }), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          });
        }
      }
    } catch (moderationError) {
      // console.error('Content moderation error:', moderationError);
      // Don't block post creation if moderation fails, just log it
      await supabase.from('content_moderation_log').insert({
        user_id: userId,
        content_preview: content.substring(0, 200),
        content_type: 'post',
        decision: 'error',
        reason: 'Moderation service error',
        confidence: 0
      });
    }
    // ===== END CONTENT MODERATION =====

    // Auto-tag post with author's education context for feed affinity scoring
    let enrichedMetadata = metadata || {};
    try {
      const eduCtx = await getEducationContext(supabase, userId);
      if (eduCtx) {
        enrichedMetadata = {
          ...enrichedMetadata,
          education_context: {
            country: eduCtx.country,
            education_level: eduCtx.educationLevel,
            curriculum: eduCtx.curriculum,
            subjects: eduCtx.subjects,
          },
        };
      }
    } catch { /* non-critical — don't block post creation */ }

    // Create the social post (without media_urls - that column doesn't exist)
    const { data: post, error } = await supabase
      .from('social_posts')
      .insert({
        author_id: userId,
        content,
        privacy,
        group_id,
        metadata: enrichedMetadata,
        created_at: new Date().toISOString(),
        likes_count: 0,
        comments_count: 0
      })
      .select('*')
      .single();

    if (error) {
      // console.error('Error creating post:', error);
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
        // console.error('Error creating media:', mediaError);
        // Don't fail the whole request, just log the error
      }
    }

    // Handle hashtags server-side
    const hashtagRegex = /#(\w+)/g;
    const hashtagMatches = content.match(hashtagRegex);
    if (hashtagMatches && hashtagMatches.length > 0) {
      const tags = [...new Set(hashtagMatches.map((h: string) => h.slice(1).toLowerCase()))];
      for (const tag of tags) {
        try {
          const { data: hashtag } = await supabase
            .from('social_hashtags')
            .upsert({ name: tag }, { onConflict: 'name' })
            .select()
            .single();

          if (hashtag) {
            await supabase.from('social_post_hashtags').insert({
              post_id: post.id,
              hashtag_id: hashtag.id,
              created_at: new Date().toISOString(),
            });
          }
        } catch (_) {
          // Ignore individual hashtag errors
        }
      }
    }

    // Update user's posts count
    const { data: userProfile } = await supabase
      .from('social_users')
      .select('posts_count')
      .eq('id', userId)
      .single();

    if (userProfile) {
      await supabase
        .from('social_users')
        .update({ posts_count: (userProfile.posts_count || 0) + 1 })
        .eq('id', userId);
    }

    // Trigger Notifications (Fire and Forget)
    (async () => {
      try {
        // Fetch author profile for the name
        const { data: author } = await supabase
          .from('social_users')
          .select('display_name')
          .eq('id', userId)
          .single();
        
        const authorName = author?.display_name || 'Someone';
        let recipientIds: string[] = [];
        let title = 'New Post';
        let message = '';
        let type = 'social_post';

        if (group_id) {
          // Group Post Notification
          const { data: members } = await supabase
            .from('social_group_members')
            .select('user_id')
            .eq('group_id', group_id)
            .neq('user_id', userId); // Exclude self
          
          if (members && members.length > 0) {
             recipientIds = members.map(m => m.user_id);
             type = 'group_post';
             
             // Fetch group name
             const { data: group } = await supabase.from('social_groups').select('name').eq('id', group_id).single();
             const groupName = group?.name || 'Group';
             
             title = `New post in ${groupName}`;
             message = `${authorName} posted in ${groupName}`;
          }
        } else if (privacy !== 'private') {
           // Follower Notification
           const { data: followers } = await supabase
             .from('social_follows')
             .select('follower_id')
             .eq('following_id', userId);
             
           if (followers && followers.length > 0) {
             recipientIds = followers.map(f => f.follower_id);
             type = 'social_post';
             title = `New post from ${authorName}`;
             message = `${authorName} shared a new post`;
           }
        }

        if (recipientIds.length > 0) {
          // Batch user_ids to avoid massive requests (optional, but good practice)
          // For now, send all at once as send-notification handles looping
          await supabase.functions.invoke('send-notification', {
            body: {
              user_ids: recipientIds,
              type: type,
              title: title,
              message: message,
              data: {
                post_id: post.id,
                actor_id: userId,
                group_id: group_id,
                url: group_id ? `/social/groups/${group_id}` : `/social/post/${post.id}` 
              }
            }
          });
        }
      } catch (err) {
        // console.error('Error triggering notifications:', err);
      }
    })();

    // Fire-and-forget: AI categorize the post for personalized feed ranking
    (async () => {
      try {
        await supabase.functions.invoke('ai-categorize-post', {
          body: { postId: post.id, content: post.content },
        });
      } catch (err) {
        // AI categorization is non-blocking, failures are silent
      }
    })();

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
    // ── Log to system_error_logs ──
    try {
      const _logClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      await logSystemError(_logClient, {
        severity: 'error',
        source: 'create-social-post',
        message: error?.message || String(error),
        details: { stack: error?.stack },
      });
    } catch (_logErr) { console.error('[create-social-post] Error logging failed:', _logErr); }
    // console.error('Error in create-social-post:', error);
    return createErrorResponse('Internal server error', 500);
  }
});

