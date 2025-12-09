// utils/subscriptionChecks.ts
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface SubscriptionCheckOptions {
    feature: string;
    requiredTier?: 'free' | 'scholar' | 'genius';
    currentCount?: number;
    limit?: number;
    showToast?: boolean;
    redirectToUpgrade?: boolean;
}

export const checkSubscriptionAccess = (
    userTier: string,
    options: SubscriptionCheckOptions
): { hasAccess: boolean; message?: string } => {
    const {
        feature,
        requiredTier = 'free',
        currentCount = 0,
        limit = Infinity,
        showToast = true
    } = options;

    const tiers = ['free', 'scholar', 'genius'];
    const userTierIndex = tiers.indexOf(userTier);
    const requiredTierIndex = tiers.indexOf(requiredTier);

    // Check tier access
    if (userTierIndex < requiredTierIndex) {
        const message = `"${feature}" requires ${requiredTier} plan. Upgrade to access this feature.`;
        if (showToast) {
            toast.error(message, {
                action: {
                    label: 'Upgrade',
                    onClick: () => window.location.href = '/subscription'
                },
                duration: 5000
            });
        }
        return { hasAccess: false, message };
    }

    // Check limit
    if (limit !== Infinity && currentCount >= limit) {
        const message = `You've reached your ${feature} limit (${limit}). Upgrade your plan for more.`;
        if (showToast) {
            toast.error(message, {
                action: {
                    label: 'Upgrade',
                    onClick: () => window.location.href = '/subscription'
                },
                duration: 5000
            });
        }
        return { hasAccess: false, message };
    }

    return { hasAccess: true };
};

// Hook version
export const useSubscriptionCheck = () => {
    const navigate = useNavigate();

    return {
        checkFeatureAccess: (options: SubscriptionCheckOptions & { userTier: string }) => {
            const result = checkSubscriptionAccess(options.userTier, options);

            if (!result.hasAccess && options.redirectToUpgrade) {
                navigate('/subscription');
            }

            return result;
        },

        // Quick checks for common features
        canCreateNote: (userTier: string, currentNoteCount: number, noteLimit: number) => {
            return checkSubscriptionAccess(userTier, {
                feature: 'Create Note',
                requiredTier: 'free',
                currentCount: currentNoteCount,
                limit: noteLimit
            });
        },

        canUploadDocument: (userTier: string, currentDocCount: number, docLimit: number) => {
            return checkSubscriptionAccess(userTier, {
                feature: 'Upload Document',
                requiredTier: 'free',
                currentCount: currentDocCount,
                limit: docLimit
            });
        },

        canUseAiChat: (userTier: string, currentMessageCount: number, messageLimit: number) => {
            return checkSubscriptionAccess(userTier, {
                feature: 'AI Chat',
                requiredTier: 'free',
                currentCount: currentMessageCount,
                limit: messageLimit
            });
        },

        canPostToSocial: (userTier: string) => {
            return checkSubscriptionAccess(userTier, {
                feature: 'Social Posts',
                requiredTier: 'scholar'
            });
        },

        canGenerateQuiz: (userTier: string) => {
            return checkSubscriptionAccess(userTier, {
                feature: 'Quiz Generation',
                requiredTier: 'scholar'
            });
        }
    };
};