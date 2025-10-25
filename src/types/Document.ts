export interface Document {
  content_extracted: string | null;
  created_at: string;
  file_name: string;
  file_size: number | null;
  file_type: string;
  file_url: string;
  id: string;
  title: string;
  updated_at: string;
  user_id: string;
  type: string;
  processing_error: string | null; // Changed to 'string | null'
  processing_status: string; // Changed to 'string'
  folder_ids?: string[];
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
  created_at: Date;
  updated_at: Date;
}
