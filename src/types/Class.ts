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

export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: string;
  isError?: boolean;
  originalUserMessageContent?: string;
  imageUrl?: string;
  imageMimeType?: string;
  attachedDocumentIds?: string[]; // Array of document IDs attached to this message
  attachedNoteIds?: string[];
  session_id?: string; // ID of the session this message belongs to
}
