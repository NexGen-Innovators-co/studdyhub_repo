import { useState, useEffect } from 'react';
import { Copy, Gift, Share2, Users, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ReferralModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReferralModal({ open, onOpenChange }: ReferralModalProps) {
  const { user } = useAuth();
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referralCount, setReferralCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (open && user?.id) {
      fetchReferralData();
    }
  }, [open, user?.id]);

  const fetchReferralData = async () => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('referral_code, referral_count')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      setReferralCode(data?.referral_code || null);
      setReferralCount(data?.referral_count || 0);
    } catch (error) {
      console.error('Error fetching referral data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const referralLink = referralCode 
    ? `${window.location.origin}?ref=${referralCode}`
    : '';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      toast.success('Link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy link');
    }
  };

  const handleWhatsAppShare = () => {
    const message = encodeURIComponent(
      `🎓 Join me on StuddyHub - the AI-powered study platform!\n\n` +
      `Use my referral link to get 10 FREE AI credits:\n${referralLink}\n\n` +
      `Study smarter, not harder! 📚✨`
    );
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center mb-4">
            <Gift className="h-8 w-8 text-primary-foreground" />
          </div>
          <DialogTitle className="text-center text-2xl">Get Free Premium!</DialogTitle>
          <DialogDescription className="text-center">
            Invite friends and earn 3 days of Scholar access for each signup
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <Users className="h-5 w-5 mx-auto mb-2 text-primary" />
              <p className="text-2xl font-bold">{referralCount}</p>
              <p className="text-xs text-muted-foreground">Friends Invited</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <Gift className="h-5 w-5 mx-auto mb-2 text-green-500" />
              <p className="text-2xl font-bold">{referralCount * 3}</p>
              <p className="text-xs text-muted-foreground">Days Earned</p>
            </div>
          </div>

          {/* Referral Link */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Your Referral Link</label>
            <div className="flex gap-2">
              <Input 
                readOnly 
                value={isLoading ? 'Loading...' : referralLink}
                className="bg-muted/50 text-sm"
              />
              <Button 
                size="icon" 
                variant="outline" 
                onClick={handleCopy}
                disabled={!referralCode}
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Referral Code */}
          <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg p-4 text-center">
            <p className="text-sm text-muted-foreground mb-1">Your Code</p>
            <p className="text-3xl font-mono font-bold tracking-wider">
              {isLoading ? '------' : referralCode || 'N/A'}
            </p>
          </div>

          {/* How it Works */}
          <div className="space-y-3">
            <p className="text-sm font-medium">How it works:</p>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">1</span>
                <span>Share your link with friends</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">2</span>
                <span>They sign up using your link</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">3</span>
                <span>You get <strong>3 days Scholar</strong> access, they get <strong>10 AI credits</strong></span>
              </div>
            </div>
          </div>

          {/* Share Button */}
          <Button 
            onClick={handleWhatsAppShare} 
            className="w-full bg-green-600 hover:bg-green-700"
            disabled={!referralCode}
          >
            <Share2 className="h-4 w-4 mr-2" />
            Share to WhatsApp
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
