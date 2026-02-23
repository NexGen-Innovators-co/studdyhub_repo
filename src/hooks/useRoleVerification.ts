// src/hooks/useRoleVerification.ts
// Hook for submitting and tracking role verification requests.

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { RoleVerificationRequest, VerificationDocument, UserRole } from '@/types/Education';
import { toast } from 'sonner';

interface SubmitRequestParams {
  requestedRole: UserRole;
  institutionId?: string | null;
  qualifications?: string;
  yearsExperience?: string;
  specializations?: string[];
  additionalNotes?: string;
  documents?: VerificationDocument[];
}

export function useRoleVerification() {
  const { user } = useAuth();
  const [currentRequest, setCurrentRequest] = useState<RoleVerificationRequest | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch existing pending/latest request
  const fetchCurrentRequest = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('role_verification_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        setCurrentRequest(data as unknown as RoleVerificationRequest);
      }
    } catch {
      // Table may not exist yet
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchCurrentRequest();
  }, [fetchCurrentRequest]);

  // Upload a verification document to storage
  const uploadDocument = useCallback(async (file: File): Promise<VerificationDocument | null> => {
    if (!user?.id) return null;

    const ext = file.name.split('.').pop();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${user.id}/${Date.now()}_${safeName}`;

    const { error } = await supabase.storage
      .from('verification-docs')
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      // Fallback: try avatars bucket with verification prefix if verification-docs doesn't exist
      const fallbackPath = `verification/${user.id}/${Date.now()}_${safeName}`;
      const { error: fallbackError } = await supabase.storage
        .from('avatars')
        .upload(fallbackPath, file, { cacheControl: '3600', upsert: false });

      if (fallbackError) {
        toast.error(`Failed to upload ${file.name}`);
        return null;
      }

      return {
        name: file.name,
        path: `avatars/${fallbackPath}`,
        uploaded_at: new Date().toISOString(),
        size: file.size,
      };
    }

    return {
      name: file.name,
      path: `verification-docs/${path}`,
      uploaded_at: new Date().toISOString(),
      size: file.size,
    };
  }, [user?.id]);

  // Submit a role verification request via RPC
  const submitRequest = useCallback(async (params: SubmitRequestParams): Promise<boolean> => {
    if (!user?.id) return false;
    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.rpc('submit_role_request', {
        _user_id: user.id,
        _requested_role: params.requestedRole,
        _institution_id: params.institutionId || null,
        _qualifications: params.qualifications || null,
        _years_experience: params.yearsExperience || null,
        _specializations: params.specializations || null,
        _additional_notes: params.additionalNotes || null,
        _documents: JSON.stringify(params.documents || []),
      });

      if (error) throw error;

      toast.success('Verification request submitted! An admin will review it shortly.');
      await fetchCurrentRequest();
      return true;
    } catch (err: any) {
      const msg = err?.message || 'Failed to submit verification request';
      if (msg.includes('already have a pending')) {
        toast.error('You already have a pending verification request.');
      } else {
        toast.error(msg);
      }
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [user?.id, fetchCurrentRequest]);

  return {
    currentRequest,
    isLoading,
    isSubmitting,
    submitRequest,
    uploadDocument,
    refetch: fetchCurrentRequest,
  };
}
