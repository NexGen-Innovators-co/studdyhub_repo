// Core types for Class recordings and related functionality
export interface ClassRecording {
  id: string;
  title: string;
  subject: string;
  audioUrl?: string | null;
  transcript: string;
  summary: string;
  duration: number;
  date: string;
  createdAt: string;
  userId: string;
  document_id?: string | null;
}

export interface Quiz {
  id: string;
  title: string;
  questions: QuizQuestion[];
  classId?: string; // Optional: Link to the class recording it was generated from
  userId: string;
  createdAt: string;
}

export interface QuizQuestion {
  id?: string; // Optional, can be generated client-side or by AI
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
}

export interface ScheduleItem {
  id: string;
  title: string;
  subject: string;
  startTime: string;
  endTime: string;
  location?: string;
  description?: string;
  color?: string;
  type: 'class' | 'study' | 'assignment' | 'exam' | 'other';
  userId: string;
  createdAt: string;
}
// In types/Class.ts
export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: string;
  isError?: boolean;
  session_id?: string;
  has_been_displayed?: boolean;
  isUpdating?: boolean;
  attachedDocumentIds?: string[];
  attachedNoteIds?: string[];
  image_url?: string; // Legacy image URL
  image_mime_type?: string; // Legacy image MIME type
  files_metadata?: string | Array<{ // Use string | array to handle both JSON string and array
  id: string;
  name: string;
  mimeType: string;
  url: string;
  type: 'image' | 'document' | 'other';
  size?: number;
  content?: string | null;
  processing_status?: string;
  processing_error?: string | null;
  status?: string;
  error?: string;
  }> | {
  id: string;
  name: string;
  mimeType: string;
  url: string;
  type: 'image' | 'document' | 'other';
  size?: number;
  content?: string | null;
  processing_status?: string;
  processing_error?: string | null;
  status?: string;
  error?: string;
  };
  attachedFiles?: Array<{ // Legacy attached files
  name: string;
  mimeType: string;
  type: 'image' | 'document' | 'other';
  size: number;
  content?: string | null;
  processing_status?: string;
  processing_error?: string | null;
  }>;
  conversation_context?: string;
  }
export interface ChatSession {
  id: string;
  title: string;
  created_at: string; // Keep as string, as it's directly from DB
  updated_at: string;
  last_message_at: string;
  document_ids: string[];
  message_count?: number;
  user_id: string;
  default_folder_id?: string | null;
}
export interface MessagePart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

export interface FileData {
  name: string;
  mimeType: string;
  data: string | null;
  type: 'image' | 'document' | 'other';
  size: number;
  content: string | null;
  processing_status: string;
  processing_error: string | null;
}