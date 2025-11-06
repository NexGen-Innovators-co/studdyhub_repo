import React, { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { 
  LogOut, 
  Home, 
  Users, 
  Shield, 
  AlertTriangle, 
  Settings, 
  FileText,
  Menu,
  X,
  BarChart3
} from 'lucide-react';

export const AdminLayout = () => {
  const { adminUser, permissions, loading: adminLoading } = useAdminAuth();
  const { user, loading: authLoading } = useAuth();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Check authentication and admin status
  useEffect(() => {
    if (!authLoading && !adminLoading) {
      if (!user) {
        navigate('/auth', { replace: true });
      } else if (!adminUser) {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [user, adminUser, authLoading, adminLoading, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  // Define navigation items
  const navItems = [
    { to: '/admin', icon: Home, label: 'Dashboard', perm: true },
    { to: '/admin/users', icon: Users, label: 'Users', perm: permissions.canManageUsers },
    { to: '/admin/admins', icon: Shield, label: 'Admins', perm: permissions.canManageAdmins },
    { to: '/admin/moderation', icon: AlertTriangle, label: 'Moderation', perm: permissions.canModerateContent },
    { to: '/admin/settings', icon: Settings, label: 'Settings', perm: permissions.canManageSettings },
    { to: '/admin/logs', icon: FileText, label: 'Activity Logs', perm: permissions.canViewLogs },
  ].filter(i => i.perm);

  // Loading state
  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  // Access denied state
  if (!user || !adminUser) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center max-w-md p-8 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-red-800/50 shadow-lg">
          <div className="text-red-500 dark:text-red-400 text-6xl mb-4">🚫</div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            You don't have permission to access the admin panel.
          </p>
          <Button 
            onClick={() => navigate('/dashboard')} 
            variant="outline"
            className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300"
          >
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-950 text-gray-900 dark:text-white flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50 shadow-sm">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <Link to="/admin" className="flex items-center gap-3 group">
              <img src="/siteimage.png" alt="Logo" className="h-8 w-8 rounded group-hover:scale-110 transition-transform" />
              <div>
                <h1 className="text-lg font-bold text-gray-900 dark:text-white">Admin Panel</h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">studdyhub AI</p>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium text-gray-900 dark:text-white">{adminUser.email}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 capitalize flex items-center justify-end gap-1">
                {adminUser.role === 'super_admin' && '👑'}
                {adminUser.role === 'admin' && '🛡️'}
                {adminUser.role === 'moderator' && '✓'}
                {adminUser.role.replace('_', ' ')}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/dashboard')}
              className="hidden md:flex bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Back to App
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={handleSignOut}
              className="text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-red-600 dark:hover:text-red-400"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Mobile Overlay */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/50 dark:bg-black/70 z-40 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`
            fixed lg:static inset-y-0 left-0 w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800
            transform transition-transform duration-300 lg:translate-x-0 shadow-lg lg:shadow-none
            ${mobileMenuOpen ? 'translate-x-0 z-50' : '-translate-x-full'}
            pt-16 lg:pt-0
          `}
        >
          <nav className="p-4 space-y-1 overflow-y-auto h-full">
            <div className="mb-4 px-3">
              <div className="flex items-center gap-2 p-3 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg border border-blue-200 dark:border-blue-800/50">
                <BarChart3 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <div>
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Admin Level</p>
                  <p className="text-sm font-bold text-gray-900 dark:text-white capitalize">
                    {adminUser.role.replace('_', ' ')}
                  </p>
                </div>
              </div>
            </div>

            {navItems.map(({ to, icon: Icon, label }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setMobileMenuOpen(false)}
                className={`
                  w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200
                  ${isActive(to) 
                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-600 dark:to-blue-700 text-white shadow-lg' 
                    : 'text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                  }
                `}
              >
                <Icon className="h-5 w-5" />
                <span className="font-medium">{label}</span>
                {isActive(to) && (
                  <div className="ml-auto h-2 w-2 rounded-full bg-white"></div>
                )}
              </Link>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-950">
          <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};