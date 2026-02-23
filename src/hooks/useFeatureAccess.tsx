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
    | 'maxPodcasts' // Added
    | 'canAccessEducator' // Educator portal access

export const useFeatureAccess = () => {
    const {
        subscriptionTier,
        subscriptionLimits,
        checkSubscriptionAccess,
        subscription,
        daysRemaining,
        bonusAiCredits,
        isAdmin,
        isAdminLoading: adminCheckLoading,
    } = useAppContext();

    // Helper to check if feature exists in limits
    const hasFeature = (feature: FeatureName): boolean => {
        return feature in subscriptionLimits;
    };

    // Get limit value safely
    const getLimit = (feature: FeatureName): number | boolean => {
        // Admins have unlimited access
        if (isAdmin) return Infinity;

        if (hasFeature(feature)) {
            const value = subscriptionLimits[feature as keyof typeof subscriptionLimits];
            if (typeof value === 'number') return value;
            if (typeof value === 'boolean') return value;
        }

        return Infinity; // Default to unlimited if feature doesn't exist
    };

    // Check access safely
    const checkAccess = (feature: FeatureName): boolean => {
        // Admins always have access
        if (isAdmin) return true;

        try {
            return checkSubscriptionAccess(feature as any);
        } catch {
            return true; // Default to allowed if check fails
        }
    };

    return {
        // Admin status
        isAdmin,
        adminCheckLoading,

        // Quick access methods - use FeatureName type
        canCreateNotes: () => isAdmin || checkAccess('maxNotes'),
        canUploadDocuments: () => isAdmin || checkAccess('maxDocUploads'),
        canPostSocials: () => isAdmin || subscriptionTier !== 'free', // Scholar+ only
        canPostSocial: () => isAdmin || subscriptionTier !== 'free', // Scholar+ only
        canAccessSocial: () => isAdmin || subscriptionTier !== 'free', // Scholar+ only
        canCreateGroups: () => isAdmin || subscriptionTier !== 'free', // Scholar+ only
        canChat: () => isAdmin || subscriptionTier !== 'free', // Scholar+ only
        hasExamMode: () => isAdmin || checkAccess('hasExamMode'),
        hasVerifiedBadge: () => isAdmin || checkAccess('hasVerifiedBadge'),
        canUseAiChat: () => isAdmin || checkAccess('maxAiMessages'),
        canGenerateQuizzes: () => isAdmin || checkAccess('canGenerateQuizzes'),
        canCreateFolders: () => isAdmin || checkAccess('maxFolders'),
        canScheduleItems: () => isAdmin || checkAccess('maxScheduleItems'),
        canRecordAudio: () => isAdmin || checkAccess('maxRecordings'),
        canUseAdvancedAi: () => isAdmin || subscriptionTier === 'genius',

        // Get limits safely
        maxAiMessages: (getLimit('maxAiMessages') as number) || (isAdmin ? Infinity : 20),
        maxNotes: (getLimit('maxNotes') as number) || (isAdmin ? Infinity : 50),
        maxDocUploads: (getLimit('maxDocUploads') as number) || (isAdmin ? Infinity : 20),
        maxDocuments: (getLimit('maxDocUploads') as number) || (isAdmin ? Infinity : 20), // Alias for consistency
        maxDocSize: isAdmin ? Infinity : (subscriptionLimits.maxDocSize || 10),
        maxRecordings: (getLimit('maxRecordings') as number) || (isAdmin ? Infinity : 10),
        maxFolders: (getLimit('maxFolders') as number) || (isAdmin ? Infinity : 5),
        maxScheduleItems: (getLimit('maxScheduleItems') as number) || (isAdmin ? Infinity : 20),
        maxDailyQuizzes: (getLimit('maxDailyQuizzes') as number) || (isAdmin ? Infinity : (subscriptionTier === 'free' ? 1 : 100)),
        maxChatSessions: (getLimit('maxChatSessions') as number) || (isAdmin ? Infinity : 10),
        maxPodcasts: (getLimit('maxPodcasts') as number) || (isAdmin ? Infinity : 1),

        // Usage tracking helpers
        getUsagePercentage: (feature: FeatureName, currentCount: number) => {
            if (isAdmin) return 0; // Admins don't have usage limits
            const limit = getLimit(feature);
            if (typeof limit !== 'number' || limit === Infinity) return 0;
            return Math.min(100, Math.round((currentCount / limit) * 100));
        },

        // Check if feature is blocked
        isFeatureBlocked: (feature: FeatureName, currentCount: number) => {
            if (isAdmin) return false; // Admins are never blocked
            if (subscriptionTier === 'genius') return false;
            if (feature === 'maxDailyQuizzes') {
                const limit = (getLimit('maxDailyQuizzes') as number) || (subscriptionTier === 'free' ? 1 : 100);
                return currentCount >= limit;
            }
            const limit = getLimit(feature);
            return typeof limit === 'number' && limit !== Infinity && currentCount >= limit;
        },

        // Tier info
        tier: isAdmin ? 'admin' : subscriptionTier,
        isFree: !isAdmin && subscriptionTier === 'free',
        isScholar: !isAdmin && subscriptionTier === 'scholar',
        isGenius: !isAdmin && subscriptionTier === 'genius',

        // Subscription details
        subscription,
        daysRemaining,
        bonusAiCredits,

        // Raw limits for direct access (use with caution)
        subscriptionLimits,

        // Educator-related (access control is handled by EducatorGuard at route level)
        // These are convenience helpers for conditionally showing educator UI
        canAccessEducator: () => isAdmin || subscriptionTier !== 'free',
        canCreateCourses: () => isAdmin || subscriptionTier !== 'free',

    };
};