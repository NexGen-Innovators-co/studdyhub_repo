// types/Document.ts
export interface Document {
  id: string;
  user_id: string;
  title: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number | null;
  content_extracted: string | null;
  created_at: string; // Keep as string from Supabase
  updated_at: string; // Keep as string from Supabase
  type: 'pdf' | 'txt' | 'doc' | 'docx' | 'md' | 'audio' | 'video' | 'image' | 'other' | string;
  processing_error: string | null;
  processing_status: string | null;
  processing_started_at: string | null;
  processing_completed_at: string | null;
  processing_metadata: any | null;
  extraction_model_used: string | null;
  total_processing_time_ms: number | null;
  folder_ids: string[]; // From ARRAY default '{}'::uuid[]
}

export interface UserProfile {
  id: string;
  email?: string;
  full_name?: string;
  avatar_url?: string;
  learning_style: 'visual' | 'auditory' | 'kinesthetic' | 'reading';
  learning_preferences: {
    explanation_style: 'simple' | 'detailed' | 'comprehensive';
    examples: boolean;
    difficulty: 'beginner' | 'intermediate' | 'advanced';
  };
  created_at: string;
  updated_at: string;
}
