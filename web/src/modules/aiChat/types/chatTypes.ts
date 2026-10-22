// src/modules/aiChat/types/chatTypes.ts
// Shared types for the AI chat module.

export interface AttachedFile {
  file: File;
  preview?: string;
  type: 'image' | 'document' | 'other';
  id: string;
}
