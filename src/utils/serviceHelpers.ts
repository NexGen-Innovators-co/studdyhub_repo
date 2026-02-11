// src/utils/serviceHelpers.ts
// Reusable error-handling and retry utilities for Supabase service calls.

import { toast } from 'sonner';

// ─── Error classification ─────────────────────────────────────────────────────

export type ServiceErrorKind =
  | 'network'
  | 'auth'
  | 'not_found'
  | 'rate_limited'
  | 'validation'
  | 'server'
  | 'unknown';

export interface ServiceError {
  kind: ServiceErrorKind;
  message: string;
  original?: unknown;
}

export function classifyError(error: unknown): ServiceError {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();

    if (msg.includes('fetch') || msg.includes('network') || msg.includes('offline') || msg.includes('aborterror')) {
      return { kind: 'network', message: 'Network error. Check your connection and try again.', original: error };
    }
    if (msg.includes('jwt') || msg.includes('not authenticated') || msg.includes('auth') || msg.includes('401')) {
      return { kind: 'auth', message: 'Session expired. Please sign in again.', original: error };
    }
    if (msg.includes('not found') || msg.includes('404') || msg.includes('pgrst116')) {
      return { kind: 'not_found', message: 'Resource not found.', original: error };
    }
    if (msg.includes('rate') || msg.includes('429') || msg.includes('too many')) {
      return { kind: 'rate_limited', message: 'Too many requests. Please wait a moment.', original: error };
    }
    if (msg.includes('violates') || msg.includes('invalid') || msg.includes('validation')) {
      return { kind: 'validation', message: error.message, original: error };
    }
    if (msg.includes('500') || msg.includes('internal')) {
      return { kind: 'server', message: 'Server error. Please try again later.', original: error };
    }
    return { kind: 'unknown', message: error.message || 'An unexpected error occurred.', original: error };
  }
  // Handle Supabase error objects
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const sErr = error as { code: string; message?: string; details?: string };
    if (sErr.code === 'PGRST301' || sErr.code === '42501') {
      return { kind: 'auth', message: 'Permission denied. RLS policy blocked this request.', original: error };
    }
    return { kind: 'unknown', message: sErr.message || 'Database error.', original: error };
  }
  return { kind: 'unknown', message: 'An unexpected error occurred.', original: error };
}

// ─── Safe service call wrapper ────────────────────────────────────────────────

export interface SafeCallOptions {
  /** User-visible action description for error messages (e.g. "load notes") */
  context?: string;
  /** Show toast on error? Default true */
  showToast?: boolean;
  /** Number of retries (default 0) */
  retries?: number;
  /** Delay between retries in ms (default 1000, exponential backoff applied) */
  retryDelay?: number;
}

/**
 * Wrap any async service call with standardised error handling and optional retry.
 * Returns `{ data, error }` — never throws.
 */
export async function safeServiceCall<T>(
  fn: () => Promise<T>,
  options: SafeCallOptions = {}
): Promise<{ data: T | null; error: ServiceError | null }> {
  const { context, showToast = true, retries = 0, retryDelay = 1000 } = options;

  let lastError: ServiceError | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const data = await fn();
      return { data, error: null };
    } catch (err) {
      lastError = classifyError(err);

      // Don't retry auth or validation errors
      if (lastError.kind === 'auth' || lastError.kind === 'validation') break;

      // Wait before retry (exponential backoff)
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, retryDelay * Math.pow(2, attempt)));
      }
    }
  }

  if (showToast && lastError) {
    const prefix = context ? `Failed to ${context}` : 'Error';
    toast.error(`${prefix}: ${lastError.message}`);
  }

  return { data: null, error: lastError };
}
