// components/subscription/SubscriptionStatusBar.tsx
import React, { useState, useEffect } from 'react';
import { AlertCircle, TrendingUp, Zap, FileText, BookOpen, Users, X, Video } from 'lucide-react';
import { useAppContext } from '@/hooks/useAppContext';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { useAiMessageTracker } from '@/hooks/useAiMessageTracker';
import { useDailyQuizTracker } from '@/hooks/useDailyQuizTracker';
import { useNavigate } from 'react-router-dom';

/**
 * SubscriptionStatusBar Component
 * 
 * A prominent status bar shown at the top of the app for free tier users.
 * Displays all subscription limits and usage to encourage upgrades.
 * Only visible for users on the 'free' plan.
 * Users can dismiss/hide the bar, which is persisted in localStorage.
 * 
 * NOW WITH REAL-TIME USAGE TRACKING:
 * - Notes count updates immediately
 * - Documents count updates immediately
 * - AI messages tracked per day
 * - All values pull from actual data
 */
export const SubscriptionStatusBar: React.FC = () => {
  const { 
    subscriptionTier, 
    subscriptionLimits, 
    notes, 
    documents, 
    recordings,
    scheduleItems,
  } = useAppContext();
  const { isFree } = useFeatureAccess();
  const { messagesToday } = useAiMessageTracker();
  const { quizzesTakenToday } = useDailyQuizTracker();
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(true);

  // Load visibility state from localStorage on mount
  useEffect(() => {
    const savedVisibility = localStorage.getItem('subscriptionStatusBarVisible');
    if (savedVisibility !== null) {
      setIsVisible(JSON.parse(savedVisibility));
    }
  }, []);

  // Handle hide/dismiss
  const handleHide = () => {
    setIsVisible(false);
    localStorage.setItem('subscriptionStatusBarVisible', JSON.stringify(false));
  };

  // Handle show again
  const handleShow = () => {
    setIsVisible(true);
    localStorage.setItem('subscriptionStatusBarVisible', JSON.stringify(true));
  };

  // Only show for free users
  if (!isFree) return null;

  // If hidden, show minimal toggle button in corner
  if (!isVisible) {
    return (
      <button
        onClick={handleShow}
        className="fixed bottom-20 right-4 md:bottom-auto md:top-24 md:right-4 z-10 p-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg shadow-lg transition-colors"
        title="Show subscription status"
      >
        <TrendingUp className="w-5 h-5" />
      </button>
    );
  }

  const limits = [
    {
      icon: <BookOpen className="w-4 h-4" />,
      label: 'Notes',
      current: notes?.length || 0,
      limit: subscriptionLimits.maxNotes,
      color: 'from-blue-500 to-blue-600'
    },
    {
      icon: <FileText className="w-4 h-4" />,
      label: 'Documents',
      current: documents?.length || 0,
      limit: subscriptionLimits.maxDocUploads,
      color: 'from-purple-500 to-purple-600'
    },
    {
      icon: <Zap className="w-4 h-4" />,
      label: 'AI Messages/Day',
      current: messagesToday || 0,
      limit: subscriptionLimits.maxAiMessages,
      color: 'from-yellow-500 to-yellow-600'
    },
    {
      icon: <Video className="w-4 h-4" />,
      label: 'Recordings',
      current: recordings?.length || 0,
      limit: subscriptionLimits.maxRecordings,
      color: 'from-green-500 to-green-600'
    },
    {
      icon: <Users className="w-4 h-4" />,
      label: 'Social Access',
      current: subscriptionLimits.canPostSocials ? 1 : 0,
      limit: 1,
      color: 'from-pink-500 to-pink-600',
      isBoolean: true
    }
  ];

  return (
    <div className="w-full bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-b border-amber-200 dark:border-amber-800 px-4 py-3">
      <div className="max-w-7xl mx-auto">
        {/* Header with close button */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            <span className="font-semibold text-amber-900 dark:text-amber-200">
              Free Plan Active
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/subscription')}
              className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-md transition-colors"
            >
              Upgrade Now
            </button>
            <button
              onClick={handleHide}
              className="p-1 hover:bg-amber-200 dark:hover:bg-amber-900/30 rounded-md transition-colors text-amber-700 dark:text-amber-300"
              title="Hide subscription status bar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Limits Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {limits.map((item, idx) => {
            const percentage = item.limit === Infinity ? 0 : (item.current / item.limit) * 100;
            const isNearLimit = percentage >= 80;
            const isAtLimit = item.current >= item.limit && item.limit !== Infinity;
            
            return (
              <div
                key={idx}
                className={`bg-white dark:bg-gray-800 rounded-lg p-3 border transition-colors ${
                  isAtLimit 
                    ? 'border-red-400 dark:border-red-600' 
                    : isNearLimit 
                    ? 'border-amber-400 dark:border-amber-600' 
                    : 'border-amber-200 dark:border-amber-700'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={`p-1.5 rounded-md bg-gradient-to-br ${item.color} text-white`}>
                    {item.icon}
                  </div>
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    {item.label}
                  </span>
                </div>
                <div className={`text-sm font-bold ${
                  isAtLimit ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'
                }`}>
                  {item.isBoolean ? (
                    item.current ? '✓ Enabled' : '✗ Locked'
                  ) : (
                    `${item.current} / ${item.limit === Infinity ? '∞' : item.limit}`
                  )}
                </div>
                {!item.isBoolean && item.limit !== Infinity && (
                  <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all ${
                        isAtLimit ? 'bg-red-500' : isNearLimit ? 'bg-amber-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Info text */}
        <p className="text-xs text-amber-700 dark:text-amber-300 mt-3">
          <TrendingUp className="w-3 h-3 inline mr-1" />
          Upgrade to Scholar or Genius to unlock unlimited features and advanced AI capabilities.
        </p>
      </div>
    </div>
  );
};
