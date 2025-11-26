// GroupDetail.tsx - FULLY REDESIGNED: Bottom Nav as Primary Tabs with Working Chat
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../integrations/supabase/client';
import { Button } from '../../ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';
import { Badge } from '../../ui/badge';
import { Card, CardContent } from '../../ui/card';
import {
  MessageCircle, Calendar, Users, Settings, ArrowLeft,
  Share2, Bell, BellOff, Crown, Shield, Globe, Lock,
  Loader2, ArrowUp, RefreshCw, Home, Search, Plus, User,
  Copy, Check,
  Send,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import {
  FaWhatsapp,
  FaFacebook,
  FaTwitter,
  FaLinkedin,
  FaReddit,
  FaTelegram,
  FaEnvelope
} from 'react-icons/fa';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '../../ui/dialog';

import { GroupPosts } from './GroupPosts';
import { GroupChat } from './GroupChat';
import { GroupEvents } from './GroupEvents';
import { GroupMembers } from './GroupMembers';
import { GroupSettings } from './GroupSettings';
import { GroupHeader } from './GroupHeader';
import { ChatWindow } from './ChatWindow';
import { useChatActions } from '../hooks/useChatActions';
import { useChatData } from '../hooks/useChatData';

interface GroupDetailPageProps {
  currentUser: any;
}

export const GroupDetailPage: React.FC<GroupDetailPageProps> = ({ currentUser }) => {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();

  const [group, setGroup] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMember, setIsMember] = useState(false);
  const [memberRole, setMemberRole] = useState<'admin' | 'moderator' | 'member' | null>(null);
  const [activeSection, setActiveSection] = useState<'posts' | 'chat' | 'events' | 'members' | 'settings' | 'actions'>('posts');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [groupChatSession, setGroupChatSession] = useState<any>(null);
  const [isLoadingChatSession, setIsLoadingChatSession] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const {
    sendChatMessage,
    sendMessageWithResource,
    isSending,
  } = useChatActions(currentUser?.id || null);

  const {
    activeSessionMessages,
    isLoadingMessages,
    setActiveSession,
    refetchMessages,
    chatSessions,
    isLoadingSessions,
    activeSessionId,
    deleteMessage,
    editMessage,
    markSessionMessagesAsRead,
    addOptimisticMessage,
  } = useChatData(currentUser?.id || null);

  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (groupId) {
      fetchGroupDetails();
      if (currentUser) {
        checkMembership();
        fetchOrCreateGroupChatSession();
      }
    }
  }, [groupId, currentUser]);

  // Set active session when group chat session is loaded
  useEffect(() => {
    if (groupChatSession && activeSection === 'chat') {
      setActiveSession(groupChatSession.id);
    }
  }, [groupChatSession, activeSection, setActiveSession]);

  const fetchGroupDetails = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('social_groups')
        .select('*, creator:social_users!social_groups_created_by_fkey(*)')
        .eq('id', groupId)
        .single();

      if (error) throw error;
      setGroup(data);
    } catch (err) {
      toast.error('Failed to load group');
    } finally {
      setIsLoading(false);
    }
  };

  const checkMembership = async () => {
    const { data } = await supabase
      .from('social_group_members')
      .select('role, status')
      .eq('group_id', groupId)
      .eq('user_id', currentUser.id)
      .maybeSingle();

    if (data && data.status === 'active') {
      setIsMember(true);
      setMemberRole(data.role as 'admin' | 'moderator' | 'member');
    }
  };

  const fetchOrCreateGroupChatSession = async () => {
    if (!currentUser?.id || !groupId) return;

    try {
      setIsLoadingChatSession(true);

      // Check if group chat session exists
      const { data: existingSession, error: searchError } = await supabase
        .from('social_chat_sessions')
        .select(`
          *,
          group:social_groups(*),
          user1:social_users!social_chat_sessions_user_id1_fkey(*),
          user2:social_users!social_chat_sessions_user_id2_fkey(*)
        `)
        .eq('chat_type', 'group')
        .eq('group_id', groupId)
        .maybeSingle();

      if (searchError && searchError.code !== 'PGRST116') {
        throw searchError;
      }

      if (existingSession) {
        setGroupChatSession(existingSession);
        return;
      }

      // Create new group chat session if it doesn't exist
      const { data: newSession, error: createError } = await supabase
        .from('social_chat_sessions')
        .insert({
          chat_type: 'group',
          group_id: groupId,
          user_id1: null,
          user_id2: null,
        })
        .select(`
          *,
          group:social_groups(*),
          user1:social_users!social_chat_sessions_user_id1_fkey(*),
          user2:social_users!social_chat_sessions_user_id2_fkey(*)
        `)
        .single();

      if (createError) throw createError;

      setGroupChatSession(newSession);
      toast.success('Group chat initialized');
    } catch (error) {
      console.error('Error loading group chat session:', error);
      toast.error('Failed to load group chat');
    } finally {
      setIsLoadingChatSession(false);
    }
  };

  const handleSendGroupMessage = async (content: string, files?: File[]): Promise<boolean> => {
    if (!groupChatSession?.id) {
      toast.error('Chat session not ready');
      return false;
    }
  
    const result = await sendChatMessage(groupChatSession.id, content, files);
    if (result && addOptimisticMessage) {
      addOptimisticMessage(result);
    }
    return !!result; // Convert to boolean
  };

  const handleSendMessageWithResource = async (
    content: string,
    resourceId: string,
    resourceType: 'note' | 'document' | 'post'
  ): Promise<boolean> => {
    if (!groupChatSession?.id) {
      toast.error('Chat session not ready');
      return false;
    }
  
    const result = await sendMessageWithResource(
      groupChatSession.id,
      content,
      resourceId,
      resourceType
    );
    if (result && addOptimisticMessage) {
      addOptimisticMessage(result);
    }
    return !!result; // Convert to boolean
  };
  const handleLeaveGroup = async () => {
    if (!confirm('Leave this group?')) return;
    const { error } = await supabase
      .from('social_group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', currentUser.id);

    if (error) toast.error('Failed to leave');
    else {
      toast.success('Left group');
      navigate('/social/groups');
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchGroupDetails();
    if (activeSection === 'chat' && groupChatSession) {
      await refetchMessages();
    }
    setIsRefreshing(false);
    toast.success('Refreshed');
  };

  const handleShareGroup = () => {
    setIsShareDialogOpen(true);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Link copied to clipboard!');
  };

  const shareUrl = window.location.href;
  const shareText = `Check out ${group?.name || 'this group'}!`;

  const sharePlatforms = [
    { name: 'WhatsApp', icon: <FaWhatsapp className="h-5 w-5 text-green-600" />, url: `https://wa.me/?text=${encodeURIComponent(shareUrl)}` },
    { name: 'Facebook', icon: <FaFacebook className="h-5 w-5 text-blue-600" />, url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}` },
    { name: 'Twitter', icon: <FaTwitter className="h-5 w-5 text-blue-400" />, url: `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}` },
    { name: 'LinkedIn', icon: <FaLinkedin className="h-5 w-5 text-blue-700" />, url: `https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(shareUrl)}` },
    { name: 'Reddit', icon: <FaReddit className="h-5 w-5 text-orange-600" />, url: `https://reddit.com/submit?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(shareText)}` },
    { name: 'Telegram', icon: <FaTelegram className="h-5 w-5 text-blue-500" />, url: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}` },
    { name: 'Email', icon: <FaEnvelope className="h-5 w-5 text-gray-600" />, url: `mailto:?subject=${encodeURIComponent(shareText)}&body=${encodeURIComponent(shareUrl)}` },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="text-center py-20">
        <p className="text-xl text-slate-500">Group not found</p>
        <Button onClick={() => {navigate('/social/groups'); setActiveSession(null);}} className="mt-4">
          Back to Groups
        </Button>
      </div>
    );
  }

  if (group.privacy === 'private' && !isMember) {
    return (
      <div className="text-center py-20">
        <Lock className="h-16 w-16 mx-auto mb-4 text-slate-400" />
        <h2 className="text-2xl font-bold">Private Group</h2>
        <p className="text-slate-500">You must be a member to access this group</p>
      </div>
    );
  }

  const canManage = memberRole === 'admin' || memberRole === 'moderator';

  return (
    <div className="bg-transparent font-sans min-h-screen">
      <div className="max-w-[1440px] mx-auto">
        {/* Desktop Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 lg:gap-8">
          {/* Left Sidebar */}
          <div className="hidden lg:block lg:col-span-3 sticky top-0 h-screen overflow-y-auto pt-3 pr-8">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border p-6 space-y-6">
              <div className="flex items-center gap-4">
                <Avatar className="h-14 w-14">
                  <AvatarImage src={currentUser?.avatar_url} />
                  <AvatarFallback>{currentUser?.display_name?.[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-bold">{currentUser?.display_name}</p>
                  <p className="text-sm text-slate-500">@{currentUser?.username}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <main className="col-span-1 lg:col-span-6 max-h-screen overflow-y-auto modern-scrollbar lg:pb-10">
            <div ref={topRef} />

            {/* Content Sections - Controlled by Bottom Nav */}
            <div className="">
              {activeSection === 'posts' && (
                <div className="max-h-[calc(100vh-5rem)]  lg:max-h-[calc(100vh-5rem)] pt-6 overflow-y-auto modern-scrollbar pb-10">
                  <GroupHeader
                    group={group}
                    isMember={isMember}
                    canManage={canManage}
                    onOpenSettings={() => setActiveSection('settings')}
                  />
                  <GroupPosts groupId={groupId!} currentUser={currentUser} />
                </div>
              )}

              {activeSection === 'chat' && (
                <div className="fixed inset-0 lg:inset-auto animate-in fade-in duration-500 lg:h-[90vh]  bg-white dark:bg-slate-900 z-40 lg:z-10  overflow-hidden flex">
                  <div className='fixed inset-0 lg:inset-auto lg:relative bg-white dark:bg-slate-900 flex flex-col lg:w-[40vw] w-full  shadow-lg border'>
                    {isLoadingChatSession ? (
                      <div className="flex items-center justify-center h-full">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                      </div>
                    ) : groupChatSession ? (
                      <>

                        <ChatWindow
                          session={groupChatSession}
                          messages={activeSessionMessages}
                          currentUserId={currentUser.id}
                          onBack={() => setActiveSection('posts')}
                          onSendMessage={handleSendGroupMessage}
                          onSendMessageWithResource={handleSendMessageWithResource}
                          isSending={isSending}
                          isLoading={isLoadingMessages}
                          editMessage={editMessage} 
                          deleteMessage={deleteMessage}
                        />
                      </>
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                          <MessageCircle className="h-12 w-12 mx-auto mb-4 text-slate-400" />
                          <p className="text-slate-500">Failed to load group chat</p>
                          <Button
                            onClick={fetchOrCreateGroupChatSession}
                            className="mt-4"
                          >
                            Retry
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeSection === 'events' && (
                <GroupEvents groupId={groupId!} currentUser={currentUser} canManage={canManage} />
              )}

              {activeSection === 'members' && (
                <GroupMembers
                  groupId={groupId!}
                  currentUser={currentUser}
                  currentGroup={group}
                  onLeaveGroup={() => handleLeaveGroup().then(() => true)}
                />
              )}

              {activeSection === 'settings' && canManage && (
                <GroupSettings
                  groupId={groupId!}
                  group={group}
                  currentUser={currentUser}
                  onGroupUpdate={fetchGroupDetails}
                />
              )}

              {/* Mobile Actions Section */}
              {activeSection === 'actions' && (
                <div className="p-4 space-y-4 pb-24">
                  <Card className="dark:bg-slate-900 shadow-sm border">
                    <CardContent className="pt-6 space-y-3">
                      <h2 className="text-xl font-bold mb-4">Group Actions</h2>

                      {canManage && (
                        <Button onClick={() => setActiveSection('settings')} className="w-full">
                          <Settings className="h-4 w-4 mr-2" /> Manage Group
                        </Button>
                      )}

                      <Button
                        variant="outline"
                        onClick={handleShareGroup}
                        className="w-full"
                      >
                        <Share2 className="h-4 w-4 mr-2" />
                        Share Group
                      </Button>

                      {isMember && (
                        <Button
                          variant="destructive"
                          onClick={handleLeaveGroup}
                          className="w-full"
                        >
                          Leave Group
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </main>

          {/* Right Sidebar */}
          <div className="hidden lg:block lg:col-span-3 sticky top-0 pt-3">
            <div className="space-y-4">
              {isMember && (
                <Card className="dark:bg-slate-900 shadow-sm border">
                  <CardContent className="pt-6 space-y-3 rounded-2xl bg-white dark:bg-slate-900">
                    {canManage && (
                      <Button onClick={() => setActiveSection('settings')} className="w-full">
                        <Settings className="h-4 w-4 mr-2" /> Manage Group
                      </Button>
                    )}

                    {!canManage && (
                      <Button variant="outline" onClick={handleLeaveGroup} className="w-full">
                        Leave Group
                      </Button>
                    )}
                    <Button variant="outline" onClick={() => setActiveSection('chat')} className="w-full">
                      <Send className="h-4 w-4 mr-2" />
                      Chat
                    </Button>
                    <Button variant="outline" onClick={() => setActiveSection('events')} className="w-full">
                      <Calendar className="h-4 w-4 mr-2" />
                      View Events
                    </Button>
                    <Button variant="outline" onClick={() => setActiveSection('members')} className="w-full">
                      <Users className="h-4 w-4 mr-2" />
                      View Members
                    </Button>
                    <Button variant="outline" onClick={() => setActiveSection('posts')} className="w-full">
                      <MessageCircle className="h-4 w-4 mr-2" />
                      View Posts
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleShareGroup}
                      className="w-full"
                    >
                      <Share2 className="h-4 w-4 mr-2" />
                      Share Group
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>

        {/* Share Group Dialog */}
        <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
          <DialogContent>
            <DialogTitle className="text-lg font-semibold mb-4">Share this group</DialogTitle>
            <DialogDescription className="mb-6 text-sm text-slate-500">
              Choose a platform to share this group:
            </DialogDescription>
            <div className="space-y-3">
              {sharePlatforms.map((platform) => (
                <Button
                  key={platform.name}
                  variant="outline"
                  className="w-full flex items-center justify-start gap-3 py-6"
                  onClick={() => {
                    window.open(platform.url, '_blank', 'noopener,noreferrer');
                    setIsShareDialogOpen(false);
                  }}
                >
                  {platform.icon}
                  <span>{platform.name}</span>
                </Button>
              ))}
              <Button
                variant="outline"
                className="w-full flex items-center justify-start gap-3 py-6"
                onClick={handleCopyLink}
              >
                {copied ? <Check className="h-5 w-5 text-green-600" /> : <Copy className="h-5 w-5" />}
                <span>{copied ? 'Copied!' : 'Copy Link'}</span>
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* BOTTOM NAVIGATION - NOW CONTROLS GROUP SECTIONS */}
        {group && (
          <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 pb-safe ">
            <div className="flex justify-around items-center h-16">
              {/* Posts */}
              <button
                onClick={() => setActiveSection('posts')}
                className={`flex flex-col items-center pt-2 pb-1 flex-1 ${activeSection === 'posts' ? 'text-blue-600' : 'text-slate-500'
                  }`}
              >
                <MessageCircle className="h-6 w-6" />
                <span className="text-xs mt-1">Posts</span>
              </button>

              {/* Chat */}
              <button
                onClick={() => setActiveSection('chat')}
                className={`flex flex-col items-center pt-2 pb-1 flex-1 ${activeSection === 'chat' ? 'text-blue-600' : 'text-slate-500'
                  }`}
              >
                <Send className="h-6 w-6" />
                <span className="text-xs mt-1">Chat</span>
              </button>

              {/* Events */}
              <button
                onClick={() => setActiveSection('events')}
                className={`flex flex-col items-center pt-2 pb-1 flex-1 ${activeSection === 'events' ? 'text-blue-600' : 'text-slate-500'
                  }`}
              >
                <Calendar className="h-6 w-6" />
                <span className="text-xs mt-1">Events</span>
              </button>

              {/* Members */}
              <button
                onClick={() => setActiveSection('members')}
                className={`flex flex-col items-center pt-2 pb-1 flex-1 ${activeSection === 'members' ? 'text-blue-600' : 'text-slate-500'
                  }`}
              >
                <Users className="h-6 w-6" />
                <span className="text-xs mt-1">Members</span>
              </button>

              {/* More/Actions - Always visible on mobile */}
              <button
                onClick={() => setActiveSection('actions')}
                className={`flex flex-col items-center pt-2 pb-1 flex-1 ${activeSection === 'actions' ? 'text-blue-600' : 'text-slate-500'
                  }`}
              >
                <Settings className="h-6 w-6" />
                <span className="text-xs mt-1">More</span>
              </button>
            </div>
          </div>
        )}

        {activeSection !== 'chat' && (
          <div className="fixed right-6 bottom-24 lg:bottom-8 z-50 flex flex-col gap-3">
            <button
              onClick={handleRefresh}
              className="h-11 w-11 rounded-full bg-white dark:bg-slate-900 shadow-lg border flex items-center justify-center"
            >
              <RefreshCw className={`h-5 w-5 text-blue-600 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};