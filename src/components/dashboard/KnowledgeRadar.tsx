
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip } from 'recharts';
import { Brain, Filter } from 'lucide-react';
import { DashboardStats } from './hooks/useDashboardStats';

interface KnowledgeRadarProps {
    stats: DashboardStats;
}

export const KnowledgeRadar: React.FC<KnowledgeRadarProps> = ({ stats }) => {
    const data = stats.categoryData || [];
    const hasData = data.length > 0;

    // Limit to top 6 categories for cleaner radar
    const radarData = data.slice(0, 6);

    return (
        <Card className="bg-white/70 dark:bg-gray-800/70 backdrop-blur border-0 shadow-xl h-full">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5 text-purple-600" />
                    Knowledge Balance
                </CardTitle>
                <CardDescription>
                    Distribution of your notes across subjects
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="h-[300px] w-full">
                    {hasData ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                                <PolarGrid stroke="#e5e7eb" />
                                <PolarAngleAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 12 }} />
                                <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={false} axisLine={false} />
                                <Radar
                                    name="Notes"
                                    dataKey="value"
                                    stroke="#8b5cf6"
                                    fill="#8b5cf6"
                                    fillOpacity={0.4}
                                />
                                <Tooltip 
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                            </RadarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400">
                            <Filter className="h-12 w-12 opacity-20 mb-2" />
                            <p>No category data available</p>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};
