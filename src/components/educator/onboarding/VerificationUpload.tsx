// src/components/educator/onboarding/VerificationUpload.tsx
// Document upload component for role verification requests.

import React, { useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Upload,
  FileText,
  X,
  Loader2,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import type { VerificationDocument } from '@/types/Education';

interface VerificationUploadProps {
  documents: VerificationDocument[];
  onDocumentsChange: (docs: VerificationDocument[]) => void;
  onUploadFile: (file: File) => Promise<VerificationDocument | null>;
  maxFiles?: number;
  maxSizeMB?: number;
}

const ALLOWED_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
];

const ALLOWED_EXTENSIONS = '.pdf,.png,.jpg,.jpeg,.webp';

export const VerificationUpload: React.FC<VerificationUploadProps> = ({
  documents,
  onDocumentsChange,
  onUploadFile,
  maxFiles = 5,
  maxSizeMB = 10,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    if (documents.length + files.length > maxFiles) {
      alert(`Maximum ${maxFiles} files allowed.`);
      return;
    }

    setIsUploading(true);
    const newDocs: VerificationDocument[] = [];

    for (const file of files) {
      // Validate type
      if (!ALLOWED_TYPES.includes(file.type)) {
        alert(`${file.name}: Only PDF and image files are accepted.`);
        continue;
      }

      // Validate size
      if (file.size > maxSizeMB * 1024 * 1024) {
        alert(`${file.name}: File too large (max ${maxSizeMB}MB).`);
        continue;
      }

      const doc = await onUploadFile(file);
      if (doc) newDocs.push(doc);
    }

    if (newDocs.length) {
      onDocumentsChange([...documents, ...newDocs]);
    }
    setIsUploading(false);

    // Reset file input
    if (inputRef.current) inputRef.current.value = '';
  };

  const removeDocument = (index: number) => {
    onDocumentsChange(documents.filter((_, i) => i !== index));
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium mb-1 block">
          Verification Documents
        </label>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          Upload proof of your teaching credentials — e.g. teaching license, institutional ID,
          qualification certificate, appointment letter. (PDF or images, max {maxSizeMB}MB each)
        </p>
      </div>

      {/* Uploaded documents list */}
      {documents.length > 0 && (
        <div className="space-y-2">
          {documents.map((doc, index) => (
            <div
              key={`${doc.path}-${index}`}
              className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border"
            >
              <FileText className="w-5 h-5 text-blue-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{doc.name}</p>
                {doc.size && (
                  <p className="text-xs text-gray-500">{formatSize(doc.size)}</p>
                )}
              </div>
              <Badge variant="secondary" className="text-xs">
                Uploaded
              </Badge>
              <button
                type="button"
                onClick={() => removeDocument(index)}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload button */}
      {documents.length < maxFiles && (
        <div
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer
                     hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/10
                     transition-colors"
        >
          {isUploading ? (
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
              <span className="text-sm text-gray-500">Uploading...</span>
            </div>
          ) : (
            <>
              <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Click to upload documents
              </p>
              <p className="text-xs text-gray-400 mt-1">
                PDF, PNG, JPG — up to {maxSizeMB}MB each ({maxFiles - documents.length} remaining)
              </p>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept={ALLOWED_EXTENSIONS}
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      )}
    </div>
  );
};

// ─── Inline verification status banner ────────────────────────

interface VerificationStatusBannerProps {
  status: 'pending' | 'verified' | 'rejected' | 'not_required';
  rejectionReason?: string | null;
  onResubmit?: () => void;
}

export const VerificationStatusBanner: React.FC<VerificationStatusBannerProps> = ({
  status,
  rejectionReason,
  onResubmit,
}) => {
  if (status === 'not_required' || status === 'verified') return null;

  if (status === 'pending') {
    return (
      <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20">
        <CardContent className="p-4 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-amber-800 dark:text-amber-300">
              Verification Pending
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
              Your educator role request is being reviewed by an admin. You'll get full access
              once approved. This usually takes 1–2 business days.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (status === 'rejected') {
    return (
      <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
        <CardContent className="p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-red-800 dark:text-red-300">
              Verification Rejected
            </p>
            {rejectionReason && (
              <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                Reason: {rejectionReason}
              </p>
            )}
            <p className="text-sm text-red-700 dark:text-red-400 mt-1">
              You can resubmit with updated documents or contact support.
            </p>
            {onResubmit && (
              <Button
                size="sm"
                variant="outline"
                onClick={onResubmit}
                className="mt-3 border-red-300 text-red-700 hover:bg-red-100"
              >
                Resubmit Request
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
};

export default VerificationUpload;
