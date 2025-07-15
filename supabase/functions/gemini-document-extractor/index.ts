import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const SUPPORTED_MIME_TYPES = [
    'application/pdf',
    'text/plain'
];
serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', {
            headers: corsHeaders
        });
    }
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({
            error: 'Method Not Allowed'
        }), {
            status: 405,
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
            }
        });
    }
    try {
        const { file_url, file_type } = await req.json();
        if (!file_url || !file_type) {
            return new Response(JSON.stringify({
                error: 'Missing file_url or file_type in request body.'
            }), {
                status: 400,
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                }
            });
        }
        // Validate the file type before calling the Gemini API to prevent 500 errors.
        if (!SUPPORTED_MIME_TYPES.includes(file_type)) {
            return new Response(JSON.stringify({
                error: `File type '${file_type}' is not supported. Please use PDF or TXT files.`
            }), {
                status: 400,
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                }
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
        // The export name was changed in newer versions of Deno's std library from `encode` to `encodeBase64`.
        const fileContentBase64 = encodeBase64(arrayBuffer);
        const parts = [
            {
                text: "Extract all relevant text content from the following document. Focus on the main body of the text, ignoring headers, footers, and page numbers. Return only the extracted text."
            },
            {
                inline_data: {
                    mime_type: file_type,
                    data: fileContentBase64
                }
            }
        ];
        const geminiPayload = {
            contents: [
                {
                    role: "user",
                    parts: parts
                }
            ]
        };
        const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`;
        const geminiResponse = await fetch(geminiApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(geminiPayload)
        });
        if (!geminiResponse.ok) {
            const errorData = await geminiResponse.json();
            throw new Error(`Gemini API error: ${errorData.error?.message || 'Unknown Error'}`);
        }
        const geminiResult = await geminiResponse.json();
        const extractedText = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text || "";
        return new Response(JSON.stringify({
            content_extracted: extractedText
        }), {
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
            },
            status: 200
        });
    } catch (error) {
        console.error('Error in gemini-document-extractor:', error.message);
        return new Response(JSON.stringify({
            error: error.message
        }), {
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
            },
            status: 500
        });
    }
});
