import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    LineChart, Line, PieChart, Pie, Cell, AreaChart, Area, RadarChart, PolarGrid,
    PolarAngleAxis, PolarRadiusAxis, Radar, Legend
} from 'recharts';
import {
    BookOpen, FileText, Calendar, MessageCircle, Users, TrendingUp,
    Clock, Target, Award, Activity, Brain, Zap, BookMarked,
    PlusCircle, Eye, CheckCircle, AlertCircle, Star, Play,
    Download, Upload, Search, Filter, RefreshCw, Flame, Trophy,
    ChevronUp, ChevronDown, Minus, Sparkles, BarChart3, PieChart as PieChartIcon,
    TrendingDown, AlertTriangle, FileCheck, FileClock, FileX, HardDrive
} from 'lucide-react';
import { useDashboardStats } from './hooks/useDashboardStats';
import { Loader2 } from 'lucide-react';
import BookPagesAnimation from '../ui/bookloader';

interface DashboardProps {
    userProfile: any;
    onNavigateToTab: (tab: string) => void;
    onCreateNew: (type: 'note' | 'recording' | 'document' | 'schedule') => void;
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1', '#d084d0', '#a4de6c', '#ffa07a'];
const CHART_COLORS = {
    primary: '#3b82f6',
    secondary: '#10b981',
    accent: '#f59e0b',
    danger: '#ef4444',
    info: '#06b6d4',
    purple: '#8b5cf6',
    pink: '#ec4899',
    indigo: '#6366f1'
};

const Dashboard: React.FC<DashboardProps> = ({
    userProfile,
    onNavigateToTab,
    onCreateNew
}) => {
    const [timeFilter, setTimeFilter] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
    const [selectedMetric, setSelectedMetric] = useState<'activity' | 'productivity' | 'learning' | 'insights'>('activity');
    const [animatedCounts, setAnimatedCounts] = useState({
        notes: 0,
        recordings: 0,
        documents: 0,
        messages: 0
    });

    const { stats, loading, error, refresh } = useDashboardStats(userProfile?.id);

    // Animate counters when stats are loaded
    useEffect(() => {
        if (!stats) return;

        const targetCounts = {
            notes: stats.totalNotes,
            recordings: stats.totalRecordings,
            documents: stats.totalDocuments,
            messages: stats.totalMessages
        };

        const duration = 1000;
        const steps = 60;
        const stepDuration = duration / steps;

        let step = 0;
        const timer = setInterval(() => {
            step++;
            const progress = step / steps;
            const easeOut = 1 - Math.pow(1 - progress, 3);

            setAnimatedCounts({
                notes: Math.floor(targetCounts.notes * easeOut),
                recordings: Math.floor(targetCounts.recordings * easeOut),
                documents: Math.floor(targetCounts.documents * easeOut),
                messages: Math.floor(targetCounts.messages * easeOut)
            });

            if (step >= steps) {
                clearInterval(timer);
                setAnimatedCounts(targetCounts);
            }
        }, stepDuration);

        return () => clearInterval(timer);
    }, [stats]);

    const StatCard = ({ title, value, icon: Icon, trend, trendValue, color = 'blue', onClick, subtitle }: any) => (
        <Card
            className={`hover:shadow-lg transition-all duration-200 cursor-pointer border-l-4 group ${color === 'blue' ? 'border-l-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950' :
                    color === 'green' ? 'border-l-green-500 hover:bg-green-50 dark:hover:bg-green-950' :
                        color === 'yellow' ? 'border-l-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-950' :
                            color === 'purple' ? 'border-l-purple-500 hover:bg-purple-50 dark:hover:bg-purple-950' :
                                'border-l-gray-500 hover:bg-gray-50 dark:hover:bg-gray-950'
                }`}
            onClick={onClick}
        >
            <CardContent className="p-4 dark:bg-slate-800/80">
                <div className="flex items-center justify-between">
                    <div className="space-y-1 flex-1">
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
                        <p className="text-3xl font-bold group-hover:scale-105 transition-transform">{value}</p>
                        {subtitle && (
                            <p className="text-xs text-gray-500 dark:text-gray-500">{subtitle}</p>
                        )}
                        {trend && (
                            <div className={`flex items-center text-xs ${trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-600'}`}>
                                {trend === 'up' ? <ChevronUp className="h-3 w-3 mr-1" /> :
                                    trend === 'down' ? <ChevronDown className="h-3 w-3 mr-1" /> :
                                        <Minus className="h-3 w-3 mr-1" />}
                                {trendValue}
                            </div>
                        )}
                    </div>
                    <div className={`p-3 rounded-full group-hover:scale-110 transition-transform ${color === 'blue' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400' :
                            color === 'green' ? 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400' :
                                color === 'yellow' ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900 dark:text-yellow-400' :
                                    color === 'purple' ? 'bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-400' :
                                        'bg-gray-100 text-gray-600 dark:bg-gray-900 dark:text-gray-400'
                        }`}>
                        <Icon className="h-6 w-6" />
                    </div>
                </div>
            </CardContent>
        </Card>
    );

    const QuickAction = ({ title, description, icon: Icon, onClick, color = 'blue' }: any) => (
        <Card className="hover:shadow-md transition-all duration-200 cursor-pointer dark:bg-slate-800/80 hover:scale-105" onClick={onClick}>
            <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${color === 'blue' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400' :
                            color === 'green' ? 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400' :
                                color === 'yellow' ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900 dark:text-yellow-400' :
                                    color === 'purple' ? 'bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-400' :
                                        'bg-gray-100 text-gray-600 dark:bg-gray-900 dark:text-gray-400'
                        }`}>
                        <Icon className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="font-medium">{title}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{description}</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center">
                    <BookPagesAnimation size='lg' showText text='Loading dashboard data...' />
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center">
                    <AlertCircle className="h-8 w-8 mx-auto mb-4 text-red-600" />
                    <p className="text-red-600 mb-4">{error}</p>
                    <Button onClick={refresh} variant="outline">
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Retry
                    </Button>
                </div>
            </div>
        );
    }

    if (!stats) return null;

    // Format file size
    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    };

    // Get engagement color
    const getEngagementColor = (score: number) => {
        if (score >= 80) return 'text-green-600';
        if (score >= 60) return 'text-blue-600';
        if (score >= 40) return 'text-yellow-600';
        return 'text-red-600';
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header with Engagement Score */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex-1">
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                            Welcome back, {userProfile?.full_name || 'Student'}! 👋
                        </h1>
                        {stats.currentStreak >= 3 && (
                            <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300">
                                <Flame className="h-3 w-3 mr-1" />
                                {stats.currentStreak} day streak!
                            </Badge>
                        )}
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                        Your engagement score: <span className={`font-bold ${getEngagementColor(stats.engagementScore)}`}>{stats.engagementScore}/100</span>
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setTimeFilter(timeFilter === 'all' ? '7d' :
                            timeFilter === '7d' ? '30d' :
                                timeFilter === '30d' ? '90d' : 'all')}
                    >
                        <Filter className="h-4 w-4 mr-2" />
                        {timeFilter === 'all' ? 'All Time' : timeFilter.toUpperCase()}
                    </Button>
                    <Button variant="outline" size="sm" onClick={refresh}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Main Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Total Notes"
                    value={animatedCounts.notes}
                    subtitle={`${stats.notesThisWeek} this week`}
                    icon={BookOpen}
                    color="blue"
                    trend={stats.notesThisWeek > 0 ? 'up' : 'neutral'}
                    trendValue={stats.notesThisWeek > 0 ? `+${stats.notesThisWeek} this week` : 'No activity'}
                    onClick={() => onNavigateToTab('notes')}
                />
                <StatCard
                    title="Recordings"
                    value={animatedCounts.recordings}
                    subtitle={`${Math.round(stats.totalStudyTime / 3600)}h total`}
                    icon={Play}
                    color="green"
                    trend={stats.recordingsThisWeek > 0 ? 'up' : 'neutral'}
                    trendValue={stats.recordingsThisWeek > 0 ? `+${stats.recordingsThisWeek} this week` : 'No recordings'}
                    onClick={() => onNavigateToTab('recordings')}
                />
                <StatCard
                    title="Documents"
                    value={animatedCounts.documents}
                    subtitle={formatFileSize(stats.totalDocumentSize)}
                    icon={FileText}
                    color="yellow"
                    trend={stats.documentsPending > 0 ? 'up' : 'neutral'}
                    trendValue={stats.documentsPending > 0 ? `${stats.documentsPending} processing` : 'All processed'}
                    onClick={() => onNavigateToTab('documents')}
                />
                <StatCard
                    title="AI Conversations"
                    value={animatedCounts.messages}
                    subtitle={`${Math.round(stats.aiUsageRate)}% AI usage`}
                    icon={MessageCircle}
                    color="purple"
                    trend={stats.aiUsageRate > 50 ? 'up' : 'neutral'}
                    trendValue={`${Math.round(stats.aiUsageRate)}% notes with AI`}
                    onClick={() => onNavigateToTab('chat')}
                />
            </div>

            {/* Quick Actions */}
            <Card className='dark:bg-transparent border-0'>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Zap className="h-5 w-5" />
                        Quick Actions
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <QuickAction
                            title="New Note"
                            description="Create a new study note"
                            icon={PlusCircle}
                            onClick={() => onCreateNew('note')}
                            color="blue"
                        />
                        <QuickAction
                            title="Record Session"
                            description="Start audio recording"
                            icon={Play}
                            onClick={() => onCreateNew('recording')}
                            color="green"
                        />
                        <QuickAction
                            title="Upload Document"
                            description="Add learning material"
                            icon={Upload}
                            onClick={() => onCreateNew('document')}
                            color="yellow"
                        />
                        <QuickAction
                            title="Schedule Event"
                            description="Plan your study time"
                            icon={Calendar}
                            onClick={() => onCreateNew('schedule')}
                            color="purple"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Analytics Tabs */}
            <Tabs value={selectedMetric} onValueChange={(value: any) => setSelectedMetric(value)}>
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="activity" className="flex items-center gap-2">
                        <Activity className="h-4 w-4" />
                        Activity
                    </TabsTrigger>
                    <TabsTrigger value="productivity" className="flex items-center gap-2">
                        <Target className="h-4 w-4" />
                        Productivity
                    </TabsTrigger>
                    <TabsTrigger value="learning" className="flex items-center gap-2">
                        <Brain className="h-4 w-4" />
                        Learning
                    </TabsTrigger>
                    <TabsTrigger value="insights" className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        Insights
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="activity" className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* 7-Day Activity Chart */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Weekly Activity (Last 7 Days)</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={300}>
                                    <AreaChart data={stats.activityData7Days}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="date" />
                                        <YAxis />
                                        <Tooltip />
                                        <Legend />
                                        <Area
                                            type="monotone"
                                            dataKey="notes"
                                            stackId="1"
                                            stroke={CHART_COLORS.primary}
                                            fill={CHART_COLORS.primary}
                                            fillOpacity={0.6}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="recordings"
                                            stackId="1"
                                            stroke={CHART_COLORS.secondary}
                                            fill={CHART_COLORS.secondary}
                                            fillOpacity={0.6}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="documents"
                                            stackId="1"
                                            stroke={CHART_COLORS.accent}
                                            fill={CHART_COLORS.accent}
                                            fillOpacity={0.6}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        {/* Category Distribution */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Note Categories</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={300}>
                                    <PieChart>
                                        <Pie
                                            data={stats.categoryData}
                                            cx="50%"
                                            cy="50%"
                                            labelLine={false}
                                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                            outerRadius={80}
                                            fill="#8884d8"
                                            dataKey="value"
                                        >
                                            {stats.categoryData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        {/* Hourly Activity Pattern */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Activity by Hour</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={stats.hourlyActivity}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="hour" label={{ value: 'Hour of Day', position: 'insideBottom', offset: -5 }} />
                                        <YAxis />
                                        <Tooltip />
                                        <Bar dataKey="activity" fill={CHART_COLORS.primary} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        {/* Weekday Activity Pattern */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Activity by Day of Week</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={stats.weekdayActivity}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="day" />
                                        <YAxis />
                                        <Tooltip />
                                        <Bar dataKey="activity" fill={CHART_COLORS.secondary} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="productivity" className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Study Time Card */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Clock className="h-5 w-5" />
                                    Study Time
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm">Total Hours</span>
                                        <span className="font-bold text-xl">{Math.round(stats.totalStudyTime / 3600)}h</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm">This Week</span>
                                        <span className="font-bold text-lg">{Math.round(stats.studyTimeThisWeek / 3600)}h</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm">Daily Average</span>
                                        <span className="font-bold text-lg">{Math.round(stats.avgDailyStudyTime / 60)}min</span>
                                    </div>
                                    <Progress value={(stats.studyTimeThisWeek / 36000) * 100} className="w-full" />
                                    <p className="text-xs text-gray-500">Weekly goal: 10 hours</p>
                                </div>
                            </CardContent>
                        </Card>

                        {/* AI Usage Card */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Brain className="h-5 w-5" />
                                    AI Usage
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="text-center">
                                        <div className="text-4xl font-bold text-blue-600">
                                            {stats.aiUsageRate.toFixed(0)}%
                                        </div>
                                        <p className="text-sm text-gray-600 mt-1">Notes with AI summaries</p>
                                    </div>
                                    <Progress value={stats.aiUsageRate} className="w-full" />
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span>Notes with AI</span>
                                            <span className="font-semibold">{stats.notesWithAI}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Total Messages</span>
                                            <span className="font-semibold">{stats.totalMessages}</span>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Schedule Overview */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Calendar className="h-5 w-5" />
                                    Schedule Overview
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between p-2 bg-blue-50 dark:bg-blue-950 rounded">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="h-4 w-4 text-blue-500" />
                                            <span className="text-sm">Today's Tasks</span>
                                        </div>
                                        <Badge variant="secondary">{stats.todayTasks}</Badge>
                                    </div>
                                    <div className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-950 rounded">
                                        <div className="flex items-center gap-2">
                                            <CheckCircle className="h-4 w-4 text-green-500" />
                                            <span className="text-sm">Completed</span>
                                        </div>
                                        <Badge variant="secondary">{stats.completedTasks}</Badge>
                                    </div>
                                    <div className="flex items-center justify-between p-2 bg-yellow-50 dark:bg-yellow-950 rounded">
                                        <div className="flex items-center gap-2">
                                            <Clock className="h-4 w-4 text-yellow-500" />
                                            <span className="text-sm">Upcoming</span>
                                        </div>
                                        <Badge variant="secondary">{stats.upcomingTasks}</Badge>
                                    </div>
                                    {stats.overdueTasks > 0 && (
                                        <div className="flex items-center justify-between p-2 bg-red-50 dark:bg-red-950 rounded">
                                            <div className="flex items-center gap-2">
                                                <AlertTriangle className="h-4 w-4 text-red-500" />
                                                <span className="text-sm">Overdue</span>
                                            </div>
                                            <Badge variant="destructive">{stats.overdueTasks}</Badge>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Document Processing Status */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-green-600">
                                    <FileCheck className="h-5 w-5" />
                                    Processed
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-center">
                                    <div className="text-4xl font-bold text-green-600">{stats.documentsProcessed}</div>
                                    <p className="text-sm text-gray-500 mt-1">Documents ready</p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-yellow-600">
                                    <FileClock className="h-5 w-5" />
                                    Processing
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-center">
                                    <div className="text-4xl font-bold text-yellow-600">{stats.documentsPending}</div>
                                    <p className="text-sm text-gray-500 mt-1">Being processed</p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-red-600">
                                    <FileX className="h-5 w-5" />
                                    Failed
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-center">
                                    <div className="text-4xl font-bold text-red-600">{stats.documentsFailed}</div>
                                    <p className="text-sm text-gray-500 mt-1">Processing errors</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Learning Velocity */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Learning Velocity (Last 12 Weeks)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={250}>
                                <LineChart data={stats.learningVelocity}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="week" />
                                    <YAxis />
                                    <Tooltip />
                                    <Line
                                        type="monotone"
                                        dataKey="items"
                                        stroke={CHART_COLORS.purple}
                                        strokeWidth={2}
                                        dot={{ fill: CHART_COLORS.purple, r: 4 }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="learning" className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Learning Streak */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Flame className="h-5 w-5 text-orange-500" />
                                    Learning Streak
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-center space-y-4">
                                    <div className="flex items-center justify-center gap-2">
                                        <Award className="h-12 w-12 text-yellow-500" />
                                        <span className="text-6xl font-bold text-blue-600">
                                            {stats.currentStreak}
                                        </span>
                                    </div>
                                    <p className="text-gray-600 text-lg">Days in a row</p>
                                    <div className="flex justify-around text-sm">
                                        <div>
                                            <p className="text-gray-500">Best Streak</p>
                                            <p className="text-2xl font-bold text-green-600">{stats.maxStreak}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-500">This Week</p>
                                            <p className="text-2xl font-bold text-blue-600">{stats.notesThisWeek}</p>
                                        </div>
                                    </div>
                                    <Progress
                                        value={(stats.currentStreak / Math.max(stats.maxStreak, 1)) * 100}
                                        className="w-full h-3"
                                    />
                                    {stats.currentStreak > 0 && (
                                        <p className="text-xs text-gray-500">
                                            Keep it up! {stats.maxStreak - stats.currentStreak > 0
                                                ? `${stats.maxStreak - stats.currentStreak} days to beat your record!`
                                                : 'You\'re on your best streak! 🎉'}
                                        </p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Learning Progress */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Target className="h-5 w-5" />
                                    Learning Progress
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                                        <div className="flex items-center gap-2">
                                            <BookMarked className="h-4 w-4 text-blue-500" />
                                            <span className="text-sm">Notes Created</span>
                                        </div>
                                        <Badge variant="secondary" className="text-sm font-bold">
                                            {stats.totalNotes}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                                        <div className="flex items-center gap-2">
                                            <Play className="h-4 w-4 text-green-500" />
                                            <span className="text-sm">Sessions Recorded</span>
                                        </div>
                                        <Badge variant="secondary" className="text-sm font-bold">
                                            {stats.totalRecordings}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                                        <div className="flex items-center gap-2">
                                            <FileText className="h-4 w-4 text-yellow-500" />
                                            <span className="text-sm">Documents Added</span>
                                        </div>
                                        <Badge variant="secondary" className="text-sm font-bold">
                                            {stats.totalDocuments}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-950 rounded-lg">
                                        <div className="flex items-center gap-2">
                                            <MessageCircle className="h-4 w-4 text-purple-500" />
                                            <span className="text-sm">AI Interactions</span>
                                        </div>
                                        <Badge variant="secondary" className="text-sm font-bold">
                                            {stats.totalMessages}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center justify-between p-3 bg-pink-50 dark:bg-pink-950 rounded-lg">
                                        <div className="flex items-center gap-2">
                                            <Trophy className="h-4 w-4 text-pink-500" />
                                            <span className="text-sm">Quizzes Taken</span>
                                        </div>
                                        <Badge variant="secondary" className="text-sm font-bold">
                                            {stats.totalQuizzesTaken}
                                        </Badge>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Top Categories */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Top Categories</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {stats.topCategories.map((cat, index) => (
                                        <div key={cat.category} className="flex items-center gap-3">
                                            <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-white"
                                                style={{ backgroundColor: COLORS[index % COLORS.length] }}>
                                                {index + 1}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex justify-between mb-1">
                                                    <span className="text-sm font-medium">{cat.category}</span>
                                                    <span className="text-sm text-gray-500">{cat.count} notes</span>
                                                </div>
                                                <Progress
                                                    value={(cat.count / stats.totalNotes) * 100}
                                                    className="h-2"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        {/* 30-Day Activity Trend */}
                        <Card>
                            <CardHeader>
                                <CardTitle>30-Day Activity Trend</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={200}>
                                    <LineChart data={stats.activityData30Days}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="date" hide />
                                        <YAxis />
                                        <Tooltip />
                                        <Line
                                            type="monotone"
                                            dataKey="total"
                                            stroke={CHART_COLORS.primary}
                                            strokeWidth={2}
                                            dot={false}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                                    <div>
                                        <p className="text-xs text-gray-500">This Week</p>
                                        <p className="text-lg font-bold">{stats.notesThisWeek}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">This Month</p>
                                        <p className="text-lg font-bold">{stats.notesThisMonth}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">Avg/Day</p>
                                        <p className="text-lg font-bold">{stats.avgNotesPerDay.toFixed(1)}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="insights" className="space-y-6">
                    {/* Engagement Score Card */}
                    <Card className="border-2 border-blue-200 dark:border-blue-800">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Sparkles className="h-5 w-5 text-yellow-500" />
                                Your Engagement Score
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-6">
                                <div className="flex-1">
                                    <div className={`text-6xl font-bold ${getEngagementColor(stats.engagementScore)}`}>
                                        {stats.engagementScore}
                                    </div>
                                    <p className="text-gray-600 dark:text-gray-400 mt-2">
                                        {stats.engagementScore >= 80 ? '🔥 Outstanding! You\'re crushing it!' :
                                            stats.engagementScore >= 60 ? '👍 Great work! Keep it up!' :
                                                stats.engagementScore >= 40 ? '💪 Good progress! Room to improve!' :
                                                    '🌱 Just getting started!'}
                                    </p>
                                    <Progress value={stats.engagementScore} className="w-full h-3 mt-4" />
                                </div>
                                <div className="text-right space-y-2">
                                    <div className="text-sm">
                                        <p className="text-gray-500">Most Active</p>
                                        <p className="font-bold">{stats.mostProductiveDay}</p>
                                    </div>
                                    <div className="text-sm">
                                        <p className="text-gray-500">Peak Hour</p>
                                        <p className="font-bold">{stats.mostProductiveHour}:00</p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Productivity Insights */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>This Week vs Last Week</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm">Notes</span>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold">{stats.notesThisWeek}</span>
                                            {stats.notesThisWeek > 0 && (
                                                <TrendingUp className="h-4 w-4 text-green-600" />
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm">Study Time</span>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold">{Math.round(stats.studyTimeThisWeek / 3600)}h</span>
                                            {stats.studyTimeThisWeek > 0 && (
                                                <TrendingUp className="h-4 w-4 text-green-600" />
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm">Recordings</span>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold">{stats.recordingsThisWeek}</span>
                                            {stats.recordingsThisWeek > 0 && (
                                                <TrendingUp className="h-4 w-4 text-green-600" />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Storage Overview</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <HardDrive className="h-8 w-8 text-blue-500" />
                                        <div className="flex-1">
                                            <p className="text-2xl font-bold">{formatFileSize(stats.totalDocumentSize)}</p>
                                            <p className="text-sm text-gray-500">Total storage used</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 text-center">
                                        <div className="p-2 bg-blue-50 dark:bg-blue-950 rounded">
                                            <p className="text-lg font-bold">{stats.totalDocuments}</p>
                                            <p className="text-xs text-gray-500">Files</p>
                                        </div>
                                        <div className="p-2 bg-green-50 dark:bg-green-950 rounded">
                                            <p className="text-lg font-bold">{stats.documentsProcessed}</p>
                                            <p className="text-xs text-gray-500">Processed</p>
                                        </div>
                                        <div className="p-2 bg-yellow-50 dark:bg-yellow-950 rounded">
                                            <p className="text-lg font-bold">{stats.documentsPending}</p>
                                            <p className="text-xs text-gray-500">Pending</p>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>

            {/* Recent Activity & AI Insights */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Activity */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                            <span className="flex items-center gap-2">
                                <Activity className="h-5 w-5" />
                                Recent Activity
                            </span>
                            <Button variant="ghost" size="sm" onClick={() => onNavigateToTab('notes')}>
                                View All
                            </Button>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3 max-h-96 overflow-y-auto modern-scrollbar">
                            {stats.recentNotes.map((note) => (
                                <div
                                    key={note.id}
                                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                                    onClick={() => onNavigateToTab('notes')}
                                >
                                    <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                                        <BookOpen className="h-4 w-4 text-blue-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{note.title}</p>
                                        <p className="text-xs text-gray-500">
                                            {new Date(note.created_at).toLocaleDateString()} • {note.category}
                                        </p>
                                    </div>
                                    <Badge variant="outline" className="text-xs">{note.category}</Badge>
                                </div>
                            ))}

                            {stats.recentRecordings.map((recording) => (
                                <div
                                    key={recording.id}
                                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                                    onClick={() => onNavigateToTab('recordings')}
                                >
                                    <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                                        <Play className="h-4 w-4 text-green-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{recording.title}</p>
                                        <p className="text-xs text-gray-500">
                                            {new Date(recording.created_at).toLocaleDateString()} • {Math.round(recording.duration / 60)}min
                                        </p>
                                    </div>
                                    <Badge variant="outline" className="text-xs">Recording</Badge>
                                </div>
                            ))}

                            {stats.recentDocuments.map((doc) => (
                                <div
                                    key={doc.id}
                                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                                    onClick={() => onNavigateToTab('documents')}
                                >
                                    <div className="p-2 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
                                        <FileText className="h-4 w-4 text-yellow-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{doc.title}</p>
                                        <p className="text-xs text-gray-500">
                                            {new Date(doc.created_at).toLocaleDateString()} • {doc.type}
                                        </p>
                                    </div>
                                    <Badge
                                        variant={doc.processing_status === 'completed' ? 'default' :
                                            doc.processing_status === 'failed' ? 'destructive' : 'secondary'}
                                        className="text-xs"
                                    >
                                        {doc.processing_status}
                                    </Badge>
                                </div>
                            ))}

                            {stats.recentNotes.length === 0 && stats.recentRecordings.length === 0 && stats.recentDocuments.length === 0 && (
                                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                                    <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                    <p className="font-medium">No recent activity</p>
                                    <p className="text-xs mt-1">Start by creating a note or recording!</p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* AI Insights & Tips */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Brain className="h-5 w-5" />
                            AI Insights & Tips
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {stats.aiUsageRate < 30 && (
                                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                                    <div className="flex items-start gap-2">
                                        <Star className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                                        <div>
                                            <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                                                Boost Your Learning
                                            </p>
                                            <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">
                                                Try using AI summaries for your notes to improve retention and understanding.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {stats.currentStreak === 0 && (
                                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                                    <div className="flex items-start gap-2">
                                        <Target className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                                        <div>
                                            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                                                Build Consistency
                                            </p>
                                            <p className="text-xs text-yellow-600 dark:text-yellow-300 mt-1">
                                                Start your learning streak by creating a note today!
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {stats.todayTasks === 0 && (
                                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                                    <div className="flex items-start gap-2">
                                        <Calendar className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                                        <div>
                                            <p className="text-sm font-medium text-green-800 dark:text-green-200">
                                                Plan Your Day
                                            </p>
                                            <p className="text-xs text-green-600 dark:text-green-300 mt-1">
                                                Add some study sessions to your schedule to stay organized.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {stats.overdueTasks > 0 && (
                                <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                                    <div className="flex items-start gap-2">
                                        <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                                        <div>
                                            <p className="text-sm font-medium text-red-800 dark:text-red-200">
                                                Tasks Need Attention
                                            </p>
                                            <p className="text-xs text-red-600 dark:text-red-300 mt-1">
                                                You have {stats.overdueTasks} overdue task{stats.overdueTasks > 1 ? 's' : ''}. Consider rescheduling or completing them.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {stats.totalRecordings > 0 && stats.totalNotes > 0 && stats.currentStreak >= 3 && (
                                <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                                    <div className="flex items-start gap-2">
                                        <Zap className="h-4 w-4 text-purple-600 mt-0.5 flex-shrink-0" />
                                        <div>
                                            <p className="text-sm font-medium text-purple-800 dark:text-purple-200">
                                                Excellent Progress!
                                            </p>
                                            <p className="text-xs text-purple-600 dark:text-purple-300 mt-1">
                                                You're actively using multiple learning methods and maintaining consistency. Keep it up!
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {stats.documentsPending > 0 && (
                                <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
                                    <div className="flex items-start gap-2">
                                        <FileClock className="h-4 w-4 text-indigo-600 mt-0.5 flex-shrink-0" />
                                        <div>
                                            <p className="text-sm font-medium text-indigo-800 dark:text-indigo-200">
                                                Documents Processing
                                            </p>
                                            <p className="text-xs text-indigo-600 dark:text-indigo-300 mt-1">
                                                {stats.documentsPending} document{stats.documentsPending > 1 ? 's are' : ' is'} being processed. Check back soon!
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Achievement badges */}
                            <div className="pt-4 border-t dark:border-gray-700">
                                <p className="text-sm font-medium mb-3">Your Achievements</p>
                                <div className="flex flex-wrap gap-2">
                                    {stats.totalNotes >= 10 && <Badge variant="secondary" className="text-xs">📚 Note Taker</Badge>}
                                    {stats.totalNotes >= 50 && <Badge variant="secondary" className="text-xs">📖 Prolific Writer</Badge>}
                                    {stats.totalRecordings >= 5 && <Badge variant="secondary" className="text-xs">🎤 Voice Learner</Badge>}
                                    {stats.totalRecordings >= 20 && <Badge variant="secondary" className="text-xs">🎙️ Audio Master</Badge>}
                                    {stats.currentStreak >= 7 && <Badge variant="secondary" className="text-xs">🔥 Week Warrior</Badge>}
                                    {stats.currentStreak >= 30 && <Badge variant="secondary" className="text-xs">💪 Month Master</Badge>}
                                    {stats.currentStreak >= 100 && <Badge variant="secondary" className="text-xs">👑 Century Champion</Badge>}
                                    {stats.aiUsageRate >= 70 && <Badge variant="secondary" className="text-xs">🤖 AI Explorer</Badge>}
                                    {stats.totalDocuments >= 10 && <Badge variant="secondary" className="text-xs">📑 Resource Collector</Badge>}
                                    {stats.totalDocuments >= 50 && <Badge variant="secondary" className="text-xs">📚 Library Builder</Badge>}
                                    {stats.totalMessages >= 100 && <Badge variant="secondary" className="text-xs">💬 Chat Champion</Badge>}
                                    {stats.engagementScore >= 80 && <Badge variant="secondary" className="text-xs">⭐ Super Learner</Badge>}
                                    {stats.totalStudyTime >= 36000 && <Badge variant="secondary" className="text-xs">⏰ 10 Hour Club</Badge>}
                                    {stats.totalStudyTime >= 180000 && <Badge variant="secondary" className="text-xs">🏆 50 Hour Hero</Badge>}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Study Goals & Progress */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Target className="h-5 w-5" />
                        Learning Goals
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span>Weekly Notes</span>
                                <span className="text-gray-500">
                                    {Math.min(stats.notesThisWeek, 7)}/7
                                </span>
                            </div>
                            <Progress value={(Math.min(stats.notesThisWeek, 7) / 7) * 100} className="h-2" />
                            <p className="text-xs text-gray-500">Create 7 notes this week</p>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span>Study Hours</span>
                                <span className="text-gray-500">
                                    {Math.min(Math.round(stats.studyTimeThisWeek / 3600), 20)}/20
                                </span>
                            </div>
                            <Progress
                                value={(Math.min(Math.round(stats.studyTimeThisWeek / 3600), 20) / 20) * 100}
                                className="h-2"
                            />
                            <p className="text-xs text-gray-500">Record 20 hours of study</p>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span>AI Interactions</span>
                                <span className="text-gray-500">
                                    {Math.min(stats.totalMessages, 50)}/50
                                </span>
                            </div>
                            <Progress
                                value={(Math.min(stats.totalMessages, 50) / 50) * 100}
                                className="h-2"
                            />
                            <p className="text-xs text-gray-500">Engage with AI tutor</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Footer Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <Card className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                        <p className="text-3xl font-bold text-blue-600">
                            {Math.round(stats.totalStudyTime / 3600)}h
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Hours Studied</p>
                    </CardContent>
                </Card>
                <Card className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                        <p className="text-3xl font-bold text-green-600">{stats.currentStreak}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Day Streak</p>
                    </CardContent>
                </Card>
                <Card className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                        <p className="text-3xl font-bold text-purple-600">{stats.totalMessages}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">AI Chats</p>
                    </CardContent>
                </Card>
                <Card className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                        <p className="text-3xl font-bold text-yellow-600">
                            {Math.round(stats.aiUsageRate)}%
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">AI Usage</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default Dashboard;