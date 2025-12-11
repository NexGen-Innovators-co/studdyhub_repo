// components/subscription/UsageIndicator.tsx
import { useFeatureAccess, FeatureName } from '@/hooks/useFeatureAccess';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertCircle, CheckCircle, Zap, FileText, MessageSquare, Folder, Calendar, Volume2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import * as React from 'react';

// Define props interface
interface UsageIndicatorProps {
    feature: FeatureName;
    currentCount: number;
    showIcon?: boolean;
    showLabel?: boolean;
    compact?: boolean;
}

// Custom Progress component with indicator class
const CustomProgress = React.forwardRef<
    HTMLDivElement,
    React.ComponentProps<typeof Progress> & { indicatorClassName?: string }
>(({ indicatorClassName, ...props }, ref) => {
    return (
        <Progress {...props} ref={ref}>
            {indicatorClassName && (
                <Progress className={indicatorClassName} />
            )}
        </Progress>
    );
});
CustomProgress.displayName = 'CustomProgress';

export const UsageIndicator: React.FC<UsageIndicatorProps> = ({
    feature,
    currentCount,
    showIcon = true,
    showLabel = true,
    compact = false
}) => {
    const {
        getUsagePercentage,
        isFeatureBlocked,
        maxNotes,
        maxDocUploads,
        maxAiMessages,
        maxRecordings,
        maxFolders,
        maxScheduleItems,
        tier,
        isFree,
        isAdmin
    } = useFeatureAccess();

    const percentage = getUsagePercentage(feature, currentCount);
    const isBlocked = isFeatureBlocked(feature, currentCount);

    // Get limit based on feature
    const getLimit = () => {
        const limits: Record<FeatureName, number> = {
            maxNotes,
            maxDocUploads,
            maxAiMessages,
            maxRecordings,
            maxFolders,
            maxScheduleItems,
            canPostSocials: 0,
            hasExamMode: 0,
            hasVerifiedBadge: 0,
            canGenerateQuizzes: 0,
            canAccessSocial: 0,
            maxDailyQuizzes: 0,
            maxChatSessions: 0,
            maxDocuments: 0,
            maxDocumentSize: 0
        };
        return limits[feature];
    };

    const limit = getLimit();

    // Get feature details
    const getFeatureDetails = () => {
        const details: Record<FeatureName, { label: string; icon: React.ComponentType<any>; color: string }> = {
            maxNotes: { label: 'Notes', icon: FileText, color: 'blue' },
            maxDocUploads: { label: 'Documents', icon: FileText, color: 'green' },
            maxAiMessages: { label: 'AI Messages', icon: Zap, color: 'purple' },
            maxRecordings: { label: 'Recordings', icon: Volume2, color: 'orange' },
            maxFolders: { label: 'Folders', icon: Folder, color: 'indigo' },
            maxScheduleItems: { label: 'Schedule Items', icon: Calendar, color: 'pink' },
            canPostSocials: { label: 'Social Posts', icon: MessageSquare, color: 'blue' },
            hasExamMode: { label: 'Exam Mode', icon: FileText, color: 'red' },
            hasVerifiedBadge: { label: 'Verified Badge', icon: CheckCircle, color: 'green' },
            canGenerateQuizzes: { label: 'Quiz Generation', icon: FileText, color: 'purple' },
            canAccessSocial: { label: 'Social Access', icon: MessageSquare, color: 'blue' },
            maxDailyQuizzes: { label: 'Daily Quizzes', icon: Zap, color: 'red' },
            maxChatSessions: { label: 'Chat Sessions', icon: MessageSquare, color: 'blue' },
            maxDocuments: { label: 'Documents', icon: FileText, color: 'green' },
            maxDocumentSize: { label: 'Document Size', icon: FileText, color: 'green' }
        };

        return details[feature] || { label: feature, icon: Zap, color: 'gray' };
    };

    const { label, icon: Icon, color } = getFeatureDetails();

    const colorClasses: Record<string, string> = {
        blue: 'bg-blue-500',
        green: 'bg-green-500',
        purple: 'bg-purple-500',
        orange: 'bg-orange-500',
        indigo: 'bg-indigo-500',
        pink: 'bg-pink-500',
        gray: 'bg-gray-500'
    };

    // For features that aren't numeric limits, show different UI
    const isBooleanFeature = [
        'canPostSocials',
        'hasExamMode',
        'hasVerifiedBadge',
        'canGenerateQuizzes',
        'canAccessSocial'
    ].includes(feature);

    if (isBooleanFeature) {
        const hasAccess = isAdmin || limit !== 0;
        return (
            <Badge variant={hasAccess ? "default" : "outline"} className="cursor-default">
                {hasAccess ? '✓ Available' : '✗ Locked'}
            </Badge>
        );
    }

    if (compact) {
        return (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Badge
                            variant={isBlocked ? "destructive" : "outline"}
                            className="cursor-help"
                        >
                            <Icon className="w-3 h-3 mr-1" />
                            {currentCount}{limit !== Infinity ? `/${limit}` : ''}
                        </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>{label} Usage: {currentCount}{limit !== Infinity ? ` of ${limit}` : ' (Unlimited)'}</p>
                        {isBlocked && <p className="text-red-400">Limit reached! Upgrade to continue.</p>}
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    }

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                    {showIcon && <Icon className={`w-4 h-4 text-${color}-400`} />}
                    {showLabel && (
                        <span className="text-sm font-medium">
                            {label}
                            {isFree && limit !== Infinity && ` (${limit} max)`}
                        </span>
                    )}
                </div>
                <div className="flex items-center space-x-2">
                    <span className="text-sm">
                        {currentCount}{limit !== Infinity ? `/${limit}` : ''}
                    </span>
                    {isBlocked ? (
                        <AlertCircle className="w-4 h-4 text-red-500" />
                    ) : percentage > 80 ? (
                        <AlertCircle className="w-4 h-4 text-amber-500" />
                    ) : (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                    )}
                </div>
            </div>

            {limit !== Infinity && (
                <div className="space-y-1">
                    <CustomProgress
                        value={percentage}
                        className={`h-2 ${percentage > 90 ? 'bg-red-500/20' : percentage > 70 ? 'bg-amber-500/20' : 'bg-gray-800'}`}
                        indicatorClassName={percentage > 90 ? 'bg-red-500' : percentage > 70 ? 'bg-amber-500' : colorClasses[color]}
                    />
                    {percentage > 80 && percentage < 100 && (
                        <p className="text-xs text-amber-500">
                            {percentage}% used - {Math.floor(limit - currentCount)} remaining
                        </p>
                    )}
                    {isBlocked && (
                        <p className="text-xs text-red-500">
                            Limit reached! Upgrade your plan for more.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
};