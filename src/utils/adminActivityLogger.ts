// src/utils/adminActivityLogger.ts
// Centralised fire-and-forget logger for admin_activity_logs.
// Import and call from any admin component after a write operation.
import { supabase } from '../integrations/supabase/client';

export interface AdminLogEntry {
  action: string;
  target_type?: string;
  target_id?: string;
  details?: Record<string, any>;
}

/**
 * Log an admin action. Resolves the current user automatically.
 * Fire-and-forget — never throws, never blocks the caller.
 */
export async function logAdminActivity(entry: AdminLogEntry): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('admin_activity_logs').insert({
      admin_id: user.id,
      action: entry.action,
      target_type: entry.target_type || null,
      target_id: entry.target_id || null,
      details: entry.details || {},
    });
  } catch {
    // Intentionally swallowed — activity logging must never break the caller
  }
}
