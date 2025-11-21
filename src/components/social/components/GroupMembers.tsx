// src/components/social/components/GroupMembers.tsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../../../integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../../ui/card';
import { SocialUserWithDetails, SocialGroupWithDetails } from '../../../integrations/supabase/socialTypes';
import { toast } from 'sonner';

interface GroupMemberWithDetails extends SocialUserWithDetails {
  role: 'admin' | 'moderator' | 'member';
  joined_at: string;
}

interface GroupMembersProps {
  groupId: string;
  currentUser: SocialUserWithDetails | null;
  currentGroup: SocialGroupWithDetails | null;
  onLeaveGroup: (groupId: string) => Promise<boolean>;
}

export const GroupMembers: React.FC<GroupMembersProps> = ({ groupId, currentUser, currentGroup, onLeaveGroup }) => {
  const [members, setMembers] = useState<GroupMemberWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchMembers = async () => {
      const { data, error } = await supabase
        .from('social_group_members')
        .select(`
          role,
          joined_at,
          user:user_id (*)
        `)
        .eq('group_id', groupId)
        .eq('status', 'active')
        .order('joined_at', { ascending: true });

      if (error) {
        toast.error('Failed to load members');
      } else {
        // Ensure role is one of the allowed values
        const typedMembers = data.map(d => ({
          ...d.user,
          role: (['admin', 'moderator', 'member'].includes(d.role) ? d.role : 'member') as 'admin' | 'moderator' | 'member',
          joined_at: d.joined_at
        }));
        setMembers(typedMembers);
      }
      setIsLoading(false);
    };

    fetchMembers();
  }, [groupId]);

  if (isLoading) return <div>Loading members...</div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="text-lg sm:text-xl">Members ({members.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 sm:space-y-4 px-3 sm:px-6">
          {members.map(member => (
            <div key={member.id} className="flex items-center gap-3 sm:gap-4 p-2 sm:p-0">
              <Avatar className="h-10 w-10 sm:h-12 sm:w-12">
                <AvatarImage src={member.avatar_url} />
                <AvatarFallback className="text-sm sm:text-base">
                  {member.display_name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm sm:text-base truncate">{member.display_name}</p>
                <p className="text-xs sm:text-sm text-gray-500 truncate">@{member.username}</p>
              </div>
              <Badge variant="secondary" className="capitalize text-xs flex-shrink-0">
                {member.role}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};