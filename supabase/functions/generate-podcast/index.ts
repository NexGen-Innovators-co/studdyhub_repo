import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PodcastRequest {
  noteIds?: string[];
  documentIds?: string[];
  style?: 'casual' | 'educational' | 'deep-dive';
  duration?: 'short' | 'medium' | 'long'; // 5min, 15min, 30min
  podcastType?: 'audio' | 'image-audio' | 'video' | 'live-stream';
  cover_image_url?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY")!;
    const gcpServiceAccountJson = Deno.env.get("GCP_SERVICE_ACCOUNT_JSON");
    const gcpProjectId = "gen-lang-client-0612038711";

    // Helper function to get OAuth 2.0 access token from service account
    async function getAccessToken(): Promise<string | null> {
      if (!gcpServiceAccountJson) {
        console.error("[OAuth] GCP_SERVICE_ACCOUNT_JSON not configured");
        return null;
      }

      try {
        console.log("[OAuth] Service account JSON length:", gcpServiceAccountJson.length);

        let cleanedJson = gcpServiceAccountJson.trim();
        if (cleanedJson.startsWith('"') && cleanedJson.endsWith('"')) {
          cleanedJson = cleanedJson.slice(1, -1);
        }
        cleanedJson = cleanedJson.replace(/\\"/g, '"');

        const serviceAccount = JSON.parse(cleanedJson);

        const header = { alg: "RS256", typ: "JWT" };
        const now = Math.floor(Date.now() / 1000);
        const payload = {
          iss: serviceAccount.client_email,
          scope: "https://www.googleapis.com/auth/cloud-platform",
          aud: "https://oauth2.googleapis.com/token",
          exp: now + 3600,
          iat: now
        };

        const base64url = (str: string) =>
          btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

        const encodedHeader = base64url(JSON.stringify(header));
        const encodedPayload = base64url(JSON.stringify(payload));
        const unsignedToken = `${encodedHeader}.${encodedPayload}`;

        const privateKey = serviceAccount.private_key
          .replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\n/g, '');

        const binaryKey = Uint8Array.from(atob(privateKey), c => c.charCodeAt(0));

        const cryptoKey = await crypto.subtle.importKey(
          "pkcs8",
          binaryKey,
          { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
          false,
          ["sign"]
        );

        const encoder = new TextEncoder();
        const signature = await crypto.subtle.sign(
          "RSASSA-PKCS1-v1_5",
          cryptoKey,
          encoder.encode(unsignedToken)
        );

        const encodedSignature = base64url(
          String.fromCharCode(...new Uint8Array(signature))
        );

        const jwt = `${unsignedToken}.${encodedSignature}`;

        const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
            assertion: jwt
          })
        });

        if (tokenResponse.ok) {
          const tokenData = await tokenResponse.json();
          return tokenData.access_token;
        } else {
          console.error("[OAuth] Token fetch failed:", await tokenResponse.text());
          return null;
        }
      } catch (error) {
        console.error("[OAuth] Error getting access token:", error);
        return null;
      }
    }

    const accessToken = await getAccessToken();
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    // Parse request body with error handling
    let body: PodcastRequest;
    try {
      body = await req.json();
    } catch (e) {
      console.error("[Podcast] JSON parse error:", e);
      throw new Error("Invalid request body - expected JSON");
    }

    const {
      noteIds = [],
      documentIds = [],
      style = 'educational',
      duration = 'medium',
      podcastType = 'audio',
      cover_image_url: providedCoverImageUrl
    } = body;

    // 1. Fetch content from notes and documents
    let content = "";
    let sources: string[] = [];

    if (noteIds.length > 0) {
      const { data: notes } = await supabase
        .from("notes")
        .select("title, content")
        .in("id", noteIds)
        .eq("user_id", user.id);

      if (notes) {
        notes.forEach(note => {
          content += `\n\n# ${note.title}\n${note.content || ''}`;
          sources.push(note.title);
        });
      }
    }

    if (documentIds.length > 0) {
      const { data: documents } = await supabase
        .from("documents")
        .select("title, content_extracted")
        .in("id", documentIds)
        .eq("user_id", user.id);

      if (documents) {
        documents.forEach(doc => {
          content += `\n\n# ${doc.title}\n${doc.content_extracted || ''}`;
          sources.push(doc.title);
        });
      }
    }

    // If no content provided, fetch user's recent notes
    if (!content.trim()) {
      const { data: recentNotes } = await supabase
        .from("notes")
        .select("title, content")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(5);

      if (recentNotes && recentNotes.length > 0) {
        recentNotes.forEach(note => {
          content += `\n\n# ${note.title}\n${note.content || ''}`;
          sources.push(note.title);
        });
      } else {
        throw new Error("No content available. Please create some notes first or select specific content.");
      }
    }

    // 2. Generate podcast script using Gemini

    const scriptPrompt = generateScriptPrompt(content, sources, style, duration);

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: scriptPrompt }]
          }],
          generationConfig: {
            temperature: 0.9,
            maxOutputTokens: 8000,
          }
        })
      }
    );

    const geminiData = await geminiResponse.json();

    // Validate Gemini response structure
    if (!geminiData || !geminiData.candidates || geminiData.candidates.length === 0) {
      console.error("[Podcast] Invalid script generation response:", JSON.stringify(geminiData));
      throw new Error("Failed to generate podcast script - invalid API response");
    }

    const candidate = geminiData.candidates[0];
    if (!candidate || !candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
      console.error("[Podcast] Invalid script candidate structure:", JSON.stringify(candidate));
      throw new Error("Failed to generate podcast script - invalid response structure");
    }

    const script = candidate.content.parts[0].text || "";

    if (!script) {
      throw new Error("Failed to generate podcast script");
    }

    // 2.5. Generate an engaging title for the podcast
    let podcastTitle = `Podcast: ${sources.join(", ")}`; // Fallback title
    try {
      const titlePrompt = `Based on this podcast script, generate a catchy, engaging title (maximum 60 characters). The title should capture the main topic and be interesting to listeners. Return ONLY the title text, nothing else.

Script excerpt:
${script.substring(0, 1500)}

Title:`;

      const titleResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: titlePrompt }] }],
            generationConfig: {
              temperature: 0.8,
              maxOutputTokens: 100
            }
          })
        }
      );

      if (titleResponse.ok) {
        const titleData = await titleResponse.json();
        const generatedTitle = titleData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (generatedTitle && generatedTitle.length > 0 && generatedTitle.length <= 100) {
          // Remove quotes if present
          podcastTitle = generatedTitle.replace(/^["']|["']$/g, '');
          console.log(`[Podcast] Generated title: ${podcastTitle}`);
        }
      }
    } catch (titleError) {
      console.error("[Podcast] Title generation error:", titleError);
      // Keep fallback title
    }

    // 3. Parse script into segments (Host A and Host B)
    const segments = parseScript(script);

    // 4. Generate audio for each segment using Google TTS
    const audioSegments = await Promise.all(
      segments.map(async (segment, index) => {
        const voice = segment.speaker === 'Thomas' ? 'en-US-Neural2-D' : 'en-US-Neural2-C';

        // Clean the text: remove stage directions and action indicators
        let cleanedText = segment.text
          .replace(/\[laughs?\]/gi, '') // Remove [laugh] or [laughs]
          .replace(/\[pause\]/gi, '') // Remove [pause]
          .replace(/\[.*?\]/g, '') // Remove any other [actions]
          .replace(/\*.*?\*/g, '') // Remove *emphasis* markers
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim();

        // If text is empty after cleaning, skip it
        if (!cleanedText) {
          return null;
        }

        const ttsResponse = await fetch(
          `https://texttospeech.googleapis.com/v1/text:synthesize?key=${geminiApiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              input: { text: cleanedText }, // Use cleaned text
              voice: {
                languageCode: "en-US",
                name: voice,
              },
              audioConfig: {
                audioEncoding: "MP3",
                speakingRate: 1.0,
                pitch: 0,
              }
            })
          }
        );

        if (!ttsResponse.ok) {
          const errorText = await ttsResponse.text();
          console.error(`[Podcast] TTS API error for segment ${index}:`, ttsResponse.status, errorText);
          throw new Error(`TTS API failed: ${ttsResponse.status} - ${errorText}`);
        }

        const ttsData = await ttsResponse.json();

        if (!ttsData.audioContent) {
          throw new Error(`TTS response missing audioContent for segment ${index}`);
        }

        return {
          speaker: segment.speaker,
          audioContent: ttsData.audioContent,
          text: cleanedText, // Store the cleaned text
          index
        };
      })
    );

    // Filter out null segments (empty after cleaning)
    const validAudioSegments = audioSegments.filter(segment => segment !== null);

    // 4.5. Generate images for visual podcast types
    let visualAssets: any[] = [];
    let coverImageUrl = providedCoverImageUrl || '';

    if (!coverImageUrl && (podcastType === 'image-audio' || podcastType === 'video' || podcastType === 'live-stream')) {
      // Generate a cover image for the podcast (use first concept or a summary prompt)
      try {
        let coverPrompt = '';
        if (visualAssets.length > 0 && visualAssets[0].description) {
          coverPrompt = visualAssets[0].description;
        } else {
          coverPrompt = `A vibrant, professional educational podcast cover about ${sources.join(", ") || 'the topic'}, modern design, clean typography, bright gradients, engaging, 3D rendered style, cinematic composition`;
        }
        const coverRes = await fetch(`${supabaseUrl}/functions/v1/generate-image-from-text`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseKey}`
          },
          body: JSON.stringify({ description: coverPrompt, userId: user.id })
        });
        if (coverRes.ok) {
          const coverData = await coverRes.json();
          coverImageUrl = coverData.imageUrl;
        } else {
          console.error('[Podcast] Cover image upload error:', await coverRes.text());
        }
      } catch (coverError) {
        console.error('[Podcast] Cover image generation exception:', coverError);
      }

      try {
        // Extract key concepts for image generation (3-5 images per podcast)
        const conceptPrompt = `Based on this podcast content, extract 3-5 key visual concepts that would make compelling images. Return ONLY a JSON array of objects with "concept" and "description" fields.

Content summary:
${script.substring(0, 2000)}

Format: [{"concept": "brief title", "description": "detailed visual description for image generation"}]`;

        const conceptResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: conceptPrompt }] }],
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 10048  // Increased from 1000 to prevent MAX_TOKENS errors
              }
            })
          }
        );

        if (!conceptResponse.ok) {
          throw new Error(`Concept extraction failed: ${conceptResponse.status}`);
        }

        const conceptData = await conceptResponse.json();

        // Check for MAX_TOKENS or empty response
        const candidate = conceptData.candidates?.[0];
        const finishReason = candidate?.finishReason;

        if (finishReason === "MAX_TOKENS" || !candidate?.content?.parts?.[0]?.text) {
          console.error("[Podcast] Concept extraction hit token limit or returned empty content:", JSON.stringify(conceptData));
          console.log("[Podcast] Using fallback concepts due to API limitation");
          // Use fallback - will be handled by the catch block below
          throw new Error("Failed to extract concepts - response truncated or empty");
        }

        const conceptText = conceptData.candidates[0].content.parts[0].text;
        let concepts: Array<{ concept: string, description: string }> = [];
        try {
          const jsonMatch = conceptText.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            concepts = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error("No JSON array found in response");
          }
        } catch (e) {
          console.error("[Podcast] Failed to parse concepts:", e);
          concepts = [{
            concept: "Main Topic",
            description: `A professional educational illustration about ${sources.join(", ")}, featuring modern design elements, clean typography, and vibrant colors`
          }];
        }

        // For each concept, find the most relevant segment (by simple keyword match)
        function findRelevantSegmentIndex(concept: string, segments: Array<{ speaker: string; text: string }>): number {
          const lowerConcept = concept.toLowerCase();
          let bestIndex = 0;
          let bestScore = 0;
          for (let i = 0; i < segments.length; i++) {
            const segText = segments[i].text.toLowerCase();
            // Score: count of concept words present in segment
            let score = 0;
            for (const word of lowerConcept.split(/\s+/)) {
              if (segText.includes(word)) score++;
            }
            if (score > bestScore) {
              bestScore = score;
              bestIndex = i;
            }
          }
          return bestIndex;
        }

        // Use the generate-image-from-text edge function to upload and get a public URL for each image
        for (let i = 0; i < concepts.length; i++) {
          const concept = concepts[i];
          let description = (typeof concept.description === 'string' && concept.description.trim())
            ? concept.description.trim()
            : `${concept.concept || sources.join(", ") || 'the topic'}`;

          description = `${description}. `;

          let imageUrl = "";
          try {
            const imageRes = await fetch(`${supabaseUrl}/functions/v1/generate-image-from-text`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${supabaseKey}`
              },
              body: JSON.stringify({ description: description, userId: user.id })
            });
            if (imageRes.ok) {
              const imageData = await imageRes.json();
              imageUrl = imageData.imageUrl;
            } else {
              console.error(`[Podcast] Image upload error:`, await imageRes.text());
            }
          } catch (error) {
            console.error(`[Podcast] Image upload exception:`, error);
          }

          // Find the most relevant segment for this concept
          const segmentIndex = findRelevantSegmentIndex(concept.concept, segments);

          visualAssets.push({
            type: 'image',
            concept: concept.concept,
            description,
            url: imageUrl || `https://placehold.co/1792x1024/6366f1/white?text=${encodeURIComponent(concept.concept)}`,
            segmentIndex,
            timestamp: null // will be set in UI based on segmentIndex
          });
        }

        console.log(`[Podcast] Generated ${visualAssets.length} visual assets`);

        // For video podcast type, generate video clips using Veo 3
        if (podcastType === 'video' && visualAssets.length > 0 && accessToken) {
          console.log(`[Podcast] Generating video clips with Veo 3...`);

          try {
            // Generate maximum 2 videos to avoid timeout (each takes ~8-10 seconds)
            for (let i = 0; i < Math.min(concepts.length, 2); i++) {
              const concept = concepts[i];
              const videoPrompt = `Professional educational video: ${concept.description}. Modern design, clean typography, smooth animations. Educational style.`;

              // Replace this line in your code:
              const veoResponse = await fetch(
                `https://us-central1-aiplatform.googleapis.com/v1/projects/${gcpProjectId}/locations/us-central1/publishers/google/models/veo-3.1-fast-preview:predict`,
                // Changed from veo-3.0-generate-001 to veo-3.1-fast-preview
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${accessToken}`
                  },
                  body: JSON.stringify({
                    instances: [{
                      text_prompt: {
                        prompt: videoPrompt
                      }
                    }],
                    parameters: {
                      response_count: 1,
                      duration: 4  // 4 seconds for faster generation
                    }
                  })
                }
              );

              if (veoResponse.ok) {
                const veoData = await veoResponse.json();
                console.log(`[Podcast] Veo response:`, JSON.stringify(veoData).substring(0, 200));

                // Check if this is a long-running operation
                if (veoData.name && veoData.name.includes('operations')) {
                  console.log(`[Podcast] Veo returned operation ID: ${veoData.name} - skipping (long-running)`);
                } else if (veoData.predictions && veoData.predictions[0]) {
                  const prediction = veoData.predictions[0];
                  const videoBase64 = prediction.bytesBase64Encoded ||
                    prediction.video_bytes ||
                    prediction.generatedVideo?.bytesBase64Encoded;

                  if (videoBase64) {
                    visualAssets.push({
                      type: 'video',
                      concept: concept.concept,
                      description: concept.description,
                      url: `data:video/mp4;base64,${videoBase64}`,
                      timestamp: Math.floor((i / Math.min(concepts.length, 2)) * estimateDuration(segments) * 60)
                    });
                    console.log(`[Podcast] Generated video ${i + 1}`);
                  } else {
                    console.log(`[Podcast] No video bytes in prediction:`, Object.keys(prediction));
                  }
                }
              } else {
                const errorText = await veoResponse.text();
                console.error(`[Podcast] Veo error (${veoResponse.status}):`, errorText);
              }
            }
          } catch (error) {
            console.error("[Podcast] Video generation error:", error);
          }
        }

      } catch (visualError) {
        console.error("[Podcast] Visual asset generation error:", visualError);
      }
    }

    // 5. Save podcast to database
    const optimizedVisualAssets = visualAssets.length > 0 ? visualAssets.map(asset => {
      if (asset.url.startsWith('data:')) {
        return {
          type: asset.type,
          concept: asset.concept,
          description: asset.description,
          url: `https://placehold.co/1792x1024/6366f1/white?text=${encodeURIComponent(asset.concept)}`,
          timestamp: asset.timestamp,
          generated: true
        };
      }
      return asset;
    }) : null;

    const { data: podcast, error: insertError } = await supabase
      .from("ai_podcasts")
      .insert({
        user_id: user.id,
        title: podcastTitle,
        sources: sources,
        script: script,
        audio_segments: validAudioSegments,
        duration_minutes: estimateDuration(segments),
        style: style,
        podcast_type: podcastType,
        visual_assets: optimizedVisualAssets,
        cover_image_url: coverImageUrl,
        status: "completed"
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    console.log(`[Podcast] Saved podcast: ${podcast.id}`);
    console.log(`[Podcast] Generated ${visualAssets.length} visual assets`);

    return new Response(
      JSON.stringify({
        success: true,
        podcast
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error: any) {
    console.error("[Podcast] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function generateScriptPrompt(content: string, sources: string[], style: string, duration: string): string {
  const durationMap = {
    'short': '5-7 minutes',
    'medium': '12-15 minutes',
    'long': '25-30 minutes'
  };

  const styleMap = {
    'casual': 'friendly and conversational, like two friends discussing interesting topics over coffee',
    'educational': 'informative and engaging, like experienced educators breaking down complex concepts',
    'deep-dive': 'analytical and thorough, exploring nuances and connections between ideas'
  };

  return `You are creating a podcast script for an AI-generated audio show. Create a natural, engaging conversation between two hosts (Thomas and Isabel) discussing the following content.

**Sources:** ${sources.join(", ")}

**Content:**
${content.substring(0, 10000)} ${content.length > 10000 ? '...(truncated)' : ''}

**Style:** ${styleMap[style as keyof typeof styleMap]}
**Target Duration:** ${durationMap[duration as keyof typeof durationMap]}

**CRITICAL INSTRUCTIONS:**

1. **Format:** Use this EXACT format for each line:
   THOMAS: [his dialogue]
   ISABEL: [her dialogue]

2. **Natural Conversation:**
   - Use casual language, interjections (like "Oh!", "Wow", "Right!")
   - Include laughter indicators [laughs], pauses [pause], emphasis *like this*
   - Build on each other's points naturally
   - Ask questions and answer them
   - Use analogies and examples

3. **Structure:**
   - Opening: Warm welcome, introduce topic
   - Body: Discuss key concepts with back-and-forth
   - Insights: Share interesting connections
   - Closing: Recap key takeaways, friendly sign-off

4. **Engagement:**
   - Use "you know", "actually", "interesting thing is"
   - Reference real-world applications
   - Make complex ideas accessible
   - Show enthusiasm and curiosity

5. **Pacing:**
   - Vary sentence length
   - Include thoughtful pauses
   - Build momentum towards key points

Example:
THOMAS: Hey everyone, welcome back! Today we're diving into something really fascinating.
ISABEL: Oh yeah, I'm excited about this one. We're talking about [topic], right?
THOMAS: Exactly! And you know what's interesting? [insight]
ISABEL: [laughs] That's such a great way to put it!

Create the COMPLETE script now:`;
}

function parseScript(script: string): Array<{ speaker: string; text: string }> {
  const segments: Array<{ speaker: string; text: string }> = [];
  const lines = script.split('\n').filter(line => line.trim());

  for (const line of lines) {
    const thomasMatch = line.match(/^\*{0,2}THOMAS:\*{0,2}\s*(.+)/i);
    const isabelMatch = line.match(/^\*{0,2}ISABEL:\*{0,2}\s*(.+)/i);

    if (thomasMatch) {
      segments.push({ speaker: 'Thomas', text: thomasMatch[1].trim() });
    } else if (isabelMatch) {
      segments.push({ speaker: 'Isabel', text: isabelMatch[1].trim() });
    }
  }

  return segments;
}

function estimateDuration(segments: Array<{ speaker: string; text: string }>): number {
  const totalChars = segments.reduce((sum, seg) => sum + seg.text.length, 0);
  const estimatedMinutes = (totalChars / 5) / 150;
  return Math.round(estimatedMinutes);
}