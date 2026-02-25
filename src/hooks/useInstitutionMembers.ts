// src/hooks/useInstitutionMembers.ts
// Hook for managing institution members — list, invite, remove, update roles.

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { InstitutionMember, InstitutionMemberRole, InstitutionMemberStatus, InstitutionInvite } from '@/types/Education';
import { toast } from 'sonner';
import { createInstitutionInviteNotification } from '@/services/notificationHelpers';

// Module-level flag: tracks whether institution_invites is accessible via RLS.
// null = unknown (will try), true = accessible, number = skip counter (retries after N fetches).
let invitesAccessible: boolean | null | number = null;

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
  inviteMember: (email: string, role: 'educator' | 'student', existingUserId?: string, institutionName?: string, inviterName?: string) => Promise<string | null>;
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
      // Fetch members without profile join (FK relationship may not exist),
      // then fetch profiles separately and merge client-side
      const { data: rawMembers, error: memberError } = await supabase
        .from('institution_members')
        .select('*')
        .eq('institution_id', institutionId)
        .in('status', ['active', 'pending', 'invited'])
        .order('created_at', { ascending: false });

      if (memberError) throw memberError;
      let memberData = rawMembers || [];

      // Fetch profiles for all member user_ids
      const userIds = memberData.map((m: any) => m.user_id).filter(Boolean);
      if (userIds.length > 0) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, email')
          .in('id', userIds);

        const profileMap = new Map((profileData || []).map((p: any) => [p.id, p]));
        memberData = memberData.map((m: any) => ({
          ...m,
          profile: profileMap.get(m.user_id) || null,
        }));
      }

      setMembers(
        memberData.map((m: any) => ({
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

      // Fetch pending invites — skip if we recently got a 403 (retry after cooldown)
      const shouldTryInvites = invitesAccessible === null || invitesAccessible === true
        || (typeof invitesAccessible === 'number' && invitesAccessible <= 0);

      if (shouldTryInvites) {
        try {
          const { data: inviteData, error: inviteError } = await supabase
            .from('institution_invites')
            .select('*')
            .eq('institution_id', institutionId)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

          if (!inviteError && inviteData) {
            invitesAccessible = true;
            setPendingInvites(
              inviteData.map((inv: any) => ({
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
          } else {
            // 403 or other error — skip next 5 fetches then retry
            invitesAccessible = 5;
            setPendingInvites([]);
          }
        } catch {
          invitesAccessible = 5;
          setPendingInvites([]);
        }
      } else {
        // Decrement cooldown counter
        if (typeof invitesAccessible === 'number') {
          invitesAccessible = invitesAccessible - 1;
        }
        setPendingInvites([]);
      }
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
    async (
      email: string,
      role: 'educator' | 'student',
      existingUserId?: string,
      institutionName?: string,
      inviterName?: string,
    ): Promise<string | null> => {
      if (!institutionId || !user?.id) return null;

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

        // Reset the invites accessibility flag so fetchMembers re-queries invites
        invitesAccessible = null;

        // Send in-app notification if invitee is an existing user
        if (existingUserId) {
          createInstitutionInviteNotification(
            existingUserId,
            institutionName || 'an institution',
            role,
            token,
            inviterName,
          ).catch(() => {}); // fire-and-forget, don't block invite
        }

        toast.success(`Invitation created for ${email}`);
        await fetchMembers();
        return token;
      } catch (err: any) {
        const msg = err?.code === '23505' || err?.message?.includes('duplicate') || err?.message?.includes('unique')
          ? `An invitation for ${email} already exists`
          : (err.message ?? 'Failed to send invitation');
        toast.error(msg);
        return null;
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
