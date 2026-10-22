import React, { useEffect } from 'react';
import { BarChart3, Calendar, Clock, Filter, TrendingUp, Zap, Bot } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/components/card';
import { Progress } from '../../ui/components/progress';
import { Badge } from '../../ui/components/badge';
import { useDashboardStats } from '../hooks/useDashboardStats';
import { CentralDynamicChart } from './CentralDynamicChart';
import { KnowledgeRadar } from './KnowledgeRadar';
import { StudyPatterns } from './StudyPatterns';
import { RecentActivityFeed } from './RecentActivityFeed';
import { DailyProgressWidget } from './DailyProgressWidget';

interface AnalyticsPageProps {
    userProfile: any;
    onCreateNew: (type: 'note' | 'recording' | 'document' | 'schedule') => void;
}

const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
};

export const AnalyticsPage: React.FC<AnalyticsPageProps> = ({ userProfile, onCreateNew }) => {
    const { stats, loading, error, refresh } = useDashboardStats(userProfile?.id);

    useEffect(() => {
        if (userProfile?.id) refresh();
    }, [userProfile?.id, refresh]);

    if (loading && !stats) {
        return <div className="p-8 text-sm text-slate-500">Loading your analytics...</div>;
    }

    if (error || !stats) {
        return (
            <div className="mx-auto max-w-5xl p-8">
                <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                    <p>{error || 'Analytics are unavailable right now.'}</p>
                    <button onClick={() => refresh()} className="mt-4 rounded-lg border border-current px-3 py-2 text-sm">Try again</button>
                </div>
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-[#f7f8fb] pb-12 dark:bg-slate-950">
            <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-10">
                <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                    <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">Private study report</p>
                        <h1 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">Learning analytics</h1>
                        <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500 dark:text-slate-400">Patterns and progress when you need them, kept out of the way while you study.</p>
                    </div>
                    <button onClick={() => refresh()} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">Refresh report</button>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                    <div className="lg:col-span-2"><CentralDynamicChart stats={stats} /></div>
                    <StudyPatterns stats={stats} />
                    <KnowledgeRadar stats={stats} />
                </div>

                <div className="my-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Card><CardContent className="p-5"><Zap className="mb-4 h-6 w-6 text-yellow-500" /><p className="text-2xl font-semibold">{stats.mostProductiveDay || '--'}</p><p className="text-sm text-slate-500">Most productive day</p></CardContent></Card>
                    <Card><CardContent className="p-5"><Clock className="mb-4 h-6 w-6 text-blue-500" /><p className="text-2xl font-semibold">{stats.mostProductiveHour !== undefined ? `${stats.mostProductiveHour}:00` : '--:--'}</p><p className="text-sm text-slate-500">Peak focus hour</p></CardContent></Card>
                    <Card><CardContent className="p-5"><TrendingUp className="mb-4 h-6 w-6 text-green-500" /><p className="text-2xl font-semibold">{stats.avgNotesPerDay || 0}</p><p className="text-sm text-slate-500">Average notes per day</p></CardContent></Card>
                    <Card><CardContent className="p-5"><Clock className="mb-4 h-6 w-6 text-indigo-500" /><p className="text-2xl font-semibold">{formatTime(stats.avgDailyStudyTime || 0)}</p><p className="text-sm text-slate-500">Average daily study</p></CardContent></Card>
                </div>

                <div className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
                    <RecentActivityFeed stats={stats} onCreateNew={onCreateNew} />
                    <div className="space-y-6">
                        <DailyProgressWidget userId={userProfile?.id} onAction={() => onCreateNew('note')} />
                        <Card>
                            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Calendar className="h-4 w-4 text-green-600" />This month</CardTitle></CardHeader>
                            <CardContent className="space-y-3 text-sm">
                                <div className="flex justify-between"><span className="text-slate-500">Notes</span><strong>{stats.notesThisMonth || 0}</strong></div>
                                <div className="flex justify-between"><span className="text-slate-500">Recordings</span><strong>{stats.recordingsThisMonth || 0}</strong></div>
                                <div className="flex justify-between"><span className="text-slate-500">Study time</span><strong>{formatTime(stats.studyTimeThisMonth || 0)}</strong></div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Bot className="h-4 w-4 text-indigo-600" />AI usage</CardTitle></CardHeader>
                            <CardContent><div className="mb-2 flex justify-between text-sm"><span>Notes enhanced</span><strong>{(stats.aiUsageRate || 0).toFixed(0)}%</strong></div><Progress value={stats.aiUsageRate || 0} /><p className="mt-2 text-xs text-slate-500">{stats.notesWithAI || 0} notes enhanced with AI</p></CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </main>
    );
};
