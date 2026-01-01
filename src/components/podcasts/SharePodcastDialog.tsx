import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { ScrollArea } from '../ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Badge } from '../ui/badge';
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
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PodcastWithMeta {
  id: string;
  title: string;
  description?: string;
  duration?: number;
  user_id: string;
  cover_image_url?: string;
  user?: {
    full_name: string;
    avatar_url?: string;
  };
}

interface SharePodcastDialogProps {
  open: boolean;
  onClose: () => void;
  podcast: PodcastWithMeta;
  currentUser: any;
  onShareToFeedDraft?: (draft: { content: string; coverUrl?: string; podcast: PodcastWithMeta }) => void;
}

interface SocialUser {
  id: string;
  display_name: string;
  username?: string;
  avatar_url?: string;
  email?: string;
}

interface SocialGroup {
  id: string;
  name: string;
  description?: string;
  avatar_url?: string;
  member_count?: number;
}

export const SharePodcastDialog: React.FC<SharePodcastDialogProps> = ({
  open,
  onClose,
  podcast,
  currentUser,
  onShareToFeedDraft
}) => {
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [friends, setFriends] = useState<SocialUser[]>([]);
  const [groups, setGroups] = useState<SocialGroup[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(false);

  const shareUrl = `${window.location.origin}/podcasts/${podcast.id}`;

  useEffect(() => {
    if (open && currentUser) {
      fetchFriends();
      fetchGroups();
    }
  }, [open, currentUser]);

  const fetchFriends = async () => {
    setLoadingFriends(true);
    try {
      // Get users the current user is following
      const { data: followingData, error: followingError } = await supabase
        .from('social_follows')
        .select('following_id')
        .eq('follower_id', currentUser.id);

      if (followingError) throw followingError;

      if (followingData && followingData.length > 0) {
        const followingIds = followingData.map(f => f.following_id);
        
        const { data: usersData, error: usersError } = await supabase
          .from('social_users')
          .select('id, display_name, username, avatar_url, email')
          .in('id', followingIds)
          .limit(50);

        if (usersError) throw usersError;
        setFriends(usersData || []);
      }
    } catch (error) {

    } finally {
      setLoadingFriends(false);
    }
  };

  const fetchGroups = async () => {
    setLoadingGroups(true);
    try {
      // Get groups the user is a member of
      const { data, error } = await supabase
        .from('social_groups')
        .select('id, name, description, avatar_url')
        .order('name');

      if (error) throw error;
      setGroups(data || []);
    } catch (error) {

    } finally {
      setLoadingGroups(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      
      // Track share
      await trackShare('link', 'clipboard');
      
      toast.success('Link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy link');
    }
  };

  const trackShare = async (shareType: string, platform: string) => {
    try {
      await supabase.from('podcast_shares').insert({
        podcast_id: podcast.id,
        user_id: currentUser?.id,
        share_type: shareType,
        platform: platform
      });

      await supabase.rpc('increment_podcast_share_count', { podcast_id: podcast.id });
    } catch (error) {

    }
  };

  const handleShareToSocialFeed = () => {
    if (onShareToFeedDraft) {
      const content = `🎙️ Check out this podcast: "${podcast.title}"

${podcast.duration || 0} minutes of great content

🔗 Listen now: ${shareUrl}

#Podcast #StuddyHub`;
      onShareToFeedDraft({
        content,
        coverUrl: podcast.cover_image_url,
        podcast
      });
      onClose();
    }
  };

  const handleShareToFriend = async (friend: SocialUser) => {
    setSharing(true);
    try {
      // Create a direct message or notification
      const message = `Hey! Check out this podcast: "${podcast.title}" (${podcast.duration || 0} min)\n\nListen here: ${shareUrl}`;

      // For now, we'll create a notification
      const { error } = await supabase
        .from('notifications')
        .insert({
          user_id: friend.id,
          type: 'podcast_share',
          title: 'Podcast Shared with You',
          message: message,
          action_url: shareUrl,
          read: false
        });

      if (error) throw error;

      await trackShare('direct_message', 'friend');
      toast.success(`Shared with ${friend.display_name || friend.username}!`);
    } catch (error) {

      toast.error('Failed to share with friend');
    } finally {
      setSharing(false);
    }
  };

  const handleShareToGroup = async (group: SocialGroup) => {
    setSharing(true);
    try {
      const content = `🎙️ Podcast Recommendation: "${podcast.title}"

Duration: ${podcast.duration || 0} minutes

Listen here: ${shareUrl}`;

      const { error } = await supabase
        .from('social_posts')
        .insert({
          author_id: currentUser.id,
          content,
          privacy: 'public',
          group_id: group.id
        });

      if (error) throw error;

      await trackShare('group_post', 'studdyhub');
      toast.success(`Shared to ${group.name}!`);
      onClose();
    } catch (error) {

      toast.error('Failed to share to group');
    } finally {
      setSharing(false);
    }
  };

  const handleShareToExternalPlatform = async (platform: string) => {
    const text = `Check out this podcast: "${podcast.title}" on StuddyHub!`;
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
      case 'messenger':
        shareLink = `fb-messenger://share?link=${encodedUrl}`;
        break;
      case 'reddit':
        shareLink = `https://reddit.com/submit?url=${encodedUrl}&title=${encodeURIComponent(podcast.title)}`;
        break;
      case 'pinterest':
        shareLink = `https://pinterest.com/pin/create/button/?url=${encodedUrl}&description=${encodedText}`;
        break;
      case 'tiktok':
        // TikTok doesn't have a direct share URL, so copy link and show instructions
        await navigator.clipboard.writeText(shareUrl);
        toast.success('Link copied! Open TikTok and paste it in your video description', {
          duration: 5000
        });
        await trackShare('external', platform);
        return;
      case 'email':
        shareLink = `mailto:?subject=${encodeURIComponent(podcast.title)}&body=${encodedText}%0A%0A${encodedUrl}`;
        break;
    }

    if (shareLink) {
      window.open(shareLink, '_blank', 'width=600,height=400');
      await trackShare('external', platform);
    }
  };

  const filteredFriends = friends.filter(friend =>
    friend.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    friend.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    friend.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredGroups = groups.filter(group =>
    group.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share Podcast
          </DialogTitle>
          <DialogDescription>
            Share "{podcast.title}" with friends, groups, or on social media
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="link" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="link">
              <Link className="h-4 w-4 mr-2" />
              Link
            </TabsTrigger>
            <TabsTrigger value="social">
              <Globe className="h-4 w-4 mr-2" />
              Social
            </TabsTrigger>
            <TabsTrigger value="friends">
              <Users className="h-4 w-4 mr-2" />
              Friends
            </TabsTrigger>
            <TabsTrigger value="groups">
              <MessageCircle className="h-4 w-4 mr-2" />
              Groups
            </TabsTrigger>
          </TabsList>

          <TabsContent value="link" className="space-y-4">
            <div className="space-y-2">
              <Label>Share Link</Label>
              <div className="flex gap-2">
                <Input value={shareUrl} readOnly className="flex-1" />
                <Button onClick={handleCopyLink} variant="outline">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Share on External Platforms</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleShareToExternalPlatform('twitter')}
                  className="justify-start"
                >
                  <Twitter className="h-4 w-4 mr-2 text-blue-400" />
                  Twitter/X
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleShareToExternalPlatform('facebook')}
                  className="justify-start"
                >
                  <Facebook className="h-4 w-4 mr-2 text-blue-600" />
                  Facebook
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleShareToExternalPlatform('whatsapp')}
                  className="justify-start"
                >
                  <MessageCircle className="h-4 w-4 mr-2 text-green-600" />
                  WhatsApp
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleShareToExternalPlatform('telegram')}
                  className="justify-start"
                >
                  <Send className="h-4 w-4 mr-2 text-blue-500" />
                  Telegram
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleShareToExternalPlatform('linkedin')}
                  className="justify-start"
                >
                  <Linkedin className="h-4 w-4 mr-2 text-blue-700" />
                  LinkedIn
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleShareToExternalPlatform('reddit')}
                  className="justify-start"
                >
                  <MessageSquare className="h-4 w-4 mr-2 text-orange-600" />
                  Reddit
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleShareToExternalPlatform('pinterest')}
                  className="justify-start"
                >
                  <Share2 className="h-4 w-4 mr-2 text-red-600" />
                  Pinterest
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleShareToExternalPlatform('tiktok')}
                  className="justify-start"
                >
                  <Music className="h-4 w-4 mr-2 text-black dark:text-white" />
                  TikTok
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleShareToExternalPlatform('messenger')}
                  className="justify-start"
                >
                  <MessageCircle className="h-4 w-4 mr-2 text-blue-500" />
                  Messenger
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleShareToExternalPlatform('email')}
                  className="justify-start"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Email
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="social">
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Share this podcast to your public social feed
              </p>
              <Button
                onClick={handleShareToSocialFeed}
                disabled={sharing}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                {sharing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sharing...
                  </>
                ) : (
                  <>
                    <Globe className="h-4 w-4 mr-2" />
                    Share to Feed
                  </>
                )}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="friends" className="space-y-4">
            <Input
              placeholder="Search friends..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            
            <ScrollArea className="h-[300px]">
              {loadingFriends ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : filteredFriends.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  {searchQuery ? 'No friends found' : 'No friends to share with'}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredFriends.map((friend) => (
                    <div
                      key={friend.id}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={friend.avatar_url} />
                          <AvatarFallback>{(friend.display_name || friend.username || 'U')[0].toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{friend.display_name || friend.username}</p>
                          {friend.email && (
                            <p className="text-xs text-slate-500">{friend.email}</p>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleShareToFriend(friend)}
                        disabled={sharing}
                      >
                        Share
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="groups" className="space-y-4">
            <Input
              placeholder="Search groups..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            
            <ScrollArea className="h-[300px]">
              {loadingGroups ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : filteredGroups.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  {searchQuery ? 'No groups found' : 'No groups available'}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredGroups.map((group) => (
                    <div
                      key={group.id}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={group.avatar_url} />
                          <AvatarFallback>{group.name[0]}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{group.name}</p>
                          {group.description && (
                            <p className="text-xs text-slate-500 line-clamp-1">
                              {group.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleShareToGroup(group)}
                        disabled={sharing}
                      >
                        Share
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
