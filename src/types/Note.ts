// types/Note.ts
export type NoteCategory = 'general' | 'math' | 'science' | 'history' | 'language' | 'other';

export interface Note {
  id: string;
  user_id: string;
  title: string;
  content: string | null;
  category: NoteCategory 
  tags: string[]; 
  ai_summary: string | null;
  created_at: string; // Keep as string from Supabase
  updated_at: string; // Keep as string from Supabase
  document_id: string | null;
}

