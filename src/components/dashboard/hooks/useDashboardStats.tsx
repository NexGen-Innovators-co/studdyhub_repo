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
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const statsCache: Record<string, { data: DashboardStats; timestamp: number }> = {};

// Prevent simultaneous fetches across dashboard and app context
const activeFetchesRef: { current: Set<string> } = { current: new Set() };

// Optimized: Batch queries and use database functions for complex calculations
export const useDashboardStats = (userId: string | undefined) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true); // Initialize as true to show loading on mount
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
      const notesCount = await supabase
        .from('notes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', getStartOfDay(weekStart).toISOString())
        .lte('created_at', getEndOfDay(weekEnd).toISOString());

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
      const totalPhases = 5;
      let currentPhase = 0;

      // Phase 1: Basic counts (fast)
      updateProgress(++currentPhase, totalPhases);
      const basicCounts = await Promise.all([
        supabase.from('notes').select('*', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('class_recordings').select('*', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('documents').select('*', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('chat_messages').select('*', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('schedule_items').select('*', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('notes').select('*', { count: 'exact', head: true }).eq('user_id', userId).not('ai_summary', 'is', null),
      ]);

      // Phase 2: Time-based aggregations (medium)
      updateProgress(++currentPhase, totalPhases);
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const [studyTimeData, documentStats, activityData7Days, activityData30Days] = await Promise.all([
        // Study time with aggregation
        supabase.from('class_recordings')
          .select('duration, created_at')
          .eq('user_id', userId)
          .limit(500), // Reasonable limit

        // Document stats
        supabase.from('documents')
          .select('processing_status, file_size, created_at')
          .eq('user_id', userId)
          .limit(500),

        // Activity data
        fetchActivityDataOptimized(7, userId),
        fetchActivityDataOptimized(30, userId),
      ]);

      // Phase 3: Charts and visual data (can be lazy loaded)
      updateProgress(++currentPhase, totalPhases);
      const [hourlyActivity, weekdayActivity, learningVelocity] = await Promise.all([
        fetchHourlyActivityOptimized(userId),
        fetchActivityDataFallback(7, userId), // Reuse for weekday
        fetchLearningVelocityOptimized(userId),
      ]);

      // Phase 4: Additional data (lower priority)
      updateProgress(++currentPhase, totalPhases);
      const [recentNotesData, recentRecordingsData, recentDocumentsData, categoryDistribution] = await Promise.all([
        supabase.from('notes').select('id, title, category, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(4),
        supabase.from('class_recordings').select('id, title, duration, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(3),
        supabase.from('documents').select('id, title, type, created_at, processing_status').eq('user_id', userId).order('created_at', { ascending: false }).limit(3),
        supabase.from('notes').select('category').eq('user_id', userId).limit(100), // Increased limit for better distribution
      ]);

      // Phase 5: Calculations and final processing
      updateProgress(++currentPhase, totalPhases);

      // Process all the data (your existing processing logic)
      const [
        notesCount, recordingsCount, documentsCount, messagesCount, scheduleCount, notesWithAICount
      ] = basicCounts;

      // Complete data processing section - paste this in Phase 5

      // Process basic counts
      const totalNotes = notesCount.count || 0;
      const totalRecordings = recordingsCount.count || 0;
      const totalDocuments = documentsCount.count || 0;
      const totalMessages = messagesCount.count || 0;
      const totalScheduleItems = scheduleCount.count || 0;
      const notesWithAI = notesWithAICount.count || 0;

      // Process study time data
      const totalStudyTime = (studyTimeData.data || []).reduce((sum, rec) => sum + (rec.duration || 0), 0);
      const studyTimeThisWeek = (studyTimeData.data || []).filter((rec: any) =>
        new Date(rec.created_at) >= weekAgo
      ).reduce((sum, rec) => sum + (rec.duration || 0), 0);
      const studyTimeThisMonth = (studyTimeData.data || []).filter((rec: any) =>
        new Date(rec.created_at) >= monthAgo
      ).reduce((sum, rec) => sum + (rec.duration || 0), 0);

      // Process document stats
      const documentsProcessed = (documentStats.data || []).filter((d: any) => d.processing_status === 'completed').length;
      const documentsPending = (documentStats.data || []).filter((d: any) =>
        d.processing_status === 'pending' || d.processing_status === 'processing'
      ).length;
      const documentsFailed = (documentStats.data || []).filter((d: any) => d.processing_status === 'failed').length;
      const totalDocumentSize = (documentStats.data || []).reduce((sum: number, doc: any) => sum + (doc.file_size || 0), 0);

      // Calculate time-based counts from activity data
      const notesThisWeek = activityData7Days.reduce((sum, day) => sum + day.notes, 0);
      const notesThisMonth = activityData30Days.reduce((sum, day) => sum + day.notes, 0);
      const recordingsThisWeek = activityData7Days.reduce((sum, day) => sum + day.recordings, 0);
      const recordingsThisMonth = activityData30Days.reduce((sum, day) => sum + day.recordings, 0);

      // Process category data (only using category field)
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

      // Calculate streak - we need to fetch notes with created_at separately
      const { data: streak } = await supabase.rpc('get_user_streak', { p_user_id: userId });
      const currentStreak = streak?.[0]?.current_streak || 0;
      const maxStreak = streak?.[0]?.max_streak || 0;


      // Calculate schedule tasks
      const today = new Date();
      const todayDateStr = today.toISOString().split('T')[0];

      // Use existing schedule data from basic counts
      const scheduleItemsData = await supabase
        .from('schedule_items')
        .select('start_time, end_time')
        .eq('user_id', userId)
        .gte('start_time', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Last 30 days
        .limit(100);

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

      // Quiz data (fetch if needed)
      let totalQuizzesTaken = 0;
      let avgQuizScore = 0;

      try {
        const quizData = await supabase
          .from('quiz_attempts')
          .select('score, total_questions')
          .eq('user_id', userId)
          .limit(50); // Reasonable limit

        totalQuizzesTaken = quizData.data?.length || 0;
        if (quizData.data && quizData.data.length > 0) {
          avgQuizScore = quizData.data.reduce((sum: number, quiz: any) =>
            sum + (quiz.score / quiz.total_questions * 100), 0) / quizData.data.length;
        }
      } catch (error) {

      }

      // === FIXED ORDER: Calculate avgNotesPerDay FIRST ===
      const aiUsageRate = totalNotes > 0 ? (notesWithAI / totalNotes) * 100 : 0;

      // Estimate active days safely using total notes
      const estimatedActiveDays = totalNotes > 5
        ? Math.max(1, Math.round(totalNotes / 5))  // Conservative: assume ~5 notes/day average
        : 30;

      const daysActive = Math.max(1, Math.floor(totalStudyTime / 86400) || estimatedActiveDays);
      const avgDailyStudyTime = Math.round(totalStudyTime / daysActive); // in seconds per day
      const avgNotesPerDay = totalNotes > 0 ? Number((totalNotes / daysActive).toFixed(1)) : 0;
      // Calculate productivity metrics from real data
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

      // Engagement score calculation (updated with real metrics)
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


      // Add this helper
      const getWeekdayFromDate = (dateStr: string): string => {
        // dateStr is like "Dec 1"
        const currentYear = new Date().getFullYear();
        const date = new Date(`${dateStr} ${currentYear}`);
        // Fix year rollover
        if (date > new Date()) date.setFullYear(currentYear - 1);
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return days[date.getDay()];
      };

      // Then replace formattedWeekdayActivity with:
      const formattedWeekdayActivity = [
        { day: 'Sun', activity: 0 },
        { day: 'Mon', activity: 0 },
        { day: 'Tue', activity: 0 },
        { day: 'Wed', activity: 0 },
        { day: 'Thu', activity: 0 },
        { day: 'Fri', activity: 0 },
        { day: 'Sat', activity: 0 }
      ];

      activityData7Days.forEach((day: any) => {
        const weekday = getWeekdayFromDate(day.date);
        const item = formattedWeekdayActivity.find(d => d.day === weekday);
        if (item) item.activity += (day.total || 0);
      });

      // Assemble the final stats object
      const statsData: DashboardStats = {
        totalNotes,
        totalRecordings,
        totalDocuments,
        totalMessages,
        totalScheduleItems,
        totalStudyTime,
        currentStreak,
        maxStreak,
        todayTasks,
        upcomingTasks,
        completedTasks,
        overdueTasks,
        notesWithAI,
        aiUsageRate,
        notesThisWeek,
        notesThisMonth,
        recordingsThisWeek,
        recordingsThisMonth,
        studyTimeThisWeek,
        studyTimeThisMonth,
        avgDailyStudyTime,
        mostProductiveDay,
        mostProductiveHour,
        avgNotesPerDay,
        totalQuizzesTaken,
        avgQuizScore,
        documentsProcessed,
        documentsPending,
        documentsFailed,
        totalDocumentSize,
        categoryData,
        activityData7Days,
        activityData30Days,
        hourlyActivity,
        weekdayActivity: formattedWeekdayActivity,
        recentNotes: recentNotesData.data || [],
        recentRecordings: recentRecordingsData.data || [],
        recentDocuments: recentDocumentsData.data || [],
        topCategories,
        learningVelocity,
        engagementScore,
        lastFetched: Date.now()
      };

      statsCache[userId] = { data: statsData, timestamp: Date.now() };
      if (mountedRef.current) {
        setStats(statsData);
        setProgress(100);
      }

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

  useEffect(() => {
    if (userId && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      // Add a small delay to let AppContext data load first
      const timeoutId = setTimeout(() => {
        fetchDashboardStats(false);
      }, 300); // Reduced to 300ms for faster initial load
      
      return () => clearTimeout(timeoutId);
    }
  }, [userId, fetchDashboardStats]);

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