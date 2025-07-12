import React, { useState } from 'react';
import { Upload, File, X, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Document } from '../types/Document'; // Ensure this points to your Document.ts file
import { User } from '@supabase/supabase-js'; // Import User type

interface DocumentUploadProps {
  documents: Document[];
  onDocumentUploaded: (document: Document) => void;
  onDocumentDeleted: (documentId: string) => void;
}

// Helper function to extract storage path from public URL
// This assumes your public URL structure is consistent:
// .../storage/v1/object/public/{bucketName}/{filePath}
const getStoragePathFromFileUrl = (fileUrl: string, bucketName: string): string => {
  const parts = fileUrl.split(`/storage/v1/object/public/${bucketName}/`);
  if (parts.length > 1) {
    return parts[1];
  }
  // Fallback for unexpected URL formats or if bucketName isn't found
  console.warn(`Could not extract storage path from URL: ${fileUrl} with bucket: ${bucketName}`);
  return '';
};

export const DocumentUpload: React.FC<DocumentUploadProps> = ({
  documents,
  onDocumentUploaded,
  onDocumentDeleted
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0];

    // Validate file type
    const allowedTypes = ['application/pdf', 'text/plain'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Unsupported file type. Please upload PDF or TXT files.');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size exceeds 10MB limit.');
      return;
    }

    setIsUploading(true);
    let uploadedDocumentForCallback: Document | null = null; // This will hold the Document object in the correct type
    let uploadedFilePathForCleanup: string | null = null; // This holds the storage path for potential cleanup

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        throw new Error('User not authenticated. Please log in.');
      }
      const currentUser: User = userData.user;

      // 1. Upload file to Supabase Storage
      const filePath = `${currentUser.id}/${Date.now()}-${file.name}`; // Ensure unique path per user
      uploadedFilePathForCleanup = filePath; // Store for potential cleanup if DB insert fails

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      // Get public URL of the uploaded file
      const { data: publicUrlData } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      const fileUrl = publicUrlData.publicUrl;

      // 2. Invoke Supabase Edge Function to extract text
      // The function name 'gemini-document-extractor' should match your deployed Deno function name
      const { data: extractionData, error: extractionError } = await supabase.functions.invoke(
        'gemini-document-extractor',
        {
          body: { file_url: fileUrl, file_type: file.type },
        }
      );

      if (extractionError) {
        throw new Error(`Text extraction failed: ${extractionError.message}`);
      }

      const extractedText = extractionData?.content_extracted || "";

      // 3. Save document metadata and extracted text to Supabase database
      const { data, error: dbError } = await supabase
        .from('documents')
        .insert([
          {
            user_id: currentUser.id, // Required by your schema
            title: file.name.split('.')[0],
            file_name: file.name,
            file_size: file.size,
            file_type: file.type,
            file_url: fileUrl,
            content_extracted: extractedText, // Corrected column name based on your schema
          },
        ])
        .select('*')
        .single();

      if (dbError) {
        throw new Error(`Database insertion failed: ${dbError.message}`);
      }

      // Transform the Supabase response data to match the 'Document' interface
      // converting string dates to Date objects.
      uploadedDocumentForCallback = {
        id: data.id,
        user_id: data.user_id,
        title: data.title,
        file_name: data.file_name,
        file_url: data.file_url,
        file_type: data.file_type,
        file_size: data.file_size ?? undefined, // Handle null from DB to undefined for optional interface property
        content_extracted: data.content_extracted ?? undefined, // Handle null from DB to undefined
        created_at: new Date(data.created_at), // Convert string to Date
        updated_at: new Date(data.updated_at), // Convert string to Date
      };

      toast.success('Document uploaded and processed successfully!');
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message);
      // If upload to storage succeeded but extraction/db failed, delete the uploaded file
      if (uploadedFilePathForCleanup) {
        await supabase.storage.from('documents').remove([uploadedFilePathForCleanup]);
      }
    } finally {
      setIsUploading(false);
      if (uploadedDocumentForCallback) {
        onDocumentUploaded(uploadedDocumentForCallback);
      }
    }
  };

  const handleDeleteDocument = async (document: Document) => {
    try {
      // Extract the storage path from the file_url for deletion
      const storagePath = getStoragePathFromFileUrl(document.file_url, 'documents');
      if (!storagePath) {
        throw new Error('Could not determine storage path from file URL for deletion.');
      }

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([storagePath]);

      if (storageError) {
        throw new Error(`Failed to delete file from storage: ${storageError.message}`);
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('documents')
        .delete()
        .eq('id', document.id);

      if (dbError) {
        throw new Error(`Failed to delete document from database: ${dbError.message}`);
      }

      toast.success('Document deleted successfully!');
      onDocumentDeleted(document.id);
    } catch (error: any) {
      console.error('Delete error:', error);
      toast.error(error.message);
    }
  };

  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileUpload(e.target.files);
  };

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
        dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50'
      }`}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      <input
        type="file"
        id="file-upload"
        className="hidden"
        onChange={handleFileChange}
        accept=".pdf,.txt"
        disabled={isUploading}
      />
      <div className="flex flex-col items-center justify-center space-y-3">
        <p className="text-gray-600">Drag and drop files here, or</p>
        <Button
          onClick={() => document.getElementById('file-upload')?.click()}
          disabled={isUploading}
        >
          {isUploading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Uploading...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Choose Files
            </>
          )}
        </Button>
      </div>

      {/* Documents List */}
      {documents.length > 0 && (
        <div className="space-y-3 mt-6">
          <h4 className="font-medium text-gray-900">Uploaded Documents</h4>
          {documents.map((document) => (
            <Card key={document.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <File className="h-8 w-8 text-blue-600" />
                    <div>
                      <h5 className="font-medium text-gray-900">{document.title}</h5>
                      <p className="text-sm text-gray-500">
                        {document.file_name} • {Math.round((document.file_size || 0) / 1024)}KB
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteDocument(document)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};