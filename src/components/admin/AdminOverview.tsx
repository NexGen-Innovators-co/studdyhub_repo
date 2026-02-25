import React, { useEffect, useState } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import {
  Users,
  FileText,
  MessageSquare,
  AlertTriangle,
  TrendingUp,
  Activity,
  Shield,
  Database,
  ArrowUp,
  ArrowDown,
  Clock,
  Calendar
} from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface DashboardStats {
  totalUsers: number;
  activeUsersToday: number;
  activeUsers7d: number;
  activeUsers30d: number;
  totalPosts: number;
  totalComments: number;
  totalGroups: number;
  totalNotes: number;
  totalDocuments: number;
  pendingReports: number;
  newUsersToday: number;
  userGrowth: number;
  engagementRate: number;
}

interface ChartData {
  userGrowth: Array<{ date: string; users: number; active: number }>;
  contentDistribution: Array<{ name: string; value: number }>;
  activityTrend: Array<{ day: string; posts: number; comments: number; notes: number }>;
}

const AdminOverview = ({ onNavigate }: { onNavigate?: (tab: string) => void }) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    fetchStats();
    fetchChartData();
  }, [timeRange]);

  const fetchStats = async () => {
    try {
      setLoading(true);

      const todayMidnight = new Date().toISOString().split('T')[0]; // UTC midnight today

      const [
        usersCount,
        usersCountYesterday,
        activeUsersToday,
        activeUsers7d,
        activeUsers30d,
        postsCount,
        commentsCount,
        groupsCount,
        notesCount,
        documentsCount,
        reportsCount,
        socialReportsCount,
        newUsersToday
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true })
          .lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
        supabase.from('profiles').select('*', { count: 'exact', head: true })
          .gte('updated_at', todayMidnight),
        supabase.from('profiles').select('*', { count: 'exact', head: true })
          .gte('updated_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
        supabase.from('profiles').select('*', { count: 'exact', head: true })
          .gte('updated_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
        supabase.from('social_posts').select('*', { count: 'exact', head: true }),
        supabase.from('social_comments').select('*', { count: 'exact', head: true }),
        supabase.from('social_groups').select('*', { count: 'exact', head: true }),
        supabase.from('notes').select('*', { count: 'exact', head: true }),
        supabase.from('documents').select('*', { count: 'exact', head: true }),
        supabase.from('content_moderation_queue').select('*', { count: 'exact', head: true })
          .eq('status', 'pending'),
        supabase.from('social_reports').select('*', { count: 'exact', head: true })
          .eq('status', 'pending'),
        supabase.from('profiles').select('*', { count: 'exact', head: true })
          .gte('created_at', todayMidnight)
      ]);

      const totalUsers = usersCount.count || 0;
      const totalUsersYesterday = usersCountYesterday.count || 0;
      const userGrowth = totalUsersYesterday > 0
        ? ((totalUsers - totalUsersYesterday) / totalUsersYesterday) * 100
        : 0;

      setStats({
        totalUsers,
        activeUsersToday: activeUsersToday.count || 0,
        activeUsers7d: activeUsers7d.count || 0,
        activeUsers30d: activeUsers30d.count || 0,
        totalPosts: postsCount.count || 0,
        totalComments: commentsCount.count || 0,
        totalGroups: groupsCount.count || 0,
        totalNotes: notesCount.count || 0,
        totalDocuments: documentsCount.count || 0,
        pendingReports: (reportsCount.count || 0) + (socialReportsCount.count || 0),
        newUsersToday: newUsersToday.count || 0,
        userGrowth,
        engagementRate: totalUsers > 0 ? ((activeUsers7d.count || 0) / totalUsers) * 100 : 0,
      });
    } catch (error) {

    } finally {
      setLoading(false);
    }
  };

  const fetchChartData = async () => {
    try {
      const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const startISO = startDate.toISOString();

      // Batch fetch: all users with created_at in range for growth chart
      const [usersInRange, activeUsersInRange, postsInRange, commentsInRange, notesInRange,
        totalPostsCount, totalCommentsCount, totalNotesCount, totalDocsCount, totalGroupsCount, totalPodcastsCount, totalChatSessionsCount
      ] = await Promise.all([
        supabase.from('profiles').select('created_at').gte('created_at', startISO).order('created_at'),
        supabase.from('profiles').select('id, updated_at').gte('updated_at', startISO).order('updated_at'),
        supabase.from('social_posts').select('created_at')
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
        supabase.from('social_comments').select('created_at')
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
        supabase.from('notes').select('created_at')
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
        // Content distribution counts (fetched independently so they don't depend on stats state)
        supabase.from('social_posts').select('*', { count: 'exact', head: true }),
        supabase.from('social_comments').select('*', { count: 'exact', head: true }),
        supabase.from('notes').select('*', { count: 'exact', head: true }),
        supabase.from('documents').select('*', { count: 'exact', head: true }),
        supabase.from('social_groups').select('*', { count: 'exact', head: true }),
        supabase.from('ai_podcasts').select('*', { count: 'exact', head: true }),
        supabase.from('chat_sessions').select('*', { count: 'exact', head: true }),
      ]);

      // Also get total users before the range for cumulative count
      const { count: usersBeforeRange } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .lt('created_at', startISO);

      // Build user growth data by grouping on client side
      const usersByDate: Record<string, number> = {};
      (usersInRange.data || []).forEach((u: any) => {
        const dateStr = u.created_at?.split('T')[0];
        if (dateStr) usersByDate[dateStr] = (usersByDate[dateStr] || 0) + 1;
      });

      const activeByDate: Record<string, Set<string>> = {};
      (activeUsersInRange.data || []).forEach((u: any) => {
        const dateStr = u.updated_at?.split('T')[0];
        if (dateStr) {
          if (!activeByDate[dateStr]) activeByDate[dateStr] = new Set();
          activeByDate[dateStr].add(u.id); // deduplicate by user id
        }
      });

      let cumulativeUsers = usersBeforeRange || 0;
      const userGrowthData = [];
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        const dateStr = date.toISOString().split('T')[0];
        cumulativeUsers += (usersByDate[dateStr] || 0);
        userGrowthData.push({
          date: dateStr,
          users: cumulativeUsers,
          active: activeByDate[dateStr]?.size || 0
        });
      }

      // Content distribution from direct counts (not dependent on stats state)
      const contentDistribution = [
        { name: 'Posts', value: totalPostsCount.count || 0 },
        { name: 'Comments', value: totalCommentsCount.count || 0 },
        { name: 'Notes', value: totalNotesCount.count || 0 },
        { name: 'Documents', value: totalDocsCount.count || 0 },
        { name: 'Groups', value: totalGroupsCount.count || 0 },
        { name: 'Podcasts', value: totalPodcastsCount.count || 0 },
        { name: 'AI Chats', value: totalChatSessionsCount.count || 0 },
      ].filter(item => item.value > 0);

      // Activity trend (last 7 days) - group fetched data by day
      const postsByDay: Record<string, number> = {};
      const commentsByDay: Record<string, number> = {};
      const notesByDay: Record<string, number> = {};

      (postsInRange.data || []).forEach((p: any) => {
        const dateStr = p.created_at?.split('T')[0];
        if (dateStr) postsByDay[dateStr] = (postsByDay[dateStr] || 0) + 1;
      });
      (commentsInRange.data || []).forEach((c: any) => {
        const dateStr = c.created_at?.split('T')[0];
        if (dateStr) commentsByDay[dateStr] = (commentsByDay[dateStr] || 0) + 1;
      });
      (notesInRange.data || []).forEach((n: any) => {
        const dateStr = n.created_at?.split('T')[0];
        if (dateStr) notesByDay[dateStr] = (notesByDay[dateStr] || 0) + 1;
      });

      const activityTrend = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        const dateStr = date.toISOString().split('T')[0];
        activityTrend.push({
          day: date.toLocaleDateString('en-US', { weekday: 'short' }),
          posts: postsByDay[dateStr] || 0,
          comments: commentsByDay[dateStr] || 0,
          notes: notesByDay[dateStr] || 0
        });
      }

      setChartData({
        userGrowth: userGrowthData,
        contentDistribution,
        activityTrend
      });
    } catch (error) {

    }
  };

  const COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

  const statCards = [
    {
      title: 'Total Users',
      value: stats?.totalUsers || 0,
      icon: Users,
      color: 'text-blue-500 dark:text-blue-400',
      bgColor: 'bg-blue-500/10 dark:bg-blue-500/20',
      borderColor: 'border-blue-500/20 dark:border-blue-500/30',
      subtitle: `${stats?.newUsersToday || 0} new today`,
      trend: stats?.userGrowth || 0,
      trendLabel: 'vs yesterday'
    },
    {
      title: 'Active Users Today',
      value: stats?.activeUsersToday || 0,
      icon: Activity,
      color: 'text-green-500 dark:text-green-400',
      bgColor: 'bg-green-500/10 dark:bg-green-500/20',
      borderColor: 'border-green-500/20 dark:border-green-500/30',
      subtitle: `${stats?.activeUsers7d || 0} this week · ${stats?.activeUsers30d || 0} this month`,
      trend: stats?.engagementRate || 0,
      trendLabel: 'engagement rate'
    },
    {
      title: 'Total Posts',
      value: stats?.totalPosts || 0,
      icon: MessageSquare,
      color: 'text-blue-500 dark:text-blue-400',
      bgColor: 'bg-blue-500/10 dark:bg-blue-500/20',
      borderColor: 'border-blue-500/20 dark:border-blue-500/30',
      subtitle: `${stats?.totalComments || 0} comments`,
      trend: 0,
      trendLabel: 'total interactions'
    },
    {
      title: 'Study Groups',
      value: stats?.totalGroups || 0,
      icon: Shield,
      color: 'text-orange-500 dark:text-orange-400',
      bgColor: 'bg-orange-500/10 dark:bg-orange-500/20',
      borderColor: 'border-orange-500/20 dark:border-orange-500/30',
      subtitle: 'Active communities',
      trend: 0,
      trendLabel: ''
    },
    {
      title: 'Notes Created',
      value: stats?.totalNotes || 0,
      icon: FileText,
      color: 'text-cyan-500 dark:text-cyan-400',
      bgColor: 'bg-cyan-500/10 dark:bg-cyan-500/20',
      borderColor: 'border-cyan-500/20 dark:border-cyan-500/30',
      subtitle: 'User notes',
      trend: 0,
      trendLabel: ''
    },
    {
      title: 'Documents',
      value: stats?.totalDocuments || 0,
      icon: Database,
      color: 'text-indigo-500 dark:text-indigo-400',
      bgColor: 'bg-indigo-500/10 dark:bg-indigo-500/20',
      borderColor: 'border-indigo-500/20 dark:border-indigo-500/30',
      subtitle: 'Uploaded files',
      trend: 0,
      trendLabel: ''
    },
    {
      title: 'Pending Reports',
      value: stats?.pendingReports || 0,
      icon: AlertTriangle,
      color: 'text-red-500 dark:text-red-400',
      bgColor: 'bg-red-500/10 dark:bg-red-500/20',
      borderColor: 'border-red-500/20 dark:border-red-500/30',
      subtitle: 'Needs review',
      trend: 0,
      trendLabel: 'urgent'
    },
    {
      title: 'Engagement Rate',
      value: stats ? Math.round(stats.engagementRate) : 0,
      icon: TrendingUp,
      color: 'text-yellow-500 dark:text-yellow-400',
      bgColor: 'bg-yellow-500/10 dark:bg-yellow-500/20',
      borderColor: 'border-yellow-500/20 dark:border-yellow-500/30',
      subtitle: '7-day activity',
      suffix: '%',
      trend: 0,
      trendLabel: ''
    },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-64 bg-gray-200 dark:bg-gray-800 mb-2" />
          <Skeleton className="h-4 w-96 bg-gray-200 dark:bg-gray-800" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <Card key={i} className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
              <CardHeader>
                <Skeleton className="h-4 w-24 bg-gray-200 dark:bg-gray-800" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 bg-gray-200 dark:bg-gray-800 mb-2" />
                <Skeleton className="h-3 w-20 bg-gray-200 dark:bg-gray-800" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Dashboard Overview</h2>
          <p className="text-gray-600 dark:text-gray-400">System statistics and metrics</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-1">
            {(['7d', '30d', '90d'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${timeRange === range
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
              >
                {range}
              </button>
            ))}
          </div>
          <button
            onClick={fetchStats}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card
              key={card.title}
              className={`bg-white dark:bg-gray-900 border ${card.borderColor} hover:shadow-lg dark:hover:shadow-gray-900/50 transition-all duration-200`}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {card.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${card.bgColor}`}>
                  <Icon className={`h-5 w-5 ${card.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  <div className="text-3xl font-bold text-gray-900 dark:text-white">
                    {card.value.toLocaleString()}{card.suffix || ''}
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-gray-500 dark:text-gray-500">{card.subtitle}</p>
                    {card.trend !== 0 && (
                      <div className={`flex items-center gap-1 text-xs font-medium ${card.trend > 0
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                        }`}>
                        {card.trend > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                        {Math.abs(card.trend).toFixed(1)}%
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Growth Chart */}
        <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-white">User Growth</CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400">
              Total and active users over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData?.userGrowth || []}>
                <defs>
                  <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-800" />
                <XAxis
                  dataKey="date"
                  className="text-xs text-gray-600 dark:text-gray-400"
                  tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                />
                <YAxis className="text-xs text-gray-600 dark:text-gray-400" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgb(31 41 55)',
                    border: '1px solid rgb(55 65 81)',
                    borderRadius: '0.5rem',
                    color: 'white'
                  }}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="users"
                  stroke="#3b82f6"
                  fillOpacity={1}
                  fill="url(#colorUsers)"
                  name="Total Users"
                />
                <Area
                  type="monotone"
                  dataKey="active"
                  stroke="#10b981"
                  fillOpacity={1}
                  fill="url(#colorActive)"
                  name="Active Users"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Content Distribution */}
        <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-white">Content Distribution</CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400">
              Breakdown of content types
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={chartData?.contentDistribution || []}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {(chartData?.contentDistribution || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgb(31 41 55)',
                    border: '1px solid rgb(55 65 81)',
                    borderRadius: '0.5rem',
                    color: 'white'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Activity Trend */}
      <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-white">Weekly Activity Trend</CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400">
            Daily posts, comments, and notes for the last 7 days
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={chartData?.activityTrend || []}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-800" />
              <XAxis dataKey="day" className="text-xs text-gray-600 dark:text-gray-400" />
              <YAxis className="text-xs text-gray-600 dark:text-gray-400" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgb(31 41 55)',
                  border: '1px solid rgb(55 65 81)',
                  borderRadius: '0.5rem',
                  color: 'white'
                }}
              />
              <Legend />
              <Bar dataKey="posts" fill="#3b82f6" name="Posts" radius={[4, 4, 0, 0]} />
              <Bar dataKey="comments" fill="#8b5cf6" name="Comments" radius={[4, 4, 0, 0]} />
              <Bar dataKey="notes" fill="#06b6d4" name="Notes" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-white">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button onClick={() => onNavigate?.('moderation')} className="p-6 bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 border border-red-200 dark:border-red-800/50 hover:from-red-100 hover:to-red-200 dark:hover:from-red-900/30 dark:hover:to-red-800/30 rounded-xl text-left transition-all duration-200 group">
            <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400 mb-3 group-hover:scale-110 transition-transform" />
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Review Reports</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">{stats?.pendingReports || 0} pending reports</p>
          </button>
          <button onClick={() => onNavigate?.('users')} className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border border-blue-200 dark:border-blue-800/50 hover:from-blue-100 hover:to-blue-200 dark:hover:from-blue-900/30 dark:hover:to-blue-800/30 rounded-xl text-left transition-all duration-200 group">
            <Users className="h-8 w-8 text-blue-600 dark:text-blue-400 mb-3 group-hover:scale-110 transition-transform" />
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Manage Users</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">{stats?.totalUsers || 0} total users</p>
          </button>
          <button onClick={() => onNavigate?.('settings')} className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border border-blue-200 dark:border-blue-800/50 hover:from-blue-100 hover:to-blue-200 dark:hover:from-blue-900/30 dark:hover:to-blue-800/30 rounded-xl text-left transition-all duration-200 group">
            <Shield className="h-8 w-8 text-blue-600 dark:text-blue-400 mb-3 group-hover:scale-110 transition-transform" />
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">System Settings</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Configure platform</p>
          </button>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminOverview;