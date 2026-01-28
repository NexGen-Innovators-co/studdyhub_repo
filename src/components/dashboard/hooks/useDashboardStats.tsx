// hooks/useDashboardStats.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../../integrations/supabase/client';

export interface DashboardStats {
  totalNotes: number;
  totalRecordings: number;
  totalDocuments: number;
  totalMessages: number;
  totalScheduleItems: number;
  totalStudyTime: number;
  currentStreak: number;
  maxStreak: number;
  todayTasks: number;
  upcomingTasks: number;
  completedTasks: number;
  overdueTasks: number;
  notesWithAI: number;
  aiUsageRate: number;
  notesThisWeek: number;
  notesThisMonth: number;
  recordingsThisWeek: number;
  recordingsThisMonth: number;
  studyTimeThisWeek: number;
  studyTimeThisMonth: number;
  avgDailyStudyTime: number;
  mostProductiveDay: string;
  mostProductiveHour: number;
  avgNotesPerDay: number;
  totalQuizzesTaken: number;
  avgQuizScore: number;
  documentsProcessed: number;
  documentsPending: number;
  documentsFailed: number;
  totalDocumentSize: number;
  categoryData: Array<{ name: string; value: number }>;
  activityData7Days: Array<{
    date: string;
    notes: number;
    recordings: number;
    documents: number;
    messages: number;
    total: number;
  }>;
  activityData30Days: Array<{
    date: string;
    notes: number;
    recordings: number;
    documents: number;
    messages?: number;  // ← add this
    total: number;
  }>;
  hourlyActivity: Array<{ hour: number; activity: number }>;
  weekdayActivity: Array<{ day: string; activity: number }>;
  recentNotes: Array<{ id: string; title: string; category: string; created_at: string }>;
  recentRecordings: Array<{ id: string; title: string; duration: number; created_at: string }>;
  recentDocuments: Array<{ id: string; title: string; type: string; created_at: string; processing_status: string }>;
  topCategories: Array<{ category: string; count: number }>;
  learningVelocity: Array<{ week: string; items: number }>;
  engagementScore: number;
  lastFetched: number;
}
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours (effectively manual refresh only)
const statsCache: Record<string, { data: DashboardStats; timestamp: number }> = {};

// Prevent simultaneous fetches across dashboard and app context
const activeFetchesRef: { current: Set<string> } = { current: new Set() };

