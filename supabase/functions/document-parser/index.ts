import "https://deno.land/x/xhr@0.2.0/mod.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { pdfText } from "jsr:@pdf/pdftext@1.3.2"; // Switched to @pdf/pdftext from JSR
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { logSystemError } from '../_shared/errorLogger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { file_url, file_type } = await req.json();

    // console.log('Document Parser Function: Received request for file_url:', file_url, 'file_type:', file_type);

    if (!file_url || !file_type) {
      return new Response(JSON.stringify({ error: 'Missing file_url or file_type in request body.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let extractedContent = "";

    // Fetch the file content
    const fileResponse = await fetch(file_url);
    if (!fileResponse.ok) {
      const errorText = await fileResponse.text();
      // console.error('Document Parser Function: Failed to fetch file from URL:', fileResponse.status, fileResponse.statusText, errorText);
      throw new Error(`Failed to fetch file from URL: ${fileResponse.statusText}. Details: ${errorText}`);
    }

    if (file_type === 'text/plain') {
      // Handle plain text files
      extractedContent = await fileResponse.text();
      // console.log('Document Parser Function: Extracted plain text. Length:', extractedContent.length);
    } else if (file_type === 'application/pdf') {
      // Handle PDF files using @pdf/pdftext
      try {
        const pdfBytes = await fileResponse.arrayBuffer();
        const pdfUint8Array = new Uint8Array(pdfBytes);
        
        // pdfText returns a map where keys are page numbers (1-indexed) and values are text
        const pagesText = await pdfText(pdfUint8Array); 
        
        // Concatenate text from all pages
        extractedContent = Object.values(pagesText).join('\n\n'); 
        
        // console.log('Document Parser Function: Extracted PDF text using @pdf/pdftext. Length:', extractedContent.length);
      } catch (pdfError) {
        // console.error('Document Parser Function: Error extracting text from PDF with @pdf/pdftext:', pdfError);
        extractedContent = `[Error extracting text from PDF: ${pdfError.message || 'Unknown error'}]`;
      }
    } else if (file_type === 'application/msword' || file_type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      // Handle DOC/DOCX files (still placeholder as robust Deno libraries are scarce)
      // console.warn('Document Parser Function: DOC/DOCX parsing is complex in Deno. Returning placeholder.');
      extractedContent = `[Content extraction for DOC/DOCX files is not fully supported in this demo. Only metadata stored.]`;
    } else {
      // Unsupported file types
      // console.warn(`Document Parser Function: Unsupported file type for extraction: ${file_type}.`);
      extractedContent = `[Content extraction for ${file_type} is not supported.]`;
    }

    // console.log('Document Parser Function: Final extracted content length:', extractedContent.length);
    if (extractedContent.length > 50) {
      // console.log('Document Parser Function: Final extracted content preview:', extractedContent.substring(0, 50) + '...');
    } else {
      // console.log('Document Parser Function: Final extracted content:', extractedContent);
    }

    return new Response(JSON.stringify({ content_extracted: extractedContent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    // ── Log to system_error_logs ──
    try {
      const _logClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      await logSystemError(_logClient, {
        severity: 'error',
        source: 'document-parser',
        message: error?.message || String(error),
        details: { stack: error?.stack },
      });
    } catch (_logErr) { console.error('[document-parser] Error logging failed:', _logErr); }
    // console.error('Document Parser Edge Function Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

