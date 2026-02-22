import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getEducationContext, formatEducationContextForPrompt } from '../_shared/educationContext.ts';

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

    // Fetch education context for curriculum-aware podcast script
    let educationBlock = '';
    try {
      const eduCtx = await getEducationContext(supabase, user.id);
      if (eduCtx) {
        educationBlock = formatEducationContextForPrompt(eduCtx);
      }
    } catch (_eduErr) {
      // Non-critical — continue without education context
    }

    const scriptPrompt = generateScriptPrompt(content, sources, style, duration, hosts.map(h => h.name), educationBlock);

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

    // Flag: use dedicated video flow (Veo clips with AI audio) for video podcast type
    const useVideoFlow = podcastType === 'video' && !!accessToken;

    // ── Shared Veo helpers (used by video flow) ──
    async function pollVeoOperation(operationName: string, token: string, maxWaitMs = 120_000): Promise<any> {
      const modelEndpoint = operationName.split('/operations/')[0];
      const pollUrl = `https://us-central1-aiplatform.googleapis.com/v1/${modelEndpoint}:fetchPredictOperation`;
      const startTime = Date.now();
      let delay = 10_000;
      while (Date.now() - startTime < maxWaitMs) {
        await new Promise(r => setTimeout(r, delay));
        const res = await fetch(pollUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ operationName })
        });
        if (!res.ok) {
          const errText = await res.text();
          console.error(`[Podcast] Poll error (${res.status}):`, errText.substring(0, 300));
          if (res.status === 404 && Date.now() - startTime < maxWaitMs / 2) { delay = Math.min(delay + 5_000, 15_000); continue; }
          return null;
        }
        const data = await res.json();
        if (data.done) return data;
        console.log(`[Podcast] Veo not done, polling in ${delay / 1000}s...`);
        delay = Math.min(delay + 5_000, 15_000);
      }
      console.warn(`[Podcast] Veo timed out after ${maxWaitMs}ms`);
      return null;
    }

    function extractVideoBytes(result: any): string | undefined {
      if (!result) return undefined;
      const resp = result.response || result.result || {};
      console.log(`[Podcast] Veo done response keys:`, Object.keys(resp));
      const generatedSamples = resp.generatedSamples || resp.generated_samples || resp.generateVideoResponse?.generatedSamples;
      const videos = resp.videos || resp.generatedVideos || resp.generated_videos;
      const predictions = resp.predictions || resp.value?.predictions;
      if (generatedSamples?.[0]) {
        const s = generatedSamples[0];
        return s.video?.bytesBase64Encoded || s.bytesBase64Encoded;
      }
      if (videos?.[0]) {
        const v = videos[0].video || videos[0];
        return v.bytesBase64Encoded || v.bytes_base64_encoded || v.videoBytes;
      }
      if (predictions?.[0]) {
        const p = predictions[0];
        return p.bytesBase64Encoded || p.video?.bytesBase64Encoded;
      }
      console.warn(`[Podcast] Unknown Veo response. Keys:`, Object.keys(resp));
      return undefined;
    }

    async function uploadVideoClip(videoBase64: string, userId: string, clipIndex: number): Promise<string | null> {
      try {
        const binaryStr = atob(videoBase64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let j = 0; j < binaryStr.length; j++) bytes[j] = binaryStr.charCodeAt(j);
        const fileName = `video_${Date.now()}_${clipIndex}.mp4`;
        const filePath = `${userId}/${fileName}`;
        const { error: uploadErr } = await supabase.storage.from('generatedimages').upload(filePath, bytes, { contentType: 'video/mp4', upsert: true });
        if (uploadErr) { console.error('[Podcast] Upload error:', uploadErr.message); return null; }
        const { data: urlData } = supabase.storage.from('generatedimages').getPublicUrl(filePath);
        return urlData?.publicUrl || null;
      } catch (e) { console.error('[Podcast] Upload exception:', e); return null; }
    }

    // 4. Generate audio for each segment
    // Video type: text-only segments (audio comes from Veo clips) | Others: TTS
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

        // Video type: skip TTS entirely — audio comes from Veo video clips
        // Return text-only segment for transcript
        if (useVideoFlow) {
          return { speaker: segment.speaker, text: cleanedText, index };
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

    // ══════════════════════════════════════════════════════════════
    // VIDEO FLOW: Generate AI video clips with built-in audio
    // ══════════════════════════════════════════════════════════════
    if (useVideoFlow) {
      const videoFlowStart = Date.now();
      const VIDEO_BUDGET_MS = 240_000; // 240s hard budget for entire video flow (Supabase allows up to 300s)

      // Generate cover image
      if (!coverImageUrl) {
        try {
          const coverPrompt = `A vibrant, professional educational podcast cover about ${sources.join(", ") || 'the topic'}, modern design, clean typography, bright gradients, cinematic composition`;
          const coverRes = await fetch(`${supabaseUrl}/functions/v1/generate-image-from-text`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseKey}` },
            body: JSON.stringify({ description: coverPrompt, userId: user.id })
          });
          if (coverRes.ok) { coverImageUrl = (await coverRes.json()).imageUrl; }
        } catch (e) { console.error('[Podcast] Cover image error:', e); }
      }

      try {
        // Determine how many clips to generate based on segment count.
        // Each Veo clip is ~8 seconds with audio. Aim for 1 clip per 2-3 segments
        // so the video covers the full conversation. All clips launch in parallel,
        // so more clips doesn't significantly increase wall-clock time.
        const sceneCount = Math.min(Math.max(Math.ceil(segments.length / 2), 4), 12);
        const hostNames = hosts.map(h => h.name).join(' and ');
        console.log(`[Podcast] Planning ${sceneCount} video scenes for ${segments.length} segments`);
        const scenePrompt = `Based on this podcast script between ${hostNames}, create exactly ${sceneCount} cinematic video scenes.
Each scene will become an 8 second AI-generated video clip WITH spoken audio/dialogue.
The scenes together should cover the ENTIRE podcast conversation from start to finish.

For each scene return:
- "concept": Brief scene title
- "description": Detailed cinematic video prompt (setting, camera angles, lighting, action, visual style). Be very specific and visual.
- "dialogue": The actual dialogue or narration for this scene. This WILL be spoken aloud in the generated video. Include 2-3 sentences that faithfully represent the script content for the covered segments (~8 seconds of speech).
- "segmentIndices": Array of 0-based script segment indices this scene covers (each scene should cover 1-3 consecutive segments)
- "duration": 8

IMPORTANT:
- Every segment from 0 to ${segments.length - 1} MUST be covered by exactly one scene.
- Scenes must be in chronological order.
- Distribute segments as evenly as possible across all ${sceneCount} scenes.
- The dialogue should capture the key points and natural conversation flow.

Script (${segments.length} segments):
${script.substring(0, 6000)}

Return ONLY valid JSON array: [{"concept":"...", "description":"...", "dialogue":"...", "segmentIndices":[0,1], "duration":8}]`;

        const sceneData = await callGeminiWithModelChain({
          contents: [{ parts: [{ text: scenePrompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 16384 }
        }, geminiApiKey);

        let scenes: any[] = [];
        const sceneText = sceneData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const jsonMatch = sceneText.match(/\[[\s\S]*\]/);
        if (jsonMatch) scenes = JSON.parse(jsonMatch[0]);
        if (scenes.length === 0) throw new Error('No scenes extracted from script');
        // Hard cap at 12 scenes (12 × 8s = 96s of video, all generated in parallel)
        scenes = scenes.slice(0, 12);

        console.log(`[Podcast] Extracted ${scenes.length} video scenes, launching ALL Veo operations in parallel...`);

        // ── Phase 1: Fire ALL Veo requests simultaneously ──
        const VEO_MODELS = ['veo-3.0-generate-001', 'veo-2.0-generate-001'];
        let currentVeoModel = VEO_MODELS[0];
        let veoSupportsAudio = true;

        interface PendingOp {
          clipIndex: number;
          scene: any;
          operationName: string | null;
          videoPrompt: string;
          done: boolean;
          result: any;
        }

        const pendingOps: PendingOp[] = [];

        // Fire requests for all scenes at once
        // NOTE: We serialize launches to avoid race conditions with model fallback.
        // Each launch is fast (~1-2s), so serial is acceptable.
        for (let clipIndex = 0; clipIndex < scenes.length; clipIndex++) {
          const scene = scenes[clipIndex];
          const videoPrompt = scene.dialogue
            ? `${scene.description}. The narrator says: "${scene.dialogue}". Professional cinematic educational style, high quality.`
            : `${scene.description}. Professional cinematic educational style, high quality.`;

          const op: PendingOp = { clipIndex, scene, operationName: null, videoPrompt, done: false, result: null };
          pendingOps.push(op);

          try {
            const veoRes = await fetch(
              `https://us-central1-aiplatform.googleapis.com/v1/projects/${gcpProjectId}/locations/us-central1/publishers/google/models/${currentVeoModel}:predictLongRunning`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
                body: JSON.stringify({
                  instances: [{ prompt: videoPrompt }],
                  parameters: {
                    sampleCount: 1,
                    aspectRatio: "16:9",
                    durationSeconds: scene.duration || 8,
                    ...(veoSupportsAudio ? { generateAudio: true } : {})
                  }
                })
              }
            );
            if (!veoRes.ok) {
              const errText = (await veoRes.text()).substring(0, 200);
              console.error(`[Podcast] Veo ${currentVeoModel} clip ${clipIndex} (${veoRes.status}): ${errText}`);
              // If clip fails with Veo 3, switch model for this + remaining clips
              if (currentVeoModel === VEO_MODELS[0] && (veoRes.status === 404 || veoRes.status === 400)) {
                currentVeoModel = VEO_MODELS[1];
                veoSupportsAudio = false;
                console.log(`[Podcast] Switching to ${currentVeoModel} for remaining clips`);
                // Retry this clip with Veo 2
                const retryRes = await fetch(
                  `https://us-central1-aiplatform.googleapis.com/v1/projects/${gcpProjectId}/locations/us-central1/publishers/google/models/${currentVeoModel}:predictLongRunning`,
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
                    body: JSON.stringify({
                      instances: [{ prompt: videoPrompt }],
                      parameters: { sampleCount: 1, aspectRatio: "16:9", durationSeconds: scene.duration || 8 }
                    })
                  }
                );
                if (retryRes.ok) {
                  const retryData = await retryRes.json();
                  if (retryData.name) {
                    op.operationName = retryData.name;
                    console.log(`[Podcast] Clip ${clipIndex}: operation ${retryData.name.split('/').pop()}`);
                  }
                }
              }
              continue;
            }
            const data = await veoRes.json();
            if (data.name) {
              op.operationName = data.name;
              console.log(`[Podcast] Clip ${clipIndex}: operation ${data.name.split('/').pop()}`);
            }
          } catch (err) {
            console.error(`[Podcast] Clip ${clipIndex} launch error:`, err);
          }
        }

        const launchedCount = pendingOps.filter(o => o.operationName).length;
        console.log(`[Podcast] Launched ${launchedCount}/${scenes.length} Veo operations, polling all together...`);

        // ── Phase 2: Unified polling loop — check ALL operations each cycle ──
        const POLL_INTERVAL = 6_000;  // Fixed 6s poll interval (Veo usually takes 30-90s)
        const INITIAL_WAIT = 15_000;  // Wait 15s before first poll (let Veo start processing)
        let firstPoll = true;

        while (true) {
          const elapsed = Date.now() - videoFlowStart;
          if (elapsed >= VIDEO_BUDGET_MS) {
            console.warn(`[Podcast] Video budget exhausted (${Math.round(elapsed / 1000)}s). Saving ${visualAssets.length} completed clips.`);
            break;
          }

          const stillPending = pendingOps.filter(o => o.operationName && !o.done);
          if (stillPending.length === 0) break;

          // Wait before polling — longer initial wait, then fixed interval
          const waitMs = firstPoll ? INITIAL_WAIT : POLL_INTERVAL;
          firstPoll = false;
          await new Promise(r => setTimeout(r, waitMs));

          // Poll all pending ops in parallel
          await Promise.all(stillPending.map(async (op) => {
            try {
              const modelEndpoint = op.operationName!.split('/operations/')[0];
              const pollUrl = `https://us-central1-aiplatform.googleapis.com/v1/${modelEndpoint}:fetchPredictOperation`;
              const res = await fetch(pollUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
                body: JSON.stringify({ operationName: op.operationName })
              });
              if (!res.ok) {
                const errText = await res.text();
                console.error(`[Podcast] Poll clip ${op.clipIndex} (${res.status}):`, errText.substring(0, 200));
                // On persistent 404 after 90s, mark as done (failed)
                if (res.status === 404 && elapsed > 90_000) { op.done = true; }
                return;
              }
              const data = await res.json();
              if (data.done) {
                op.done = true;
                op.result = data;
                const videoBytes = extractVideoBytes(data);
                if (videoBytes) {
                  const videoUrl = await uploadVideoClip(videoBytes, user.id, op.clipIndex);
                  if (videoUrl) {
                    console.log(`[Podcast] Video clip ${op.clipIndex + 1}/${scenes.length}: ${videoUrl} (${Math.round(elapsed / 1000)}s)`);
                    visualAssets.push({
                      type: 'video',
                      concept: op.scene.concept,
                      description: op.scene.description,
                      transcript: op.scene.dialogue || '',
                      url: videoUrl,
                      segmentIndices: op.scene.segmentIndices || [],
                      order: op.clipIndex,
                      duration: op.scene.duration || 8,
                      hasAudio: veoSupportsAudio
                    });
                  }
                } else {
                  console.warn(`[Podcast] Clip ${op.clipIndex}: done but no video bytes`);
                }
              }
            } catch (err) {
              console.error(`[Podcast] Poll clip ${op.clipIndex} error:`, err);
            }
          }));

          const doneCount = pendingOps.filter(o => o.done).length;
          const remaining = pendingOps.filter(o => o.operationName && !o.done).length;
          if (remaining > 0) {
            console.log(`[Podcast] Progress: ${doneCount}/${launchedCount} done, ${remaining} pending (${Math.round((Date.now() - videoFlowStart) / 1000)}s elapsed)`);
          }
        }

        // Sort visual assets by order
        visualAssets.sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
        console.log(`[Podcast] Generated ${visualAssets.length}/${scenes.length} video clips (audio: ${veoSupportsAudio})`);
      } catch (sceneErr) {
        console.error('[Podcast] Video flow error:', sceneErr);
      }
    }

    // ══════════════════════════════════════════════════════════════
    // IMAGE-AUDIO FLOW: TTS audio + generated images (existing)
    // ══════════════════════════════════════════════════════════════
    if (!coverImageUrl && !useVideoFlow && (podcastType === 'image-audio' || podcastType === 'video' || podcastType === 'live-stream')) {
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

        const totalSegments = segments.length;
        // Allow more concepts for longer podcasts (up to 20), ensuring better visual coverage
        const maxConcepts = Math.min(Math.max(Math.ceil(totalSegments / 3), 6), 20);
        const conceptPrompt = `Based on this podcast script, determine the optimal number of key visual concepts (images) needed to best illustrate the content.

IMPORTANT RULES:
- There are exactly ${totalSegments} segments (indices 0 to ${totalSegments - 1}).
- Return up to ${maxConcepts} concepts.
- EVERY segment index from 0 to ${totalSegments - 1} MUST appear in at least one concept's segmentIndices. No segment should be left uncovered.
- Distribute segment indices evenly across concepts. Each concept should cover a contiguous range of segments.
- Adjacent segments about the same topic should share the same concept.

For each concept return:
  - "concept": a brief title
  - "description": a detailed visual description for image generation
  - "segmentIndices": an array of 0-based segment indices this image should be shown for

Script (${totalSegments} segments):
${script.substring(0, 4000)}

Format: [{"concept": "brief title", "description": "detailed visual description", "segmentIndices": [0,1,2]}]`;

        const conceptData = await callGeminiWithModelChain({
          contents: [{ parts: [{ text: conceptPrompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 16384 }
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
          // Fallback: create evenly-spaced concepts covering all segments
          const fallbackCount = Math.min(Math.ceil(segments.length / 4), 8);
          concepts = Array.from({length: fallbackCount}, (_, ci) => {
            const start = Math.floor(ci * segments.length / fallbackCount);
            const end = Math.floor((ci + 1) * segments.length / fallbackCount);
            return {
              concept: `Topic ${ci + 1}`,
              description: `A professional educational illustration about ${sources.join(", ")} , featuring modern design elements, clean typography, and vibrant colors`,
              segmentIndices: Array.from({length: end - start}, (_, j) => start + j)
            };
          });
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

        // For video podcast type, generate video clips using Veo 2
        if (podcastType === 'video' && visualAssets.length > 0 && accessToken) {
          console.log(`[Podcast] Generating video clips with Veo 2...`);

          // Helper: poll a Vertex AI LRO via fetchPredictOperation (POST) until done or timeout
          async function pollOperation(operationName: string, token: string, maxWaitMs = 120_000): Promise<any> {
            // Use fetchPredictOperation endpoint — the correct way to poll publisher model operations
            // POST /v1/{endpoint}:fetchPredictOperation with body { operationName: "..." }
            const modelPath = `projects/${gcpProjectId}/locations/us-central1/publishers/google/models/veo-2.0-generate-001`;
            const pollUrl = `https://us-central1-aiplatform.googleapis.com/v1/${modelPath}:fetchPredictOperation`;
            const startTime = Date.now();
            let delay = 10_000; // Veo takes 15-60s typically; start polling after 10s
            while (Date.now() - startTime < maxWaitMs) {
              await new Promise(r => setTimeout(r, delay));
              const res = await fetch(pollUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ operationName })
              });
              if (!res.ok) {
                const errText = await res.text();
                console.error(`[Podcast] Poll error (${res.status}):`, errText.substring(0, 300));
                // On 404 or 400 the operation may not exist yet — retry a couple times
                if (res.status === 404 && Date.now() - startTime < maxWaitMs / 2) {
                  delay = Math.min(delay + 5_000, 15_000);
                  continue;
                }
                return null;
              }
              const data = await res.json();
              if (data.done) return data;
              console.log(`[Podcast] Veo operation not done yet, polling again in ${delay / 1000}s...`);
              // Increase delay, cap at 15s
              delay = Math.min(delay + 5_000, 15_000);
            }
            console.warn(`[Podcast] Veo operation timed out after ${maxWaitMs}ms: ${operationName}`);
            return null;
          }

          // Helper: upload video bytes to Supabase Storage and return public URL
          async function uploadVideoToStorage(videoBase64: string, userId: string, index: number): Promise<string | null> {
            try {
              const binaryStr = atob(videoBase64);
              const bytes = new Uint8Array(binaryStr.length);
              for (let j = 0; j < binaryStr.length; j++) bytes[j] = binaryStr.charCodeAt(j);
              const fileName = `video_${Date.now()}_${index}.mp4`;
              const filePath = `${userId}/${fileName}`;
              const { error: uploadErr } = await supabase.storage
                .from('generatedimages')
                .upload(filePath, bytes, { contentType: 'video/mp4', upsert: true });
              if (uploadErr) { console.error('[Podcast] Video upload error:', uploadErr.message); return null; }
              const { data: urlData } = supabase.storage.from('generatedimages').getPublicUrl(filePath);
              return urlData?.publicUrl || null;
            } catch (e) {
              console.error('[Podcast] Video upload exception:', e);
              return null;
            }
          }

          try {
            // Generate maximum 2 videos to stay within timeout
            for (let i = 0; i < Math.min(concepts.length, 2); i++) {
              const concept = concepts[i];
              const videoPrompt = `Professional educational video: ${concept.description}. Modern design, clean typography, smooth animations. Educational style, 5 seconds.`;

              const veoResponse = await fetch(
                `https://us-central1-aiplatform.googleapis.com/v1/projects/${gcpProjectId}/locations/us-central1/publishers/google/models/veo-2.0-generate-001:predictLongRunning`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${accessToken}`
                  },
                  body: JSON.stringify({
                    instances: [{
                      prompt: videoPrompt
                    }],
                    parameters: {
                      sampleCount: 1,
                      aspectRatio: "16:9"
                    }
                  })
                }
              );

              if (veoResponse.ok) {
                const veoData = await veoResponse.json();
                console.log(`[Podcast] Veo response:`, JSON.stringify(veoData).substring(0, 300));

                let videoBase64: string | undefined;

                // Veo 2 always returns a long-running operation — poll until complete
                if (veoData.name) {
                  console.log(`[Podcast] Veo returned operation: ${veoData.name} — polling...`);
                  const result = await pollOperation(veoData.name, accessToken!, 120_000);
                  if (result?.done) {
                    // Log the full done response structure to understand the format
                    const respStr = JSON.stringify(result).substring(0, 1000);
                    console.log(`[Podcast] Veo done response:`, respStr);

                    // Try all known response shapes:
                    // Shape 1: result.response.predictions[0].bytesBase64Encoded (legacy predict)
                    // Shape 2: result.response.generatedSamples[0].video.bytesBase64Encoded (Veo2 predictLongRunning)
                    // Shape 3: result.response.generatedSamples[0].video.uri (GCS URI)
                    // Shape 4: result.response.videos[0].bytesBase64Encoded
                    // Shape 5: result.metadata.generatedSamples (sometimes in metadata)
                    const resp = result.response || result.result || {};
                    const predictions = resp.predictions || resp.value?.predictions;
                    const generatedSamples = resp.generatedSamples || resp.generated_samples || resp.generateVideoResponse?.generatedSamples;
                    const videos = resp.videos || resp.generatedVideos || resp.generated_videos;

                    if (generatedSamples?.[0]) {
                      const sample = generatedSamples[0];
                      videoBase64 = sample.video?.bytesBase64Encoded || sample.bytesBase64Encoded || sample.video?.bytes_base64_encoded;
                      if (!videoBase64 && sample.video?.uri) {
                        console.log(`[Podcast] Veo returned GCS URI: ${sample.video.uri} — skipping (GCS fetch not implemented)`);
                      }
                      if (!videoBase64) console.warn(`[Podcast] generatedSamples found but no bytes. Sample keys:`, Object.keys(sample), 'video keys:', Object.keys(sample.video || {}));
                    } else if (videos?.[0]) {
                      const vid = videos[0];
                      const vidContent = vid.video || vid;
                      videoBase64 = vidContent.bytesBase64Encoded || vidContent.bytes_base64_encoded || vidContent.videoBytes;
                      if (!videoBase64 && (vidContent.uri || vidContent.video_bytes)) {
                        console.log(`[Podcast] Veo video URI/bytes field:`, Object.keys(vidContent));
                      }
                    } else if (predictions?.[0]) {
                      const prediction = predictions[0];
                      videoBase64 = prediction.bytesBase64Encoded || prediction.video?.bytesBase64Encoded;
                    } else {
                      console.warn(`[Podcast] Completed but unknown response structure. Response keys:`, Object.keys(resp));
                    }
                  } else if (result?.error) {
                    console.error(`[Podcast] Veo operation error:`, JSON.stringify(result.error));
                  } else {
                    console.warn(`[Podcast] Veo operation returned null (timed out or poll failed)`);
                  }
                } else if (veoData.predictions?.[0]) {
                  // Direct response (unlikely for Veo 2 but handle just in case)
                  videoBase64 = veoData.predictions[0].bytesBase64Encoded;
                }

                if (videoBase64) {
                  // Upload to Supabase Storage instead of storing data URI
                  const videoUrl = await uploadVideoToStorage(videoBase64, user.id, i);
                  if (videoUrl) {
                    visualAssets.push({
                      type: 'video',
                      concept: concept.concept,
                      description: concept.description,
                      url: videoUrl,
                      segmentIndices: Array.isArray(concept.segmentIndices) ? concept.segmentIndices : [],
                      timestamp: Math.floor((i / Math.min(concepts.length, 2)) * estimateDuration(segments) * 60)
                    });
                    console.log(`[Podcast] Generated & uploaded video ${i + 1}: ${videoUrl}`);
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
      // Fallback: if any segment is still missing an image, assign the nearest available image
      // (spread them out instead of always using the first one)
      for (let i = 0; i < segmentImageMap.length; i++) {
        if (!segmentImageMap[i]) {
          // Find the closest segment that has an image
          let nearest = -1;
          let minDist = Infinity;
          for (let j = 0; j < segmentImageMap.length; j++) {
            if (segmentImageMap[j] && Math.abs(j - i) < minDist) {
              minDist = Math.abs(j - i);
              nearest = j;
            }
          }
          segmentImageMap[i] = nearest >= 0 ? segmentImageMap[nearest] : (visualAssets[0]?.url || '');
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
          ...asset, // Preserve segmentIndices and all other fields
          url: `https://placehold.co/1792x1024/6366f1/white?text=${encodeURIComponent(asset.concept)}`,
          generated: true
        };
      }
      return asset;
    }) : null;

    // For video flow, compute actual duration from video clip durations instead of text estimate
    const actualDurationMinutes = (useVideoFlow && visualAssets.length > 0)
      ? Math.max(1, Math.round(visualAssets.reduce((sum: number, a: any) => sum + (a.duration || 8), 0) / 60))
      : estimateDuration(segments);

    const { data: podcast, error: insertError } = await supabase
      .from("ai_podcasts")
      .insert({
        user_id: user.id,
        title: podcastTitle,
        sources: sources,
        script: script,
        audio_segments: audioSegmentsWithImages,
        duration_minutes: actualDurationMinutes,
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

function generateScriptPrompt(content: string, sources: string[], style: string, duration: string, hostNames: string[] = ['Thomas', 'Isabel'], educationBlock: string = ''): string {
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

  const educationSection = educationBlock
    ? `\n**${educationBlock}**\nTailor the discussion to be relevant to this student's curriculum, exam, and subject focus. Use appropriate terminology and examples for their education level.\n`
    : '';

  return `You are creating a podcast script for an AI-generated audio show. Create a natural, engaging conversation between hosts (${hostsList}) discussing the following content.

**Sources:** ${sources.join(", ")}
${educationSection}
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
