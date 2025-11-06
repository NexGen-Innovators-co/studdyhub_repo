import { useEffect, useState, createContext, useContext, ReactNode } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '../integrations/supabase/client';
import { AdminUser, AdminPermissions } from '../integrations/supabase/admin';

interface AdminAuthContextType {
  adminUser: AdminUser | null;
  permissions: AdminPermissions;
  loading: boolean;
  isAdmin: boolean;
  refreshAdminStatus: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (context === undefined) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
};

interface AdminAuthProviderProps {
  children: ReactNode;
}

const getPermissions = (adminUser: AdminUser | null): AdminPermissions => {
  if (!adminUser) {
    return {
      canManageUsers: false,
      canManageAdmins: false,
      canManageContent: false,
      canManageSettings: false,
      canViewLogs: false,
      canModerateContent: false,
      isSuperAdmin: false,
    };
  }

  const isSuperAdmin = adminUser.role === 'super_admin';
  const isAdmin = adminUser.role === 'admin';

  return {
    canManageUsers: isSuperAdmin || isAdmin,
    canManageAdmins: isSuperAdmin,
    canManageContent: isSuperAdmin || isAdmin,
    canManageSettings: isSuperAdmin,
    canViewLogs: isSuperAdmin || isAdmin,
    canModerateContent: true, // All admin roles can moderate
    isSuperAdmin,
  };
};

export const AdminAuthProvider = ({ children }: AdminAuthProviderProps) => {
  const { user, loading: authLoading } = useAuth();
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAdminStatus = async () => {
    if (!user) {
      setAdminUser(null);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('admin_users')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) {
        if (error.code !== 'PGRST116') {
          console.error('Error fetching admin status:', error);
        }
        setAdminUser(null);
      } else {
        // Cast permissions to Record<string, boolean>
        const rawPerms = data.permissions as Record<string, boolean> | null;
        const admin: AdminUser = {
          ...data,
          permissions: rawPerms ?? {},
        };
        
        setAdminUser(admin);
        
        // Update last login
        await supabase
          .from('admin_users')
          .update({ last_login: new Date().toISOString() })
          .eq('id', data.id);
      }
    } catch (error) {
      console.error('Error checking admin status:', error);
      setAdminUser(null);
    } finally {
      setLoading(false);
    }
  };

  const refreshAdminStatus = async () => {
    setLoading(true);
    await fetchAdminStatus();
  };

  useEffect(() => {
    if (!authLoading) {
      fetchAdminStatus();
    }
  }, [user, authLoading]);

  const permissions = getPermissions(adminUser);
  const isAdmin = adminUser !== null && adminUser.is_active === true;

  const value = {
    adminUser,
    permissions,
    loading,
    isAdmin,
    refreshAdminStatus,
  };

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
};