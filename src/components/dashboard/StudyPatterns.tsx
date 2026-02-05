
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import { Clock, Calendar } from 'lucide-react';
import { DashboardStats } from './hooks/useDashboardStats';

interface StudyPatternsProps {
    stats: DashboardStats;
}

export const StudyPatterns: React.FC<StudyPatternsProps> = ({ stats }) => {
    const hourlyData = stats.hourlyActivity || [];
    const weekdayData = stats.weekdayActivity || [];

    const hasHourlyData = hourlyData.some(d => d.activity > 0);
    const hasWeekdayData = weekdayData.some(d => d.activity > 0);

    const CustomTooltip = ({ active, payload, label, suffix = '' }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border border-gray-200 dark:border-gray-700 p-2 rounded shadow-lg text-xs">
                    <p className="font-semibold">{label}</p>
                    <p className="text-blue-600">{payload[0].value} {suffix}</p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Hourly Activity */}
            <Card className="bg-white/70 dark:bg-gray-800/70 backdrop-blur border-0 shadow-xl">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-blue-600" />
                        Peak Focus Hours
                    </CardTitle>
                    <CardDescription>When you are most active during the day</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-[250px] w-full">
                        {hasHourlyData ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={hourlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" opacity={0.5} />
                                    <XAxis 
                                        dataKey="hour" 
                                        tick={{ fontSize: 10 }} 
                                        tickFormatter={(h) => `${h}:00`}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                                    <Tooltip content={<CustomTooltip suffix="activities" />} />
                                    <Bar dataKey="activity" radius={[4, 4, 0, 0]}>
                                        {hourlyData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.activity > 0 ? '#3b82f6' : '#e5e7eb'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-gray-400">
                                <Clock className="h-10 w-10 opacity-20" />
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Weekday Activity */}
            <Card className="bg-white/70 dark:bg-gray-800/70 backdrop-blur border-0 shadow-xl">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-green-600" />
                        Weekly Habits
                    </CardTitle>
                    <CardDescription>Your consistency across the week</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-[250px] w-full">
                        {hasWeekdayData ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={weekdayData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" opacity={0.5} />
                                    <XAxis dataKey="day" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                                    <Tooltip content={<CustomTooltip suffix="activities" />} />
                                    <Bar dataKey="activity" radius={[4, 4, 0, 0]}>
                                        {weekdayData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.activity > 0 ? '#10b981' : '#e5e7eb'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-gray-400">
                                <Calendar className="h-10 w-10 opacity-20" />
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};
