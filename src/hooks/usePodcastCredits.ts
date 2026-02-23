// hooks/usePodcastCredits.ts — Credit system for AI podcast generation
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { useSubscription, PlanType } from './useSubscription';
import { supabase } from '@/integrations/supabase/client';

// ─── Credit cost per podcast type ───────────────────────────────────────────
export const PODCAST_CREDIT_COSTS: Record<string, number> = {
  'audio': 1,
  'image-audio': 3,
  'video': 10,
  'live-stream': 3, // same as image-audio
};

// ─── Monthly credit allowance by subscription tier ───────────────────────────
export const MONTHLY_CREDIT_GRANTS: Record<PlanType, number> = {
  free: 0,
  scholar: 5,
  genius: 15,
};

export interface CreditPack {
  id: string;
  name: string;
  credits: number;
  price_ghs: number;
  price_display: string;
}

export interface CreditTransaction {
  id: string;
  amount: number;
  balance_after: number;
  transaction_type: string;
  description: string | null;
  reference_id: string | null;
  created_at: string;
}

export interface UsePodcastCreditsReturn {
  balance: number;
  isLoading: boolean;
  /** Can the user afford a podcast of this type? */
  canAfford: (podcastType: string) => boolean;
  /** Get the credit cost for a podcast type */
  getCost: (podcastType: string) => number;
  /** Monthly grant for current tier */
  monthlyGrant: number;
  /** Available credit packs for purchase */
  creditPacks: CreditPack[];
  /** Recent credit transactions */
  transactions: CreditTransaction[];
  /** Refresh balance from DB */
  refreshCredits: () => Promise<void>;
  /** Attempt to claim monthly grant (only works once per calendar month) */
  claimMonthlyGrant: () => Promise<boolean>;
  /** Add credits after a purchase (called after Paystack success) */
  addCreditsFromPurchase: (packId: string, paymentReference: string) => Promise<boolean>;
}

export function usePodcastCredits(): UsePodcastCreditsReturn {
  const { user } = useAuth();
  const { tier } = useSubscription();
  const [balance, setBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [creditPacks, setCreditPacks] = useState<CreditPack[]>([]);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);

  const monthlyGrant = MONTHLY_CREDIT_GRANTS[tier] ?? 0;

  // ─── Fetch credit balance ───────────────────────────────────────────────
  const refreshCredits = useCallback(async () => {
    if (!user?.id) {
      setBalance(0);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('podcast_credits' as any)
        .select('balance')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching podcast credits:', error);
      }

      setBalance((data as any)?.balance ?? 0);
    } catch (err) {
      console.error('Error in refreshCredits:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  // ─── Fetch credit packs (store items) ──────────────────────────────────
  const fetchCreditPacks = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('podcast_credit_packs' as any)
        .select('id, name, credits, price_ghs, price_display')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (!error && data) {
        setCreditPacks(data as any as CreditPack[]);
      }
    } catch (err) {
      console.error('Error fetching credit packs:', err);
    }
  }, []);

  // ─── Fetch recent transactions ─────────────────────────────────────────
  const fetchTransactions = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('podcast_credit_transactions' as any)
        .select('id, amount, balance_after, transaction_type, description, reference_id, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (!error && data) {
        setTransactions(data as any as CreditTransaction[]);
      }
    } catch (err) {
      console.error('Error fetching credit transactions:', err);
    }
  }, [user?.id]);

  // ─── Init: load everything ─────────────────────────────────────────────
  useEffect(() => {
    refreshCredits();
    fetchCreditPacks();
    fetchTransactions();
  }, [refreshCredits, fetchCreditPacks, fetchTransactions]);

  // ─── Helpers ───────────────────────────────────────────────────────────
  const getCost = useCallback((podcastType: string): number => {
    return PODCAST_CREDIT_COSTS[podcastType] ?? 1;
  }, []);

  const canAfford = useCallback((podcastType: string): boolean => {
    return balance >= getCost(podcastType);
  }, [balance, getCost]);

  // ─── Claim monthly grant ───────────────────────────────────────────────
  const claimMonthlyGrant = useCallback(async (): Promise<boolean> => {
    if (!user?.id || monthlyGrant === 0) return false;

    try {
      const { data, error } = await supabase.rpc('grant_monthly_podcast_credits', {
        p_user_id: user.id,
        p_tier: tier,
      });

      if (error) {
        console.error('Error claiming monthly grant:', error);
        return false;
      }

      const result = data as any;
      if (result?.success) {
        setBalance(result.balance);
        await fetchTransactions();
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error in claimMonthlyGrant:', err);
      return false;
    }
  }, [user?.id, tier, monthlyGrant, fetchTransactions]);

  // ─── Add credits from a purchase ──────────────────────────────────────
  const addCreditsFromPurchase = useCallback(async (
    packId: string,
    paymentReference: string
  ): Promise<boolean> => {
    if (!user?.id) return false;

    try {
      // Find the pack to get credit amount
      const pack = creditPacks.find(p => p.id === packId);
      if (!pack) return false;

      const { data, error } = await supabase.rpc('add_podcast_credits', {
        p_user_id: user.id,
        p_amount: pack.credits,
        p_type: 'purchase',
        p_reference_id: paymentReference,
        p_description: `Purchased ${pack.name} (${pack.credits} credits)`,
      });

      if (error) {
        console.error('Error adding purchased credits:', error);
        return false;
      }

      const result = data as any;
      if (result?.success) {
        setBalance(result.balance);
        await fetchTransactions();
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error in addCreditsFromPurchase:', err);
      return false;
    }
  }, [user?.id, creditPacks, fetchTransactions]);

  return {
    balance,
    isLoading,
    canAfford,
    getCost,
    monthlyGrant,
    creditPacks,
    transactions,
    refreshCredits,
    claimMonthlyGrant,
    addCreditsFromPurchase,
  };
}
