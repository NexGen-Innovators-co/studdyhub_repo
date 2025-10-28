import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { TrendingUp, Hash } from 'lucide-react';
import { TrendingSidebarProps } from '../types/social';
import { toast } from 'sonner';
import { SuggestedUsers } from './SuggestedUsers';
import { formatEngagementCount } from '../utils/postUtils';

interface EnhancedTrendingSidebarProps extends TrendingSidebarProps {
  // Additional props for enhanced functionality
  isLoadingSuggestedUsers?: boolean;
  hasMoreSuggestedUsers?: boolean;
  onLoadMoreSuggestedUsers?: () => void;
  onRefreshSuggestedUsers?: () => void;
}

export const TrendingSidebar: React.FC<EnhancedTrendingSidebarProps> = ({
  hashtags,
  suggestedUsers,
  onFollowUser,
  isLoadingSuggestedUsers = false,
  hasMoreSuggestedUsers = false,
  onLoadMoreSuggestedUsers,
  onRefreshSuggestedUsers,
}) => {
  return (
    <div className="space-y-6">
      {/* Trending Hashtags */}
      {hashtags.length > 0 && (
        <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-slate-200 dark:border-gray-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Trending Topics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 srcollbar-thin max-h-80 overflow-y-auto">
            {hashtags.map((hashtag, index) => (
              <div
                key={hashtag.id}
                className="flex items-center justify-between hover:bg-muted/50 rounded-lg p-2 cursor-pointer transition-colors"
                onClick={() => toast.info(`Filtering by hashtag #${hashtag.name}`)}
              >
                <div className="flex items-center gap-2">
                  <Hash className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">#{hashtag.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatEngagementCount(hashtag.posts_count)} posts
                    </p>
                  </div>
                </div>
                <Badge variant="secondary" className="text-xs">
                  #{index + 1}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Enhanced Suggested Users with Lazy Loading */}
      <SuggestedUsers 
        users={suggestedUsers} 
        onFollowUser={onFollowUser}
        isLoading={isLoadingSuggestedUsers}
        hasMore={hasMoreSuggestedUsers}
        onLoadMore={onLoadMoreSuggestedUsers}
        onRefresh={onRefreshSuggestedUsers}
      />
    </div>
  );
};