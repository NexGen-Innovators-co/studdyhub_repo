import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';
import { Button } from '../../ui/button';
import { Users } from 'lucide-react';
import { SocialGroupWithDetails, SocialUserWithDetails } from '../../../integrations/supabase/socialTypes';

interface GroupsSectionProps {
  groups: SocialGroupWithDetails[];
  isLoading: boolean;
  onJoinGroup: (groupId: string) => void;
  currentUser: SocialUserWithDetails | null;
}

export const GroupsSection: React.FC<GroupsSectionProps> = ({
  groups,
  isLoading,
  onJoinGroup,
  currentUser,
}) => {
  return (
    <Card className="bg-white dark:bg-gray-800 shadow-md border border-slate-200 dark:border-gray-700">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-slate-800 dark:text-gray-200 flex items-center gap-2">
          <Users className="h-4 w-4" /> Groups
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
          </div>
        ) : groups.length === 0 ? (
          <p className="text-center text-slate-600 dark:text-gray-300">No groups available</p>
        ) : (
          <div className="space-y-4">
            {groups.map((group) => (
              <div key={group.id} className="flex items-center gap-3">
                <Avatar className="w-10 h-10">
                  <AvatarImage src={group.avatar_url} />
                  <AvatarFallback className="bg-slate-200 dark:bg-gray-700 text-slate-600 dark:text-gray-300">
                    {group.name?.charAt(0).toUpperCase() || 'G'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-800 dark:text-gray-200">{group.name}</p>
                  <p className="text-xs text-slate-500 dark:text-gray-400">{group.description}</p>
                  <p className="text-xs text-slate-500 dark:text-gray-400">{group.members_count} members</p>
                </div>
                {!group.is_member && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onJoinGroup(group.id)}
                    className="text-slate-600 border-slate-200 hover:bg-slate-50 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700"
                  >
                    Join
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};