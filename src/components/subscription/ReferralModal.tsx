import { useState, useEffect } from 'react';
import { Copy, Gift, Share2, Users, Check, X, Loader2, MessageCircle, Mail, Facebook, Twitter, Linkedin } from 'lucide-react';
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

// Function to generate a referral code matching database format
const generateReferralCode = (userId: string): string => {
  const userIdPart = userId.slice(-3).toUpperCase();
  const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `STU-${userIdPart}-${randomPart}`;
};

// Function to ensure user has a valid referral code
const ensureReferralCode = async (userId: string): Promise<string | null> => {
  try {
    // First, check if user already has a valid referral code
    const { data: existingProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('referral_code')
      .eq('id', userId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      //console.error('Error fetching profile:', fetchError);
      return null;
    }

    // Check if user has a valid referral code (STU-XXX-XXXX format)
    const isValidCode = (code: string) =>
      /^STU-[A-Z0-9]{3}-[A-Z0-9]{4}$/.test(code);

    if (existingProfile?.referral_code && isValidCode(existingProfile.referral_code)) {
      return existingProfile.referral_code;
    }

    // Generate a new unique referral code
    let referralCode: string;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 5;

    while (!isUnique && attempts < maxAttempts) {
      referralCode = generateReferralCode(userId);

      // Check if code already exists
      const { data: existingCode, error: codeCheckError } = await supabase
        .from('profiles')
        .select('id')
        .eq('referral_code', referralCode)
        .maybeSingle();

      if (codeCheckError) {
        //console.error('Error checking referral code:', codeCheckError);
        break;
      }

      if (!existingCode) {
        isUnique = true;

        // Update user's profile with the new referral code
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            referral_code: referralCode,
            updated_at: new Date().toISOString()
          })
          .eq('id', userId);

        if (updateError) {
          //console.error('Error updating referral code:', updateError);
          return null;
        }

        return referralCode;
      }

      attempts++;
    }

    // Fallback: Use timestamp-based code
    const fallbackCode = `STU-${userId.slice(-3).toUpperCase()}-${Date.now().toString(36).toUpperCase().slice(-4)}`;

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        referral_code: fallbackCode,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (updateError) {
      //console.error('Error updating fallback referral code:', updateError);
      return null;
    }

    return fallbackCode;
  } catch (error) {
    //console.error('Error ensuring referral code:', error);
    return null;
  }
};

