import React, { useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Users, UserPlus, RefreshCw, Lock, Globe } from 'lucide-react';
import { SocialGroupWithDetails, SocialUserWithDetails } from '../../../integrations/supabase/socialTypes';
import { formatEngagementCount, getTimeAgo } from '../utils/postUtils';

interface GroupsSectionProps {
  groups: SocialGroupWithDetails[];
  isLoading: boolean;
  onJoinGroup: (groupId: string) => Promise<void>;
  currentUser: SocialUserWithDetails | null;
  hasMore?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
}

export const GroupsSection: React.FC<GroupsSectionProps> = ({
  groups,
  isLoading,
  onJoinGroup,
  currentUser,
  hasMore = false,
  onLoadMore,
  isLoadingMore = false,
}) => {
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Setup intersection observer for infinite scroll
  useEffect(() => {
    if (!loadMoreRef.current || !onLoadMore || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          onLoadMore();
        }
      },
      {
        threshold: 0.1,
        rootMargin: '200px',
      }
    );

    observer.observe(loadMoreRef.current);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, isLoadingMore, onLoadMore]);

  // Loading state for initial load
  if (isLoading && groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400 mb-4" />
        <p className="text-slate-500 dark:text-gray-400 text-sm">Loading groups...</p>
      </div>
    );
  }

  // Empty state
  if (!isLoading && groups.length === 0) {
    return (
      <div className="text-center py-12 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-lg border border-slate-200 dark:border-gray-700">
        <div className="max-w-md mx-auto">
          <Users className="h-12 w-12 mx-auto mb-4 text-slate-500 dark:text-gray-400" />
          <h3 className="text-lg font-semibold text-slate-800 dark:text-gray-200 mb-2">
            No groups found
          </h3>
          <p className="text-slate-600 dark:text-gray-300">
            Be the first to create a group and bring people together around shared interests.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Users className="h-5 w-5 text-blue-500" />
          <h2 className="text-lg font-semibold text-slate-800 dark:text-gray-200">
            Discover Groups
          </h2>
          <Badge variant="secondary" className="text-xs">
            {formatEngagementCount(groups.length)} groups
          </Badge>
        </div>
      </div>

      {/* Groups Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {groups.map((group, index) => (
          <Card
            key={`group-${group.id}-${index}`}
            className="bg-white dark:bg-gray-800 shadow-md hover:shadow-lg transition-shadow duration-200 overflow-hidden"
          >
            {/* Group Cover */}
            <div className="h-32 bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 relative">
              {group.cover_image_url ? (
                <img
                  src={group.cover_image_url}
                  alt={group.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                  <Users className="h-8 w-8 text-white/80" />
                </div>
              )}
              
              {/* Privacy indicator */}
              <div className="absolute top-3 right-3">
                <Badge 
                  className={`text-xs ${
                    group.privacy === 'private' 
                      ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' 
                      : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                  }`}
                >
                  {group.privacy === 'private' ? (
                    <>
                      <Lock className="h-3 w-3 mr-1" />
                      Private
                    </>
                  ) : (
                    <>
                      <Globe className="h-3 w-3 mr-1" />
                      Public
                    </>
                  )}
                </Badge>
              </div>
            </div>

            <CardContent className="p-6 relative">
              {/* Group Avatar */}
              <div className="flex items-start justify-between mb-4">
                <Avatar className="w-16 h-16 ring-4 ring-white dark:ring-gray-800 -mt-8 shadow-lg">
                  <AvatarImage src={group.avatar_url} />
                  <AvatarFallback className="bg-slate-200 dark:bg-gray-700 text-slate-600 dark:text-gray-300 text-lg">
                    {group.name?.charAt(0).toUpperCase() || 'G'}
                  </AvatarFallback>
                </Avatar>
                
                {/* Join/Joined Button */}
                <Button
                  size="sm"
                  onClick={() => onJoinGroup(group.id)}
                  disabled={group.is_member}
                  className={`${
                    group.is_member
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      : 'bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-700 dark:hover:bg-blue-800'
                  }`}
                >
                  {group.is_member ? (
                    <>
                      <Users className="h-3 w-3 mr-1" />
                      Joined
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-3 w-3 mr-1" />
                      Join
                    </>
                  )}
                </Button>
              </div>

              {/* Group Info */}
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-slate-800 dark:text-gray-200 mb-1">
                  {group.name}
                </h3>
                <p className="text-sm text-slate-500 dark:text-gray-400 mb-2">
                  Created by {group.creator?.display_name} • {getTimeAgo(group.created_at)}
                </p>
                {group.description && (
                  <p className="text-sm text-slate-600 dark:text-gray-300 line-clamp-2">
                    {group.description}
                  </p>
                )}
              </div>

              {/* Group Stats */}
              <div className="flex items-center justify-between text-sm text-slate-500 dark:text-gray-400">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    <span>{formatEngagementCount(group.members_count || 0)} members</span>
                  </div>
                  <div>
                    <span>{formatEngagementCount(group.posts_count || 0)} posts</span>
                  </div>
                </div>
                
                {/* Activity indicator */}
                <div className="flex items-center gap-1">
                  <div className={`h-2 w-2 rounded-full ${
                    (group.posts_count || 0) > 10 ? 'bg-green-500' : 
                    (group.posts_count || 0) > 5 ? 'bg-yellow-500' : 
                    'bg-gray-400'
                  }`}></div>
                  <span className="text-xs">
                    {(group.posts_count || 0) > 10 ? 'Very Active' : 
                     (group.posts_count || 0) > 5 ? 'Active' : 
                     'Getting Started'}
                  </span>
                </div>
              </div>

              {/* Member role badge */}
              {group.is_member && group.member_role && (
                <div className="mt-3 pt-3 border-t border-slate-200 dark:border-gray-700">
                  <Badge 
                    variant="outline"
                    className={`text-xs ${
                      group.member_role === 'admin' 
                        ? 'border-purple-500 text-purple-700 dark:text-purple-300'
                        : group.member_role === 'moderator'
                        ? 'border-blue-500 text-blue-700 dark:text-blue-300'
                        : 'border-slate-500 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {group.member_role === 'admin' ? 'Admin' : 
                     group.member_role === 'moderator' ? 'Moderator' : 
                     'Member'}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Infinite scroll trigger */}
      {hasMore && (
        <div ref={loadMoreRef} className="py-4 flex justify-center">
          {isLoadingMore ? (
            <div className="flex items-center space-x-2">
              <RefreshCw className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-400" />
              <span className="text-sm text-slate-500 dark:text-gray-400">
                Loading more groups...
              </span>
            </div>
          ) : (
            <Button
              variant="outline"
              onClick={onLoadMore}
              className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm text-slate-600 dark:text-gray-300 border-slate-200 dark:border-gray-700"
            >
              <Users className="h-4 w-4 mr-2" />
              Load More Groups
            </Button>
          )}
        </div>
      )}

      {/* End of groups indicator */}
      {!hasMore && groups.length > 6 && (
        <div className="text-center py-4 border-t border-slate-200 dark:border-gray-700">
          <p className="text-sm text-slate-400 dark:text-gray-500">
            You've seen all available groups
          </p>
          <p className="text-xs text-slate-300 dark:text-gray-600 mt-1">
            New groups appear here when they're created
          </p>
        </div>
      )}
    </div>
  );
};