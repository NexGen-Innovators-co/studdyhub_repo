
import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    LineChart, Line, BarChart, Bar, Legend
} from 'recharts';
import {
    Activity, Calendar, TrendingUp, BarChart2,
    BookOpen, Play, FileText, Brain, MessageCircle, MoreHorizontal
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel
} from '../ui/dropdown-menu';
import { DashboardStats } from './hooks/useDashboardStats';

interface CentralDynamicChartProps {
    stats: DashboardStats;
}

type TimeRange = 'week' | 'month-daily' | 'year-monthly';
type ChartType = 'area' | 'line' | 'bar';

const COLORS = {
    notes: '#8b5cf6',      // Purple
    recordings: '#10b981', // Emerald
    documents: '#f59e0b',  // Amber
    messages: '#ef4444',   // Red
    quizzes: '#3b82f6',    // Blue
    total: '#6366f1'       // Indigo
};

export const CentralDynamicChart: React.FC<CentralDynamicChartProps> = ({ stats }) => {
    const [timeRange, setTimeRange] = useState<TimeRange>('week');
    const [chartType, setChartType] = useState<ChartType>('area');
    const [visibleMetrics, setVisibleMetrics] = useState<Record<string, boolean>>({
        notes: true,
        recordings: true,
        documents: false,
        messages: false,
        quizzes: true,
        total: false
    });

    // Prepare data based on selected range
    const chartData = useMemo(() => {
        if (!stats) return [];
        switch (timeRange) {
            case 'week':
                // last 7 days from 30 days data or specific 7 days data
                // stats.activityData7Days is specifically 7 days
                return stats.activityData7Days || [];
            case 'month-daily':
                return stats.activityData30Days || [];
            case 'year-monthly':
                return stats.activityHistory || [];
            default:
                return [];
        }
    }, [stats, timeRange]);

    const toggleMetric = (metric: string) => {
        setVisibleMetrics(prev => ({
            ...prev,
            [metric]: !prev[metric]
        }));
    };

    const hasData = chartData && chartData.length > 0 && chartData.some((d: any) =>
        Object.keys(visibleMetrics).some(k => visibleMetrics[k] && d[k] > 0)
    );

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border border-gray-200 dark:border-gray-700 p-3 rounded-xl shadow-xl text-xs">
                    <p className="font-bold mb-2 text-gray-700 dark:text-gray-300">{label}</p>
                    {payload.map((entry: any, index: number) => (
                        <div key={index} className="flex items-center gap-2 mb-1">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                            <span className="capitalize text-gray-500 dark:text-gray-400">{entry.name}:</span>
                            <span className="font-mono font-medium">{entry.value}</span>
                        </div>
                    ))}
                </div>
            );
        }
        return null;
    };

    // Render Chart Component
    const renderChart = () => {
        const commonProps = {
            data: chartData,
            margin: { top: 10, right: 10, left: -20, bottom: 0 }
        };

        if (chartType === 'area') {
            return (
                <AreaChart {...commonProps}>
                    <defs>
                        {Object.entries(COLORS).map(([key, color]) => (
                            <linearGradient key={key} id={`color-${key}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={color} stopOpacity={0} />
                            </linearGradient>
                        ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" opacity={0.5} />
                    <XAxis 
                        dataKey={timeRange === 'year-monthly' ? 'period' : 'date'} 
                        tick={{ fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                        minTickGap={20}
                    />
                    <YAxis 
                        tick={{ fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    
                    {visibleMetrics.total && <Area type="monotone" dataKey="total" stroke={COLORS.total} fill={`url(#color-total)`} strokeWidth={2} activeDot={{ r: 4 }} />}
                    {visibleMetrics.notes && <Area type="monotone" dataKey="notes" stroke={COLORS.notes} fill={`url(#color-notes)`} strokeWidth={2} />}
                    {visibleMetrics.recordings && <Area type="monotone" dataKey="recordings" stroke={COLORS.recordings} fill={`url(#color-recordings)`} strokeWidth={2} />}
                    {visibleMetrics.documents && <Area type="monotone" dataKey="documents" stroke={COLORS.documents} fill={`url(#color-documents)`} strokeWidth={2} />}
                    {visibleMetrics.quizzes && <Area type="monotone" dataKey="quizzes" stroke={COLORS.quizzes} fill={`url(#color-quizzes)`} strokeWidth={2} />}
                    {visibleMetrics.messages && <Area type="monotone" dataKey="messages" stroke={COLORS.messages} fill={`url(#color-messages)`} strokeWidth={2} />}
                </AreaChart>
            );
        }

        if (chartType === 'bar') {
            return (
                <BarChart {...commonProps}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" opacity={0.5} />
                    <XAxis 
                        dataKey={timeRange === 'year-monthly' ? 'period' : 'date'} 
                        tick={{ fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                    />
                    <YAxis 
                        tick={{ fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    {visibleMetrics.total && <Bar dataKey="total" fill={COLORS.total} radius={[4, 4, 0, 0]} />}
                    {visibleMetrics.notes && <Bar dataKey="notes" fill={COLORS.notes} radius={[4, 4, 0, 0]} />}
                    {visibleMetrics.recordings && <Bar dataKey="recordings" fill={COLORS.recordings} radius={[4, 4, 0, 0]} />}
                    {visibleMetrics.documents && <Bar dataKey="documents" fill={COLORS.documents} radius={[4, 4, 0, 0]} />}
                    {visibleMetrics.quizzes && <Bar dataKey="quizzes" fill={COLORS.quizzes} radius={[4, 4, 0, 0]} />}
                    {visibleMetrics.messages && <Bar dataKey="messages" fill={COLORS.messages} radius={[4, 4, 0, 0]} />}
                </BarChart>
            );
        }

        return (
            <LineChart {...commonProps}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" opacity={0.5} />
                <XAxis 
                    dataKey={timeRange === 'year-monthly' ? 'period' : 'date'} 
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                />
                <YAxis 
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                
                {visibleMetrics.total && <Line type="monotone" dataKey="total" stroke={COLORS.total} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />}
                {visibleMetrics.notes && <Line type="monotone" dataKey="notes" stroke={COLORS.notes} strokeWidth={2} dot={{ r: 3 }} />}
                {visibleMetrics.recordings && <Line type="monotone" dataKey="recordings" stroke={COLORS.recordings} strokeWidth={2} dot={{ r: 3 }} />}
                {visibleMetrics.documents && <Line type="monotone" dataKey="documents" stroke={COLORS.documents} strokeWidth={2} dot={{ r: 3 }} />}
                {visibleMetrics.quizzes && <Line type="monotone" dataKey="quizzes" stroke={COLORS.quizzes} strokeWidth={2} dot={{ r: 3 }} />}
                {visibleMetrics.messages && <Line type="monotone" dataKey="messages" stroke={COLORS.messages} strokeWidth={2} dot={{ r: 3 }} />}
            </LineChart>
        );
    };

    return (
        <Card className="bg-white/70 dark:bg-gray-800/70 backdrop-blur border-0 shadow-xl overflow-hidden transition-all duration-300 hover:shadow-2xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <div className="space-y-1">
                    <CardTitle className="text-xl font-bold flex items-center gap-2">
                        <Activity className="h-5 w-5 text-indigo-500" />
                        Learning Analytics
                    </CardTitle>
                    <CardDescription>
                        Track your progress and activity over time
                    </CardDescription>
                </div>
                
                <div className="flex items-center gap-2">
                     {/* Time Range Selector */}
                     <div className="flex bg-gray-100 dark:bg-gray-700/50 rounded-lg p-1">
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setTimeRange('week')}
                            className={`h-7 px-3 text-xs rounded-md ${timeRange === 'week' ? 'bg-white dark:bg-gray-600 shadow-sm' : 'text-gray-500'}`}
                        >
                            Week
                        </Button>
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setTimeRange('month-daily')}
                            className={`h-7 px-3 text-xs rounded-md ${timeRange === 'month-daily' ? 'bg-white dark:bg-gray-600 shadow-sm' : 'text-gray-500'}`}
                        >
                            30 Days
                        </Button>
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setTimeRange('year-monthly')}
                            className={`h-7 px-3 text-xs rounded-md ${timeRange === 'year-monthly' ? 'bg-white dark:bg-gray-600 shadow-sm' : 'text-gray-500'}`}
                        >
                            Year
                        </Button>
                    </div>

                    {/* Settings Dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuLabel>Chart Type</DropdownMenuLabel>
                            <div className="flex p-2 gap-2">
                                <Button 
                                    variant={chartType === 'area' ? 'default' : 'outline'} 
                                    size="sm" 
                                    className="flex-1 h-8"
                                    onClick={() => setChartType('area')}
                                >
                                    <TrendingUp className="h-4 w-4" />
                                </Button>
                                <Button 
                                    variant={chartType === 'line' ? 'default' : 'outline'} 
                                    size="sm" 
                                    className="flex-1 h-8"
                                    onClick={() => setChartType('line')}
                                >
                                    <Activity className="h-4 w-4" />
                                </Button>
                                <Button 
                                    variant={chartType === 'bar' ? 'default' : 'outline'} 
                                    size="sm" 
                                    className="flex-1 h-8"
                                    onClick={() => setChartType('bar')}
                                >
                                    <BarChart2 className="h-4 w-4" />
                                </Button>
                            </div>
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel>Metrics</DropdownMenuLabel>
                            <DropdownMenuItem onClick={(e) => { e.preventDefault(); toggleMetric('notes'); }}>
                                <div className={`w-4 h-4 mr-2 rounded border flex items-center justify-center ${visibleMetrics.notes ? 'bg-purple-500 border-purple-500 text-white' : 'border-gray-400'}`}>
                                    {visibleMetrics.notes && <BookOpen className="h-3 w-3" />}
                                </div>
                                <span className={visibleMetrics.notes ? 'font-medium' : 'text-gray-500'}>Notes</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { e.preventDefault(); toggleMetric('recordings'); }}>
                                <div className={`w-4 h-4 mr-2 rounded border flex items-center justify-center ${visibleMetrics.recordings ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-400'}`}>
                                    {visibleMetrics.recordings && <Play className="h-3 w-3" />}
                                </div>
                                <span className={visibleMetrics.recordings ? 'font-medium' : 'text-gray-500'}>Recordings</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { e.preventDefault(); toggleMetric('quizzes'); }}>
                                <div className={`w-4 h-4 mr-2 rounded border flex items-center justify-center ${visibleMetrics.quizzes ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-400'}`}>
                                    {visibleMetrics.quizzes && <Brain className="h-3 w-3" />}
                                </div>
                                <span className={visibleMetrics.quizzes ? 'font-medium' : 'text-gray-500'}>Quizzes</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { e.preventDefault(); toggleMetric('documents'); }}>
                                <div className={`w-4 h-4 mr-2 rounded border flex items-center justify-center ${visibleMetrics.documents ? 'bg-amber-500 border-amber-500 text-white' : 'border-gray-400'}`}>
                                    {visibleMetrics.documents && <FileText className="h-3 w-3" />}
                                </div>
                                <span className={visibleMetrics.documents ? 'font-medium' : 'text-gray-500'}>Documents</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { e.preventDefault(); toggleMetric('messages'); }}>
                                <div className={`w-4 h-4 mr-2 rounded border flex items-center justify-center ${visibleMetrics.messages ? 'bg-red-500 border-red-500 text-white' : 'border-gray-400'}`}>
                                    {visibleMetrics.messages && <MessageCircle className="h-3 w-3" />}
                                </div>
                                <span className={visibleMetrics.messages ? 'font-medium' : 'text-gray-500'}>AI Chat</span>
                            </DropdownMenuItem>
                             <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={(e) => { e.preventDefault(); toggleMetric('total'); }}>
                                <div className={`w-4 h-4 mr-2 rounded border flex items-center justify-center ${visibleMetrics.total ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-gray-400'}`}>
                                    {visibleMetrics.total && <Activity className="h-3 w-3" />}
                                </div>
                                <span className={visibleMetrics.total ? 'font-medium' : 'text-gray-500'}>Total Activity</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </CardHeader>
            <CardContent>
                <div className="h-[300px] w-full mt-4">
                    {hasData ? (
                        <ResponsiveContainer width="100%" height="100%">
                            {renderChart()}
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400">
                            <BarChart2 className="h-12 w-12 opacity-20 mb-2" />
                            <p>No activity data for this period</p>
                        </div>
                    )}
                </div>
                
                {/* Summary Legend */}
                {hasData && (
                    <div className="flex flex-wrap gap-4 mt-6 justify-center">
                         {visibleMetrics.notes && (
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-purple-500" />
                                <span className="text-sm font-medium">Notes: {chartData.reduce((acc: any, curr: any) => acc + (curr.notes || 0), 0)}</span>
                            </div>
                         )}
                         {visibleMetrics.recordings && (
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                                <span className="text-sm font-medium">Recordings: {chartData.reduce((acc: any, curr: any) => acc + (curr.recordings || 0), 0)}</span>
                            </div>
                         )}
                         {visibleMetrics.quizzes && (
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-blue-500" />
                                <span className="text-sm font-medium">Quizzes: {chartData.reduce((acc: any, curr: any) => acc + (curr.quizzes || 0), 0)}</span>
                            </div>
                         )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
