// src/components/educator/EducatorLayout.tsx
// Shell layout for all /educator/* pages.
// Wraps content in EducatorGuard and provides a sidebar navigation.

import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  BookOpen,
  Users,
  Settings,
  GraduationCap,
  BarChart3,
  Building2,
} from 'lucide-react';
import { EducatorGuard } from './EducatorGuard';
import { useEducatorPermissions } from '@/hooks/useEducatorPermissions';

const NAV_ITEMS = [
  { to: '/educator', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/educator/courses', label: 'Courses', icon: BookOpen },
  { to: '/educator/institution', label: 'Institution', icon: Building2 },
  { to: '/educator/students', label: 'Students', icon: Users },
  { to: '/educator/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/educator/settings', label: 'Settings', icon: Settings },
];

export const EducatorLayout: React.FC = () => {
  const { permissions } = useEducatorPermissions();

  return (
    <EducatorGuard>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center h-14 gap-4">
            <GraduationCap className="h-5 w-5 text-blue-500" />
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
              Educator Portal
            </h1>
            {permissions.institutionName && (
              <span className="text-sm text-gray-500 dark:text-gray-400 ml-auto">
                {permissions.institutionName}
              </span>
            )}
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex gap-6">
          {/* Sidebar nav */}
          <nav className="hidden md:flex flex-col gap-1 w-48 flex-shrink-0">
            {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
          </nav>

          {/* Content area */}
          <div className="flex-1 min-w-0">
            <Outlet />
          </div>
        </div>
      </div>
    </EducatorGuard>
  );
};

export default EducatorLayout;
