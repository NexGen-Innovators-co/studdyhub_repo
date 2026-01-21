
// hooks/useAiMessageTracker.tsx
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useFeatureAccess } from './useFeatureAccess';
import { toast } from 'sonner';
import { PlanType } from '@/types/Subscription';
import { useNavigate, useNavigation } from 'react-router-dom';

export const useAiMessageTracker = () => {
    const { user } = useAuth();
    const { maxAiMessages, isFree } = useFeatureAccess();
    const [messagesToday, setMessagesToday] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const navigate = useNavigate()

    useEffect(() => {
        if (!user?.id || !isFree) {
            setIsLoading(false);
            return;
        }

        if (!navigator.onLine) {
            setIsLoading(false);
            return;
        }

        const fetchTodayMessages = async () => {
            try {
                const today = new Date().toISOString().split('T')[0];
                const { count, error } = await supabase
                    .from('chat_messages')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', user.id)
                    .eq('role', 'assistant')
                    .gte('timestamp', `${today}T00:00:00`)
                    .lte('timestamp', `${today}T23:59:59`);

                if (error) throw error;
                setMessagesToday(count || 0);
            } catch (error) {
                //console.error('Error fetching today messages:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchTodayMessages();

        // Subscribe to realtime changes for assistant messages created today
        const today = new Date().toISOString().split('T')[0];
        const channel = supabase
            .channel('ai_message_tracker')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'chat_messages',
                filter: `user_id=eq.${user.id}`
            }, (payload) => {
                // Only count assistant messages from today
                if (payload.new.role === 'assistant') {
                    const messageDate = new Date(payload.new.timestamp).toISOString().split('T')[0];
                    if (messageDate === today) {
                        setMessagesToday(prev => prev + 1);
                    }
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user?.id, isFree]);

    const canSendMessage = !isFree || messagesToday < maxAiMessages;
    const messagesRemaining = isFree ? Math.max(0, maxAiMessages - messagesToday) : Infinity;

    const checkAiMessageLimit = (): boolean => {
        if (!canSendMessage) {
            toast.error(`Daily AI message limit reached (${maxAiMessages}). Upgrade for unlimited messages.`, {
                action: {
                    label: 'Upgrade',
                    onClick: () => navigate('/subscription')
                },
                duration: 5000
            });
            return false;
        }
        return true;
    };

    // Increment message count immediately when message is sent (for real-time feedback)
    const incrementMessageCount = useCallback(() => {
        setMessagesToday(prev => prev + 1);
    }, []);

    // Decrement if needed (e.g., if message fails to send)
    const decrementMessageCount = useCallback(() => {
        setMessagesToday(prev => Math.max(0, prev - 1));
    }, []);

    // Reset if date changes (midnight UTC)
    useEffect(() => {
        const checkMidnight = () => {
            const now = new Date();
            const tomorrow = new Date(now);
            tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
            tomorrow.setUTCHours(0, 0, 0, 0);

            const timeUntilMidnight = tomorrow.getTime() - now.getTime();

            const timer = setTimeout(() => {
                setMessagesToday(0);
                checkMidnight(); // Reschedule for next midnight
            }, timeUntilMidnight);

            return () => clearTimeout(timer);
        };

        return checkMidnight();
    }, []);

    return {
        messagesToday,
        messagesRemaining,
        canSendMessage,
        isLoading,
        checkAiMessageLimit,
        incrementMessageCount,
        decrementMessageCount,
        limit: maxAiMessages,
    };
};