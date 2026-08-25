/**
 * Podcasts Service — AI podcasts via the API Gateway.
 */

import { apiClient } from './apiClient';

export interface Podcast {
  id: string;
  user_id: string;
  title: string;
  script: string;
  style: string;
  duration_minutes: number;
  status: string;
  sources: string[];
  audio_segments: any[];
  visual_assets: any;
  is_live: boolean;
  created_at: string;
  updated_at: string;
}

export const podcastsService = {
  async list(): Promise<Podcast[]> {
    return apiClient.get<Podcast[]>('ai-podcasts');
  },

  async create(podcast: Partial<Podcast> & { id?: string }): Promise<Podcast> {
    return apiClient.post<Podcast>('ai-podcasts', podcast);
  },

  async remove(id: string): Promise<{ deleted: boolean; id: string }> {
    return apiClient.delete(`ai-podcasts/${id}`);
  },

  async update(id: string, updates: Partial<Podcast>): Promise<Podcast> {
    return apiClient.patch<Podcast>(`ai-podcasts/${id}`, updates);
  },
};
