// src/components/educator/institution/InstitutionSettingsPage.tsx
// Route-level wrapper that fetches institution data and passes it to InstitutionSettings.

import React from 'react';
import { Loader2, Building2 } from 'lucide-react';
import { useEducatorContext } from '@/contexts/EducatorContext';
import { InstitutionSettings } from './InstitutionSettings';

export const InstitutionSettingsPage: React.FC = () => {
  const { institution, institutionLoading: isLoading } = useEducatorContext();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!institution) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-500 dark:text-gray-400">
        <Building2 className="h-12 w-12 mb-4 opacity-40" />
        <p className="text-lg font-medium">No institution found</p>
        <p className="text-sm mt-1">Create or join an institution to manage settings.</p>
      </div>
    );
  }

  return <InstitutionSettings institution={institution} />;
};

export default InstitutionSettingsPage;
