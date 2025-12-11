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
import BookPagesAnimation from '../ui/bookloader';
import { SubscriptionGuard } from '../subscription/SubscriptionGuard';

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];
const GRADIENT_ID = 'engagementGradient';

interface DashboardProps {
    userProfile: any;
    onNavigateToTab: (tab: string) => void;
    onCreateNew: (type: 'note' | 'recording' | 'document' | 'schedule') => void;
}

const Dashboard: React.FC<DashboardProps> = ({ userProfile, onNavigateToTab, onCreateNew }) => {
    const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'activity'>('overview');
    const { stats, loading, error, refresh } = useDashboardStats(userProfile?.id);

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

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <BookPagesAnimation size="lg" showText text="Loading your mind palace..." />
                </div>
            </div>
        );
    }

    if (error || !stats) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-2xl shadow-xl">
                    <div className="w-20 h-20 mx-auto mb-4 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
                        <AlertCircle className="h-10 w-10 text-red-600 dark:text-red-400" />
                    </div>
                    <p className="text-red-600 dark:text-red-400 text-lg font-semibold mb-4">{ "An error occured while fetching you data. Check you connection and try again "}</p>
                    <Button onClick={refresh} variant="outline" className="border-red-300">
                        <RefreshCw className="h-4 w-4 mr-2" /> Retry
                    </Button>
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
        <div className="min-h-screen max-w-7xl pb-8 mx-auto px-4 sm:px-6 lg:px-8">
            {/* Hero Header */}
            <div className="relative overflow-hidden rounded-2xl my-4 p-6 sm:p-8 bg-gradient-to-r from-blue-600 to-blue-600 text-white shadow-2xl">
                <div className="absolute inset-0 bg-black opacity-20"></div>
                <div className="relative z-10">
                    <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold mb-2">
                        Welcome back, {userProfile?.full_name?.split(' ')[0] || 'Learner'}!
                    </h1>
                    <p className="text-base sm:text-xl opacity-90">
                        {hasData ? "Your mind is growing stronger every day" : "Let's start building your mind palace"}
                    </p>

                    <div className="flex flex-col sm:flex-row items-center gap-4 mt-6">
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <Flame className={`h-6 w-6 sm:h-8 sm:w-8 ${stats.currentStreak >= 3 ? 'text-orange-400 animate-pulse' : 'text-gray-400'}`} />
                                {stats.currentStreak >= 7 && (
                                    <div className="absolute -inset-2 bg-orange-500 rounded-full animate-ping opacity-20"></div>
                                )}
                            </div>
                            <div>
                                <p className="text-2xl sm:text-3xl font-bold">{stats.currentStreak || 0}</p>
                                <p className="text-xs sm:text-sm opacity-80">day streak (Max: {stats.maxStreak || 0})</p>
                            </div>
                        </div>

                        <div className="w-24 h-24 sm:w-32 sm:h-32">
                            {stats.engagementScore > 0 ? (
                                <CircularProgressbar
                                    value={stats.engagementScore}
                                    text={`${stats.engagementScore}`}
                                    styles={buildStyles({
                                        textSize: '20px',
                                        pathColor: engagementColor,
                                        textColor: '#fff',
                                        trailColor: 'rgba(255,255,255,0.2)',
                                        pathTransitionDuration: 1.5,
                                    })}
                                />
                            ) : (
                                <div className="h-full flex items-center justify-center">
                                    <div className="text-center">
                                        <Brain className="h-8 w-8 mx-auto mb-2 opacity-75" />
                                        <p className="text-sm">Start learning!</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
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
                                className={`flex-1 rounded-xl ${activeTab === tab ? 'shadow-lg' : ''}`}
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
                            {/* Weekly Activity */}
                            <Card className="bg-white/70 dark:bg-gray-800/70 backdrop-blur border-0 shadow-xl">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Activity className="h-6 w-6 text-blue-600" />
                                        Weekly Activity
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {hasChartData(stats.activityData7Days) ? (
                                        <ResponsiveContainer width="100%" height={300}>
                                            <AreaChart data={stats.activityData7Days}>
                                                <defs>
                                                    <linearGradient id="notes" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
                                                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                                <XAxis dataKey="date" />
                                                <YAxis />
                                                <Tooltip />
                                                <Area type="monotone" dataKey="total" stroke="#8b5cf6" fillOpacity={1} fill="url(#notes)" />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <EmptyChartState message="No activity data for this week" icon={BarChart3} />
                                    )}
                                </CardContent>
                            </Card>

                            {/* Monthly Activity */}
                            <Card className="bg-white/70 dark:bg-gray-800/70 backdrop-blur border-0 shadow-xl">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <TrendingUp className="h-6 w-6 text-green-600" />
                                        Monthly Activity
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {hasChartData(stats.activityData30Days) ? (
                                        <ResponsiveContainer width="100%" height={300}>
                                            <LineChart data={stats.activityData30Days}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                                <XAxis dataKey="date" />
                                                <YAxis />
                                                <Tooltip />
                                                <Legend />
                                                <Line type="monotone" dataKey="notes" stroke="#8b5cf6" />
                                                <Line type="monotone" dataKey="recordings" stroke="#10b981" />
                                                <Line type="monotone" dataKey="documents" stroke="#f59e0b" />
                                                <Line type="monotone" dataKey="messages" stroke="#ef4444" />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <EmptyChartState message="No monthly activity data yet" icon={Calendar} />
                                    )}
                                </CardContent>
                            </Card>

                            {/* Note Categories */}
                            <Card className="bg-white/70 dark:bg-gray-800/70 backdrop-blur border-0 shadow-xl">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <PieIcon className="h-6 w-6 text-blue-600" />
                                        Note Categories
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {stats.categoryData && stats.categoryData.length > 0 && hasChartData(stats.categoryData) ? (
                                        <ResponsiveContainer width="100%" height={300}>
                                            <PieChart>
                                                <Pie
                                                    data={stats.categoryData}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={60}
                                                    outerRadius={100}
                                                    paddingAngle={5}
                                                    dataKey="value"
                                                >
                                                    {stats.categoryData.map((_, index) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <EmptyChartState
                                            message="No note categories yet. Create some notes to see them categorized."
                                            icon={FolderOpen}
                                        />
                                    )}
                                </CardContent>
                            </Card>

                            {/* Hourly Activity */}
                            <Card className="bg-white/70 dark:bg-gray-800/70 backdrop-blur border-0 shadow-xl">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <ClockIcon className="h-6 w-6 text-yellow-600" />
                                        Hourly Activity
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {hasChartData(stats.hourlyActivity) ? (
                                        <ResponsiveContainer width="100%" height={300}>
                                            <BarChart data={stats.hourlyActivity}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                                <XAxis dataKey="hour" />
                                                <YAxis />
                                                <Tooltip />
                                                <Bar dataKey="activity" fill="#3b82f6" />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <EmptyChartState message="No hourly activity data recorded" icon={Clock} />
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* Analytics Tab */}
                    {activeTab === 'analytics' && (
                        <div className="space-y-6">
                            {/* Weekday Activity */}
                            <Card className="bg-white/70 dark:bg-gray-800/70 backdrop-blur border-0 shadow-xl">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <BarChart2 className="h-6 w-6 text-orange-600" />
                                        Weekday Activity
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {hasChartData(stats.weekdayActivity) ? (
                                        <ResponsiveContainer width="100%" height={300}>
                                            <BarChart data={stats.weekdayActivity}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                                <XAxis dataKey="day" />
                                                <YAxis />
                                                <Tooltip />
                                                <Bar dataKey="activity" fill="#10b981" />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <EmptyChartState message="No weekday activity pattern detected" icon={BarChart2} />
                                    )}
                                </CardContent>
                            </Card>

                            {/* Learning Velocity */}
                            <Card className="bg-white/70 dark:bg-gray-800/70 backdrop-blur border-0 shadow-xl">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <LineIcon className="h-6 w-6 text-red-600" />
                                        Learning Velocity
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {hasChartData(stats.learningVelocity) ? (
                                        <ResponsiveContainer width="100%" height={300}>
                                            <LineChart data={stats.learningVelocity}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                                <XAxis dataKey="week" />
                                                <YAxis />
                                                <Tooltip />
                                                <Line type="monotone" dataKey="items" stroke="#ef4444" />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <EmptyChartState
                                            message="Track your learning progress over time"
                                            icon={TrendingUp}
                                        />
                                    )}
                                </CardContent>
                            </Card>

                            {/* Productivity Metrics */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                                <Card className="text-center p-4 sm:p-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur">
                                    <Zap className="h-8 w-8 sm:h-12 sm:w-12 mx-auto mb-4 text-yellow-500" />
                                    <p className="text-xl sm:text-3xl font-bold">{stats.mostProductiveDay || '--'}</p>
                                    <p className="text-gray-600 dark:text-gray-400">Most Productive Day</p>
                                </Card>
                                <Card className="text-center p-4 sm:p-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur">
                                    <Clock className="h-8 w-8 sm:h-12 sm:w-12 mx-auto mb-4 text-blue-500" />
                                    <p className="text-xl sm:text-3xl font-bold">{stats.mostProductiveHour || '--'}:00</p>
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

                            {/* This Week / Month Stats */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                                <Card className="p-4 sm:p-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur">
                                    <CardHeader className="p-0">
                                        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                                            <BookOpen className="h-5 w-5 text-blue-600" />
                                            This Week
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-0 mt-2">
                                        <p>Notes: {stats.notesThisWeek || 0}</p>
                                        <p>Recordings: {stats.recordingsThisWeek || 0}</p>
                                        <p>Study Time: {formatTime(stats.studyTimeThisWeek || 0)}</p>
                                    </CardContent>
                                </Card>
                                <Card className="p-4 sm:p-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur">
                                    <CardHeader className="p-0">
                                        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                                            <BookOpen className="h-5 w-5 text-blue-600" />
                                            This Month
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-0 mt-2">
                                        <p>Notes: {stats.notesThisMonth || 0}</p>
                                        <p>Recordings: {stats.recordingsThisMonth || 0}</p>
                                        <p>Study Time: {formatTime(stats.studyTimeThisMonth || 0)}</p>
                                    </CardContent>
                                </Card>
                                <Card className="p-4 sm:p-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur">
                                    <CardHeader className="p-0">
                                        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                                            <Bot className="h-5 w-5 text-indigo-600" />
                                            AI Usage
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-0 mt-2">
                                        <p>Notes with AI: {stats.notesWithAI || 0}</p>
                                        <p>Usage Rate: {(stats.aiUsageRate || 0).toFixed(1)}%</p>
                                        <Progress value={stats.aiUsageRate || 0} className="mt-2" />
                                    </CardContent>
                                </Card>
                                <Card className="p-4 sm:p-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur">
                                    <CardHeader className="p-0">
                                        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                                            <Star className="h-5 w-5 text-yellow-600" />
                                            Quizzes
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-0 mt-2">
                                        <p>Taken: {stats.totalQuizzesTaken || 0}</p>
                                        <p>Avg Score: {(stats.avgQuizScore || 0).toFixed(1)}%</p>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Tasks and Documents */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                                <Card className="p-4 sm:p-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur">
                                    <CardHeader className="p-0">
                                        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                                            <Calendar className="h-5 w-5 text-green-600" />
                                            Tasks
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-0 mt-2">
                                        <p>Today: {stats.todayTasks || 0}</p>
                                        <p>Upcoming: {stats.upcomingTasks || 0}</p>
                                        <p>Completed: {stats.completedTasks || 0}</p>
                                        <p>Overdue: {stats.overdueTasks || 0}</p>
                                    </CardContent>
                                </Card>
                                <Card className="p-4 sm:p-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur">
                                    <CardHeader className="p-0">
                                        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                                            <FileText className="h-5 w-5 text-orange-600" />
                                            Documents
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-0 mt-2">
                                        <p className="flex items-center gap-2"><FileCheck className="h-4 w-4 text-green-500" /> Processed: {stats.documentsProcessed || 0}</p>
                                        <p className="flex items-center gap-2"><FileWarning className="h-4 w-4 text-yellow-500" /> Pending: {stats.documentsPending || 0}</p>
                                        <p className="flex items-center gap-2"><FileX className="h-4 w-4 text-red-500" /> Failed: {stats.documentsFailed || 0}</p>
                                        <p>Total Size: {formatFileSize(stats.totalDocumentSize || 0)}</p>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Top Categories */}
                            {stats.topCategories && stats.topCategories.length > 0 ? (
                                <Card className="p-4 sm:p-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur">
                                    <CardHeader className="p-0">
                                        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                                            <Filter className="h-5 w-5 text-pink-600" />
                                            Top Categories
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-0 mt-2">
                                        <ul className="space-y-2">
                                            {stats.topCategories.map((cat, i) => (
                                                <li key={i} className="flex justify-between">
                                                    <span>{cat.category}</span>
                                                    <Badge variant="secondary">{cat.count}</Badge>
                                                </li>
                                            ))}
                                        </ul>
                                    </CardContent>
                                </Card>
                            ) : (
                                <Card className="p-4 sm:p-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur">
                                    <CardHeader className="p-0">
                                        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                                            <Filter className="h-5 w-5 text-pink-600" />
                                            Top Categories
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-0 mt-2">
                                        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                                            <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                            <p>No categories yet. Add tags to your notes to see them here.</p>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Recent Content */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Recent Notes */}
                                <Card className="bg-white/70 dark:bg-gray-800/70 backdrop-blur border-0 shadow-xl">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <BookOpen className="h-6 w-6 text-blue-600" />
                                            Recent Notes
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        {stats.recentNotes && stats.recentNotes.length > 0 ? (
                                            <ul className="space-y-4">
                                                {stats.recentNotes.map(note => (
                                                    <li key={note.id} className="border-b pb-2">
                                                        <p className="font-semibold">{note.title}</p>
                                                        <p className="text-sm text-gray-600 dark:text-gray-400">{note.category} - {formatDate(note.created_at)}</p>
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <EmptyStateCard
                                                title="No notes yet"
                                                description="Start capturing your thoughts and ideas"
                                                icon={BookOpen}
                                                onCreate={() => onCreateNew('note')}
                                                type="note"
                                            />
                                        )}
                                    </CardContent>
                                </Card>

                                {/* Recent Recordings */}
                                <Card className="bg-white/70 dark:bg-gray-800/70 backdrop-blur border-0 shadow-xl">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Play className="h-6 w-6 text-green-600" />
                                            Recent Recordings
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        {stats.recentRecordings && stats.recentRecordings.length > 0 ? (
                                            <ul className="space-y-4">
                                                {stats.recentRecordings.map(rec => (
                                                    <li key={rec.id} className="border-b pb-2">
                                                        <p className="font-semibold">{rec.title}</p>
                                                        <p className="text-sm text-gray-600 dark:text-gray-400">Duration: {formatTime(rec.duration)} - {formatDate(rec.created_at)}</p>
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <EmptyStateCard
                                                title="No recordings yet"
                                                description="Record your thoughts, lectures, or meetings"
                                                icon={Play}
                                                onCreate={() => onCreateNew('recording')}
                                                type="recording"
                                            />
                                        )}
                                    </CardContent>
                                </Card>

                                {/* Recent Documents */}
                                <Card className="bg-white/70 dark:bg-gray-800/70 backdrop-blur border-0 shadow-xl">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <FileText className="h-6 w-6 text-yellow-600" />
                                            Recent Documents
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        {stats.recentDocuments && stats.recentDocuments.length > 0 ? (
                                            <ul className="space-y-4">
                                                {stats.recentDocuments.map(doc => (
                                                    <li key={doc.id} className="border-b pb-2">
                                                        <p className="font-semibold">{doc.title}</p>
                                                        <p className="text-sm text-gray-600 dark:text-gray-400">{doc.type} - {doc.processing_status} - {formatDate(doc.created_at)}</p>
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <EmptyStateCard
                                                title="No documents yet"
                                                description="Upload PDFs, images, or text files"
                                                icon={FileText}
                                                onCreate={() => onCreateNew('document')}
                                                type="document"
                                            />
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default Dashboard;