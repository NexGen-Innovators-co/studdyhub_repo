
// hooks/useAiMessageTracker.tsx
import { useState, useEffect } from 'react';
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
        if (!user?.id || !isFree) return;

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
                console.error('Error fetching today messages:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchTodayMessages();
    }, [user?.id, isFree]);

    const canSendMessage = !isFree || messagesToday < maxAiMessages;
    const messagesRemaining = isFree ? Math.max(0, maxAiMessages - messagesToday) : Infinity;

    const checkAiMessageLimit = (): boolean => {
        if (!canSendMessage) {
            toast.error(`Daily AI message limit reached (${maxAiMessages}). Upgrade for unlimited messages.`, {
                action: {
                    label: 'Upgrade',
                    onClick: () => navigate('/subscription')
                }
            });
            return false;
        }
        return true;
    };

    return {
        messagesToday,
        messagesRemaining,
        canSendMessage,
        isLoading,
        checkAiMessageLimit,
        limit: maxAiMessages,
    };
};