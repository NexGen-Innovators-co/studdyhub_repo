import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sanitizeFileName } from './utils.ts';

// ============================================================================
// CLIENT
// ============================================================================

const supabaseUrl        = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    'Missing Supabase configuration: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables are not set.',
  );
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ============================================================================
// STORAGE UPLOAD
// ============================================================================

export async function uploadFileToStorage(file: any, userId: string): Promise<string | null> {
  try {
    const bucketName  = 'chat-documents';
    const safeFileName = sanitizeFileName(file.name);
    const filePath    = `${userId}/${crypto.randomUUID()}-${safeFileName}`;

    let fileDataToUpload: Uint8Array | Blob;

    if (file.data) {
      const binaryString   = atob(file.data);
      fileDataToUpload     = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        (fileDataToUpload as Uint8Array)[i] = binaryString.charCodeAt(i);
      }
    } else if (file.content) {
      fileDataToUpload = new Blob([file.content], { type: file.mimeType });
    } else {
      return null;
    }

    const { error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, fileDataToUpload, { contentType: file.mimeType, upsert: false });

    if (error) return null;

    const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(filePath);
    return publicUrlData?.publicUrl ?? null;
  } catch {
    return null;
  }
}

// ============================================================================
// DATABASE SAVE
// ============================================================================

// Hard cap when re-assembling parts — matches resume-processing's
// MAX_PROCESS_BYTES. Anything larger OOMs the free-plan edge isolate
// ("Memory limit exceeded" seen in the function logs).
const CHUNK_ASSEMBLY_MAX = 100 * 1024 * 1024;

/**
 * Downloads every part written by the client's chunked upload, in order, and
 * concatenates them into a single in-memory buffer. Returns null on any
 * missing part or when the assembled size would exceed CHUNK_ASSEMBLY_MAX.
 */
export async function assembleChunksFromStorage(
  paths: string[],
  bucket = 'documents',
): Promise<Uint8Array | null> {
  try {
    const parts: Uint8Array[] = [];
    let total = 0;

    for (const path of paths) {
      const { data, error } = await supabase.storage.from(bucket).download(path);
      if (error || !data) return null;
      const bytes = new Uint8Array(await data.arrayBuffer());
      total += bytes.byteLength;
      if (total > CHUNK_ASSEMBLY_MAX) return null;
      parts.push(bytes);
    }

    const assembled = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) {
      assembled.set(part, offset);
      offset += part.byteLength;
    }
    return assembled;
  } catch {
    return null;
  }
}

const BINARY_TYPES = ['image', 'pdf', 'document', 'spreadsheet', 'presentation', 'archive', 'audio', 'video'];

export async function saveFileToDatabase(file: any, userId: string): Promise<string | null> {
  let fileUrl = null;
  let processingStatus = file.processing_status;
  let processingError = file.processing_error;

  // Chunked uploads already live in the bucket as their parts — never
  // "upload" the placeholder content as if it were the real file.
  const chunkedParts = file.processing_metadata?.chunk_paths;
  const isChunked = Array.isArray(chunkedParts) && chunkedParts.length > 0;

  // ensure any binary file is uploaded if not already
  if (BINARY_TYPES.includes(file.type) && !file.file_url && !isChunked) {
    fileUrl = await uploadFileToStorage(file, userId);
    if (!fileUrl) {
      processingStatus = 'failed';
      processingError = processingError ?? 'Failed to upload file to storage';
      return null;
    }
  }

  try {
    // Cap content at 1MB for DB storage — very large extractions should be stored in Storage, not DB column
    const DB_CONTENT_CAP = 1 * 1024 * 1024;
    const contentForDb = file.content && file.content.length > DB_CONTENT_CAP
      ? file.content.slice(0, DB_CONTENT_CAP) + '\n\n[DB_TRUNCATED: full content too large for column]'
      : file.content;

    if (file.id) {
      // existing document – update instead of insert
      const updatePayload: any = {
        title: file.name,
        file_name: file.name,
        file_url: fileUrl ?? file.file_url ?? '',
        file_type: file.mimeType,
        file_size: file.size,
        content_extracted: contentForDb,
        type: file.type,
        processing_status: processingStatus,
        processing_error: processingError,
        processing_metadata: file.processing_metadata ?? null,
      };

      const { data, error } = await supabase
        .from('documents')
        .update(updatePayload)
        .eq('id', file.id)
        .select('id')
        .single();

      if (error) return null;
      return file.id;
    }

    // new document
    const { data, error } = await supabase
      .from('documents')
      .insert({
        user_id:           userId,
        title:             file.name,
        file_name:         file.name,
        file_url:          fileUrl ?? '',
        file_type:         file.mimeType,
        file_size:         file.size,
        content_extracted: contentForDb,
        type:              file.type,
        processing_status: processingStatus,
        processing_error:  processingError,
        processing_metadata: file.processing_metadata ?? null,
      })
      .select('id')
      .single();

    if (error) return null;

    file.id = data.id;
    file.file_url = fileUrl ?? '';
    return data.id;
  } catch {
    return null;
  }
}