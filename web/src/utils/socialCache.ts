export const CACHE_KEYS = {
  POSTS: 'social_cache_posts',
  TRENDING: 'social_cache_trending',
  USER_POSTS: 'social_cache_user_posts',
  GROUPS: 'social_cache_groups',
  SUGGESTED: 'social_cache_suggested',
  HASHTAGS: 'social_cache_hashtags',
  TIMESTAMP: 'social_cache_timestamp',
  OWNER: 'social_cache_owner',
};

export const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/** Set the user ID that owns the current cache. Call on login / user change. */
export const setCacheOwner = (userId: string) => {
  try {
    sessionStorage.setItem(CACHE_KEYS.OWNER, userId);
  } catch (_) {}
};

/** Return true when the cached data belongs to a different user. */
const isCacheStale = (currentUserId?: string | null): boolean => {
  if (!currentUserId) return true;
  try {
    const owner = sessionStorage.getItem(CACHE_KEYS.OWNER);
    return owner !== currentUserId;
  } catch {
    return true;
  }
};

export const saveToCache = (key: string, data: any) => {
  try {
    sessionStorage.setItem(key, JSON.stringify(data));
    sessionStorage.setItem(CACHE_KEYS.TIMESTAMP, Date.now().toString());
  } catch (e) {
    //console.warn('Failed to save to cache:', e);
  }
};

/**
 * Load cached data. If an optional `currentUserId` is provided the cache is
 * discarded when it belongs to a different user.
 */
export const loadFromCache = (key: string, currentUserId?: string | null) => {
  try {
    // If the cache belongs to a different user, discard it entirely
    if (currentUserId && isCacheStale(currentUserId)) {
      clearCache();
      return null;
    }

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