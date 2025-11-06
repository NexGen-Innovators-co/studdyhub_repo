import { SocialPostWithDetails } from '../../../integrations/supabase/socialTypes';

// Base URL for the application, configurable via environment variable
const BASE_URL = import.meta.env.VITE_BASE_URL || 'https://studdyhub.vercel.app.com';
//console.log('BASE_URL:', BASE_URL);

export const extractHashtags = (content: string): string[] => {
  const hashtagRegex = /#(\w+)/g;
  const hashtags = [];
  let match;
  while ((match = hashtagRegex.exec(content)) !== null) {
    hashtags.push(match[1].toLowerCase());
  }
  return [...new Set(hashtags)];
};

export const formatPostContent = (content: string): string => {
  return content.trim();
};

export const validatePostContent = (content: string): boolean => {
  return content.trim().length > 0 && content.length <= 500;
};

export const getTimeAgo = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'Just now';
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes}m ago`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours}h ago`;
  } else if (diffInSeconds < 604800) {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days}d ago`;
  } else {
    return date.toLocaleDateString();
  }
};

export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

export const generateShareText = (post: SocialPostWithDetails): string => {
  const authorName = post.author?.display_name || 'Someone';
  const truncatedContent = truncateText(post.content, 100);
  const postUrl = `${BASE_URL}/social/post/${post.id}`;
  return `Check out this post by ${authorName}: "${truncatedContent}" ${postUrl}`;
};

export const formatEngagementCount = (count: number): string => {
  if (count < 1000) {
    return count.toString();
  } else if (count < 1000000) {
    return `${(count / 1000).toFixed(1)}K`;
  } else {
    return `${(count / 1000000).toFixed(1)}M`;
  }
};

export const validateHashtag = (hashtag: string): boolean => {
  const hashtagRegex = /^[a-zA-Z0-9_]+$/;
  return hashtag.length > 0 && hashtag.length <= 50 && hashtagRegex.test(hashtag);
};

export const getCategoryEmoji = (category: string): string => {
  const emojiMap: { [key: string]: string } = {
    general: '🌐',
    technology: '💻',
    gaming: '🎮',
    music: '🎵',
    art: '🎨',
    sports: '⚽',
    education: '📚',
    food: '🍽️',
    travel: '✈️'
  };
  return emojiMap[category.toLowerCase()] || '🌐';
};