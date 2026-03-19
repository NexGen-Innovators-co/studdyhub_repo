import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../integrations/supabase/client';

export type DailyActivity = {
  activity_date: string; // YYYY-MM-DD
  xp_earned: number;
  action_count: number;
};

export type DailyActivitySummary = {
  todayXp: number;
  todayActions: number;
  streakDays: number;
  lastActiveDate: string | null;
  loading: boolean;
  error: string | null;
};

const formatDateKey = (date: Date) => date.toISOString().slice(0, 10);

export const useDailyActivity = (userId?: string) => {
  const [state, setState] = useState<DailyActivitySummary>({
    todayXp: 0,
    todayActions: 0,
    streakDays: 0,
    lastActiveDate: null,
    loading: false,
    error: null,
  });

  const fetchActivity = useCallback(async () => {
    if (!userId) {
      setState(prev => ({ ...prev, loading: false }));
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const today = new Date();
      const startDate = new Date(today);
      startDate.setDate(startDate.getDate() - 30);

      const { data, error } = await supabase
        .from('user_daily_activity')
        .select('activity_date, xp_earned, action_count')
        .eq('user_id', userId)
        .gte('activity_date', startDate.toISOString().slice(0, 10))
        .order('activity_date', { ascending: false });

      if (error) throw error;

      const rows = (data || []) as DailyActivity[];
      const byDate = new Map<string, DailyActivity>();
      rows.forEach((row) => {
        const key = row.activity_date;
        if (!byDate.has(key)) {
          byDate.set(key, row);
        } else {
          const existing = byDate.get(key)!;
          byDate.set(key, {
            activity_date: key,
            xp_earned: existing.xp_earned + row.xp_earned,
            action_count: existing.action_count + row.action_count,
          });
        }
      });

      const todayKey = formatDateKey(today);
      const todayStats = byDate.get(todayKey);

      // streak calculation
      let streak = 0;
      let cursor = new Date(today);
      while (true) {
        const key = formatDateKey(cursor);
        if (byDate.has(key) && (byDate.get(key)?.action_count || 0) > 0) {
          streak += 1;
          cursor.setDate(cursor.getDate() - 1);
        } else {
          break;
        }
      }

      const lastActiveDate = rows.length > 0 ? rows[0].activity_date : null;

      setState({
        todayXp: todayStats?.xp_earned || 0,
        todayActions: todayStats?.action_count || 0,
        streakDays: streak,
        lastActiveDate,
        loading: false,
        error: null,
      });
    } catch (err: any) {
      setState(prev => ({ ...prev, loading: false, error: err.message || 'Failed to load activity' }));
    }
  }, [userId]);

  // Load and keep in sync with realtime updates
  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`user_daily_activity_${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_daily_activity', filter: `user_id=eq.${userId}` },
        () => {
          // Ensure the widget reflects actions logged elsewhere in the app
          fetchActivity();
        }
      )
      .subscribe();

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch {
        // ignore
      }
    };
  }, [userId, fetchActivity]);

  return state;
};
