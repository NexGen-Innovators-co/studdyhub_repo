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
  // Optional customization of hosts and voices
  hosts?: Array<{ name: string; voice?: string }>;
  numberOfHosts?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY")!;

    const MODEL_CHAIN = [
      'gemini-2.5-flash',
      'gemini-3-pro-preview',
      'gemini-2.0-flash',
      'gemini-1.5-flash',
      'gemini-2.5-pro',
      'gemini-2.0-pro',
      'gemini-1.5-pro'
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
      throw new Error('All Gemini models failed');
    }
    const gcpServiceAccountJson = Deno.env.get("GCP_SERVICE_ACCOUNT_JSON");
    const gcpProjectId = "gen-lang-client-0612038711";

    // Helper function to get OAuth 2.0 access token from service account
    async function getAccessToken(): Promise<string | null> {
      if (!gcpServiceAccountJson) {
        // console.error("[OAuth] GCP_SERVICE_ACCOUNT_JSON not configured");
        return null;
      }

      try {
        // console.log("[OAuth] Service account JSON length:", gcpServiceAccountJson.length);

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
          // console.error("[OAuth] Token fetch failed:", await tokenResponse.text());
          return null;
        }
      } catch (error) {
        // console.error("[OAuth] Error getting access token:", error);
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
      // console.error("[Podcast] JSON parse error:", e);
      throw new Error("Invalid request body - expected JSON");
    }

    const {
      noteIds = [],
      documentIds = [],
      style = 'educational',
      duration = 'medium',
      podcastType = 'audio',
      cover_image_url: providedCoverImageUrl,
      hosts: requestedHosts,
      numberOfHosts = 2
    } = body as PodcastRequest;

    // Normalize hosts: default to Thomas & Isabel when not provided
    const defaultHosts = [
      { name: 'Thomas', voice: 'en-US-Neural2-D' },
      { name: 'Isabel', voice: 'en-US-Neural2-C' }
    ];

    const hosts = (Array.isArray(requestedHosts) && requestedHosts.length > 0)
      ? requestedHosts.slice(0, Math.max(1, numberOfHosts))
      : defaultHosts.slice(0, Math.max(1, numberOfHosts));

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

    const scriptPrompt = generateScriptPrompt(content, sources, style, duration, hosts.map(h => h.name));

    const geminiData = await callGeminiWithModelChain({
      contents: [{ parts: [{ text: scriptPrompt }] }],
      generationConfig: { temperature: 0.9, maxOutputTokens: 8000 }
    }, geminiApiKey);

    // Validate Gemini response structure
    if (!geminiData || !geminiData.candidates || geminiData.candidates.length === 0) {
      // console.error("[Podcast] Invalid script generation response:", JSON.stringify(geminiData));
      throw new Error("Failed to generate podcast script - invalid API response");
    }

    const candidate = geminiData.candidates[0];
    if (!candidate || !candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
      // console.error("[Podcast] Invalid script candidate structure:", JSON.stringify(candidate));
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

      try {
        const titleData = await callGeminiWithModelChain({
          contents: [{ parts: [{ text: titlePrompt }] }],
          generationConfig: { temperature: 0.8, maxOutputTokens: 100 }
        }, geminiApiKey);

        const generatedTitle = titleData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (generatedTitle && generatedTitle.length > 0 && generatedTitle.length <= 100) {
          podcastTitle = generatedTitle.replace(/^['"]|['"]$/g, '');
          // console.log(`[Podcast] Generated title: ${podcastTitle}`);
        }
      } catch (titleError) {
        // console.error('[Podcast] Title generation error:', titleError);
      }
    } catch (titleError) {
      // console.error("[Podcast] Title generation error:", titleError);
      // Keep fallback title
    }

    // 3. Parse script into segments (Host A and Host B)
    const segments = parseScript(script, hosts.map(h => h.name));

    // 4. Generate audio for each segment using Google TTS
    const audioSegments = await Promise.all(
      segments.map(async (segment, index) => {
        // Pick voice based on provided hosts mapping (case-insensitive), fallback to defaults
        const hostIndex = hosts.findIndex(h => h.name && h.name.toLowerCase() === segment.speaker.toLowerCase());
        const hostDef = hostIndex >= 0 ? hosts[hostIndex] : undefined;
        let voice = hostDef?.voice?.trim();

        // Normalize short prefix like 'en-US-Neural2' and validate selected voices
        const allowedVariants = ['A','C','D','E','F','G','H','I','J'];
        const allowedVoices = new Set(allowedVariants.map(s => `en-US-Neural2-${s}`));

        if (voice && /^en-US-Neural2$/i.test(voice)) {
          const suffix = allowedVariants[hostIndex >= 0 ? (hostIndex % allowedVariants.length) : 0];
          voice = `en-US-Neural2-${suffix}`;
          // console.log(`[Podcast] Normalized host voice for ${hostDef?.name}: ${voice}`);
        }

        // If provided voice is a Neural2 variant but not allowed (e.g. 'en-US-Neural2-B'), map to nearest allowed and warn
        if (voice && /^en-US-Neural2-[A-Z]$/i.test(voice) && !allowedVoices.has(voice)) {
          const fallbackSuffix = allowedVariants[hostIndex >= 0 ? (hostIndex % allowedVariants.length) : 0];
          // console.warn(`[Podcast] Requested voice '${voice}' not recognized/available. Falling back to en-US-Neural2-${fallbackSuffix}`);
          voice = `en-US-Neural2-${fallbackSuffix}`;
        }

        // Final fallback when no voice provided
        if (!voice) {
          voice = (segment.speaker.toLowerCase() === 'thomas') ? 'en-US-Neural2-D' : 'en-US-Neural2-C';
        }

        // Clean the text: remove stage directions and action indicators
        let cleanedText = segment.text
          .replace(/\[laughs?\]/gi, '') // Remove [laugh] or [laughs]
          .replace(/\[pause\]/gi, '') // Remove [pause]
          .replace(/\[.*?\]/g, '') // Remove any other [actions]
          .replace(/\*.*?\*/g, '') // Remove *emphasis* markers
          .replace(/`+/g, '') // Remove backticks so code blocks read naturally
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
          // console.error(`[Podcast] TTS API error for segment ${index}:`, ttsResponse.status, errorText);
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
          // console.error('[Podcast] Cover image upload error:', await coverRes.text());
        }
      } catch (coverError) {
        // console.error('[Podcast] Cover image generation exception:', coverError);
      }

      try {
        // Dynamically determine how many visual concepts are appropriate based on segments and detected insights

        const conceptPrompt = `Based on this podcast script, determine the optimal number of key visual concepts (images) needed to best illustrate the content, but do not exceed 12 total concepts. For each concept, return:
  - "concept": a brief title
  - "description": a detailed visual description for image generation
  - "segmentIndices": an array of 0-based segment indices (e.g. [0,1,2,3]) indicating which segments this image should be shown for. You may assign a concept to multiple segments if relevant, and segments may share images. Ensure all segments are covered by at least one concept.

You must decide how many visuals are needed for this script, but never return more than 12 concepts. If fewer are sufficient, return only as many as needed.

Script excerpt:
${script.substring(0, 2000)}

Format: [{"concept": "brief title", "description": "detailed visual description", "segmentIndices": [0,1,2]}]`;

        const conceptData = await callGeminiWithModelChain({
          contents: [{ parts: [{ text: conceptPrompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 10048 }
        }, geminiApiKey);

        if (!conceptData) {
          throw new Error('Concept extraction failed: empty response');
        }

        // Check for MAX_TOKENS or empty response
        const candidate = conceptData.candidates?.[0];
        const finishReason = candidate?.finishReason;

        if (finishReason === "MAX_TOKENS" || !candidate?.content?.parts?.[0]?.text) {
          // console.error("[Podcast] Concept extraction hit token limit or returned empty content:", JSON.stringify(conceptData));
          // console.log("[Podcast] Using fallback concepts due to API limitation");
          // Use fallback - will be handled by the catch block below
          throw new Error("Failed to extract concepts - response truncated or empty");
        }

        const conceptText = conceptData.candidates[0].content.parts[0].text;

        let concepts: Array<{ concept: string, description: string, segmentIndices?: number[] }> = [];
        try {
          const jsonMatch = conceptText.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            concepts = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error("No JSON array found in response");
          }
        } catch (e) {
          // console.error("[Podcast] Failed to parse concepts:", e);
          concepts = [{
            concept: "Main Topic",
            description: `A professional educational illustration about ${sources.join(", ")} , featuring modern design elements, clean typography, and vibrant colors`,
            segmentIndices: Array.from({length: segments.length}, (_, i) => i)
          }];
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
              // console.error(`[Podcast] Image upload error:`, await imageRes.text());
            }
          } catch (error) {
            // console.error(`[Podcast] Image upload exception:`, error);
          }

          visualAssets.push({
            type: 'image',
            concept: concept.concept,
            description,
            url: imageUrl || `https://placehold.co/1792x1024/6366f1/white?text=${encodeURIComponent(concept.concept)}`,
            segmentIndices: Array.isArray(concept.segmentIndices) ? concept.segmentIndices : [],
            timestamp: null // will be set in UI based on segmentIndex
          });
        }

        // console.log(`[Podcast] Generated ${visualAssets.length} visual assets`);

        // For video podcast type, generate video clips using Veo 3
        if (podcastType === 'video' && visualAssets.length > 0 && accessToken) {
          // console.log(`[Podcast] Generating video clips with Veo 3...`);

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
                // console.log(`[Podcast] Veo response:`, JSON.stringify(veoData).substring(0, 200));

                // Check if this is a long-running operation
                if (veoData.name && veoData.name.includes('operations')) {
                  // console.log(`[Podcast] Veo returned operation ID: ${veoData.name} - skipping (long-running)`);
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
                    // console.log(`[Podcast] Generated video ${i + 1}`);
                  } else {
                    // console.log(`[Podcast] No video bytes in prediction:`, Object.keys(prediction));
                  }
                }
              } else {
                const errorText = await veoResponse.text();
                // console.error(`[Podcast] Veo error (${veoResponse.status}):`, errorText);
              }
            }
          } catch (error) {
            // console.error("[Podcast] Video generation error:", error);
          }
        }

      } catch (visualError) {
        // console.error("[Podcast] Visual asset generation error:", visualError);
      }
    }



    // AI-driven mapping: assign images to segments based on segmentIndices from visualAssets

    let segmentImageMap: string[] = Array(segments.length).fill(null);
    if (visualAssets.length > 0 && segments.length > 0) {
      visualAssets.forEach(asset => {
        // Support both segmentIndices (array) and segmentIndex (number)
        if (Array.isArray(asset.segmentIndices)) {
          asset.segmentIndices.forEach((segIdx: number) => {
            if (segIdx >= 0 && segIdx < segments.length) {
              segmentImageMap[segIdx] = asset.url;
            }
          });
        } else if (typeof asset.segmentIndex === 'number') {
          const segIdx = asset.segmentIndex;
          if (segIdx >= 0 && segIdx < segments.length) {
            segmentImageMap[segIdx] = asset.url;
          }
        }
      });
      // Fallback: if any segment is still missing an image, assign the first image
      for (let i = 0; i < segmentImageMap.length; i++) {
        if (!segmentImageMap[i] && visualAssets[0]) {
          segmentImageMap[i] = visualAssets[0].url;
        }
      }
    }

    // Attach imageUrl to each audio segment for downstream use
    const audioSegmentsWithImages = validAudioSegments.map((seg, idx) => ({
      ...seg,
      imageUrl: segmentImageMap[idx] || null
    }));

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
        audio_segments: audioSegmentsWithImages,
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

    // console.log(`[Podcast] Saved podcast: ${podcast.id}`);
    // console.log(`[Podcast] Generated ${visualAssets.length} visual assets`);

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
    // console.error("[Podcast] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function generateScriptPrompt(content: string, sources: string[], style: string, duration: string, hostNames: string[] = ['Thomas', 'Isabel']): string {
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

  const hostsList = hostNames.join(' and ');
  const exampleFormat = hostNames.map(n => `${n.toUpperCase()}: [their dialogue]`).join('\n   ');

  return `You are creating a podcast script for an AI-generated audio show. Create a natural, engaging conversation between hosts (${hostsList}) discussing the following content.

**Sources:** ${sources.join(", ")}

**Content:**
${content.substring(0, 10000)} ${content.length > 10000 ? '...(truncated)' : ''}

**Style:** ${styleMap[style as keyof typeof styleMap]}
**Target Duration:** ${durationMap[duration as keyof typeof durationMap]}

**CRITICAL INSTRUCTIONS:**

1. **Format:** Use this EXACT format for each line:
  ${exampleFormat}

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
${hostNames[0].toUpperCase()}: Hey everyone, welcome back! Today we're diving into something really fascinating.
${hostNames[1] ? hostNames[1].toUpperCase() : hostNames[0].toUpperCase()}: Oh yeah, I'm excited about this one. We're talking about [topic], right?
${hostNames[0].toUpperCase()}: Exactly! And you know what's interesting? [insight]
${hostNames[1] ? hostNames[1].toUpperCase() : hostNames[0].toUpperCase()}: [laughs] That's such a great way to put it!

Create the COMPLETE script now:`;
}

function parseScript(script: string, hostNames: string[] = ['Thomas', 'Isabel']): Array<{ speaker: string; text: string }> {
  const segments: Array<{ speaker: string; text: string }> = [];
  const lines = script.split('\n').filter(line => line.trim());

  const names = (hostNames && hostNames.length > 0) ? hostNames : ['Thomas', 'Isabel'];
  const escaped = names.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`^\\*{0,2}(${escaped.join('|')}):\\*{0,2}\\s*(.+)`, 'i');

  for (const line of lines) {
    const m = line.match(pattern);
    if (m) {
      segments.push({ speaker: m[1].trim(), text: m[2].trim() });
    }
  }

  return segments;
}

function estimateDuration(segments: Array<{ speaker: string; text: string }>): number {
  const totalChars = segments.reduce((sum, seg) => sum + seg.text.length, 0);
  const estimatedMinutes = (totalChars / 5) / 150;
  return Math.round(estimatedMinutes);
}
