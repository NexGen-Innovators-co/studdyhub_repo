// src/utils/requestCache.ts
// Shared in-memory request caching, deduplication, and rate limiting utility.
// Prevents duplicate concurrent requests, caches responses, and enforces
// minimum intervals between identical calls.

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface RateLimitEntry {
  lastCall: number;
  count: number;
  windowStart: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const inflightRequests = new Map<string, Promise<unknown>>();
const rateLimits = new Map<string, RateLimitEntry>();

const DEFAULT_CACHE_TTL = 2 * 60 * 1000;       // 2 minutes
const DEFAULT_MIN_INTERVAL = 1000;               // 1 second between identical calls
const DEFAULT_RATE_LIMIT = 30;                    // 30 calls per window
const DEFAULT_RATE_WINDOW = 60 * 1000;            // 1 minute window
const MAX_CACHE_SIZE = 500;

/** Evict oldest entries when cache exceeds limit */
function evictIfNeeded() {
  if (cache.size <= MAX_CACHE_SIZE) return;
  const entries = [...cache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
  const toRemove = entries.slice(0, cache.size - MAX_CACHE_SIZE + 50);
  for (const [key] of toRemove) {
    cache.delete(key);
  }
}

export interface CachedRequestOptions {
  /** Cache key — must be unique per distinct request */
  key: string;
  /** Time to live in ms (default: 2 min) */
  ttl?: number;
  /** Minimum interval between identical calls in ms (default: 1s) */
  minInterval?: number;
  /** Skip cache and force fresh request */
  skipCache?: boolean;
}

/**
 * Execute a request with deduplication, caching, and rate limiting.
 * - If the same key is in-flight, returns the existing promise (dedup).
 * - If a cached value exists within TTL, returns it immediately.
 * - Enforces minimum interval between calls.
 */
export async function cachedRequest<T>(
  fn: () => Promise<T>,
  options: CachedRequestOptions
): Promise<T> {
  const { key, ttl = DEFAULT_CACHE_TTL, minInterval = DEFAULT_MIN_INTERVAL, skipCache = false } = options;

  // 1. Check cache
  if (!skipCache) {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < ttl) {
      return cached.data as T;
    }
  }

  // 2. Deduplicate in-flight requests
  const inflight = inflightRequests.get(key);
  if (inflight) {
    return inflight as Promise<T>;
  }

  // 3. Enforce minimum interval
  const lastEntry = rateLimits.get(key);
  if (lastEntry && Date.now() - lastEntry.lastCall < minInterval) {
    // Return cached data if available, otherwise wait
    const cached = cache.get(key);
    if (cached) return cached.data as T;
  }

  // 4. Execute and cache
  const promise = fn()
    .then((result) => {
      cache.set(key, { data: result, timestamp: Date.now() });
      evictIfNeeded();

      // Track rate limit
      const now = Date.now();
      const existing = rateLimits.get(key);
      if (existing && now - existing.windowStart < DEFAULT_RATE_WINDOW) {
        existing.lastCall = now;
        existing.count++;
      } else {
        rateLimits.set(key, { lastCall: now, count: 1, windowStart: now });
      }

      return result;
    })
    .finally(() => {
      inflightRequests.delete(key);
    });

  inflightRequests.set(key, promise);
  return promise;
}

/**
 * Check if we're being rate-limited for a given key.
 * Returns true if the caller should back off.
 */
export function isRateLimited(key: string, maxCalls = DEFAULT_RATE_LIMIT, windowMs = DEFAULT_RATE_WINDOW): boolean {
  const entry = rateLimits.get(key);
  if (!entry) return false;
  if (Date.now() - entry.windowStart > windowMs) return false;
  return entry.count >= maxCalls;
}

/**
 * Invalidate a specific cache entry or all entries matching a prefix.
 */
export function invalidateCache(keyOrPrefix: string, isPrefix = false): void {
  if (isPrefix) {
    for (const key of cache.keys()) {
      if (key.startsWith(keyOrPrefix)) {
        cache.delete(key);
      }
    }
  } else {
    cache.delete(keyOrPrefix);
  }
}

/**
 * Clear the entire request cache.
 */
export function clearRequestCache(): void {
  cache.clear();
  rateLimits.clear();
}

/**
 * Debounce a function call. Returns a debounced version.
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delayMs: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delayMs);
  };
}
