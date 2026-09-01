// src/utils/adminActivityLogger.ts
// Centralised fire-and-forget logger for admin_activity_logs.
// Import and call from any admin component after a write operation.
import { supabase } from '../../../integrations/supabase/client';
import { apiClient } from '@/services/apiClient';

export interface AdminLogEntry {
  action: string;
  target_type?: string;
  target_id?: string;
  details?: Record<string, any>;
}

let cachedAuthUserId: string | null = null;
let cachedAdminUserId: string | null = null;

async function getAdminUserIdForCurrentUser(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  if (cachedAuthUserId === user.id && cachedAdminUserId) {
    return cachedAdminUserId;
  }

  const data = await apiClient.get('admin-users', { user_id: user.id }) as any[];
  const adminUser = Array.isArray(data) ? data[0] : data;
  if (!adminUser?.id) return null;

  cachedAuthUserId = user.id;
  cachedAdminUserId = adminUser.id;
  return adminUser.id;
}

/**
 * Log an admin action. Resolves the current user automatically.
 * Fire-and-forget — never throws, never blocks the caller.
 */
export async function logAdminActivity(entry: AdminLogEntry): Promise<void> {
  try {
    const adminUserId = await getAdminUserIdForCurrentUser();
    if (!adminUserId) return;

    await apiClient.post('admin-activity-logs', {
      admin_id: adminUserId,
      action: entry.action,
      target_type: entry.target_type || null,
      target_id: entry.target_id || null,
      details: entry.details || {},
    });
  } catch {
    // Intentionally swallowed — activity logging must never break the caller
  }
}
