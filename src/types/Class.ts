// Core types for Class recordings and related functionality
export interface ClassRecording {
  audio_url: string;
  user_id: any;
  id: string;
  title: string;
  subject: string;
  audioUrl?: string | null;
  transcript: string;
  summary: string;
  duration: number;
  date: string;
  created_at: string;
  userId: string;
  document_id?: string | null;
  processing_status?: 'pending' | 'processing' | 'completed' | 'failed' | null;
}

// src/types/Class.ts - Update the Quiz interface
export interface Quiz {
  class_id?: string | null
  created_at: string | null
  id?: string
  questions: any | null
  source_type: string | null
  title: string
  user_id: string
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
  location?: string;
  description?: string;
  color?: string;
  type: 'class' | 'study' | 'assignment' | 'exam' | 'other';
  userId: string;
  created_at: string;
  calendarEventIds?: Record<string, string>;
  isRecurring?: boolean | null
  recurrenceDays?: number[] | null
  recurrenceEndDate?: string | null
  recurrenceInterval?: number | null
  recurrencePattern?: string | null
  startTime: string
  endTime: string
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
  thinking_steps?: ThinkingStep[];  // Agentic reasoning steps
  isStreaming?: boolean;  // Whether response is currently streaming
  isLoading?: boolean;
  model?: string; // AI model used for this response (e.g. "gemini-2.5-pro")
  modelLabel?: string; // User-facing model label (e.g. "Gemini Pro")
  image_url?: string; // Legacy image URL
  image_mime_type?: string; // Legacy image MIME type
  images?: string[];
  executedActions?: any[];
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
export interface ThinkingStep {
  id: string;
  type: 'understanding' | 'retrieval' | 'reasoning' | 'memory' | 'verification' | 'action';
  title: string;
  detail: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  timestamp: string;
  metadata?: any;
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