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
  avatar_url: string | null
  bonus_ai_credits: number | null
  created_at: string | null
  email: string | null
  full_name: string | null
  id: string
  is_public: boolean | null
  learning_preferences: any | null
  learning_style: string | null
  personal_context: string | null
  points_balance: number | null
  quiz_preferences: any | null
  referral_code: string | null
  referral_count: number | null
  school: string | null
  updated_at: string | null
  username: string | null
}
