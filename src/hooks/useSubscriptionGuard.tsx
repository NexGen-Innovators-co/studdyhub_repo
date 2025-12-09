
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAppContext } from './useAppContext';
import { PlanType } from './useSubscription';

export const useSubscriptionGuard = (feature: string, requiredTier: PlanType = 'scholar') => {
    const { subscriptionTier, checkSubscriptionAccess, subscriptionLoading } = useAppContext();
    const navigate = useNavigate();

    const checkAccess = (): boolean => {
        if (subscriptionLoading) return false;

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

    return { checkAccess, hasAccess: checkAccess(), tier: subscriptionTier };
};
