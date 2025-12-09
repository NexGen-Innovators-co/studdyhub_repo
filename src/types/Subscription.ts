// types/index.ts or create types/Subscription.ts
export type PlanType = 'free' | 'scholar' | 'genius';
export type SubscriptionStatus = 'active' | 'cancelled' | 'past_due' | 'expired';

export interface SubscriptionLimits {
    maxAiMessages: number;
    maxNotes: number;
    maxDocUploads: number;
    maxDocSize: number; // in MB
    canPostSocials: boolean;
    hasExamMode: boolean;
    hasVerifiedBadge: boolean;
}

export interface Subscription {
    id: string;
    userId: string;
    planType: PlanType;
    status: SubscriptionStatus;
    currentPeriodEnd: string | null;
    paystackSubCode: string | null;
}