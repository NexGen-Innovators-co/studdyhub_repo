import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Sparkles, Brain, Target, Zap, TrendingUp, Clock, Lightbulb, RefreshCw, ChevronRight, ChevronLeft } from 'lucide-react';
import { DashboardStats } from './hooks/useDashboardStats';
import { motion, AnimatePresence } from 'framer-motion';
import { generateDashboardInsights } from '../../services/aiServices';

interface AIInsightsProps {
    stats: DashboardStats;
    userName?: string;
    onRefresh?: () => void;
    onAction?: (action: string) => void;
}

interface Insight {
    id: string;
    type: 'productivity' | 'wellness' | 'strategy' | 'achievement';
    title: string;
    message: string;
    icon: React.ElementType;
    color: string;
    action?: string;
}

// Simple Flame icon component locally since it might be missing in older lucide versions or named differently
const FlameIcon = (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.1.2-2.2.6-3a1 1 0 0 0 .9 2.5z" />
    </svg>
);

export const AIInsights: React.FC<AIInsightsProps> = ({ stats, userName, onRefresh, onAction }) => {
    const [insights, setInsights] = useState<Insight[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);

    // Auto-rotate
    useEffect(() => {
        if (insights.length > 1 && !isLoading) {
            const timer = setInterval(() => {
                setCurrentIndex(prev => (prev + 1) % insights.length);
            }, 8000);
            return () => clearInterval(timer);
        }
    }, [insights.length, isLoading]);

    const mapAndSetInsights = (rawInsights: any[]) => {
        const mappedInsights: Insight[] = rawInsights.map((insight, index) => {
            // Map string icon name to component
            let IconComponent: React.ElementType = Sparkles;
            if (insight.iconName) {
                 const name = insight.iconName.toLowerCase();
                 if (name.includes('brain')) IconComponent = Brain;
                 else if (name.includes('target')) IconComponent = Target;
                 else if (name.includes('zap') || name.includes('electricity') || name.includes('energy')) IconComponent = Zap;
                 else if (name.includes('trend') || name.includes('chart') || name.includes('grow')) IconComponent = TrendingUp;
                 else if (name.includes('clock') || name.includes('time')) IconComponent = Clock;
                 else if (name.includes('light') || name.includes('bulb') || name.includes('idea')) IconComponent = Lightbulb;
                 else if (name.includes('flame') || name.includes('fire') || name.includes('hot')) IconComponent = FlameIcon;
                 else if (name.includes('trophy') || name.includes('award')) IconComponent = Target;
                 else if (name.includes('refresh') || name.includes('cycle')) IconComponent = RefreshCw;
            }

            // Map type to color
            let color = 'text-indigo-500'; // default
            if (insight.type === 'success' || insight.type === 'achievement') color = 'text-green-500';
            else if (insight.type === 'warning' || insight.type === 'wellness') color = 'text-yellow-500';
            else if (insight.type === 'error' || insight.type === 'risk') color = 'text-red-500';
            else if (insight.type === 'tip' || insight.type === 'strategy') color = 'text-purple-500';
            else if (insight.type === 'productivity') color = 'text-blue-500';

            return {
                id: `ai-${index}-${Date.now()}`,
                type: insight.type as any,
                title: insight.title,
                message: insight.message,
                icon: IconComponent,
                color: color,
                action: insight.action
            };
        });

        if (mappedInsights.length > 0) {
            setInsights(mappedInsights);
        }
    };

    const generateInsights = async (forceRefresh = false) => {
        if (!stats) return;
        
        const cacheKey = `ai_insights_cache_${userName?.split(' ')[0] || 'user'}`;
        
        // Create a signature of the current stats to detect actual data changes
        // We exclude timestamps or volatile fields so we only refresh when metrics change
        const currentStatsSignature = JSON.stringify({
            notes: stats.totalNotes,
            recordings: stats.totalRecordings,
            docs: stats.totalDocuments,
            quizzes: stats.totalQuizzesTaken,
            time: stats.totalStudyTime
        });

        // Try cache first if not forcing refresh
        if (!forceRefresh) {
            try {
                const cached = localStorage.getItem(cacheKey);
                if (cached) {
                    const { timestamp, data, statsSignature } = JSON.parse(cached);
                    
                    // Check strict validity:
                    // 1. Must be less than 24 hours old (relaxed from 1 hr, since data change is our main trigger now)
                    // 2. Stats signature must match exactly (content hasn't changed)
                    const isRecent = (Date.now() - timestamp) < 24 * 60 * 60 * 1000;
                    const isSameData = statsSignature === currentStatsSignature;
                    
                    if (isRecent && isSameData) {
                        mapAndSetInsights(data);
                        return;
                    }
                }
            } catch (e) {
                console.warn('Failed to parse cached insights', e);
            }
        }

        setIsLoading(true);
        try {
            // Call Supabase Edge Function via service
            const rawInsights = await generateDashboardInsights(stats, { name: userName });
            
            // Save to cache with signature
            try {
                localStorage.setItem(cacheKey, JSON.stringify({
                    timestamp: Date.now(),
                    statsSignature: currentStatsSignature,
                    data: rawInsights
                }));
            } catch (e) {
                console.warn('Failed to save insights to cache', e);
            }

            mapAndSetInsights(rawInsights);

        } catch (err) {
            console.error("Failed to generate AI insights", err);
        } finally {
            setIsLoading(false);
        }

    };

    useEffect(() => {
        if (stats) {
            generateInsights();
        }
    }, [stats.lastFetched]); // Re-run when stats update

    const handleRefresh = (e: React.MouseEvent) => {
        e.stopPropagation();
        generateInsights(true);
    };

    const nextInsight = () => {
        setCurrentIndex((prev) => (prev + 1) % insights.length);
    };

    const prevInsight = () => {
        setCurrentIndex((prev) => (prev - 1 + insights.length) % insights.length);
    };

    if (insights.length === 0 && !isLoading) return null;

    const currentInsight = insights[currentIndex];

    // Default / Card Design
    return (
        <Card className="relative overflow-hidden border-indigo-100 dark:border-indigo-900 bg-gradient-to-br from-white to-indigo-50/50 dark:from-gray-800 dark:to-indigo-950/30">
            {/* Background decorations */}
            <div className="absolute top-0 right-0 p-4 opacity-10">
                <Brain className="w-32 h-32 text-indigo-500" />
            </div>

            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg font-bold flex items-center gap-2 text-indigo-900 dark:text-indigo-100">
                    <Sparkles className="h-5 w-5 text-indigo-500" />
                    AI Learning Insights
                </CardTitle>
                <div className="flex gap-2">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8" 
                        onClick={handleRefresh} 
                        disabled={isLoading}
                        title="Get new insights"
                    >
                        <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </CardHeader>
            
            <CardContent>
                {isLoading ? (
                    <div className="h-24 flex items-center justify-center space-x-2">
                        <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                        <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                        <span className="ml-2 text-sm text-gray-500">Analyzing study patterns...</span>
                    </div>
                ) : currentInsight ? (
                     <div className="relative min-h-[120px]">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={currentInsight.id}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.3 }}
                                className="flex gap-4 items-start"
                            >
                                <div className={`p-3 rounded-xl bg-white dark:bg-gray-800 shadow-sm ${currentInsight.color}`}>
                                    <currentInsight.icon className="h-8 w-8" />
                                </div>
                                <div className="flex-1 space-y-1">
                                    <div className="flex justify-between items-start">
                                        <h4 className="font-semibold text-gray-900 dark:text-white">{currentInsight.title}</h4>
                                        <span className={`text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 ${
                                            currentInsight.type === 'productivity' ? 'text-blue-500' :
                                            currentInsight.type === 'wellness' ? 'text-yellow-500' : 
                                            currentInsight.type === 'achievement' ? 'text-green-500' : 'text-purple-500'
                                        }`}>
                                            {currentInsight.type}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                                        {currentInsight.message.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1')}
                                    </p>
                                    {currentInsight.action && (
                                        <Button 
                                            variant="link" 
                                            className="p-0 h-auto text-indigo-600 dark:text-indigo-400 text-xs font-medium mt-2 flex items-center hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onAction?.(currentInsight.action!);
                                            }}
                                        >
                                            {currentInsight.action} <ChevronRight className="h-3 w-3 ml-1" />
                                        </Button>
                                    )}
                                </div>
                            </motion.div>
                        </AnimatePresence>
                        
                        {insights.length > 1 && (
                            <div className="flex justify-center mt-4 gap-1.5 absolute bottom-0 left-0 right-0 transform translate-y-4">
                                {insights.map((_, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setCurrentIndex(idx)}
                                        className={`w-2 h-2 rounded-full transition-all duration-300 ${
                                            idx === currentIndex 
                                            ? 'bg-indigo-600 w-6' 
                                            : 'bg-indigo-200 dark:bg-indigo-800 hover:bg-indigo-300'
                                        }`}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-center py-6 text-gray-500">
                        <p>Keep studying to generate insights!</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
