import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { decodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts';
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.24.1';

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
        if (!description || !userId) {
            return new Response(JSON.stringify({ error: 'Missing description or userId' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Initialize Supabase client with service role key for storage access
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL'),
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
        );

        const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
        if (!geminiApiKey) {
            throw new Error('GEMINI_API_KEY not configured in environment variables.');
        }

        const genAI = new GoogleGenerativeAI(geminiApiKey);
        // Use the specific Gemini model for image generation
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-preview-image-generation' });

        // Generate image using Gemini API with correct configuration
        const result = await model.generateContent({
            contents: [{ text: description }], // Simplified contents for direct text-to-image
            generationConfig: {
                temperature: 0.7,
                topK: 40,
                topP: 0.95,
                responseMimeType: 'image/png', // Request PNG format
                response_modalities: ['IMAGE'], // Explicitly request image output
            },
        });

        const response = await result.response;
        const generatedImagePart = response.candidates?.[0]?.content?.parts?.[0];

        if (!generatedImagePart || !generatedImagePart.inlineData) {
            throw new Error('No image data received from Gemini API.');
        }

        const imageBase64 = generatedImagePart.inlineData.data;
        const imageMimeType = generatedImagePart.inlineData.mimeType || 'image/png'; // Use mimeType from response or default
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
