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
  type: "text" | "image" | "audio";
  processing_error: String; // Changed from 'String' to 'string'
  processing_status: String; // Changed from 'String' to 'string'
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