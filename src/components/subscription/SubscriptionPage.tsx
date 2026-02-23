// pages/SubscriptionPage.tsx
import { useState } from 'react';
import { Gift, Crown, Sparkles, ArrowLeft, Zap, BookOpen, FileText, Users, Shield, Target, Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PricingCards } from '@/components/subscription/PricingCards';
import { ReferralModal } from '@/components/subscription/ReferralModal';
import { PodcastCreditStore } from '@/components/subscription/PodcastCreditStore';
import { useAppContext } from '@/hooks/useAppContext';
import { useNavigate } from 'react-router-dom';

export function SubscriptionPage() {
  const navigate = useNavigate();
  const { subscriptionTier: tier, daysRemaining, subscriptionLimits: limits, bonusAiCredits } = useAppContext();
  const [showReferralModal, setShowReferralModal] = useState(false);

  const tierConfig = {
    free: {
      label: 'Visitor',
      icon: null,
      color: 'bg-gradient-to-r from-gray-400 to-gray-500',
      textColor: 'text-gray-700 dark:text-gray-300'
    },
    scholar: {
      label: 'Scholar',
      icon: Sparkles,
      color: 'bg-gradient-to-r from-blue-500 to-blue-600',
      textColor: 'text-blue-600 dark:text-blue-400'
    },
    genius: {
      label: 'Genius',
      icon: Crown,
      color: 'bg-gradient-to-r from-blue-700 to-blue-800',
      textColor: 'text-blue-700 dark:text-blue-300'
    },
  };

  const currentTier = tierConfig[tier];
  const TierIcon = currentTier.icon;

  const featureCards = [
    {
      icon: <Zap className="h-6 w-6 text-blue-500" />,
      title: "AI-Powered Learning",
      description: "Smart assistance for studying and content creation"
    },
    {
      icon: <BookOpen className="h-6 w-6 text-blue-500" />,
      title: "Unlimited Notes",
      description: "Create, organize, and review your study materials"
    },
    {
      icon: <FileText className="h-6 w-6 text-blue-500" />,
      title: "Document Processing",
      description: "Upload and extract content from any document"
    },
    {
      icon: <Users className="h-6 w-6 text-blue-500" />,
      title: "Social Learning",
      description: "Connect, share, and learn with others"
    },
    {
      icon: <Shield className="h-6 w-6 text-blue-500" />,
      title: "Exam Mode",
      description: "Full-screen, timed quizzes with anti-cheat and 1.5x XP"
    },
    {
      icon: <Target className="h-6 w-6 text-blue-500" />,
      title: "Verified Badge",
      description: "Stand out as a serious learner"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50/30 to-white dark:from-gray-900 dark:to-gray-950">
      {/* Header */}
      <div className="border-b border-blue-100 dark:border-blue-900/30 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container max-w-6xl mx-auto px-4 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(-1)}
                className="rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/30"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-500 bg-clip-text text-transparent">
                  Upgrade Your Learning
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Unlock premium features for smarter studying
                </p>
              </div>
            </div>
            <Button
              onClick={() => setShowReferralModal(true)}
              className="gap-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white shadow-lg"
            >
              <Gift className="h-4 w-4" />
              Get Free Premium
            </Button>
          </div>
        </div>
      </div>

      <div className="container max-w-6xl mx-auto px-4 py-8 space-y-12">
        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto">
          <Badge className="mb-4 bg-gradient-to-r from-blue-500 to-blue-400 text-white border-0 px-4 py-1">
            ✨ Premium Features
          </Badge>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Learn <span className="bg-gradient-to-r from-blue-600 to-blue-500 bg-clip-text text-transparent">Smarter</span>,
            Not <span className="text-gray-400">Harder</span>
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Join thousands of students who are studying smarter with AI-powered tools,
            unlimited resources, and a supportive learning community.
          </p>
        </div>

        {/* Current Plan Summary */}
        <Card className="bg-gradient-to-br from-blue-500/5 via-white to-blue-500/5 dark:from-blue-900/20 dark:via-gray-900 dark:to-blue-900/20 border-blue-200 dark:border-blue-800 shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-full ${currentTier.color} flex items-center justify-center shadow-lg`}>
                {TierIcon ? <TierIcon className="h-6 w-6 text-white" /> : <Brain className="h-6 w-6 text-white" />}
              </div>
              <div>
                <span className="text-xl text-gray-600 dark:text-gray-300">Current Plan</span>
                <div className="flex items-center gap-3 mt-1">
                  <Badge className={`text-lg px-4 py-1.5 ${currentTier.textColor} bg-white dark:bg-gray-800 border ${currentTier.textColor.replace('text-', 'border-')}/30`}>
                    {currentTier.label}
                  </Badge>
                  {tier !== 'free' && daysRemaining > 0 && (
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Renews in {daysRemaining} days
                    </span>
                  )}
                </div>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="bg-white/50 dark:bg-gray-800/50 rounded-xl p-4 text-center border border-blue-100 dark:border-blue-900/30">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gradient-to-r from-blue-500 to-blue-400 flex items-center justify-center">
                  <Zap className="h-6 w-6 text-white" />
                </div>
                <p className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-500 bg-clip-text text-transparent">
                  {limits.maxAiMessages === Infinity ? '∞' : limits.maxAiMessages}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">AI Messages/Day</p>
              </div>
              <div className="bg-white/50 dark:bg-gray-800/50 rounded-xl p-4 text-center border border-blue-100 dark:border-blue-900/30">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gradient-to-r from-blue-500 to-blue-400 flex items-center justify-center">
                  <BookOpen className="h-6 w-6 text-white" />
                </div>
                <p className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-500 bg-clip-text text-transparent">
                  {limits.maxNotes === Infinity ? '∞' : limits.maxNotes}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Notes Limit</p>
              </div>
              <div className="bg-white/50 dark:bg-gray-800/50 rounded-xl p-4 text-center border border-blue-100 dark:border-blue-900/30">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gradient-to-r from-blue-500 to-blue-400 flex items-center justify-center">
                  <Gift className="h-6 w-6 text-white" />
                </div>
                <p className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-500 bg-clip-text text-transparent">
                  {bonusAiCredits}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Bonus AI Credits</p>
              </div>
              <div className="bg-white/50 dark:bg-gray-800/50 rounded-xl p-4 text-center border border-blue-100 dark:border-blue-900/30">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gradient-to-r from-blue-500 to-blue-400 flex items-center justify-center">
                  <Target className="h-6 w-6 text-white" />
                </div>
                <p className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-500 bg-clip-text text-transparent">
                  {tier === 'free' ? '—' : daysRemaining}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Days Remaining</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Podcast Credits Section */}
        <div className="space-y-6">
          <div className="text-center">
            <Badge className="mb-4 bg-gradient-to-r from-amber-500 to-yellow-400 text-white border-0 px-4 py-1">
              🎙️ AI Podcast Credits
            </Badge>
            <h2 className="text-3xl font-bold mb-2">Podcast Generation Credits</h2>
            <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Generate AI podcasts with audio, images, and video. Purchase credit packs or earn monthly credits with your subscription.
            </p>
          </div>
          <PodcastCreditStore />
        </div>

        {/* Features Grid */}
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-3xl font-bold mb-2">Everything You Need to Succeed</h2>
            <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Premium features designed to enhance your learning experience
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featureCards.map((feature, index) => (
              <Card
                key={index}
                className="border-blue-100 dark:border-blue-900/30 hover:border-blue-300 dark:hover:border-blue-700 transition-all duration-300 hover:shadow-lg"
              >
                <CardContent className="p-6">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mb-4">
                    {feature.icon}
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Pricing Section */}
        <div className="space-y-8">
          <div className="text-center">
            <Badge className="mb-4 bg-gradient-to-r from-blue-500 to-blue-400 text-white border-0 px-4 py-1">
              💎 Simple Pricing
            </Badge>
            <h2 className="text-3xl font-bold mb-3">Choose Your Perfect Plan</h2>
            <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Start free, upgrade anytime. Cancel anytime. No hidden fees.
            </p>
          </div>

          <PricingCards />
        </div>

        {/* FAQ Section */}
        <Card className="border-blue-100 dark:border-blue-900/30">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Frequently Asked Questions</CardTitle>
            <CardDescription>Get answers to common questions about subscriptions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="border-b border-blue-100 dark:border-blue-900/30 pb-4">
                <h4 className="font-semibold mb-2">Can I switch plans anytime?</h4>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately.
                </p>
              </div>
              <div className="border-b border-blue-100 dark:border-blue-900/30 pb-4">
                <h4 className="font-semibold mb-2">What payment methods do you accept?</h4>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  We accept all major credit/debit cards, mobile money (MTN, Vodafone), and bank transfers via Paystack.
                </p>
              </div>
              <div className="border-b border-blue-100 dark:border-blue-900/30 pb-4">
                <h4 className="font-semibold mb-2">Is there a free trial for premium features?</h4>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  All plans start with a free Visitor tier. You can try Scholar or Genius features risk-free for 7 days.
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">How do referrals work?</h4>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Invite friends to StuddyHub and earn free premium days. Both you and your friend get rewards!
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CTA Section */}
        <div className="text-center py-12">
          <div className="bg-gradient-to-r from-blue-600/10 to-blue-500/10 dark:from-blue-900/30 dark:to-blue-800/30 rounded-2xl p-8 border border-blue-200 dark:border-blue-800">
            <h3 className="text-2xl font-bold mb-3">Ready to Transform Your Learning?</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-2xl mx-auto">
              Join thousands of successful students who are already studying smarter with StuddyHub Premium.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white shadow-xl"
                onClick={() => {
                  const element = document.getElementById('pricing-cards');
                  element?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                Choose Your Plan
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-blue-300 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                onClick={() => setShowReferralModal(true)}
              >
                <Gift className="h-4 w-4 mr-2" />
                Earn Free Premium
              </Button>
            </div>
          </div>
        </div>
      </div>

      <ReferralModal open={showReferralModal} onOpenChange={setShowReferralModal} />
    </div>
  );
}