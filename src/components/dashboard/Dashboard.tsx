// components/Dashboard.tsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { Badge } from '../ui/badge';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    AreaChart, Area, PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import {
    BookOpen, FileText, MessageCircle, Play, HardDrive, Flame,
    Activity, Brain, Sparkles, Target, RefreshCw, Filter,
    TrendingUp, Clock, Zap, AlertCircle, Calendar, CheckCircle,
    Clock as ClockIcon, Star, FileWarning, FileCheck, FileX,
    BarChart2, PieChart as PieIcon, LineChart as LineIcon,
    List, Users, Brain as BrainIcon, Bot, Plus, Database, BarChart3,
    Info, Lightbulb, FolderOpen, LayoutDashboard
} from 'lucide-react';
import { useDashboardStats } from './hooks/useDashboardStats';
import { CentralDynamicChart } from './CentralDynamicChart';
import { KnowledgeRadar } from './KnowledgeRadar';
import { StudyPatterns } from './StudyPatterns';
import ModernPremiumLoader from '../ui/ModernPremiumLoader';
import { SubscriptionGuard } from '../subscription/SubscriptionGuard';
import { RecentPodcasts } from './RecentPodcasts';
import { RecentActivityFeed } from './RecentActivityFeed';
import { AIInsights } from './AIInsights';

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];
const GRADIENT_ID = 'engagementGradient';

interface DashboardProps {
    userProfile: any;
    onNavigateToTab: (tab: string) => void;
    onCreateNew: (type: 'note' | 'recording' | 'document' | 'schedule') => void;
}

