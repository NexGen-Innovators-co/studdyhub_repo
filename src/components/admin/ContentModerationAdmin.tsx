import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logAdminActivity } from '@/utils/adminActivityLogger';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import {
  Shield,
  CheckCircle,
  XCircle,
  AlertTriangle,
  TrendingUp,
  Settings,
  BarChart3,
  BookOpen,
  Sparkles
} from 'lucide-react';

export const ContentModerationAdmin: React.FC = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<any>({
    enabled: true,
    strictness: 'medium',
    minEducationalScore: 0.6,
    allowedCategories: [],
    blockedKeywords: []
  });
  const [stats, setStats] = useState<any>({
    total: 0,
    approved: 0,
    rejected: 0,
    approvalRate: 0
  });
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [categoryData, setCategoryData] = useState<any[]>([]);

  useEffect(() => {
    fetchSettings();
    fetchStats();
    fetchRecentLogs();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .eq('key', 'content_moderation')
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data?.value) {
        setSettings(data.value);
      } else {
        // Create default settings
        const defaultSettings = {
          enabled: true,
          strictness: 'medium',
          minEducationalScore: 0.6,
          allowedCategories: [
            'Science', 'Mathematics', 'Technology', 'Engineering',
            'History', 'Literature', 'Language Learning', 'Arts',
            'Business', 'Economics', 'Health', 'Medicine',
            'Philosophy', 'Psychology', 'Social Sciences',
            'Study Tips', 'Exam Preparation', 'Career Guidance'
          ],
          blockedKeywords: ['spam', 'advertisement', 'buy now', 'click here']
        };
        
        await supabase.from('system_settings').insert({
          key: 'content_moderation',
          value: defaultSettings,
          description: 'Content moderation settings for educational posts'
        });

        setSettings(defaultSettings);
      }
    } catch (error) {

    }
  };

  const fetchStats = async () => {
    try {
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const [
        { count: totalCount },
        { count: approvedCount },
        { count: rejectedCount },
        { data: categoryData }
      ] = await Promise.all([
        supabase
          .from('content_moderation_log')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', startDate),
        supabase
          .from('content_moderation_log')
          .select('*', { count: 'exact', head: true })
          .eq('decision', 'approved')
          .gte('created_at', startDate),
        supabase
          .from('content_moderation_log')
          .select('*', { count: 'exact', head: true })
          .eq('decision', 'rejected')
          .gte('created_at', startDate),
        supabase
          .from('content_moderation_log')
          .select('category, decision')
          .gte('created_at', startDate)
          .not('category', 'is', null)
      ]);

      // Calculate category distribution
      const catStats: Record<string, { approved: number; rejected: number }> = {};
      categoryData?.forEach((item: any) => {
        const cat = item.category || 'Unknown';
        if (!catStats[cat]) {
          catStats[cat] = { approved: 0, rejected: 0 };
        }
        if (item.decision === 'approved') {
          catStats[cat].approved++;
        } else {
          catStats[cat].rejected++;
        }
      });

      const chartData = Object.entries(catStats).map(([name, data]) => ({
        name,
        approved: data.approved,
        rejected: data.rejected,
        total: data.approved + data.rejected
      }));

      setCategoryData(chartData);
      setStats({
        total: totalCount || 0,
        approved: approvedCount || 0,
        rejected: rejectedCount || 0,
        approvalRate: totalCount ? ((approvedCount || 0) / totalCount) * 100 : 0
      });
    } catch (error) {

    } finally {
      setLoading(false);
    }
  };

  const fetchRecentLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('content_moderation_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setRecentLogs(data || []);
    } catch (error) {

    }
  };

  const saveSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('system_settings')
        .upsert(
          {
            key: 'content_moderation',
            value: settings,
            description: 'Content moderation settings for educational posts',
            updated_by: user?.id
          },
          {
            onConflict: 'key',
            ignoreDuplicates: false
          }
        );

      if (error) throw error;

      toast({
        title: 'Settings Saved',
        description: 'Content moderation settings updated successfully.',
      });
      logAdminActivity({ action: 'update_content_moderation_settings', target_type: 'system_settings', details: { strictness: settings.strictness, enabled: settings.enabled } });
    } catch (error: any) {

      toast({
        title: 'Error',
        description: error.message || 'Failed to save settings',
        variant: 'destructive',
      });
    }
  };

  const updateStrictness = (value: string) => {
    const scores = { low: 0.4, medium: 0.6, high: 0.8 };
    setSettings({
      ...settings,
      strictness: value,
      minEducationalScore: scores[value as keyof typeof scores]
    });
  };

  const getDecisionBadge = (decision: string) => {
    switch (decision) {
      case 'approved':
        return <Badge variant="outline" className="bg-green-50 text-green-700"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-50 text-red-700"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="outline">{decision}</Badge>;
    }
  };

  const COLORS = ['#10b981', '#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-8 w-8 text-blue-600" />
            Content Moderation
          </h2>
          <p className="text-muted-foreground mt-1">
            AI-powered educational content validation
          </p>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Moderated</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Last 7 days</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
            <p className="text-xs text-muted-foreground">Educational content</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
            <p className="text-xs text-muted-foreground">Non-educational</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approval Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(stats.approvalRate)}%</div>
            <p className="text-xs text-muted-foreground">Success rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Moderation Settings
          </CardTitle>
          <CardDescription>
            Configure AI-powered content validation parameters
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable/Disable */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="enabled" className="font-medium">Enable Content Moderation</Label>
              <p className="text-sm text-muted-foreground">
                Automatically validate posts for educational content
              </p>
            </div>
            <Switch
              id="enabled"
              checked={settings.enabled}
              onCheckedChange={(checked) => setSettings({ ...settings, enabled: checked })}
            />
          </div>

          {/* Strictness Level */}
          <div className="space-y-2">
            <Label htmlFor="strictness">Strictness Level</Label>
            <Select value={settings.strictness} onValueChange={updateStrictness}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">
                  Low - Allow broadly educational content (40% threshold)
                </SelectItem>
                <SelectItem value="medium">
                  Medium - Require clear educational value (60% threshold)
                </SelectItem>
                <SelectItem value="high">
                  High - Only highly focused academic content (80% threshold)
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Current educational score threshold: {Math.round(settings.minEducationalScore * 100)}%
            </p>
          </div>

          {/* Blocked Keywords */}
          <div className="space-y-2">
            <Label htmlFor="keywords">Blocked Keywords</Label>
            <Textarea
              id="keywords"
              placeholder="spam, advertisement, buy now, click here"
              value={settings.blockedKeywords?.join(', ') || ''}
              onChange={(e) => setSettings({
                ...settings,
                blockedKeywords: e.target.value.split(',').map(k => k.trim()).filter(k => k)
              })}
              className="min-h-[80px]"
            />
            <p className="text-sm text-muted-foreground">
              Comma-separated list of keywords that trigger automatic rejection
            </p>
          </div>

          <Button onClick={saveSettings}>
            Save Settings
          </Button>
        </CardContent>
      </Card>

      {/* Category Analytics */}
      {categoryData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Content by Category
            </CardTitle>
            <CardDescription>
              Distribution of educational categories (Last 7 days)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={categoryData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="approved" fill="#10b981" name="Approved" />
                <Bar dataKey="rejected" fill="#ef4444" name="Rejected" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Recent Moderation Log */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Moderation Activity</CardTitle>
          <CardDescription>Latest content validation results</CardDescription>
        </CardHeader>
        <CardContent>
          {recentLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No moderation logs yet</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Content Preview</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Decision</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="max-w-xs truncate">
                      {log.content_preview || 'N/A'}
                    </TableCell>
                    <TableCell>
                      {log.category && (
                        <Badge variant="secondary">{log.category}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {log.educational_score !== null && (
                        <span className={log.educational_score >= 0.6 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                          {Math.round(log.educational_score * 100)}%
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{getDecisionBadge(log.decision)}</TableCell>
                    <TableCell>
                      {log.confidence !== null && (
                        <span>{Math.round(log.confidence * 100)}%</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(log.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ContentModerationAdmin;
