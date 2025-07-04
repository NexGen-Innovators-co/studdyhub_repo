export interface Document {
  id: string;
  user_id: string;
  title: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size?: number;
  content_extracted?: string;
  created_at: Date;
  updated_at: Date;
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