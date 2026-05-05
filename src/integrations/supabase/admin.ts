// src/integrations/supabase/admin.ts
import { Database } from './types';

export type AdminRole = Database['public']['Enums']['admin_role'];

export interface AdminUser {
  id: string;
  user_id: string;
  email: string;
  role: AdminRole;
  permissions: Record<string, boolean>;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  last_login: string | null;
  created_by: string | null;
}

export interface AdminActivityLog {
  id: string;
  admin_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, any>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface SystemSetting {
  id: string;
  key: string;
  value: any;
  description: string | null;
  category: string;
  is_public: boolean | null;
  updated_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface ModerationItem {
  id: string;
  content_type: string;
  content_id: string;
  reported_by: string | null;
  reason: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  moderator_id: string | null;
  moderator_notes: string | null;
  priority: number | null;
  created_at: string;
  resolved_at: string | null;
}

export interface AdminPermissions {
  canManageUsers: boolean;
  canManageAdmins: boolean;
  canManageContent: boolean;
  canManageSettings: boolean;
  canViewLogs: boolean;
  canModerateContent: boolean;
  isSuperAdmin: boolean;
}

export interface UserStats {
  total_users: number;
  active_users_7d: number;
  active_users_30d: number;
  new_users_today: number;
  new_users_week: number;
  new_users_month: number;
}

export interface ContentStats {
  total_posts: number;
  total_comments: number;
  total_groups: number;
  total_notes: number;
  total_recordings: number;
  total_documents: number;
}

export interface AdminDashboardStats {
  users: UserStats;
  content: ContentStats;
  pending_reports: number;
  pending_moderation: number;
}