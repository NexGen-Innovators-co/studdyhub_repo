/**
 * Notification Analytics Dashboard
 * Admin view for monitoring daily engagement notification performance
 */

import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/components/card';
import { supabase } from '@/integrations/supabase/client';
import {
  getCategoryLabel,
  getCategoryEmoji,
  getEngagementTierLabel,
  getEngagementTierColor,
  calculateCTR,
  calculateConversionRate,
  formatNotificationDate
} from '@/services/notificationHelpers';
import {
  TrendingUp,
  TrendingDown,
  Mail,
  Mouse,
  Zap,
  Eye,
  Users
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/components/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/components/select';

interface NotificationMetrics {
  category: string;
  sent: number;
  opened: number;
  clicked: number;
  actions: number;
  openRate: number;
  clickRate: number;
  conversionRate: number;
}

interface CohortMetrics {
  tier: string;
  sent: number;
  opened: number;
  clicked: number;
  actions: number;
  users: number;
}

interface DailyMetrics {
  date: string;
  sent: number;
  opened: number;
  clicked: number;
  actions: number;
}

export const NotificationAnalytics: React.FC = () => {
  const [period, setPeriod] = useState('7d');
  const [categoryMetrics, setCategoryMetrics] = useState<NotificationMetrics[]>([]);
  const [cohortMetrics, setCohortMetrics] = useState<CohortMetrics[]>([]);
  const [dailyMetrics, setDailyMetrics] = useState<DailyMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalSent, setTotalSent] = useState(0);
  const [totalOpened, setTotalOpened] = useState(0);
  const [totalClicked, setTotalClicked] = useState(0);
  const [totalActions, setTotalActions] = useState(0);

  // Calculate KPIs
  const openRate = calculateCTR(totalOpened, totalSent);
  const clickRate = calculateCTR(totalClicked, totalSent);
  const conversionRate = calculateConversionRate(totalActions, totalClicked);

  useEffect(() => {
    fetchAnalyticsData();
  }, [period]);

  const getDaysFromPeriod = (periodValue: string): number => {
    const map: Record<string, number> = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
      'all': 365
    };
    return map[periodValue] || 7;
  };

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      const days = getDaysFromPeriod(period);
      const since = new Date();
      since.setDate(since.getDate() - days);

      // Fetch category-level metrics
      const { data: categoryData, error: categoryError } = await supabase
        .from('daily_notification_log')
        .select('category, opened_at, deep_link_clicked_at, action_taken_at')
        .gte('scheduled_send_at', since.toISOString());

      if (categoryError) throw categoryError;

      // Process category metrics
      const categoryMap = new Map<string, Partial<NotificationMetrics>>();
      let totalSentCount = 0;
      let totalOpenedCount = 0;
      let totalClickedCount = 0;
      let totalActionsCount = 0;

      categoryData?.forEach(log => {
        const category = log.category || 'general';
        if (!categoryMap.has(category)) {
          categoryMap.set(category, {
            category,
            sent: 0,
            opened: 0,
            clicked: 0,
            actions: 0
          });
        }

        const metrics = categoryMap.get(category)!;
        metrics.sent = (metrics.sent || 0) + 1;
        totalSentCount++;

        if (log.opened_at) {
          metrics.opened = (metrics.opened || 0) + 1;
          totalOpenedCount++;
        }
        if (log.deep_link_clicked_at) {
          metrics.clicked = (metrics.clicked || 0) + 1;
          totalClickedCount++;
        }
        if (log.action_taken_at) {
          metrics.actions = (metrics.actions || 0) + 1;
          totalActionsCount++;
        }
      });

      // Calculate rates for each category
      const processedCategories = Array.from(categoryMap.values()).map(m => ({
        category: m.category || 'general',
        sent: m.sent || 0,
        opened: m.opened || 0,
        clicked: m.clicked || 0,
        actions: m.actions || 0,
        openRate: calculateCTR(m.opened || 0, m.sent || 0),
        clickRate: calculateCTR(m.clicked || 0, m.sent || 0),
        conversionRate: calculateConversionRate(m.actions || 0, m.clicked || 0)
      })) as NotificationMetrics[];

      setCategoryMetrics(processedCategories);
      setTotalSent(totalSentCount);
      setTotalOpened(totalOpenedCount);
      setTotalClicked(totalClickedCount);
      setTotalActions(totalActionsCount);

      // Fetch cohort metrics - get notification logs with user IDs
      const { data: cohortData, error: cohortError } = await supabase
        .from('daily_notification_log')
        .select('user_id, opened_at, deep_link_clicked_at, action_taken_at')
        .gte('scheduled_send_at', since.toISOString());

      if (cohortError) throw cohortError;

      // Fetch engagement tiers for all users in the logs
      const userIds = Array.from(new Set((cohortData ?? []).map(log => log.user_id)));
      let engagementTierMap: Record<string, string> = {};

      if (userIds.length > 0) {
        const { data: activityData } = await supabase
          .from('user_activity_tracking')
          .select('user_id, engagement_tier')
          .in('user_id', userIds);

        activityData?.forEach(activity => {
          engagementTierMap[activity.user_id] = activity.engagement_tier || 'unknown';
        });
      }

      // Merge engagement tier data with notification logs
      const enrichedCohortData = (cohortData ?? []).map(log => ({
        ...log,
        engagement_tier: engagementTierMap[log.user_id] || 'unknown'
      }));

      // Process cohort metrics
      const cohortMap = new Map<string, Partial<CohortMetrics>>();
      const userSet = new Map<string, Set<string>>();

      enrichedCohortData.forEach(log => {
        const tier = log.engagement_tier || 'unknown';
        if (!cohortMap.has(tier)) {
          cohortMap.set(tier, {
            tier,
            sent: 0,
            opened: 0,
            clicked: 0,
            actions: 0,
            users: 0
          });
          userSet.set(tier, new Set());
        } else if (!userSet.has(tier)) {
          userSet.set(tier, new Set());
        }

        const metrics = cohortMap.get(tier)!;
        const users = userSet.get(tier)!;
        metrics.sent = (metrics.sent || 0) + 1;

        if (log.opened_at) {
          metrics.opened = (metrics.opened || 0) + 1;
        }
        if (log.deep_link_clicked_at) {
          metrics.clicked = (metrics.clicked || 0) + 1;
        }
        if (log.action_taken_at) {
          metrics.actions = (metrics.actions || 0) + 1;
        }

        // Track unique users
        if (log.user_id) {
          users.add(log.user_id);
        }
      });

      // Update user counts
      cohortMap.forEach((metrics, tier) => {
        metrics.users = userSet.get(tier)?.size || 0;
      });

      const processedCohorts = Array.from(cohortMap.values()).filter(
        c => c.tier && c.tier !== 'unknown'
      ) as CohortMetrics[];
      setCohortMetrics(processedCohorts);

      // Fetch daily time series
      const { data: timeSeriesData, error: timeSeriesError } = await supabase
        .from('daily_notification_log')
        .select('scheduled_send_at, opened_at, deep_link_clicked_at, action_taken_at')
        .gte('scheduled_send_at', since.toISOString())
        .order('scheduled_send_at', { ascending: true });

      if (timeSeriesError) throw timeSeriesError;

      // Process daily metrics
      const dailyMap = new Map<string, Partial<DailyMetrics>>();

      timeSeriesData?.forEach(log => {
        const date = formatNotificationDate(log.scheduled_send_at);
        if (!dailyMap.has(date)) {
          dailyMap.set(date, {
            date,
            sent: 0,
            opened: 0,
            clicked: 0,
            actions: 0
          });
        }

        const metrics = dailyMap.get(date)!;
        metrics.sent = (metrics.sent || 0) + 1;
        if (log.opened_at) metrics.opened = (metrics.opened || 0) + 1;
        if (log.deep_link_clicked_at) metrics.clicked = (metrics.clicked || 0) + 1;
        if (log.action_taken_at) metrics.actions = (metrics.actions || 0) + 1;
      });

      const processedDaily = Array.from(dailyMap.values()) as DailyMetrics[];
      setDailyMetrics(processedDaily);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const KPICard = ({ icon: Icon, label, value, trend, unit = '' }: any) => (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">{label}</p>
            <p className="text-2xl font-bold mt-2">{value}{unit}</p>
            {trend !== undefined && (
              <div className="flex items-center gap-1 mt-2">
                {trend >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-green-600" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-600" />
                )}
                <span className={trend >= 0 ? 'text-green-600' : 'text-red-600'} style={{ fontSize: '0.875rem' }}>
                  {Math.abs(trend)}% vs last period
                </span>
              </div>
            )}
          </div>
          <Icon className="h-8 w-8 text-blue-500" />
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <p className="text-gray-600 dark:text-gray-400">Loading notification analytics...</p>
        </CardContent>
      </Card>
    );
  }

  const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Notification Analytics</h2>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 Days</SelectItem>
            <SelectItem value="30d">Last 30 Days</SelectItem>
            <SelectItem value="90d">Last 90 Days</SelectItem>
            <SelectItem value="all">All Time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard icon={Mail} label="Total Sent" value={totalSent} />
        <KPICard icon={Eye} label="Open Rate" value={openRate} unit="%" />
        <KPICard icon={Mouse} label="Click Rate" value={clickRate} unit="%" />
        <KPICard icon={Zap} label="Conversion Rate" value={conversionRate} unit="%" />
      </div>

      {/* Tabs for different views */}
      <Tabs defaultValue="categories" className="space-y-4">
        <TabsList>
          <TabsTrigger value="categories">By Category</TabsTrigger>
          <TabsTrigger value="cohorts">By User Tier</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        {/* Category Performance */}
        <TabsContent value="categories" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {categoryMetrics.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={categoryMetrics}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="category"
                          tickFormatter={(value) => getCategoryLabel(value)}
                        />
                        <YAxis />
                        <Tooltip
                          labelFormatter={(value) => getCategoryLabel(value as string)}
                        />
                        <Legend />
                        <Bar dataKey="sent" fill="#3b82f6" name="Sent" />
                        <Bar dataKey="opened" fill="#10b981" name="Opened" />
                        <Bar dataKey="clicked" fill="#f59e0b" name="Clicked" />
                        <Bar dataKey="actions" fill="#8b5cf6" name="Actions" />
                      </BarChart>
                    </ResponsiveContainer>

                    {/* Category Metrics Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 px-4">Category</th>
                            <th className="text-right py-2 px-4">Sent</th>
                            <th className="text-right py-2 px-4">Open Rate</th>
                            <th className="text-right py-2 px-4">Click Rate</th>
                            <th className="text-right py-2 px-4">Conversion</th>
                          </tr>
                        </thead>
                        <tbody>
                          {categoryMetrics.map((metric) => (
                            <tr key={metric.category} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                              <td className="py-2 px-4">
                                <span className="mr-2">{getCategoryEmoji(metric.category)}</span>
                                {getCategoryLabel(metric.category)}
                              </td>
                              <td className="text-right py-2 px-4">{metric.sent}</td>
                              <td className="text-right py-2 px-4">{metric.openRate}%</td>
                              <td className="text-right py-2 px-4">{metric.clickRate}%</td>
                              <td className="text-right py-2 px-4">{metric.conversionRate}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <p className="text-center text-gray-600 dark:text-gray-400">No data available</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cohort Performance */}
        <TabsContent value="cohorts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance by User Engagement Tier</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {cohortMetrics.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={cohortMetrics}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="tier"
                          tickFormatter={(value) => getEngagementTierLabel(value)}
                        />
                        <YAxis />
                        <Tooltip
                          labelFormatter={(value) => getEngagementTierLabel(value as string)}
                        />
                        <Legend />
                        <Bar dataKey="users" fill="#3b82f6" name="Users" />
                        <Bar dataKey="opened" fill="#10b981" name="Opened" />
                        <Bar dataKey="clicked" fill="#f59e0b" name="Clicked" />
                        <Bar dataKey="actions" fill="#8b5cf6" name="Actions" />
                      </BarChart>
                    </ResponsiveContainer>

                    {/* Cohort Metrics Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 px-4">Tier</th>
                            <th className="text-right py-2 px-4">Users</th>
                            <th className="text-right py-2 px-4">Sent</th>
                            <th className="text-right py-2 px-4">Opened</th>
                            <th className="text-right py-2 px-4">Avg Actions/User</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cohortMetrics.map((metric) => (
                            <tr key={metric.tier} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                              <td className="py-2 px-4">
                                <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getEngagementTierColor(metric.tier)}`}>
                                  {getEngagementTierLabel(metric.tier)}
                                </span>
                              </td>
                              <td className="text-right py-2 px-4">{metric.users}</td>
                              <td className="text-right py-2 px-4">{metric.sent}</td>
                              <td className="text-right py-2 px-4">{metric.opened}</td>
                              <td className="text-right py-2 px-4">
                                {metric.users > 0 ? (metric.actions / metric.users).toFixed(1) : 0}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <p className="text-center text-gray-600 dark:text-gray-400">No data available</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Timeline */}
        <TabsContent value="timeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Notification Activity Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              {dailyMetrics.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={dailyMetrics}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="sent"
                      stroke="#3b82f6"
                      name="Sent"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="opened"
                      stroke="#10b981"
                      name="Opened"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="clicked"
                      stroke="#f59e0b"
                      name="Clicked"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="actions"
                      stroke="#8b5cf6"
                      name="Actions"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-gray-600 dark:text-gray-400">No data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default NotificationAnalytics;
