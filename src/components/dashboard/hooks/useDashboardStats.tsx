// hooks/useDashboardStats.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../../integrations/supabase/client';

export interface DashboardStats {
  totalNotes: number;
  totalRecordings: number;
  totalDocuments: number;
  totalMessages: number;
  totalScheduleItems: number;
  totalStudyTime: number; // in seconds
  currentStreak: number;
  maxStreak: number;
  todayTasks: number;
  upcomingTasks: number;
  completedTasks: number;
  overdueTasks: number;
  notesWithAI: number;
  aiUsageRate: number;
  
  // Time-based stats
  notesThisWeek: number;
  notesThisMonth: number;
  recordingsThisWeek: number;
  recordingsThisMonth: number;
  studyTimeThisWeek: number;
  studyTimeThisMonth: number;
  avgDailyStudyTime: number;
  
  // Productivity metrics
  mostProductiveDay: string;
  mostProductiveHour: number;
  avgNotesPerDay: number;
  totalQuizzesTaken: number;
  avgQuizScore: number;
  
  // Document stats
  documentsProcessed: number;
  documentsPending: number;
  documentsFailed: number;
  totalDocumentSize: number; // in bytes
  
  // Category distribution
  categoryData: Array<{ name: string; value: number }>;
  
  // Activity data (last 7 days and 30 days)
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
    total: number;
  }>;
  
  // Hourly activity pattern
  hourlyActivity: Array<{
    hour: number;
    activity: number;
  }>;
  
  // Day of week activity
  weekdayActivity: Array<{
    day: string;
    activity: number;
  }>;
  
  // Recent items (just IDs and minimal data for display)
  recentNotes: Array<{ id: string; title: string; category: string; createdAt: string }>;
  recentRecordings: Array<{ id: string; title: string; duration: number; createdAt: string }>;
  recentDocuments: Array<{ id: string; title: string; type: string; createdAt: string; processing_status: string }>;
  
  // Top categories by usage
  topCategories: Array<{ category: string; count: number }>;
  
  // Learning velocity (items created per week over time)
  learningVelocity: Array<{
    week: string;
    items: number;
  }>;
  
  // Engagement score (0-100)
  engagementScore: number;
  
  // Cache metadata
  lastFetched: number;
}

// Cache duration in milliseconds (5 minutes)
const CACHE_DURATION = 5 * 60 * 1000;

// In-memory cache
const statsCache: Record<string, { data: DashboardStats; timestamp: number }> = {};

