// src/components/educator/institution/MemberInviteDialog.tsx
// Dialog for inviting new members to an institution — search existing users or enter email.

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import { Loader2, UserPlus, Mail, Copy, CheckCheck, Search, X } from 'lucide-react';
import { useInstitutionMembers } from '@/hooks/useInstitutionMembers';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UserSuggestion {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  email: string | null;
  user_role: string | null;
}

interface MemberInviteDialogProps {
  institutionId: string;
  institutionName?: string;
  inviterName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const MemberInviteDialog: React.FC<MemberInviteDialogProps> = ({
  institutionId,
  institutionName,
  inviterName,
  open,
  onOpenChange,
}) => {
  const { inviteMember } = useInstitutionMembers(institutionId);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'educator' | 'student'>('student');
  const [sending, setSending] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [invitedEmail, setInvitedEmail] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // User search state
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserSuggestion | null>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Search profiles as admin types (debounced)
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    // Don't search if user is already selected or input is too short
    if (selectedUser || email.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    searchTimerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const q = email.trim().toLowerCase();
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, email, user_role')
          .or(`email.ilike.%${q}%,full_name.ilike.%${q}%`)
          .limit(6);

        if (!error && data && data.length > 0) {
          setSuggestions(data);
          setShowSuggestions(true);
        } else {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [email, selectedUser]);

  // Close suggestions on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectUser = (user: UserSuggestion) => {
    setSelectedUser(user);
    setEmail(user.email || '');
    setShowSuggestions(false);
    setSuggestions([]);
    // Auto-set role based on profile
    if (user.user_role && ['tutor_affiliated', 'tutor_independent', 'admin'].includes(user.user_role)) {
      setRole('educator');
    }
  };

  const handleClearSelected = () => {
    setSelectedUser(null);
    setEmail('');
  };

  const handleSendInvite = async () => {
    if (!email.trim()) {
      toast.error('Please enter an email address');
      return;
    }
    setSending(true);
    try {
      const token = await inviteMember(email.trim(), role, selectedUser?.id ?? undefined, institutionName, inviterName);
      if (token) {
        const link = `${window.location.origin}/join/${token}`;
        setInviteLink(link);
        setInvitedEmail(email.trim());
        setEmail('');
        setSelectedUser(null);
      }
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

  const handleInviteAnother = () => {
    setInviteLink(null);
    setInvitedEmail(null);
    setCopied(false);
    setEmail('');
    setSelectedUser(null);
  };

  const handleClose = (val: boolean) => {
    if (!val) {
      setEmail('');
      setRole('student');
      setInviteLink(null);
      setInvitedEmail(null);
      setCopied(false);
      setSelectedUser(null);
      setSuggestions([]);
      setShowSuggestions(false);
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
            Search for an existing user or enter an email to invite.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Selected user chip */}
          {selectedUser && !inviteLink && (
            <div className="flex items-center gap-2 p-2 rounded-lg border bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
              <Avatar className="h-7 w-7">
                <AvatarImage src={selectedUser.avatar_url || undefined} />
                <AvatarFallback className="text-xs">
                  {(selectedUser.full_name || 'U').charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                  {selectedUser.full_name || 'Unknown User'}
                </p>
                <p className="text-xs text-gray-500 truncate">{selectedUser.email}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={handleClearSelected}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          {/* Email / search input */}
          {!inviteLink && (
            <div className="space-y-2 relative" ref={suggestionsRef}>
              <Label htmlFor="invite-email">
                {selectedUser ? 'Email Address' : 'Search user or enter email'}
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="invite-email"
                  type="text"
                  placeholder={selectedUser ? selectedUser.email || '' : 'Name or email...'}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (selectedUser) setSelectedUser(null);
                  }}
                  className="pl-10"
                  disabled={!!selectedUser}
                  onKeyDown={(e) => e.key === 'Enter' && !showSuggestions && handleSendInvite()}
                  onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                />
                {searching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
                )}
              </div>

              {/* Suggestions dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-gray-900 border rounded-lg shadow-lg max-h-52 overflow-y-auto">
                  {suggestions.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
                      onClick={() => handleSelectUser(user)}
                    >
                      <Avatar className="h-7 w-7 shrink-0">
                        <AvatarImage src={user.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {(user.full_name || 'U').charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                          {user.full_name || 'Unknown'}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{user.email}</p>
                      </div>
                      {user.user_role && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 capitalize shrink-0">
                          {user.user_role.replace(/_/g, ' ')}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Role selector */}
          {!inviteLink && (
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
          )}

          {/* Existing user note */}
          {selectedUser && !inviteLink && (
            <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              This user will receive an in-app notification.
            </p>
          )}

          {/* Invite link display */}
          {inviteLink && (
            <div className="space-y-3">
              <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 p-3">
                <p className="text-sm font-medium text-green-700 dark:text-green-400 mb-1">Invitation created!</p>
                {invitedEmail && (
                  <p className="text-xs text-green-600 dark:text-green-500">For: {invitedEmail}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Invite Link</Label>
                <div className="flex gap-2">
                  <Input
                    value={inviteLink}
                    readOnly
                    className="text-xs font-mono bg-gray-50 dark:bg-gray-800"
                  />
                  <Button variant="outline" size="icon" onClick={handleCopyLink} title="Copy link">
                    {copied ? (
                      <CheckCheck className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Share this link with the invitee. It expires in 7 days.</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => handleClose(false)}>
            {inviteLink ? 'Done' : 'Cancel'}
          </Button>
          {inviteLink ? (
            <Button variant="secondary" onClick={handleInviteAnother}>
              <UserPlus className="h-4 w-4 mr-2" />
              Invite Another
            </Button>
          ) : (
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
