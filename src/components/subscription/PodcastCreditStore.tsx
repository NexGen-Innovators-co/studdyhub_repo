// components/subscription/PodcastCreditStore.tsx — Credit pack purchase + balance display
import { useState } from 'react';
import { Coins, Sparkles, ShoppingCart, Loader2, Podcast, Headphones, Image as ImageIcon, Video, History, ArrowUpRight, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { usePaystackPayment } from 'react-paystack';
import { useAuth } from '@/hooks/useAuth';
import { usePodcastCredits, PODCAST_CREDIT_COSTS, MONTHLY_CREDIT_GRANTS, CreditPack } from '@/hooks/usePodcastCredits';
import { toast } from 'sonner';

const PAYSTACK_PUBLIC_KEY = 'pk_live_693d54327546195c15b987f6f2f94c0676904bba';

// ─── Individual pack purchase button ─────────────────────────────────────────
interface PackButtonProps {
  pack: CreditPack;
  email: string;
  onSuccess: (reference: string, packId: string) => void;
  isLoading: boolean;
}

function PackPaystackButton({ pack, email, onSuccess, isLoading }: PackButtonProps) {
  const config = {
    reference: `credit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    email,
    amount: Math.round(pack.price_ghs * 100), // Paystack uses pesewas
    publicKey: PAYSTACK_PUBLIC_KEY,
    currency: 'GHS',
    channels: ['card', 'mobile_money', 'bank'] as ('card' | 'mobile_money' | 'bank')[],
    metadata: {
      custom_fields: [
        { display_name: 'Credit Pack', variable_name: 'credit_pack', value: pack.name },
        { display_name: 'Credits', variable_name: 'credits', value: String(pack.credits) },
      ],
    },
  };

  const initializePayment = usePaystackPayment(config);

  const handlePayment = () => {
    initializePayment({
      onSuccess: (reference: { reference: string }) => {
        onSuccess(reference.reference, pack.id);
      },
      onClose: () => {
        toast.info('Payment cancelled');
      },
    });
  };

  return (
    <Button
      onClick={handlePayment}
      disabled={isLoading}
      className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white"
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
      ) : (
        <ShoppingCart className="h-4 w-4 mr-2" />
      )}
      Buy for {pack.price_display}
    </Button>
  );
}

// ─── Main store component ────────────────────────────────────────────────────
export function PodcastCreditStore() {
  const { user } = useAuth();
  const {
    balance,
    isLoading,
    creditPacks,
    transactions,
    monthlyGrant,
    refreshCredits,
    claimMonthlyGrant,
    addCreditsFromPurchase,
  } = usePodcastCredits();

  const [isProcessing, setIsProcessing] = useState(false);
  const [isClaimingGrant, setIsClaimingGrant] = useState(false);

  const handlePurchaseSuccess = async (reference: string, packId: string) => {
    setIsProcessing(true);
    try {
      const success = await addCreditsFromPurchase(packId, reference);
      if (success) {
        toast.success('Credits added to your account!', { icon: '🎉' });
      } else {
        toast.error('Failed to add credits. Please contact support with reference: ' + reference);
      }
    } catch (err) {
      toast.error('Error processing purchase. Please contact support.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClaimGrant = async () => {
    setIsClaimingGrant(true);
    try {
      const success = await claimMonthlyGrant();
      if (success) {
        toast.success(`${monthlyGrant} monthly credits claimed!`, { icon: '🎁' });
      } else {
        toast.info('Monthly credits already claimed for this period.');
      }
    } catch {
      toast.error('Failed to claim monthly credits.');
    } finally {
      setIsClaimingGrant(false);
    }
  };

  const creditCostItems = [
    { type: 'Audio', icon: Headphones, cost: PODCAST_CREDIT_COSTS['audio'], color: 'text-blue-500' },
    { type: 'Image + Audio', icon: ImageIcon, cost: PODCAST_CREDIT_COSTS['image-audio'], color: 'text-purple-500' },
    { type: 'Video', icon: Video, cost: PODCAST_CREDIT_COSTS['video'], color: 'text-orange-500' },
  ];

  const packHighlight: Record<number, string> = {
    0: '',
    1: 'ring-2 ring-amber-400 shadow-lg',
    2: 'ring-2 ring-amber-500 shadow-xl',
  };

  return (
    <div className="space-y-6">
      {/* ── Balance + Monthly Grant ── */}
      <Card className="bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 dark:from-amber-950/30 dark:via-yellow-950/30 dark:to-orange-950/30 border-amber-200 dark:border-amber-800 shadow-lg">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 flex items-center justify-center shadow-lg">
              <Coins className="h-6 w-6 text-white" />
            </div>
            <div>
              <span className="text-lg text-gray-700 dark:text-gray-300">Podcast Credits</span>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-3xl font-bold bg-gradient-to-r from-amber-600 to-yellow-500 bg-clip-text text-transparent">
                  {isLoading ? '...' : balance}
                </span>
                <Badge className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200 border-0">
                  credits available
                </Badge>
              </div>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            {monthlyGrant > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClaimGrant}
                disabled={isClaimingGrant}
                className="border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-950"
              >
                {isClaimingGrant ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Gift className="h-4 w-4 mr-2" />
                )}
                Claim {monthlyGrant} Monthly Credits
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Credit Cost Reference ── */}
      <Card className="border-gray-200 dark:border-gray-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Podcast className="h-5 w-5 text-purple-500" />
            Credit Costs per Podcast
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {creditCostItems.map(item => {
              const Icon = item.icon;
              return (
                <div key={item.type} className="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                  <Icon className={`h-6 w-6 mx-auto mb-2 ${item.color}`} />
                  <div className="text-lg font-bold text-gray-900 dark:text-white">{item.cost}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{item.type}</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── Credit Packs ── */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-amber-600" />
          Buy Credit Packs
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Purchased credits never expire. Use them anytime for podcast generation.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {creditPacks.map((pack, index) => (
            <Card
              key={pack.id}
              className={`relative transition-all hover:shadow-lg ${packHighlight[index] || ''}`}
            >
              {index === 2 && (
                <Badge className="absolute -top-2 right-4 bg-gradient-to-r from-amber-500 to-yellow-500 text-white border-0 text-xs">
                  Best Value
                </Badge>
              )}
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-xl">{pack.credits}</CardTitle>
                <CardDescription>credits</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-center">
                  <span className="text-2xl font-bold text-gray-900 dark:text-white">
                    {pack.price_display}
                  </span>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    GHS {(pack.price_ghs / pack.credits).toFixed(2)} per credit
                  </div>
                </div>

                <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Headphones className="h-3 w-3" />
                    <span>{Math.floor(pack.credits / PODCAST_CREDIT_COSTS['audio'])} audio podcasts</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <ImageIcon className="h-3 w-3" />
                    <span>{Math.floor(pack.credits / PODCAST_CREDIT_COSTS['image-audio'])} image+audio podcasts</span>
                  </div>
                  {pack.credits >= PODCAST_CREDIT_COSTS['video'] && (
                    <div className="flex items-center gap-1.5">
                      <Video className="h-3 w-3" />
                      <span>{Math.floor(pack.credits / PODCAST_CREDIT_COSTS['video'])} video podcasts</span>
                    </div>
                  )}
                </div>

                {user?.email && (
                  <PackPaystackButton
                    pack={pack}
                    email={user.email}
                    onSuccess={handlePurchaseSuccess}
                    isLoading={isProcessing}
                  />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* ── Recent Transactions ── */}
      {transactions.length > 0 && (
        <Card className="border-gray-200 dark:border-gray-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-5 w-5 text-gray-500" />
              Recent Credit Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {transactions.slice(0, 10).map(txn => (
                <div key={txn.id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${txn.amount > 0 ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {txn.description || txn.transaction_type.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-medium ${txn.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {txn.amount > 0 ? '+' : ''}{txn.amount}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(txn.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Monthly Grant Info ── */}
      <Card className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-blue-900 dark:text-blue-100 mb-1">Monthly Credit Grants</p>
              <p className="text-blue-700 dark:text-blue-300">
                Scholar subscribers get <strong>{MONTHLY_CREDIT_GRANTS.scholar}</strong> credits/month,
                Genius subscribers get <strong>{MONTHLY_CREDIT_GRANTS.genius}</strong> credits/month.
                Credits accumulate — unused credits roll over!
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
