import { SocialPostWithDetails } from '../../../integrations/supabase/socialTypes';
import React from 'react';

// Base URL for the application, configurable via environment variable
const BASE_URL = import.meta.env.VITE_BASE_URL || 'https://studdyhub.vercel.app';


export const extractHashtags = (content: string): string[] => {
  const hashtagRegex = /#(\w+)/g;
  const hashtags = [];
  let match;
  while ((match = hashtagRegex.exec(content)) !== null) {
    hashtags.push(match[1].toLowerCase());
  }
  return [...new Set(hashtags)];
};

export const extractLinks = (content: string): string[] => {
  const urlRegex = /((?:https?:\/\/|www\.)[^\s]+)/g;
  const links = content.match(urlRegex) || [];
  return [...new Set(links.map(link => link.replace(/[.,!?;:]+$/, '')))];
};

export const removeHashtagsFromContent = (content: string): string => {
  // Remove hashtags but keep the content structure
  return content.replace(/#\w+/g, '').replace(/\s+/g, ' ').trim();
};

export const formatPostContent = (content: string): string => {
  return content.trim();
};

export const renderContentWithClickableLinks = (
  content: string,
  onHashtagClick?: (hashtag: string) => void,
): React.ReactNode => {
  const combinedRegex = /(#\w+)|((?:https?:\/\/|www\.)[^\s]+)/g;
  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = combinedRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      elements.push(
        React.createElement('span', { key: `text-${lastIndex}` }, content.substring(lastIndex, match.index)),
      );
    }

    if (match[2]) {
      let href = match[2];
      let display = href;
      let suffix = '';
      const trailingPunctuation = /[.,!?;:]+$/;
      const trailingMatch = href.match(trailingPunctuation);
      if (trailingMatch) {
        suffix = trailingMatch[0];
        display = href.substring(0, href.length - suffix.length);
        href = display;
      }

      if (!href.startsWith('http') && href.startsWith('www.')) {
        href = 'https://' + href;
      }

      const link = React.createElement(
        'a',
        {
          key: `link-${match.index}`,
          href,
          target: '_blank',
          rel: 'noopener noreferrer',
          className: 'text-blue-600 dark:text-blue-400 hover:underline',
          onClick: (e: React.MouseEvent) => e.stopPropagation(),
        },
        display,
      );

      if (suffix) {
        elements.push(React.createElement(React.Fragment, { key: `fragment-${match.index}` }, link, suffix));
      } else {
        elements.push(link);
      }
    } else if (match[1]) {
      const hashtag = match[1];
      const normalized = hashtag.replace(/^#/, '');
      elements.push(
        React.createElement(
          'span',
          {
            key: `hashtag-${match.index}`,
            className: 'text-blue-600 dark:text-blue-400 hover:underline cursor-pointer',
            onClick: (e: React.MouseEvent) => {
              e.stopPropagation();
              if (onHashtagClick) onHashtagClick(normalized);
            },
          },
          hashtag,
        ),
      );
    }

    lastIndex = combinedRegex.lastIndex;
  }

  if (lastIndex < content.length) {
    elements.push(React.createElement('span', { key: `text-${lastIndex}` }, content.substring(lastIndex)));
  }

  return elements;
};

export const convertNakedUrlsToMarkdown = (content: string): string => {
  // Regex to match domains like example.com, studdyhub.vercel.app
  // Excludes items already starting with http/https/www (handled separately or fine)
  // We want to turn " studdyhub.vercel.app " into " [studdyhub.vercel.app](https://studdyhub.vercel.app) "
  
  return content.replace(/(\s|^)(?!(?:https?:\/\/|www\.|@|#))([a-zA-Z0-9-]+\.[a-zA-Z0-9-]+\.[a-zA-Z0-9-]{2,}|[a-zA-Z0-9-]+\.[a-z]{2,})(\/[^\s]*)?/g, (match, prefix, domain, path) => {
      const url = domain + (path || '');
      return `${prefix}[${url}](https://${url})`;
  });
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