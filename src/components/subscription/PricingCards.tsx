import { useState } from 'react';
import { Check, Sparkles, Crown, User, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { usePaystackPayment } from 'react-paystack';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription, PlanType } from '@/hooks/useSubscription';
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
      className="w-full"
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
  const { tier, refreshSubscription } = useSubscription();
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
      console.error('Error updating subscription:', error);
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
            className={`relative flex flex-col ${plan.popular
                ? 'border-primary shadow-lg shadow-primary/20'
                : 'border-border'
              }`}
          >
            {plan.popular && (
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary">
                Most Popular
              </Badge>
            )}

            <CardHeader className="text-center pb-4">
              <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 ${plan.popular
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
                }`}>
                {plan.icon}
              </div>

              <CardTitle className="text-xl">{plan.name}</CardTitle>
              <CardDescription>{plan.description}</CardDescription>

              <div className="mt-4">
                <span className="text-4xl font-bold">{plan.currency} {plan.price}</span>
                <span className="text-muted-foreground">{plan.period}</span>
              </div>
            </CardHeader>

            <CardContent className="flex-1 flex flex-col">
              <ul className="space-y-3 flex-1 mb-6">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-center gap-3">
                    <Check
                      className={`h-4 w-4 flex-shrink-0 ${feature.included
                          ? 'text-green-500'
                          : 'text-muted-foreground/30'
                        }`}
                    />
                    <span className={feature.included ? '' : 'text-muted-foreground/50 line-through'}>
                      {feature.text}
                    </span>
                  </li>
                ))}
              </ul>

              {isCurrentPlan ? (
                <Button variant="secondary" disabled className="w-full">
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
