import React from 'react';
import { Card, CardContent, CardHeader } from '../../ui/card';
import { Button } from '../../ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';
import { Badge } from '../../ui/badge';
import { Edit3, MapPin, Calendar, Link as LinkIcon, Award, Target } from 'lucide-react';
import { SocialUserWithDetails } from '../../../integrations/supabase/socialTypes';
import { formatEngagementCount } from '../utils/postUtils';

interface UserProfileProps {
  user: SocialUserWithDetails | null;
  isOwnProfile?: boolean;
  onEditProfile?: () => void;
  onFollow?: () => void;
}

export const UserProfile: React.FC<UserProfileProps> = ({
  user,
  isOwnProfile = false,
  onEditProfile,
  onFollow,
}) => {
  if (!user) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-4">
            <Avatar className="w-16 h-16 ring-2 ring-primary/10">
              <AvatarImage src={user.avatar_url} />
              <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/5 text-lg">
                {user.display_name?.charAt(0).toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold">{user.display_name}</h2>
                {user.is_verified && (
                  <Award className="h-5 w-5 text-blue-500" />
                )}
                {user.is_contributor && (
                  <Target className="h-5 w-5 text-purple-500" />
                )}
              </div>
              <p className="text-muted-foreground">@{user.username}</p>
              <div className="flex items-center space-x-4 text-sm text-muted-foreground mt-2">
                <span>{formatEngagementCount(user.followers_count)} followers</span>
                <span>{formatEngagementCount(user.following_count)} following</span>
                <span>{formatEngagementCount(user.posts_count)} posts</span>
              </div>
            </div>
          </div>
          {isOwnProfile ? (
            <Button variant="outline" size="sm" onClick={onEditProfile}>
              <Edit3 className="h-4 w-4 mr-2" />
              Edit Profile
            </Button>
          ) : (
            <Button onClick={onFollow}>
              Follow
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {user.bio && (
          <p className="mb-4 text-sm leading-relaxed">{user.bio}</p>
        )}

        {/* Interests */}
        {user.interests && user.interests.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {user.interests.map((interest, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {interest}
              </Badge>
            ))}
          </div>
        )}

        {/* Additional Info */}
        <div className="flex flex-col space-y-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span>Joined {new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
          </div>
          {user.last_active && (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              <span>Last active {new Date(user.last_active).toLocaleDateString()}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};