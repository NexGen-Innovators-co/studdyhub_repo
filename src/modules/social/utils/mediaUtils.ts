// Utility functions for media handling

import { SUPPORTED_FILE_TYPES, FILE_CONSTRAINTS } from './socialConstants';

export const validateFileType = (file: File): boolean => {
  const allSupportedTypes = [
    ...SUPPORTED_FILE_TYPES.IMAGES,
    ...SUPPORTED_FILE_TYPES.VIDEOS,
    ...SUPPORTED_FILE_TYPES.DOCUMENTS,
  ];
  return allSupportedTypes.includes(file.type as any);
};

export const validateFileSize = (file: File): boolean => {
  return file.size <= FILE_CONSTRAINTS.MAX_FILE_SIZE;
};

export const getFileType = (file: File): 'image' | 'video' | 'document' => {
  if (SUPPORTED_FILE_TYPES.IMAGES.includes(file.type as any)) {
    return 'image';
  } else if (SUPPORTED_FILE_TYPES.VIDEOS.includes(file.type as any)) {
    return 'video';
  } else {
    return 'document';
  }
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const createFilePreview = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        resolve(e.target?.result as string);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    } else {
      resolve(''); // Non-image files don't need previews
    }
  });
};

export const generateThumbnail = async (file: File): Promise<string | null> => {
  if (!file.type.startsWith('video/')) return null;
  
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    
    video.onloadedmetadata = () => {
      video.currentTime = 1; // Seek to 1 second
    };
    
    video.onseeked = () => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(video, 0, 0);
      
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(URL.createObjectURL(blob));
        } else {
          resolve(null);
        }
      }, 'image/jpeg', 0.8);
    };
    
    video.src = URL.createObjectURL(file);
  });
};

export const validateFiles = (files: File[]): { valid: File[]; errors: string[] } => {
  const valid: File[] = [];
  const errors: string[] = [];
  
  if (files.length > FILE_CONSTRAINTS.MAX_FILES_PER_POST) {
    errors.push(`Maximum ${FILE_CONSTRAINTS.MAX_FILES_PER_POST} files allowed`);
    return { valid, errors };
  }
  
  files.forEach((file, index) => {
    if (!validateFileType(file)) {
      errors.push(`File ${index + 1}: Unsupported file type`);
    } else if (!validateFileSize(file)) {
      errors.push(`File ${index + 1}: File size too large (max ${formatFileSize(FILE_CONSTRAINTS.MAX_FILE_SIZE)})`);
    } else {
      valid.push(file);
    }
  });
  
  return { valid, errors };
};