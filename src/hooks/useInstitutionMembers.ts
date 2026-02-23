// src/hooks/useInstitutionMembers.ts
// Hook for managing institution members — list, invite, remove, update roles.

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { InstitutionMember, InstitutionMemberRole, InstitutionMemberStatus, InstitutionInvite } from '@/types/Education';
import { toast } from 'sonner';

interface MemberWithProfile extends InstitutionMember {
  profile?: {
    full_name: string | null;
    avatar_url: string | null;
    email: string | null;
  };
}

interface UseInstitutionMembersReturn {
  members: MemberWithProfile[];
  pendingInvites: InstitutionInvite[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  inviteMember: (email: string, role: 'educator' | 'student') => Promise<boolean>;
  removeMember: (memberId: string) => Promise<boolean>;
  updateMemberRole: (memberId: string, role: InstitutionMemberRole) => Promise<boolean>;
  revokeInvite: (inviteId: string) => Promise<boolean>;
}

export function useInstitutionMembers(institutionId: string | null): UseInstitutionMembersReturn {
  const { user } = useAuth();
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [pendingInvites, setPendingInvites] = useState<InstitutionInvite[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    if (!institutionId) {
      setMembers([]);
      setPendingInvites([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch active members with profiles
      const { data: memberData, error: memberError } = await supabase
        .from('institution_members')
        .select(`
          *,
          profile:profiles ( full_name, avatar_url, email )
        `)
        .eq('institution_id', institutionId)
        .in('status', ['active', 'pending', 'invited'])
        .order('role', { ascending: true })
        .order('joined_at', { ascending: false });

      if (memberError) throw memberError;

      setMembers(
        (memberData || []).map((m: any) => ({
          id: m.id,
          institution_id: m.institution_id,
          user_id: m.user_id,
          role: m.role as InstitutionMemberRole,
          status: m.status as InstitutionMemberStatus,
          title: m.title,
          department: m.department,
          invited_by: m.invited_by,
          invite_code: m.invite_code,
          joined_at: m.joined_at,
          created_at: m.created_at,
          updated_at: m.updated_at,
          profile: m.profile
            ? {
                full_name: m.profile.full_name,
                avatar_url: m.profile.avatar_url,
                email: m.profile.email,
              }
            : undefined,
        }))
      );

      // Fetch pending invites
      const { data: inviteData, error: inviteError } = await supabase
        .from('institution_invites')
        .select('*')
        .eq('institution_id', institutionId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (inviteError) throw inviteError;

      setPendingInvites(
        (inviteData || []).map((inv: any) => ({
          id: inv.id,
          institution_id: inv.institution_id,
          email: inv.email,
          role: inv.role,
          invited_by: inv.invited_by,
          status: inv.status,
          token: inv.token,
          expires_at: inv.expires_at,
          created_at: inv.created_at,
        }))
      );
    } catch (err: any) {
      setError(err.message ?? 'Failed to load members');
    } finally {
      setIsLoading(false);
    }
  }, [institutionId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const inviteMember = useCallback(
    async (email: string, role: 'educator' | 'student'): Promise<boolean> => {
      if (!institutionId || !user?.id) return false;

      try {
        const token = crypto.randomUUID();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7-day expiry

        const { error: inviteError } = await supabase.from('institution_invites').insert({
          institution_id: institutionId,
          email: email.toLowerCase().trim(),
          role,
          invited_by: user.id,
          token,
          status: 'pending',
          expires_at: expiresAt.toISOString(),
        });

        if (inviteError) throw inviteError;

        toast.success(`Invitation sent to ${email}`);
        await fetchMembers();
        return true;
      } catch (err: any) {
        toast.error(err.message ?? 'Failed to send invitation');
        return false;
      }
    },
    [institutionId, user?.id, fetchMembers]
  );

  const removeMember = useCallback(
    async (memberId: string): Promise<boolean> => {
      try {
        const { error: removeError } = await supabase
          .from('institution_members')
          .update({ status: 'removed', updated_at: new Date().toISOString() })
          .eq('id', memberId);

        if (removeError) throw removeError;

        toast.success('Member removed');
        await fetchMembers();
        return true;
      } catch (err: any) {
        toast.error(err.message ?? 'Failed to remove member');
        return false;
      }
    },
    [fetchMembers]
  );

  const updateMemberRole = useCallback(
    async (memberId: string, role: InstitutionMemberRole): Promise<boolean> => {
      try {
        const { error: updateError } = await supabase
          .from('institution_members')
          .update({ role, updated_at: new Date().toISOString() })
          .eq('id', memberId);

        if (updateError) throw updateError;

        toast.success('Member role updated');
        await fetchMembers();
        return true;
      } catch (err: any) {
        toast.error(err.message ?? 'Failed to update role');
        return false;
      }
    },
    [fetchMembers]
  );

  const revokeInvite = useCallback(
    async (inviteId: string): Promise<boolean> => {
      try {
        const { error: revokeError } = await supabase
          .from('institution_invites')
          .update({ status: 'revoked' })
          .eq('id', inviteId);

        if (revokeError) throw revokeError;

        toast.success('Invitation revoked');
        await fetchMembers();
        return true;
      } catch (err: any) {
        toast.error(err.message ?? 'Failed to revoke invitation');
        return false;
      }
    },
    [fetchMembers]
  );

  return {
    members,
    pendingInvites,
    isLoading,
    error,
    refetch: fetchMembers,
    inviteMember,
    removeMember,
    updateMemberRole,
    revokeInvite,
  };
}
