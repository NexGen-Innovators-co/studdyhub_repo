
import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../integrations/supabase/client';
import { clearCache } from '../utils/socialCache'; // Import the utility
import { clearDashboardCache } from '@/components/dashboard/hooks/useDashboardStats';

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

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Clear cache when user signs out
        if (event === 'SIGNED_OUT') {
          console.log('🔴 Auth state: SIGNED_OUT - clearing cache');
          clearCache();
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
      console.log('🔴 Starting sign out process...');

      // Clear all caches BEFORE signing out
      clearCache(); // Social cache
      clearDashboardCache(); // Dashboard stats cache

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

      console.log('✅ Sign out completed successfully');
    } catch (error) {
      console.error('❌ Error during sign out:', error);
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