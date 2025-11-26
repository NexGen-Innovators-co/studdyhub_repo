
export interface Note {
  id: string;
  user_id?: string; // Make user_id optional if some notes might not have it
  document_id: string | null; // A note might not be from a document, so it can be null
  title: string;
  content: string;
  category: 'general' | 'math' | 'science' | 'history' | 'language' | 'other';
  tags: string[];
  aiSummary: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}



export type NoteCategory = Note['category'];

