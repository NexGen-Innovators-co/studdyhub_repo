// src/hooks/useInstitution.ts
// Hook for managing institution data — fetching, creating, updating.
// Used in educator dashboard and institution management pages.

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { Institution, InstitutionMember, InstitutionType } from '@/types/Education';
import { toast } from 'sonner';

interface UseInstitutionReturn {
  institution: Institution | null;
  membership: InstitutionMember | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createInstitution: (data: CreateInstitutionInput) => Promise<Institution | null>;
  updateInstitution: (updates: Partial<Institution>) => Promise<boolean>;
}

export interface CreateInstitutionInput {
  name: string;
  slug: string;
  type: InstitutionType;
  countryId?: string;
  educationLevelId?: string;
  description?: string;
  website?: string;
  address?: string;
  city?: string;
  region?: string;
}

export function useInstitution(): UseInstitutionReturn {
  const { user } = useAuth();
  const [institution, setInstitution] = useState<Institution | null>(null);
  const [membership, setMembership] = useState<InstitutionMember | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInstitution = useCallback(async () => {
    if (!user?.id) {
      setInstitution(null);
      setMembership(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Find user's active institution membership (educator / admin / owner)
      const { data: memberData, error: memberError } = await supabase
        .from('institution_members')
        .select(`
          *,
          institution:institutions (
            *,
            country:countries ( id, code, name, flag_emoji ),
            education_level:education_levels ( id, code, name, short_name, category )
          )
        `)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .in('role', ['owner', 'admin', 'educator'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (memberError) {
        if (memberError.code === '42P01') {
          setIsLoading(false);
          return;
        }
        throw memberError;
      }

      if (memberData) {
        const inst = memberData.institution as any;
        setInstitution({
          id: inst.id,
          name: inst.name,
          slug: inst.slug,
          type: inst.type as InstitutionType,
          country_id: inst.country_id,
          education_level_id: inst.education_level_id,
          address: inst.address,
          city: inst.city,
          region: inst.region,
          website: inst.website,
          logo_url: inst.logo_url,
          description: inst.description,
          verification_status: inst.verification_status,
          settings: inst.settings ?? {},
          metadata: inst.metadata ?? {},
          is_active: inst.is_active ?? true,
          created_at: inst.created_at,
          updated_at: inst.updated_at,
          country: inst.country,
          education_level: inst.education_level,
        });

        setMembership({
          id: memberData.id,
          institution_id: memberData.institution_id,
          user_id: memberData.user_id,
          role: memberData.role as any,
          status: memberData.status as any,
          title: memberData.title,
          department: memberData.department,
          invited_by: memberData.invited_by,
          invite_code: memberData.invite_code,
          joined_at: memberData.joined_at,
          created_at: memberData.created_at,
          updated_at: memberData.updated_at,
        });
      } else {
        setInstitution(null);
        setMembership(null);
      }
    } catch (err: any) {
      setError(err.message ?? 'Failed to load institution');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchInstitution();
  }, [fetchInstitution]);

  const createInstitution = useCallback(
    async (data: CreateInstitutionInput): Promise<Institution | null> => {
      if (!user?.id) return null;

      try {
        const { data: inst, error: createError } = await supabase
          .from('institutions')
          .insert({
            name: data.name,
            slug: data.slug,
            type: data.type,
            country_id: data.countryId || null,
            education_level_id: data.educationLevelId || null,
            description: data.description || null,
            website: data.website || null,
            address: data.address || null,
            city: data.city || null,
            region: data.region || null,
          })
          .select('*')
          .single();

        if (createError) throw createError;

        // Add creator as owner
        const { error: memberError } = await supabase.from('institution_members').insert({
          institution_id: inst.id,
          user_id: user.id,
          role: 'owner',
          status: 'active',
          joined_at: new Date().toISOString(),
        });

        if (memberError) throw memberError;

        toast.success('Institution created successfully!');
        await fetchInstitution();
        return inst as any;
      } catch (err: any) {
        toast.error(err.message ?? 'Failed to create institution');
        return null;
      }
    },
    [user?.id, fetchInstitution]
  );

  const updateInstitution = useCallback(
    async (updates: Partial<Institution>): Promise<boolean> => {
      if (!institution?.id) return false;

      try {
        const { error: updateError } = await supabase
          .from('institutions')
          .update({
            name: updates.name,
            description: updates.description,
            website: updates.website,
            address: updates.address,
            city: updates.city,
            region: updates.region,
            logo_url: updates.logo_url,
            settings: updates.settings as any,
            metadata: updates.metadata as any,
          })
          .eq('id', institution.id);

        if (updateError) throw updateError;

        toast.success('Institution updated!');
        await fetchInstitution();
        return true;
      } catch (err: any) {
        toast.error(err.message ?? 'Failed to update institution');
        return false;
      }
    },
    [institution?.id, fetchInstitution]
  );

  return {
    institution,
    membership,
    isLoading,
    error,
    refetch: fetchInstitution,
    createInstitution,
    updateInstitution,
  };
}
