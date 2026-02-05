
import React from 'react';
import {
  Image, FileVideo, FileAudio, FileText, FileBarChart, Archive, Code, File,
  Check, Loader2, AlertTriangle
} from 'lucide-react';

export const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const getFileCategory = (fileType: string): string => {
  if (!fileType) return 'other';
  if (fileType.startsWith('image/')) return 'image';
  if (fileType.startsWith('video/')) return 'video';
  if (fileType.startsWith('audio/')) return 'audio';
  if (fileType.includes('pdf') || fileType.includes('document') || fileType.includes('word') || fileType.includes('text') || fileType.includes('slides')) return 'document';
  if (fileType.includes('spreadsheet') || fileType.includes('excel')) return 'spreadsheet';
  if (fileType.includes('presentation') || fileType.includes('powerpoint')) return 'presentation';
  if (fileType.includes('zip') || fileType.includes('rar') || fileType.includes('tar') || fileType.includes('gz')) return 'archive';
  if (fileType.includes('javascript') || fileType.includes('python') || fileType.includes('java') || fileType.includes('css')) return 'code';
  return 'other';
};

export const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'image': return Image;
    case 'video': return FileVideo;
    case 'audio': return FileAudio;
    case 'document': return FileText;
    case 'spreadsheet': return FileBarChart;
    case 'presentation': return FileBarChart;
    case 'archive': return Archive;
    case 'code': return Code;
    default: return File;
  }
};

export const getCategoryColor = (category: string) => {
  switch (category) {
    case 'image': return 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-500/20 border-green-200 dark:border-green-500/20';
    case 'video': return 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-500/20 border-blue-200 dark:border-blue-500/20';
    case 'audio': return 'text-pink-600 bg-pink-100 dark:text-pink-400 dark:bg-pink-500/20 border-pink-200 dark:border-pink-500/20';
    case 'document': return 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-500/20 border-blue-200 dark:border-blue-500/20';
    case 'spreadsheet': return 'text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-500/20 border-emerald-200 dark:border-emerald-500/20';
    case 'presentation': return 'text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-500/20 border-orange-200 dark:border-orange-500/20';
    case 'archive': return 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-500/20 border-yellow-200 dark:border-yellow-500/20';
    case 'code': return 'text-indigo-600 bg-indigo-100 dark:text-indigo-400 dark:bg-indigo-500/20 border-indigo-200 dark:border-indigo-500/20';
    default: return 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-500/20 border-gray-200 dark:border-gray-500/20';
  }
};

export const getStatusColor = (status: string | null) => {
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

export const getStatusIcon = (status: string | null) => {
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

// Utility to override .ts file MIME type to text/typescript (fixes browser misclassification)
export function overrideTsMimeType(file: File): File {
  if (file && file.name.toLowerCase().endsWith('.ts') && file.type === 'video/vnd.dlna.mpeg-tts') {
    try {
      // Use a Blob to create a new File with the correct MIME type
      const blob = file.slice(0, file.size, 'text/typescript');
      return new (window.File as { new(fileBits: BlobPart[], fileName: string, options?: FilePropertyBag): File })([blob], file.name, { type: 'text/typescript', lastModified: file.lastModified });
    } catch {
      // If File constructor fails, fallback to original file
      return file;
    }
  }
  return file;
}
