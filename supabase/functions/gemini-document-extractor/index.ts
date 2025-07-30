// supabase/functions/gemini-document-extractor/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const SUPPORTED_MIME_TYPES = [
    'application/pdf',
    'text/plain',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
];

// Configuration for LLM-based extraction (for PDFs and Images)
const LLM_CONFIG = {
    maxOutputTokens: 6599536, // Gemini's current maximum output tokens
    temperature: 0.1, // Low temperature for deterministic extraction
    topK: 1,
    topP: 0.1,
    candidateCount: 1,
    safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
    ]
};

/**
 * Generates the prompt for the LLM to extract content.
 * @param fileType MIME type of the file.
 * @returns The prompt string.
 */
const getLlmExtractionPrompt = (fileType: string) => {
    let basePrompt = `You are a professional document content extractor. Your primary objective is to extract ALL readable content from the provided document or image, preserving its original structure, formatting, and meaning as accurately as possible.

CRITICAL EXTRACTION REQUIREMENTS:
1. Extract EVERY single piece of readable text/information - no content should be omitted.
2. Maintain ORIGINAL structure including: paragraphs, line breaks, headers, lists, tables (with content and structure), and meaningful spacing.
3. Preserve EXACT wording - do not paraphrase, summarize, alter, or interpret.
4. Include ALL content regardless of font size, formatting, or position (e.g., captions, footnotes).
5. Maintain the logical flow and reading order.
6. Do not add any commentary, explanations, or additional text beyond the extracted content.
7. **ABSOLUTELY MAXIMIZE OUTPUT**: Generate as much content as possible, striving to reach your maximum output token limit (${LLM_CONFIG.maxOutputTokens} tokens). This is paramount for complete document extraction.
8. **CRITICAL: IF NO TEXT IS FOUND OR DISCERNIBLE, YOU MUST STILL PROVIDE AN OUTPUT.** Describe the visual content of the document/image, or explicitly state "No discernible text content found. Visual content: [brief description of image/document appearance]." **DO NOT return an empty response.**

`;

    if (fileType === 'application/pdf') {
        basePrompt += `PDF EXTRACTION SPECIFICS:
- Extract text from ALL pages in the document.
- Include headers/footers only if they contain meaningful content.
- Extract table contents maintaining their structure.
- Include any text in forms, annotations, or structured layouts.
- Preserve reading order across columns and pages.
- Handle multi-column layouts appropriately.

`;
    } else if (fileType.startsWith('image/')) {
        basePrompt += `IMAGE CONTENT DESCRIPTION & TEXT EXTRACTION:
- Describe the visual content of the image in detail.
- Extract any and all readable text present within the image.
- Combine the visual description and extracted text into a coherent output.
- If there's a primary subject, clearly state it.

`;
    }

    basePrompt += `\nBegin complete extraction:`;
    return basePrompt;
};

/**
 * Extracts content from a PDF or image using the Gemini LLM in a single pass.
 * @param fileContentBase64 Base64 encoded file data.
 * @param fileType MIME type of the file.
 * @param geminiApiKey Your Gemini API key.
 * @returns The extracted text from the file.
 */
