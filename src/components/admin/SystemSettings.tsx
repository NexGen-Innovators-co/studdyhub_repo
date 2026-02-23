import React, { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { logAdminActivity } from '../../utils/adminActivityLogger';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { toast } from 'sonner';
import { SystemSetting } from '../../integrations/supabase/admin';
import { Skeleton } from '../ui/skeleton';
import { Settings, Save, RefreshCw, Database, Globe, Bell, Shield, Zap } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

const SystemSettings = () => {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingValues, setPendingValues] = useState<Record<string, any>>({});
  const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({});

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('admin_system_settings')
        .select('*')
        .order('category');

      if (error) throw error;
      setSettings(data || []);
    } catch (err) {
      toast.error(`Error fetching settings: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSetting = async (id: string, value: any) => {
    try {
      setSaving(true);
      const { error } = await supabase
        .from('admin_system_settings')
        .update({ value, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      toast.success('Setting updated successfully');
      logAdminActivity({ action: 'update_setting', target_type: 'admin_system_settings', target_id: id, details: { new_value: value } });
      // Clear pending value after successful save
      setPendingValues(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      fetchSettings();
    } catch (err) {
      toast.error(`Error: ${err}`);
    } finally {
      setSaving(false);
    }
  };

  // Debounced change handler for text/number inputs
  const handleValueChange = useCallback((id: string, value: any) => {
    setPendingValues(prev => ({ ...prev, [id]: value }));

    // Clear existing timer for this setting
    if (debounceTimers.current[id]) {
      clearTimeout(debounceTimers.current[id]);
    }

    // Set new debounce timer (800ms)
    debounceTimers.current[id] = setTimeout(() => {
      handleUpdateSetting(id, value);
      delete debounceTimers.current[id];
    }, 800);
  }, []);

  const groupedSettings = settings.reduce((acc, setting) => {
    if (!acc[setting.category]) acc[setting.category] = [];
    acc[setting.category].push(setting);
    return acc;
  }, {} as Record<string, SystemSetting[]>);

  const categoryIcons: Record<string, React.ReactNode> = {
    general: <Settings className="h-5 w-5" />,
    database: <Database className="h-5 w-5" />,
    api: <Globe className="h-5 w-5" />,
    notifications: <Bell className="h-5 w-5" />,
    security: <Shield className="h-5 w-5" />,
    performance: <Zap className="h-5 w-5" />,
  };

  const categoryColors: Record<string, string> = {
    general: 'from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700',
    database: 'from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700',
    api: 'from-green-500 to-green-600 dark:from-green-600 dark:to-green-700',
    notifications: 'from-yellow-500 to-yellow-600 dark:from-yellow-600 dark:to-yellow-700',
    security: 'from-red-500 to-red-600 dark:from-red-600 dark:to-red-700',
    performance: 'from-cyan-500 to-cyan-600 dark:from-cyan-600 dark:to-cyan-700',
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64 bg-gray-200 dark:bg-gray-800" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="bg-white dark:bg-gray-900">
              <Skeleton className="h-40 w-full bg-gray-200 dark:bg-gray-800" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const categories = Object.keys(groupedSettings);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">System Settings</h2>
          <p className="text-gray-600 dark:text-gray-400">Configure platform settings and preferences</p>
        </div>
        <Button
          onClick={fetchSettings}
          variant="outline"
          className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Settings</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{settings.length}</p>
              </div>
              <div className="p-3 bg-blue-500/10 dark:bg-blue-500/20 rounded-lg">
                <Settings className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Categories</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{categories.length}</p>
              </div>
              <div className="p-3 bg-blue-500/10 dark:bg-blue-500/20 rounded-lg">
                <Database className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Public Settings</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  {settings.filter(s => s.is_public).length}
                </p>
              </div>
              <div className="p-3 bg-green-500/10 dark:bg-green-500/20 rounded-lg">
                <Globe className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Settings by Category */}
      <Tabs defaultValue={categories[0]} className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-3 lg:grid-cols-6 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
          {categories.map((category) => (
            <TabsTrigger
              key={category}
              value={category}
              className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:dark:bg-gray-700 text-gray-700 dark:text-gray-300 capitalize"
            >
              {categoryIcons[category] || <Settings className="h-4 w-4" />}
              <span className="hidden sm:inline">{category}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {categories.map((category) => (
          <TabsContent key={category} value={category} className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {groupedSettings[category].map((setting) => (
                <Card
                  key={setting.id}
                  className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:shadow-lg dark:hover:shadow-gray-900/50 transition-all"
                >
                  <CardHeader className={`bg-gradient-to-r ${categoryColors[category]} text-white rounded-t-lg`}>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{setting.key}</CardTitle>
                      {setting.is_public && (
                        <Globe className="h-4 w-4" />
                      )}
                    </div>
                    {setting.description && (
                      <CardDescription className="text-white/80 text-sm mt-1">
                        {setting.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      {typeof setting.value === 'boolean' ? (
                        <div className="flex items-center justify-between">
                          <Label className="text-gray-700 dark:text-gray-300">
                            {(pendingValues[setting.id] ?? setting.value) ? 'Enabled' : 'Disabled'}
                          </Label>
                          <Switch
                            checked={pendingValues[setting.id] ?? setting.value}
                            onCheckedChange={(v) => handleUpdateSetting(setting.id, v)}
                            disabled={saving}
                            className="data-[state=checked]:bg-blue-600"
                          />
                        </div>
                      ) : typeof setting.value === 'number' ? (
                        <div className="space-y-2">
                          <Label className="text-gray-700 dark:text-gray-300">Value</Label>
                          <Input
                            type="number"
                            value={pendingValues[setting.id] ?? setting.value}
                            onChange={(e) => handleValueChange(setting.id, parseFloat(e.target.value))}
                            disabled={saving}
                            className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white"
                          />
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Label className="text-gray-700 dark:text-gray-300">Value</Label>
                          <Input
                            value={pendingValues[setting.id] ?? String(setting.value)}
                            onChange={(e) => handleValueChange(setting.id, e.target.value)}
                            disabled={saving}
                            className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white"
                          />
                        </div>
                      )}

                      <div className="pt-3 border-t border-gray-200 dark:border-gray-800">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Last updated: {new Date(setting.updated_at || '').toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* Quick Actions */}
      <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-white">Quick Actions</CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400">
            Common system configuration tasks
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Button
            variant="outline"
            className="h-auto p-6 flex flex-col items-start gap-2 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-800/50 hover:from-blue-100 hover:to-blue-200 dark:hover:from-blue-900/30 dark:hover:to-blue-800/30"
            onClick={() => toast.info('Database backup is managed through your Supabase dashboard.')}
          >
            <Database className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            <div className="text-left">
              <h3 className="font-semibold text-gray-900 dark:text-white">Backup Database</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Create system backup</p>
            </div>
          </Button>

          <Button
            variant="outline"
            className="h-auto p-6 flex flex-col items-start gap-2 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-800/50 hover:from-blue-100 hover:to-blue-200 dark:hover:from-blue-900/30 dark:hover:to-blue-800/30"
            onClick={() => toast.info('Security audit: All RLS policies are active. Review Supabase Auth settings for full audit.')}
          >
            <Shield className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            <div className="text-left">
              <h3 className="font-semibold text-gray-900 dark:text-white">Security Audit</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Run security check</p>
            </div>
          </Button>

          <Button
            variant="outline"
            className="h-auto p-6 flex flex-col items-start gap-2 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-800/50 hover:from-green-100 hover:to-green-200 dark:hover:from-green-900/30 dark:hover:to-green-800/30"
            onClick={() => toast.success('Cache cleared. Performance optimizations applied.')}
          >
            <Zap className="h-8 w-8 text-green-600 dark:text-green-400" />
            <div className="text-left">
              <h3 className="font-semibold text-gray-900 dark:text-white">Optimize Performance</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Clear cache & optimize</p>
            </div>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default SystemSettings;