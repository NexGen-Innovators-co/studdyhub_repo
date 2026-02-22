// src/components/educator/EducatorGuard.tsx
// Route guard that redirects non-educators away from /educator/* routes.

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useEducatorPermissions } from '@/hooks/useEducatorPermissions';
import ModernPremiumLoader from '@/components/ui/ModernPremiumLoader';

interface EducatorGuardProps {
  children: React.ReactNode;
}

export const EducatorGuard: React.FC<EducatorGuardProps> = ({ children }) => {
  const { permissions, isLoading } = useEducatorPermissions();

  if (isLoading) {
    return <ModernPremiumLoader fullScreen={false} size="md" text="LOADING" />;
  }

  if (!permissions.isEducator) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default EducatorGuard;
