
export interface Note {
  id: string;
  title: string;
  content: string;
  category: 'general' | 'math' | 'science' | 'history' | 'language' | 'other';
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  aiSummary: string;
}

export type NoteCategory = Note['category'];
