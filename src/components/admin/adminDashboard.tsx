import React, { Suspense, lazy, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Skeleton } from '../ui/skeleton';
import { LayoutDashboard, Users, Shield, AlertTriangle, Settings, FileText, Flag, Sparkles, Bot, Megaphone, Building2 } from 'lucide-react';
import { useAdminAuth } from '../../hooks/useAdminAuth';

const AdminOverview = lazy(() => import('./AdminOverview'));
const UserManagement = lazy(() => import('./UserManagement'));
const AdminManagement = lazy(() => import('./AdminManagement'));
const ContentModeration = lazy(() => import('./ContentModeration'));
const ReportsManagement = lazy(() => import('./ReportsManagement'));
const ContentModerationAdmin = lazy(() => import('./ContentModerationAdmin'));
const SystemSettings = lazy(() => import('./SystemSettings'));
const ActivityLogs = lazy(() => import('./ActivityLogs'));
const AIAdminInsights = lazy(() => import('./AIAdminInsights'));
const PlatformUpdates = lazy(() => import('./PlatformUpdates'));
const AdminInstitutions = lazy(() => import('./AdminInstitutions'));

const LoadingFallback = () => (
  <div className="space-y-6">
    <Skeleton className="h-12 w-64 bg-gray-200 dark:bg-gray-800" />
    <Skeleton className="h-32 w-full bg-gray-200 dark:bg-gray-800" />
    <Skeleton className="h-64 w-full bg-gray-200 dark:bg-gray-800" />
  </div>
);

const AdminDashboard = () => {
  const { permissions } = useAdminAuth();
  const [activeTab, setActiveTab] = useState('overview');

  const tabs = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard, component: AdminOverview, perm: true },
    { id: 'users', label: 'Users', icon: Users, component: UserManagement, perm: permissions.canManageUsers },
    { id: 'admins', label: 'Admins', icon: Shield, component: AdminManagement, perm: permissions.canManageAdmins },
    { id: 'moderation', label: 'Moderation', icon: AlertTriangle, component: ContentModeration, perm: permissions.canModerateContent },
    { id: 'reports', label: 'Reports', icon: Flag, component: ReportsManagement, perm: permissions.canModerateContent },
    { id: 'ai-moderation', label: 'AI Moderation', icon: Sparkles, component: ContentModerationAdmin, perm: permissions.canManageSettings },
    { id: 'ai-insights', label: 'AI Insights', icon: Bot, component: AIAdminInsights, perm: true },
    { id: 'updates', label: 'Updates', icon: Megaphone, component: PlatformUpdates, perm: permissions.canManageSettings },
    { id: 'institutions', label: 'Institutions', icon: Building2, component: AdminInstitutions, perm: permissions.canManageSettings },
    { id: 'settings', label: 'Settings', icon: Settings, component: SystemSettings, perm: permissions.canManageSettings },
    { id: 'logs', label: 'Activity Logs', icon: FileText, component: ActivityLogs, perm: permissions.canViewLogs },
  ].filter(t => t.perm);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Manage your platform with full control</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <Suspense fallback={<LoadingFallback />}>
          {tabs.map(({ id, component: Component }) => (
            <TabsContent key={id} value={id} className="mt-0">
              <Component {...(id === 'overview' ? { onNavigate: setActiveTab } : {})} />
            </TabsContent>
          ))}
        </Suspense>
      </Tabs>
    </div>
  );
};

export default AdminDashboard;