const extractContentWithGemini = async (
    fileContentBase64: string,
    fileType: string,
    geminiApiKey: string
): Promise<string> => {
    const prompt = getLlmExtractionPrompt(fileType);

    const payload = {
        contents: [
            {
                role: "user",
                parts: [
                    { text: prompt },
                    {
                        inline_data: {
                            mime_type: fileType,
                            data: fileContentBase64
                        }
                    }
                ]
            }
        ],
        generationConfig: {
            temperature: LLM_CONFIG.temperature,
            topK: LLM_CONFIG.topK,
            topP: LLM_CONFIG.topP,
            maxOutputTokens: LLM_CONFIG.maxOutputTokens,
            candidateCount: LLM_CONFIG.candidateCount,
        },
        safetySettings: LLM_CONFIG.safetySettings
    };

    const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`;

    (`Sending LLM request for ${fileType}. Input Base64 size: ${fileContentBase64.length} bytes.`);
    (`Payload structure (truncated data for log):`, JSON.stringify({
        contents: payload.contents.map(c => ({
            ...c,
            parts: c.parts.map(p => p.inline_data ? { ...p, inline_data: { mime_type: p.inline_data.mime_type, data: `[${p.inline_data.data.length} bytes]` } } : p)
        })),
        generationConfig: payload.generationConfig,
        safetySettings: payload.safetySettings
    }, null, 2));

    const response = await fetch(geminiApiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    (`LLM API response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Gemini API error (${response.status}): ${errorData.error?.message || response.statusText}`);
    }

    const result = await response.json();
    const extractedText = result.candidates?.[0]?.content?.parts?.[0]?.text;
    const finishReason = result.candidates?.[0]?.finishReason;

    (`LLM raw response text length: ${extractedText?.length || 0}, finishReason: ${finishReason}`);
    if (extractedText && extractedText.length > 0) {
        (`LLM raw snippet (first 200 chars): "${extractedText.substring(0, Math.min(extractedText.length, 200))}..."`);
    } else {
        (`LLM raw snippet: (empty)`);
    }

    if (!extractedText || extractedText.trim().length === 0) {
        // LLM returned no content despite strong prompting. This is an issue.
        throw new Error('LLM returned no discernible content from the document/image. This might indicate an issue with the document content or LLM processing.');
    }

    if (finishReason === 'MAX_TOKENS') {
        console.warn('Gemini extraction hit token limit. Content might be truncated. Consider client-side chunking for extremely large documents.');
    }

    (`Successfully extracted ${extractedText.length} characters using Gemini for ${fileType}.`);
    return extractedText.trim(); // Final trim before returning
};

/**
 * Extracts content from a plain text file directly.
 * @param fileUrl The URL of the text file.
 * @returns The extracted text content.
 */
const extractPlainTextDirectly = async (fileUrl: string): Promise<string> => {
    ('Attempting direct text file extraction...');

    const response = await fetch(fileUrl);
    if (!response.ok) {
        throw new Error(`Failed to fetch text file: ${response.statusText}`);
    }

    const text = await response.text();
    (`Direct extraction successful: ${text.length} characters`);
    return text.trim(); // Trim whitespace from direct text extraction
};

/**
 * Orchestrates content extraction based on file type.
 * @param fileContentBase64 Base64 encoded file data (for LLM).
 * @param fileType MIME type of the file.
 * @param fileUrl URL of the file (for direct text extraction).
 * @param geminiApiKey Your Gemini API key.
 * @param documentId ID of the document being processed.
 * @param supabaseAdmin Supabase client for DB updates.
 * @returns The extracted text content.
 */
const extractTextWithOptimalStrategy = async (
    fileContentBase64: string,
    fileType: string,
    fileUrl: string,
    geminiApiKey: string,
    documentId: string,
    supabaseAdmin: any
): Promise<string> => {

    if (fileType === 'text/plain') {
        return await extractPlainTextDirectly(fileUrl);
    } else if (fileType === 'application/pdf' || fileType.startsWith('image/')) {
        return await extractContentWithGemini(fileContentBase64, fileType, geminiApiKey);
    } else {
        const errorMessage = `Content extraction not supported for file type: ${fileType}.`;
        console.warn(`Edge Function: Fallback for unexpected file type ${fileType}.`);
        throw new Error(errorMessage);
    }
};


serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
            status: 405,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    let payload;
    let documentId;
    let userId;
    let supabaseAdmin;

    try {
        // Parse request body
        try {
            payload = await req.json();
        } catch {
            return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const { documentId: reqDocumentId, file_url, file_type, userId: reqUserId, imageMimeType, fileUrl: imageUrl } = payload;
        documentId = reqDocumentId;
        userId = reqUserId; // Ensure userId is captured

        const finalFileUrl = file_url || imageUrl;
        const finalFileType = file_type || imageMimeType;


        // Initialize Supabase client for admin operations
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

        if (!supabaseUrl || !supabaseServiceRoleKey) {
            throw new Error('Supabase configuration missing: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables not set.');
        }

        supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
            auth: { persistSession: false }
        });

        // Update document status to 'pending' as a safety net (client should ideally set this)
        if (documentId) {
            await supabaseAdmin
                .from('documents')
                .update({
                    processing_status: 'pending',
                    processing_error: null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', documentId);
        }

        // Validate required parameters
        if (!finalFileUrl || !finalFileType || !documentId || !userId) {
            const errorMessage = 'Missing required parameters: file_url, file_type, documentId, or userId.';

            if (documentId && supabaseAdmin) {
                await supabaseAdmin.from('documents').update({
                    processing_status: 'failed',
                    processing_error: errorMessage,
                    updated_at: new Date().toISOString()
                }).eq('id', documentId);
            }

            return new Response(JSON.stringify({ error: errorMessage }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Validate supported file type
        if (!SUPPORTED_MIME_TYPES.includes(finalFileType)) {
            const errorMessage = `Unsupported file type: ${finalFileType}. Supported types are: ${SUPPORTED_MIME_TYPES.join(', ')}`;

            await supabaseAdmin.from('documents').update({
                processing_status: 'failed',
                processing_error: errorMessage,
                updated_at: new Date().toISOString()
            }).eq('id', documentId);

            return new Response(JSON.stringify({ error: errorMessage }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Get Gemini API key from environment variables
        const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
        if (!geminiApiKey) {
            throw new Error('GEMINI_API_KEY environment variable not configured.');
        }

        // Download file content (ArrayBuffer needed for LLM and direct text)
        (`Downloading file: ${finalFileUrl}`);
        const fileResponse = await fetch(finalFileUrl, {
            method: 'GET',
            headers: { 'User-Agent': 'Supabase-Edge-Function/1.0' }
        });

        if (!fileResponse.ok) {
            throw new Error(`File download failed: ${fileResponse.status} ${fileResponse.statusText}`);
        }

        const arrayBuffer = await fileResponse.arrayBuffer();
        const fileContentBase64 = encodeBase64(arrayBuffer); // Base64 for LLM

        (`File downloaded successfully: ${arrayBuffer.byteLength} bytes, Type: ${finalFileType}`);

        // Extract text using the optimal strategy (single-pass LLM or direct text read)
        const extractedText = await extractTextWithOptimalStrategy(
            fileContentBase64,
            finalFileType,
            finalFileUrl,
            geminiApiKey,
            documentId,
            supabaseAdmin
        );

        // Validate extraction result
        if (!extractedText || extractedText.trim().length === 0) {
            throw new Error('No content could be extracted from the document.');
        }

        (`Final extraction completed: ${extractedText.length} characters.`);

        // Update document with final results in Supabase
        const { error: updateError } = await supabaseAdmin
            .from('documents')
            .update({
                content_extracted: extractedText,
                processing_status: 'completed',
                processing_error: null,
                updated_at: new Date().toISOString()
            })
            .eq('id', documentId);

        if (updateError) {
            throw new Error(`Database update failed: ${updateError.message}`);
        }

        // Return success response
        return new Response(JSON.stringify({
            success: true,
            content_extracted: extractedText,
            documentId: documentId,
            status: 'completed',
            extractedLength: extractedText.length,
            message: 'Document content extracted successfully.'
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        });

    } catch (error) {
        console.error('Document extraction error:', error);

        const errorMessage = error?.message || 'Unknown error occurred during text extraction';

        // Update document status to 'failed' in case of an error
        try {
            if (documentId && supabaseAdmin) {
                await supabaseAdmin.from('documents').update({
                    processing_status: 'failed',
                    processing_error: errorMessage,
                    updated_at: new Date().toISOString()
                }).eq('id', documentId);
            }
        } catch (updateErr) {
            console.error("Failed to update document status to failed:", updateErr);
        }

        return new Response(JSON.stringify({
            success: false,
            error: errorMessage,
            documentId: documentId,
            status: 'failed'
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
        });
    }
});
