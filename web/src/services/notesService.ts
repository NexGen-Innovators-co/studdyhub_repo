/**
 * Notes Service — CRUD operations for notes via the API Gateway.
 * Replaces direct supabase.from('notes') calls.
 */

import { apiClient } from './apiClient';

export interface Note {
  id: string;
  user_id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  document_id: string | null;
  ai_summary: string | null;
  created_at: string;
  updated_at: string;
}

export const notesService = {
  /** List notes with optional filtering */
  async list(options?: {
    folder_id?: string;
    search?: string;
    order?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: Note[]; total: number }> {
    const params: Record<string, string> = {};
    if (options?.folder_id) params.folder_id = options.folder_id;
    if (options?.search) params.search = options.search;
    if (options?.order) params.order = options.order;
    if (options?.limit) params.limit = String(options.limit);
    if (options?.offset) params.offset = String(options.offset);

    const { data, meta } = await apiClient.get<Note[]>('notes', Object.keys(params).length ? params : undefined);
    return { data: data || [], total: meta?.total || (data?.length ?? 0) };
  },

  /** Get a single note by ID */
  async get(id: string): Promise<Note> {
    return apiClient.get<Note>(`notes/${id}`);
  },

  /** Create a new note */
  async create(note: { title: string; content?: string; category?: string; tags?: string[]; document_id?: string; id?: string }): Promise<Note> {
    return apiClient.post<Note>('notes', note);
  },

  /** Update an existing note */
  async update(id: string, updates: Partial<Pick<Note, 'title' | 'content' | 'category' | 'tags' | 'document_id'>>): Promise<Note> {
    return apiClient.patch<Note>(`notes/${id}`, updates);
  },

  /** Delete a note */
  async remove(id: string): Promise<{ deleted: boolean; id: string }> {
    return apiClient.delete(`notes/${id}`);
  },
};
