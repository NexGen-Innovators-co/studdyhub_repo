/**
 * Quizzes Service — Quiz CRUD + attempt submission via the API Gateway.
 */

import { apiClient } from './apiClient';

export interface Quiz {
  id: string;
  user_id: string;
  title: string;
  source_type: string;
  questions: any[];
  created_at: string;
  updated_at: string;
}

export interface QuizAttempt {
  id: string;
  quiz_id: string;
  user_id: string;
  score: number;
  total_questions: number;
  percentage: number;
  time_taken_seconds: number;
  answers: any[];
  xp_earned: number;
  live_results: any | null;
  created_at: string;
}

export const quizzesService = {
  async list(): Promise<Quiz[]> {
    return apiClient.get<Quiz[]>('quizzes');
  },

  async create(quiz: { title: string; source_type?: string; questions?: any[]; id?: string }): Promise<Quiz> {
    return apiClient.post<Quiz>('quizzes', quiz);
  },

  async remove(id: string): Promise<{ deleted: boolean; id: string }> {
    return apiClient.delete(`quizzes/${id}`);
  },

  async submit(quizId: string, attempt: {
    score: number;
    total_questions: number;
    percentage: number;
    time_taken_seconds: number;
    answers: any[];
    xp_earned: number;
    live_results?: any;
    id?: string;
  }): Promise<QuizAttempt> {
    return apiClient.post<QuizAttempt>(`quizzes/${quizId}/submit`, attempt);
  },

  async listAttempts(): Promise<QuizAttempt[]> {
    return apiClient.get<QuizAttempt[]>('quiz-attempts');
  },

  async removeAttempts(quizId: string): Promise<{ deleted: boolean }> {
    return apiClient.delete('quiz-attempts', { quiz_id: quizId });
  },
};
