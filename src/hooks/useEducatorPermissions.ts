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
  const [isLoading, setIsLoading] = useState(true);

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

      let role = (profile?.user_role as UserRole) ?? 'student';
      let vStatus = (profile?.role_verification_status as RoleVerificationStatus) ?? 'not_required';

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

      // Cross-check: if profile says 'pending', verify against multiple sources
      if (vStatus === 'pending') {
        let resolved = false;

        // Check 1: If user is owner/admin/educator in a VERIFIED institution,
        // their role verification should be auto-approved
        if (memberData) {
          const inst = (memberData as any).institution;
          if (inst?.verification_status === 'verified') {
            vStatus = 'verified';
            resolved = true;
            // NOTE: We don't attempt to self-heal the profile here because
            // the RLS policy blocks users from updating role_verification_status.
            // The admin approval flow handles this at the DB level.
          }
        }

        // Check 2: Cross-check against role_verification_requests table
        if (!resolved) {
          try {
            const { data: latestReq } = await supabase
              .from('role_verification_requests')
              .select('status, requested_role')
              .eq('user_id', user.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (latestReq?.status === 'approved') {
              // Request was approved but profile wasn't updated — override client-side
              vStatus = 'verified';
              role = (latestReq.requested_role as UserRole) || role;
            } else if (latestReq?.status === 'rejected') {
              vStatus = 'rejected';
            }
          } catch {
            // requests table may not exist — keep profile value
          }
        }
      }

      setUserRole(role);
      setVerificationStatus(vStatus);
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