const Dashboard: React.FC<DashboardProps> = ({ userProfile, onNavigateToTab, onCreateNew }) => {
    const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'activity'>('overview');
    const { stats, loading, error, refresh, isCached } = useDashboardStats(userProfile?.id);

    // Trigger an initial load only when we don't already have cached stats for
    // this user. This prevents repeated refetches when the Dashboard remounts.
    useEffect(() => {
        if (userProfile?.id && !isCached) {
            refresh();
        }
    }, [userProfile?.id, isCached, refresh]);

    // Sync tab changes with global header
    useEffect(() => {
        window.dispatchEvent(new CustomEvent('section-tab-active', {
            detail: { section: 'dashboard', tab: activeTab }
        }));
    }, [activeTab]);

    useEffect(() => {
        const handler = (event: Event) => {
            const detail = (event as CustomEvent).detail;
            if (detail?.section === 'dashboard' && detail?.tab) {
                setActiveTab(detail.tab as any);
            }
        };
        window.addEventListener('section-tab-change', handler as EventListener);
        return () => window.removeEventListener('section-tab-change', handler as EventListener);
    }, []);

    const formatFileSize = (bytes: number) => {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
    };

    const formatTime = (seconds: number) => {
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        return `${hours}h ${mins}m`;
    };

    const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    // Check if stats exist and have meaningful data
    const hasData = stats && (
        stats.totalNotes > 0 ||
        stats.totalStudyTime > 0 ||
        stats.totalDocumentSize > 0 ||
        stats.totalMessages > 0 ||
        stats.totalScheduleItems > 0 ||
        stats.totalQuizzesTaken > 0
    );

    const hasRecentData = stats && (
        (stats.recentNotes && stats.recentNotes.length > 0) ||
        (stats.recentRecordings && stats.recentRecordings.length > 0) ||
        (stats.recentDocuments && stats.recentDocuments.length > 0)
    );

    const hasChartData = (data: any[]) => {
        if (!data || data.length === 0) return false;
        return data.some(item => {
            // Check if any value in the item is greater than 0
            return Object.values(item).some(val =>
                typeof val === 'number' && val > 0
            );
        });
    };

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-2xl shadow-xl">
                    <div className="w-20 h-20 mx-auto mb-4 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
                        <AlertCircle className="h-10 w-10 text-red-600 dark:text-red-400" />
                    </div>
                    <Button onClick={refresh} variant="outline" className="border-red-300">
                        <RefreshCw className="h-4 w-4 mr-2" /> Retry
                    </Button>
                </div>
            </div>
        );
    }

    // Progressive skeleton when stats not yet available. When cached data
    // exists this will be skipped and the dashboard renders immediately.
    if (!stats) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <ModernPremiumLoader fullScreen={false} size="lg" text="DASHBOARD" />
                </div>
            </div>
        );
    }

    const engagementColor = stats.engagementScore >= 80 ? '#10b981' :
        stats.engagementScore >= 60 ? '#3b82f6' :
            stats.engagementScore >= 40 ? '#f59e0b' : '#ef4444';

    // Empty state components
    const EmptyStateCard = ({ title, description, icon: Icon, onCreate, type }: {
        title: string;
        description: string;
        icon: React.ElementType;
        onCreate?: () => void;
        type?: 'note' | 'recording' | 'document' | 'schedule';
    }) => (
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-xl p-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900 dark:to-blue-800 rounded-full flex items-center justify-center">
                <Icon className="h-8 w-8 text-blue-600 dark:text-blue-300" />
            </div>
            <h3 className="text-lg font-semibold mb-2">{title}</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">{description}</p>
            {onCreate && type && (
                <SubscriptionGuard
                    feature={type.charAt(0).toUpperCase() + type.slice(1)}
                    limitFeature={
                        type === 'note' ? 'maxNotes' :
                            type === 'recording' ? 'maxRecordings' :
                                type === 'document' ? 'maxDocuments' :
                                    type === 'schedule' ? 'maxScheduleItems' : 'maxNotes'
                    }
                    currentCount={
                        type === 'note' ? stats.totalNotes || 0 :
                            type === 'recording' ? stats.totalRecordings || 0 :
                                type === 'document' ? stats.totalDocuments || 0 :
                                    type === 'schedule' ? stats.totalScheduleItems || 0 : 0
                    }
                >
                    <Button
                        onClick={() => onCreateNew(type)}
                        variant="outline"
                        className="border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Create {type.charAt(0).toUpperCase() + type.slice(1)}
                    </Button>
                </SubscriptionGuard>
            )}
        </div>
    );

    const EmptyChartState = ({ message, icon: Icon }: { message: string; icon: React.ElementType }) => (
        <div className="h-full flex flex-col items-center justify-center p-8 text-gray-500 dark:text-gray-400">
            <Icon className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-center">{message}</p>
        </div>
    );

    return (
        <div className="min-h-screen max-w-5xl pb-8 mx-auto px-4 sm:px-6 lg:px-8">

            {/* Dashboard Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pt-8 pb-6">
                <div className="space-y-1">
                    <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-100 bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400">
                        Welcome back, {userProfile?.full_name?.split(' ')[0] || 'Learner'}!
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">
                        Here's what's happening with your learning today.
                    </p>
                </div>
                <div className="mt-4 sm:mt-0">
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => refresh()}
                        disabled={loading}
                        className="rounded-full shadow-sm hover:shadow transition-all duration-200 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200"
                    >
                        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : 'text-indigo-500'}`} />
                        {loading ? 'Refreshing...' : 'Refresh Data'}
                    </Button>
                </div>
            </div>

            {/* AI Insights Banner */}
            <div className="mb-8">
                <AIInsights
                    stats={stats}
                    userName={userProfile?.full_name}
                    onRefresh={refresh}
                    onAction={(action) => {
                        const lowerAction = action.toLowerCase();
                        if (lowerAction.includes('schedule')) return onCreateNew('schedule');
                        if (lowerAction.includes('note') || lowerAction.includes('write')) return onCreateNew('note');
                        if (lowerAction.includes('recording')) return onCreateNew('recording');
                        if (lowerAction.includes('document') || lowerAction.includes('upload')) return onCreateNew('document');
                        if (lowerAction.includes('review') || lowerAction.includes('read')) return onNavigateToTab('notes');
                        if (lowerAction.includes('quiz') || lowerAction.includes('test')) return onNavigateToTab('quizzes');
                        onNavigateToTab('dashboard');
                    }}
                />
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8 mt-4">
                {[
                    { title: "Notes", value: stats.totalNotes || 0, icon: BookOpen, color: "from-blue-500 to-cyan-500", bg: "bg-blue-100 dark:bg-blue-900", type: 'note' as const },
                    { title: "Recordings", value: formatTime(stats.totalStudyTime || 0), icon: Play, color: "from-green-500 to-emerald-500", bg: "bg-green-100 dark:bg-green-900", type: 'recording' as const },
                    { title: "Documents", value: formatFileSize(stats.totalDocumentSize || 0), icon: FileText, color: "from-yellow-500 to-orange-500", bg: "bg-yellow-100 dark:bg-yellow-900", type: 'document' as const },
                    { title: "Chat", value: stats.totalMessages || 0, icon: MessageCircle, color: "from-blue-500 to-pink-500", bg: "bg-blue-100 dark:bg-blue-900" },
                    { title: "Schedule", value: stats.totalScheduleItems || 0, icon: Calendar, color: "from-blue-500 to-indigo-500", bg: "bg-blue-100 dark:bg-blue-900", type: 'schedule' as const },
                    { title: "Quizzes", value: stats.totalQuizzesTaken || 0, icon: BrainIcon, color: "from-red-500 to-pink-500", bg: "bg-red-100 dark:bg-red-900" },
                ].map((stat, i) => (
                    <Card key={i} className="overflow-hidden hover:scale-105 transition-all duration-300 cursor-pointer group" onClick={() => onNavigateToTab(stat.title.toLowerCase())}>
                        <CardContent className="p-4 sm:p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">{stat.title}</p>
                                    <p className="text-xl sm:text-3xl font-bold mt-2">
                                        {stat.value === 0 || stat.value === '0 B' || stat.value === '0h 0m' ? (
                                            <span className="text-gray-400">0</span>
                                        ) : stat.value}
                                    </p>
                                </div>
                                <div className={`p-3 sm:p-4 rounded-2xl ${stat.bg} group-hover:scale-110 transition-transform`}>
                                    <stat.icon className="h-6 w-6 sm:h-8 sm:w-8 text-gray-700 dark:text-gray-300" />
                                </div>
                            </div>
                            {stat.value === 0 && stat.type && (
                                <SubscriptionGuard
                                    feature={stat.title}
                                    limitFeature={
                                        stat.type === 'note' ? 'maxNotes' :
                                            stat.type === 'recording' ? 'maxRecordings' :
                                                stat.type === 'document' ? 'maxDocuments' :
                                                    stat.type === 'schedule' ? 'maxScheduleItems' : 'maxNotes'
                                    }
                                    currentCount={
                                        stat.type === 'note' ? stats.totalNotes || 0 :
                                            stat.type === 'recording' ? stats.totalRecordings || 0 :
                                                stat.type === 'document' ? stats.totalDocuments || 0 :
                                                    stat.type === 'schedule' ? stats.totalScheduleItems || 0 : 0
                                    }
                                >
                                    <Button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onCreateNew(stat.type!);
                                        }}
                                        variant="ghost"
                                        size="sm"
                                        className="w-full mt-2 text-xs"
                                    >
                                        <Plus className="h-3 w-3 mr-1" />
                                        Add first {stat.title.toLowerCase()}
                                    </Button>
                                </SubscriptionGuard>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </div>

            {!hasData ? (
                <div className="mb-8">
                    <Card className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-gray-800 dark:to-gray-900 border-0 shadow-xl">
                        <CardContent className="p-6 sm:p-8">
                            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                                <div className="flex-1 text-center md:text-left">
                                    <h2 className="text-2xl font-bold mb-2">Your mind palace is empty</h2>
                                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                                        Start building your knowledge base by creating notes, recordings, or uploading documents.
                                    </p>
                                    <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                                        <SubscriptionGuard
                                            feature="Notes"
                                            limitFeature="maxNotes"
                                            currentCount={stats.totalNotes || 0}
                                        >
                                            <Button onClick={() => onCreateNew('note')} className="bg-blue-600 hover:bg-blue-700">
                                                <BookOpen className="h-4 w-4 mr-2" />
                                                Create Note
                                            </Button>
                                        </SubscriptionGuard>

                                        <SubscriptionGuard
                                            feature="Recordings"
                                            limitFeature="maxRecordings"
                                            currentCount={stats.totalRecordings || 0}
                                        >
                                            <Button onClick={() => onCreateNew('recording')} variant="outline">
                                                <Play className="h-4 w-4 mr-2" />
                                                Start Recording
                                            </Button>
                                        </SubscriptionGuard>

                                        <SubscriptionGuard
                                            feature="Documents"
                                            limitFeature="maxDocuments"
                                            currentCount={stats.totalDocuments || 0}
                                        >
                                            <Button onClick={() => onCreateNew('document')} variant="outline">
                                                <FileText className="h-4 w-4 mr-2" />
                                                Upload Document
                                            </Button>
                                        </SubscriptionGuard>
                                    </div>
                                </div>
                                <div className="w-48 h-48">
                                    <div className="w-full h-full bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-full flex items-center justify-center">
                                        <Brain className="h-24 w-24 text-blue-400 dark:text-blue-300 opacity-50" />
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            ) : (
                <>
                    {/* Tabs */}
                    <div className="flex gap-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur rounded-2xl p-2 shadow-xl mb-8">
                        {(['overview', 'analytics', 'activity'] as const).map(tab => (
                            <Button
                                key={tab}
                                variant={activeTab === tab ? "default" : "ghost"}
                                className={`flex-1 rounded-xl hover:bg-blue-600  ${activeTab === tab ? 'shadow-lg bg-blue-800' : ''}`}
                                onClick={() => setActiveTab(tab)}
                            >
                                {tab === 'overview' ? <LayoutDashboard className="h-5 w-5 mr-2" /> :
                                    tab === 'analytics' ? <BarChart3 className="h-5 w-5 mr-2" /> :
                                        <TrendingUp className="h-5 w-5 mr-2" />}
                                {tab === 'overview' ? 'Overview' :
                                    tab === 'analytics' ? 'Analytics' : 'Activity'}
                            </Button>
                        ))}
                    </div>

                    {/* Overview Tab */}
                    {activeTab === 'overview' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Central Dynamic Chart */}
                            <div className="col-span-1 lg:col-span-2">
                                <CentralDynamicChart stats={stats} />
                            </div>

                            {/* Recent AI Podcasts */}
                            <RecentPodcasts />

                            {/* Note Categories */}
                            <KnowledgeRadar stats={stats} />
                        </div>
                    )}

                    {/* Analytics Tab */}
                    {activeTab === 'analytics' && (
                        <div className="space-y-6">
                            {/* Study Patterns (Hourly & Weekday) */}
                            <StudyPatterns stats={stats} />

                            {/* Productivity Metrics */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                                <Card className="text-center p-4 sm:p-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur">
                                    <Zap className="h-8 w-8 sm:h-12 sm:w-12 mx-auto mb-4 text-yellow-500" />
                                    <p className="text-xl sm:text-3xl font-bold">{stats.mostProductiveDay || '--'}</p>
                                    <p className="text-gray-600 dark:text-gray-400">Most Productive Day</p>
                                </Card>
                                <Card className="text-center p-4 sm:p-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur">
                                    <Clock className="h-8 w-8 sm:h-12 sm:w-12 mx-auto mb-4 text-blue-500" />
                                    <p className="text-xl sm:text-3xl font-bold">
                                        {stats.mostProductiveHour !== undefined ? `${stats.mostProductiveHour}:00` : '--:--'}
                                    </p>
                                    <p className="text-gray-600 dark:text-gray-400">Peak Focus Hour</p>
                                </Card>
                                <Card className="text-center p-4 sm:p-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur">
                                    <TrendingUp className="h-8 w-8 sm:h-12 sm:w-12 mx-auto mb-4 text-green-500" />
                                    <p className="text-xl sm:text-3xl font-bold">{stats.avgNotesPerDay || 0}</p>
                                    <p className="text-gray-600 dark:text-gray-400">Avg Notes/Day</p>
                                </Card>
                                <Card className="text-center p-4 sm:p-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur">
                                    <ClockIcon className="h-8 w-8 sm:h-12 sm:w-12 mx-auto mb-4 text-blue-500" />
                                    <p className="text-xl sm:text-3xl font-bold">{formatTime(stats.avgDailyStudyTime || 0)}</p>
                                    <p className="text-gray-600 dark:text-gray-400">Avg Daily Study</p>
                                </Card>
                            </div>
                        </div>
                    )}

                    {/* Activity Tab */}
                    {activeTab === 'activity' && (
                        <div className="space-y-6">
                            {/* Streak Banner */}
                            {stats.currentStreak > 0 ? (
                                <Card className="bg-gradient-to-r from-blue-600 to-blue-600 text-white border-0 shadow-2xl">
                                    <CardContent className="p-6 sm:p-8 text-center">
                                        <h2 className="text-2xl sm:text-4xl font-bold mb-4">You're in the top 5% of learners!</h2>
                                        <p className="text-base sm:text-xl opacity-90">With {stats.currentStreak} day streak and {Math.round(stats.avgDailyStudyTime / 60)} mins/day</p>
                                    </CardContent>
                                </Card>
                            ) : (
                                <Card className="bg-gradient-to-r from-gray-600 to-gray-700 text-white border-0 shadow-2xl">
                                    <CardContent className="p-6 sm:p-8 text-center">
                                        <h2 className="text-2xl sm:text-4xl font-bold mb-4">Ready to build your streak?</h2>
                                        <p className="text-base sm:text-xl opacity-90">Create your first note or recording to start your learning journey</p>
                                    </CardContent>
                                </Card>
                            )}

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Left Column: Activity Feed */}
                                <div className="lg:col-span-2">
                                    <RecentActivityFeed stats={stats} onCreateNew={onCreateNew} />
                                </div>

                                {/* Right Column: Stats Summary */}
                                <div className="space-y-6">
                                    {/* Weekly Summary */}
                                    <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur">
                                        <CardHeader>
                                            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                                                <TrendingUp className="h-5 w-5 text-blue-600" />
                                                Weekly Summary
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-2">
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm text-gray-500">Notes Created</span>
                                                <span className="font-bold">{stats.notesThisWeek || 0}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm text-gray-500">Recordings</span>
                                                <span className="font-bold">{stats.recordingsThisWeek || 0}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm text-gray-500">Study Time</span>
                                                <span className="font-bold">{formatTime(stats.studyTimeThisWeek || 0)}</span>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* Monthly Summary */}
                                    <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur">
                                        <CardHeader>
                                            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                                                <Calendar className="h-5 w-5 text-green-600" />
                                                Monthly Summary
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-2">
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm text-gray-500">Total Notes</span>
                                                <span className="font-bold">{stats.notesThisMonth || 0}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm text-gray-500">Total Recordings</span>
                                                <span className="font-bold">{stats.recordingsThisMonth || 0}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm text-gray-500">Total Study Time</span>
                                                <span className="font-bold">{formatTime(stats.studyTimeThisMonth || 0)}</span>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* Categories */}
                                    <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur">
                                        <CardHeader>
                                            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                                                <Filter className="h-5 w-5 text-pink-600" />
                                                Top Categories
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            {stats.topCategories && stats.topCategories.length > 0 ? (
                                                <ul className="space-y-3">
                                                    {stats.topCategories.map((cat, i) => (
                                                        <li key={i} className="flex justify-between items-center">
                                                            <span className="text-sm font-medium">{cat.category}</span>
                                                            <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">{cat.count}</Badge>
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <div className="text-center py-4 text-gray-500 text-sm">
                                                    No categories yet
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>

                                    {/* AI Usage */}
                                    <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur">
                                        <CardHeader>
                                            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                                                <Bot className="h-5 w-5 text-indigo-600" />
                                                AI Assistant Usage
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="mb-2 flex justify-between text-sm">
                                                <span>AI Usage Rate</span>
                                                <span className="font-bold">{(stats.aiUsageRate || 0).toFixed(0)}%</span>
                                            </div>
                                            <Progress value={stats.aiUsageRate || 0} className="h-2" />
                                            <p className="text-xs text-gray-500 mt-2">
                                                {stats.notesWithAI || 0} notes enhanced with AI
                                            </p>
                                        </CardContent>
                                    </Card>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default Dashboard;