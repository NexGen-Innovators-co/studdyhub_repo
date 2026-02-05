// components/dashboard/RecentActivityFeed.tsx
import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { BookOpen, Play, FileText, Clock, Plus, ArrowRight } from 'lucide-react';
import { formatDate } from '../../lib/utils'; 
interface RecentActivityFeedProps {
    stats: any;
    onCreateNew: (type: 'note' | 'recording' | 'document') => void;
}

export const RecentActivityFeed: React.FC<RecentActivityFeedProps> = ({ stats, onCreateNew }) => {
    
    // Combine and sort activities
    const activities = [
        ...(stats.recentNotes || []).map((n: any) => ({ ...n, type: 'note', originalType: 'note' })),
        ...(stats.recentRecordings || []).map((r: any) => ({ ...r, type: 'recording', originalType: 'recording' })),
        ...(stats.recentDocuments || []).map((d: any) => ({ ...d, type: 'document', originalType: 'document' }))
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 20); // Show top 20 for better history

    const formatTime = (seconds: number) => {
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    };

    const formatActivityTitle = (title: string, type: string) => {
        // Fix for raw filenames showing as titles (e.g. 1770127175871250963222329420958.jpg)
        const isRawFilename = /^\d{10,}\.[a-zA-Z0-9]+$/.test(title);
        
        if (isRawFilename) {
            if (type === 'document') {
                // Extract extension if possible or just say Document
                const ext = title.split('.').pop();
                return `Uploaded Document (${ext?.toUpperCase() || 'FILE'})`;
            }
            return 'Untitled Item';
        }
        return title;
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'note': return BookOpen;
            case 'recording': return Play;
            case 'document': return FileText;
            default: return Clock;
        }
    };

    const getColor = (type: string) => {
        switch (type) {
            case 'note': return 'text-blue-500 bg-blue-100 dark:bg-blue-900/30';
            case 'recording': return 'text-green-500 bg-green-100 dark:bg-green-900/30';
            case 'document': return 'text-orange-500 bg-orange-100 dark:bg-orange-900/30';
            default: return 'text-gray-500 bg-gray-100';
        }
    };

    // Helper to group activities by date
    const groupedActivities = activities.reduce((groups: any, activity) => {
        const date = new Date(activity.created_at);
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        let key = 'Older';
        if (date.toDateString() === today.toDateString()) {
            key = 'Today';
        } else if (date.toDateString() === yesterday.toDateString()) {
            key = 'Yesterday';
        } else if (date > new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)) {
            key = 'This Week';
        } else if (date > new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)) {
            key = 'This Month';
        }

        if (!groups[key]) groups[key] = [];
        groups[key].push(activity);
        return groups;
    }, {});

    const groupOrder = ['Today', 'Yesterday', 'This Week', 'This Month', 'Older'];

    if (activities.length === 0) {
        return (
            <Card className="bg-white/70 dark:bg-gray-800/70 backdrop-blur border-0 shadow-lg h-full">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-gray-500" />
                        Recent Activity
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center py-8 text-center text-gray-500">
                    <Clock className="h-12 w-12 mb-3 opacity-20" />
                    <p>No recent activity found.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="bg-white/70 dark:bg-gray-800/70 backdrop-blur border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-indigo-500" />
                    Activity Timeline
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="relative border-l-2 border-gray-200 dark:border-gray-700 ml-4 space-y-8">
                    {groupOrder.map(group => {
                        const groupItems = groupedActivities[group];
                        if (!groupItems || groupItems.length === 0) return null;

                        return (
                            <div key={group} className="relative">
                                {/* Group Header */}
                                <div className="absolute -left-[21px] flex items-center mb-4">
                                     <div className="w-3 h-3 rounded-full bg-gray-300 dark:bg-gray-600 border-2 border-white dark:border-gray-900" />
                                     <span className="ml-6 text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{group}</span>
                                </div>

                                <div className="pt-8 space-y-4">
                                    {groupItems.map((item: any) => {
                                        const Icon = getIcon(item.type);
                                        const colorClass = getColor(item.type);
                                        
                                        return (
                                            <div key={`${item.type}-${item.id}`} className="ml-6 relative group transition-all duration-200 hover:translate-x-1">
                                                <span className={`absolute flex items-center justify-center w-8 h-8 rounded-full -left-10 ring-4 ring-white dark:ring-gray-900 ${colorClass} shadow-sm z-10`}>
                                                    <Icon className="h-4 w-4" />
                                                </span>
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-white dark:bg-gray-800/50 hover:bg-white/80 dark:hover:bg-gray-800/80 shadow-sm border border-gray-100 dark:border-gray-700/50 hover:shadow-md transition-all">
                                                    <div>
                                                        <h4 className="font-semibold text-gray-900 dark:text-gray-100">{formatActivityTitle(item.title, item.type)}</h4>
                                                        <div className="flex flex-wrap gap-2 mt-1 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                                                            <span className="font-medium">{new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                            {group !== 'Today' && group !== 'Yesterday' && (
                                                                <>
                                                                    <span>•</span>
                                                                    <span>{formatDate(item.created_at)}</span>
                                                                </>
                                                            )}
                                                            <span>•</span>
                                                            <span className="capitalize px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs">{item.type}</span>
                                                            
                                                            {item.type === 'note' && item.category && (
                                                                <><span>•</span><span className="text-blue-500">{item.category}</span></>
                                                            )}
                                                            {item.type === 'recording' && item.duration > 0 && (
                                                                <><span>•</span><span>{formatTime(item.duration)}</span></>
                                                            )}
                                                            {item.type === 'document' && (
                                                                <><span>•</span><span>{item.processing_status || item.type}</span></>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
};
