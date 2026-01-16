// components/subscription/SubscriptionLimitsModal.tsx
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Check,
  X,
  Infinity,
  Crown,
  Sparkles,
  BookOpen,
  FileText,
  Zap,
  Users,
  Gift,
  Shield,
  Gauge,
  AlertCircle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '@/hooks/useAppContext';

/**
 * SubscriptionLimitsModal Component
 * 
 * Modal dialog showing a detailed comparison of all subscription plans
 * and their feature limits. Helps users understand what they get with each tier.
 */
interface SubscriptionLimitsModalProps {
    trigger?: React.ReactNode;
    isOpen?: boolean;
    onClose?: () => void;
}

export const SubscriptionLimitsModal: React.FC<SubscriptionLimitsModalProps> = ({
  trigger,
  isOpen,
  onClose
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const { subscriptionTier } = useAppContext();
  const navigate = useNavigate();

  const isControlled = isOpen !== undefined;
  const open = isControlled ? isOpen : internalOpen;
  const setOpen = (val: boolean) => {
      if (isControlled) {
          if (!val && onClose) onClose();
      } else {
          setInternalOpen(val);
      }
  };

  const features = [
    {
      icon: <BookOpen className="w-5 h-5" />,
      name: 'Max Notes',
      free: '50',
      scholar: '500',
      genius: '∞',
      description: 'Create and organize unlimited study notes'
    },
    {
      icon: <FileText className="w-5 h-5" />,
      name: 'Document Uploads',
      free: '20',
      scholar: '100',
      genius: '∞',
      description: 'Upload and process documents'
    },
    {
      icon: <Zap className="w-5 h-5" />,
      name: 'AI Messages/Day',
      free: '20',
      scholar: '100',
      genius: '∞',
      description: 'Daily AI chat messages'
    },
    {
      icon: <Gauge className="w-5 h-5" />,
      name: 'Document Size',
      free: '10 MB',
      scholar: '50 MB',
      genius: '100 MB',
      description: 'Maximum file upload size'
    },
    {
      icon: <Users className="w-5 h-5" />,
      name: 'Social Features',
      free: false,
      scholar: true,
      genius: true,
      description: 'Post, share, and interact in community'
    },
    {
      icon: <Gift className="w-5 h-5" />,
      name: 'Quiz Generation',
      free: false,
      scholar: true,
      genius: true,
      description: 'Auto-generate quizzes from notes'
    },
    {
      icon: <Shield className="w-5 h-5" />,
      name: 'Exam Mode',
      free: false,
      scholar: false,
      genius: true,
      description: 'Advanced exam preparation features'
    },
    {
      icon: <Sparkles className="w-5 h-5" />,
      name: 'Verified Badge',
      free: false,
      scholar: false,
      genius: true,
      description: 'Display verified status in community'
    },
    {
      icon: <BookOpen className="w-5 h-5" />,
      name: 'Max Recordings',
      free: '10',
      scholar: '50',
      genius: '∞',
      description: 'Class recordings and audio files'
    },
    {
      icon: <BookOpen className="w-5 h-5" />,
      name: 'Max Folders',
      free: '10',
      scholar: '50',
      genius: '∞',
      description: 'Organize documents in folders'
    },
    {
      icon: <BookOpen className="w-5 h-5" />,
      name: 'Schedule Items',
      free: '20',
      scholar: '100',
      genius: '∞',
      description: 'Schedule classes and events'
    },
    {
      icon: <BookOpen className="w-5 h-5" />,
      name: 'Chat Sessions',
      free: '10',
      scholar: '50',
      genius: '∞',
      description: 'Concurrent AI chat sessions'
    },
  ];

  const tiers = [
    {
      name: 'Visitor',
      tier: 'free',
      color: 'from-gray-400 to-gray-500',
      icon: null,
      price: 'Free',
      description: 'Perfect for getting started'
    },
    {
      name: 'Scholar',
      tier: 'scholar',
      color: 'from-blue-500 to-blue-600',
      icon: <Sparkles className="w-6 h-6 text-blue-400" />,
      price: '₦2,500/mo',
      description: 'Best for active learners'
    },
    {
      name: 'Genius',
      tier: 'genius',
      color: 'from-amber-500 to-amber-600',
      icon: <Crown className="w-6 h-6 text-amber-400" />,
      price: '₦5,000/mo',
      description: 'Ultimate power user plan'
    },
  ];

  const isFeatureIncluded = (feature: any, tier: string) => {
    const value = feature[tier];
    if (typeof value === 'boolean') return value;
    if (value === '∞') return true;
    if (value === false) return false;
    return true;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* <DialogTrigger asChild>
        {trigger ? (
          trigger
        ) : (
          <Button variant="outline" size="sm">
            View All Plans
          </Button>
        )}
      </DialogTrigger> */}
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-3xl">Compare Subscription Plans</DialogTitle>
          <DialogDescription>
            Choose the plan that best fits your learning needs
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-8">
          {/* Plans Header */}
          <div className="grid grid-cols-3 gap-4">
            {tiers.map((tier) => (
              <Card
                key={tier.tier}
                className={`border-2 ${
                  subscriptionTier === tier.tier
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                    : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                <CardHeader>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {tier.icon}
                      <CardTitle>{tier.name}</CardTitle>
                    </div>
                    {subscriptionTier === tier.tier && (
                      <Badge className="bg-blue-600">Current</Badge>
                    )}
                  </div>
                  <CardDescription>{tier.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold mb-4">{tier.price}</div>
                  {tier.tier !== 'free' && (
                    <Button
                      onClick={() => {
                        navigate('/subscription');
                        setOpen(false);
                      }}
                      className="w-full"
                      variant={subscriptionTier === tier.tier ? 'outline' : 'default'}
                    >
                      {subscriptionTier === tier.tier ? 'Current Plan' : 'Upgrade'}
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Features Comparison Table */}
          <div className="space-y-3">
            <h3 className="text-xl font-bold">Feature Comparison</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b dark:border-gray-700">
                    <th className="text-left py-3 px-4 font-semibold">Feature</th>
                    <th className="text-center py-3 px-4 font-semibold">Visitor</th>
                    <th className="text-center py-3 px-4 font-semibold">Scholar</th>
                    <th className="text-center py-3 px-4 font-semibold">Genius</th>
                  </tr>
                </thead>
                <tbody>
                  {features.map((feature, idx) => (
                    <tr
                      key={idx}
                      className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="p-1 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                            {feature.icon}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900 dark:text-gray-100">
                              {feature.name}
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">
                              {feature.description}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="text-center py-3 px-4">
                        {typeof feature.free === 'boolean' ? (
                          feature.free ? (
                            <Check className="w-5 h-5 text-green-500 mx-auto" />
                          ) : (
                            <X className="w-5 h-5 text-gray-400 mx-auto" />
                          )
                        ) : (
                          <span className="font-semibold text-gray-900 dark:text-gray-100">
                            {feature.free}
                          </span>
                        )}
                      </td>
                      <td className="text-center py-3 px-4">
                        {typeof feature.scholar === 'boolean' ? (
                          feature.scholar ? (
                            <Check className="w-5 h-5 text-green-500 mx-auto" />
                          ) : (
                            <X className="w-5 h-5 text-gray-400 mx-auto" />
                          )
                        ) : (
                          <span className="font-semibold text-blue-600 dark:text-blue-400">
                            {feature.scholar}
                          </span>
                        )}
                      </td>
                      <td className="text-center py-3 px-4">
                        {typeof feature.genius === 'boolean' ? (
                          feature.genius ? (
                            <Check className="w-5 h-5 text-green-500 mx-auto" />
                          ) : (
                            <X className="w-5 h-5 text-gray-400 mx-auto" />
                          )
                        ) : (
                          <span className="font-semibold text-amber-600 dark:text-amber-400">
                            {feature.genius}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Info Banner */}
          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-900 dark:text-blue-200">
                <strong>Need help choosing?</strong> Start with the Visitor plan to explore all features, then upgrade
                when you need more capacity.
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center pt-4 border-t dark:border-gray-700">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
          >
            Close
          </Button>
          <Button
            onClick={() => {
              navigate('/subscription');
              setOpen(false);
            }}
          >
            Manage Subscription
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
