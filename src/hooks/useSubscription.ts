// hooks/useSubscription.ts
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

export type PlanType = 'free' | 'scholar' | 'genius';
export type SubscriptionStatus = 'active' | 'cancelled' | 'past_due' | 'expired';

export interface SubscriptionLimits {
  maxAiMessages: number;
  maxNotes: number;
  maxDocUploads: number;
  maxDocuments: number; // Added alias
  maxDocSize: number; // in MB
  canPostSocials: boolean;
  hasExamMode: boolean;
  hasVerifiedBadge: boolean;
  maxChatSessions: number;
  maxRecordings: number; // Added
  maxFolders: number; // Added
  maxScheduleItems: number; // Added
  maxDailyQuizzes: number; // Added
  maxPodcasts: number; // Added
}

export interface Subscription {
  id: string;
  userId: string;
  planType: PlanType;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
  paystackSubCode: string | null;
}

const PLAN_LIMITS: Record<PlanType, SubscriptionLimits> = {
  free: {
    maxAiMessages: 5,
    maxNotes: 3,
    maxDocUploads: 5,
    maxDocuments: 5,
    maxDocSize: 5,
    canPostSocials: false,
    hasExamMode: false,
    hasVerifiedBadge: false,
    maxChatSessions: 5,
    maxRecordings: 3,
    maxFolders: 3,
    maxScheduleItems: 10,
    maxDailyQuizzes: 1,
    maxPodcasts: 1,
  },
  scholar: {
    maxAiMessages: 50,
    maxNotes: Infinity,
    maxDocUploads: 20,
    maxDocuments: 20,
    maxDocSize: 25,
    canPostSocials: true,
    hasExamMode: false,
    hasVerifiedBadge: false,
    maxChatSessions: 20,
    maxRecordings: 20,
    maxFolders: 10,
    maxScheduleItems: 50,
    maxDailyQuizzes: 10,
    maxPodcasts: 5,
  },
  genius: {
    maxAiMessages: Infinity,
    maxNotes: Infinity,
    maxDocUploads: Infinity,
    maxDocuments: Infinity,
    maxDocSize: 100,
    canPostSocials: true,
    hasExamMode: true,
    hasVerifiedBadge: true,
    maxChatSessions: Infinity,
    maxRecordings: Infinity,
    maxFolders: Infinity,
    maxScheduleItems: Infinity,
    maxDailyQuizzes: 100,
    maxPodcasts: Infinity,
  },
};

export interface UseSubscriptionReturn {
  subscription: Subscription | null;
  tier: PlanType;
  limits: SubscriptionLimits;
  daysRemaining: number;
  isLoading: boolean;
  bonusAiCredits: number;
  checkAccess: (feature: keyof SubscriptionLimits) => boolean;
  refreshSubscription: () => Promise<void>;
}

export function useSubscription(): UseSubscriptionReturn {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [bonusAiCredits, setBonusAiCredits] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSubscription = useCallback(async () => {
    if (!user?.id) {
      setSubscription(null);
      setBonusAiCredits(0);
      setIsLoading(false);
      return;
    }

    if (!navigator.onLine) {
      setIsLoading(false);
      return;
    }

    try {
      // Fetch subscription
      const { data: subData, error: subError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (subError && subError.code !== 'PGRST116') {
        //console.error('Error fetching subscription:', subError);
      }

      if (subData) {
        setSubscription({
          id: subData.id,
          userId: subData.user_id,
          planType: subData.plan_type as PlanType,
          status: subData.status as SubscriptionStatus,
          currentPeriodEnd: subData.current_period_end,
          paystackSubCode: subData.paystack_sub_code,
        });
      } else {
        setSubscription(null);
      }

      // Fetch bonus AI credits from profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('bonus_ai_credits')
        .eq('id', user.id)
        .single();

      setBonusAiCredits(profileData?.bonus_ai_credits || 0);
    } catch (error) {
      //console.error('Error in fetchSubscription:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  // Check if subscription is expired
  const isExpired = subscription?.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd) < new Date()
    : false;

  // Determine effective tier
  const tier: PlanType =
    !subscription || subscription.status !== 'active' || isExpired
      ? 'free'
      : subscription.planType;

  const limits = PLAN_LIMITS[tier];

  // Calculate days remaining
  const daysRemaining = subscription?.currentPeriodEnd
    ? Math.max(0, Math.ceil(
      (new Date(subscription.currentPeriodEnd).getTime() - Date.now()) /
      (1000 * 60 * 60 * 24)
    ))
    : 0;

  const checkAccess = useCallback((feature: keyof SubscriptionLimits): boolean => {
    const limit = limits[feature];
    if (typeof limit === 'boolean') return limit;
    if (typeof limit === 'number') return limit > 0;
    return false;
  }, [limits]);

  return {
    subscription,
    tier,
    limits,
    daysRemaining,
    isLoading,
    bonusAiCredits,
    checkAccess,
    refreshSubscription: fetchSubscription,
  };
}