export const useDashboardStats = (userId: string | undefined) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isFetchingRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchDashboardStats = useCallback(async (forceRefresh = false) => {
    if (!userId) return;

    // Check cache first
    const cached = statsCache[userId];
    const now = Date.now();
    
    if (!forceRefresh && cached && (now - cached.timestamp) < CACHE_DURATION) {
      console.log('[Dashboard] Using cached stats');
      setStats(cached.data);
      setLoading(false);
      return;
    }

    // Prevent multiple simultaneous fetches
    if (isFetchingRef.current) {
      console.log('[Dashboard] Fetch already in progress, skipping');
      return;
    }

    isFetchingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      // Fetch all stats in parallel for better performance
      const [
        notesCount,
        recordingsCount,
        documentsCount,
        messagesCount,
        scheduleCount,
        studyTimeResult,
        notesWithAICount,
        categoryDistribution,
        allNotesData,
        allRecordingsData,
        allDocumentsData,
        allMessagesData,
        recentNotesData,
        recentRecordingsData,
        recentDocumentsData,
        streakData,
        scheduleData,
        quizzesData,
        notesThisWeekData,
        notesThisMonthData,
        recordingsThisWeekData,
        recordingsThisMonthData,
        studyTimeThisWeekData,
        studyTimeThisMonthData,
        documentStats
      ] = await Promise.all([
        // 1. Total counts
        supabase
          .from('notes')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId),
        
        supabase
          .from('class_recordings')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId),
        
        supabase
          .from('documents')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId),
        
        supabase
          .from('chat_messages')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId),
        
        supabase
          .from('schedule_items')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId),
        
        // 2. Study time (sum of recording durations)
        supabase
          .from('class_recordings')
          .select('duration')
          .eq('user_id', userId),
        
        // 3. Notes with AI summaries
        supabase
          .from('notes')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .not('ai_summary', 'is', null)
          .neq('ai_summary', ''),
        
        // 4. Category distribution
        supabase
          .from('notes')
          .select('category')
          .eq('user_id', userId),
        
        // 5. All notes for analysis (last 90 days)
        supabase
          .from('notes')
          .select('created_at, updated_at')
          .eq('user_id', userId)
          .gte('created_at', new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()),
        
        // 6. All recordings for analysis (last 90 days)
        supabase
          .from('class_recordings')
          .select('created_at, duration')
          .eq('user_id', userId)
          .gte('created_at', new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()),
        
        // 7. All documents for analysis (last 90 days)
        supabase
          .from('documents')
          .select('created_at')
          .eq('user_id', userId)
          .gte('created_at', new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()),
        
        // 8. All messages for analysis (last 90 days)
        supabase
          .from('chat_messages')
          .select('timestamp')
          .eq('user_id', userId)
          .gte('timestamp', new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()),
        
        // 9. Recent notes (just 8 for display)
        supabase
          .from('notes')
          .select('id, title, category, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(8),
        
        // 10. Recent recordings (just 5 for display)
        supabase
          .from('class_recordings')
          .select('id, title, duration, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(5),
        
        // 11. Recent documents (just 5 for display)
        supabase
          .from('documents')
          .select('id, title, type, created_at, processing_status')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(5),
        
        // 12. Streak calculation - get all note creation dates
        supabase
          .from('notes')
          .select('created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false }),
        
        // 13. Schedule items for today and upcoming
        supabase
          .from('schedule_items')
          .select('start_time, end_time')
          .eq('user_id', userId),
        
        // 14. Quizzes data
        supabase
          .from('quizzes')
          .select('id, created_at')
          .eq('user_id', userId),
        
        // 15. Notes this week
        supabase
          .from('notes')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .gte('created_at', weekAgo.toISOString()),
        
        // 16. Notes this month
        supabase
          .from('notes')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .gte('created_at', monthAgo.toISOString()),
        
        // 17. Recordings this week
        supabase
          .from('class_recordings')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .gte('created_at', weekAgo.toISOString()),
        
        // 18. Recordings this month
        supabase
          .from('class_recordings')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .gte('created_at', monthAgo.toISOString()),
        
        // 19. Study time this week
        supabase
          .from('class_recordings')
          .select('duration')
          .eq('user_id', userId)
          .gte('created_at', weekAgo.toISOString()),
        
        // 20. Study time this month
        supabase
          .from('class_recordings')
          .select('duration')
          .eq('user_id', userId)
          .gte('created_at', monthAgo.toISOString()),
        
        // 21. Document processing stats
        supabase
          .from('documents')
          .select('processing_status, file_size')
          .eq('user_id', userId)
      ]);

      // Process results (keeping existing logic)
      const totalNotes = notesCount.count || 0;
      const totalRecordings = recordingsCount.count || 0;
      const totalDocuments = documentsCount.count || 0;
      const totalMessages = messagesCount.count || 0;
      const totalScheduleItems = scheduleCount.count || 0;

      const totalStudyTime = (studyTimeResult.data || []).reduce(
        (sum, rec) => sum + (rec.duration || 0),
        0
      );

      const notesThisWeek = notesThisWeekData.count || 0;
      const notesThisMonth = notesThisMonthData.count || 0;
      const recordingsThisWeek = recordingsThisWeekData.count || 0;
      const recordingsThisMonth = recordingsThisMonthData.count || 0;
      
      const studyTimeThisWeek = (studyTimeThisWeekData.data || []).reduce(
        (sum, rec) => sum + (rec.duration || 0),
        0
      );
      
      const studyTimeThisMonth = (studyTimeThisMonthData.data || []).reduce(
        (sum, rec) => sum + (rec.duration || 0),
        0
      );

      const daysActive = Math.max(1, Math.floor(totalStudyTime / 86400) || 30);
      const avgDailyStudyTime = totalStudyTime / daysActive;

      const notesWithAI = notesWithAICount.count || 0;
      const aiUsageRate = totalNotes > 0 ? (notesWithAI / totalNotes) * 100 : 0;

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

      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - i));
        return date.toISOString().split('T')[0];
      });

      const activityData7Days = last7Days.map(date => {
        const dayNotes = (allNotesData.data || []).filter(
          (n: any) => new Date(n.created_at).toISOString().split('T')[0] === date
        ).length;
        
        const dayRecordings = (allRecordingsData.data || []).filter(
          (r: any) => new Date(r.created_at).toISOString().split('T')[0] === date
        ).length;
        
        const dayDocuments = (allDocumentsData.data || []).filter(
          (d: any) => new Date(d.created_at).toISOString().split('T')[0] === date
        ).length;
        
        const dayMessages = (allMessagesData.data || []).filter(
          (m: any) => new Date(m.timestamp).toISOString().split('T')[0] === date
        ).length;

        return {
          date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          notes: dayNotes,
          recordings: dayRecordings,
          documents: dayDocuments,
          messages: dayMessages,
          total: dayNotes + dayRecordings + dayDocuments + dayMessages
        };
      });

      const last30Days = Array.from({ length: 30 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (29 - i));
        return date.toISOString().split('T')[0];
      });

      const activityData30Days = last30Days.map(date => {
        const dayNotes = (allNotesData.data || []).filter(
          (n: any) => new Date(n.created_at).toISOString().split('T')[0] === date
        ).length;
        
        const dayRecordings = (allRecordingsData.data || []).filter(
          (r: any) => new Date(r.created_at).toISOString().split('T')[0] === date
        ).length;
        
        const dayDocuments = (allDocumentsData.data || []).filter(
          (d: any) => new Date(d.created_at).toISOString().split('T')[0] === date
        ).length;

        return {
          date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          notes: dayNotes,
          recordings: dayRecordings,
          documents: dayDocuments,
          total: dayNotes + dayRecordings + dayDocuments
        };
      });

      const hourlyActivityMap: Record<number, number> = {};
      [...(allNotesData.data || []), ...(allRecordingsData.data || []), ...(allMessagesData.data || [])].forEach((item: any) => {
        const hour = new Date(item.created_at || item.timestamp).getHours();
        hourlyActivityMap[hour] = (hourlyActivityMap[hour] || 0) + 1;
      });

      const hourlyActivity = Array.from({ length: 24 }, (_, hour) => ({
        hour,
        activity: hourlyActivityMap[hour] || 0
      }));

      const mostProductiveHour = Object.entries(hourlyActivityMap)
        .sort(([, a], [, b]) => b - a)[0]?.[0] || 0;

      const weekdayMap: Record<number, number> = {};
      [...(allNotesData.data || []), ...(allRecordingsData.data || [])].forEach((item: any) => {
        const day = new Date(item.created_at).getDay();
        weekdayMap[day] = (weekdayMap[day] || 0) + 1;
      });

      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const weekdayActivity = dayNames.map((day, index) => ({
        day,
        activity: weekdayMap[index] || 0
      }));

      const mostProductiveDayIndex = Object.entries(weekdayMap)
        .sort(([, a], [, b]) => b - a)[0]?.[0] ;
      const mostProductiveDay = dayNames[parseInt(mostProductiveDayIndex)];

      const totalDays = Math.max(1, Math.floor((now.getTime() - new Date((allNotesData.data || [])[0]?.created_at || now).getTime()) / (1000 * 60 * 60 * 24)) || 30);
      const avgNotesPerDay = totalNotes / totalDays;

      const learningVelocity = Array.from({ length: 12 }, (_, i) => {
        const weekStart = new Date(now.getTime() - (11 - i) * 7 * 24 * 60 * 60 * 1000);
        const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
        
        const itemsThisWeek = [
          ...(allNotesData.data || []),
          ...(allRecordingsData.data || []),
          ...(allDocumentsData.data || [])
        ].filter((item: any) => {
          const date = new Date(item.created_at);
          return date >= weekStart && date < weekEnd;
        }).length;

        return {
          week: `W${Math.floor(i / 4) + 1}`,
          items: itemsThisWeek
        };
      });

      const noteDates = (streakData.data || [])
        .map((n: any) => new Date(n.created_at).toDateString())
        .filter((date, index, self) => self.indexOf(date) === index)
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

      let currentStreak = 0;
      let maxStreak = 0;
      let tempStreak = 0;
      let lastDate: Date | null = null;

      for (const dateStr of noteDates) {
        const date = new Date(dateStr);
        
        if (!lastDate) {
          tempStreak = 1;
          lastDate = date;
        } else {
          const dayDiff = Math.floor((lastDate.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
          
          if (dayDiff === 1) {
            tempStreak++;
          } else {
            maxStreak = Math.max(maxStreak, tempStreak);
            tempStreak = 1;
          }
          
          lastDate = date;
        }
      }
      
      maxStreak = Math.max(maxStreak, tempStreak);
      
      const todayStr = new Date().toDateString();
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString();
      currentStreak = (noteDates[0] === todayStr || noteDates[0] === yesterday) ? tempStreak : 0;

      const todayDateStr = today.toISOString().split('T')[0];
      const todayTasks = (scheduleData.data || []).filter((item: any) => {
        const itemDate = new Date(item.start_time).toISOString().split('T')[0];
        return itemDate === todayDateStr;
      }).length;
      
      const upcomingTasks = (scheduleData.data || []).filter((item: any) => {
        const itemDate = new Date(item.start_time);
        return itemDate > now;
      }).length;

      const completedTasks = (scheduleData.data || []).filter((item: any) => {
        const itemDate = new Date(item.end_time);
        return itemDate < now;
      }).length;

      const overdueTasks = (scheduleData.data || []).filter((item: any) => {
        const itemDate = new Date(item.start_time);
        return itemDate < now && itemDate.toISOString().split('T')[0] !== todayDateStr;
      }).length;

      const totalQuizzesTaken = quizzesData.count || 0;
      const avgQuizScore = 0;

      const documentsProcessed = (documentStats.data || []).filter(
        (d: any) => d.processing_status === 'completed'
      ).length;

      const documentsPending = (documentStats.data || []).filter(
        (d: any) => d.processing_status === 'pending' || d.processing_status === 'processing'
      ).length;

      const documentsFailed = (documentStats.data || []).filter(
        (d: any) => d.processing_status === 'failed'
      ).length;

      const totalDocumentSize = (documentStats.data || []).reduce(
        (sum: number, doc: any) => sum + (doc.file_size || 0),
        0
      );

      const recentNotes = (recentNotesData.data || []).map((note: any) => ({
        id: note.id,
        title: note.title || 'Untitled',
        category: note.category || 'general',
        createdAt: note.created_at
      }));

      const recentRecordings = (recentRecordingsData.data || []).map((rec: any) => ({
        id: rec.id,
        title: rec.title || 'Untitled',
        duration: rec.duration || 0,
        createdAt: rec.created_at
      }));

      const recentDocuments = (recentDocumentsData.data || []).map((doc: any) => ({
        id: doc.id,
        title: doc.title || 'Untitled',
        type: doc.type || 'unknown',
        createdAt: doc.created_at,
        processing_status: doc.processing_status || 'pending'
      }));

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
        mostProductiveHour: parseInt(mostProductiveHour.toString()),
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
        weekdayActivity,
        recentNotes,
        recentRecordings,
        recentDocuments,
        topCategories,
        learningVelocity,
        engagementScore,
        lastFetched: Date.now()
      };

      // Cache the results
      statsCache[userId] = {
        data: statsData,
        timestamp: Date.now()
      };

      if (mountedRef.current) {
        setStats(statsData);
      }

      console.log('[Dashboard] Stats fetched and cached');

    } catch (err: any) {
      console.error('Error fetching dashboard stats:', err);
      if (mountedRef.current) {
        setError(err.message || 'Failed to load dashboard statistics');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
      isFetchingRef.current = false;
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      fetchDashboardStats(false);
    }
  }, [userId, fetchDashboardStats]);

  const refresh = useCallback(() => {
    console.log('[Dashboard] Manual refresh triggered');
    fetchDashboardStats(true);
  }, [fetchDashboardStats]);

  const clearCache = useCallback(() => {
    if (userId) {
      delete statsCache[userId];
      console.log('[Dashboard] Cache cleared');
    }
  }, [userId]);

  return {
    stats,
    loading,
    error,
    refresh,
    clearCache,
    isCached: !!(userId && statsCache[userId])
  };
};

