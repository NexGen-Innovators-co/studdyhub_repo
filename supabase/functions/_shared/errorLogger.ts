/**
 * Shared helper: log errors to the system_error_logs table.
 * 
 * Usage from any edge function:
 *   import { logSystemError } from '../_shared/errorLogger.ts';
 *   await logSystemError(supabaseClient, { severity: 'error', source: 'generate-podcast', ... });
 * 
 * Or fire-and-forget (non-blocking):
 *   logSystemError(supabaseClient, { ... }); // no await
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface SystemErrorLog {
  severity?: 'critical' | 'error' | 'warning' | 'info';
  source: string;         // edge function name e.g. 'generate-podcast'
  component?: string;     // sub-component e.g. 'veo-polling', 'tts-generation'
  error_code?: string;    // machine-readable e.g. 'VEO_TIMEOUT', 'TTS_QUOTA_EXCEEDED'
  message: string;        // human-readable description
  details?: Record<string, any>; // extra context (stack, params, etc.)
  user_id?: string;       // user who triggered the action
  request_id?: string;    // correlation ID
}

/**
 * Log an error to the system_error_logs table via RPC.
 * Safe to call fire-and-forget (errors are swallowed and logged to console).
 */
export async function logSystemError(
  supabase: SupabaseClient,
  log: SystemErrorLog
): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc('log_system_error', {
      p_severity: log.severity || 'error',
      p_source: log.source,
      p_component: log.component || null,
      p_error_code: log.error_code || null,
      p_message: (log.message || '').substring(0, 2000), // cap length
      p_details: log.details || {},
      p_user_id: log.user_id || null,
      p_request_id: log.request_id || null,
    });

    if (error) {
      console.error('[ErrorLogger] Failed to log error:', error.message);
      return null;
    }
    return data as string;
  } catch (e) {
    // Never let logging itself crash the function
    console.error('[ErrorLogger] Exception while logging:', e);
    return null;
  }
}

/**
 * Convenience: log and also console.error in one call.
 */
export async function logAndConsole(
  supabase: SupabaseClient,
  log: SystemErrorLog
): Promise<void> {
  const prefix = `[${log.source}${log.component ? ':' + log.component : ''}]`;
  console.error(`${prefix} ${log.message}`, log.details || '');
  await logSystemError(supabase, log);
}
