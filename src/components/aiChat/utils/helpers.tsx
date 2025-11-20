import { v4 as uuidv4 } from 'uuid';
import { Image, FileText, File } from 'lucide-react';

export const getFileType = (file: File): 'image' | 'document' | 'other' => {
  const imageTypes = [
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/bmp',
    'image/svg+xml',
    'image/tiff',
    'image/tif',
    'image/ico',
    'image/heic',
    'image/heif',
  ];
  const documentTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'application/json',
    'application/xml',
    'text/xml',
    'text/html',
    'text/css',
    'text/javascript',
    'application/javascript'
  ];

  if (imageTypes.includes(file.type)) {
    return 'image';
  } else if (documentTypes.includes(file.type)) {
    return 'document';
  } else {
    return 'other';
  }
};

export const getFileIcon = (file: File) => {
  const type = getFileType(file);
  switch (type) {
    case 'image':
      return <Image className="h-4 w-4" />;
    case 'document':
      return <FileText className="h-4 w-4" />;
    default:
      return <File className="h-4 w-4" />;
  }
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const validateFile = (file: File): { isValid: boolean; error?: string } => {
  const MAX_FILE_SIZE = 25 * 1024 * 1024;

  if (file.size > MAX_FILE_SIZE) {
    return {
      isValid: false,
      error: `File size (${formatFileSize(file.size)}) exceeds the 25MB limit. Please choose a smaller file.`
    };
  }

  const problematicExtensions = ['.exe', '.bat', '.cmd', '.scr', '.com', '.pif'];
  const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));

  if (problematicExtensions.includes(fileExtension)) {
    return {
      isValid: false,
      error: 'This file type is not supported for security reasons.'
    };
  }

  return { isValid: true };
};

export const stripCodeBlocks = (content: string): string => {
  let cleanedContent = content;
  cleanedContent = cleanedContent.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, '');
  cleanedContent = cleanedContent.replace(/`[^`]+`/g, '');
  cleanedContent = cleanedContent.replace(/(\*\*\*|\*\*|\*|_|==)/g, '');
  cleanedContent = cleanedContent.replace(/(\n|^)(\*\*\*|---+)\s*\n/g, '');
  cleanedContent = cleanedContent.replace(/\n\s*\n/g, '\n').replace(/\s+/g, ' ').trim();
  return cleanedContent;
};

export const generateOptimisticId = () => `optimistic-ai-${uuidv4()}`;