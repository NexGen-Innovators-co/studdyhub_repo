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
  RoleVerificationStatus,
} from '@/types/Education';

interface MembershipRow extends InstitutionMember {
  institution: Institution;
}

export function useEducatorPermissions() {
  const { user } = useAuth();
  const [membership, setMembership] = useState<MembershipRow | null>(null);
  const [userRole, setUserRole] = useState<UserRole>('student');
  const [verificationStatus, setVerificationStatus] = useState<RoleVerificationStatus>('not_required');
  const [isLoading, setIsLoading] = useState(false);

  const fetchMembership = useCallback(async () => {
    if (!user?.id) {
      setMembership(null);
      setUserRole('student');
      setVerificationStatus('not_required');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      // Fetch user_role and verification status from profiles
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_role, role_verification_status')
        .eq('id', user.id)
        .maybeSingle();

      const role = (profile?.user_role as UserRole) ?? 'student';
      const vStatus = (profile?.role_verification_status as RoleVerificationStatus) ?? 'not_required';
      setUserRole(role);
      setVerificationStatus(vStatus);

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
    // Only count as a verified educator if verification has passed
    const isVerifiedEducator = isEdRole && verificationStatus === 'verified';

    return {
      isEducator: isVerifiedEducator || !!instRole,
      role: userRole,
      roleVerificationStatus: verificationStatus,
      institutionRole: instRole,
      institutionId: membership?.institution_id ?? null,
      institutionName: membership?.institution?.name ?? null,
      canCreateCourses: !!instRole || (userRole === 'tutor_independent' && verificationStatus === 'verified'),
      canPublishCourses: ['owner', 'admin'].includes(instRole ?? '') || (userRole === 'tutor_independent' && verificationStatus === 'verified'),
      canManageMembers: ['owner', 'admin'].includes(instRole ?? ''),
      canViewInstitutionAnalytics: ['owner', 'admin'].includes(instRole ?? ''),
      canEditInstitutionSettings: ['owner', 'admin'].includes(instRole ?? ''),
      canInviteStudents: ['owner', 'admin'].includes(instRole ?? ''),
      canInviteEducators: ['owner', 'admin'].includes(instRole ?? ''),
    };
  }, [userRole, membership, verificationStatus]);

  return { permissions, isLoading, refetch: fetchMembership };
}
