
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAppContext } from './useAppContext';
import { PlanType } from './useSubscription';
import { useState, useEffect } from 'react';
import { supabase } from '../integrations/supabase/client';

export const useSubscriptionGuard = (feature: string, requiredTier: PlanType = 'scholar') => {
    const { subscriptionTier, checkSubscriptionAccess, subscriptionLoading, user } = useAppContext();
    const navigate = useNavigate();
    const [isAdmin, setIsAdmin] = useState(false);
    const [adminCheckDone, setAdminCheckDone] = useState(false);

    // Check if user is an admin
    useEffect(() => {
        const checkAdminStatus = async () => {
            if (!user) {
                setIsAdmin(false);
                setAdminCheckDone(true);
                return;
            }

            try {
                const { data, error } = await supabase
                    .from('admin_users')
                    .select('id, is_active')
                    .eq('user_id', user.id)
                    .eq('is_active', true)
                    .maybeSingle();

                setIsAdmin(!error && !!data);
            } catch {
                setIsAdmin(false);
            } finally {
                setAdminCheckDone(true);
            }
        };

        checkAdminStatus();
    }, [user]);

    const checkAccess = (): boolean => {
        // Admins always have access
        if (isAdmin) return true;

        // During loading, don't block but don't show error either
        if (subscriptionLoading || !adminCheckDone) return true;

        const tiers = ['free', 'scholar', 'genius'];
        const currentTierIndex = tiers.indexOf(subscriptionTier);
        const requiredTierIndex = tiers.indexOf(requiredTier);

        if (currentTierIndex < requiredTierIndex) {
            toast.error(`"${feature}" requires ${requiredTier} plan.`, {
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

    // Compute hasAccess without showing toast
    const computeAccess = (): boolean => {
        // Admins always have access
        if (isAdmin) return true;

        // During loading, optimistically allow access
        if (subscriptionLoading || !adminCheckDone) return true;

        const tiers = ['free', 'scholar', 'genius'];
        const currentTierIndex = tiers.indexOf(subscriptionTier);
        const requiredTierIndex = tiers.indexOf(requiredTier);

        return currentTierIndex >= requiredTierIndex;
    };

    return { 
        checkAccess, 
        hasAccess: computeAccess(), 
        tier: isAdmin ? 'admin' : subscriptionTier,
        isAdmin,
        adminCheckDone
    };
};
