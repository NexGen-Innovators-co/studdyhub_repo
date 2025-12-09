// hooks/useFeatureAccess.tsx
import { useAppContext } from './useAppContext';

// Define the feature names that should be checked
export type FeatureName =
    | 'maxNotes'
    | 'maxDocUploads'
    | 'maxAiMessages'
    | 'canPostSocials'
    | 'hasExamMode'
    | 'hasVerifiedBadge'
    | 'canGenerateQuizzes'
    | 'canAccessSocial'
    | 'maxRecordings'
    | 'maxFolders'
    | 'maxScheduleItems'
    | 'maxDailyQuizzes'
    | 'maxChatSessions'
    | 'maxDocuments'  // Added
    | 'maxDocumentSize' // Added

export const useFeatureAccess = () => {
    const {
        subscriptionTier,
        subscriptionLimits,
        checkSubscriptionAccess,
        subscription,
        daysRemaining,
        bonusAiCredits
    } = useAppContext();

    // Helper to check if feature exists in limits
    const hasFeature = (feature: FeatureName): boolean => {
        return feature in subscriptionLimits;
    };

    // Get limit value safely
    const getLimit = (feature: FeatureName): number | boolean => {
        if (hasFeature(feature)) {
            const value = subscriptionLimits[feature as keyof typeof subscriptionLimits];
            if (typeof value === 'number') return value;
            if (typeof value === 'boolean') return value;
        }

        return Infinity; // Default to unlimited if feature doesn't exist
    };

    // Check access safely
    const checkAccess = (feature: FeatureName): boolean => {
        try {
            return checkSubscriptionAccess(feature as any);
        } catch {
            return true; // Default to allowed if check fails
        }
    };

    return {
        // Quick access methods - use FeatureName type
        canCreateNotes: () => checkAccess('maxNotes'),
        canUploadDocuments: () => checkAccess('maxDocUploads'),
        canPostSocial: () => checkAccess('canPostSocials'),
        hasExamMode: () => checkAccess('hasExamMode'),
        hasVerifiedBadge: () => checkAccess('hasVerifiedBadge'),
        canUseAiChat: () => checkAccess('maxAiMessages'),
        canGenerateQuizzes: () => checkAccess('canGenerateQuizzes'),
        canAccessSocial: () => checkAccess('canAccessSocial'),
        canCreateFolders: () => checkAccess('maxFolders'),
        canScheduleItems: () => checkAccess('maxScheduleItems'),
        canRecordAudio: () => checkAccess('maxRecordings'),
        canUseAdvancedAi: () => subscriptionTier === 'genius',

        // Get limits safely
        maxAiMessages: (getLimit('maxAiMessages') as number) || 20,
        maxNotes: (getLimit('maxNotes') as number) || 50,
        maxDocUploads: (getLimit('maxDocUploads') as number) || 20,
        maxDocuments: (getLimit('maxDocUploads') as number) || 20, // Alias for consistency
        maxDocSize: subscriptionLimits.maxDocSize || 10,
        maxRecordings: (getLimit('maxRecordings') as number) || 10,
        maxFolders: (getLimit('maxFolders') as number) || 5,
        maxScheduleItems: (getLimit('maxScheduleItems') as number) || 20,
        maxDailyQuizzes: (getLimit('maxDailyQuizzes') as number) || (subscriptionTier === 'free' ? 1 : 100),
        maxChatSessions: (getLimit('maxChatSessions') as number) || 10,

        // Usage tracking helpers
        getUsagePercentage: (feature: FeatureName, currentCount: number) => {
            const limit = getLimit(feature);
            if (typeof limit !== 'number' || limit === Infinity) return 0;
            return Math.min(100, Math.round((currentCount / limit) * 100));
        },

        // Check if feature is blocked
        isFeatureBlocked: (feature: FeatureName, currentCount: number) => {
            if (subscriptionTier === 'genius') return false;
            if (feature === 'maxDailyQuizzes') {
                const limit = (getLimit('maxDailyQuizzes') as number) || (subscriptionTier === 'free' ? 1 : 100);
                return currentCount >= limit;
            }
            const limit = getLimit(feature);
            return typeof limit === 'number' && limit !== Infinity && currentCount >= limit;
        },

        // Tier info
        tier: subscriptionTier,
        isFree: subscriptionTier === 'free',
        isScholar: subscriptionTier === 'scholar',
        isGenius: subscriptionTier === 'genius',

        // Subscription details
        subscription,
        daysRemaining,
        bonusAiCredits,

        // Raw limits for direct access (use with caution)
        subscriptionLimits,

    };
};