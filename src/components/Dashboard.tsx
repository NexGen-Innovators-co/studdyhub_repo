import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    LineChart, Line, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import {
    BookOpen, FileText, Calendar, MessageCircle, Users, TrendingUp,
    Clock, Target, Award, Activity, Brain, Zap, BookMarked,
    PlusCircle, Eye, CheckCircle, AlertCircle, Star, Play,
    Download, Upload, Search, Filter, RefreshCw
} from 'lucide-react';
import {
    Note, Document, ScheduleItem, Message, ClassRecording
} from '@/types';
interface DashboardProps {
    notes: Note[];
    recordings: ClassRecording[];
    documents: Document[];
    scheduleItems: ScheduleItem[];
    chatMessages: Message[];
    userProfile: any;
    onNavigateToTab: (tab: string) => void;
    onCreateNew: (type: 'note' | 'recording' | 'document' | 'schedule') => void;
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1', '#d084d0'];
const CHART_COLORS = {
    primary: '#3b82f6',
    secondary: '#10b981',
    accent: '#f59e0b',
    danger: '#ef4444',
    info: '#06b6d4',
    purple: '#8b5cf6'
};

const Dashboard: React.FC<DashboardProps> = ({
    notes = [],
    recordings = [],
    documents = [],
    scheduleItems = [],
    chatMessages = [],
    userProfile,
    onNavigateToTab,
    onCreateNew
}) => {
    const [timeFilter, setTimeFilter] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
    const [selectedMetric, setSelectedMetric] = useState<'activity' | 'productivity' | 'learning'>('activity');
    const [animatedCounts, setAnimatedCounts] = useState({
        notes: 0,
        recordings: 0,
        documents: 0,
        messages: 0
    });

    // Animate counters on mount
    useEffect(() => {
        const targetCounts = {
            notes: notes.length,
            recordings: recordings.length,
            documents: documents.length,
            messages: chatMessages.length
        };

        const duration = 1000; // 1 second
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
    }, [notes.length, recordings.length, documents.length, chatMessages.length]);

    // Filter data based on time
    const filterByTime = (items: any[], dateField: string) => {
        if (timeFilter === 'all') return items;

        const now = new Date();
        const filterDate = new Date();

        switch (timeFilter) {
            case '7d':
                filterDate.setDate(now.getDate() - 7);
                break;
            case '30d':
                filterDate.setDate(now.getDate() - 30);
                break;
            case '90d':
                filterDate.setDate(now.getDate() - 90);
                break;
            default:
                return items;
        }

        return items.filter(item => {
            const itemDate = new Date(item[dateField]);
            return itemDate >= filterDate;
        });
    };

    // Analytics calculations
    const analytics = useMemo(() => {
        const filteredNotes = filterByTime(notes, 'createdAt');
        const filteredRecordings = filterByTime(recordings, 'createdAt');
        const filteredDocuments = filterByTime(documents, 'created_at');
        const filteredMessages = filterByTime(chatMessages, 'timestamp');

        // Activity data for charts
        const last7Days = Array.from({ length: 7 }, (_, i) => {
            const date = new Date();
            date.setDate(date.getDate() - (6 - i));
            return date.toISOString().split('T')[0];
        });

        const activityData = last7Days.map(date => {
            const dayNotes = notes.filter(n => new Date(n.createdAt).toISOString().split('T')[0] === date).length;
            const dayRecordings = recordings.filter(r => new Date(r.createdAt).toISOString().split('T')[0] === date).length;
            const dayDocuments = documents.filter(d => new Date(d.created_at).toISOString().split('T')[0] === date).length;

            return {
                date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                notes: dayNotes,
                recordings: dayRecordings,
                documents: dayDocuments,
                total: dayNotes + dayRecordings + dayDocuments
            };
        });

        // Category distribution
        const categoryData = notes.reduce((acc, note) => {
            acc[note.category] = (acc[note.category] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const categoryChartData = Object.entries(categoryData).map(([name, value]) => ({
            name: name.charAt(0).toUpperCase() + name.slice(1),
            value
        }));

        // Study time from recordings
        const totalStudyTime = recordings.reduce((sum, rec) => sum + (rec.duration || 0), 0);
        const avgStudySession = recordings.length > 0 ? totalStudyTime / recordings.length : 0;

        // Productivity metrics
        const notesWithAI = notes.filter(n => n.aiSummary).length;
        const aiUsageRate = notes.length > 0 ? (notesWithAI / notes.length) * 100 : 0;

        // Learning streaks
        const noteDates = notes.map(n => new Date(n.createdAt).toDateString());
        const uniqueNoteDates = [...new Set(noteDates)].sort();

        let currentStreak = 0;
        let maxStreak = 0;
        let lastDate = null;

        for (const dateStr of uniqueNoteDates.reverse()) {
            const date = new Date(dateStr);
            if (!lastDate || (lastDate.getTime() - date.getTime()) === 24 * 60 * 60 * 1000) {
                currentStreak++;
                maxStreak = Math.max(maxStreak, currentStreak);
            } else {
                currentStreak = 1;
            }
            lastDate = date;
        }

        // Schedule adherence
        const upcomingTasks = scheduleItems.filter(item => new Date(item.startTime) > new Date()).length;
        const todayTasks = scheduleItems.filter(item => {
            const itemDate = new Date(item.startTime);
            const today = new Date();
            return itemDate.toDateString() === today.toDateString();
        }).length;

        return {
            filteredNotes,
            filteredRecordings,
            filteredDocuments,
            filteredMessages,
            activityData,
            categoryChartData,
            totalStudyTime,
            avgStudySession,
            aiUsageRate,
            currentStreak,
            maxStreak,
            upcomingTasks,
            todayTasks
        };
    }, [notes, recordings, documents, chatMessages, scheduleItems, timeFilter]);

    const StatCard = ({ title, value, icon: Icon, trend, color = 'blue', onClick }: any) => (
        <Card
            className={`hover:shadow-md transition-all duration-200 cursor-pointer border-l-4 ${color === 'blue' ? 'border-l-blue-500 hover:bg-blue-50' :
                color === 'green' ? 'border-l-green-500 hover:bg-green-50' :
                    color === 'yellow' ? 'border-l-yellow-500 hover:bg-yellow-50' :
                        color === 'purple' ? 'border-l-purple-500 hover:bg-purple-50' :
                            'border-l-gray-500 hover:bg-gray-50'
                }`}
            onClick={onClick}
        >
            <CardContent className="p-4 dark:bg-slate-800/80">
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
                        <p className="text-2xl font-bold">{value}</p>
                        {trend && (
                            <div className={`flex items-center text-xs ${trend > 0 ? 'text-green-600' : 'text-red-600'
                                }`}>
                                <TrendingUp className="h-3 w-3 mr-1" />
                                {Math.abs(trend)}% vs last period
                            </div>
                        )}
                    </div>
                    <div className={`p-3 rounded-full ${color === 'blue' ? 'bg-blue-100 text-blue-600' :
                        color === 'green' ? 'bg-green-100 text-green-600' :
                            color === 'yellow' ? 'bg-yellow-100 text-yellow-600' :
                                color === 'purple' ? 'bg-purple-100 text-purple-600' :
                                    'bg-gray-100 text-gray-600'
                        }`}>
                        <Icon className="h-6 w-6" />
                    </div>
                </div>
            </CardContent>
        </Card>
    );

    const QuickAction = ({ title, description, icon: Icon, onClick, color = 'blue ' }: any) => (
        <Card className="hover:shadow-md transition-all duration-200 cursor-pointer dark:bg-slate-800/80" onClick={onClick}>
            <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${color === 'blue' ? 'bg-blue-100 text-blue-600' :
                        color === 'green' ? 'bg-green-100 text-green-600' :
                            color === 'yellow' ? 'bg-yellow-100 text-yellow-600' :
                                color === 'purple' ? 'bg-purple-100 text-purple-600' :
                                    'bg-gray-100 text-gray-600'
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

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 ">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                        Welcome back, {userProfile?.full_name || 'Student'}! 👋
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                        Here's what's happening with your learning today
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
                    <Button variant="outline" size="sm">
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Overview Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Total Notes"
                    value={animatedCounts.notes}
                    icon={BookOpen}
                    color="blue"
                    onClick={() => onNavigateToTab('notes')}
                />
                <StatCard
                    title="Recordings"
                    value={animatedCounts.recordings}
                    icon={Play}
                    color="green"
                    onClick={() => onNavigateToTab('recordings')}
                />
                <StatCard
                    title="Documents"
                    value={animatedCounts.documents}
                    icon={FileText}
                    color="yellow"
                    onClick={() => onNavigateToTab('documents')}
                />
                <StatCard
                    title="AI Conversations"
                    value={animatedCounts.messages}
                    icon={MessageCircle}
                    color="purple"
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
                <TabsList className="grid w-full grid-cols-3">
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
                </TabsList>

                <TabsContent value="activity" className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Activity Chart */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Daily Activity</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={300}>
                                    <AreaChart data={analytics.activityData}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="date" />
                                        <YAxis />
                                        <Tooltip />
                                        <Area
                                            type="monotone"
                                            dataKey="total"
                                            stackId="1"
                                            stroke={CHART_COLORS.primary}
                                            fill={`${CHART_COLORS.primary}20`}
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
                                            data={analytics.categoryChartData}
                                            cx="50%"
                                            cy="50%"
                                            labelLine={false}
                                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                            outerRadius={80}
                                            fill="#8884d8"
                                            dataKey="value"
                                        >
                                            {analytics.categoryChartData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="productivity" className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Study Time</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span>Total Hours</span>
                                        <span className="font-bold">{Math.round(analytics.totalStudyTime / 3600)}h</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span>Avg Session</span>
                                        <span className="font-bold">{Math.round(analytics.avgStudySession / 60)}min</span>
                                    </div>
                                    <Progress value={(analytics.totalStudyTime / 36000) * 100} className="w-full" />
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>AI Usage</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="text-center">
                                        <div className="text-3xl font-bold text-blue-600">{analytics.aiUsageRate.toFixed(0)}%</div>
                                        <p className="text-sm text-gray-600">Notes with AI summaries</p>
                                    </div>
                                    <Progress value={analytics.aiUsageRate} className="w-full" />
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Today's Schedule</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="h-4 w-4 text-blue-500" />
                                        <span className="text-sm">Tasks Today: {analytics.todayTasks}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Clock className="h-4 w-4 text-green-500" />
                                        <span className="text-sm">Upcoming: {analytics.upcomingTasks}</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="learning" className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Learning Streak</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-center space-y-4">
                                    <div className="flex items-center justify-center gap-2">
                                        <Award className="h-8 w-8 text-yellow-500" />
                                        <span className="text-4xl font-bold text-blue-600">{analytics.currentStreak}</span>
                                    </div>
                                    <p className="text-gray-600">Days in a row</p>
                                    <div className="text-sm text-gray-500">
                                        Best streak: {analytics.maxStreak} days 🎉
                                    </div>
                                    <Progress value={(analytics.currentStreak / Math.max(analytics.maxStreak, 1)) * 100} className="w-full" />
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Learning Progress</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <BookMarked className="h-4 w-4 text-blue-500" />
                                            <span className="text-sm">Notes Created</span>
                                        </div>
                                        <Badge variant="secondary" className="text-xs">{analytics.filteredNotes.length}</Badge>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Play className="h-4 w-4 text-green-500" />
                                            <span className="text-sm">Sessions Recorded</span>
                                        </div>
                                        <Badge variant="secondary" className="text-xs">{analytics.filteredRecordings.length}</Badge>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <FileText className="h-4 w-4 text-yellow-500" />
                                            <span className="text-sm">Documents Added</span>
                                        </div>
                                        <Badge variant="secondary" className="text-xs">{analytics.filteredDocuments.length}</Badge>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <MessageCircle className="h-4 w-4 text-purple-500" />
                                            <span className="text-sm">AI Interactions</span>
                                        </div>
                                        <Badge variant="secondary" className="text-xs">{analytics.filteredMessages.length}</Badge>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>

            {/* Recent Activity & Insights */}
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
                        <div className="space-y-3">
                            {notes.slice(0, 5).map((note) => (
                                <div key={note.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
                                    <div className="p-1 bg-blue-100 dark:bg-blue-900 rounded">
                                        <BookOpen className="h-4 w-4 text-blue-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{note.title}</p>
                                        <p className="text-xs text-gray-500">
                                            {new Date(note.createdAt).toLocaleDateString()} • {note.category}
                                        </p>
                                    </div>
                                    <Badge variant="outline" className="text-xs">{note.category}</Badge>
                                </div>
                            ))}

                            {recordings.slice(0, 3).map((recording) => (
                                <div key={recording.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
                                    <div className="p-1 bg-green-100 dark:bg-green-900 rounded">
                                        <Play className="h-4 w-4 text-green-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{recording.title}</p>
                                        <p className="text-xs text-gray-500">
                                            {new Date(recording.createdAt).toLocaleDateString()} • {Math.round(recording.duration / 60)}min
                                        </p>
                                    </div>
                                    <Badge variant="outline" className="text-xs">Recording</Badge>
                                </div>
                            ))}

                            {analytics.filteredNotes.length === 0 && analytics.filteredRecordings.length === 0 && (
                                <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                                    <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                    <p>No recent activity</p>
                                    <p className="text-xs">Start by creating a note or recording!</p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* AI Insights */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Brain className="h-5 w-5" />
                            AI Insights & Tips
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {analytics.aiUsageRate < 30 && (
                                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                                    <div className="flex items-start gap-2">
                                        <Star className="h-4 w-4 text-blue-600 mt-0.5" />
                                        <div>
                                            <p className="text-sm font-medium text-blue-800 dark:text-blue-200">Boost Your Learning</p>
                                            <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">
                                                Try using AI summaries for your notes to improve retention and understanding.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {analytics.currentStreak === 0 && (
                                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                                    <div className="flex items-start gap-2">
                                        <Target className="h-4 w-4 text-yellow-600 mt-0.5" />
                                        <div>
                                            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Build Consistency</p>
                                            <p className="text-xs text-yellow-600 dark:text-yellow-300 mt-1">
                                                Start your learning streak by creating a note today!
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {analytics.todayTasks === 0 && (
                                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                                    <div className="flex items-start gap-2">
                                        <Calendar className="h-4 w-4 text-green-600 mt-0.5" />
                                        <div>
                                            <p className="text-sm font-medium text-green-800 dark:text-green-200">Plan Your Day</p>
                                            <p className="text-xs text-green-600 dark:text-green-300 mt-1">
                                                Add some study sessions to your schedule to stay organized.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {recordings.length > 0 && notes.length > 0 && (
                                <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                                    <div className="flex items-start gap-2">
                                        <Zap className="h-4 w-4 text-purple-600 mt-0.5" />
                                        <div>
                                            <p className="text-sm font-medium text-purple-800 dark:text-purple-200">Great Progress!</p>
                                            <p className="text-xs text-purple-600 dark:text-purple-300 mt-1">
                                                You're actively using multiple learning methods. Keep it up!
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Achievement badges */}
                            <div className="flex flex-wrap gap-2 mt-4">
                                {notes.length >= 10 && <Badge variant="secondary" className="text-xs">📚 Note Taker</Badge>}
                                {recordings.length >= 5 && <Badge variant="secondary" className="text-xs">🎤 Voice Learner</Badge>}
                                {analytics.currentStreak >= 7 && <Badge variant="secondary" className="text-xs">🔥 Week Warrior</Badge>}
                                {analytics.currentStreak >= 30 && <Badge variant="secondary" className="text-xs">💪 Month Master</Badge>}
                                {analytics.aiUsageRate >= 70 && <Badge variant="secondary" className="text-xs">🤖 AI Explorer</Badge>}
                                {documents.length >= 10 && <Badge variant="secondary" className="text-xs">📁 Resource Collector</Badge>}
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
                                <span className="text-gray-500">{Math.min(notes.length, 7)}/7</span>
                            </div>
                            <Progress value={(Math.min(notes.length, 7) / 7) * 100} className="h-2" />
                            <p className="text-xs text-gray-500">Create 7 notes this week</p>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span>Study Hours</span>
                                <span className="text-gray-500">{Math.min(Math.round(analytics.totalStudyTime / 3600), 20)}/20</span>
                            </div>
                            <Progress value={(Math.min(Math.round(analytics.totalStudyTime / 3600), 20) / 20) * 100} className="h-2" />
                            <p className="text-xs text-gray-500">Record 20 hours of study</p>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span>AI Interactions</span>
                                <span className="text-gray-500">{Math.min(chatMessages.length, 50)}/50</span>
                            </div>
                            <Progress value={(Math.min(chatMessages.length, 50) / 50) * 100} className="h-2" />
                            <p className="text-xs text-gray-500">Engage with AI tutor</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Footer Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div className="space-y-1">
                    <p className="text-2xl font-bold text-blue-600">{Math.round(analytics.totalStudyTime / 3600)}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Hours Studied</p>
                </div>
                <div className="space-y-1">
                    <p className="text-2xl font-bold text-green-600">{analytics.currentStreak}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Day Streak</p>
                </div>
                <div className="space-y-1">
                    <p className="text-2xl font-bold text-purple-600">{chatMessages.filter(m => m.role === 'user').length}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Questions Asked</p>
                </div>
                <div className="space-y-1">
                    <p className="text-2xl font-bold text-yellow-600">{Math.round(analytics.aiUsageRate)}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">AI Usage %</p>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
