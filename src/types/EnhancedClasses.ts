// src/types/ClassEnhanced.ts
import { ClassRecording, Quiz, QuizQuestion } from './Class';

// Re-export base types
export type { ClassRecording, Quiz, QuizQuestion };

// New interfaces for gamification
export interface QuizAttempt {
  id: string;
  quiz_id: string;
  user_id: string;
  score: number;
  total_questions: number;
  percentage: number;
  time_taken_seconds: number;
  answers: {
    question_index: number;
    selected_answer: number;
    correct_answer: number;
    is_correct: boolean;
  }[];
  xp_earned: number;
  created_at: string;
}

export interface UserStats {
  user_id: string;
  total_xp: number;
  level: number;
  current_streak: number;
  longest_streak: number;
  total_quizzes_attempted: number;
  total_quizzes_completed: number;
  average_score: number;
  total_study_time_seconds: number;
  badges_earned: string[];
  last_activity_date: string;
  created_at: string;
  updated_at: string;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  requirement_type: 'quiz_count' | 'streak' | 'score' | 'xp' | 'perfect_score';
  requirement_value: number;
  xp_reward: number;
}

export interface Achievement {
  id: string;
  user_id: string;
  badge_id: string;
  earned_at: string;
  badge?: Badge;
}

// Pagination metadata
export interface PaginationMeta {
  currentPage: number;
  pageSize: number;
  totalCount: number;
  hasMore: boolean;
}