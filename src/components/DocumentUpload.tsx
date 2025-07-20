// src/components/DocumentUpload.tsx
import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, Image, Loader2, Check, XCircle, AlertTriangle } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Document } from '../types/Document'; // Assuming Document type is here
import { useAuth } from '../hooks/useAuth'; // Import useAuth to get the user ID

interface DocumentUploadProps {
  documents: Document[];
  onDocumentUploaded: (document: Document) => void;
  onDocumentDeleted: (documentId: string) => void;
}

export const DocumentUpload: React.FC<DocumentUploadProps> = ({ documents, onDocumentUploaded, onDocumentDeleted }) => {
  const { user } = useAuth(); // Get the current authenticated user
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0); // This state is not currently used for visual progress
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Basic file type check
      if (!file.type.startsWith('text/') && file.type !== 'application/pdf' && !file.type.startsWith('image/')) {
        toast.error('Unsupported file type. Please upload text, PDF, or image files.');
        setSelectedFile(null);
        return;
      }
      // Max file size 10MB for documents, 5MB for images (handled by backend for images)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size exceeds 10MB limit.');
        setSelectedFile(null);
        return;
      }
      setSelectedFile(file);
    } else {
      setSelectedFile(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !user?.id) {
      toast.error('Please select a file and ensure you are logged in.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0); // Reset progress

    const isImage = selectedFile.type.startsWith('image/');
    const fileExtension = selectedFile.name.split('.').pop();
    const fileName = `${crypto.randomUUID()}.${fileExtension}`;
    const filePath = `user_uploads/${user.id}/${fileName}`; // Store in user-specific folder

    let newDocument: Document | null = null;

    try {
      // 1. Upload file to Supabase Storage
      toast.info(`Uploading ${isImage ? 'image' : 'document'}...`);
      const { data: storageData, error: storageError } = await supabase.storage
        .from('documents') // Your storage bucket for documents/images
        .upload(filePath, selectedFile, {
          cacheControl: '3600',
          upsert: false,
          // You can add onUploadProgress if needed here, but it's not directly exposed by Supabase client for simple upload
        });

      if (storageError) {
        throw storageError;
      }

      const { data: publicUrlData } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      const fileUrl = publicUrlData.publicUrl;

      // 2. Create a pending document entry in the 'documents' table
      toast.info(`Registering ${isImage ? 'image' : 'document'}...`);
      const { data: docData, error: dbError } = await supabase
        .from('documents')
        .insert({
          title: selectedFile.name,
          file_url: fileUrl,
          type: isImage ? 'image' : 'text', // Changed 'document' to 'text'
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          content_extracted: '', // Initially empty, will be filled after processing
          processing_error: null, // Initially null, will be filled after processing
          user_id: user.id,
          file_name: selectedFile.name,
          file_type: selectedFile.type,
          file_size: selectedFile.size,
          processing_status: 'pending', // Initial status
          file_path: filePath, // Store the path for deletion later
        })
        .select()
        .single();

      if (dbError) {
        throw dbError;
      }
      newDocument = {
        ...docData,
        processing_error: docData.processing_error as string,
        processing_status: docData.processing_status as string,
      };
      onDocumentUploaded(newDocument); // Add to local state immediately with pending status
      toast.success(`${isImage ? 'Image' : 'Document'} uploaded and registered! Processing content...`);

      // 3. Trigger content analysis (Edge Function call)
      if (isImage) {
        // For images, call the new image-analyzer function
        const reader = new FileReader();
        reader.readAsDataURL(selectedFile);
        reader.onloadend = async () => {
          const imageDataBase64 = (reader.result as string).split(',')[1]; // Get base64 part
          const imageMimeType = selectedFile.type;

          try {
            const response = await fetch('/functions/v1/image-analyzer', { // Path to your new Edge Function
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${await supabase.auth.getSession().then(s => s.data.session?.access_token)}`
              },
              body: JSON.stringify({
                documentId: newDocument!.id,
                imageDataBase64: imageDataBase64,
                imageMimeType: imageMimeType,
                userId: user.id,
              }),
            });

            if (!response.ok) {
              const errorBody = await response.json();
              throw new Error(`Image analysis failed: ${errorBody.error}`);
            }

            const result = await response.json();
            toast.success('Image analyzed and description saved!');
            // The document is updated by the Edge Function, so we might need to refetch or update state
            // For simplicity, we'll just log success. The main app data loader should pick up the change.
          } catch (analysisError: any) {
            console.error('Error calling image-analyzer:', analysisError);
            toast.error(`Image analysis failed: ${analysisError.message}`);
            // Update document status to failed if analysis fails
            await supabase.from('documents')
              .update({ processing_status: 'failed', processing_error: analysisError.message })
              .eq('id', newDocument!.id);
          }
        };
      } else {
        // For text documents (PDF, TXT), call the existing document-analyzer function
        // (Assuming you have one or will create one)
        // This part remains similar to how you'd handle text document processing.
        // For now, we'll just mark it as completed if no specific text analysis is implemented yet.
        // In a real app, you'd call another Edge Function here for text extraction/summarization.
        await supabase.from('documents')
            .update({ processing_status: 'completed' })
            .eq('id', newDocument!.id);
        toast.success('Document uploaded and ready!');
      }

    } catch (error: any) {
      console.error('Upload or document registration error:', error);
      toast.error(`Upload failed: ${error.message}`);
      // Clean up if initial upload or registration fails
      if (newDocument?.id) {
        await supabase.from('documents').delete().eq('id', newDocument.id);
      }
      if (filePath) {
        await supabase.storage.from('documents').remove([filePath]);
      }
    } finally {
      setIsUploading(false);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = ''; // Clear file input
      }
      // You might want to trigger a refetch of documents in useAppData here
      
      // or ensure onDocumentUploaded pushes the final state.
    }
  };

  const handleDeleteDocument = async (documentId: string, filePath: string) => {
    // Using a custom modal/dialog for confirmation instead of window.confirm
    // For this example, I'll use a simple toast with an action, or you'd integrate a proper modal component.
    // As per instructions, avoid window.confirm().
    toast.info('Deleting document...', {
      action: {
        label: 'Confirm Delete',
        onClick: async () => {
          try {
            // 1. Delete from Supabase Storage
            const { error: storageError } = await supabase.storage
              .from('documents')
              .remove([filePath]);

            if (storageError) {
              throw storageError;
            }

            // 2. Delete from 'documents' table
            const { error: dbError } = await supabase
              .from('documents')
              .delete()
              .eq('id', documentId);

            if (dbError) {
              throw dbError;
            }

            onDocumentDeleted(documentId);
            toast.success('Document deleted successfully!');
          } catch (error: any) {
            console.error('Error deleting document:', error);
            toast.error(`Failed to delete document: ${error.message}`);
          }
        }
      },
      duration: 5000, // Give user time to click confirm
    });
  };

  return (
    <div className="p-4 sm:p-6 bg-white rounded-lg shadow-md dark:bg-gray-900 dark:text-gray-100">
      <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mb-4 sm:mb-6 dark:text-gray-100">Document & Image Upload</h2>

      <Card className="mb-4 sm:mb-6 border-2 border-dashed border-blue-200 bg-blue-50 hover:border-blue-300 dark:bg-gray-800 dark:border-gray-700 dark:hover:border-blue-600 transition-colors cursor-pointer">
        <CardContent className="p-4 sm:p-6 text-center" onClick={() => fileInputRef.current?.click()}>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept=".txt,.pdf,image/*" // Accept text, pdf, and all image types
          />
          <UploadCloud className="h-8 w-8 sm:h-10 sm:w-10 text-blue-500 mx-auto mb-2 sm:mb-3" />
          <p className="text-slate-700 font-medium text-sm sm:text-base dark:text-gray-200">Drag & drop your file here, or <span className="text-blue-600 dark:text-blue-400">click to browse</span></p>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 dark:text-gray-400">Supports text, PDF, and image files (Max 10MB)</p>
          {selectedFile && (
            <div className="mt-3 sm:mt-4 flex items-center justify-center gap-2 text-blue-600 dark:text-blue-400">
              <FileText className="h-4 w-4" />
              <span className="text-sm sm:text-base">{selectedFile.name}</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => { e.stopPropagation(); setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                className="h-6 w-6 text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                <XCircle className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Button
        onClick={handleUpload}
        disabled={!selectedFile || isUploading || !user?.id}
        className="w-full py-2 sm:py-2.5 text-sm sm:text-base bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 mb-6 sm:mb-8 rounded-md"
      >
        {isUploading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Uploading & Analyzing...
          </>
        ) : (
          <>
            <UploadCloud className="h-4 w-4 mr-2" />
            Upload & Analyze File
          </>
        )}
      </Button>

      <h3 className="text-lg sm:text-xl font-semibold text-slate-800 mb-3 sm:mb-4 dark:text-gray-100">Your Uploaded Files</h3>
      {documents.length === 0 ? (
        <p className="text-slate-500 text-center py-6 sm:py-8 text-sm sm:text-base dark:text-gray-400">No documents or images uploaded yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((doc) => (
            <Card key={doc.id} className="border border-slate-200 shadow-sm dark:bg-gray-800 dark:border-gray-700">
              <CardContent className="p-4 flex flex-col h-full">
                <div className="flex items-center gap-3 mb-3">
                  {doc.type === 'image' ? (
                    <Image className="h-5 w-5 sm:h-6 sm:w-6 text-purple-500 flex-shrink-0" />
                  ) : (
                    <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-blue-500 flex-shrink-0" />
                  )}
                  <h4 className="font-semibold text-slate-800 text-base sm:text-lg flex-grow truncate dark:text-gray-100">{doc.title}</h4>
                  {doc.processing_status === 'pending' && (
                    <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500 animate-spin"  />
                  )}
                  {doc.processing_status === 'completed' && (
                    <Check className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
                  )}
                  {doc.processing_status === 'failed' && (
                    <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-red-500"  />
                  )}
                </div>
                {doc.type === 'image' && doc.file_url && (
                    <div className="mb-3">
                        <img
                            src={doc.file_url}
                            alt={doc.title}
                            className="max-w-full h-24 sm:h-32 object-contain rounded-md mx-auto border border-slate-200 dark:border-gray-600"
                            onError={(e) => {
                                e.currentTarget.src = 'https://placehold.co/128x96/e0e0e0/666666?text=Image+Error';
                                e.currentTarget.alt = 'Image failed to load';
                            }}
                        />
                    </div>
                )}
                <p className="text-xs sm:text-sm text-slate-600 mb-3 line-clamp-3 dark:text-gray-300">{doc.content_extracted || 'No content extracted yet.'}</p>
                {doc.processing_status === 'failed' && doc.processing_error && (
                  <p className="text-xs text-red-500 mt-1 dark:text-red-400">Error: {doc.processing_error}</p>
                )}
                <div className="mt-auto flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteDocument(doc.id, doc.file_url)}
                    className="text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900 dark:border-red-700"
                    disabled={isUploading}
                  >
                    <XCircle className="h-4 w-4 mr-2" /> Delete
                  </Button>
                  {/* Potentially add a "View" button here for image or full document */}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
