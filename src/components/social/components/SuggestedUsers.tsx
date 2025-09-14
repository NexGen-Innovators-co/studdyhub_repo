import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Users, UserPlus, Loader2, RefreshCw } from 'lucide-react';
import { SocialUserWithDetails } from '../../../integrations/supabase/socialTypes';
import { toast } from 'sonner';

interface SuggestedUsersProps {
  users: (SocialUserWithDetails & { recommendation_score?: number })[];
  onFollowUser: (userId: string) => void;
  isLoading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  onRefresh?: () => void;
}

export const SuggestedUsers: React.FC<SuggestedUsersProps> = ({
  users,
  onFollowUser,
  isLoading = false,
  hasMore = false,
  onLoadMore,
  onRefresh,
}) => {
  const [followingUsers, setFollowingUsers] = useState<Set<string>>(new Set());
  const observerRef = useRef<HTMLDivElement>(null);
  const [hasTriggeredInitialLoad, setHasTriggeredInitialLoad] = useState(false);

  // Intersection Observer for lazy loading
  

  // Auto-trigger initial load if no users are present
  useEffect(() => {
    if (!hasTriggeredInitialLoad && users.length === 0 && !isLoading && onLoadMore) {
      setHasTriggeredInitialLoad(true);
      onLoadMore();
    }
  }, [users.length, isLoading, onLoadMore, hasTriggeredInitialLoad]);

  const handleFollowUser = async (userId: string, displayName: string) => {
    setFollowingUsers(prev => new Set(prev).add(userId));
    
    try {
      await onFollowUser(userId);
      toast.success(`Now following ${displayName}!`);
    } catch (error) {
      toast.error('Failed to follow user');
      setFollowingUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  };

  const getRecommendationReason = (user: SocialUserWithDetails & { recommendation_score?: number }) => {
    if (user.is_verified) return 'Verified';
    if ((user.followers_count || 0) > 1000) return 'Popular';
    if ((user.posts_count || 0) > 50) return 'Active Creator';
    if (user.interests && user.interests.length > 3) return 'Similar Interests';
    return 'New Member';
  };

  const getRecommendationColor = (reason: string) => {
    switch (reason) {
      case 'Verified': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'Popular': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'Active Creator': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'Similar Interests': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const formatFollowerCount = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  if (users.length === 0 && !isLoading) {
    return (
      <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-slate-200 dark:border-gray-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Suggested Users
            </div>
            {onRefresh && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRefresh}
                className="h-6 w-6 p-0"
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-6">
          <Users className="h-8 w-8 mx-auto mb-2 text-slate-400 dark:text-gray-500" />
          <p className="text-sm text-slate-500 dark:text-gray-400">
            No suggestions available right now
          </p>
          <p className="text-xs text-slate-400 dark:text-gray-500 mt-1">
            Try refreshing or check back later
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-slate-200 dark:border-gray-700 max-h-30 overflow-scroll morden-scrollbar">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Suggested Users
          </div>
          {onRefresh && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              disabled={isLoading}
              className="h-6 w-6 p-0"
            >
              <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {users.map((user, index) => {
          const isFollowing = followingUsers.has(user.id);
          const recommendationReason = getRecommendationReason(user);
          const badgeColor = getRecommendationColor(recommendationReason);

          return (
            <div
              key={user.id}
              className="flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-gray-700/50 rounded-lg transition-colors "
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Avatar className="h-10 w-10 flex-shrink-0">
                  <AvatarImage src={user.avatar_url} alt={user.display_name} />
                  <AvatarFallback className="bg-slate-200 dark:bg-gray-700 text-slate-600 dark:text-gray-300 text-sm">
                    {user.display_name?.charAt(0).toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium text-slate-800 dark:text-gray-200 truncate">
                      {user.display_name}
                    </p>
                    {user.is_verified && (
                      <div className="h-4 w-4 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <div className="h-2 w-2 bg-white rounded-full"></div>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-gray-400 truncate">
                    @{user.username}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-slate-500 dark:text-gray-400">
                      {formatFollowerCount(user.followers_count || 0)} followers
                    </span>
                    <Badge className={`text-xs px-2 py-0.5 ${badgeColor}`}>
                      {recommendationReason}
                    </Badge>
                  </div>
                  {user.bio && (
                    <p className="text-xs text-slate-500 dark:text-gray-400 mt-1 line-clamp-1">
                      {user.bio}
                    </p>
                  )}
                  {user.interests && user.interests.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {user.interests.slice(0, 2).map((interest, idx) => (
                        <span
                          key={idx}
                          className="text-xs bg-slate-100 dark:bg-gray-600 text-slate-600 dark:text-gray-300 px-2 py-0.5 rounded-full"
                        >
                          {interest}
                        </span>
                      ))}
                      {user.interests.length > 2 && (
                        <span className="text-xs text-slate-400 dark:text-gray-500">
                          +{user.interests.length - 2}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => handleFollowUser(user.id, user.display_name)}
                disabled={isFollowing}
                className="ml-3 flex-shrink-0 bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-700 dark:hover:bg-blue-800 disabled:bg-gray-300 dark:disabled:bg-gray-600"
              >
                {isFollowing ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <>
                    <UserPlus className="h-3 w-3 mr-1" />
                    Follow
                  </>
                )}
              </Button>
            </div>
          );
        })}

        {/* Loading indicator for pagination */}
        {isLoading && (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-400" />
          </div>
        )}

        {/* Load more trigger element */}
        {hasMore && (
          <div ref={observerRef} className="h-1 w-full" />
        )}

        {/* Show "Load More" button as fallback */}
        {hasMore && !isLoading && onLoadMore && (
          <Button
            variant="outline"
            size="sm"
            onClick={onLoadMore}
            className="w-full mt-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm text-slate-600 dark:text-gray-300 border-slate-200 dark:border-gray-700"
          >
            Load More Suggestions
          </Button>
        )}

        {/* End of suggestions indicator */}
        {!hasMore && users.length > 0 && (
          <div className="text-center py-2">
            <p className="text-xs text-slate-400 dark:text-gray-500">
              You've seen all suggestions
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};