export const CACHE_KEYS = {
  POSTS: 'social_cache_posts',
  TRENDING: 'social_cache_trending',
  USER_POSTS: 'social_cache_user_posts',
  GROUPS: 'social_cache_groups',
  SUGGESTED: 'social_cache_suggested',
  HASHTAGS: 'social_cache_hashtags',
  TIMESTAMP: 'social_cache_timestamp',
};

export const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const saveToCache = (key: string, data: any) => {
  try {
    sessionStorage.setItem(key, JSON.stringify(data));
    sessionStorage.setItem(CACHE_KEYS.TIMESTAMP, Date.now().toString());
  } catch (e) {
    //console.warn('Failed to save to cache:', e);
  }
};

export const loadFromCache = (key: string) => {
  try {
    const timestamp = sessionStorage.getItem(CACHE_KEYS.TIMESTAMP);
    if (timestamp) {
      const age = Date.now() - parseInt(timestamp);
      if (age > CACHE_DURATION) {
        clearCache();
        return null;
      }
    }
    const data = sessionStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    //console.warn('Failed to load from cache:', e);
    return null;
  }
};

// 🔥 FIX: Use sessionStorage instead of localStorage
export const clearCache = () => {
  try {
    // Clear all social-related cache keys from sessionStorage
    Object.values(CACHE_KEYS).forEach(key => {
      sessionStorage.removeItem(key);
    });

    // Also clear any other social-related items from sessionStorage
    const keysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith('social_')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => sessionStorage.removeItem(key));
  } catch (error) {
    //console.error('Error clearing cache:', error);
  }
};