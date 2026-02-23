import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { logAdminActivity } from '../../utils/adminActivityLogger';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Skeleton } from '../ui/skeleton';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Textarea } from '../ui/textarea';
import { toast } from 'sonner';
import {
  AlertTriangle, AlertCircle, Info, Bug, Search, Filter,
  CheckCircle, Clock, Eye, EyeOff, RefreshCw, Trash2,
  ChevronLeft, ChevronRight, BarChart3, XCircle
} from 'lucide-react';

interface SystemErrorLog {
  id: string;
  severity: 'critical' | 'error' | 'warning' | 'info';
  source: string;
  component: string | null;
  error_code: string | null;
  message: string;
  details: Record<string, any>;
  user_id: string | null;
  request_id: string | null;
  status: 'open' | 'acknowledged' | 'resolved' | 'ignored';
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  created_at: string;
  updated_at: string;
}

interface ErrorSummary {
  source: string;
  severity: string;
  status: string;
  count: number;
  latest_at: string;
}

const SEVERITY_CONFIG = {
  critical: { icon: XCircle, color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', dot: 'bg-red-500' },
  error: { icon: AlertCircle, color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400', dot: 'bg-orange-500' },
  warning: { icon: AlertTriangle, color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', dot: 'bg-yellow-500' },
  info: { icon: Info, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', dot: 'bg-blue-500' },
};

const STATUS_CONFIG = {
  open: { color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', label: 'Open' },
  acknowledged: { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', label: 'Acknowledged' },
  resolved: { color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', label: 'Resolved' },
  ignored: { color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400', label: 'Ignored' },
};

const PAGE_SIZE = 25;

const SystemErrorLogs: React.FC = () => {
  const [logs, setLogs] = useState<SystemErrorLog[]>([]);
  const [summary, setSummary] = useState<ErrorSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedLog, setSelectedLog] = useState<SystemErrorLog | null>(null);
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [resolveNotes, setResolveNotes] = useState('');
  const [resolveAction, setResolveAction] = useState<'resolved' | 'ignored'>('resolved');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('open');
  const [filterSource, setFilterSource] = useState<string>('all');

  // Available sources for filter dropdown
  const [availableSources, setAvailableSources] = useState<string[]>([]);

  useEffect(() => {
    fetchLogs();
    fetchSummary();
    fetchSources();
  }, [page, filterSeverity, filterStatus, filterSource]);

  const fetchSources = async () => {
    try {
      const { data } = await (supabase as any)
        .from('system_error_logs')
        .select('source')
        .order('source');
      if (data) {
        const unique = [...new Set(data.map((d: any) => d.source))] as string[];
        setAvailableSources(unique);
      }
    } catch { /* non-critical */ }
  };

  const fetchSummary = async () => {
    try {
      const { data } = await (supabase as any)
        .from('system_error_summary')
        .select('*');
      if (data) setSummary(data);
    } catch { /* non-critical */ }
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let query = (supabase as any)
        .from('system_error_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

      if (filterSeverity !== 'all') query = query.eq('severity', filterSeverity);
      if (filterStatus !== 'all') query = query.eq('status', filterStatus);
      if (filterSource !== 'all') query = query.eq('source', filterSource);

      const { data, count, error } = await query;
      if (error) throw error;
      setLogs(data || []);
      setTotalCount(count || 0);
    } catch (err: any) {
      toast.error('Failed to load error logs');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Search filter (client-side on loaded page)
  const filteredLogs = useMemo(() => {
    if (!searchTerm) return logs;
    const term = searchTerm.toLowerCase();
    return logs.filter(l =>
      l.message.toLowerCase().includes(term) ||
      l.source.toLowerCase().includes(term) ||
      l.component?.toLowerCase().includes(term) ||
      l.error_code?.toLowerCase().includes(term) ||
      l.user_id?.toLowerCase().includes(term)
    );
  }, [logs, searchTerm]);

  const updateStatus = async (logId: string, status: string, notes?: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const updates: any = { status };
      if (status === 'resolved' || status === 'ignored') {
        updates.resolved_by = user?.id;
        updates.resolved_at = new Date().toISOString();
        updates.resolution_notes = notes || null;
      }
      const { error } = await (supabase as any)
        .from('system_error_logs')
        .update(updates)
        .eq('id', logId);
      if (error) throw error;
      toast.success(`Error ${status === 'acknowledged' ? 'acknowledged' : status}`);
      logAdminActivity({ action: `error_log_${status}`, target_type: 'system_error_logs', target_id: logId, details: { status, notes } });
      fetchLogs();
      fetchSummary();
    } catch (err: any) {
      toast.error(`Failed to update: ${err.message}`);
    }
  };

  const bulkUpdateStatus = async (status: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      let query = (supabase as any)
        .from('system_error_logs')
        .update({
          status,
          resolved_by: status === 'resolved' || status === 'ignored' ? user?.id : null,
          resolved_at: status === 'resolved' || status === 'ignored' ? new Date().toISOString() : null,
        })
        .eq('status', 'open');

      if (filterSeverity !== 'all') query = query.eq('severity', filterSeverity);
      if (filterSource !== 'all') query = query.eq('source', filterSource);

      const { error } = await query;
      if (error) throw error;
      toast.success(`All matching errors marked as ${status}`);
      logAdminActivity({ action: 'bulk_error_log_update', target_type: 'system_error_logs', details: { status, filter_severity: filterSeverity, filter_source: filterSource } });
      fetchLogs();
      fetchSummary();
    } catch (err: any) {
      toast.error(`Bulk update failed: ${err.message}`);
    }
  };

  const handleResolve = async () => {
    if (!selectedLog) return;
    await updateStatus(selectedLog.id, resolveAction, resolveNotes);
    setResolveDialogOpen(false);
    setSelectedLog(null);
    setResolveNotes('');
  };

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  };

  // Summary stats
  const openCritical = summary.filter(s => s.severity === 'critical' && s.status === 'open').reduce((a, b) => a + b.count, 0);
  const openErrors = summary.filter(s => s.severity === 'error' && s.status === 'open').reduce((a, b) => a + b.count, 0);
  const openWarnings = summary.filter(s => s.severity === 'warning' && s.status === 'open').reduce((a, b) => a + b.count, 0);
  const totalOpen = summary.filter(s => s.status === 'open').reduce((a, b) => a + b.count, 0);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Bug className="h-6 w-6 text-red-500" />
            System Error Logs
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Monitor and resolve system errors across all services
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { fetchLogs(); fetchSummary(); }}>
          <RefreshCw className="h-4 w-4 mr-1" /> Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className={openCritical > 0 ? 'border-red-500 dark:border-red-500' : ''}>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Critical</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{openCritical}</p>
              </div>
              <XCircle className={`h-8 w-8 ${openCritical > 0 ? 'text-red-500 animate-pulse' : 'text-gray-300 dark:text-gray-600'}`} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Errors</p>
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{openErrors}</p>
              </div>
              <AlertCircle className={`h-8 w-8 ${openErrors > 0 ? 'text-orange-500' : 'text-gray-300 dark:text-gray-600'}`} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Warnings</p>
                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{openWarnings}</p>
              </div>
              <AlertTriangle className={`h-8 w-8 ${openWarnings > 0 ? 'text-yellow-500' : 'text-gray-300 dark:text-gray-600'}`} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total Open</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalOpen}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search errors..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterSeverity} onValueChange={v => { setFilterSeverity(v); setPage(1); }}>
              <SelectTrigger className="w-[140px]">
                <Filter className="h-4 w-4 mr-1" />
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severity</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="info">Info</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={v => { setFilterStatus(v); setPage(1); }}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="acknowledged">Acknowledged</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="ignored">Ignored</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterSource} onValueChange={v => { setFilterSource(v); setPage(1); }}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                {availableSources.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {filterStatus === 'open' && totalOpen > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => bulkUpdateStatus('acknowledged')}
                className="text-yellow-600 border-yellow-300 hover:bg-yellow-50 dark:text-yellow-400 dark:border-yellow-700 dark:hover:bg-yellow-900/20"
              >
                <Eye className="h-4 w-4 mr-1" />
                Acknowledge All
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Error Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-12 text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
              <p className="text-lg font-medium text-gray-900 dark:text-white">All Clear!</p>
              <p className="text-gray-500 dark:text-gray-400">
                {filterStatus === 'open' ? 'No open errors to show.' : 'No errors match your filters.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Severity</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className="min-w-[300px]">Message</TableHead>
                    <TableHead className="w-[100px]">Time</TableHead>
                    <TableHead className="w-[150px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map(log => {
                    const sevConfig = SEVERITY_CONFIG[log.severity];
                    const statusConfig = STATUS_CONFIG[log.status];
                    const SevIcon = sevConfig.icon;
                    return (
                      <TableRow key={log.id} className={log.severity === 'critical' && log.status === 'open' ? 'bg-red-50/50 dark:bg-red-950/20' : ''}>
                        <TableCell>
                          <Badge className={`${sevConfig.color} gap-1`}>
                            <SevIcon className="h-3 w-3" />
                            {log.severity}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <span className="font-medium text-sm">{log.source}</span>
                            {log.component && (
                              <span className="text-xs text-gray-500 dark:text-gray-400 block">{log.component}</span>
                            )}
                            {log.error_code && (
                              <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">{log.error_code}</code>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm text-gray-800 dark:text-gray-200 line-clamp-2">{log.message}</p>
                          {log.user_id && (
                            <span className="text-xs text-gray-400">User: {log.user_id.slice(0, 8)}...</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-gray-500 dark:text-gray-400" title={new Date(log.created_at).toLocaleString()}>
                            {formatTime(log.created_at)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedLog(log)}
                              title="View details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {log.status === 'open' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => updateStatus(log.id, 'acknowledged')}
                                title="Acknowledge"
                                className="text-yellow-600 hover:text-yellow-700"
                              >
                                <Clock className="h-4 w-4" />
                              </Button>
                            )}
                            {(log.status === 'open' || log.status === 'acknowledged') && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedLog(log);
                                  setResolveDialogOpen(true);
                                }}
                                title="Resolve"
                                className="text-green-600 hover:text-green-700"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t dark:border-gray-800">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Page {page} of {totalPages} ({totalCount} total)
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedLog && !resolveDialogOpen} onOpenChange={open => { if (!open) setSelectedLog(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedLog && (() => {
                const SevIcon = SEVERITY_CONFIG[selectedLog.severity].icon;
                return <SevIcon className="h-5 w-5" />;
              })()}
              Error Details
            </DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Severity</label>
                  <Badge className={SEVERITY_CONFIG[selectedLog.severity].color}>{selectedLog.severity}</Badge>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</label>
                  <Badge className={STATUS_CONFIG[selectedLog.status].color}>{STATUS_CONFIG[selectedLog.status].label}</Badge>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Source</label>
                  <p className="font-medium">{selectedLog.source}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Component</label>
                  <p>{selectedLog.component || '—'}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Error Code</label>
                  <code className="text-sm bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">{selectedLog.error_code || '—'}</code>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Time</label>
                  <p className="text-sm">{new Date(selectedLog.created_at).toLocaleString()}</p>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Message</label>
                <p className="mt-1 text-sm bg-gray-50 dark:bg-gray-900 p-3 rounded-lg border dark:border-gray-800">
                  {selectedLog.message}
                </p>
              </div>

              {selectedLog.user_id && (
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">User ID</label>
                  <code className="text-sm block mt-1">{selectedLog.user_id}</code>
                </div>
              )}

              {selectedLog.details && Object.keys(selectedLog.details).length > 0 && (
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Details</label>
                  <pre className="mt-1 text-xs bg-gray-50 dark:bg-gray-900 p-3 rounded-lg border dark:border-gray-800 overflow-x-auto max-h-60 whitespace-pre-wrap">
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.resolution_notes && (
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Resolution Notes</label>
                  <p className="mt-1 text-sm bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-200 dark:border-green-800">
                    {selectedLog.resolution_notes}
                  </p>
                </div>
              )}

              {/* Action buttons */}
              {(selectedLog.status === 'open' || selectedLog.status === 'acknowledged') && (
                <div className="flex gap-2 pt-2 border-t dark:border-gray-800">
                  {selectedLog.status === 'open' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { updateStatus(selectedLog.id, 'acknowledged'); setSelectedLog(null); }}
                    >
                      <Clock className="h-4 w-4 mr-1" /> Acknowledge
                    </Button>
                  )}
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => setResolveDialogOpen(true)}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" /> Resolve
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { updateStatus(selectedLog.id, 'ignored'); setSelectedLog(null); }}
                    className="text-gray-500"
                  >
                    <EyeOff className="h-4 w-4 mr-1" /> Ignore
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Resolve Dialog */}
      <Dialog open={resolveDialogOpen} onOpenChange={open => { if (!open) { setResolveDialogOpen(false); setResolveNotes(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Error</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Action</label>
              <Select value={resolveAction} onValueChange={v => setResolveAction(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="resolved">Mark as Resolved</SelectItem>
                  <SelectItem value="ignored">Mark as Ignored</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Resolution Notes</label>
              <Textarea
                value={resolveNotes}
                onChange={e => setResolveNotes(e.target.value)}
                placeholder="What was done to fix this? (optional)"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setResolveDialogOpen(false); setResolveNotes(''); }}>
              Cancel
            </Button>
            <Button onClick={handleResolve} className="bg-green-600 hover:bg-green-700 text-white">
              {resolveAction === 'resolved' ? 'Resolve' : 'Ignore'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SystemErrorLogs;
