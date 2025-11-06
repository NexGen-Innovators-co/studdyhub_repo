import React, { useEffect, useState } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Skeleton } from '../ui/skeleton';
import { toast } from 'sonner';
import { AdminActivityLog } from '../../integrations/supabase/admin';
import { Badge } from '../ui/badge';
import { FileText, Filter, Search, Calendar, User, Activity, Download, BarChart3 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

const ActivityLogs = () => {
  const [logs, setLogs] = useState<AdminActivityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState<'all' | string>('all');
  const [selectedLog, setSelectedLog] = useState<AdminActivityLog | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 50;

  useEffect(() => {
    fetchLogs();
  }, [page]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('admin_activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (error) throw error;
      const formattedData = (data || []).map(log => ({
        ...log,
        details: typeof log.details === 'object' && log.details !== null ? log.details : {}
      }));
      setLogs(formattedData as AdminActivityLog[]);
    } catch (err) {
      toast.error(`Error fetching logs: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.target_type?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAction = filterAction === 'all' || log.action === filterAction;
    return matchesSearch && matchesAction;
  });

  const uniqueActions = [...new Set(logs.map(log => log.action))];

  // Stats
  const totalActions = logs.length;
  const uniqueAdmins = [...new Set(logs.map(log => log.admin_id).filter(Boolean))].length;
  const todayActions = logs.filter(log => 
    new Date(log.created_at).toDateString() === new Date().toDateString()
  ).length;

  // Chart data - Actions by day (last 7 days)
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    return date.toISOString().split('T')[0];
  });

  const activityByDay = last7Days.map(date => ({
    date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    actions: logs.filter(log => log.created_at.startsWith(date)).length
  }));

  // Action distribution
  const actionDistribution = uniqueActions.slice(0, 5).map(action => ({
    action,
    count: logs.filter(log => log.action === action).length
  }));

  const getActionColor = (action: string) => {
    const colors: Record<string, string> = {
      create: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800',
      update: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
      delete: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
      view: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700',
    };
    
    for (const [key, value] of Object.entries(colors)) {
      if (action.toLowerCase().includes(key)) return value;
    }
    return 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800';
  };

  const exportLogs = () => {
    const csv = [
      ['Timestamp', 'Admin', 'Action', 'Target Type', 'Target ID', 'IP Address'],
      ...filteredLogs.map(log => [
        new Date(log.created_at).toLocaleString(),
        log.admin_id || 'N/A',
        log.action,
        log.target_type || 'N/A',
        log.target_id || 'N/A',
        log.ip_address || 'N/A'
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-logs-${new Date().toISOString()}.csv`;
    a.click();
    toast.success('Logs exported successfully');
  };

  if (loading && logs.length === 0) {
    return <Skeleton className="h-[500px] w-full bg-gray-200 dark:bg-gray-800" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Activity Logs</h2>
          <p className="text-gray-600 dark:text-gray-400">Monitor admin actions and system events</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={exportLogs}
            variant="outline"
            className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button 
            onClick={fetchLogs}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Actions</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{totalActions}</p>
              </div>
              <div className="p-3 bg-blue-500/10 dark:bg-blue-500/20 rounded-lg">
                <Activity className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Active Admins</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{uniqueAdmins}</p>
              </div>
              <div className="p-3 bg-green-500/10 dark:bg-green-500/20 rounded-lg">
                <User className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Today's Actions</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{todayActions}</p>
              </div>
              <div className="p-3 bg-purple-500/10 dark:bg-purple-500/20 rounded-lg">
                <Calendar className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-white">Activity Trend (7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={activityByDay}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-800" />
                <XAxis 
                  dataKey="date" 
                  className="text-xs text-gray-600 dark:text-gray-400"
                />
                <YAxis className="text-xs text-gray-600 dark:text-gray-400" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgb(31 41 55)', 
                    border: '1px solid rgb(55 65 81)',
                    borderRadius: '0.5rem',
                    color: 'white'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="actions" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  dot={{ fill: '#3b82f6', r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-white">Top Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={actionDistribution}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-800" />
                <XAxis 
                  dataKey="action" 
                  className="text-xs text-gray-600 dark:text-gray-400"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis className="text-xs text-gray-600 dark:text-gray-400" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgb(31 41 55)', 
                    border: '1px solid rgb(55 65 81)',
                    borderRadius: '0.5rem',
                    color: 'white'
                  }}
                />
                <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-gray-900 dark:text-white">
            <span>Activity Logs</span>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 dark:text-gray-400" />
                <Input
                  placeholder="Search by action or target..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-10 w-64 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <Select value={filterAction} onValueChange={setFilterAction}>
                <SelectTrigger className="w-[180px] bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter action" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                  <SelectItem value="all" className="text-gray-900 dark:text-white">All Actions</SelectItem>
                  {uniqueActions.map(action => (
                    <SelectItem key={action} value={action} className="text-gray-900 dark:text-white">
                      {action}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800">
                  <TableHead className="text-gray-700 dark:text-gray-300">Timestamp</TableHead>
                  <TableHead className="text-gray-700 dark:text-gray-300">Admin</TableHead>
                  <TableHead className="text-gray-700 dark:text-gray-300">Action</TableHead>
                  <TableHead className="text-gray-700 dark:text-gray-300">Target</TableHead>
                  <TableHead className="text-gray-700 dark:text-gray-300">IP Address</TableHead>
                  <TableHead className="text-gray-700 dark:text-gray-300">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map(log => (
                  <TableRow 
                    key={log.id}
                    className="border-b border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                        <span className="text-gray-700 dark:text-gray-300">
                          {new Date(log.created_at).toLocaleString()}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                        <span className="text-gray-700 dark:text-gray-300 font-mono text-sm">
                          {log.admin_id ? log.admin_id.slice(0, 8) + '...' : 'N/A'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getActionColor(log.action)}>
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-gray-700 dark:text-gray-300">
                        {log.target_type && (
                          <span className="font-medium">{log.target_type}</span>
                        )}
                        {log.target_id && (
                          <span className="text-xs text-gray-500 dark:text-gray-400 ml-2 font-mono">
                            {log.target_id.slice(0, 8)}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-gray-700 dark:text-gray-300 font-mono text-sm">
                        {log.ip_address || 'N/A'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setSelectedLog(log)}
                        className="text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                      >
                        <FileText className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, totalActions)} of {totalActions} logs
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => p + 1)}
                disabled={filteredLogs.length < pageSize}
                className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300"
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Details Dialog */}
      {selectedLog && (
        <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
          <DialogContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-gray-900 dark:text-white">Activity Details</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Action</p>
                  <Badge className={`mt-1 ${getActionColor(selectedLog.action)}`}>
                    {selectedLog.action}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Timestamp</p>
                  <p className="text-gray-900 dark:text-white mt-1">
                    {new Date(selectedLog.created_at).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Admin ID</p>
                  <p className="text-gray-900 dark:text-white font-mono text-sm mt-1">
                    {selectedLog.admin_id || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">IP Address</p>
                  <p className="text-gray-900 dark:text-white font-mono text-sm mt-1">
                    {selectedLog.ip_address || 'N/A'}
                  </p>
                </div>
              </div>

              {selectedLog.target_type && (
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Target</p>
                  <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <p className="text-gray-900 dark:text-white">
                      <span className="font-medium">{selectedLog.target_type}</span>
                      {selectedLog.target_id && (
                        <span className="text-gray-500 dark:text-gray-400 ml-2 font-mono text-sm">
                          {selectedLog.target_id}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              )}

              {selectedLog.user_agent && (
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">User Agent</p>
                  <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <p className="text-gray-900 dark:text-white text-sm font-mono">
                      {selectedLog.user_agent}
                    </p>
                  </div>
                </div>
              )}

              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Details</p>
                <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg overflow-auto max-h-60">
                  <pre className="text-xs text-gray-900 dark:text-white font-mono">
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default ActivityLogs;