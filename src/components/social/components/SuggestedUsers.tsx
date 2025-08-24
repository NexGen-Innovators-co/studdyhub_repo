import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';
import { Badge } from '../../ui/badge';
import { UserPlus, Award, Target } from 'lucide-react';
import { SuggestedUsersProps } from '../types/social';

export const SuggestedUsers: React.FC<SuggestedUsersProps> = ({ users, onFollowUser }) => {
  if (users.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <UserPlus className="h-4 w-4" />
          Suggested for you
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {users.map((user) => (
          <div key={user.id} className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Avatar className="w-10 h-10">
                <AvatarImage src={user.avatar_url} />
                <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/5">
                  {user.display_name?.charAt(0).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <p className="text-sm font-medium truncate">{user.display_name}</p>
                  {user.is_verified && (
                    <Award className="h-3 w-3 text-blue-500 flex-shrink-0" />
                  )}
                  {user.is_contributor && (
                    <Target className="h-3 w-3 text-purple-500 flex-shrink-0" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">@{user.username}</p>
                <div className="flex items-center gap-1 mt-1">
                  {user.interests?.slice(0, 2).map((interest, index) => (
                    <Badge key={index} variant="outline" className="text-xs px-1 py-0">
                      {interest}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onFollowUser(user.id)}
              className="text-xs px-3 hover:bg-primary hover:text-primary-foreground"
            >
              Follow
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};