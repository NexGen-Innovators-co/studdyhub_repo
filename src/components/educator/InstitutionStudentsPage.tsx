// src/components/educator/InstitutionStudentsPage.tsx
// Route-level page for /educator/students — shows all institution members & students.
// If a courseId is available (future route param), delegates to CourseStudents.

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Users,
  Search,
  Loader2,
  Building2,
  GraduationCap,
  UserPlus,
  Mail,
  Copy,
  XCircle,
  Clock,
  CheckCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEducatorContext } from '@/contexts/EducatorContext';
import { useInstitutionMembers } from '@/hooks/useInstitutionMembers';
import { useAuth } from '@/hooks/useAuth';
import { MemberInviteDialog } from './institution/MemberInviteDialog';
import { toast } from 'sonner';

const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  admin: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  educator: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  student: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

export const InstitutionStudentsPage: React.FC = () => {
  const { institution, permissions, institutionLoading } = useEducatorContext();
  const { user } = useAuth();
  const { members, pendingInvites, isLoading: membersLoading, revokeInvite } = useInstitutionMembers(institution?.id || '');
  const [search, setSearch] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyInviteLink = (token: string, inviteId: string) => {
    const link = `${window.location.origin}/join/${token}`;
    navigator.clipboard.writeText(link);
    toast.success('Invite link copied');
    setCopiedId(inviteId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const isLoading = institutionLoading || membersLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!institution) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-500 dark:text-gray-400">
        <Building2 className="h-12 w-12 mb-4 opacity-40" />
        <p className="text-lg font-medium">No Institution</p>
        <p className="text-sm mt-1">Create or join an institution to manage students.</p>
      </div>
    );
  }

  const filteredMembers = members.filter((m) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (m.profile?.full_name || '').toLowerCase().includes(q) ||
      (m.profile?.email || '').toLowerCase().includes(q) ||
      m.role.toLowerCase().includes(q) ||
      (m.department || '').toLowerCase().includes(q)
    );
  });

  const students = filteredMembers.filter((m) => m.role === 'student');
  const educators = filteredMembers.filter((m) => ['owner', 'admin', 'educator'].includes(m.role));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Members
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {institution.name} · {members.length} member{members.length !== 1 ? 's' : ''}
          </p>
        </div>
        {permissions.canInviteStudents && (
          <Button className="gap-2" onClick={() => setInviteOpen(true)}>
            <UserPlus className="h-4 w-4" /> Invite Member
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search members..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="rounded-xl border shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="h-5 w-5 text-blue-500" />
            <div>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{members.length}</p>
              <p className="text-xs text-gray-500">Total Members</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <GraduationCap className="h-5 w-5 text-green-500" />
            <div>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{students.length}</p>
              <p className="text-xs text-gray-500">Students</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <Building2 className="h-5 w-5 text-purple-500" />
            <div>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{educators.length}</p>
              <p className="text-xs text-gray-500">Educators</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <UserPlus className="h-5 w-5 text-orange-500" />
            <div>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {pendingInvites.length}
              </p>
              <p className="text-xs text-gray-500">Pending Invites</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending invites section */}
      {pendingInvites.length > 0 && (
        <Card className="rounded-2xl border border-dashed border-orange-200 dark:border-orange-800 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="h-4 w-4 text-orange-500" />
              Pending Invitations ({pendingInvites.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {pendingInvites.map((invite) => (
                <div key={invite.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="w-8 h-8 rounded-full bg-orange-50 dark:bg-orange-950/30 flex items-center justify-center shrink-0">
                    <Mail className="w-4 h-4 text-orange-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                      {invite.email}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <Badge variant="outline" className="capitalize text-[10px] px-1.5 py-0">
                        {invite.role}
                      </Badge>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Expires {new Date(invite.expires_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {invite.token && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Copy invite link"
                        onClick={() => handleCopyInviteLink(invite.token, invite.id)}
                      >
                        {copiedId === invite.id ? (
                          <CheckCheck className="h-3.5 w-3.5 text-green-500" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    )}
                    {(permissions.institutionRole === 'owner' || permissions.institutionRole === 'admin') && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                        title="Revoke invitation"
                        onClick={() => revokeInvite(invite.id)}
                      >
                        <XCircle className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Members table */}
      <Card className="rounded-2xl border shadow-sm overflow-hidden">
        <CardHeader>
          <CardTitle className="text-lg">All Members</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredMembers.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              {search ? 'No members match your search.' : 'No members found.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMembers.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={member.profile?.avatar_url || undefined} />
                            <AvatarFallback className="text-xs">
                              {(member.profile?.full_name || 'U').charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white text-sm">
                              {member.profile?.full_name || 'Unknown User'}
                            </p>
                            <p className="text-xs text-gray-500">
                              {member.profile?.email || '—'}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={`capitalize text-xs ${ROLE_COLORS[member.role] || ''}`}
                        >
                          {member.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {member.department || '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={member.status === 'active' ? 'default' : 'outline'}
                          className="text-xs capitalize"
                        >
                          {member.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-gray-500">
                          {member.joined_at
                            ? new Date(member.joined_at).toLocaleDateString()
                            : '—'}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invite dialog */}
      {institution && (
        <MemberInviteDialog
          institutionId={institution.id}
          institutionName={institution.name}
          inviterName={user?.user_metadata?.full_name || undefined}
          open={inviteOpen}
          onOpenChange={setInviteOpen}
        />
      )}
    </div>
  );
};

export default InstitutionStudentsPage;