// Optimized: Batch queries and use database functions for complex calculations
export const useDashboardStats = (userId: string | undefined) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(false); // Manual refresh: don't auto-load on mount
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const isFetchingRef = useRef(false);
  const mountedRef = useRef(true);
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Load persisted cache from localStorage if available to prevent refetch on mount
  useEffect(() => {
    if (!userId) return;
    try {
      const raw = localStorage.getItem(`dashboard_stats_${userId}`);
      if (raw) {
        const parsed = JSON.parse(raw) as DashboardStats & { lastFetched?: number };
        if (parsed) {
          statsCache[userId] = { data: parsed as DashboardStats, timestamp: parsed.lastFetched || Date.now() };
          setStats(parsed as DashboardStats);
          setLoading(false);
        }
      }
    } catch (e) {
      // ignore
    }
  }, [userId]);

  // Optimized: Use database-side aggregation for activity data
  const fetchActivityDataOptimized = async (days: number, userId: string) => {
    try {
      // Use a database function for better performance
      const { data, error } = await supabase.rpc('get_user_activity_stats', {
        p_user_id: userId,
        p_days: days
      });

      if (error) throw error;

      // Fallback to client-side processing if RPC not available
      if (!data) {
        return await fetchActivityDataFallback(days, userId);
      }

      return data;
    } catch (error) {

      return await fetchActivityDataFallback(days, userId);
    }
  };

  // Helper to perform count queries with minimal payload and a single retry on transient errors
  const safeCount = async (table: string, filterBuilder?: (qb: any) => any) => {
    try {
      let qb: any = supabase.from(table).select('id', { count: 'exact', head: true });
      if (filterBuilder) qb = filterBuilder(qb) || qb;
      const res = await qb;
      return res;
    } catch (err) {
      //console.warn(`[useDashboardStats] safeCount first attempt failed for ${table}`, err);
      // Retry once after short delay
      try {
        await new Promise(r => setTimeout(r, 300));
        let qb2: any = supabase.from(table).select('id', { count: 'exact', head: true });
        if (filterBuilder) qb2 = filterBuilder(qb2) || qb2;
        const res2 = await qb2;
        return res2;
      } catch (err2) {
        //console.error(`[useDashboardStats] safeCount retry failed for ${table}`, err2);
        throw err2;
      }
    }
  };

  const fetchActivityDataFallback = async (days: number, userId: string) => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days + 1);
    const start = getStartOfDay(startDate);
    const end = getEndOfDay(new Date());

    // Single query per table with date range
    const [notesData, recordingsData, documentsData, messagesData] = await Promise.all([
      supabase
        .from('notes')
        .select('created_at')
        .eq('user_id', userId)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString()),

      supabase
        .from('class_recordings')
        .select('created_at')
        .eq('user_id', userId)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString()),

      supabase.from('documents').select('id', { count: 'exact', head: true }),
      supabase
        .from('chat_messages')
        .select('timestamp')
        .eq('user_id', userId)
        .gte('timestamp', start.toISOString())
        .lte('timestamp', end.toISOString()),
    ]);

    // Process data in memory - much faster than individual queries
    const activityMap = new Map();

    // Initialize all dates
    for (let i = 0; i < days; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      const dateKey = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      activityMap.set(dateKey, { notes: 0, recordings: 0, documents: 0, messages: 0, total: 0 });
    }

    // Count activities by date
    const countActivities = (data: any[], type: string) => {
      data.forEach(item => {
        // ✅ FIX: Check for both 'created_at' AND 'timestamp'
        const dateStr = item.created_at || item.timestamp;
        if (!dateStr) return;

        const date = new Date(dateStr);
        const dateKey = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        if (activityMap.has(dateKey)) {
          const current = activityMap.get(dateKey);
          current[type] += 1;
          current.total += 1;
        }
      });
    };

    countActivities(notesData.data || [], 'notes');
    countActivities(recordingsData.data || [], 'recordings');
    countActivities(documentsData.data || [], 'documents');
    countActivities(messagesData.data || [], 'messages');

    return Array.from(activityMap.entries()).map(([date, counts]) => ({
      date,
      ...counts
    }));
  };

  // Optimized: Fetch only necessary fields and use limits
  const fetchHourlyActivityOptimized = async (userId: string) => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    // Single query with optimized fields
    const { data, error } = await supabase
      .from('notes')
      .select('created_at')
      .eq('user_id', userId)
      .gte('created_at', weekAgo.toISOString())
      .limit(1000); // Reasonable limit for hourly analysis

    if (error) throw error;

    const hourlyData = Array.from({ length: 24 }, (_, hour) => ({ hour, activity: 0 }));

    (data || []).forEach(note => {
      const hour = new Date(note.created_at).getHours();
      hourlyData[hour].activity += 1;
    });

    return hourlyData;
  };

  // Optimized: Use materialized views or cached data for expensive operations
  const fetchLearningVelocityOptimized = async (userId: string) => {
    try {
      // Try to use RPC for complex time-based aggregations
      const { data, error } = await supabase.rpc('get_learning_velocity', {
        p_user_id: userId,
        p_weeks: 12
      });

      if (!error && data) {
        return data;
      }

      // Fallback: Sample-based approach for large datasets
      return await fetchLearningVelocitySampled(userId);
    } catch (error) {
      return await fetchLearningVelocitySampled(userId);
    }
  };

  // Sample-based approach for large datasets
  const fetchLearningVelocitySampled = async (userId: string) => {
    const velocityData = [];
    const now = new Date();

    // Sample 4 weeks instead of 12 for performance
    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - (i * 7));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      // Use count queries instead of fetching data
      const notesCount = await safeCount('notes', (q: any) =>
        q.eq('user_id', userId)
          .gte('created_at', getStartOfDay(weekStart).toISOString())
          .lte('created_at', getEndOfDay(weekEnd).toISOString())
      );

      velocityData.push({
        week: `W${4 - i}`,
        items: notesCount.count || 0
      });
    }

    return velocityData;
  };

  // Progress tracking helper
  const updateProgress = useCallback((current: number, total: number) => {
    if (mountedRef.current) {
      setProgress(Math.round((current / total) * 100));
    }
  }, []);

  // Phased loading with progress updates
  const fetchDashboardStats = useCallback(async (forceRefresh = false) => {
    if (!userId) return;

    // Check if already fetching
    if (activeFetchesRef.current.has(userId)) {

      return;
    }

    const cached = statsCache[userId];
    const now = Date.now();

    if (!forceRefresh && cached && (now - cached.timestamp) < CACHE_DURATION) {
      setStats(cached.data);
      setLoading(false);
      return;
    }

    if (isFetchingRef.current) return;

    isFetchingRef.current = true;
    activeFetchesRef.current.add(userId);
    setLoading(true);
    setError(null);
    setProgress(0);

    try {
      // Phase 1: Basic counts (fast) - keep this as the initial blocking work
      updateProgress(1, 5);
      const basicCounts = await Promise.all([
        safeCount('notes', (q: any) => q.eq('user_id', userId)),
        safeCount('class_recordings', (q: any) => q.eq('user_id', userId)),
        safeCount('documents', (q: any) => q.eq('user_id', userId)),
        safeCount('chat_messages', (q: any) => q.eq('user_id', userId)),
        safeCount('schedule_items', (q: any) => q.eq('user_id', userId)),
        safeCount('notes', (q: any) => q.eq('user_id', userId).not('ai_summary', 'is', null)),
        safeCount('quizzes', (q: any) => q.eq('user_id', userId)),
      ]);

      // Phase 1b: Lightweight recent items (small limits) - fetch sequentially
      // with timeouts and fallbacks to avoid overloading the DB and hitting
      // statement timeouts.
      const fetchWithTimeout = async (queryOrPromise: any, timeoutMs = 4000) => {
        try {
          const promise: Promise<any> = (queryOrPromise && typeof queryOrPromise.then === 'function')
            ? (queryOrPromise as Promise<any>)
            : Promise.resolve(queryOrPromise);

          const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs));
          const res = await Promise.race([promise, timeout]);
          return res;
        } catch (err) {
          //console.warn('[useDashboardStats] fetchWithTimeout error', err);
          return { data: [], error: err };
        }
      };

      const recentNotesData = await fetchWithTimeout(
        supabase.from('notes').select('id, title, category, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(3)
      );

      // Small delay to give the DB a breather before the next query
      await new Promise(r => setTimeout(r, 100));

      const recentRecordingsData = await fetchWithTimeout(
        supabase.from('class_recordings').select('id, title, duration, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(2)
      );

      await new Promise(r => setTimeout(r, 100));

      const recentDocumentsData = await fetchWithTimeout(
        supabase.from('documents').select('id, title, type, created_at, processing_status').eq('user_id', userId).order('created_at', { ascending: false }).limit(2)
      );

      // Minimal initial stats to render quickly
      const [
        notesCount, recordingsCount, documentsCount, messagesCount, scheduleCount, notesWithAICount, quizzesCount
      ] = basicCounts;

      const totalNotes = notesCount.count || 0;
      const totalRecordings = recordingsCount.count || 0;
      const totalDocuments = documentsCount.count || 0;
      const totalMessages = messagesCount.count || 0;
      const totalScheduleItems = scheduleCount.count || 0;
      const notesWithAI = notesWithAICount.count || 0;
      const totalQuizzesTaken = quizzesCount.count || 0;

      const minimalStats: DashboardStats = {
        totalNotes,
        totalRecordings,
        totalDocuments,
        totalMessages,
        totalScheduleItems,
        totalStudyTime: 0,
        currentStreak: 0,
        maxStreak: 0,
        todayTasks: 0,
        upcomingTasks: 0,
        completedTasks: 0,
        overdueTasks: 0,
        notesWithAI,
        aiUsageRate: 0,
        notesThisWeek: 0,
        notesThisMonth: 0,
        recordingsThisWeek: 0,
        recordingsThisMonth: 0,
        studyTimeThisWeek: 0,
        studyTimeThisMonth: 0,
        avgDailyStudyTime: 0,
        mostProductiveDay: 'Mon',
        mostProductiveHour: 14,
        avgNotesPerDay: 0,
        totalQuizzesTaken,
        avgQuizScore: 0,
        documentsProcessed: 0,
        documentsPending: 0,
        documentsFailed: 0,
        totalDocumentSize: 0,
        categoryData: [],
        activityData7Days: [],
        activityData30Days: [],
        hourlyActivity: [],
        weekdayActivity: [],
        recentNotes: recentNotesData.data || [],
        recentRecordings: recentRecordingsData.data || [],
        recentDocuments: recentDocumentsData.data || [],
        topCategories: [],
        learningVelocity: [],
        engagementScore: 0,
        lastFetched: Date.now()
      };

      // Set minimal stats so dashboard can render quickly
      statsCache[userId] = { data: minimalStats, timestamp: Date.now() };
      try { localStorage.setItem(`dashboard_stats_${userId}`, JSON.stringify({ ...minimalStats, lastFetched: Date.now() })); } catch (e) {}
      if (mountedRef.current) {
        setStats(minimalStats);
        setProgress(20);
      }

      // Kick off background work for heavier aggregations without blocking UI.
      // Run heavier queries sequentially with small delays to reduce DB contention
      // and avoid statement timeouts on the Postgres side.
      (async () => {
        try {
          const now = new Date();
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

          let studyTimeData: any = { data: [] };
          try {
            studyTimeData = await fetchWithTimeout(supabase.from('class_recordings').select('duration, created_at').eq('user_id', userId).limit(500), 8000);
          } catch (e) {
            //console.warn('[useDashboardStats] studyTimeData fetch failed', e);
          }
          await new Promise(r => setTimeout(r, 200));

          let documentStats: any = { data: [] };
          try {
            documentStats = await fetchWithTimeout(supabase.from('documents').select('processing_status, file_size, created_at').eq('user_id', userId).limit(500), 8000);
          } catch (e) {
            //console.warn('[useDashboardStats] documentStats fetch failed', e);
          }
          await new Promise(r => setTimeout(r, 200));

          let activityData7Days: any = [];
          try {
            activityData7Days = await fetchActivityDataOptimized(7, userId);
          } catch (e) {
            //console.warn('[useDashboardStats] activityData7Days fetch failed', e);
            activityData7Days = await fetchActivityDataFallback(7, userId);
          }
          await new Promise(r => setTimeout(r, 200));

          let activityData30Days: any = [];
          try {
            activityData30Days = await fetchActivityDataOptimized(30, userId);
          } catch (e) {
            //console.warn('[useDashboardStats] activityData30Days fetch failed', e);
            activityData30Days = await fetchActivityDataFallback(30, userId);
          }

          // Phase 3: Charts and visual data (lazy)
          let hourlyActivity: any = [];
          try {
            hourlyActivity = await fetchHourlyActivityOptimized(userId);
          } catch (e) {
            //console.warn('[useDashboardStats] hourlyActivity fetch failed', e);
            hourlyActivity = [];
          }
          await new Promise(r => setTimeout(r, 200));

          let weekdayActivity: any = [];
          try {
            weekdayActivity = await fetchActivityDataFallback(7, userId);
          } catch (e) {
            //console.warn('[useDashboardStats] weekdayActivity fetch failed', e);
            weekdayActivity = [];
          }
          await new Promise(r => setTimeout(r, 200));

          let learningVelocity: any = [];
          try {
            learningVelocity = await fetchLearningVelocityOptimized(userId);
          } catch (e) {
            //console.warn('[useDashboardStats] learningVelocity fetch failed', e);
            learningVelocity = [];
          }
          await new Promise(r => setTimeout(r, 200));

          // Phase 4: Additional data (lower priority)
          let categoryDistribution: any = { data: [] };
          try {
            categoryDistribution = await fetchWithTimeout(supabase.from('notes').select('category').eq('user_id', userId).limit(50), 5000);
          } catch (e) {
            //console.warn('[useDashboardStats] categoryDistribution fetch failed', e);
            categoryDistribution = { data: [] };
          }

          // Streak RPC
          const { data: streak } = await supabase.rpc('get_user_streak', { p_user_id: userId });
          const currentStreak = streak?.[0]?.current_streak || 0;
          const maxStreak = streak?.[0]?.max_streak || 0;

          // Schedule items
          const scheduleItemsData = await supabase
            .from('schedule_items')
            .select('start_time, end_time')
            .eq('user_id', userId)
            .gte('start_time', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
            .limit(100);

          const today = new Date();
          const todayDateStr = today.toISOString().split('T')[0];

          const todayTasks = (scheduleItemsData.data || []).filter((item: any) => {
            const itemDate = new Date(item.start_time).toISOString().split('T')[0];
            return itemDate === todayDateStr;
          }).length;

          const upcomingTasks = (scheduleItemsData.data || []).filter((item: any) => {
            const itemDate = new Date(item.start_time);
            return itemDate > today;
          }).length;

          const completedTasks = (scheduleItemsData.data || []).filter((item: any) => {
            const itemDate = new Date(item.end_time);
            return itemDate < today;
          }).length;

          const overdueTasks = (scheduleItemsData.data || []).filter((item: any) => {
            const itemDate = new Date(item.start_time);
            return itemDate < today && itemDate.toISOString().split('T')[0] !== todayDateStr;
          }).length;

          // Process study time and documents
          const totalStudyTime = (studyTimeData.data || []).reduce((sum, rec) => sum + (rec.duration || 0), 0);
          const studyTimeThisWeek = (studyTimeData.data || []).filter((rec: any) =>
            new Date(rec.created_at) >= weekAgo
          ).reduce((sum, rec) => sum + (rec.duration || 0), 0);
          const studyTimeThisMonth = (studyTimeData.data || []).filter((rec: any) =>
            new Date(rec.created_at) >= monthAgo
          ).reduce((sum, rec) => sum + (rec.duration || 0), 0);

          const documentsProcessed = (documentStats.data || []).filter((d: any) => d.processing_status === 'completed').length;
          const documentsPending = (documentStats.data || []).filter((d: any) =>
            d.processing_status === 'pending' || d.processing_status === 'processing'
          ).length;
          const documentsFailed = (documentStats.data || []).filter((d: any) => d.processing_status === 'failed').length;
          const totalDocumentSize = (documentStats.data || []).reduce((sum: number, doc: any) => sum + (doc.file_size || 0), 0);

          // Process category data
          const categoryCounts: Record<string, number> = {};
          (categoryDistribution.data || []).forEach((note: any) => {
            const category = note.category || 'general';
            categoryCounts[category] = (categoryCounts[category] || 0) + 1;
          });

          const categoryData = Object.entries(categoryCounts).map(([name, value]) => ({
            name: name.charAt(0).toUpperCase() + name.slice(1),
            value
          }));

          const topCategories = Object.entries(categoryCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([category, count]) => ({ category, count }));

          // Recalculate engagement and other derived metrics
          const notesThisWeek = activityData7Days.reduce((sum, day) => sum + day.notes, 0);
          const notesThisMonth = activityData30Days.reduce((sum, day) => sum + day.notes, 0);
          const recordingsThisWeek = activityData7Days.reduce((sum, day) => sum + day.recordings, 0);
          const recordingsThisMonth = activityData30Days.reduce((sum, day) => sum + day.recordings, 0);

          // Calculate avgNotesPerDay and avgDailyStudyTime
          const estimatedActiveDays = totalNotes > 5
            ? Math.max(1, Math.round(totalNotes / 5))
            : 30;
          const daysActive = Math.max(1, Math.floor(totalStudyTime / 86400) || estimatedActiveDays);
          const avgDailyStudyTime = Math.round(totalStudyTime / daysActive);
          const avgNotesPerDay = totalNotes > 0 ? Number((totalNotes / daysActive).toFixed(1)) : 0;

          const calculateProductivity = (weekdayData: any[], hourlyData: any[]) => {
            if (weekdayData.length === 0 || hourlyData.length === 0) {
              return { mostProductiveDay: 'Mon', mostProductiveHour: 14 };
            }

            const mostProductiveDayIndex = weekdayData.reduce((maxIndex, day, index) =>
              day.activity > weekdayData[maxIndex].activity ? index : maxIndex, 0
            );

            const mostProductiveHour = hourlyData.reduce((maxIndex, hour, index) =>
              hour.activity > hourlyData[maxIndex].activity ? index : maxIndex, 0
            );

            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

            return {
              mostProductiveDay: days[mostProductiveDayIndex],
              mostProductiveHour
            };
          };

          const { mostProductiveDay, mostProductiveHour } = calculateProductivity(weekdayActivity, hourlyActivity);

          const aiUsageRate = totalNotes > 0 ? (notesWithAI / totalNotes) * 100 : 0;

          const engagementFactors = {
            streak: Math.min(currentStreak / 30, 1) * 20,
            notesPerDay: Math.min(avgNotesPerDay / 5, 1) * 20,
            aiUsage: (aiUsageRate / 100) * 15,
            studyTime: Math.min(avgDailyStudyTime / 3600, 1) * 20,
            variety: Math.min((totalNotes + totalRecordings + totalDocuments + totalMessages) / 100, 1) * 15,
            consistency: Math.min(notesThisWeek / 7, 1) * 10
          };

          const engagementScore = Math.round(
            Object.values(engagementFactors).reduce((sum, val) => sum + val, 0)
          );

          // Merge results into stats and cache
          const merged: DashboardStats = {
            ...minimalStats,
            totalStudyTime,
            studyTimeThisWeek,
            studyTimeThisMonth,
            documentsProcessed,
            documentsPending,
            documentsFailed,
            totalDocumentSize,
            categoryData,
            activityData7Days,
            activityData30Days,
            hourlyActivity,
            weekdayActivity: weekdayActivity.map((d: any) => ({ day: d.date, activity: d.total })) ,
            topCategories,
            learningVelocity,
            currentStreak,
            maxStreak,
            todayTasks,
            upcomingTasks,
            completedTasks,
            overdueTasks,
            notesThisWeek,
            notesThisMonth,
            recordingsThisWeek,
            recordingsThisMonth,
            avgDailyStudyTime,
            mostProductiveDay,
            mostProductiveHour,
            avgNotesPerDay,
            engagementScore,
            lastFetched: Date.now()
          };

          statsCache[userId] = { data: merged, timestamp: Date.now() };
          try { localStorage.setItem(`dashboard_stats_${userId}`, JSON.stringify({ ...merged, lastFetched: Date.now() })); } catch (e) {}
          if (mountedRef.current) {
            setStats(merged);
            setProgress(100);
          }
        } catch (bgErr) {
          //console.warn('[useDashboardStats] background data fetch failed', bgErr);
        }
      })();

    } catch (err: any) {
      if (mountedRef.current) {
        setError(err.message || 'Failed to load dashboard statistics');
        setProgress(0);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
      isFetchingRef.current = false;
      activeFetchesRef.current.delete(userId!);
    }
  }, [userId, updateProgress]);

  // Realtime: subscribe to changes in dashboard-relevant tables and refresh
  // stats with a short debounce to avoid frequent heavy refreshes.
  useEffect(() => {
    if (!userId) return;

    let debounceTimer: any = null;
    const refreshDebounced = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        fetchDashboardStats(true);
      }, 800);
    };

    const applyRealtimeChange = (table: string, payload: any) => {
      try {
        // Normalize payload
        const event = payload.eventType || payload.type || payload.event || payload?.commit_timestamp ? payload.eventType : null;
        const newRec = payload.new || payload.record || payload?.new || null;
        const oldRec = payload.old || payload?.old || null;

        if (!statsCache[userId]) {
          // no cached data to mutate — fall back to debounced refresh
          refreshDebounced();
          return;
        }

        const cached = { ...statsCache[userId].data } as DashboardStats;

        const safeInc = (k: keyof DashboardStats, delta = 1) => {
          // @ts-ignore
          cached[k] = Math.max(0, (cached[k] as any || 0) + delta);
        };

        const limitRecent = (arr: any[], item: any, limit = 3) => {
          try {
            const next = [item, ...(arr || [])].filter(Boolean).slice(0, limit);
            return next;
          } catch (e) { return arr || []; }
        };

        switch (table) {
          case 'notes':
            if (event === 'INSERT') {
              safeInc('totalNotes', 1);
              cached.recentNotes = limitRecent(cached.recentNotes, { id: newRec?.id, title: newRec?.title, category: newRec?.category, created_at: newRec?.created_at });
            } else if (event === 'DELETE') {
              safeInc('totalNotes', -1);
              cached.recentNotes = (cached.recentNotes || []).filter(r => r.id !== oldRec?.id).slice(0,3);
            }
            break;
          case 'class_recordings':
            if (event === 'INSERT') {
              safeInc('totalRecordings', 1);
              cached.recentRecordings = limitRecent(cached.recentRecordings, { id: newRec?.id, title: newRec?.title, duration: newRec?.duration, created_at: newRec?.created_at }, 2);
            } else if (event === 'DELETE') {
              safeInc('totalRecordings', -1);
              cached.recentRecordings = (cached.recentRecordings || []).filter(r => r.id !== oldRec?.id).slice(0,2);
            }
            break;
          case 'documents':
            if (event === 'INSERT') {
              safeInc('totalDocuments', 1);
              cached.recentDocuments = limitRecent(cached.recentDocuments, { id: newRec?.id, title: newRec?.title, type: newRec?.type, created_at: newRec?.created_at, processing_status: newRec?.processing_status }, 2);
            } else if (event === 'DELETE') {
              safeInc('totalDocuments', -1);
              cached.recentDocuments = (cached.recentDocuments || []).filter(r => r.id !== oldRec?.id).slice(0,2);
            }
            break;
          case 'chat_messages':
            if (event === 'INSERT') {
              safeInc('totalMessages', 1);
            } else if (event === 'DELETE') {
              safeInc('totalMessages', -1);
            }
            break;
          case 'schedule_items':
            if (event === 'INSERT') {
              safeInc('totalScheduleItems', 1);
            } else if (event === 'DELETE') {
              safeInc('totalScheduleItems', -1);
            }
            break;
          default:
            // unknown table -> fallback
            refreshDebounced();
            return;
        }

        // persist and publish
        statsCache[userId] = { data: cached, timestamp: Date.now() };
        try { localStorage.setItem(`dashboard_stats_${userId}`, JSON.stringify({ ...cached, lastFetched: Date.now() })); } catch (e) {}
        if (mountedRef.current) setStats(cached);
      } catch (e) {
        // on error, fallback to debounced full refresh
        refreshDebounced();
      }
    };

    try {
      const channel = supabase.channel(`dashboard_changes_${userId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notes', filter: `user_id=eq.${userId}` }, (payload) => applyRealtimeChange('notes', payload))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'class_recordings', filter: `user_id=eq.${userId}` }, (payload) => applyRealtimeChange('class_recordings', payload))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'documents', filter: `user_id=eq.${userId}` }, (payload) => applyRealtimeChange('documents', payload))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages', filter: `user_id=eq.${userId}` }, (payload) => applyRealtimeChange('chat_messages', payload))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'schedule_items', filter: `user_id=eq.${userId}` }, (payload) => applyRealtimeChange('schedule_items', payload))
        .subscribe();

      return () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        try { supabase.removeChannel(channel); } catch (e) {}
      };
    } catch (e) {
      // If realtime subscription fails, silently ignore — still works without realtime.
      return () => { if (debounceTimer) clearTimeout(debounceTimer); };
    }
  }, [userId, fetchDashboardStats]);

  // Lazy loading for non-critical data
  const loadAdditionalData = useCallback(async (type: 'charts' | 'recent' | 'analytics') => {
    if (!userId || !stats) return;

    try {
      switch (type) {
        case 'charts':
          // Load additional chart data on demand
          const [detailedHourly, detailedWeekly] = await Promise.all([
            fetchHourlyActivityOptimized(userId),
            fetchActivityDataOptimized(30, userId),
          ]);
          // Update stats with new data
          setStats(prev => prev ? {
            ...prev,
            hourlyActivity: detailedHourly,
            activityData30Days: detailedWeekly
          } : null);
          break;
        // Add other cases as needed
      }
    } catch (error) {

    }
  }, [userId, stats]);

  // NOTE: Removed automatic timed fetch on mount. Dashboard stats will load
  // only when `refresh()` is called. This prevents unexpected periodic
  // or delayed fetches and gives callers explicit control over when to load.

  const refresh = useCallback(() => fetchDashboardStats(true), [fetchDashboardStats]);
  const clearCache = useCallback(() => { if (userId) delete statsCache[userId]; }, [userId]);

  return {
    stats,
    loading,
    error,
    progress,
    refresh,
    clearCache,
    loadAdditionalData,
    isCached: !!(userId && statsCache[userId])
  };
};
// In useDashboardStats.tsx - add this export function
export const clearDashboardCache = (userId?: string) => {
  if (userId) {
    delete statsCache[userId];
  } else {
    // Clear all cached stats
    Object.keys(statsCache).forEach(key => {
      delete statsCache[key];
    });
  }

};
// Helper functions
const getStartOfDay = (date: Date) => new Date(date.setHours(0, 0, 0, 0));
const getEndOfDay = (date: Date) => new Date(date.setHours(23, 59, 59, 999));