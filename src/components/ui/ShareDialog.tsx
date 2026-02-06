import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './dialog';
import { Button } from './button';
import { Input } from './input';
import { Label } from './label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';
import { ScrollArea } from './scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from './avatar';
import { Badge } from './badge';
import {
  Share2,
  Link,
  Users,
  MessageCircle,
  Facebook,
  Twitter,
  Linkedin,
  Mail,
  Copy,
  Check,
  Globe,
  Loader2,
  Send,
  Music,
  MessageSquare
} from 'lucide-react';
import { toast } from 'sonner';

export interface ShareDialogProps {
  open: boolean;
  onClose: () => void;
  shareUrl: string;
  title: string;
  description?: string;
  coverImageUrl?: string;
  user?: {
    full_name: string;
    avatar_url?: string;
  };
  onShareToFeedDraft?: (draft: { content: string; coverUrl?: string }) => void;
}

export const ShareDialog: React.FC<ShareDialogProps> = ({
  open,
  onClose,
  shareUrl,
  title,
  description,
  coverImageUrl,
  user,
  onShareToFeedDraft
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success('Link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy link');
    }
  };

  const handleShareToSocialFeed = () => {
    if (onShareToFeedDraft) {
      const content = `🎉 ${title}\n\n${description || ''}\n\n🔗 ${shareUrl}`;
      onShareToFeedDraft({ content, coverUrl: coverImageUrl });
      onClose();
    }
  };

  const handleShareToExternalPlatform = (platform: string) => {
    const text = `Check this out: ${title}`;
    const encodedText = encodeURIComponent(text);
    const encodedUrl = encodeURIComponent(shareUrl);
    let shareLink = '';
    switch (platform) {
      case 'twitter':
        shareLink = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`;
        break;
      case 'facebook':
        shareLink = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
        break;
      case 'linkedin':
        shareLink = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
        break;
      case 'whatsapp':
        shareLink = `https://wa.me/?text=${encodedText}%20${encodedUrl}`;
        break;
      case 'telegram':
        shareLink = `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`;
        break;
      case 'email':
        shareLink = `mailto:?subject=${encodeURIComponent(title)}&body=${encodedText}%0A%0A${encodedUrl}`;
        break;
    }
    if (shareLink) {
      window.open(shareLink, '_blank', 'width=600,height=400');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto w-[95vw] p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share
          </DialogTitle>
          <DialogDescription>
            Share "{title}" with friends, groups, or on social media
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="link" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="link">
              <Link className="h-4 w-4 mr-2 hidden sm:inline" />
              Link
            </TabsTrigger>
            <TabsTrigger value="social">
              <Globe className="h-4 w-4 mr-2 hidden sm:inline" />
              Social
            </TabsTrigger>
            <TabsTrigger value="external">
              <Share2 className="h-4 w-4 mr-2 hidden sm:inline" />
              External
            </TabsTrigger>
          </TabsList>
          <TabsContent value="link" className="space-y-4">
            <div className="space-y-2">
              <Label>Share Link</Label>
              <div className="flex gap-2">
                <Input value={shareUrl} readOnly className="flex-1" />
                <Button onClick={handleCopyLink} variant="outline" size="icon">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </TabsContent>
          <TabsContent value="social" className="space-y-4">
            <Button onClick={handleShareToSocialFeed} variant="outline" className="w-full">
              <Users className="h-4 w-4 mr-2" />
              Share to Social Feed
            </Button>
          </TabsContent>
          <TabsContent value="external" className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => handleShareToExternalPlatform('twitter')} className="justify-start w-full">
                <Twitter className="h-4 w-4 mr-2 text-blue-400" /> Twitter/X
              </Button>
              <Button variant="outline" onClick={() => handleShareToExternalPlatform('facebook')} className="justify-start w-full">
                <Facebook className="h-4 w-4 mr-2 text-blue-600" /> Facebook
              </Button>
              <Button variant="outline" onClick={() => handleShareToExternalPlatform('linkedin')} className="justify-start w-full">
                <Linkedin className="h-4 w-4 mr-2 text-blue-700" /> LinkedIn
              </Button>
              <Button variant="outline" onClick={() => handleShareToExternalPlatform('whatsapp')} className="justify-start w-full">
                <MessageCircle className="h-4 w-4 mr-2 text-green-600" /> WhatsApp
              </Button>
              <Button variant="outline" onClick={() => handleShareToExternalPlatform('telegram')} className="justify-start w-full">
                <Send className="h-4 w-4 mr-2 text-blue-500" /> Telegram
              </Button>
              <Button variant="outline" onClick={() => handleShareToExternalPlatform('email')} className="justify-start w-full">
                <Mail className="h-4 w-4 mr-2 text-gray-600" /> Email
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
