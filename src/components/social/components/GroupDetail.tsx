// GroupDetail.tsx - FULLY REDESIGNED: Bottom Nav as Primary Tabs
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
  Loader2, ArrowUp, RefreshCw, Home, Search, Plus, User
} from 'lucide-react';
import { toast } from 'sonner';

import { GroupPosts } from './GroupPosts';
import { GroupChat } from './GroupChat';
import { GroupEvents } from './GroupEvents';
import { GroupMembers } from './GroupMembers';
import { GroupSettings } from './GroupSettings';
import { GroupHeader } from './GroupHeader';

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
  const [activeSection, setActiveSection] = useState<'posts' | 'chat' | 'events' | 'members' | 'settings'>('posts');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (groupId) {
      fetchGroupDetails();
      if (currentUser) checkMembership();
    }
  }, [groupId, currentUser]);

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
    setIsRefreshing(false);
    toast.success('Refreshed');
  };

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
        <Button onClick={() => navigate('/social/groups')} className="mt-4">
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
          <main className="col-span-1 lg:col-span-6 max-h-screen overflow-y-auto modern-scrollbar  lg:pb-10">
            <div ref={topRef} />

            {/* Content Sections - Controlled by Bottom Nav */}
            <div className="pt-3 lg:pt-0">
              {activeSection === 'posts' && (
                <div className=" max-h-[calc(100vh-5rem)] lg:max-h-[calc(100vh-5rem)]  pt-6 overflow-y-auto modern-scrollbar pb-10">
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
                <>
                  <div className=" top-14  left-2 z-10">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveSection('posts')}
                      className="bg-blue-100 backdrop-blur-md hover:bg-blue-200 dark:bg-gray-200 text-blue-600 dark:text-gray-800 border border-white/30"
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </Button>
                  </div>
                  <GroupChat
                    groupId={groupId!}
                    currentUser={currentUser}
                    isMember={isMember}

                    onOpenSettings={() => setActiveSection('settings')}
                  />
                </>
              )}
              {activeSection === 'events' && <GroupEvents groupId={groupId!} currentUser={currentUser} canManage={canManage} />}
              {activeSection === 'members' && <GroupMembers groupId={groupId!} currentUser={currentUser} currentGroup={group} onLeaveGroup={() => handleLeaveGroup().then(() => true)} />}
              {activeSection === 'settings' && canManage && <GroupSettings groupId={groupId!} group={group} currentUser={currentUser} onGroupUpdate={fetchGroupDetails} />}
            </div>
          </main>

          {/* Right Sidebar */}
          <div className="hidden lg:block lg:col-span-3 sticky top-0 pt-3">
            <div className="space-y-4">
              {isMember && (
                <Card className='dark:bg-slate-900 shadow-sm border'>
                  <CardContent className="pt-6 space-y-3 rounded-2xl  bg-white dark:bg-slate-900">
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
                      Chat
                    </Button>
                    <Button variant="outline" onClick={() => setActiveSection('events')} className="w-full">
                      View Events
                    </Button>
                    <Button variant="outline" onClick={() => setActiveSection('members')} className="w-full">
                      View Members
                    </Button>
                    <Button variant="outline" onClick={() => setActiveSection('posts')} className="w-full">
                      View Posts
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>

        {/* BOTTOM NAVIGATION - NOW CONTROLS GROUP SECTIONS */}
        {activeSection !== "chat" && (
          <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 pb-safe z-50">
            <div className="flex justify-around items-center h-16">
              {/* Posts */}
              <button
                onClick={() => setActiveSection('posts')}
                className={`flex flex-col items-center pt-2 pb-1 flex-1 ${activeSection === 'posts' ? 'text-blue-600' : 'text-slate-500'}`}
              >
                <MessageCircle className="h-6 w-6" />
                <span className="text-xs mt-1">Posts</span>
              </button>

              {/* Chat */}
              <button
                onClick={() => setActiveSection('chat')}
                className={`flex flex-col items-center pt-2 pb-1 flex-1`}
              >
                <MessageCircle className="h-6 w-6" />
                <span className="text-xs mt-1">Chat</span>
              </button>

              {/* Events */}
              <button
                onClick={() => setActiveSection('events')}
                className={`flex flex-col items-center pt-2 pb-1 flex-1 ${activeSection === 'events' ? 'text-blue-600' : 'text-slate-500'}`}
              >
                <Calendar className="h-6 w-6" />
                <span className="text-xs mt-1">Events</span>
              </button>

              {/* Members */}
              <button
                onClick={() => setActiveSection('members')}
                className={`flex flex-col items-center pt-2 pb-1 flex-1 ${activeSection === 'members' ? 'text-blue-600' : 'text-slate-500'}`}
              >
                <Users className="h-6 w-6" />
                <span className="text-xs mt-1">Members</span>
              </button>

              {/* Settings (only if admin/moderator) */}
              {canManage && (
                <button
                  onClick={() => setActiveSection('settings')}
                  className={`flex flex-col items-center pt-2 pb-1 flex-1 ${activeSection === 'settings' ? 'text-blue-600' : 'text-slate-500'}`}
                >
                  <Settings className="h-6 w-6" />
                  <span className="text-xs mt-1">Settings</span>
                </button>
              )}
            </div>
          </div>

        )}
        {activeSection !== "chat" && (
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