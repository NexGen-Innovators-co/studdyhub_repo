import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { decodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts';
// import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.24.1';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { description, userId } = await req.json();
        console.log('[generate-image-from-text] Incoming data:', { description, userId });
        if (!description || typeof description !== 'string' || !description.trim()) {
            return new Response(JSON.stringify({ error: 'Missing or empty description for image generation.' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
        if (!userId) {
            return new Response(JSON.stringify({ error: 'Missing userId' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Initialize Supabase client with service role key for storage access
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL'),
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
        );


        // --- Vertex AI Imagen (text-to-image) ---
        // Get service account JSON from env
        const gcpServiceAccountJson = Deno.env.get("GCP_SERVICE_ACCOUNT_JSON");
        const gcpProjectId = "gen-lang-client-0612038711";
        const region = "us-central1";
        if (!gcpServiceAccountJson) {
            throw new Error("GCP_SERVICE_ACCOUNT_JSON not configured");
        }
        // Parse and clean service account JSON
        let cleanedJson = gcpServiceAccountJson.trim();
        if (cleanedJson.startsWith('"') && cleanedJson.endsWith('"')) {
            cleanedJson = cleanedJson.slice(1, -1);
        }
        cleanedJson = cleanedJson.replace(/\\"/g, '"');
        const serviceAccount = JSON.parse(cleanedJson);
        // JWT for OAuth2
        const header = { alg: "RS256", typ: "JWT" };
        const now = Math.floor(Date.now() / 1000);
        const payload = {
            iss: serviceAccount.client_email,
            scope: "https://www.googleapis.com/auth/cloud-platform",
            aud: "https://oauth2.googleapis.com/token",
            exp: now + 3600,
            iat: now
        };
        const base64url = (str) => btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
        const encodedHeader = base64url(JSON.stringify(header));
        const encodedPayload = base64url(JSON.stringify(payload));
        const unsignedToken = `${encodedHeader}.${encodedPayload}`;
        // Import private key
        const privateKey = serviceAccount.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\n/g, '');
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
        const encodedSignature = base64url(String.fromCharCode(...new Uint8Array(signature)));
        const jwt = `${unsignedToken}.${encodedSignature}`;
        // Exchange JWT for access token
        const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
                assertion: jwt
            })
        });
        if (!tokenResponse.ok) {
            throw new Error("Failed to get GCP access token: " + await tokenResponse.text());
        }
        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        // Call Vertex AI Imagen endpoint
        const imagenEndpoint = `https://${region}-aiplatform.googleapis.com/v1/projects/${gcpProjectId}/locations/${region}/publishers/google/models/imagegeneration@006:predict`;
        const imagenRes = await fetch(imagenEndpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${accessToken}`
            },
            body: JSON.stringify({
                instances: [
                    {
                        prompt: description
                    }
                ],
                parameters: {
                    sampleCount: 1,
                    imageSize: "1024x1024"
                }
            })
        });
        if (!imagenRes.ok) {
            throw new Error("Vertex AI Imagen error: " + await imagenRes.text());
        }
        const imagenData = await imagenRes.json();
        const imageBase64 = imagenData.predictions?.[0]?.bytesBase64Encoded;
        const imageMimeType = "image/png";
        if (!imageBase64) {
            throw new Error("No image data received from Imagen");
        }
        const imageBuffer = decodeBase64(imageBase64);

        const imageFileName = `generated_image_${Date.now()}.${imageMimeType.split('/')[1] || 'png'}`;
        const imagePath = `${userId}/${imageFileName}`;

        // Upload the generated image to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabaseClient.storage
            .from('generatedimages') // Ensure this bucket exists in Supabase
            .upload(imagePath, imageBuffer, {
                contentType: imageMimeType,
                upsert: true // Overwrite if file exists
            });

        if (uploadError) {
            console.error('Supabase Storage upload error:', uploadError.message);
            throw new Error(`Failed to upload image to storage: ${uploadError.message}`);
        }

        // Get the public URL of the uploaded image
        const { data: publicUrlData } = supabaseClient.storage
            .from('generatedimages')
            .getPublicUrl(imagePath);

        if (!publicUrlData || !publicUrlData.publicUrl) {
            throw new Error('Could not get public URL for the uploaded image.');
        }

        return new Response(JSON.stringify({ imageUrl: publicUrlData.publicUrl }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('Edge function error in generate-image-from-text:', error.message);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
