/**
 * Chat Service — AI chat sessions + messages via the API Gateway.
 */

import { apiClient } from './apiClient';

export interface ChatSession {
  id: string;
  user_id: string;
  title: string;
  document_ids: string[];
  message_count: number;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  is_error: boolean;
  attached_document_ids: string[];
  attached_note_ids: string[];
  has_been_displayed: boolean;
  files_metadata: any;
  image_url: string | null;
  image_mime_type: string | null;
}

export const chatService = {
  // ── Sessions ──
  async listSessions(): Promise<ChatSession[]> {
    return apiClient.get<ChatSession[]>('chat/sessions');
  },

  async createSession(data?: { title?: string; document_ids?: string[] }): Promise<ChatSession> {
    return apiClient.post<ChatSession>('chat/sessions', data || {});
  },

  async deleteSession(sessionId: string): Promise<{ deleted: boolean; id: string }> {
    return apiClient.delete(`chat/sessions/${sessionId}`);
  },

  // ── Messages ──
  async listMessages(sessionId: string): Promise<ChatMessage[]> {
    return apiClient.get<ChatMessage[]>('chat/messages', { session_id: sessionId });
  },

  async sendMessage(sessionId: string, content: string, role?: string): Promise<ChatMessage> {
    return apiClient.post<ChatMessage>('chat/messages', { session_id: sessionId, content, role: role || 'user' });
  },

  async deleteMessage(messageId: string): Promise<{ deleted: boolean; id: string }> {
    return apiClient.delete(`chat/messages/${messageId}`);
  },
};
