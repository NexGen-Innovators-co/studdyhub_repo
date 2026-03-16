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

const MODERATION_CONFIG = {
  RETRY_ATTEMPTS: 3,
  BACKOFF_MS: 1000
};

function sleep(ms: number): Promise<void> {
  const jitter = Math.random() * 500;
  return new Promise((resolve) => setTimeout(resolve, ms + jitter));
}

serve(async (req) => {
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    // ===== CONTENT MODERATION: Quick keyword check only (AI runs async) =====
    try {
      // Quick keyword check
      const blockedKeywords = ['spam', 'advertisement', 'buy now', 'click here'];
      const lowerContent = content.toLowerCase();
      const hasBlockedKeywords = blockedKeywords.some(keyword =>
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
      
    } catch (moderationError) {
      console.error('[create-social-post] Moderation keyword check error:', moderationError);
      // Don't block post creation on keyword check errors
    }
    
    // ===== AI MODERATION: Run async in background (non-blocking) =====
    // Fire-and-forget: Run AI analysis after post is created
    (async () => {
    let moderationApproved = true;
    let moderationReason = 'No moderation checks enabled';
    
      try {
        const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
        const openRouterApiKey = Deno.env.get('OPENROUTER_API_KEY');
        
        if (!geminiApiKey) {
          await supabase.from('content_moderation_log').insert({
            user_id: userId,
            content_preview: content.substring(0, 200),
            content_type: 'post',
            decision: 'pending_review',
            reason: 'No AI API key configured',
            confidence: 0
          });
          return;
        }
        
        
        const prompt = `You are an educational content moderator for StuddyHub.
Analyze if this post is educational in nature.

Post content: "${content.substring(0, 500)}"

Respond with ONLY valid JSON (no markdown, no code blocks):
{"isEducational": boolean, "confidence": number, "reason": "string"}`;

        const MODEL_CHAIN = ['gemini-2.5-flash', 'gemini-3-pro-preview', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'];
        let moderationSuccess = false;
        let lastGeminiError = '';

        // === GEMINI RETRY LOOP ===
        for (let attempt = 0; attempt < MODERATION_CONFIG.RETRY_ATTEMPTS; attempt++) {
          if (moderationSuccess) break;
          
          const currentModel = MODEL_CHAIN[attempt % MODEL_CHAIN.length];
          console.log(`[AI-MOD] Attempt ${attempt + 1}/${MODERATION_CONFIG.RETRY_ATTEMPTS} using ${currentModel}`);
          
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${geminiApiKey}`;
          
          try {
            const requestBody = {
              contents: [{ 
                role: 'user',
                parts: [{ text: prompt }] 
              }],
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 1024,
                topK: 40,
                topP: 0.95
              }
            };
            
            const resp = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(requestBody)
            });
            
            if (resp.ok) {
              const result = await resp.json();
              const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text;
              
              if (responseText) {
                let jsonString = responseText.trim();
                if (jsonString.includes('```')) {
                  jsonString = jsonString.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                }
                
                try {
                  const analysis = JSON.parse(jsonString);
                  console.log(`[AI-MOD] Success with ${currentModel}: isEducational=${analysis.isEducational}`);
                  
                  await supabase.from('content_moderation_log').insert({
                    user_id: userId,
                    content_preview: content.substring(0, 200),
                    content_type: 'post',
                    decision: analysis.isEducational ? 'approved' : 'pending_review',
                    reason: analysis.reason || 'AI analysis complete',
                    confidence: analysis.confidence || 0.5,
                    educational_score: analysis.isEducational ? 0.8 : 0.3
                  });
                  moderationSuccess = true;
                } catch (parseErr) {
                  lastGeminiError = `${currentModel}: JSON parse error`;
                  console.log(`[AI-MOD] Parse error: ${parseErr}`);
                }
              } else {
                lastGeminiError = `${currentModel}: No response text`;
                console.log(`[AI-MOD] ${lastGeminiError}`);
              }
            } else {
              const errorText = await resp.text();
              const status = resp.status;
              lastGeminiError = `${currentModel}: HTTP ${status}`;
              console.error(`[AI-MOD] Error ${status} with ${currentModel}: ${errorText.substring(0, 200)}`);
              
              logSystemError(supabase, {
                severity: 'error',
                source: 'create-social-post',
                component: 'moderation-gemini',
                error_code: `GEMINI_HTTP_${status}`,
                message: `Gemini ${currentModel} returned HTTP ${status}`,
                details: { model: currentModel, status, attempt, errorSnippet: errorText.substring(0, 500) }
              });
              
              // Handle rate limiting: backoff and retry
              if ((status === 429 || status === 503) && attempt < MODERATION_CONFIG.RETRY_ATTEMPTS - 1) {
                console.warn(`[AI-MOD] Rate limit/overload for ${currentModel}. Backing off...`);
                await sleep(MODERATION_CONFIG.BACKOFF_MS * (attempt + 1));
                continue;
              }
              
              // Bad request: don't retry
              if (status === 400) {
                console.error(`[AI-MOD] Bad request to ${currentModel}. Not retrying.`);
                break;
              }
            }
          } catch (err) {
            lastGeminiError = `${currentModel}: ${String(err)}`;
            console.error(`[AI-MOD] Network error with ${currentModel}:`, err);
            
            logSystemError(supabase, {
              severity: 'error',
              source: 'create-social-post',
              component: 'moderation-gemini',
              error_code: 'GEMINI_NETWORK_ERROR',
              message: `Gemini ${currentModel} network error: ${String(err)}`,
              details: { model: currentModel, attempt, error: String(err) }
            });
            
            if (attempt < MODERATION_CONFIG.RETRY_ATTEMPTS - 1) {
              await sleep(MODERATION_CONFIG.BACKOFF_MS * (attempt + 1));
            }
          }
        }
        
        // === OPENROUTER FALLBACK ===
        if (!moderationSuccess && openRouterApiKey) {
          console.log('[AI-MOD] All Gemini attempts failed. Trying OpenRouter fallback...');
          try {
            const orResp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${openRouterApiKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                model: 'openrouter/free',
                messages: [
                  {
                    role: 'user',
                    content: prompt
                  }
                ],
                max_tokens: 1024,
                temperature: 0.7,
                top_p: 0.95
              })
            });
            
            if (orResp.ok) {
              const orData = await orResp.json();
              const orContent = orData.choices?.[0]?.message?.content;
              
              if (orContent) {
                let jsonString = orContent.trim();
                if (jsonString.includes('```')) {
                  jsonString = jsonString.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                }
                
                try {
                  const analysis = JSON.parse(jsonString);
                  console.log('[AI-MOD] OpenRouter fallback succeeded');
                  
                  await supabase.from('content_moderation_log').insert({
                    user_id: userId,
                    content_preview: content.substring(0, 200),
                    content_type: 'post',
                    decision: analysis.isEducational ? 'approved' : 'pending_review',
                    reason: (analysis.reason || 'AI analysis complete') + ' [OpenRouter]',
                    confidence: analysis.confidence || 0.5,
                    educational_score: analysis.isEducational ? 0.8 : 0.3
                  });
                  moderationSuccess = true;
                } catch (oParseErr) {
                  console.log('[AI-MOD] OpenRouter parse error:', oParseErr);
                }
              }
            } else {
              const orErr = await orResp.text();
              console.error('[AI-MOD] OpenRouter error:', orResp.status, orErr.substring(0, 200));
            }
          } catch (orNetErr) {
            console.error('[AI-MOD] OpenRouter network error:', orNetErr);
          }
        }
        
        // If all attempts failed, log it
        if (!moderationSuccess) {
          console.log(`[AI-MOD] All moderation attempts failed. Last error: ${lastGeminiError}`);
          await supabase.from('content_moderation_log').insert({
            user_id: userId,
            content_preview: content.substring(0, 200),
            content_type: 'post',
            decision: 'pending_review',
            reason: `AI analysis failed: ${lastGeminiError}`,
            confidence: 0
          });
        }
      } catch (aiErr) {
        console.error('[AI-MOD] Background AI moderation error:', aiErr);
        console.log(`[AI-MOD] Error details: ${JSON.stringify(aiErr)}`);
      }
    })();
    // ===== END ASYNC AI MODERATION =====

    // Auto-tag post with author's education context for feed affinity scoring
    let enrichedMetadata = metadata || {};
    try {
      // Add timeout for education context (takes too long, skip if it hangs)
      const contextPromise = getEducationContext(supabase, userId);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Education context timeout')), 1500)
      );
      
      try {
        const eduCtx = await Promise.race([contextPromise, timeoutPromise]) as any;
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
      } catch (_ctxErr) {
        // Context fetch timeout or error - skip, non-critical
      }
    } catch { /* non-critical — don't block post creation */ }

    // Create the social post (without media_urls - that column doesn't exist)
    let post;
    try {
      console.log('[create-social-post] Inserting post to social_posts table');
      const { data: insertedPost, error } = await supabase
        .from('social_posts')
        .insert({
          author_id: userId,
          content,
          privacy: privacy || 'public',
          group_id: group_id || null,
          metadata: enrichedMetadata || null,
          created_at: new Date().toISOString(),
          likes_count: 0,
          comments_count: 0,
          bookmarks_count: 0,
          shares_count: 0,
          views_count: 0,
          ai_categories: null,
          ai_quality_score: null,
          ai_sentiment: null
        })
        .select('*')
        .single();

      if (error) {
        console.error('[create-social-post] Post insert error:', error);
        return createErrorResponse('Failed to create post: ' + (error?.message || 'Unknown error'), 500);
      }
      
      if (!insertedPost) {
        console.error('[create-social-post] Post insert returned no data');
        return createErrorResponse('Failed to create post: No post data returned', 500);
      }
      
      post = insertedPost;
      console.log('[create-social-post] Post created successfully:', post.id);
    } catch (postErr) {
      console.error('[create-social-post] Unexpected error during post creation:', postErr);
      return createErrorResponse('Internal error creating post', 500);
    }
    

    // Insert media records into social_media table
    if (media && media.length > 0) {
      try {
        console.log('[create-social-post] Inserting', media.length, 'media records');
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
          console.error('[create-social-post] Media insertion warning:', mediaError);
        } else {
          console.log('[create-social-post] Media inserted successfully');
        }
      } catch (mediaErr) {
        console.error('[create-social-post] Error during media insertion:', mediaErr);
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

    console.log('[create-social-post] All steps completed successfully. Returning post:', post.id);
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
    console.error('[create-social-post] Unhandled error:', error);
    try {
      const _logClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      
      const errorDetails: Record<string, any> = {
        message: error?.message || String(error),
        stack: error?.stack || '',
        type: error?.constructor?.name || 'Unknown',
        timestamp: new Date().toISOString()
      };
      
      // Try to extract more details if it's an error object
      if (error instanceof Error) {
        errorDetails.name = error.name;
        errorDetails.message = error.message;
      }
      
      await logSystemError(_logClient, {
        severity: 'error',
        source: 'create-social-post',
        error_code: 'POST_CREATION_FAILED',
        message: `Post creation failed: ${error?.message || String(error)}`,
        details: errorDetails,
      });
    } catch (_logErr) { 
      console.error('[create-social-post] Error logging failed:', _logErr); 
    }
    return createErrorResponse('Internal server error', 500);
  }
});



