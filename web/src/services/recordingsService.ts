/**
 * Class Recordings Service — Recordings via the API Gateway.
 */

import { apiClient } from './apiClient';

export interface ClassRecording {
  id: string;
  user_id: string;
  title: string;
  duration: number;
  file_url: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export const recordingsService = {
  async list(): Promise<ClassRecording[]> {
    return apiClient.get<ClassRecording[]>('class-recordings');
  },

  async create(recording: Partial<ClassRecording> & { id?: string }): Promise<ClassRecording> {
    return apiClient.post<ClassRecording>('class-recordings', recording);
  },

  async remove(id: string): Promise<{ deleted: boolean; id: string }> {
    return apiClient.delete(`class-recordings/${id}`);
  },
};
