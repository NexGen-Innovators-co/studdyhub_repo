// InviteMembersDialog.tsx - Invite co-hosts and listeners to podcasts
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { ScrollArea } from '../ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  UserPlus,
  Search,
  Loader2,
  X,
  Mail,
  CheckCircle2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface InviteMembersDialogProps {
  isOpen: boolean;
  onClose: () => void;
  podcastId: string;
  podcastTitle: string;
}

interface UserSearchResult {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
}

export const InviteMembersDialog: React.FC<InviteMembersDialogProps> = ({
  isOpen,
  onClose,
  podcastId,
  podcastTitle
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<UserSearchResult[]>([]);
  const [selectedRole, setSelectedRole] = useState<'co-host' | 'listener'>('listener');
  const [inviteMessage, setInviteMessage] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Search users
  useEffect(() => {
    const searchUsers = async () => {
      if (searchQuery.length < 2) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        // Search in profiles table
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, email, avatar_url')
          .or(`full_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)
          .limit(10);

        if (error) throw error;

        // Filter out already selected users
        const filtered = (data || []).filter(
          user => !selectedUsers.some(selected => selected.id === user.id)
        );

        setSearchResults(filtered);
      } catch (error) {
        console.error('Error searching users:', error);
      } finally {
        setIsSearching(false);
      }
    };

    const debounce = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, selectedUsers]);

  const handleSelectUser = (user: UserSearchResult) => {
    setSelectedUsers([...selectedUsers, user]);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleRemoveUser = (userId: string) => {
    setSelectedUsers(selectedUsers.filter(u => u.id !== userId));
  };

  const handleSendInvites = async () => {
    if (selectedUsers.length === 0) {
      toast.error('Please select at least one user to invite');
      return;
    }

    setIsSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Create invites for all selected users
      const invites = selectedUsers.map(invitedUser => ({
        podcast_id: podcastId,
        inviter_id: user.id,
        invitee_id: invitedUser.id,
        role: selectedRole,
        message: inviteMessage || null,
        status: 'pending'
      }));

      const { error: inviteError } = await supabase
        .from('podcast_invites')
        .insert(invites);

      if (inviteError) throw inviteError;

      toast.success(`Sent ${selectedUsers.length} invite${selectedUsers.length > 1 ? 's' : ''} successfully!`);
      
      // Reset and close
      setSelectedUsers([]);
      setInviteMessage('');
      setSearchQuery('');
      onClose();
    } catch (error: any) {
      console.error('Error sending invites:', error);
      toast.error('Failed to send invites: ' + error.message);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-purple-600" />
            Invite Members
          </DialogTitle>
          <DialogDescription>
            Invite users to collaborate on "{podcastTitle}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Role Selection */}
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={selectedRole} onValueChange={(v: any) => setSelectedRole(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="listener">Listener - Can view and listen</SelectItem>
                <SelectItem value="co-host">Co-Host - Can edit and manage</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* User Search */}
          <div className="space-y-2">
            <Label>Search Users</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or email..."
                className="pl-9"
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <ScrollArea className="h-48 border rounded-md p-2">
                <div className="space-y-2">
                  {searchResults.map((user) => (
                    <div
                      key={user.id}
                      onClick={() => handleSelectUser(user)}
                      className="flex items-center gap-3 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md cursor-pointer"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.avatar_url} />
                        <AvatarFallback className="bg-purple-100 text-purple-700 text-xs">
                          {user.full_name?.charAt(0) || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{user.full_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      </div>
                      <UserPlus className="h-4 w-4 text-muted-foreground" />
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Selected Users */}
          {selectedUsers.length > 0 && (
            <div className="space-y-2">
              <Label>Selected Users ({selectedUsers.length})</Label>
              <div className="flex flex-wrap gap-2">
                {selectedUsers.map((user) => (
                  <Badge
                    key={user.id}
                    variant="secondary"
                    className="pl-2 pr-1 py-1 gap-1"
                  >
                    <span className="text-sm">{user.full_name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0 hover:bg-slate-200 dark:hover:bg-slate-700"
                      onClick={() => handleRemoveUser(user.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Message */}
          <div className="space-y-2">
            <Label>Message (Optional)</Label>
            <Input
              value={inviteMessage}
              onChange={(e) => setInviteMessage(e.target.value)}
              placeholder="Add a personal message..."
              maxLength={200}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSending}>
            Cancel
          </Button>
          <Button
            onClick={handleSendInvites}
            disabled={isSending || selectedUsers.length === 0}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="h-4 w-4 mr-2" />
                Send Invites
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