export interface DashboardStats {
  totalNotes: number;
  totalRecordings: number;
  totalDocuments: number;
  totalMessages: number;
  totalScheduleItems: number;
  totalStudyTime: number; // in seconds
  currentStreak: number;
  maxStreak: number;
  todayTasks: number;
  upcomingTasks: number;
  completedTasks: number;
  overdueTasks: number;
  notesWithAI: number;
  aiUsageRate: number;
  
  // Time-based stats
  notesThisWeek: number;
  notesThisMonth: number;
  recordingsThisWeek: number;
  recordingsThisMonth: number;
  studyTimeThisWeek: number;
  studyTimeThisMonth: number;
  avgDailyStudyTime: number;
  
  // Productivity metrics
  mostProductiveDay: string;
  mostProductiveHour: number;
  avgNotesPerDay: number;
  totalQuizzesTaken: number;
  avgQuizScore: number;
  
  // Document stats
  documentsProcessed: number;
  documentsPending: number;
  documentsFailed: number;
  totalDocumentSize: number; // in bytes
  
  // Category distribution
  categoryData: Array<{ name: string; value: number }>;
  
  // Activity data (last 7 days and 30 days)
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
    total: number;
  }>;
  
  // Hourly activity pattern
  hourlyActivity: Array<{
    hour: number;
    activity: number;
  }>;
  
  // Day of week activity
  weekdayActivity: Array<{
    day: string;
    activity: number;
  }>;
  
  // Recent items (just IDs and minimal data for display)
  recentNotes: Array<{ id: string; title: string; category: string; createdAt: string }>;
  recentRecordings: Array<{ id: string; title: string; duration: number; createdAt: string }>;
  recentDocuments: Array<{ id: string; title: string; type: string; createdAt: string; processing_status: string }>;
  
  // Top categories by usage
  topCategories: Array<{ category: string; count: number }>;
  
  // Learning velocity (items created per week over time)
  learningVelocity: Array<{
    week: string;
    items: number;
  }>;
  
  // Engagement score (0-100)
  engagementScore: number;
}
