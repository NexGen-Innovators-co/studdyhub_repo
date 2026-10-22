// components/Dashboard.tsx
import React, { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/components/card';
import { Button } from '../../ui/components/button';
import { Progress } from '../../ui/components/progress';
import { Badge } from '../../ui/components/badge';

import 'react-circular-progressbar/dist/styles.css';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    AreaChart, Area, PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import {
    BookOpen, FileText, MessageCircle, Play,
    Activity, RefreshCw, Filter,
    TrendingUp, Clock, Zap, AlertCircle, Calendar, CheckCircle,
    Clock as ClockIcon, BrainIcon, Bot, Plus
} from 'lucide-react';
import { useDashboardStats } from '../hooks/useDashboardStats';
import ModernPremiumLoader from '../../ui/components/ModernPremiumLoader';
import { SubscriptionGuard } from '../../subscription/components/SubscriptionGuard';
import { RecentPodcasts } from './RecentPodcasts';
// import { EducationWidgets } from '../widgets/EducationWidgets';

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];
const GRADIENT_ID = 'engagementGradient';

interface DashboardProps {
    userProfile: any;
    onNavigateToTab: (tab: string) => void;
    onCreateNew: (type: 'note' | 'recording' | 'document' | 'schedule') => void;
    onNewChatSession: (sourceIds?: string[]) => Promise<string | null>;
    chatSessions: Array<{
        id: string;
        title: string;
        created_at: string;
        updated_at: string;
        last_message_at: string | null;
    }>;
    onChatSessionSelect: (sessionId: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({
    userProfile,
    onNavigateToTab,
    onCreateNew,
    onNewChatSession,
    chatSessions,
    onChatSessionSelect,
}) => {
    const { stats, loading, error, refresh } = useDashboardStats(userProfile?.id);

    // Revalidate counts when the dashboard is visited. Cached stats can be
    // stale after the user creates content elsewhere in the app.
    useEffect(() => {
        if (userProfile?.id) {
            refresh();
        }
    }, [userProfile?.id, refresh]);

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

    // For brand-new users, show a guided “first steps” flow rather than empty stats cards.
    const newUserTasks = [
        {
            key: 'note',
            label: 'Create your first note',
            done: (stats?.totalNotes ?? 0) > 0,
            action: () => onCreateNew('note'),
            icon: BookOpen,
            description: 'Capture ideas, summaries, and course notes in one place.',
        },
        {
            key: 'recording',
            label: 'Record a quick audio note',
            done: (stats?.totalRecordings ?? 0) > 0,
            action: () => onCreateNew('recording'),
            icon: Play,
            description: 'Save verbal explanations, lectures, or brainstorms.',
        },
        {
            key: 'document',
            label: 'Upload a document',
            done: (stats?.totalDocuments ?? 0) > 0,
            action: () => onCreateNew('document'),
            icon: FileText,
            description: 'Upload PDFs, slides, or articles for quick reference.',
        },
        {
            key: 'quiz',
            label: 'Take a quick quiz',
            done: (stats?.totalQuizzesTaken ?? 0) > 0,
            action: () => onNavigateToTab('quizzes'),
            icon: BrainIcon,
            description: 'Test your knowledge and earn points.',
        },
    ];

    const checklistCompleted = newUserTasks.every((t) => t.done);
    // The dashboard is a working surface, not an onboarding checklist. Keep
    // deeper analytics below the material-first home view.
    const showFullDashboard = true;

    const nextTask = newUserTasks.find((t) => !t.done) ?? newUserTasks[0];

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

    type RecentItem = {
        id: string;
        title?: string | null;
        file_name?: string | null;
        kind: 'Document' | 'Note' | 'Recording' | 'Chat session';
        icon: React.ElementType;
        route: string;
        activityAt: string;
    };

    const recentItems: RecentItem[] = [
        ...(stats.recentDocuments || []).map((item: any) => ({
            ...item,
            kind: 'Document' as const,
            icon: FileText,
            route: 'documents',
            activityAt: item.created_at,
        })),
        ...(stats.recentNotes || []).map((item: any) => ({
            ...item,
            kind: 'Note' as const,
            icon: BookOpen,
            route: 'notes',
            activityAt: item.created_at,
        })),
        ...(stats.recentRecordings || []).map((item: any) => ({
            ...item,
            kind: 'Recording' as const,
            icon: Play,
            route: 'recordings',
            activityAt: item.created_at,
        })),
        ...chatSessions.map((session) => ({
            id: session.id,
            title: session.title,
            kind: 'Chat session' as const,
            icon: MessageCircle,
            route: 'chat',
            activityAt: session.last_message_at || session.updated_at || session.created_at,
        })),
    ]
        .sort((a, b) => new Date(b.activityAt).getTime() - new Date(a.activityAt).getTime())
        .slice(0, 6);

    return (
        <div className="min-h-full pb-12 text-slate-900 dark:text-white">
            <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-10">

                <section className="mb-8 overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_16px_45px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-900">
                    <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.2fr_0.8fr] lg:p-10">
                        <div className="flex flex-col justify-between gap-8">
                            <div>
                                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">Your study workspace</p>
                                <h1 className="max-w-xl text-3xl font-semibold tracking-tight text-slate-950 sm:text-5xl dark:text-white">
                                    Turn your sources into understanding.
                                </h1>
                                <p className="mt-4 max-w-lg text-base leading-7 text-slate-500 dark:text-slate-400">
                                    Bring in a note, recording, or document. StuddyHub keeps the material close while you ask, review, and create.
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-3">
                                <Button onClick={() => void onNewChatSession([])} className="h-11 rounded-xl bg-blue-600 px-5 hover:bg-blue-700">
                                    <Plus className="mr-2 h-4 w-4" /> New workspace
                                </Button>
                                <Button onClick={() => onNavigateToTab('chat')} variant="outline" className="h-11 rounded-xl border-slate-300 px-5 dark:border-slate-700">
                                    Ask your library
                                </Button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 self-end sm:grid-cols-4 lg:grid-cols-2">
                            {[
                                { label: 'Upload a source', icon: FileText, action: () => onCreateNew('document') },
                                { label: 'Write a note', icon: BookOpen, action: () => onCreateNew('note') },
                                { label: 'Record an idea', icon: Play, action: () => onCreateNew('recording') },
                                { label: 'Make a quiz', icon: BrainIcon, action: () => onNavigateToTab('quizzes') },
                            ].map(({ label, icon: Icon, action }) => (
                                <button key={label} onClick={action} className="group flex min-h-24 flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-800/70 dark:hover:border-blue-700 dark:hover:bg-blue-950/30">
                                    <Icon className="h-5 w-5 text-slate-500 transition group-hover:text-blue-600 dark:text-slate-400" />
                                    <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="mb-8">
                    <div className="mb-4 flex items-end justify-between">
                        <div>
                            <h2 className="text-xl font-semibold tracking-tight">Recent work</h2>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Sources and chats, ordered by latest activity.</p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => onNavigateToTab('documents')} className="text-blue-600 hover:text-blue-700">View documents</Button>
                    </div>
                    {recentItems.length > 0 ? (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {recentItems.map((item: any) => {
                                const Icon = item.icon;
                                return (
                                    <button
                                        key={`${item.kind}-${item.id}`}
                                        onClick={() => item.kind === 'Chat session' ? onChatSessionSelect(item.id) : onNavigateToTab(item.route)}
                                        className="group min-h-36 rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
                                    >
                                        <div className="flex items-start justify-between">
                                            <span className="rounded-lg bg-blue-50 p-2 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"><Icon className="h-5 w-5" /></span>
                                            <span className="text-xs text-slate-400">{item.kind}</span>
                                        </div>
                                        <h3 className="mt-5 truncate font-semibold text-slate-900 group-hover:text-blue-700 dark:text-white dark:group-hover:text-blue-400">{item.title || item.file_name || 'Untitled'}</h3>
                                        <p className="mt-1 text-xs text-slate-400">{formatDate(item.activityAt)}</p>
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900">
                            <BookOpen className="mx-auto mb-3 h-8 w-8 text-slate-400" />
                            <p className="font-medium">Your recent sources and chats will appear here.</p>
                            <p className="mt-1 text-sm text-slate-500">Start with a source or open a chat workspace.</p>
                        </div>
                    )}
                </section>

            </div>
        </div>
    );
};

export default Dashboard;