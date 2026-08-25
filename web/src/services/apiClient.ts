/**
 * API Client — Unified HTTP client for the Supabase API Gateway.
 *
 * All web app data requests go through this client instead of direct
 * supabase.from() / supabase.rpc() calls. This aligns the web app
 * with the mobile app's server-side architecture.
 *
 * Auth stays on supabase.auth SDK — this client just attaches the JWT.
 */

import { supabase } from '@/integrations/supabase/client';

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface ApiResponse<T = any> {
  success: boolean;
  data: T | null;
  error: string | null;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    timestamp: string;
  };
}

export interface ApiError {
  message: string;
  status: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════

const GATEWAY_PATH = '/functions/v1/api/v1';
const REQUEST_TIMEOUT = 30000; // 30s

// ═══════════════════════════════════════════════════════════════════════════
// Core Request Function
// ═══════════════════════════════════════════════════════════════════════════

async function request<T>(
  method: string,
  path: string,
  body?: Record<string, any> | null,
  options?: { timeout?: number; params?: Record<string, string> }
): Promise<T> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) throw new Error('VITE_SUPABASE_URL is not configured');

  // Build URL with query params
  let url = `${supabaseUrl}${GATEWAY_PATH}/${path}`;
  if (options?.params) {
    const searchParams = new URLSearchParams(options.params);
    url += `?${searchParams.toString()}`;
  }

  // Get current session JWT
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Timeout controller
  const controller = new AbortController();
  const timeout = options?.timeout || REQUEST_TIMEOUT;
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const json: ApiResponse<T> = await response.json();

    if (!json.success) {
      throw {
        message: json.error || 'Unknown API error',
        status: response.status,
      } as ApiError;
    }

    return json.data as T;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw { message: `Request timed out after ${timeout}ms`, status: 408 } as ApiError;
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Public API — HTTP Methods
// ═══════════════════════════════════════════════════════════════════════════

export const apiClient = {
  /** GET request — fetches data from a gateway route */
  async get<T = any>(path: string, params?: Record<string, string>, timeout?: number): Promise<T> {
    return request<T>('GET', path, null, { params, timeout });
  },

  /** POST request — creates data or invokes an action */
  async post<T = any>(path: string, body?: Record<string, any>, timeout?: number): Promise<T> {
    return request<T>('POST', path, body, { timeout });
  },

  /** PATCH/PUT request — updates data */
  async patch<T = any>(path: string, body?: Record<string, any>, timeout?: number): Promise<T> {
    return request<T>('PATCH', path, body, { timeout });
  },

  /** DELETE request — removes data */
  async delete<T = any>(path: string, params?: Record<string, string>, timeout?: number): Promise<T> {
    return request<T>('DELETE', path, null, { params, timeout });
  },

  /** RPC call — invokes a server-side PostgreSQL function */
  async rpc<T = any>(functionName: string, params?: Record<string, any>, timeout?: number): Promise<T> {
    return request<T>('POST', `rpc/${functionName}`, params || {}, { timeout });
  },
};
