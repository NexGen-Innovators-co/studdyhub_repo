// src/hooks/useEducatorPermissions.ts
// Computes client-side permissions for educator roles.
// Uses institution_members to determine role within their institution.

import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type {
  EducatorPermissions,
  InstitutionMember,
  Institution,
  UserRole,
  InstitutionMemberRole,
} from '@/types/Education';

interface MembershipRow extends InstitutionMember {
  institution: Institution;
}

export function useEducatorPermissions() {
  const { user } = useAuth();
  const [membership, setMembership] = useState<MembershipRow | null>(null);
  const [userRole, setUserRole] = useState<UserRole>('student');
  const [isLoading, setIsLoading] = useState(false);

  const fetchMembership = useCallback(async () => {
    if (!user?.id) {
      setMembership(null);
      setUserRole('student');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      // Fetch user_role from profiles
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_role')
        .eq('id', user.id)
        .maybeSingle();

      const role = (profile?.user_role as UserRole) ?? 'student';
      setUserRole(role);

      // Fetch institution membership (educator role)
      const { data: memberData } = await supabase
        .from('institution_members')
        .select('*, institution:institutions(*)')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .in('role', ['owner', 'admin', 'educator'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setMembership(memberData as MembershipRow | null);
    } catch {
      // Tables may not exist yet — degrade silently
      setMembership(null);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchMembership();
  }, [fetchMembership]);

  const permissions: EducatorPermissions = useMemo(() => {
    const instRole = (membership?.role as InstitutionMemberRole) ?? null;
    const isEdRole = ['school_admin', 'tutor_affiliated', 'tutor_independent'].includes(userRole);

    return {
      isEducator: isEdRole || !!instRole,
      role: userRole,
      institutionRole: instRole,
      institutionId: membership?.institution_id ?? null,
      institutionName: membership?.institution?.name ?? null,
      canCreateCourses: !!instRole || userRole === 'tutor_independent',
      canPublishCourses: ['owner', 'admin'].includes(instRole ?? '') || userRole === 'tutor_independent',
      canManageMembers: ['owner', 'admin'].includes(instRole ?? ''),
      canViewInstitutionAnalytics: ['owner', 'admin'].includes(instRole ?? ''),
      canEditInstitutionSettings: ['owner', 'admin'].includes(instRole ?? ''),
      canInviteStudents: ['owner', 'admin'].includes(instRole ?? ''),
      canInviteEducators: ['owner', 'admin'].includes(instRole ?? ''),
    };
  }, [userRole, membership]);

  return { permissions, isLoading, refetch: fetchMembership };
}
