
export interface ClassRecording {
  id: string;
  title: string;
  audioUrl: string;
  transcript: string;
  summary: string;
  duration: number;
  subject: string;
  date: Date;
  createdAt: Date;
}

export interface Quiz {
  id: string;
  classId: string;
  title: string;
  questions: QuizQuestion[];
  createdAt: Date;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

export interface ScheduleItem {
  id: string;
  title: string;
  subject: string;
  type: 'class' | 'study' | 'assignment' | 'exam' | 'other';
  startTime: Date;
  endTime: Date;
  location?: string;
  description?: string;
  color: string;
}

export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  isError?: boolean; // Add this line
  originalUserMessageContent?: string
}
