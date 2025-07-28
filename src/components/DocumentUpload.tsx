// src/components/DocumentUpload.tsx
import React, { useState, useRef, useCallback } from 'react'; // Added useCallback
import { UploadCloud, FileText, Image, Loader2, Check, XCircle, AlertTriangle, RefreshCw, Eye, Download, Calendar, HardDrive } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Document } from '../types/Document';
import { useAuth } from '../hooks/useAuth';
import { generateId } from '@/utils/helpers'; // Assuming generateId is available here

interface DocumentUploadProps {
  documents: Document[];
  onDocumentUploaded: (document: Document) => void; // This prop is now primarily for initial DB insert feedback
  onDocumentDeleted: (documentId: string) => void;
  onDocumentUpdated: (document: Document) => void; // This will now be used less directly for status updates
}

export const DocumentUpload: React.FC<DocumentUploadProps> = ({ documents, onDocumentUploaded, onDocumentDeleted, onDocumentUpdated }) => {
  const { user } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState(0); // This might become less relevant with background processing
  const [dragActive, setDragActive] = useState(false);
  // processingDocuments now explicitly tracks documents for which analysis has been *triggered*
  // and we are awaiting a DB update (either initial trigger or retry).
  const [processingDocuments, setProcessingDocuments] = useState<Set<string>>(new Set()); 
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // New function to handle file selection logic
  const handleFileSelection = useCallback((file: File) => {
    // Basic validation
    const MAX_FILE_SIZE_MB = 10;
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast.error(`File size exceeds ${MAX_FILE_SIZE_MB}MB limit.`);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const allowedTypes = ['application/pdf', 'text/plain', 'image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Unsupported file type. Please upload PDF, TXT, JPG, PNG, GIF, or WEBP files.');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setSelectedFile(file);
  }, []);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileSelection(file);
    } else {
      setSelectedFile(null);
    }
  };

  // Centralized function to trigger analysis for a given document
  const triggerAnalysis = async (doc: Document): Promise<void> => {
    if (!user?.id) {
      toast.error('User not authenticated.');
      return;
    }

    // Prevent multiple simultaneous analysis requests for the same document
    if (processingDocuments.has(doc.id)) {
      toast.warning('Analysis is already in progress for this document.');
      return;
    }

    // Add document to the set of actively processing documents
    setProcessingDocuments(prev => new Set(prev).add(doc.id));
    
    try {
      toast.info(`${doc.processing_status === 'failed' ? 'Retrying' : 'Starting'} analysis for "${doc.title}"...`);
      
      // Optimistically update document status to pending locally if it's a retry from a 'failed' state.
      // For initial upload, the document is already inserted as 'pending' by handleUpload.
      if (doc.processing_status === 'failed') {
        onDocumentUpdated({ ...doc, processing_status: 'pending', processing_error: null });
      }

      const isImage = doc.type === 'image';
      // Determine the correct Edge Function URL based on document type
      const functionUrl = isImage 
        ? 'https://kegsrvnywshxyucgjxml.supabase.co/functions/v1/image-analyzer' 
        : 'https://kegsrvnywshxyucgjxml.supabase.co/functions/v1/gemini-document-extractor';
      
      // Construct the payload for the Edge Function
      const bodyPayload = isImage ? {
        documentId: doc.id,
        fileUrl: doc.file_url,
        imageMimeType: doc.file_type,
        userId: user.id,
      } : {
        documentId: doc.id,
        file_url: doc.file_url,
        file_type: doc.file_type,
        userId: user.id,
      };

      // Get a fresh authentication session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid authentication token found');
      }

      // Call the Edge Function. DO NOT AWAIT HERE.
      // The Edge Function will update the database, and the real-time listener will update the UI.
      fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(bodyPayload),
      })
      .then(async response => {
        // Handle response from the Edge Function call itself (not the processing result)
        if (!response.ok) {
          const errorBody = await response.json();
          const errorMessage = `Analysis trigger failed: ${errorBody.error || 'Unknown server error'}`;
          console.error('Edge function trigger response error:', errorMessage);
          toast.error(errorMessage);
          // Optimistically update local state to failed, this will be overwritten by DB if Edge Function also updates DB
          onDocumentUpdated({ 
            ...doc, 
            processing_status: 'failed', 
            processing_error: errorMessage 
          });
        } else {
          // Response indicates function was successfully called, not necessarily that processing completed
          console.log('Edge function triggered successfully for document:', doc.id);
        }
      })
      .catch(analysisError => {
        // Handle network errors or unexpected errors during the fetch call
        console.error('Network or unexpected error triggering analysis:', analysisError);
        toast.error(`Failed to trigger analysis: ${analysisError.message}`);
        onDocumentUpdated({ 
          ...doc, 
          processing_status: 'failed', 
          processing_error: analysisError.message 
        });
      })
      .finally(() => {
        // Remove document from the set of actively processing documents once the trigger call finishes
        setProcessingDocuments(prev => {
          const newSet = new Set(prev);
          newSet.delete(doc.id);
          return newSet;
        });
      });
      
    } catch (analysisError: any) {
      // Catch errors that occur before the fetch call is even made (e.g., no user, no token)
      console.error('Error setting up analysis request:', analysisError);
      toast.error(`Failed to initiate analysis: ${analysisError.message}`);
      
      // Update local state with error
      onDocumentUpdated({ 
        ...doc, 
        processing_status: 'failed', 
        processing_error: analysisError.message 
      });
      // Remove from processing set
      setProcessingDocuments(prev => {
        const newSet = new Set(prev);
        newSet.delete(doc.id);
        return newSet;
      });
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !user?.id) {
      toast.error('Please select a file and ensure you are logged in.');
      return;
    }

    // Prevent multiple simultaneous uploads
    if (isUploading) {
      toast.warning('Upload already in progress. Please wait...');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0); // Reset progress

    const isImage = selectedFile.type.startsWith('image/');
    const fileExtension = selectedFile.name.split('.').pop();
    const fileName = `${generateId()}.${fileExtension}`; // Use generateId for unique file names
    const filePath = `user_uploads/${user.id}/${fileName}`;

    let newDocumentId: string | null = null;
    let uploadedFilePath: string | null = null;

    try {
      // 1. Upload file to Supabase Storage
      toast.info(`Uploading ${isImage ? 'image' : 'document'}...`);
      const { data: storageData, error: storageError } = await supabase.storage
        .from('documents')
        .upload(filePath, selectedFile, {
          cacheControl: '3600',
          upsert: false, // Do not upsert, ensure new file
        });

      if (storageError) {
        throw new Error(`Storage upload failed: ${storageError.message}`);
      }

      uploadedFilePath = filePath; // Store for cleanup if needed

      const { data: publicUrlData } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      const fileUrl = publicUrlData.publicUrl;

      // 2. Create a pending document entry in the 'documents' table
      toast.info(`Registering ${isImage ? 'image' : 'document'}...`);
      const tempDocId = generateId(); // Generate a client-side ID for the new document
      const { data: docData, error: dbError } = await supabase
        .from('documents')
        .insert({
          id: tempDocId, // Use the generated ID for the database entry
          title: selectedFile.name,
          file_url: fileUrl,
          type: isImage ? 'image' : 'text',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          content_extracted: null, // Start as null, will be populated by Edge Function
          processing_error: null, // Start as null
          user_id: user.id,
          file_name: selectedFile.name,
          file_type: selectedFile.type,
          file_size: selectedFile.size,
          processing_status: 'pending', // Initial status
        })
        .select() // Select the inserted row to get its actual data (especially ID if not using client-generated)
        .single();

      if (dbError) {
        throw new Error(`Database insertion failed: ${dbError.message}`);
      }

      newDocumentId = docData.id; // Store the actual ID from DB (should match tempDocId)
      
      // *** IMPORTANT CHANGE: Removed direct call to onDocumentUploaded here. ***
      // The useAppData real-time listener will now handle adding this document to the state
      // once it's inserted into the database. This prevents UI duplicates.
      toast.success(`${isImage ? 'Image' : 'Document'} uploaded and registered! Processing content...`);

      // 3. Trigger content analysis (DO NOT AWAIT THIS CALL).
      // This will send a request to the Edge Function, which will then update the DB.
      // The UI will be updated via the real-time listener.
      triggerAnalysis({
        id: docData.id,
        title: docData.title,
        user_id: docData.user_id,
        file_name: docData.file_name,
        file_type: docData.file_type,
        file_url: docData.file_url,
        file_size: docData.file_size,
        content_extracted: docData.content_extracted,
        type: docData.type as Document['type'],
        processing_status: docData.processing_status as string, // Ensure string primitive
        processing_error: docData.processing_error as string | null, // Ensure string primitive or null
        created_at: docData.created_at,
        updated_at: docData.updated_at,
      });

    } catch (error: any) {
      console.error('Upload or document registration error:', error);
      toast.error(`Upload failed: ${error.message}`);
      
      // Clean up on failure: if the initial document insert succeeded but something else failed,
      // attempt to remove the document from the database and local state.
      if (newDocumentId) {
        try {
          await supabase.from('documents').delete().eq('id', newDocumentId);
          onDocumentDeleted(newDocumentId); // Remove from local state via prop
        } catch (cleanupError) {
          console.error('Failed to clean up document from database:', cleanupError);
        }
      }
      
      // Clean up storage file if it was uploaded
      if (uploadedFilePath) {
        try {
          const { error: removeError } = await supabase.storage
            .from('documents')
            .remove([uploadedFilePath]);
          if (removeError) {
            console.error('Failed to clean up storage file:', removeError);
          }
        } catch (cleanupError) {
          console.error('Failed to clean up storage file:', cleanupError);
        }
      }
    } finally {
      setIsUploading(false); // Reset uploading state
      setSelectedFile(null); // Clear selected file
      if (fileInputRef.current) {
        fileInputRef.current.value = ''; // Clear file input
      }
    }
  };

  const handleDeleteDocument = async (documentId: string, fileUrl: string) => {
    // Prevent deletion if document is currently being processed (e.g., retried)
    if (processingDocuments.has(documentId)) {
      toast.error('Cannot delete document while analysis is in progress.');
      return;
    }

    // Show a confirmation toast before proceeding with deletion
    toast.info('Deleting document...', {
      action: {
        label: 'Confirm Delete',
        onClick: async () => {
          try {
            // Attempt to derive storage path from public URL for deletion from Supabase Storage
            const urlParts = fileUrl.split('public/documents/');
            let storagePath: string | null = null;
            if (urlParts.length > 1) {
              storagePath = urlParts[1];
            }

            if (storagePath) {
              const { error: storageError } = await supabase.storage
                .from('documents')
                .remove([storagePath]);

              if (storageError) {
                console.warn('Failed to delete file from storage:', storageError.message);
                toast.warning('File might not have been removed from storage. Error: ' + storageError.message);
              }
            } else {
              console.warn('Could not derive storage path from file URL. File will not be deleted from storage.');
            }

            // Delete the document from the 'documents' table in Supabase
            const { error: dbError } = await supabase
              .from('documents')
              .delete()
              .eq('id', documentId); // Delete by document ID

            if (dbError) {
              throw new Error(`Database deletion failed: ${dbError.message}`);
            }

            // The real-time listener in useAppData will automatically handle removing the document from the local state
            toast.success('Document deleted successfully!');
          } catch (error: any) {
            console.error('Error deleting document:', error);
            toast.error(`Failed to delete document: ${error.message}`);
          }
        }
      },
      duration: 5000, // Duration for the confirmation toast
    });
  };

  // Helper function to determine status badge color
  const getStatusColor = (status: string | null) => { // Allow null status
    // Ensure status is a primitive string
    const s = status as string;
    switch (s) {
      case 'completed':
        return 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10';
      case 'pending':
        return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10';
      case 'failed':
        return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10';
      default:
        return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-500/10';
    }
  };

  // Helper function to determine status icon
  const getStatusIcon = (status: string | null) => { // Allow null status
    // Ensure status is a primitive string
    const s = status as string;
    switch (s) {
      case 'completed':
        return <Check className="h-4 w-4" />;
      case 'pending':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'failed':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return null; // No icon for unknown/null status
    }
  };

  // Determines if a document is currently undergoing processing (either initial or retry)
  const isDocumentProcessing = (docId: string) => {
    // Check if it's explicitly in the processingDocuments set (e.g., for active retry clicks)
    // OR if its status from the database (via 'documents' prop) is 'pending'.
    const doc = documents.find(d => d.id === docId);
    return processingDocuments.has(docId) || (doc?.processing_status as string) === 'pending'; // Ensure string primitive
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="text-center mb-8 md:mb-12">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent mb-4">
            Document & Image Upload
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Upload your documents and images for AI-powered analysis and content extraction
          </p>
        </div>

        {/* Upload Area Section */}
        <div className="mb-8 md:mb-12">
          <Card className="overflow-hidden border-0 shadow-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
            <CardContent className="p-0">
              <div
                className={`relative border-2 border-dashed rounded-lg transition-all duration-300 ${dragActive
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 scale-[1.02]'
                  : selectedFile
                    ? 'border-green-400 bg-green-50 dark:bg-green-500/10'
                    : 'border-slate-300 dark:border-slate-600 hover:border-blue-400 dark:hover:border-blue-500'
                  } cursor-pointer p-8 md:p-12 ${isUploading ? 'pointer-events-none opacity-75' : ''}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => !isUploading && fileInputRef.current?.click()} // Trigger file input click
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  accept=".txt,.pdf,image/*" // Allowed file types
                  disabled={isUploading} // Disable input during upload
                />

                <div className="text-center">
                  <div className={`inline-flex items-center justify-center w-16 h-16 md:w-20 md:h-20 rounded-full ${selectedFile
                    ? 'bg-green-100 dark:bg-green-500/20'
                    : 'bg-blue-100 dark:bg-blue-500/20'
                    } mb-4 transition-all duration-300`}>
                    {selectedFile ? (
                      <Check className="h-8 w-8 md:h-10 md:w-10 text-green-600 dark:text-green-400" />
                    ) : (
                      <UploadCloud className="h-8 w-8 md:h-10 md:w-10 text-blue-600 dark:text-blue-400" />
                    )}
                  </div>

                  {selectedFile ? (
                    // Display selected file information
                    <div className="space-y-4">
                      <div className="flex items-center justify-center gap-3 text-green-700 dark:text-green-300">
                        {selectedFile.type.startsWith('image/') ? (
                          <Image className="h-6 w-6" />
                        ) : (
                          <FileText className="h-6 w-6" />
                        )}
                        <span className="text-lg font-semibold">{selectedFile.name}</span>
                      </div>
                      <div className="flex items-center justify-center gap-4 text-sm text-slate-600 dark:text-slate-400">
                        <span className="flex items-center gap-1">
                          <HardDrive className="h-4 w-4" />
                          {formatFileSize(selectedFile.size)}
                        </span>
                        <span className="flex items-center gap-1">
                          <FileText className="h-4 w-4" />
                          {selectedFile.type.split('/')[1]?.toUpperCase()}
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent triggering file input click again
                          setSelectedFile(null); // Clear selected file
                          if (fileInputRef.current) fileInputRef.current.value = ''; // Clear file input value
                        }}
                        disabled={isUploading}
                        className="mt-4 text-slate-600 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Remove File
                      </Button>
                    </div>
                  ) : (
                    // Display upload instructions
                    <div className="space-y-4">
                      <h3 className="text-xl md:text-2xl font-semibold text-slate-800 dark:text-slate-200">
                        Drop your files here, or <span className="text-blue-600 dark:text-blue-400">browse</span>
                      </h3>
                      <p className="text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                        Supports text files, PDFs, and all image formats up to 10MB
                      </p>
                      <div className="flex flex-wrap justify-center gap-4 text-sm text-slate-500 dark:text-slate-500">
                        <span className="px-3 py-1 bg-slate-100 dark:bg-slate-700 rounded-full">.TXT</span>
                        <span className="px-3 py-1 bg-slate-100 dark:bg-slate-700 rounded-full">.PDF</span>
                        <span className="px-3 py-1 bg-slate-100 dark:bg-slate-700 rounded-full">.JPG</span>
                        <span className="px-3 py-1 bg-slate-100 dark:bg-slate-700 rounded-full">.PNG</span>
                        <span className="px-3 py-1 bg-slate-100 dark:bg-slate-700 rounded-full">& more</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {selectedFile && (
                <div className="p-6 bg-slate-50 dark:bg-slate-700/50 border-t">
                  <Button
                    onClick={handleUpload}
                    disabled={!selectedFile || isUploading || !user?.id}
                    className="w-full py-3 text-base font-semibold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 hover:from-blue-700 hover:via-purple-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        Uploading & Analyzing...
                      </>
                    ) : (
                      <>
                        <UploadCloud className="h-5 w-5 mr-2" />
                        Upload & Analyze File
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Documents Grid Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-slate-200">
              Your Files ({documents.length})
            </h2>
          </div>

          {documents.length === 0 ? (
            // Display message when no documents are uploaded
            <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
              <CardContent className="p-12 text-center">
                <div className="w-24 h-24 mx-auto mb-6 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center">
                  <FileText className="h-12 w-12 text-slate-400 dark:text-slate-500" />
                </div>
                <h3 className="text-xl font-semibold text-slate-600 dark:text-slate-400 mb-2">
                  No files uploaded yet
                </h3>
                <p className="text-slate-500 dark:text-slate-500">
                  Upload your first document or image to get started with AI analysis
                </p>
              </CardContent>
            </Card>
          ) : (
            // Display grid of uploaded documents
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {documents.map((doc) => (
                <Card key={doc.id} className="group border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm hover:scale-[1.02] overflow-hidden">
                  <CardContent className="p-0">
                    {/* Document Preview Area */}
                    <div className="relative h-48 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800">
                      {doc.type === 'image' && doc.file_url ? (
                        <img
                          src={doc.file_url}
                          alt={doc.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src = 'https://placehold.co/400x300/e0e0e0/666666?text=Image+Error'; // Fallback image on error
                            e.currentTarget.alt = 'Image failed to load';
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <FileText className="h-16 w-16 text-slate-400 dark:text-slate-500" />
                        </div>
                      )}

                      {/* Status Badge */}
                      <div className={`absolute top-3 right-3 px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getStatusColor(doc.processing_status as string)}`}>
                        {getStatusIcon(doc.processing_status as string)}
                        <span className="capitalize">{(doc.processing_status as string) || 'unknown'}</span>
                      </div>

                      {/* Processing Overlay */}
                      {isDocumentProcessing(doc.id) && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <div className="bg-white dark:bg-slate-800 rounded-lg p-3 flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                            <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                              Processing...
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Document Information and Actions */}
                    <div className="p-6 space-y-4">
                      <div>
                        <h3 className="font-semibold text-lg text-slate-800 dark:text-slate-200 mb-2 line-clamp-2">
                          {doc.title}
                        </h3>
                        <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {formatDate(doc.created_at)}
                          </span>
                          <span className="flex items-center gap-1">
                            <HardDrive className="h-4 w-4" />
                            {formatFileSize(doc.file_size)}
                          </span>
                        </div>
                      </div>

                      {/* Extracted Content Preview */}
                      <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 min-h-[80px]">
                        <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-4">
                          {doc.content_extracted || 'No content extracted yet...'}
                        </p>
                      </div>

                      {/* Error Message Display */}
                      {doc.processing_status === 'failed' && doc.processing_error && (
                        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg p-3">
                          <p className="text-sm text-red-600 dark:text-red-400">
                            <span className="font-medium">Error:</span> {(doc.processing_error as string)}
                          </p>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-2 pt-2">
                        {doc.processing_status === 'failed' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => triggerAnalysis(doc)} // Retry analysis
                            disabled={isUploading || isDocumentProcessing(doc.id)} // Disable if uploading or already processing
                            className="flex-1 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-500/10 border-blue-200 dark:border-blue-500/20"
                          >
                            {isDocumentProcessing(doc.id) ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Processing...
                              </>
                            ) : (
                              <>
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Retry
                              </>
                            )}
                          </Button>
                        )}

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(doc.file_url, '_blank')} // Open actual document in new tab
                          className="flex-1 text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-500/10"
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteDocument(doc.id, doc.file_url)} // Delete document
                          disabled={isUploading || isDocumentProcessing(doc.id)} // Disable if uploading or processing
                          className="text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10 border-red-200 dark:border-red-500/20"
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
