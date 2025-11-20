import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { Button } from '../../ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';
import { Badge } from '../../ui/badge';
import { Card, CardContent } from '../../ui/card';
import {
  ArrowLeft,
  Users,
  MessageCircle,
  Calendar,
  Settings,
  Share2,
  Bell,
  BellOff,
  Crown,
  Shield,
  Globe,
  Lock,
  Loader2,
  TrendingUp
} from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent } from '../../ui/dialog';

// Import the components we'll enhance
import { GroupChat } from './GroupChat';
import { GroupEvents } from './GroupEvents';
import { GroupMembers } from './GroupMembers';
import { GroupPosts } from './GroupPosts';
import { GroupSettings } from './GroupSettings';

interface GroupDetailPageProps {
  currentUser: any;
}

export const GroupDetailPage: React.FC<GroupDetailPageProps> = ({ currentUser }) => {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();

  const [group, setGroup] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckingMembership, setIsCheckingMembership] = useState(true);
  const [activeTab, setActiveTab] = useState<'posts' | 'chat' | 'events' | 'members' | 'settings'>('posts');
  const [isNotificationsEnabled, setIsNotificationsEnabled] = useState(true);
  const [isMember, setIsMember] = useState(false);
  const [memberRole, setMemberRole] = useState<'admin' | 'moderator' | 'member' | null>(null);
  const [memberStatus, setMemberStatus] = useState<'active' | 'pending' | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  useEffect(() => {
    if (groupId && currentUser) {
      fetchGroupDetails();
      checkMembershipStatus();
    } else if (groupId && !currentUser) {
      // If no currentUser yet, just fetch group details
      fetchGroupDetails();
      setIsCheckingMembership(false);
    }
  }, [groupId, currentUser]);

  const fetchGroupDetails = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('social_groups')
        .select(`
          *,
          creator:social_users!social_groups_created_by_fkey(*)
        `)
        .eq('id', groupId)
        .single();

      if (error) throw error;
      setGroup(data);
    } catch (error) {
      console.error('Error fetching group:', error);
      toast.error('Failed to load group details');
    } finally {
      setIsLoading(false);
    }
  };

  const checkMembershipStatus = async () => {
    if (!currentUser || !groupId) {
      setIsCheckingMembership(false);
      return;
    }

    try {
      setIsCheckingMembership(true);
      const { data, error } = await supabase
        .from('social_group_members')
        .select('role, status')
        .eq('group_id', groupId)
        .eq('user_id', currentUser.id)
        .maybeSingle(); // Use maybeSingle instead of single to avoid error if no row

      if (!error && data) {
        setIsMember(data.status === 'active');
        setMemberRole(data.role as 'admin' | 'moderator' | 'member');
        setMemberStatus(data.status as 'active' | 'pending');
      } else {
        setIsMember(false);
        setMemberRole(null);
        setMemberStatus(null);
      }
    } catch (error) {
      console.error('Error checking membership:', error);
      setIsMember(false);
      setMemberRole(null);
      setMemberStatus(null);
    } finally {
      setIsCheckingMembership(false);
    }
  };
  const LeaveGroup = async (groupId: string): Promise<boolean> => {
    try {
      // Logic to leave the group using Supabase
      const { error } = await supabase
        .from('social_group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', currentUser.id); // Assuming currentUser is available

      if (error) throw error;
      return true; // Return true on success
    } catch (error) {
      console.error('Error leaving group:', error);
      return false; // Return false on failure
    }
  };
  const handleLeaveGroup = async () => {
    if (!window.confirm('Are you sure you want to leave this group?')) return;

    try {
      const { error } = await supabase
        .from('social_group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', currentUser.id);

      if (error) throw error;

      toast.success('Left group successfully');
      navigate('/social/groups');
    } catch (error) {
      console.error('Error leaving group:', error);
      toast.error('Failed to leave group');
    }
  };

  const shareUrl = `${window.location.origin}/social/group/${groupId}`;
  const shareText = `Join ${group?.name}! ${group?.description?.slice(0, 200) || ''}`;

  const shareNative = async () => {
    setIsShareModalOpen(false);
    if (navigator.share) {
      try {
        await navigator.share({ title: group?.name, text: shareText, url: shareUrl });
        toast.success('Shared');
        return;
      } catch (err: any) {
        const name = err?.name;
        if (name === 'AbortError' || name === 'NotAllowedError') {
          toast.info('Share cancelled');
          return;
        }
        console.warn('Native share error', err);
      }
    }
    toast.error('Native share not available');
  };

  const shareWhatsApp = async () => {
    setIsShareModalOpen(false);
    const encoded = encodeURIComponent(`${shareText}\n\n${shareUrl}`);
    const ua = navigator.userAgent || '';
    const isMobile = /Android|iPhone|iPad|iPod|Windows Phone/i.test(ua);
    const waUrl = isMobile ? `whatsapp://send?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    window.open(waUrl, '_blank');
  };

  const shareFacebook = async () => {
    setIsShareModalOpen(false);
    const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`;
    window.open(fbUrl, '_blank');
  };

  const shareTwitter = async () => {
    setIsShareModalOpen(false);
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(twitterUrl, '_blank');
  };

  const shareCopyLink = async () => {
    setIsShareModalOpen(false);
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Link copied to clipboard');
    } catch {
      toast.error('Unable to copy link');
    }
  };

  const handleShareGroup = () => {
    setIsShareModalOpen(true);
  };

  const toggleNotifications = async () => {
    setIsNotificationsEnabled(!isNotificationsEnabled);
    toast.success(`Notifications ${!isNotificationsEnabled ? 'enabled' : 'disabled'}`);
  };

  // Show loading while fetching group or checking membership
  if (isLoading || isCheckingMembership) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 dark:text-blue-400" />
          <p className="text-slate-600 dark:text-gray-300">
            {isLoading ? 'Loading group...' : 'Checking membership...'}
          </p>
        </div>
      </div>
    );
  }

  // Show error if group not found
  if (!group) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center">
            <Users className="h-16 w-16 mx-auto mb-4 text-slate-400" />
            <h2 className="text-2xl font-bold mb-2">Group Not Found</h2>
            <p className="text-slate-600 dark:text-gray-400 mb-6">
              This group doesn't exist or has been deleted.
            </p>
            <Button onClick={() => navigate('/social/groups')} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Groups
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show access denied only if:
  // 1. Group is private AND
  // 2. User is not a member (or membership is not active)
  if (group.privacy === 'private' && !isMember) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center">
            <Lock className="h-16 w-16 mx-auto mb-4 text-slate-400" />
            <h2 className="text-2xl font-bold mb-2">
              {memberStatus === 'pending' ? 'Membership Pending' : 'Access Denied'}
            </h2>
            <p className="text-slate-600 dark:text-gray-400 mb-6">
              {memberStatus === 'pending'
                ? 'Your request to join this private group is pending approval.'
                : 'You need to be a member to view this private group.'}
            </p>
            <Button onClick={() => navigate('/social/groups')} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Groups
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const canManageGroup = memberRole === 'admin' || memberRole === 'moderator';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-6 max-w-[55vw] animate-in fade-in duration-500">
        {/* Header Section */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/social/groups')}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Groups
          </Button>

          {/* Group Cover Image */}
          <Card className="overflow-hidden">
            <div className="relative h-48 bg-gradient-to-r from-blue-600 to-blue-700">
              {group.cover_image_url && (
                <img
                  src={group.cover_image_url}
                  alt="Group cover"
                  className="w-full h-full object-cover"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            </div>

            <CardContent className="pt-0 pb-6">
              {/* Group Avatar and Basic Info */}
              <div className="flex flex-col md:flex-row items-start md:items-end gap-4 -mt-16 relative">
                <Avatar className="h-32 w-32 border-4 border-white dark:border-gray-800 ring-4 ring-white/50 dark:ring-gray-700/50 shadow-xl">
                  <AvatarImage src={group.avatar_url} alt={group.name} />
                  <AvatarFallback className="text-3xl bg-gradient-to-br from-blue-500 to-blue-700 text-white">
                    {group.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 md:pb-2">
                  <div className="flex flex-col md:flex-row md:items-center gap-2 mb-2">
                    <h1 className="text-3xl font-bold text-slate-800 dark:text-white">
                      {group.name}
                    </h1>
                    <div className="flex gap-2">
                      {group.privacy === 'private' ? (
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <Lock className="h-3 w-3" />
                          Private
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <Globe className="h-3 w-3" />
                          Public
                        </Badge>
                      )}
                      {memberRole === 'admin' && (
                        <Badge className="bg-yellow-500 text-white flex items-center gap-1">
                          <Crown className="h-3 w-3" />
                          Admin
                        </Badge>
                      )}
                      {memberRole === 'moderator' && (
                        <Badge className="bg-blue-500 text-white flex items-center gap-1">
                          <Shield className="h-3 w-3" />
                          Moderator
                        </Badge>
                      )}
                    </div>
                  </div>

                  <p className="text-slate-600 dark:text-gray-400 mb-3 max-w-2xl">
                    {group.description}
                  </p>

                  <div className="flex flex-wrap gap-4 text-sm text-slate-600 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      {group.members_count} members
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle className="h-4 w-4" />
                      {group.posts_count} posts
                    </span>
                    <span className="flex items-center gap-1">
                      <TrendingUp className="h-4 w-4" />
                      {group.category}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                {isMember && (
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={toggleNotifications} variant="outline" size="sm">
                      {isNotificationsEnabled ? (
                        <Bell className="h-4 w-4 mr-2" />
                      ) : (
                        <BellOff className="h-4 w-4 mr-2" />
                      )}
                      Notifications
                    </Button>
                    <Button onClick={handleShareGroup} variant="outline" size="sm">
                      <Share2 className="h-4 w-4 mr-2" />
                      Share
                    </Button>
                    {canManageGroup ? (
                      <Button
                        onClick={() => setActiveTab('settings')}
                        variant="default"
                        size="sm"
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        Manage
                      </Button>
                    ) : (
                      <Button onClick={handleLeaveGroup} variant="outline" size="sm">
                        Leave Group
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs Section */}
        <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
          <TabsList className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-md rounded-lg p-1 border border-slate-200 dark:border-gray-700 grid grid-cols-5 w-full">
            <TabsTrigger value="posts" className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700">
              <MessageCircle className="h-4 w-4 mr-2" />
              Posts
            </TabsTrigger>
            <TabsTrigger value="chat" className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700">
              <MessageCircle className="h-4 w-4 mr-2" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="events" className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700">
              <Calendar className="h-4 w-4 mr-2" />
              Events
            </TabsTrigger>
            <TabsTrigger value="members" className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700">
              <Users className="h-4 w-4 mr-2" />
              Members
            </TabsTrigger>
            {canManageGroup && (
              <TabsTrigger value="settings" className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </TabsTrigger>
            )}
          </TabsList>

          <div className="mt-6">
            <TabsContent value="posts">
              <GroupPosts groupId={groupId!} currentUser={currentUser} />
            </TabsContent>

            <TabsContent value="chat">
              <GroupChat groupId={groupId!} currentUser={currentUser} />
            </TabsContent>

            <TabsContent value="events">
              <GroupEvents
                groupId={groupId!}
                currentUser={currentUser}
                canManage={canManageGroup}
              />
            </TabsContent>

            <TabsContent value="members">
              <GroupMembers
                groupId={groupId!}
                currentUser={currentUser}
                currentGroup={group}
                onLeaveGroup={LeaveGroup}
              />
            </TabsContent>

            {canManageGroup && (
              <TabsContent value="settings">
                <GroupSettings
                  groupId={groupId!}
                  group={group}
                  currentUser={currentUser}
                  onGroupUpdate={fetchGroupDetails}
                />
              </TabsContent>
            )}
          </div>
        </Tabs>
      </div>

      {/* Share Modal */}
      <Dialog open={isShareModalOpen} onOpenChange={setIsShareModalOpen}>
        <DialogContent className="max-w-sm w-[95vw] p-0 bg-transparent border-none">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-lg p-4 space-y-3">
            <h3 className="text-lg font-semibold">Share group</h3>
            <p className="text-sm text-slate-500">Choose where you'd like to share this group</p>
            <div className="grid grid-cols-1 gap-2">
              {navigator.share && (
                <Button onClick={shareNative} className="justify-start">🔤 Share via device</Button>
              )}
              <Button onClick={shareWhatsApp} className="justify-start">📱 WhatsApp</Button>
              <Button onClick={shareFacebook} className="justify-start">👍 Facebook</Button>
              <Button onClick={shareTwitter} className="justify-start">🦅 Twitter</Button>
              <Button variant="outline" onClick={shareCopyLink} className="justify-start">🔗 Copy link</Button>
              <div className="flex justify-end pt-2">
                <Button variant="ghost" onClick={() => setIsShareModalOpen(false)}>Cancel</Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};