
import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../integrations/supabase/client';
import { clearCache } from '../utils/socialCache'; // Import the utility
import { clearDashboardCache } from '@/components/dashboard/hooks/useDashboardStats';
import { offlineStorage, STORES } from '../utils/offlineStorage';
import { pushNotificationService } from '@/services/pushNotificationService';
import { resetPushInitialization } from '@/services/notificationInitService';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Clear cache when user signs out
        if (event === 'SIGNED_OUT') {
          ////console.log('🔴 Auth state: SIGNED_OUT - clearing cache');
          clearCache();
          resetPushInitialization();
          // Clear offline IndexedDB stores
          try {
            //console.log('[useAuth] SIGNED_OUT detected - clearing offline storage');
            offlineStorage.clearAll()
          } catch (e) {
            //console.warn('[useAuth] offlineStorage.clearAll threw synchronously', e);
          }
        }

      }
    );

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    try {
      // Capture user ID before clearing auth for push unsubscription
      const currentUserId = user?.id;

      // Unsubscribe from push notifications (removes browser subscription + DB record)
      if (currentUserId) {
        try {
          await pushNotificationService.unsubscribe(currentUserId);
        } catch (e) {
          // Non-blocking — continue with logout even if push unsub fails
        }
      }

      // Reset push notification singleton state so next user can re-initialize
      resetPushInitialization();

      // Force-close all Supabase realtime channels to prevent stale subscriptions
      try {
        await supabase.removeAllChannels();
      } catch (e) {
        // Non-blocking
      }

      // Clear React Query in-memory cache and any pending queries
      try {
        const qc = queryClient;
        // cancel active queries
        await qc.cancelQueries();
        // remove cached queries
        qc.removeQueries();
        // some versions expose clear()
        try { (qc as any).clear && (qc as any).clear(); } catch (e) {}
      } catch (e) {
        // ignore query client errors
      }

      // Clear all caches BEFORE signing out
      clearCache(); // Social cache
      clearDashboardCache(); // Dashboard stats cache

          // Clear offline IndexedDB stores
          try {
            //console.log('[useAuth] Clearing offline storage on signOut...');
            await offlineStorage.clearAll();
            //console.log('[useAuth] offlineStorage.clearAll completed (signOut)');
          } catch (e) {
            //console.warn('[useAuth] offlineStorage.clearAll failed (signOut)', e);
          }

      // Clear any localStorage/sessionStorage data
      localStorage.clear();
      sessionStorage.clear();

      // Clear any service worker caches
      if ('caches' in window) {
        try {
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map(name => caches.delete(name)));
        } catch (e) {
          // Non-blocking
        }
      }

      // Sign out from Supabase
      await supabase.auth.signOut();

      ////console.log('✅ Sign out completed successfully');
    } catch (error) {
      ////console.error('❌ Error during sign out:', error);
      // Still try to clear caches even if signout fails
      clearCache();
      clearDashboardCache();
      resetPushInitialization();
      localStorage.clear();
      sessionStorage.clear();
      try { await supabase.removeAllChannels(); } catch (e) {}
    }
  };

  const value = {
    user,
    session,
    loading,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};