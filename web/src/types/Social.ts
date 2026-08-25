export interface User {
    id: string;
    username: string;
    email: string;
    displayName: string;
    avatar?: string;
    bio?: string;
    interests: string[];
    isVerified: boolean;
    isContributor: boolean;
    followersCount: number;
    followingCount: number;
    postsCount: number;
    createdAt: Date;
    lastActive: Date;
}

export interface Post {
    id: string;
    authorId: string;
    author: User;
    content: string;
    media: Media[];
    hashtags: string[];
    tags: string[];
    privacy: 'public' | 'followers' | 'private';
    groupId?: string;
    likesCount: number;
    commentsCount: number;
    sharesCount: number;
    bookmarksCount: number;
    isLiked: boolean;
    isBookmarked: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface Media {
    id: string;
    type: 'image' | 'video' | 'document';
    url: string;
    thumbnail?: string;
    filename: string;
    size: number;
    mimeType: string;
}

export interface Comment {
    id: string;
    postId: string;
    authorId: string;
    author: User;
    content: string;
    media?: Media[];
    likesCount: number;
    isLiked: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface Group {
    id: string;
    name: string;
    description: string;
    avatar?: string;
    coverImage?: string;
    category: string;
    privacy: 'public' | 'private';
    membersCount: number;
    postsCount: number;
    createdAt: Date;
    updatedAt: Date;
    isMember: boolean;
    memberRole?: 'admin' | 'moderator' | 'member';
}

export interface GroupMembership {
    id: string;
    groupId: string;
    userId: string;
    user: User;
    role: 'admin' | 'moderator' | 'member';
    joinedAt: Date;
}

export interface Notification {
    id: string;
    userId: string;
    type: 'like' | 'comment' | 'share' | 'follow' | 'group_invite' | 'mention';
    title: string;
    message: string;
    data: any;
    isRead: boolean;
    createdAt: Date;
}

export interface SearchResult {
    users: User[];
    posts: Post[];
    groups: Group[];
    hashtags: string[];
}

export interface TrendingTopic {
    hashtag: string;
    postsCount: number;
    trend: 'up' | 'down' | 'stable';
}

export interface PostAnalytics {
    postId: string;
    views: number;
    uniqueViews: number;
    engagementRate: number;
    reach: number;
    impressions: number;
    clicks: number;
}

export interface Event {
    id: string;
    title: string;
    description: string;
    groupId?: string;
    organizerId: string;
    organizer: User;
    startDate: Date;
    endDate: Date;
    location?: string;
    isOnline: boolean;
    attendeesCount: number;
    maxAttendees?: number;
    isAttending: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface ChatMessage {
    id: string;
    groupId: string;
    senderId: string;
    sender: User;
    content: string;
    media?: Media[];
    createdAt: Date;
}

export interface FollowRelationship {
    id: string;
    followerId: string;
    followingId: string;
    follower: User;
    following: User;
    createdAt: Date;
} 