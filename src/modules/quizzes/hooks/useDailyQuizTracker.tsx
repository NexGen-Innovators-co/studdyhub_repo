import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export const useDailyQuizTracker = () => {
    const { user } = useAuth();
    const [dailyCounts, setDailyCounts] = useState({
        recording: 0,
        notes: 0,
        ai: 0
    });
    const [loading, setLoading] = useState(true);

    const fetchDailyCounts = async () => {
        if (!user) return;

        if (!navigator.onLine) {
            setLoading(false);
            return;
        }

        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

        try {
            const { data, error } = await supabase
                .from('quizzes')
                .select('source_type')
                .eq('user_id', user.id)
                .gte('created_at', `${today}T00:00:00`)
                .lte('created_at', `${today}T23:59:59`);

            if (error) throw error;

            // Group counts by source_type
            const counts = {
                recording: data.filter(q => q.source_type === 'recording' || !q.source_type).length,
                notes: data.filter(q => q.source_type === 'notes').length,
                ai: data.filter(q => q.source_type === 'ai').length,
            };

            setDailyCounts(counts);
        } catch (err) {
            // console.error('Error fetching daily quiz counts:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDailyCounts();

        if (!navigator.onLine) return;

        // Subscribe to realtime changes to update counts immediately
        const channel = supabase
            .channel('quiz_changes_tracker')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'quizzes' }, () => {
                fetchDailyCounts();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

    return { dailyCounts, loading, refreshCounts: fetchDailyCounts };
};
