// src/contexts/EducatorContext.tsx
// Provides shared educator + institution data to all /educator/* child routes.
// Eliminates duplicate fetches across sub-pages.

import React, { createContext, useContext } from 'react';
import { useEducatorPermissions } from '@/hooks/useEducatorPermissions';
import { useInstitution } from '@/hooks/useInstitution';
import type { EducatorPermissions, Institution, InstitutionMember } from '@/types/Education';

interface EducatorContextValue {
  permissions: EducatorPermissions;
  institution: Institution | null;
  membership: InstitutionMember | null;
  institutionLoading: boolean;
  permissionsLoading: boolean;
  refetchInstitution: () => Promise<void>;
  refetchPermissions: () => Promise<void>;
}

const EducatorCtx = createContext<EducatorContextValue | null>(null);

export const EducatorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { permissions, isLoading: permissionsLoading, refetch: refetchPermissions } = useEducatorPermissions();
  const { institution, membership, isLoading: institutionLoading, refetch: refetchInstitution } = useInstitution();

  return (
    <EducatorCtx.Provider
      value={{
        permissions,
        institution,
        membership,
        institutionLoading,
        permissionsLoading,
        refetchInstitution,
        refetchPermissions,
      }}
    >
      {children}
    </EducatorCtx.Provider>
  );
};

export function useEducatorContext(): EducatorContextValue {
  const ctx = useContext(EducatorCtx);
  if (!ctx) {
    throw new Error('useEducatorContext must be used within an EducatorProvider');
  }
  return ctx;
}
