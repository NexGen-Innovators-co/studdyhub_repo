/**
 * Documents Service — CRUD operations for documents via the API Gateway.
 */

import { apiClient } from './apiClient';

export interface Document {
  id: string;
  user_id: string;
  title: string;
  file_name: string;
  type: string;
  folder_id: string | null;
  processing_status: string;
  content_extracted: string | null;
  file_size: number;
  created_at: string;
  updated_at: string;
}

export interface DocumentFolder {
  id: string;
  user_id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
}

export const documentsService = {
  async list(options?: { folder_id?: string; order?: string; limit?: number }): Promise<Document[]> {
    const params: Record<string, string> = {};
    if (options?.folder_id) params.folder_id = options.folder_id;
    if (options?.order) params.order = options.order;
    if (options?.limit) params.limit = String(options.limit);
    return apiClient.get<Document[]>('documents', Object.keys(params).length ? params : undefined);
  },

  async get(id: string): Promise<Document> {
    return apiClient.get<Document>(`documents/${id}`);
  },

  async create(doc: Partial<Document> & { id?: string }): Promise<Document> {
    return apiClient.post<Document>('documents', doc);
  },

  async update(id: string, updates: Partial<Document>): Promise<Document> {
    return apiClient.patch<Document>(`documents/${id}`, updates);
  },

  async remove(id: string): Promise<{ deleted: boolean; id: string }> {
    return apiClient.delete(`documents/${id}`);
  },

  // ── Folders ──
  async listFolders(): Promise<DocumentFolder[]> {
    return apiClient.get<DocumentFolder[]>('document-folders');
  },

  async createFolder(folder: { name: string; parent_id?: string; id?: string }): Promise<DocumentFolder> {
    return apiClient.post<DocumentFolder>('document-folders', folder);
  },

  async updateFolder(id: string, updates: Partial<DocumentFolder>): Promise<DocumentFolder> {
    return apiClient.patch<DocumentFolder>(`document-folders/${id}`, updates);
  },

  async removeFolder(id: string): Promise<{ deleted: boolean; id: string }> {
    return apiClient.delete(`document-folders/${id}`);
  },
};
