// components/subscription/SubscriptionGuard.tsx
import React, { ReactNode, useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, Zap, Crown, Star, X, AlertTriangle, CheckCircle, InfinityIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { PlanType } from '@/types/Subscription';
import { createPortal } from 'react-dom';

type FeatureName = Parameters<ReturnType<typeof useFeatureAccess>['getUsagePercentage']>[0];

interface SubscriptionGuardProps {
    children: ReactNode;
    feature: string;
    requiredTier?: PlanType;
    currentCount?: number;
    limitFeature?: FeatureName;
    message?: string;
    showUpgradeButton?: boolean;
    className?: string;
}

export const SubscriptionGuard: React.FC<SubscriptionGuardProps> = ({
    children,
    feature,
    requiredTier = 'free',
    currentCount = 0,
    limitFeature,
    message,
    showUpgradeButton = true,
    className = ''
}) => {
    const {
        tier,
        getUsagePercentage,
        isFeatureBlocked,
        maxNotes,
        maxDocUploads,
        maxAiMessages,
        maxRecordings,
        maxFolders,
        maxScheduleItems,
        maxDailyQuizzes,
        maxChatSessions
    } = useFeatureAccess();

    const navigate = useNavigate();
    const [isDismissed, setIsDismissed] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const modalRef = useRef<HTMLDivElement>(null);
    const [modalRoot, setModalRoot] = useState<HTMLElement | null>(null);

    // Create a portal container on mount
    useEffect(() => {
        // Create a div for the modal portal
        const div = document.createElement('div');
        div.id = 'subscription-modal-portal';
        document.body.appendChild(div);
        setModalRoot(div);

        return () => {
            if (document.body.contains(div)) {
                document.body.removeChild(div);
            }
        };
    }, []);

    const tiers = ['free', 'scholar', 'genius'];
    const currentTierIndex = tiers.indexOf(tier);
    const requiredTierIndex = tiers.indexOf(requiredTier);

    // Check if user has access to required tier
    const hasTierAccess = currentTierIndex >= requiredTierIndex;

    // Check if user has hit limit
    const hasHitLimit = limitFeature ? isFeatureBlocked(limitFeature, currentCount) : false;

    // Get limit for display
    const getLimitDisplay = () => {
        if (!limitFeature) return null;

        const limits: Record<FeatureName, number> = {
            maxNotes,
            maxDocUploads,
            maxAiMessages,
            maxRecordings,
            maxFolders,
            maxScheduleItems,
            maxDailyQuizzes,
            maxChatSessions,
            canPostSocials: 0,
            hasExamMode: 0,
            hasVerifiedBadge: 0,
            canGenerateQuizzes: 0,
            canAccessSocial: 0,
            maxDocuments: 0,
            maxDocumentSize: 0
        };

        const limit = limits[limitFeature];
        if (limit === Infinity) return 'Unlimited';
        if (limit === 0) return 'Not Available';
        return `${currentCount}/${limit}`;
    };

    // Get feature icon
    const getFeatureIcon = () => {
        switch (feature.toLowerCase()) {
            case 'ai chat':
            case 'ai messages':
            case 'chat sessions':
                return <Zap className="w-6 h-6" />;
            case 'notes':
                return <Star className="w-6 h-6" />;
            case 'documents':
                return <Lock className="w-6 h-6" />;
            case 'recordings':
            case 'class recordings':
                return <Zap className="w-6 h-6" />;
            case 'folders':
                return <Lock className="w-6 h-6" />;
            case 'schedule':
            case 'schedule items':
                return <Crown className="w-6 h-6" />;
            case 'quizzes':
            case 'daily quizzes':
                return <Star className="w-6 h-6" />;
            case 'social':
            case 'social posts':
                return <Crown className="w-6 h-6" />;
            default:
                return <Crown className="w-6 h-6" />;
        }
    };

    // Get feature color
    const getFeatureColor = () => {
        switch (feature.toLowerCase()) {
            case 'ai chat':
            case 'ai messages':
                return 'from-blue-500 to-purple-500';
            case 'notes':
                return 'from-green-500 to-emerald-500';
            case 'documents':
                return 'from-orange-500 to-red-500';
            case 'recordings':
                return 'from-purple-500 to-pink-500';
            case 'folders':
                return 'from-blue-500 to-cyan-500';
            case 'schedule':
                return 'from-indigo-500 to-blue-500';
            case 'quizzes':
                return 'from-yellow-500 to-orange-500';
            case 'social':
                return 'from-pink-500 to-rose-500';
            default:
                return 'from-amber-500 to-orange-500';
        }
    };

    // Determine if we should block access
    const shouldBlockAccess = !hasTierAccess || hasHitLimit;

    // Determine what to show
    const showLimitWarning = hasHitLimit && limitFeature;
    const showTierWarning = !hasTierAccess;
    const limitPercentage = limitFeature ? getUsagePercentage(limitFeature, currentCount) : 0;

    // Handle click on protected content
    const handleContentClick = (e: React.MouseEvent) => {
        if (shouldBlockAccess && showUpgradeButton) {
            e.preventDefault();
            e.stopPropagation();
            setShowModal(true);
        }
    };

    // Close modal when Escape key is pressed
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && showModal) {
                setShowModal(false);
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [showModal]);

    // Prevent body scroll when modal is open
    useEffect(() => {
        if (showModal) {
            document.body.style.overflow = 'hidden';
            document.body.style.paddingRight = '15px'; // Compensate for scrollbar width
        } else {
            document.body.style.overflow = 'unset';
            document.body.style.paddingRight = '0';
        }

        return () => {
            document.body.style.overflow = 'unset';
            document.body.style.paddingRight = '0';
        };
    }, [showModal]);

    // Focus trap for modal
    useEffect(() => {
        if (showModal && modalRef.current) {
            const focusableElements = modalRef.current.querySelectorAll(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );

            if (focusableElements.length > 0) {
                (focusableElements[0] as HTMLElement).focus();
            }
        }
    }, [showModal]);

    // If user has access and hasn't hit limit, show children normally
    if (!shouldBlockAccess) {
        return <>{children}</>;
    }

    // If dismissed, show the children but disabled/blurred with a lock icon
    if (isDismissed) {
        return (
            <div className={`relative group cursor-not-allowed ${className}`}>
                <div className="opacity-50 blur-[1px] pointer-events-none grayscale">
                    {children}
                </div>
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-lg">
                    <div className="p-2 bg-black/80 backdrop-blur-sm rounded-lg border border-gray-700 shadow-xl">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="bg-black/80 hover:bg-black text-white shadow-lg border border-gray-700"
                            onClick={() => setIsDismissed(false)}
                        >
                            <Lock className="w-3 h-3 mr-2" />
                            Unlock
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    // Modal Component
    const Modal = () => (
        <div
            ref={modalRef}
            className="fixed inset-0 z-[999999] flex items-center justify-center p-4 animate-in fade-in duration-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby="subscription-modal-title"
        >
            {/* Backdrop - This will block all other content */}
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                onClick={() => setShowModal(false)}
                aria-hidden="true"
            />

            {/* Modal Content - Centered */}
            <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
                <Card className="border-2 border-amber-500/50 bg-gradient-to-br from-gray-900 to-gray-950 shadow-2xl">
                    {/* Close Button */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-4 top-4 h-8 w-8 z-10 text-gray-400 hover:text-white hover:bg-gray-800"
                        onClick={() => setShowModal(false)}
                        aria-label="Close modal"
                    >
                        <X className="h-4 w-4" />
                    </Button>

                    <CardHeader className="text-center pb-4 pt-8">
                        <div className="flex justify-center mb-6">
                            <div className={`p-5 rounded-full bg-gradient-to-r ${getFeatureColor()} ring-2 ring-amber-500/30 animate-pulse`}>
                                {getFeatureIcon()}
                            </div>
                        </div>
                        <CardTitle
                            id="subscription-modal-title"
                            className="text-2xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent"
                        >
                            {showTierWarning ? 'Upgrade Required' : 'Limit Reached'}
                        </CardTitle>
                        <CardDescription className="text-gray-400 mt-3 text-base">
                            {message || (
                                showTierWarning
                                    ? `${feature} requires the ${requiredTier} plan.`
                                    : `You've reached your limit for ${feature}.`
                            )}
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-6">
                        {/* Usage Stats */}
                        {showLimitWarning && limitFeature && (
                            <div className="space-y-4 bg-black/30 p-5 rounded-xl border border-gray-800">
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-300 font-medium">Current Usage</span>
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono font-bold text-2xl text-amber-500">
                                            {getLimitDisplay()}
                                        </span>
                                        {limitPercentage >= 90 && (
                                            <AlertTriangle className="h-5 w-5 text-red-500 animate-pulse" />
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-400">Usage Progress</span>
                                        <span className="font-semibold text-amber-400">{limitPercentage}%</span>
                                    </div>
                                    <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden">
                                        <div
                                            className={`h-3 rounded-full transition-all duration-1000 ${limitPercentage >= 90
                                                    ? 'bg-gradient-to-r from-red-500 to-orange-500'
                                                    : limitPercentage >= 70
                                                        ? 'bg-gradient-to-r from-orange-500 to-amber-500'
                                                        : 'bg-gradient-to-r from-amber-500 to-yellow-500'
                                                }`}
                                            style={{ width: `${Math.min(100, limitPercentage)}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Tier Comparison */}
                        {showTierWarning && (
                            <div className="space-y-4 bg-black/30 p-5 rounded-xl border border-gray-800">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-gray-800 rounded-lg">
                                            <Crown className="h-5 w-5 text-gray-400" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-300">Your Plan</p>
                                            <p className="text-sm text-gray-400 capitalize">{tier}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-medium text-gray-300">Required</p>
                                        <p className="text-lg font-bold text-amber-500 capitalize">{requiredTier}</p>
                                    </div>
                                </div>

                                {/* Tier Comparison Bar */}
                                <div className="pt-2">
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-gray-400">Plan Level</span>
                                        <span className="text-amber-400">Upgrade Needed</span>
                                    </div>
                                    <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                                        <div className="flex h-2">
                                            <div
                                                className={`h-full ${tier === 'free' ? 'bg-green-500' :
                                                        tier === 'scholar' ? 'bg-blue-500' :
                                                            'bg-amber-500'
                                                    }`}
                                                style={{ width: `${(currentTierIndex + 1) * 33}%` }}
                                            />
                                            <div
                                                className="h-full bg-gradient-to-r from-amber-500 to-orange-500 animate-pulse"
                                                style={{ width: `${(requiredTierIndex - currentTierIndex) * 33}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Plan Benefits */}
                        <div className="space-y-3 bg-black/20 p-4 rounded-lg border border-gray-800">
                            <p className="text-sm font-medium text-gray-300">Upgrade Benefits:</p>
                            <ul className="space-y-2 text-sm">
                                <li className="flex items-center gap-2 text-gray-400">
                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                    {limitFeature ? 'Higher limits' : 'Full feature access'}
                                </li>
                                <li className="flex items-center gap-2 text-gray-400">
                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                    Priority support
                                </li>
                                <li className="flex items-center gap-2 text-gray-400">
                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                    Advanced AI features
                                </li>
                                {requiredTier === 'genius' && (
                                    <li className="flex items-center gap-2 text-gray-400">
                                        <InfinityIcon className="h-4 w-4 text-purple-500" />
                                        Unlimited everything
                                    </li>
                                )}
                            </ul>
                        </div>

                        {/* Action Buttons */}
                        <div className="pt-2 space-y-3">
                            <Button
                                onClick={() => {
                                    setShowModal(false);
                                    navigate('/subscription');
                                }}
                                className={`w-full py-6 text-lg font-bold shadow-xl shadow-amber-900/30 transition-all duration-300 hover:scale-[1.02] ${requiredTier === 'genius'
                                        ? 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700'
                                        : requiredTier === 'scholar'
                                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'
                                            : 'bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800'
                                    }`}
                            >
                                Upgrade to {requiredTier === 'genius' ? 'Genius' : requiredTier === 'scholar' ? 'Scholar' : 'Premium'}
                            </Button>

                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setIsDismissed(true);
                                        setShowModal(false);
                                    }}
                                    className="flex-1 text-gray-400 hover:text-white border-gray-700 hover:border-gray-600"
                                >
                                    Dismiss
                                </Button>
                                <Button
                                    variant="ghost"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 text-gray-400 hover:text-white"
                                >
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );

    return (
        <>
            {/* Content with overlay */}
            <div
                className={`relative ${className} ${shouldBlockAccess ? 'cursor-pointer' : ''}`}
                onClick={handleContentClick}
            >
                {/* Blurred background content */}
                <div className={`transition-all duration-200 ${shouldBlockAccess ? 'opacity-50 blur-[1px] grayscale pointer-events-none' : ''}`}>
                    {children}
                </div>

                {/* Lock overlay */}
                {shouldBlockAccess && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="p-3 bg-black/80 backdrop-blur-sm rounded-lg border border-gray-700/50 shadow-xl z-[1000]">
                            <Lock className="w-5 h-5 text-gray-300" />
                        </div>
                    </div>
                )}
            </div>

            {/* Render modal using portal at document root */}
            {showModal && modalRoot && createPortal(
                <Modal />,
                modalRoot
            )}
        </>
    );
};