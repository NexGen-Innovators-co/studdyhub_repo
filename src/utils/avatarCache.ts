/**
 * Avatar Image Cache & Throttling Utility
 * Manages caching of successfully loaded avatar URLs and throttles concurrent requests
 * to prevent rate limiting from external services like Google Images
 */

interface CacheEntry {
  url: string;
  timestamp: number;
  failed?: boolean;
}

const CACHE_DURATION = 1000 * 60 * 60; // 1 hour
const FAILED_RETRY_COOLDOWN_MS = 1000 * 60 * 5; // 5 min

class AvatarCache {
  private cache: Map<string, CacheEntry> = new Map();

  /**
   * Get cached avatar URL if available and fresh
   */
  getCached(url: string): string | null {
    if (!url) return null;

    const entry = this.cache.get(url);
    if (!entry) return null;

    // Check if cache is still fresh
    if (Date.now() - entry.timestamp > CACHE_DURATION) {
      this.cache.delete(url);
      return null;
    }

    // If previously failed, don't return it
    if (entry.failed) return null;

    return entry.url;
  }

  /**
   * Mark URL as successfully loaded
   */
  setCached(url: string): void {
    if (!url) return;
    this.cache.set(url, {
      url,
      timestamp: Date.now(),
      failed: false,
    });
  }

  /**
   * Mark URL as failed (rate limited or invalid)
   */
  setFailed(url: string): void {
    if (!url) return;
    this.cache.set(url, {
      url,
      timestamp: Date.now(),
      failed: true,
    });
  }

  shouldAttempt(url: string): boolean {
    if (!url) return false;
    const entry = this.cache.get(url);
    if (!entry) return true;
    if (!entry.failed) return true;
    if (Date.now() - entry.timestamp > FAILED_RETRY_COOLDOWN_MS) {
      this.cache.delete(url);
      return true;
    }
    return false;
  }

  /**
   * Clear old cache entries
   */
  clearExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > CACHE_DURATION) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics (for debugging)
   */
  getStats() {
    return {
      cacheSize: this.cache.size,
      failedEntries: Array.from(this.cache.values()).filter((e) => e.failed).length,
    };
  }
}

// Singleton instance
export const avatarCache = new AvatarCache();

// Periodically clear expired entries
setInterval(() => {
  avatarCache.clearExpired();
}, 1000 * 60 * 5); // Every 5 minutes
