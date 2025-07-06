import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

// Define CORS headers with the required 'Access-Control-Allow-Methods'
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS', // This line is crucial
};

serve(async (req) => {
    // This block is the key to fixing the CORS preflight error.
    // It specifically handles the OPTIONS method and returns a 200 OK response.
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { file_url, file_type } = await req.json();
        if (!file_url || !file_type) {
            return new Response(JSON.stringify({ error: 'Missing file_url or file_type in request body.' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
        if (!geminiApiKey) {
            throw new Error('GEMINI_API_KEY not configured in environment variables.');
        }

        const fileResponse = await fetch(file_url);
        if (!fileResponse.ok) {
            const errorText = await fileResponse.text();
            throw new Error(`Failed to fetch file from URL: ${fileResponse.statusText}. Details: ${errorText}`);
        }

        const arrayBuffer = await fileResponse.arrayBuffer();
        const fileContentBase64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

        const parts = [
            { text: "Extract all relevant text content from the following document. Focus on the main body of the text, ignoring headers, footers, and page numbers. Return only the extracted text." },
            { inline_data: { mime_type: file_type, data: fileContentBase64 } }
        ];

        const geminiPayload = {
            contents: [{ role: "user", parts: parts }],
        };

        const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`;
        const geminiResponse = await fetch(geminiApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(geminiPayload)
        });

        if (!geminiResponse.ok) {
            const errorData = await geminiResponse.json();
            throw new Error(`Gemini API error: ${errorData.error?.message || 'Unknown Error'}`);
        }

        const geminiResult = await geminiResponse.json();
        const extractedText = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text || "";

        return new Response(JSON.stringify({ content_extracted: extractedText }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
        });
    }
});