
import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../integrations/supabase/client';
import { clearCache } from '../utils/socialCache'; // Import the utility
import { clearDashboardCache } from '@/components/dashboard/hooks/useDashboardStats';
import { offlineStorage, STORES } from '../utils/offlineStorage';

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

      // Clear any service worker caches if you have them
      if ('caches' in window) {
        caches.keys().then(names => {
          names.forEach(name => {
            caches.delete(name);
          });
        });
      }

      // Sign out from Supabase
      await supabase.auth.signOut();

      ////console.log('✅ Sign out completed successfully');
    } catch (error) {
      ////console.error('❌ Error during sign out:', error);
      // Still try to clear caches even if signout fails
      clearCache();
      clearDashboardCache();
      localStorage.clear();
      sessionStorage.clear();
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