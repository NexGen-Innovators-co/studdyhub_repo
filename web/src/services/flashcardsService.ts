/**
 * Flashcards Service — Decks + cards via the API Gateway.
 */

import { apiClient } from './apiClient';

export interface FlashcardDeck {
  id: string;
  user_id: string;
  title: string;
  card_count: number;
  mastery_level: number;
  created_at: string;
}

export interface Flashcard {
  id: string;
  user_id: string;
  deck_id: string;
  front: string;
  back: string;
  category: string;
  difficulty: string;
  hint: string;
  created_at: string;
}

export const flashcardsService = {
  async listDecks(): Promise<FlashcardDeck[]> {
    return apiClient.get<FlashcardDeck[]>('flashcards/decks');
  },

  async list(options?: { order?: string; limit?: number }): Promise<Flashcard[]> {
    const params: Record<string, string> = {};
    if (options?.order) params.order = options.order;
    if (options?.limit) params.limit = String(options.limit);
    return apiClient.get<Flashcard[]>('flashcards', Object.keys(params).length ? params : undefined);
  },

  async createCard(card: { front: string; back: string; category?: string; difficulty?: string; hint?: string; id?: string }): Promise<Flashcard> {
    return apiClient.post<Flashcard>('flashcards/cards', card);
  },

  async removeCard(id: string): Promise<{ deleted: boolean; id: string }> {
    return apiClient.delete(`flashcards/cards/${id}`);
  },

  async submitReview(review: { card_id: string; rating: number }): Promise<any> {
    return apiClient.post('flashcards/review', review);
  },
};
