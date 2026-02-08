import React, { RefObject } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Users, Plus, Lock, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { SocialNotification } from '../../hooks/useSocialNotifications';

interface SocialFeedRightSidebarProps {
  activeTab: string;
  currentUser: any;
  groups: any[];
  notifications: SocialNotification[];
  uniqueSuggestedUsers: any[];
  hasMoreSuggestedUsers: boolean;
  isLoadingSuggestedUsers: boolean;
  suggestedContainerRef: RefObject<HTMLDivElement>;
  suggestedObserverRef: RefObject<HTMLDivElement>;
  canCreatePosts: boolean;
  canCreateNewGroups: boolean;
  onToggleFollow: (userId: string) => void;
  onShowPostDialog: () => void;
}

export const SocialFeedRightSidebar: React.FC<SocialFeedRightSidebarProps> = ({
  activeTab,
  currentUser,
  groups,
  notifications,
  uniqueSuggestedUsers,
  hasMoreSuggestedUsers,
  isLoadingSuggestedUsers,
  suggestedContainerRef,
  suggestedObserverRef,
  canCreatePosts,
  canCreateNewGroups,
  onToggleFollow,
  onShowPostDialog,
}) => {
  const navigate = useNavigate();

  return (
    <div className="hidden lg:block lg:col-span-3 sticky top-0 lg:pb-20 lg:pt-3">
      <div className="space-y-6 w-full max-w-[350px] max-h-[90vh] rounded-2xl shadow-sm overflow-y-auto modern-scrollbar">

        {/* Feed tab widgets */}
        {activeTab === 'feed' && (
          <QuickActionsWidget
            canCreatePosts={canCreatePosts}
            canCreateNewGroups={canCreateNewGroups}
            onShowPostDialog={onShowPostDialog}
          />
        )}

        {/* Trending tab widgets */}
        {activeTab === 'trending' && (
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 rounded-2xl shadow-sm border border-blue-100 dark:border-slate-700 overflow-hidden">
            <div className="p-4">
              <h3 className="font-bold text-lg mb-3 text-blue-900 dark:text-blue-100">Quick Actions</h3>
              <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start bg-white dark:bg-slate-800" onClick={() => navigate('/social/groups')}>
                  <Users className="h-4 w-4 mr-2" /> Browse Groups
                </Button>
                <Button variant="outline" className="w-full justify-start bg-white dark:bg-slate-800" onClick={() => navigate('/social/feed')}>
                  <Users className="h-4 w-4 mr-2" /> Browse Feeds
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Groups tab widgets */}
        {activeTab === 'groups' && (
          <GroupsSidebarWidgets
            groups={groups}
            canCreateNewGroups={canCreateNewGroups}
          />
        )}

        {/* Profile tab: Who to follow */}
        {activeTab === 'profile' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 sticky top-6">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-lg">Who to follow</h3>
            </div>
            <div ref={suggestedContainerRef as any} className="p-4 space-y-4 overflow-y-scroll max-h-[500px] modern-scrollbar">
              {uniqueSuggestedUsers.map((user) => (
                <div key={user.id} className="flex items-center justify-between gap-3">
                  <div
                    className="flex items-center gap-2 overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => navigate(`/social/profile/${user.id}`)}
                  >
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={user.avatar_url} />
                      <AvatarFallback>{user.display_name?.[0]}</AvatarFallback>
                    </Avatar>
                    <div className="truncate">
                      <p className="font-semibold text-sm truncate">{user.display_name}</p>
                      <p className="text-xs text-slate-500 truncate">@{user.username}</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFollow(user.id);
                    }}
                    className="h-8 rounded-full px-3 text-xs"
                  >
                    Follow
                  </Button>
                </div>
              ))}
              <div ref={suggestedObserverRef as any} className="h-6" />
              {isLoadingSuggestedUsers && <div className="text-center text-sm text-slate-500 py-2">Loading more...</div>}
              {!hasMoreSuggestedUsers && uniqueSuggestedUsers.length > 10 && (
                <div className="text-center text-xs text-slate-400 py-2">No more suggestions</div>
              )}
            </div>
          </div>
        )}

        {/* Notifications tab widgets */}
        {activeTab === 'notifications' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-lg">Activity Types</h3>
            </div>
            <div className="p-4 space-y-3">
              {['like', 'comment', 'follow', 'mention'].map((type) => {
                const count = notifications.filter(n => n.type === type).length;
                return (
                  <div key={type} className="flex items-center justify-between">
                    <div className="text-sm capitalize">{type}s</div>
                    <div className="font-semibold">{count}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* ---- Sub-widgets ---- */

const QuickActionsWidget: React.FC<{
  canCreatePosts: boolean;
  canCreateNewGroups: boolean;
  onShowPostDialog: () => void;
}> = ({ canCreatePosts, canCreateNewGroups, onShowPostDialog }) => {
  const navigate = useNavigate();
  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 rounded-2xl shadow-sm border border-blue-100 dark:border-slate-700 overflow-hidden">
      <div className="p-4">
        <h3 className="font-bold text-lg mb-3 text-blue-900 dark:text-blue-100">Quick Actions</h3>
        <div className="space-y-2">
          <Button
            variant="outline"
            className="w-full justify-start bg-white dark:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => {
              if (!canCreatePosts) {
                toast.error('Posts are available for Scholar and Genius plans');
                return;
              }
              onShowPostDialog();
            }}
            disabled={!canCreatePosts}
            title={!canCreatePosts ? 'Upgrade to Scholar or Genius to create posts' : 'Create a new post'}
          >
            {!canCreatePosts && <Lock className="h-4 w-4 mr-2" />}
            <Plus className={!canCreatePosts ? '' : 'h-4 w-4 mr-2'} /> Create Post
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start bg-white dark:bg-slate-800"
            onClick={() => navigate('/social/groups')}
          >
            <Users className="h-4 w-4 mr-2" /> Browse Groups
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start bg-white dark:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => {
              if (!canCreateNewGroups) {
                toast.error('Groups are available for Scholar and Genius plans');
                return;
              }
              navigate('/social/groups');
              setTimeout(() => {
                const event = new CustomEvent('triggerCreateGroup');
                window.dispatchEvent(event);
              }, 100);
            }}
            disabled={!canCreateNewGroups}
            title={!canCreateNewGroups ? 'Upgrade to Scholar or Genius to create groups' : 'Create a new group'}
          >
            {!canCreateNewGroups && <Lock className="h-4 w-4 mr-2" />}
            <Plus className={!canCreateNewGroups ? '' : 'h-4 w-4 mr-2'} /> Create Group
          </Button>
        </div>
      </div>
    </div>
  );
};

const GroupsSidebarWidgets: React.FC<{
  groups: any[];
  canCreateNewGroups: boolean;
}> = ({ groups, canCreateNewGroups }) => {
  return (
    <>
      {/* Group Stats */}
      <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-slate-900 dark:to-slate-800 rounded-2xl shadow-sm border border-green-100 dark:border-slate-700 overflow-hidden">
        <div className="p-4">
          <h3 className="font-bold text-lg mb-3 flex items-center gap-2 text-green-900 dark:text-green-100">
            <Users className="h-5 w-5" /> Your Groups
          </h3>
          <div className="space-y-3">
            <div className="bg-white dark:bg-slate-800 rounded-lg p-3">
              <div className="text-2xl font-bold text-green-600">{groups.filter(g => g.is_member).length}</div>
              <div className="text-xs text-slate-500">Joined Groups</div>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-lg p-3">
              <div className="text-2xl font-bold text-emerald-600">{groups.length}</div>
              <div className="text-xs text-slate-500">Total Groups</div>
            </div>
          </div>
          <Button
            className="w-full mt-3 disabled:opacity-50 disabled:cursor-not-allowed"
            size="sm"
            onClick={() => {
              if (!canCreateNewGroups) {
                toast.error('Groups are available for Scholar and Genius plans');
                return;
              }
              setTimeout(() => {
                const event = new CustomEvent('triggerCreateGroup');
                window.dispatchEvent(event);
              }, 100);
            }}
            disabled={!canCreateNewGroups}
            title={!canCreateNewGroups ? 'Upgrade to Scholar or Genius to create groups' : 'Create a new group'}
          >
            {!canCreateNewGroups && <Lock className="h-4 w-4 mr-2" />}
            <Plus className={!canCreateNewGroups ? '' : 'h-4 w-4 mr-2'} /> Create Group
          </Button>
        </div>
      </div>

      {/* Popular Groups */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="font-bold text-lg">Active Study Groups</h3>
        </div>
        <div className="p-4 space-y-3">
          {groups.slice(0, 5).map((group) => (
            <div key={group.id} className="flex items-start gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={group.avatar_url} />
                <AvatarFallback>{group.name?.[0]}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm truncate">{group.name}</div>
                <div className="text-xs text-slate-500">{group.members_count} members</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};
