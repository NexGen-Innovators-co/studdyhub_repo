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
  console.log('create-social-post function called:', req.method);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting post creation process...');
    
    // Extract user ID from auth header
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    const userId = await extractUserIdFromAuth(req, supabaseUrl, supabaseServiceKey);
    console.log('User ID extracted:', userId);
    
    if (!userId) {
      return createErrorResponse('Unauthorized: Invalid or missing authentication', 401);
    }

    // Initialize validator
    const validator = new SubscriptionValidator(supabaseUrl, supabaseServiceKey);

    // Check subscription for social posting
    const canPost = await validator.canPostSocial(userId);
    console.log('Subscription check result:', canPost);
    
    if (!canPost.allowed) {
      return createErrorResponse(canPost.message || 'Not allowed to post', 403);
    }

    // Parse request body
    const body = await req.json();
    console.log('Request body parsed:', { contentLength: body.content?.length, privacy: body.privacy });
    
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
      console.log('Starting content moderation...');
      
      // Get moderation settings
      const { data: settings } = await supabase
        .from('system_settings')
        .select('*')
        .eq('key', 'content_moderation')
        .single();

      console.log('Moderation settings:', settings ? 'found' : 'not found');

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

      console.log('Moderation enabled:', moderationSettings.enabled);

      if (moderationSettings.enabled) {
        console.log('Starting keyword check...');
        
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

        console.log('Keyword check passed, starting AI analysis...');
        
        // AI-powered educational analysis using direct API
        const geminiApiKey = Deno.env.get('GEMINI_API_KEY') || '';
        const apiUrl = new URL('https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent');
        apiUrl.searchParams.set('key', geminiApiKey);
        
        console.log('Gemini API URL:', apiUrl.toString().replace(geminiApiKey, 'KEY_HIDDEN'));

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

        console.log('Calling Gemini API...');
        const response = await fetch(apiUrl.toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{ text: prompt }]
            }]
          })
        });

        console.log('Gemini API call completed, status:', response.status);

        if (!response.ok) {
          const errorBody = await response.text();
          console.error('Gemini API error:', response.status, response.statusText, errorBody);
          throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
        }

        console.log('Gemini API response status:', response.status);
        const result = await response.json();
        console.log('Gemini API result received, parsing...');
        
        const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
        
        if (!responseText) {
          console.error('Empty response from Gemini API:', JSON.stringify(result));
          throw new Error('Empty response from Gemini API');
        }
        
        console.log('Response text length:', responseText.length);
        let jsonText = responseText.trim();
        if (jsonText.startsWith('```json')) {
          jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        } else if (jsonText.startsWith('```')) {
          jsonText = jsonText.replace(/```\n?/g, '').trim();
        }
        
        console.log('Parsing AI analysis JSON...');
        const aiAnalysis = JSON.parse(jsonText);
        console.log('AI analysis result:', aiAnalysis.isEducational, 'score:', aiAnalysis.educationalValue?.score);
        console.log('AI analysis parsed, isEducational:', aiAnalysis.isEducational);

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
              user_id: userId,
              content: content,
              content_type: 'post',
              reason: 'Multiple rejected posts (5+ in 24 hours)',
              status: 'pending',
              priority: 'high'
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
      console.error('Content moderation error:', moderationError);
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

    // Create the social post (without media_urls - that column doesn't exist)
    const { data: post, error } = await supabase
      .from('social_posts')
      .insert({
        author_id: userId,
        content,
        privacy,
        group_id,
        metadata,
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
