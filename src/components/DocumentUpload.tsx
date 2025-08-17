// Updated src/components/DocumentUpload.tsx
import React, { useState, useRef, useCallback } from 'react';
import { UploadCloud, FileText, Image, Loader2, Check, XCircle, AlertTriangle, RefreshCw, Eye, Download, Calendar, HardDrive } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { toast } from 'sonner';
import { supabase } from '../integrations/supabase/client';
import { Document } from '../types/Document';
import { useAuth } from '../hooks/useAuth';
// generateId is no longer strictly needed for new uploads as backend generates it
// import { generateId } from '@/utils/helpers'; 

interface DocumentUploadProps {
  documents: Document[];
  onDocumentUploaded: (document: Document) => void;
  onDocumentDeleted: (documentId: string) => void;
  onDocumentUpdated: (document: Document) => void;
}

export const DocumentUpload: React.FC<DocumentUploadProps> = ({ documents, onDocumentUploaded, onDocumentDeleted, onDocumentUpdated }) => {
  const { user } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  // Upload progress will now be managed by the backend or a simpler client-side indicator
  // const [uploadProgress, setUploadProgress] = useState(0); 
  const [dragActive, setDragActive] = useState(false);
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

  const handleFileSelection = useCallback((file: File) => {
    const MAX_FILE_SIZE_MB = 200; // Consistent with backend
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast.error(`File size exceeds ${MAX_FILE_SIZE_MB}MB limit.`);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Allowed types should match SUPPORTED_FILE_TYPES in the backend
    const allowedTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml', 'image/tiff', 'image/tif', 'image/ico', 'image/heic', 'image/heif',
      'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/rtf', 'application/vnd.oasis.opendocument.text', 'application/vnd.oasis.opendocument.spreadsheet', 'application/vnd.oasis.opendocument.presentation',
      'text/plain', 'text/csv', 'text/markdown', 'text/html', 'text/xml', 'application/json', 'application/xml',
      'text/javascript', 'application/javascript', 'text/typescript', 'application/typescript', 'text/css', 'text/x-python', 'text/x-java', 'text/x-c', 'text/x-cpp', 'text/x-csharp', 'text/x-php', 'text/x-ruby', 'text/x-go', 'text/x-rust', 'text/x-sql',
      'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed', 'application/x-tar', 'application/gzip',
      'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/m4a', 'audio/webm', 'audio/flac',
      'video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/webm', 'video/mkv'
    ];

    if (!allowedTypes.includes(file.type)) {
      toast.error('Unsupported file type. Please check the allowed file types.');
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

  const getBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = (error) => reject(error);
    });
  };

  const handleUpload = async () => {
    if (!selectedFile || !user?.id) {
      toast.error('Please select a file and ensure you are logged in.');
      return;
    }

    if (isUploading) {
      toast.warning('Upload already in progress. Please wait...');
      return;
    }

    setIsUploading(true);
    // setUploadProgress(0); // No longer needed with backend handling

    // Replace with your actual document-processor edge function URL
    const functionUrl = 'https://kegsrvnywshxyucgjxml.supabase.co/functions/v1/document-processor';

    try {
      toast.info(`Uploading and processing "${selectedFile.name}"...`);

      const base64Data = await getBase64(selectedFile);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid authentication token found');
      }

      // Payload structure matches the document-processor expected input
      const payload = {
        userId: user.id,
        files: [{
          name: selectedFile.name,
          mimeType: selectedFile.type,
          data: base64Data,
          size: selectedFile.size
        }]
      };

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(`Processing failed: ${errorBody.error || 'Unknown error'}`);
      }

      const result = await response.json();

      // Assuming the backend returns the full saved document object(s)
      if (result.documents && result.documents.length > 0) {
        result.documents.forEach((doc: Document) => {
          onDocumentUploaded(doc); // Add new document to local state
        });
        toast.success('File processed and saved successfully.');
      } else {
        toast.warning('File processed but no documents were returned.');
      }

      // Reset form
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

    } catch (error: any) {
      console.error('Processing error:', error);
      toast.error(`Failed to process file: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const triggerAnalysis = async (doc: Document): Promise<void> => {
    if (!user?.id) {
      toast.error('User not authenticated.');
      return;
    }

    if (processingDocuments.has(doc.id) || (doc.processing_status as string) === 'pending') {
      toast.warning('Analysis is already in progress for this document.');
      return;
    }

    setProcessingDocuments(prev => new Set(prev).add(doc.id));
    onDocumentUpdated({ ...doc, processing_status: 'pending', processing_error: null }); // Optimistic update

    const functionUrl = 'https://kegsrvnywshxyucgjxml.supabase.co/functions/v1/document-processor';

    try {
      toast.info(`${doc.processing_status === 'failed' ? 'Retrying' : 'Starting'} analysis for "${doc.file_name}"...`);

      // For re-analysis, fetch the file's content (base64) from its URL
      let base64Data: string | null = null;
      try {
        const response = await fetch(doc.file_url);
        if (!response.ok) {
          throw new Error(`Failed to fetch file from URL: ${doc.file_url}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const binary = String.fromCharCode(...new Uint8Array(arrayBuffer));
        base64Data = btoa(binary);
      } catch (fetchError: any) {
        throw new Error(`Error fetching file for re-analysis: ${fetchError.message}`);
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid authentication token found');
      }

      const payload = {
        userId: user.id,
        files: [{
          name: doc.file_name,
          mimeType: doc.file_type,
          data: base64Data, // Send base64 data for reprocessing
          size: doc.file_size,
          // If you want to instruct the backend to update an existing document
          // rather than creating a new one, you might include the document ID.
          // For now, the backend will process and save. You'll handle the update
          // based on the response if the document is re-processed and a new entry
          // is created, or if the backend explicitly updates the existing one.
          idToUpdate: doc.id // Custom field to indicate update for backend
        }]
      };

      const fetchResponse = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(payload),
      });

      if (!fetchResponse.ok) {
        const errorBody = await fetchResponse.json();
        throw new Error(`Analysis failed: ${errorBody.error || fetchResponse.statusText}`);
      }

      const result = await fetchResponse.json();
      if (result.documents && result.documents.length > 0) {
        const updatedDoc = result.documents.find((d: Document) => d.id === doc.id) || result.documents[0];
        onDocumentUpdated(updatedDoc); // Update the local document state
        toast.success('Document analysis completed successfully!');
      } else {
        toast.warning('Analysis request sent, but no updated document data received.');
      }

    } catch (error: any) {
      toast.error(`Failed to initiate analysis: ${error.message}`);
      onDocumentUpdated({
        ...doc,
        processing_status: 'failed',
        processing_error: error.message
      });
    } finally {
      setProcessingDocuments(prev => {
        const newSet = new Set(prev);
        newSet.delete(doc.id);
        return newSet;
      });
    }
  };

  const handleDeleteDocument = async (documentId: string, fileUrl: string) => {
    if (processingDocuments.has(documentId)) {
      toast.error('Cannot delete document while analysis is in progress.');
      return;
    }

    toast.info('Deleting document...', {
      action: {
        label: 'Confirm Delete',
        onClick: async () => {
          try {
            // Extract storage path from fileUrl
            let storagePath: string | null = null;
            try {
              const url = new URL(fileUrl);
              // Extract path after the bucket name 'documents'
              const pathSegments = url.pathname.split('/chat-documents/'); // Note the bucket name change
              if (pathSegments.length > 1) {
                storagePath = pathSegments[1];
              } else {
                // Fallback for older paths if 'documents' was the bucket name
                const oldPathSegments = url.pathname.split('/documents/');
                if (oldPathSegments.length > 1) {
                  storagePath = oldPathSegments[1];
                } else {
                  // Fallback: assume path follows user_uploads/{user.id}/{fileName}
                  const match = fileUrl.match(/\/user_uploads\/[^/]+\/[^/]+$/);
                  if (match) {
                    storagePath = `user_uploads${match[0].split('/user_uploads')[1]}`;
                  }
                }
              }
            } catch (urlError) {
              console.warn('Invalid file URL format:', fileUrl, urlError);
            }

            if (storagePath) {
              const { error: storageError } = await supabase.storage
                .from('chat-documents') // Use the correct bucket name
                .remove([storagePath]);

              if (storageError) {
                console.warn('Failed to delete file from storage:', storageError.message);
                toast.warning(`File might not have been removed from storage. Error: ${storageError.message}`);
              } else {
                // console.log(`Successfully deleted file from storage: ${storagePath}`);
              }
            } else {
              console.warn('Could not derive storage path from file URL:', fileUrl);
              toast.warning('Could not derive storage path from file URL. File will not be deleted from storage.');
            }

            const { error: dbError } = await supabase
              .from('documents')
              .delete()
              .eq('id', documentId);

            if (dbError) {
              throw new Error(`Database deletion failed: ${dbError.message}`);
            }

            toast.success('Document deleted successfully!');
            onDocumentDeleted(documentId);
          } catch (error: any) {
            console.error('Error deleting document:', error);
            toast.error(`Failed to delete document: ${error.message}`);
          }
        }
      },
      duration: 5000,
    });
  };

  const getStatusColor = (status: string | null) => {
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

  const getStatusIcon = (status: string | null) => {
    const s = status as string;
    switch (s) {
      case 'completed':
        return <Check className="h-4 w-4" />;
      case 'pending':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'failed':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const isDocumentProcessing = (docId: string) => {
    const doc = documents.find(d => d.id === docId);
    return processingDocuments.has(docId) || (doc?.processing_status as string) === 'pending';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8 md:mb-12">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent mb-4">
            Document & Image Upload
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Upload your documents and images for AI-powered analysis and content extraction
          </p>
        </div>

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
                onClick={() => !isUploading && fileInputRef.current?.click()}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  accept=".txt,.pdf,.jpg,.jpeg,.png,.gif,.webp,.bmp,.svg,.tiff,.ico,.heic,.heif,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.rtf,.odt,.ods,.odp,.csv,.md,.html,.xml,.json,.js,.ts,.css,.py,.java,.c,.cpp,.cs,.php,.rb,.go,.rs,.sql,.zip,.rar,.7z,.tar,.gz,.mp3,.wav,.ogg,.m4a,.webm,.flac,.mp4,.avi,.mov,.wmv,.mkv"
                  disabled={isUploading}
                />

                <div className="text-center">
                  <div className={`inline-flex items-center justify-center w-16 h-16 md:w-20 md:h-20 rounded-full ${selectedFile
                    ? 'bg-green-100 dark:bg-green-500/20'
                    : 'bg-blue-100 dark:bg-blue-500/20'
                    } mb-4 transition-all duration-300`}>
                    {selectedFile ? (
                      <Check className="h-8 w-8 md:h-10 md:h-10 text-green-600 dark:text-green-400" />
                    ) : (
                      <UploadCloud className="h-8 w-8 md:h-10 md:h-10 text-blue-600 dark:text-blue-400" />
                    )}
                  </div>

                  {selectedFile ? (
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
                          e.stopPropagation();
                          setSelectedFile(null);
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        disabled={isUploading}
                        className="mt-4 text-slate-600 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Remove File
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <h3 className="text-xl md:text-2xl font-semibold text-slate-800 dark:text-slate-200">
                        Drop your files here, or <span className="text-blue-600 dark:text-blue-400">browse</span>
                      </h3>
                      <p className="text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                        Supports various document, image, audio, video, and code file types up to 200MB
                      </p>
                      <div className="flex flex-wrap justify-center gap-4 text-sm text-slate-500 dark:text-slate-500">
                        <span className="px-3 py-1 bg-slate-100 dark:bg-slate-700 rounded-full">.TXT</span>
                        <span className="px-3 py-1 bg-slate-100 dark:bg-slate-700 rounded-full">.PDF</span>
                        <span className="px-3 py-1 bg-slate-100 dark:bg-slate-700 rounded-full">.JPG</span>
                        <span className="px-3 py-1 bg-slate-100 dark:bg-slate-700 rounded-full">.PNG</span>
                        <span className="px-3 py-1 bg-slate-100 dark:bg-slate-700 rounded-full">.DOCX</span>
                        <span className="px-3 py-1 bg-slate-100 dark:bg-slate-700 rounded-full">.MP4</span>
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

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-slate-200">
              Your Files ({documents.length})
            </h2>
          </div>

          {documents.length === 0 ? (
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
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {documents.map((doc) => (
                <Card key={doc.id} className="group border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm hover:scale-[1.02] overflow-hidden">
                  <CardContent className="p-0">
                    <div className="relative h-48 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800">
                      {doc.type === 'image' && doc.file_url ? (
                        <img
                          src={doc.file_url}
                          alt={doc.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src = 'https://placehold.co/400x300/e0e0e0/666666?text=Image+Error';
                            e.currentTarget.alt = 'Image failed to load';
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <FileText className="h-16 w-16 text-slate-400 dark:text-slate-500" />
                        </div>
                      )}

                      <div className={`absolute top-3 right-3 px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getStatusColor(doc.processing_status as string)}`}>
                        {getStatusIcon(doc.processing_status as string)}
                        <span className="capitalize">{(doc.processing_status as string) || 'unknown'}</span>
                      </div>

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

                      <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 min-h-[80px]">
                        <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-4">
                          {doc.content_extracted || 'No content extracted yet...'}
                        </p>
                      </div>

                      {doc.processing_status === 'failed' && doc.processing_error && (
                        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg p-3">
                          <p className="text-sm text-red-600 dark:text-red-400">
                            <span className="font-medium">Error:</span> {(doc.processing_error as string)}
                          </p>
                        </div>
                      )}

                      <div className="flex gap-2 pt-2">
                        {doc.processing_status === 'failed' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => triggerAnalysis(doc)}
                            disabled={isUploading || isDocumentProcessing(doc.id)}
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
                          onClick={() => window.open(doc.file_url, '_blank')}
                          className="flex-1 text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-500/10"
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteDocument(doc.id, doc.file_url)}
                          disabled={isUploading || isDocumentProcessing(doc.id)}
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

