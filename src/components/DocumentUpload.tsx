import React, { useState } from 'react';
import { Upload, File, X, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Document } from '../types/Document';

interface DocumentUploadProps {
  documents: Document[];
  onDocumentUploaded: (document: Document) => void;
  onDocumentDeleted: (documentId: string) => void;
}

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
      toast.error('File size must be less than 10MB');
      return;
    }

    setIsUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Upload file to storage
      const fileName = `${user.id}/${Date.now()}-${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get file URL
      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(uploadData.path);

      // Save document metadata to database
      const { data: documentData, error: dbError } = await supabase
        .from('documents')
        .insert({
          user_id: user.id,
          title: file.name.split('.')[0],
          file_name: file.name,
          file_url: publicUrl,
          file_type: file.type,
          file_size: file.size,
        })
        .select()
        .single();

      if (dbError) throw dbError;

      const newDocument: Document = {
        ...documentData,
        created_at: new Date(documentData.created_at),
        updated_at: new Date(documentData.updated_at),
      };

      onDocumentUploaded(newDocument);
      toast.success('Document uploaded successfully!');
    } catch (error) {
      console.error('Error uploading document:', error);
      toast.error('Failed to upload document');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteDocument = async (document: Document) => {
    try {
      // Delete from storage
      const pathParts = document.file_url.split('/');
      const filePath = `${pathParts[pathParts.length - 2]}/${pathParts[pathParts.length - 1]}`;
      
      await supabase.storage
        .from('documents')
        .remove([filePath]);

      // Delete from database
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', document.id);

      if (error) throw error;

      onDocumentDeleted(document.id);
      toast.success('Document deleted successfully!');
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error('Failed to delete document');
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleFileUpload(e.dataTransfer.files);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Upload Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-4 sm:p-6 md:p-8 text-center transition-colors ${
          dragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <Upload className="h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 mx-auto text-gray-400 mb-3 sm:mb-4" />
        <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">
          Upload Study Documents
        </h3>
        <p className="text-sm sm:text-base text-gray-500 mb-3 sm:mb-4">
          Drag and drop files here, or click to browse
        </p>
        <p className="text-xs sm:text-sm text-gray-400 mb-3 sm:mb-4">
          Supports PDF and TXT files up to 10MB
        </p>
        <input
          type="file"
          id="file-upload"
          className="hidden"
          accept=".pdf,.txt"
          onChange={(e) => handleFileUpload(e.target.files)}
          disabled={isUploading}
        />
        <Button
          onClick={() => document.getElementById('file-upload')?.click()}
          disabled={isUploading}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {isUploading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Uploading...
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
        <div className="space-y-3">
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