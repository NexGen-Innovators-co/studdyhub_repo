import { useState } from 'react';
import { Gift, Crown, Sparkles, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PricingCards } from './PricingCards';
import { ReferralModal } from './ReferralModal';
import { useSubscription } from '@/hooks/useSubscription';
import { useNavigate } from 'react-router-dom';

export function SubscriptionPage() {
  const navigate = useNavigate();
  const { tier, daysRemaining, limits, bonusAiCredits } = useSubscription();
  const [showReferralModal, setShowReferralModal] = useState(false);

  const tierConfig = {
    free: { label: 'Free', icon: null, color: 'bg-muted' },
    scholar: { label: 'Scholar', icon: Sparkles, color: 'bg-blue-500' },
    genius: { label: 'Genius', icon: Crown, color: 'bg-amber-500' },
  };

  const currentTier = tierConfig[tier];
  const TierIcon = currentTier.icon;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-xl font-semibold">Subscription</h1>
            </div>
            <Button 
              variant="outline" 
              onClick={() => setShowReferralModal(true)}
              className="gap-2"
            >
              <Gift className="h-4 w-4" />
              Get Free Premium
            </Button>
          </div>
        </div>
      </div>

      <div className="container max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Current Plan Summary */}
        <Card className="bg-gradient-to-br from-primary/10 via-background to-background border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full ${currentTier.color} flex items-center justify-center`}>
                {TierIcon ? <TierIcon className="h-5 w-5 text-white" /> : null}
              </div>
              <div>
                <span className="text-lg">Current Plan: </span>
                <Badge variant="secondary" className="ml-2 text-base">
                  {currentTier.label}
                </Badge>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-background/50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-primary">
                  {limits.maxAiMessages === Infinity ? '∞' : limits.maxAiMessages}
                </p>
                <p className="text-xs text-muted-foreground">AI Messages/Day</p>
              </div>
              <div className="bg-background/50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-primary">
                  {limits.maxNotes === Infinity ? '∞' : limits.maxNotes}
                </p>
                <p className="text-xs text-muted-foreground">Notes Limit</p>
              </div>
              <div className="bg-background/50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-primary">
                  {bonusAiCredits}
                </p>
                <p className="text-xs text-muted-foreground">Bonus AI Credits</p>
              </div>
              <div className="bg-background/50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-primary">
                  {tier === 'free' ? '—' : daysRemaining}
                </p>
                <p className="text-xs text-muted-foreground">Days Remaining</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pricing Section */}
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold">Choose Your Plan</h2>
            <p className="text-muted-foreground mt-2">
              Unlock more features and study smarter
            </p>
          </div>
          
          <PricingCards />
        </div>

        {/* Features Comparison */}
        <Card>
          <CardHeader>
            <CardTitle>What's included in each plan?</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Feature</th>
                    <th className="text-center py-3 px-4">Visitor</th>
                    <th className="text-center py-3 px-4 bg-primary/5">Scholar</th>
                    <th className="text-center py-3 px-4">Genius</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-3 px-4">AI Messages</td>
                    <td className="text-center py-3 px-4">5/day</td>
                    <td className="text-center py-3 px-4 bg-primary/5">50/day</td>
                    <td className="text-center py-3 px-4">Unlimited</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-3 px-4">Notes</td>
                    <td className="text-center py-3 px-4">3 max</td>
                    <td className="text-center py-3 px-4 bg-primary/5">Unlimited</td>
                    <td className="text-center py-3 px-4">Unlimited</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-3 px-4">Document Uploads</td>
                    <td className="text-center py-3 px-4">5 (5MB)</td>
                    <td className="text-center py-3 px-4 bg-primary/5">20 (25MB)</td>
                    <td className="text-center py-3 px-4">Unlimited (100MB)</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-3 px-4">Social Posting</td>
                    <td className="text-center py-3 px-4">Read-only</td>
                    <td className="text-center py-3 px-4 bg-primary/5">✓</td>
                    <td className="text-center py-3 px-4">✓</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-3 px-4">Exam Mode</td>
                    <td className="text-center py-3 px-4">—</td>
                    <td className="text-center py-3 px-4 bg-primary/5">—</td>
                    <td className="text-center py-3 px-4">✓</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4">Verified Badge</td>
                    <td className="text-center py-3 px-4">—</td>
                    <td className="text-center py-3 px-4 bg-primary/5">—</td>
                    <td className="text-center py-3 px-4">✓</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <ReferralModal open={showReferralModal} onOpenChange={setShowReferralModal} />
    </div>
  );
}
