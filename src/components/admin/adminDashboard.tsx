import React, { Suspense, lazy, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Skeleton } from '../ui/skeleton';
import { LayoutDashboard, Users, Shield, AlertTriangle, Settings, FileText, Flag, Sparkles, Bot, Megaphone } from 'lucide-react';
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

const LoadingFallback = () => (
  <div className="space-y-6">
    <Skeleton className="h-12 w-64 bg-gray-800" />
    <Skeleton className="h-32 w-full bg-gray-800" />
    <Skeleton className="h-64 w-full bg-gray-800" />
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
    { id: 'settings', label: 'Settings', icon: Settings, component: SystemSettings, perm: permissions.canManageSettings },
    { id: 'logs', label: 'Activity Logs', icon: FileText, component: ActivityLogs, perm: permissions.canViewLogs },
  ].filter(t => t.perm);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
        <p className="text-gray-400 mt-1">Manage your platform with full control</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-10 w-full mb-8 bg-gray-800 p-1 rounded-lg">
          {tabs.map(({ id, label, icon: Icon }) => (
            <TabsTrigger
              key={id}
              value={id}
              className="flex items-center gap-2 data-[state=active]:bg-gray-900 data-[state=active]:text-white text-gray-400"
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

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