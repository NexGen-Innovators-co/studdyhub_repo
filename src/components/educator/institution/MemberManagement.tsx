// src/components/educator/institution/MemberManagement.tsx
// Lists institution members, pending invites, and provides invite/remove/role-change actions.

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Users,
  UserPlus,
  Loader2,
  MoreVertical,
  Shield,
  Trash2,
  Mail,
  XCircle,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useInstitutionMembers } from '@/hooks/useInstitutionMembers';
import { MemberRequestCard } from './MemberRequestCard';
import type { InstitutionMemberRole } from '@/types/Education';

interface MemberManagementProps {
  institutionId: string;
  isAdmin: boolean;
}

export const MemberManagement: React.FC<MemberManagementProps> = ({
  institutionId,
  isAdmin,
}) => {
  const {
    members,
    pendingInvites,
    isLoading,
    inviteMember,
    removeMember,
    updateMemberRole,
    revokeInvite,
    refetch,
  } = useInstitutionMembers(institutionId);

  const activeMembers = members.filter((m) => m.status === 'active');
  const pendingMembers = members.filter((m) => m.status === 'pending');

  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'educator' | 'student'>('educator');
  const [isInviting, setIsInviting] = useState(false);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setIsInviting(true);
    const success = await inviteMember(inviteEmail, inviteRole);
    if (success) {
      setInviteEmail('');
      setShowInviteDialog(false);
    }
    setIsInviting(false);
  };

  const roleBadgeColor: Record<string, string> = {
    owner: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    admin: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    educator: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    student: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with invite button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Members ({activeMembers.length})
          </h3>
          <p className="text-sm text-gray-500">Manage institution members and invitations</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowInviteDialog(true)} size="sm">
            <UserPlus className="w-4 h-4 mr-2" />
            Invite
          </Button>
        )}
      </div>

      {/* Pending membership requests */}
      {isAdmin && pendingMembers.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-yellow-500" />
            Pending Requests ({pendingMembers.length})
          </h4>
          {pendingMembers.map((member) => (
            <MemberRequestCard
              key={member.id}
              member={member}
              onProcessed={refetch}
            />
          ))}
        </div>
      )}

      {/* Active members grid */}
      <div className="grid gap-3">
        {activeMembers.map((member) => (
          <Card key={member.id} className="rounded-xl">
            <CardContent className="p-4 flex items-center gap-4">
              <Avatar className="w-10 h-10">
                <AvatarImage src={member.profile?.avatar_url || undefined} />
                <AvatarFallback>
                  {(member.profile?.full_name || member.user_id).slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 dark:text-white truncate">
                  {member.profile?.full_name || 'Unknown User'}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {member.profile?.email || member.user_id}
                </p>
              </div>

              <Badge className={`${roleBadgeColor[member.role] || ''} capitalize text-xs`}>
                {member.role}
              </Badge>

              {isAdmin && member.role !== 'owner' && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => updateMemberRole(member.id, 'admin' as InstitutionMemberRole)}>
                      <Shield className="w-4 h-4 mr-2" />
                      Make Admin
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => updateMemberRole(member.id, 'educator' as InstitutionMemberRole)}>
                      <Users className="w-4 h-4 mr-2" />
                      Set as Educator
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => removeMember(member.id)}
                      className="text-red-600"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Remove
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pending invites */}
      {pendingInvites.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <Mail className="w-4 h-4" />
            Pending Invitations ({pendingInvites.length})
          </h4>
          {pendingInvites.map((invite) => (
            <Card key={invite.id} className="rounded-xl border-dashed">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                  <Mail className="w-4 h-4 text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                    {invite.email}
                  </p>
                  <p className="text-xs text-gray-400">
                    Invited as {invite.role} · Expires{' '}
                    {new Date(invite.expires_at).toLocaleDateString()}
                  </p>
                </div>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => revokeInvite(invite.id)}
                    className="h-7 w-7 text-red-500 hover:text-red-700"
                  >
                    <XCircle className="w-4 h-4" />
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Invite dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Email Address</label>
              <Input
                type="email"
                placeholder="name@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Role</label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="educator">Educator</SelectItem>
                  <SelectItem value="student">Student</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowInviteDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleInvite} disabled={!inviteEmail.trim() || isInviting}>
              {isInviting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Send Invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MemberManagement;
