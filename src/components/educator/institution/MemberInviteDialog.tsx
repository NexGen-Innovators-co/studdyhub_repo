// src/components/educator/institution/MemberInviteDialog.tsx
// Dialog for inviting new members to an institution via email.

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, UserPlus, Mail, Copy, CheckCheck } from 'lucide-react';
import { useInstitutionMembers } from '@/hooks/useInstitutionMembers';
import { toast } from 'sonner';

interface MemberInviteDialogProps {
  institutionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const MemberInviteDialog: React.FC<MemberInviteDialogProps> = ({
  institutionId,
  open,
  onOpenChange,
}) => {
  const { inviteMember } = useInstitutionMembers(institutionId);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'educator' | 'student'>('student');
  const [sending, setSending] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSendInvite = async () => {
    if (!email.trim()) {
      toast.error('Please enter an email address');
      return;
    }
    setSending(true);
    try {
      const success = await inviteMember(email.trim(), role);
      if (success) {
        // Invite succeeded — no token returned from hook, just show success
      }
      toast.success(`Invitation sent to ${email}`);
      setEmail('');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to send invitation');
    } finally {
      setSending(false);
    }
  };

  const handleCopyLink = () => {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      toast.success('Invite link copied');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = (val: boolean) => {
    if (!val) {
      setEmail('');
      setRole('student');
      setInviteLink(null);
      setCopied(false);
    }
    onOpenChange(val);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-blue-500" />
            Invite Member
          </DialogTitle>
          <DialogDescription>
            Send an email invitation or share a join link.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Email input */}
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email Address</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="member@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  onKeyDown={(e) => e.key === 'Enter' && handleSendInvite()}
                />
              </div>
            </div>
          </div>

          {/* Role selector */}
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="student">Student</SelectItem>
                <SelectItem value="educator">Educator</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Invite link display */}
          {inviteLink && (
            <div className="space-y-2">
              <Label>Invite Link</Label>
              <div className="flex gap-2">
                <Input
                  value={inviteLink}
                  readOnly
                  className="text-xs font-mono bg-gray-50 dark:bg-gray-800"
                />
                <Button variant="outline" size="icon" onClick={handleCopyLink}>
                  {copied ? (
                    <CheckCheck className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-gray-500">Share this link with the invitee.</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
            {inviteLink ? 'Done' : 'Cancel'}
          </Button>
          {!inviteLink && (
            <Button onClick={handleSendInvite} disabled={sending || !email.trim()}>
              {sending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Send Invite
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MemberInviteDialog;
