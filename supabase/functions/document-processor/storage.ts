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

const BINARY_TYPES = ['image', 'pdf', 'document', 'spreadsheet', 'presentation', 'archive', 'audio', 'video'];

export async function saveFileToDatabase(file: any, userId: string): Promise<string | null> {
  let fileUrl = null;
  let processingStatus = file.processing_status;
  let processingError = file.processing_error;

  // ensure any binary file is uploaded if not already
  if (BINARY_TYPES.includes(file.type) && !file.file_url) {
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