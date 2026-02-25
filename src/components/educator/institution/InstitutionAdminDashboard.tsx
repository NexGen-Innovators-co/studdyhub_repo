// src/components/educator/institution/InstitutionAdminDashboard.tsx
// Main institution management dashboard — overview, members, settings, analytics.

import React, { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Building2, Users, Settings, BarChart3, FolderTree } from 'lucide-react';
import { useEducatorContext } from '@/contexts/EducatorContext';
import { InstitutionOverview } from './InstitutionOverview';
import { MemberManagement } from './MemberManagement';
import { InstitutionSettings } from './InstitutionSettings';
import { InstitutionAnalytics } from './InstitutionAnalytics';
import { DepartmentManager } from './DepartmentManager';
import ModernPremiumLoader from '@/components/ui/ModernPremiumLoader';

export const InstitutionAdminDashboard: React.FC = () => {
  const { institution, membership, institutionLoading: isLoading } = useEducatorContext();
  const [activeTab, setActiveTab] = useState('overview');

  if (isLoading) {
    return <ModernPremiumLoader fullScreen={false} size="md" text="LOADING" />;
  }

  if (!institution) {
    return (
      <div className="text-center py-12">
        <Building2 className="w-12 h-12 mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          No Institution
        </h3>
        <p className="text-gray-500">
          You haven't created or joined an institution yet.
        </p>
      </div>
    );
  }

  const isAdmin = membership?.role === 'owner' || membership?.role === 'admin';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        {institution.logo_url ? (
          <img
            src={institution.logo_url}
            alt={institution.name}
            className="w-12 h-12 rounded-xl object-cover border"
          />
        ) : (
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Building2 className="w-6 h-6 text-white" />
          </div>
        )}
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {institution.name}
          </h2>
          <p className="text-sm text-gray-500">
            {institution.type} · {institution.verification_status}
            {institution.country && ` · ${institution.country.flag_emoji} ${institution.country.name}`}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5 lg:w-[620px]">
          <TabsTrigger value="overview">
            <Building2 className="w-4 h-4 mr-1.5" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="members">
            <Users className="w-4 h-4 mr-1.5" />
            Members
          </TabsTrigger>
          <TabsTrigger value="departments" disabled={!isAdmin}>
            <FolderTree className="w-4 h-4 mr-1.5" />
            Depts
          </TabsTrigger>
          <TabsTrigger value="analytics" disabled={!isAdmin}>
            <BarChart3 className="w-4 h-4 mr-1.5" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="settings" disabled={!isAdmin}>
            <Settings className="w-4 h-4 mr-1.5" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <InstitutionOverview institution={institution} membership={membership} />
        </TabsContent>

        <TabsContent value="members" className="mt-6">
          <MemberManagement institutionId={institution.id} isAdmin={isAdmin} />
        </TabsContent>

        <TabsContent value="departments" className="mt-6">
          <DepartmentManager institution={institution} isAdmin={isAdmin} onUpdate={() => window.location.reload()} />
        </TabsContent>

        <TabsContent value="analytics" className="mt-6">
          <InstitutionAnalytics institutionId={institution.id} />
        </TabsContent>

        <TabsContent value="settings" className="mt-6">
          <InstitutionSettings institution={institution} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default InstitutionAdminDashboard;
