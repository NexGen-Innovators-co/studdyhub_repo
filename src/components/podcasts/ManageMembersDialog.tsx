// ManageMembersDialog.tsx - Manage podcast members and permissions
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { ScrollArea } from '../ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  Users,
  Crown,
  Mic,
  Headphones,
  MoreVertical,
  Trash2,
  UserCog,
  Loader2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface ManageMembersDialogProps {
  isOpen: boolean;
  onClose: () => void;
  podcastId: string;
  podcastTitle: string;
  isOwner: boolean;
}

interface Member {
  id: string;
  user_id: string;
  role: 'owner' | 'co-host' | 'listener';
  joined_at: string;
  user?: {
    full_name: string;
    avatar_url?: string;
    email?: string;
  };
}

export const ManageMembersDialog: React.FC<ManageMembersDialogProps> = ({
  isOpen,
  onClose,
  podcastId,
  podcastTitle,
  isOwner
}) => {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadMembers();
      getCurrentUser();
    }
  }, [isOpen, podcastId]);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);
  };

  const loadMembers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('podcast_members')
        .select('*')
        .eq('podcast_id', podcastId)
        .order('joined_at', { ascending: true });

      if (error) throw error;
      
      // Transform data to include placeholder user info
      const transformedMembers = (data || []).map(member => ({
        ...member,
        user: {
          full_name: 'User',
          avatar_url: null,
          email: null
        }
      }));
      
      setMembers(transformedMembers);
    } catch (error) {
      console.error('Error loading members:', error);
      toast.error('Failed to load members');
    } finally {
      setLoading(false);
    }
  };

  const handleChangeRole = async (memberId: string, newRole: 'co-host' | 'listener') => {
    try {
      const { error } = await supabase
        .from('podcast_members')
        .update({ role: newRole })
        .eq('id', memberId);

      if (error) throw error;

      toast.success(`Role updated to ${newRole}`);
      loadMembers();
    } catch (error) {
      console.error('Error changing role:', error);
      toast.error('Failed to update role');
    }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!confirm(`Remove ${memberName} from this podcast?`)) return;

    try {
      const { error } = await supabase
        .from('podcast_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      toast.success(`${memberName} removed from podcast`);
      loadMembers();
    } catch (error) {
      console.error('Error removing member:', error);
      toast.error('Failed to remove member');
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <Crown className="h-4 w-4 text-yellow-600" />;
      case 'co-host':
        return <Mic className="h-4 w-4 text-purple-600" />;
      case 'listener':
        return <Headphones className="h-4 w-4 text-blue-600" />;
      default:
        return null;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'co-host':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'listener':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      default:
        return '';
    }
  };

  const owners = members.filter(m => m.role === 'owner');
  const coHosts = members.filter(m => m.role === 'co-host');
  const listeners = members.filter(m => m.role === 'listener');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-purple-600" />
            Manage Members
          </DialogTitle>
          <DialogDescription>
            Manage access and roles for "{podcastTitle}"
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
          </div>
        ) : (
          <ScrollArea className="max-h-[500px]">
            <div className="space-y-6 pr-4">
              {/* Owners */}
              {owners.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Crown className="h-4 w-4 text-yellow-600" />
                    Owners ({owners.length})
                  </h3>
                  <div className="space-y-2">
                    {owners.map((member) => (
                      <MemberCard
                        key={member.id}
                        member={member}
                        isOwner={isOwner}
                        currentUserId={currentUserId}
                        getRoleIcon={getRoleIcon}
                        getRoleColor={getRoleColor}
                        onChangeRole={handleChangeRole}
                        onRemove={handleRemoveMember}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Co-hosts */}
              {coHosts.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Mic className="h-4 w-4 text-purple-600" />
                    Co-hosts ({coHosts.length})
                  </h3>
                  <div className="space-y-2">
                    {coHosts.map((member) => (
                      <MemberCard
                        key={member.id}
                        member={member}
                        isOwner={isOwner}
                        currentUserId={currentUserId}
                        getRoleIcon={getRoleIcon}
                        getRoleColor={getRoleColor}
                        onChangeRole={handleChangeRole}
                        onRemove={handleRemoveMember}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Listeners */}
              {listeners.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Headphones className="h-4 w-4 text-blue-600" />
                    Listeners ({listeners.length})
                  </h3>
                  <div className="space-y-2">
                    {listeners.map((member) => (
                      <MemberCard
                        key={member.id}
                        member={member}
                        isOwner={isOwner}
                        currentUserId={currentUserId}
                        getRoleIcon={getRoleIcon}
                        getRoleColor={getRoleColor}
                        onChangeRole={handleChangeRole}
                        onRemove={handleRemoveMember}
                      />
                    ))}
                  </div>
                </div>
              )}

              {members.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No members yet</p>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
};

// Member Card Component
const MemberCard: React.FC<{
  member: Member;
  isOwner: boolean;
  currentUserId: string | null;
  getRoleIcon: (role: string) => React.ReactNode;
  getRoleColor: (role: string) => string;
  onChangeRole: (memberId: string, role: 'co-host' | 'listener') => void;
  onRemove: (memberId: string, name: string) => void;
}> = ({
  member,
  isOwner,
  currentUserId,
  getRoleIcon,
  getRoleColor,
  onChangeRole,
  onRemove
}) => {
  const isCurrentUser = member.user_id === currentUserId;
  const canManage = isOwner && !isCurrentUser && member.role !== 'owner';

  return (
    <div className="flex items-center gap-3 p-3 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
      <Avatar className="h-10 w-10">
        <AvatarImage src={member.user?.avatar_url} />
        <AvatarFallback className="bg-purple-100 text-purple-700">
          {member.user?.full_name?.charAt(0) || 'U'}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-sm truncate">
            {member.user?.full_name || 'Unknown User'}
          </p>
          {isCurrentUser && (
            <Badge variant="outline" className="text-xs">You</Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Joined {formatDistanceToNow(new Date(member.joined_at), { addSuffix: true })}
        </p>
      </div>

      <Badge className={`${getRoleColor(member.role)} gap-1`}>
        {getRoleIcon(member.role)}
        {member.role}
      </Badge>

      {canManage && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onChangeRole(member.id, 'co-host')}>
              <Mic className="h-4 w-4 mr-2" />
              Make Co-host
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onChangeRole(member.id, 'listener')}>
              <Headphones className="h-4 w-4 mr-2" />
              Make Listener
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onRemove(member.id, member.user?.full_name || 'User')}
              className="text-red-600 dark:text-red-400"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
};
