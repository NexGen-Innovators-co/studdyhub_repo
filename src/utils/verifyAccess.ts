// utils/verifyAccess.ts
import { supabase } from '@/integrations/supabase/client';

export const verifyResourceAccess = {
  async verifyPost(postId: string, userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('social_posts')
        .select('id, author_id, privacy')
        .eq('id', postId)
        .single();

      if (error || !data) return false;

      // Public posts are accessible to all
      if (data.privacy === 'public') return true;

      // Author always has access
      if (data.author_id === userId) return true;

      // For followers-only posts, check if user follows the author
      if (data.privacy === 'followers') {
        const { data: followData } = await supabase
          .from('social_follows')
          .select('id')
          .eq('follower_id', userId)
          .eq('following_id', data.author_id)
          .single();

        return !!followData;
      }

      return false;
    } catch {
      return false;
    }
  },

  async verifyGroup(groupId: string, userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('social_groups')
        .select('id, privacy, created_by')
        .eq('id', groupId)
        .single();

      if (error || !data) return false;

      // Public groups are accessible to all
      if (data.privacy === 'public') return true;

      // Creator always has access
      if (data.created_by === userId) return true;

      // Check if user is a member
      const { data: memberData } = await supabase
        .from('social_group_members')
        .select('id')
        .eq('group_id', groupId)
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();

      return !!memberData;
    } catch {
      return false;
    }
  },

  async verifyProfile(profileUserId: string, currentUserId: string): Promise<boolean> {
    try {
      // Users can always view their own profile
      if (profileUserId === currentUserId) return true;

      const { data, error } = await supabase
        .from('social_users')
        .select('id, is_public')
        .eq('id', profileUserId)
        .single();

      if (error || !data) return false;

      // Public profiles are accessible to all
      if (data.is_public) return true;

      // Check if current user follows this profile
      const { data: followData } = await supabase
        .from('social_follows')
        .select('id')
        .eq('follower_id', currentUserId)
        .eq('following_id', profileUserId)
        .single();

      return !!followData;
    } catch {
      return false;
    }
  },

  async verifyChatSession(sessionId: string, userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('chat_sessions')
        .select('id, user_id')
        .eq('id', sessionId)
        .single();

      if (error || !data) return false;

      return data.user_id === userId;
    } catch {
      return false;
    }
  },

  async verifyNote(noteId: string, userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('notes')
        .select('id, user_id')
        .eq('id', noteId)
        .single();

      if (error || !data) return false;

      return data.user_id === userId;
    } catch {
      return false;
    }
  },

  async verifyDocument(documentId: string, userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('id, user_id')
        .eq('id', documentId)
        .single();

      if (error || !data) return false;

      return data.user_id === userId;
    } catch {
      return false;
    }
  },

  async verifyRecording(recordingId: string, userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('class_recordings')
        .select('id, user_id')
        .eq('id', recordingId)
        .single();

      if (error || !data) return false;

      return data.user_id === userId;
    } catch {
      return false;
    }
  },

  async verifyQuiz(quizId: string, userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('quizzes')
        .select('id, user_id')
        .eq('id', quizId)
        .single();

      if (error || !data) return false;

      return data.user_id === userId;
    } catch {
      return false;
    }
  }
};
