import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

interface SocialFeedLeftSidebarProps {
  currentUser: any;
  onViewProfile: () => void;
}

export const SocialFeedLeftSidebar: React.FC<SocialFeedLeftSidebarProps> = ({
  currentUser,
  onViewProfile,
}) => {
  return (
    <div className="hidden lg:block lg:col-span-3 sticky top-0 h-screen lg:pt-3 overflow-y-auto scrollbar-hide pr-8 modern-scrollbar">
      <div className="space-y-6 w-full max-w-[350px]">
        {/* Profile Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
          <div className="p-4">
            <div className="flex items-center gap-3 mb-4">
              <Avatar className="h-12 w-12">
                <AvatarImage src={currentUser?.avatar_url} />
                <AvatarFallback>{currentUser?.display_name?.[0]}</AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-bold text-lg">{currentUser?.display_name}</h3>
                <p className="text-sm text-slate-500">@{currentUser?.username}</p>
              </div>
            </div>
            <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-500">Connections</span>
                <span className="font-medium">{currentUser?.followers_count || 0}</span>
              </div>
              <div className="flex justify-between text-sm mb-4">
                <span className="text-slate-500">Following</span>
                <span className="font-medium">{currentUser?.following_count || 0}</span>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={onViewProfile}
              >
                View Profile
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
