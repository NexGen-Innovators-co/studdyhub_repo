// integrations/supabase/socialTypes.ts
// Social Network Types for Supabase
// These types extend the existing Database type with social network tables

export interface SocialUser {
    id: string;
    username: string;
    display_name: string;
    avatar_url?: string;
    bio?: string;
    interests?: string[];
    is_verified: boolean;
    is_contributor: boolean;
    followers_count: number;
    following_count: number;
    posts_count: number;
    last_active: string;
    created_at: string;
    updated_at: string;
    email?: string;
}

export interface SocialPost {
    id: string;
    author_id: string;
    content: string;
    privacy: 'public' | 'followers' | 'private';
    group_id?: string;
    likes_count: number;
    comments_count: number;
    shares_count: number;
    bookmarks_count: number;
    created_at: string;
    updated_at: string;
    views_count?: number;
}

export interface SocialMedia {
    id: string;
    post_id: string;
    type: 'image' | 'video' | 'document';
    url: string;
    thumbnail_url?: string;
    filename: string;
    size_bytes: number;
    mime_type: string;
    created_at: string;
}

export interface SocialHashtag {
    id: string;
    name: string;
    posts_count: number;
    created_at: string;
}

export interface SocialTag {
    id: string;
    name: string;
    created_at: string;
}
// Add this to your existing socialTypes.ts file

// Update SocialGroup interface
export interface SocialGroup {
    id: string;
    name: string;
    description: string | null;
    avatar_url: string | null;
    cover_image_url: string | null;
    category: string; // ADD THIS LINE
    privacy: 'public' | 'private';
    members_count: number;
    posts_count: number;
    created_by: string;
    created_at: string;
    updated_at: string;
  }
  
  // Update CreateGroupData interface
  export interface CreateGroupData {
    name: string;
    description: string;
    category?: string; // ADD THIS LINE
    privacy: 'public' | 'private';
    avatar_url?: string;
    cover_image_url?: string;
  }
export interface SocialGroupMember {
    id: string;
    group_id: string;
    user_id: string;
    role: 'admin' | 'moderator' | 'member';
    joined_at: string;
    status?: 'active' | 'pending' | 'banned';
}

export interface SocialComment {
    id: string;
    post_id: string;
    author_id: string;
    content: string;
    parent_comment_id?: string;
    likes_count: number;
    created_at: string;
    updated_at: string;
}

export interface SocialCommentMedia {
    id: string;
    comment_id: string;
    type: 'image' | 'video' | 'document';
    url: string;
    filename: string;
    size_bytes: number;
    mime_type: string;
    created_at: string;
}

export interface SocialLike {
    id: string;
    user_id: string;
    post_id?: string;
    comment_id?: string;
    created_at: string;
}

export interface SocialBookmark {
    id: string;
    user_id: string;
    post_id: string;
    created_at: string;
}

export interface SocialFollow {
    id: string;
    follower_id: string;
    following_id: string;
    created_at: string;
}

export interface SocialNotification {
    id: string;
    user_id: string;
    type: 'like' | 'comment' | 'share' | 'follow' | 'group_invite' | 'mention';
    title: string;
    message: string;
    data?: any;
    is_read: boolean;
    created_at: string;
    actor_id?: string;
    post_id?: string;
}

export interface SocialEvent {
    id: string;
    title: string;
    description?: string;
    group_id?: string;
    organizer_id: string;
    start_date: string;
    end_date: string;
    location?: string;
    is_online: boolean;
    max_attendees?: number;
    created_at: string;
    updated_at: string;
}

export interface SocialEventAttendee {
    id: string;
    event_id: string;
    user_id: string;
    status: 'attending' | 'maybe' | 'declined';
    created_at: string;
}

export interface SocialChatMessage {
    id: string;
    group_id: string;
    sender_id: string;
    content: string;
    created_at: string;
}

export interface SocialChatMessageMedia {
    id: string;
    message_id: string;
    type: 'image' | 'video' | 'document';
    url: string;
    filename: string;
    size_bytes: number;
    mime_type: string;
    created_at: string;
}

export interface SocialShare {
    id: string;
    user_id: string;
    original_post_id: string;
    share_text?: string;
    created_at: string;
}

export interface SocialReport {
    id: string;
    reporter_id: string;
    reported_user_id?: string;
    post_id?: string;
    comment_id?: string;
    group_id?: string;
    reason: string;
    description?: string;
    status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
    moderator_id?: string;
    created_at: string;
    updated_at: string;
}

// Extended types with relationships
export interface SocialPostWithDetails extends SocialPost {
    author: SocialUser;
    media: SocialMedia[];
    hashtags: SocialHashtag[];
    tags: SocialTag[];
    group?: SocialGroup;
    is_liked?: boolean;
    is_bookmarked?: boolean;
    metadata?: any; // Patch: allow metadata for podcast/social post logic
}

export interface SocialGroupWithDetails extends SocialGroup {
    creator: SocialUserWithDetails;
    is_member: boolean;
    member_role: 'admin' | 'moderator' | 'member' | null;
    member_status: 'active' | 'pending' | 'banned' | null;
}

export interface SocialCommentWithDetails extends SocialComment {
    author: SocialUser;
    media?: SocialCommentMedia[];
    is_liked?: boolean;
}

export interface SocialUserWithDetails extends SocialUser {
    is_following?: boolean;
    is_followed_by?: boolean;
}


// Database table names
export const SOCIAL_TABLES = {
    USERS: 'social_users',
    POSTS: 'social_posts',
    MEDIA: 'social_media',
    HASHTAGS: 'social_hashtags',
    POST_HASHTAGS: 'social_post_hashtags',
    TAGS: 'social_tags',
    POST_TAGS: 'social_post_tags',
    GROUPS: 'social_groups',
    GROUP_MEMBERS: 'social_group_members',
    COMMENTS: 'social_comments',
    COMMENT_MEDIA: 'social_comment_media',
    LIKES: 'social_likes',
    BOOKMARKS: 'social_bookmarks',
    FOLLOWS: 'social_follows',
    NOTIFICATIONS: 'social_notifications',
    EVENTS: 'social_events',
    EVENT_ATTENDEES: 'social_event_attendees',
    CHAT_MESSAGES: 'social_chat_messages',
    CHAT_MESSAGE_MEDIA: 'social_chat_message_media',
    SHARES: 'social_shares',
    REPORTS: 'social_reports',
} as const;

// Social Privacy types
export type Privacy = SocialPost['privacy'];
export type GroupPrivacy = SocialGroup['privacy'];