// Share platform configuration
const SHARE_PLATFORMS = [
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    icon: MessageCircle,
    color: 'bg-green-600 hover:bg-green-700',
    getShareUrl: (link: string, message: string) => {
      const encodedMessage = encodeURIComponent(message);
      return `https://wa.me/?text=${encodedMessage}`;
    }
  },
  {
    id: 'facebook',
    name: 'Facebook',
    icon: Facebook,
    color: 'bg-blue-600 hover:bg-blue-700',
    getShareUrl: (link: string, message: string) => {
      const encodedUrl = encodeURIComponent(link);
      return `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
    }
  },
  {
    id: 'twitter',
    name: 'Twitter',
    icon: Twitter,
    color: 'bg-sky-500 hover:bg-sky-600',
    getShareUrl: (link: string, message: string) => {
      const encodedMessage = encodeURIComponent(`${message} ${link}`);
      return `https://twitter.com/intent/tweet?text=${encodedMessage}`;
    }
  },
  {
    id: 'email',
    name: 'Email',
    icon: Mail,
    color: 'bg-gray-700 hover:bg-gray-800',
    getShareUrl: (link: string, message: string) => {
      const subject = encodeURIComponent('Join me on StuddyHub!');
      const body = encodeURIComponent(`${message}\n\n${link}`);
      return `mailto:?subject=${subject}&body=${body}`;
    }
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    icon: Linkedin,
    color: 'bg-blue-700 hover:bg-blue-800',
    getShareUrl: (link: string, message: string) => {
      const encodedUrl = encodeURIComponent(link);
      return `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
    }
  }
];

// Default share message
const getShareMessage = () => {
  return `🎓 Join me on StuddyHub - the AI-powered study platform!\n\nUse my referral link to get 10 FREE AI credits!\n\nStudy smarter, not harder! 📚✨`;
};

export function ReferralModal({ open, onOpenChange }: ReferralModalProps) {
  const { user } = useAuth();
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referralCount, setReferralCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [showShareOptions, setShowShareOptions] = useState(false);

  useEffect(() => {
    if (open && user?.id) {
      fetchReferralData();
    }
  }, [open, user?.id]);

  const fetchReferralData = async () => {
    if (!user?.id) return;

    setIsLoading(true);
    setIsGeneratingCode(false);

    try {
      // First, ensure the user has a referral code
      setIsGeneratingCode(true);
      const code = await ensureReferralCode(user.id);
      setReferralCode(code);

      // Then fetch updated profile data including referral count
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('referral_code, referral_count, bonus_ai_credits')
        .eq('id', user.id)
        .single();

      if (profileError) {
        //console.error('Error fetching profile data:', profileError);
        // If there's an error, use the code we just generated
        if (code) {
          // The code was generated, but we couldn't fetch the count
          // So we'll show the code with count 0
          setReferralCount(0);
        }
      } else {
        // Update the code from the database (in case it was different)
        if (profileData.referral_code) {
          setReferralCode(profileData.referral_code);
        }
        setReferralCount(profileData.referral_count || 0);
      }

      // Also fetch from referrals table for additional verification
      const { data: referralData, error: referralError } = await supabase
        .from('referrals')
        .select('id, status')
        .eq('referrer_id', user.id);

      if (!referralError && referralData) {
        // Count only completed referrals
        const completedCount = referralData.filter(ref => ref.status === 'completed').length;
        // Use the maximum count from both sources
        setReferralCount(prev => Math.max(prev, completedCount));
      }

    } catch (error) {
      //console.error('Error in fetchReferralData:', error);
      toast.error('Failed to load referral data');
    } finally {
      setIsLoading(false);
      setIsGeneratingCode(false);
    }
  };

  const referralLink = referralCode
    ? `${window.location.origin}?ref=${referralCode}`
    : '';

  const handleCopy = async () => {
    if (!referralLink) {
      toast.error('No referral link available');
      return;
    }

    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      toast.success('Link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy link');
    }
  };

  const handleShare = (platformId: string) => {
    if (!referralLink) {
      toast.error('No referral link available');
      return;
    }

    const platform = SHARE_PLATFORMS.find(p => p.id === platformId);
    if (!platform) return;

    const message = getShareMessage();
    const shareUrl = platform.getShareUrl(referralLink, `${message}\n\n${referralLink}`);

    window.open(shareUrl, '_blank');

    // Track share event
    toast.success(`Shared to ${platform.name}!`);
  };

  const handleManualCodeGeneration = async () => {
    if (!user?.id) return;

    setIsGeneratingCode(true);
    try {
      const code = await ensureReferralCode(user.id);
      if (code) {
        setReferralCode(code);
        toast.success('Referral code generated successfully!');
      } else {
        toast.error('Failed to generate referral code');
      }
    } catch (error) {
      //console.error('Error generating referral code:', error);
      toast.error('Failed to generate referral code');
    } finally {
      setIsGeneratingCode(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md overflow-auto max-h-screen-75 modern-scrollbar">
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
              <p className="text-2xl font-bold">
                {isLoading ? '...' : referralCount}
              </p>
              <p className="text-xs text-muted-foreground">Friends Invited</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <Gift className="h-5 w-5 mx-auto mb-2 text-green-500" />
              <p className="text-2xl font-bold">
                {isLoading ? '...' : referralCount * 3}
              </p>
              <p className="text-xs text-muted-foreground">Days Earned</p>
            </div>
          </div>

          {/* Referral Link */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Your Referral Link</label>
            <div className="flex gap-2">
              <Input
                readOnly
                value={
                  isLoading ? 'Loading...' :
                    isGeneratingCode ? 'Generating code...' :
                      referralLink || 'No code available'
                }
                className="bg-muted/50 text-sm text-slate-700"
              />
              <Button
                size="icon"
                variant="outline"
                onClick={handleCopy}
                disabled={!referralLink || isLoading || isGeneratingCode}
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
            {isLoading || isGeneratingCode ? (
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">
                  {isGeneratingCode ? 'Generating code...' : 'Loading...'}
                </span>
              </div>
            ) : referralCode ? (
              <p className="text-3xl font-mono font-bold tracking-wider">
                {referralCode}
              </p>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">No referral code found</p>
                <Button
                  onClick={handleManualCodeGeneration}
                  size="sm"
                  variant="outline"
                  disabled={isGeneratingCode}
                >
                  {isGeneratingCode ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Generating...
                    </>
                  ) : (
                    'Generate Referral Code'
                  )}
                </Button>
              </div>
            )}
          </div>

          {/* Share Options */}
          <div className="space-y-3">
            <p className="text-sm font-medium">Share on:</p>

            {/* Quick Share Button */}
            {!showShareOptions && (
              <Button
                onClick={() => setShowShareOptions(true)}
                className="w-full"
                variant="outline"
                disabled={!referralCode || isLoading || isGeneratingCode}
              >
                <Share2 className="h-4 w-4 mr-2" />
                Share on Multiple Platforms
              </Button>
            )}

            {/* Expanded Share Options */}
            {showShareOptions && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  {SHARE_PLATFORMS.slice(0, 3).map((platform) => (
                    <Button
                      key={platform.id}
                      onClick={() => handleShare(platform.id)}
                      className={platform.color}
                      size="sm"
                      disabled={!referralCode || isLoading || isGeneratingCode}
                    >
                      <platform.icon className="h-4 w-4" />
                      <span className="sr-only">{platform.name}</span>
                    </Button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {SHARE_PLATFORMS.slice(3).map((platform) => (
                    <Button
                      key={platform.id}
                      onClick={() => handleShare(platform.id)}
                      className={platform.color}
                      size="sm"
                      disabled={!referralCode || isLoading || isGeneratingCode}
                    >
                      <platform.icon className="h-4 w-4 mr-2" />
                      {platform.name}
                    </Button>
                  ))}
                </div>
                <Button
                  onClick={() => setShowShareOptions(false)}
                  className="w-full"
                  variant="ghost"
                  size="sm"
                >
                  Show less
                </Button>
              </div>
            )}
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

          {/* Info for existing users */}
          {!isLoading && !isGeneratingCode && !referralCode && (
            <div className="text-center text-sm text-muted-foreground p-3 bg-muted/30 rounded-lg">
              <p>✨ <strong>Welcome!</strong> ✨</p>
              <p className="mt-1">Generate your referral code to start inviting friends!</p>
            </div>
          )}

          {/* Info about existing user bonus */}
          {!isLoading && !isGeneratingCode && referralCode && (
            <div className="text-center text-xs text-muted-foreground p-2 bg-primary/5 rounded-lg">
              <p>🎉 <strong>Existing User Bonus Active!</strong> 🎉</p>
              <p className="mt-1">Your referral code is ready to share with friends!</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}