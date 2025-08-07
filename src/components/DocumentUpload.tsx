// src/components/DocumentUpload.tsx
import React, { useState, useRef, useCallback } from 'react';
import { UploadCloud, FileText, Image, Loader2, Check, XCircle, AlertTriangle, RefreshCw, Eye, Download, Calendar, HardDrive } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Document } from '../types/Document';
import { useAuth } from '../hooks/useAuth';
import { generateId } from '@/utils/helpers';

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
  const [uploadProgress, setUploadProgress] = useState(0);
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

  const triggerAnalysis = async (doc: Document): Promise<void> => {
    if (!user?.id) {
      toast.error('User not authenticated.');
      return;
    }

    if (processingDocuments.has(doc.id)) {
      toast.warning('Analysis is already in progress for this document.');
      return;
    }

    setProcessingDocuments(prev => new Set(prev).add(doc.id));

    try {
      toast.info(`${doc.processing_status === 'failed' ? 'Retrying' : 'Starting'} analysis for "${doc.title}"...`);

      if (doc.processing_status === 'failed') {
        onDocumentUpdated({ ...doc, processing_status: 'pending', processing_error: null });
      }

      const functionUrl = 'https://kegsrvnywshxyucgjxml.supabase.co/functions/v1/gemini-chat';
      const maxImageSize = 20 * 1024 * 1024; // 20MB limit from index.ts for images

      // Validate file size and type
      if (doc.file_size > maxImageSize) {
        throw new Error(`File size (${formatFileSize(doc.file_size)}) exceeds maximum limit of ${formatFileSize(maxImageSize)} for analysis.`);
      }

      const supportedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!supportedImageTypes.includes(doc.file_type) && doc.type === 'image') {
        throw new Error(`Unsupported image type: ${doc.file_type}. Supported types: ${supportedImageTypes.join(', ')}`);
      }

      // Fetch and encode file to base64
      let base64Data: string | null = null;
      try {
        const response = await fetch(doc.file_url);
        if (!response.ok) {
          throw new Error(`Failed to fetch file from ${doc.file_url}: ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        if (arrayBuffer.byteLength === 0) {
          throw new Error('File is empty or corrupted.');
        }
        const binary = String.fromCharCode(...new Uint8Array(arrayBuffer));
        base64Data = btoa(binary);
        // Verify base64 validity
        try {
          atob(base64Data);
        } catch (e) {
          throw new Error('Invalid base64 encoding generated.');
        }
      } catch (fetchError: any) {
        throw new Error(`Error preparing file for analysis: ${fetchError.message}`);
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid authentication token found');
      }

      const bodyPayload = {
        userId: user.id,
        sessionId: generateId(),
        message: '',
        files: [{
          name: doc.file_name,
          mimeType: doc.file_type,
          data: base64Data,
          size: doc.file_size,
          processing_status: 'pending',
          type: doc.type
        }],
        attachedDocumentIds: [doc.id],
        attachedNoteIds: [],
        learningStyle: 'visual',
        learningPreferences: {},
        chatHistory: []
      };

      console.log(`Triggering analysis for document: ${doc.id}, type: ${doc.file_type}, size: ${formatFileSize(doc.file_size)}`);

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(bodyPayload),
      });

      if (!response.ok) {
        const errorBody = await response.json();
        const errorMessage = `Analysis trigger failed: ${errorBody.error || 'Unknown server error'}`;
        console.error('Edge function response:', errorBody);
        toast.error(errorMessage);
        onDocumentUpdated({
          ...doc,
          processing_status: 'failed',
          processing_error: errorMessage
        });
        return;
      }

      toast.info('Analysis request sent successfully. Awaiting processing...');

    } catch (analysisError: any) {
      console.error('Error triggering analysis:', analysisError);
      toast.error(`Failed to initiate analysis: ${analysisError.message}`);
      onDocumentUpdated({
        ...doc,
        processing_status: 'failed',
        processing_error: analysisError.message
      });
    } finally {
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

    if (isUploading) {
      toast.warning('Upload already in progress. Please wait...');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    const isImage = selectedFile.type.startsWith('image/');
    const fileExtension = selectedFile.name.split('.').pop();
    const fileName = `${generateId()}.${fileExtension}`;
    const filePath = `user_uploads/${user.id}/${fileName}`;

    let newDocumentId: string | null = null;
    let uploadedFilePath: string | null = null;

    try {
      toast.info(`Uploading ${isImage ? 'image' : 'document'}...`);
      const { data: storageData, error: storageError } = await supabase.storage
        .from('documents')
        .upload(filePath, selectedFile, {
          cacheControl: '3600',
          upsert: false,
        });

      if (storageError) {
        throw new Error(`Storage upload failed: ${storageError.message}`);
      }

      uploadedFilePath = filePath;

      const { data: publicUrlData } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      const fileUrl = publicUrlData.publicUrl;

      toast.info(`Registering ${isImage ? 'image' : 'document'}...`);
      const tempDocId = generateId();
      const { data: docData, error: dbError } = await supabase
        .from('documents')
        .insert({
          id: tempDocId,
          title: selectedFile.name,
          file_url: fileUrl,
          type: isImage ? 'image' : 'text',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          content_extracted: null,
          processing_error: null,
          user_id: user.id,
          file_name: selectedFile.name,
          file_type: selectedFile.type,
          file_size: selectedFile.size,
          processing_status: 'pending',
        })
        .select()
        .single();

      if (dbError) {
        throw new Error(`Database insertion failed: ${dbError.message}`);
      }

      newDocumentId = docData.id;
      toast.success(`${isImage ? 'Image' : 'Document'} uploaded and registered! Processing content...`);

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
        processing_status: docData.processing_status as string,
        processing_error: docData.processing_error as string | null,
        created_at: docData.created_at,
        updated_at: docData.updated_at,
      });

    } catch (error: any) {
      console.error('Upload or document registration error:', error);
      toast.error(`Upload failed: ${error.message}`);

      if (newDocumentId) {
        try {
          await supabase.from('documents').delete().eq('id', newDocumentId);
          onDocumentDeleted(newDocumentId);
        } catch (cleanupError) {
          console.error('Failed to clean up document from database:', cleanupError);
        }
      }

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
      setIsUploading(false);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
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
              const pathSegments = url.pathname.split('/documents/');
              if (pathSegments.length > 1) {
                storagePath = pathSegments[1];
              } else {
                // Fallback: assume path follows user_uploads/{user.id}/{fileName}
                const match = fileUrl.match(/\/user_uploads\/[^/]+\/[^/]+$/);
                if (match) {
                  storagePath = `user_uploads${match[0].split('/user_uploads')[1]}`;
                }
              }
            } catch (urlError) {
              console.warn('Invalid file URL format:', fileUrl, urlError);
            }

            if (storagePath) {
              const { error: storageError } = await supabase.storage
                .from('documents')
                .remove([storagePath]);

              if (storageError) {
                console.warn('Failed to delete file from storage:', storageError.message);
                toast.warning(`File might not have been removed from storage. Error: ${storageError.message}`);
              } else {
                console.log(`Successfully deleted file from storage: ${storagePath}`);
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
                  accept=".txt,.pdf,.jpg,.jpeg,.png,.gif,.webp"
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
                        Supports text files, PDFs, and images (JPG, PNG, GIF, WEBP) up to 10MB
                      </p>
                      <div className="flex flex-wrap justify-center gap-4 text-sm text-slate-500 dark:text-slate-500">
                        <span className="px-3 py-1 bg-slate-100 dark:bg-slate-700 rounded-full">.TXT</span>
                        <span className="px-3 py-1 bg-slate-100 dark:bg-slate-700 rounded-full">.PDF</span>
                        <span className="px-3 py-1 bg-slate-100 dark:bg-slate-700 rounded-full">.JPG</span>
                        <span className="px-3 py-1 bg-slate-100 dark:bg-slate-700 rounded-full">.PNG</span>
                        <span className="px-3 py-1 bg-slate-100 dark:bg-slate-700 rounded-full">.GIF</span>
                        <span className="px-3 py-1 bg-slate-100 dark:bg-slate-700 rounded-full">.WEBP</span>
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
