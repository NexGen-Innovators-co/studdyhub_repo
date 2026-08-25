/**
 * Social Service — Feed, posts, likes, bookmarks, comments, groups, follows.
 */

import { apiClient } from './apiClient';

export interface SocialPost {
  id: string;
  author_id: string;
  content: string;
  privacy: string;
  ai_categories: string[];
  metadata: any;
  created_at: string;
  social_users?: { display_name: string; avatar_url: string } | null;
}

export interface SocialComment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  social_users?: { display_name: string; avatar_url: string } | null;
}

export interface SocialLike {
  post_id: string;
  user_id: string;
  created_at: string;
}

export interface SocialGroup {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
}

export interface SocialFollow {
  follower_id: string;
  following_id: string;
  created_at: string;
}

export interface SocialChatMessage {
  id: string;
  group_id: string;
  user_id: string;
  content: string;
  created_at: string;
  social_users?: { display_name: string; avatar_url: string } | null;
}

export const socialService = {
  // ── Feed ──
  async getFeed(options?: { filter?: string; limit?: number; offset?: number }): Promise<SocialPost[]> {
    const params: Record<string, string> = {};
    if (options?.filter) params.filter = options.filter;
    if (options?.limit) params.limit = String(options.limit);
    if (options?.offset) params.offset = String(options.offset);
    return apiClient.get<SocialPost[]>('social/feed', Object.keys(params).length ? params : undefined);
  },

  // ── Posts ──
  async createPost(post: { content: string; privacy?: string; ai_categories?: any[]; metadata?: any }): Promise<SocialPost> {
    return apiClient.post<SocialPost>('social/posts', post);
  },

  async deletePost(postId: string): Promise<{ deleted: boolean; id: string }> {
    return apiClient.delete(`social/posts/${postId}`);
  },

  // ── Likes ──
  async getLikes(postId?: string): Promise<SocialLike[]> {
    const params = postId ? { post_id: postId } : undefined;
    return apiClient.get<SocialLike[]>('social/likes', params);
  },

  async toggleLike(postId: string): Promise<SocialLike> {
    return apiClient.post<SocialLike>('social/likes', { post_id: postId });
  },

  async removeLike(postId: string): Promise<{ deleted: boolean }> {
    return apiClient.delete('social/likes', { post_id: postId });
  },

  // ── Bookmarks ──
  async getBookmarks(postId?: string): Promise<SocialLike[]> {
    const params = postId ? { post_id: postId } : undefined;
    return apiClient.get<SocialLike[]>('social/bookmarks', params);
  },

  async toggleBookmark(postId: string): Promise<SocialLike> {
    return apiClient.post<SocialLike>('social/bookmarks', { post_id: postId });
  },

  async removeBookmark(postId: string): Promise<{ deleted: boolean }> {
    return apiClient.delete('social/bookmarks', { post_id: postId });
  },

  // ── Comments ──
  async getComments(postId: string): Promise<SocialComment[]> {
    return apiClient.get<SocialComment[]>('social/comments', { post_id: postId });
  },

  async createComment(postId: string, content: string): Promise<SocialComment> {
    return apiClient.post<SocialComment>('social/comments', { post_id: postId, content });
  },

  // ── Groups ──
  async listGroups(): Promise<SocialGroup[]> {
    return apiClient.get<SocialGroup[]>('social/groups');
  },

  async createGroup(group: { name: string; description?: string }): Promise<SocialGroup> {
    return apiClient.post<SocialGroup>('social/groups', group);
  },

  // ── Group Members ──
  async getGroupMembers(groupId?: string): Promise<any[]> {
    const params = groupId ? { group_id: groupId } : undefined;
    return apiClient.get('social/group-members', params);
  },

  async joinGroup(groupId: string): Promise<any> {
    return apiClient.post('social/group-members', { group_id: groupId });
  },

  async leaveGroup(groupId: string): Promise<{ deleted: boolean }> {
    return apiClient.delete('social/group-members', { group_id: groupId });
  },

  // ── Events ──
  async getEvents(groupId?: string): Promise<any[]> {
    const params = groupId ? { group_id: groupId } : undefined;
    return apiClient.get('social/events', params);
  },

  async createEvent(event: { group_id: string; title: string; description?: string; event_date?: string }): Promise<any> {
    return apiClient.post('social/events', event);
  },

  // ── Follows ──
  async getFollows(followingId?: string): Promise<SocialFollow[]> {
    const params = followingId ? { following_id: followingId } : undefined;
    return apiClient.get<SocialFollow[]>('social/follows', params);
  },

  async toggleFollow(followingId: string): Promise<SocialFollow> {
    return apiClient.post<SocialFollow>('social/follows', { following_id: followingId });
  },

  async unfollow(followingId: string): Promise<{ deleted: boolean }> {
    return apiClient.delete('social/follows', { following_id: followingId });
  },

  // ── Chat Messages (group chat) ──
  async getGroupChatMessages(groupId: string): Promise<SocialChatMessage[]> {
    return apiClient.get<SocialChatMessage[]>('social/chat-messages', { group_id: groupId });
  },

  async sendGroupChatMessage(groupId: string, content: string): Promise<SocialChatMessage> {
    return apiClient.post<SocialChatMessage>('social/chat-messages', { group_id: groupId, content });
  },

  // ── Social Users ──
  async getSocialUser(userId?: string): Promise<any> {
    const params = userId ? { user_id: userId } : undefined;
    return apiClient.get('social-users', params);
  },

  async ensureSocialUser(data: { username?: string; display_name?: string; avatar_url?: string }): Promise<any> {
    return apiClient.post('social-users', data);
  },
};
