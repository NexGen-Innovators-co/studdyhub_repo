// components/subscription/PricingCards.tsx
import { useState } from 'react';
import { Check, Sparkles, Crown, User, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { usePaystackPayment } from 'react-paystack';
import { useAuth } from '@/hooks/useAuth';
import { PlanType } from '@/hooks/useSubscription';
import { useAppContext } from '@/hooks/useAppContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Paystack public key - replace with your actual public key
const PAYSTACK_PUBLIC_KEY = 'pk_live_693d54327546195c15b987f6f2f94c0676904bba';

interface PlanFeature {
  text: string;
  included: boolean;
}

interface PricingPlan {
  id: PlanType;
  name: string;
  price: number;
  currency: string;
  period: string;
  description: string;
  icon: React.ReactNode;
  features: PlanFeature[];
  popular?: boolean;
  paystackPlanCode?: string;
}

const plans: PricingPlan[] = [
  {
    id: 'free',
    name: 'Visitor',
    price: 0,
    currency: 'GHS',
    period: 'forever',
    description: 'Get started with basic features',
    icon: <User className="h-6 w-6" />,
    features: [
      { text: '5 AI messages/day', included: true },
      { text: '3 Notes maximum', included: true },
      { text: '5 Document uploads (5MB max)', included: true },
      { text: '1 Podcast generation', included: true },
      { text: 'Read-only Social Feed', included: true },
      { text: 'Unlimited posting', included: false },
      { text: 'Exam Mode', included: false },
      { text: 'Verified Badge', included: false },
    ],
  },
  {
    id: 'scholar',
    name: 'Scholar',
    price: 20,
    currency: 'GHS',
    period: '/month',
    description: 'Perfect for active learners',
    icon: <Sparkles className="h-6 w-6" />,
    popular: true,
    paystackPlanCode: 'PLN_scholar_monthly',
    features: [
      { text: '50 AI messages/day', included: true },
      { text: 'Unlimited Notes', included: true },
      { text: '20 Document uploads (25MB max)', included: true },
      { text: '5 Podcast generations', included: true },
      { text: 'Full Social Access', included: true },
      { text: 'Unlimited posting', included: true },
      { text: 'Exam Mode', included: false },
      { text: 'Verified Badge', included: false },
    ],
  },
  {
    id: 'genius',
    name: 'Genius',
    price: 50,
    currency: 'GHS',
    period: '/month',
    description: 'Unlock everything',
    icon: <Crown className="h-6 w-6" />,
    paystackPlanCode: 'PLN_genius_monthly',
    features: [
      { text: 'Unlimited AI messages', included: true },
      { text: 'Unlimited Notes', included: true },
      { text: 'Unlimited uploads (100MB max)', included: true },
      { text: 'Unlimited Podcasts', included: true },
      { text: 'Full Social Access', included: true },
      { text: 'Unlimited posting', included: true },
      { text: 'Exam Mode', included: true },
      { text: 'Verified Badge', included: true },
    ],
  },
];

interface PaystackButtonProps {
  plan: PricingPlan;
  email: string;
  onSuccess: (reference: string) => void;
  isLoading: boolean;
}

function PaystackButton({ plan, email, onSuccess, isLoading }: PaystackButtonProps) {
  const config = {
    reference: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    email,
    amount: plan.price * 100, // Paystack uses pesewas
    publicKey: PAYSTACK_PUBLIC_KEY,
    currency: 'GHS',
    channels: ['card', 'mobile_money', 'bank'] as ('card' | 'mobile_money' | 'bank')[],
  };

  const initializePayment = usePaystackPayment(config);

  const handlePayment = () => {
    initializePayment({
      onSuccess: (reference: { reference: string }) => {
        onSuccess(reference.reference);
      },
      onClose: () => {
        toast.info('Payment cancelled');
      },
    });
  };

  return (
    <Button
      onClick={handlePayment}
      className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600"
      variant={plan.popular ? 'default' : 'outline'}
      disabled={isLoading}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
      ) : null}
      Subscribe to {plan.name}
    </Button>
  );
}

export function PricingCards() {
  const { user } = useAuth();
  const { subscriptionTier: tier, refreshSubscription } = useAppContext();
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePaymentSuccess = async (reference: string, planType: PlanType) => {
    if (!user?.id) return;

    setIsProcessing(true);
    try {
      // Update subscription in database
      const { error } = await supabase
        .from('subscriptions')
        .upsert({
          user_id: user.id,
          plan_type: planType,
          status: 'active',
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          paystack_sub_code: reference,
        }, {
          onConflict: 'user_id',
        });

      if (error) throw error;

      toast.success(`Successfully subscribed to ${planType}!`);
      await refreshSubscription();
    } catch (error) {
      // console.error('Error updating subscription:', error);
      toast.error('Failed to activate subscription. Please contact support.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
      {plans.map((plan) => {
        const isCurrentPlan = tier === plan.id;

        return (
          <Card
            key={plan.id}
            className={`relative flex flex-col border-2 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl ${plan.popular
                ? 'border-blue-500 shadow-lg shadow-blue-500/20 bg-gradient-to-b from-blue-50 to-white dark:from-blue-950/30 dark:to-gray-900'
                : 'border-gray-200 dark:border-gray-800'
              } ${isCurrentPlan ? 'ring-2 ring-blue-500 ring-opacity-50' : ''}`}
          >
            {plan.popular && (
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-blue-500 text-white border-0 px-4 py-1 shadow-lg">
                Most Popular
              </Badge>
            )}

            <CardHeader className="text-center pb-4 pt-8">
              <div
                className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${plan.popular
                    ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg'
                    : plan.id === 'genius'
                      ? 'bg-gradient-to-r from-blue-700 to-blue-600 text-white'
                      : 'bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 text-gray-600 dark:text-gray-400'
                  }`}
              >
                {plan.icon}
              </div>

              <CardTitle className="text-2xl font-bold">{plan.name}</CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                {plan.description}
              </CardDescription>

              <div className="mt-6">
                <span className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-blue-500 bg-clip-text text-transparent">
                  {plan.currency} {plan.price}
                </span>
                <span className="text-gray-500 dark:text-gray-400 ml-2">{plan.period}</span>
              </div>
            </CardHeader>

            <CardContent className="flex-1 flex flex-col">
              <ul className="space-y-4 flex-1 mb-8">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <div
                      className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5 ${feature.included
                          ? 'bg-gradient-to-r from-blue-500 to-blue-400 text-white'
                          : 'bg-gray-200 dark:bg-gray-700'
                        }`}
                    >
                      {feature.included && <Check className="h-3 w-3" />}
                    </div>
                    <span
                      className={
                        feature.included
                          ? 'text-gray-800 dark:text-gray-200'
                          : 'text-gray-500 dark:text-gray-500 line-through'
                      }
                    >
                      {feature.text}
                    </span>
                  </li>
                ))}
              </ul>

              {isCurrentPlan ? (
                <Button
                  variant="outline"
                  disabled
                  className="w-full border-blue-300 text-blue-600 dark:text-blue-400"
                >
                  <Check className="h-4 w-4 mr-2" />
                  Current Plan
                </Button>
              ) : plan.id === 'free' ? (
                <Button variant="outline" disabled className="w-full">
                  Free Forever
                </Button>
              ) : user?.email ? (
                <PaystackButton
                  plan={plan}
                  email={user.email}
                  onSuccess={(ref) => handlePaymentSuccess(ref, plan.id)}
                  isLoading={isProcessing}
                />
              ) : (
                <Button variant="outline" className="w-full" disabled>
                  Sign in to Subscribe
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
