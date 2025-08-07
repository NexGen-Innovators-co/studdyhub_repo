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
  attachedDocumentIds?: string[];
  attachedNoteIds?: string[];
  imageUrl?: string;
  imageMimeType?: string;
  session_id?: string;
  has_been_displayed?: boolean;
  isUpdating?: boolean;
  attachedFiles?: Array<{
    name: string;
    mimeType: string;
    type: 'image' | 'document' | 'other';
    size: number;
    content?: string | null;
    processing_status?: string;
    processing_error?: string | null;
  }>;
}
