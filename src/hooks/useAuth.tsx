
import { useState, useEffect, useRef, createContext, useContext, ReactNode } from 'react';
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

  // Refs to distinguish user-initiated sign-outs from spurious ones
  // (e.g. token refresh failures / 429 rate limits).
  const isIntentionalSignOutRef = useRef(false);
  const lastSessionRef = useRef<Session | null>(null);
  const recoveryAttemptedRef = useRef(false);
  const isRecoveringRef = useRef(false);

  useEffect(() => {
    let resolved = false;
    const resolveAuth = (s: Session | null) => {
      if (resolved) return;
      resolved = true;
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    };

    // Safety timeout — if Supabase hangs (common on iOS Safari / service-worker
    // issues), force-resolve loading after 8 seconds so the UI is never stuck.
    const safetyTimeout = setTimeout(() => {
      if (!resolved) {
        console.warn('[useAuth] Auth loading safety timeout (8 s) — resolving with no session');
        resolveAuth(null);
      }
    }, 8000);

    // Helper to run sign-out cleanup (caches, push, offline stores).
    const performSignOutCleanup = () => {
      clearCache();
      resetPushInitialization();
      try { offlineStorage.clearAll(); } catch (_) { /* non-blocking */ }
    };

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Keep track of the last valid session so we can attempt recovery
        // if Supabase fires SIGNED_OUT due to a transient refresh failure.
        if (session) {
          lastSessionRef.current = session;
          recoveryAttemptedRef.current = false;
          isRecoveringRef.current = false;
        }

        resolveAuth(session);

        // Handle subsequent auth changes after the initial resolve.
        if (resolved) {
          if (event === 'SIGNED_OUT') {
            // ── User-initiated sign-out: apply immediately ──────────
            if (isIntentionalSignOutRef.current) {
              setSession(null);
              setUser(null);
              performSignOutCleanup();

            // ── Recovery already in progress: ignore duplicate events ─
            } else if (isRecoveringRef.current) {
              // Another SIGNED_OUT fired while we are recovering — ignore it.
              return;

            // ── Unexpected SIGNED_OUT (likely a rate-limited token refresh).
            //    Attempt to recover the session once before accepting. ──
            } else if (!recoveryAttemptedRef.current && lastSessionRef.current?.refresh_token) {
              recoveryAttemptedRef.current = true;
              isRecoveringRef.current = true;
              console.warn('[useAuth] Unexpected SIGNED_OUT — attempting session recovery…');

              const refreshToken = lastSessionRef.current.refresh_token;
              // Wait briefly so any 429 cooldown can expire, then retry.
              setTimeout(async () => {
                try {
                  const { data, error } = await supabase.auth.refreshSession(
                    { refresh_token: refreshToken }
                  );
                  if (data?.session) {
                    // Recovery succeeded — onAuthStateChange will fire
                    // TOKEN_REFRESHED with the new session automatically.
                    console.log('[useAuth] Session recovered after transient SIGNED_OUT');
                  } else {
                    console.warn('[useAuth] Session recovery failed:', error?.message);
                    setSession(null);
                    setUser(null);
                    performSignOutCleanup();
                  }
                } catch {
                  setSession(null);
                  setUser(null);
                  performSignOutCleanup();
                } finally {
                  isRecoveringRef.current = false;
                }
              }, 2000);

            // ── Recovery already failed or no session to recover: accept. ─
            } else {
              setSession(null);
              setUser(null);
              performSignOutCleanup();
            }
          } else {
            // Normal auth events (SIGNED_IN, TOKEN_REFRESHED, etc.)
            setSession(session);
            setUser(session?.user ?? null);
          }
        }

        // Touch profiles.updated_at on any authenticated session event so the
        // admin "active users" chart counts logins, page loads, and token
        // refreshes — not only profile edits.
        // Uses a SECURITY DEFINER RPC to bypass RLS and avoid infinite recursion.
        if (
          (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') &&
          session?.user?.id
        ) {
          supabase.rpc('touch_profile_active').then(({ error }) => {
            if (error) console.warn('[useAuth] Failed to touch profile active:', error.message);
          });
        }
      }
    );

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      resolveAuth(session);
    }).catch(() => {
      // If getSession throws (network error, etc.), resolve with no session
      resolveAuth(null);
    });

    return () => {
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      // Mark as intentional so the auth listener doesn't try session recovery.
      isIntentionalSignOutRef.current = true;

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
    } finally {
      // Reset the flag after a short delay so the auth listener can process
      // the SIGNED_OUT event before we reset the flag.
      setTimeout(() => { isIntentionalSignOutRef.current = false; }, 1000);
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