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

  const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
  // Special case: treat .ts files as TypeScript documents
  if (fileExtension === '.ts') {
    return 'document';
  }
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
  // Only block truly dangerous extensions
  const dangerousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.com', '.pif', '.js', '.sh'];
  const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
  if (dangerousExtensions.includes(fileExtension)) {
    return {
      isValid: false,
      error: 'This file type is not supported for security reasons.'
    };
  }
  // Special case: allow .ts files (TypeScript)
  if (fileExtension === '.ts') {
    return { isValid: true };
  }
  // Accept all other types (let backend decide)
  return { isValid: true };

// Helper to override MIME type for .ts files when sending to backend
// Usage: if (file.name.endsWith('.ts')) file = overrideTsMimeType(file);
}

// Utility to override MIME type for .ts files
export function overrideTsMimeType(file: File): File {
  if (file.name.toLowerCase().endsWith('.ts') && file.type === 'video/vnd.dlna.mpeg-tts') {
    // Create a new File object with the correct MIME type
    return new window.File([file], file.name, { type: 'text/typescript' });
  }
  return file;
}


export const stripCodeBlocks = (content: string): string => {
  let cleanedContent = content;
  cleanedContent = cleanedContent.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, '');
  cleanedContent = cleanedContent.replace(/`[^`]+`/g, '');
  cleanedContent = cleanedContent.replace(/(\*\*\*|\*\*|\*|_|==)/g, '');
  cleanedContent = cleanedContent.replace(/(\n|^)(\*\*\*|---+)\s*\n/g, '');
  cleanedContent = cleanedContent.replace(/\n\s*\n/g, '\n').replace(/\s+/g, ' ').trim();
  return cleanedContent;
};
export const cleanTextForTTS = (text: string): string => {
  return text
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '') // remove most emojis
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
    .replace(/[\u{2600}-\u{26FF}]/gu, '')
    .replace(/[\u{2700}-\u{27BF}]/gu, '')
    .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '')

    // Replace specific common ones with spoken equivalents
    .replace(/thumbs up|okay hand/g, 'thumbs up')
    .replace(/heart|red heart|heart eyes/g, 'heart')
    .replace(/laughing|crying laughing|joy/g, 'laughing')
    .replace(/fire/g, 'fire')

    .replace(/:\)+|:\-+\)+|XD/gi, 'smile')     // :) or :-)) → "smile"
    .replace(/:\(+|:\-+\(+/gi, 'sad')          // :( → "sad"
    .replace(/<3/g, 'love')

    .replace(/:\w+:/g, '') // remove all :named: emojis
    .replace(/\s+/g, ' ')
    .trim();
};
export const generateOptimisticId = () => `optimistic-ai-${uuidv4()}`;