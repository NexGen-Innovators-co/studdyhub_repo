import React, { useEffect, useState } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { Skeleton } from '../ui/skeleton';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Textarea } from '../ui/textarea';
import { ModerationItem } from '../../integrations/supabase/admin';
import { AlertTriangle, CheckCircle, XCircle, Clock, Flag, TrendingUp, Eye } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

type Filter = 'pending' | 'all';

const ContentModeration = () => {
  const [items, setItems] = useState<ModerationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<Filter>('pending');
  const [selected, setSelected] = useState<ModerationItem | null>(null);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetchItems();
  }, [filterStatus]);

  const fetchItems = async () => {
    try {
      setLoading(true);
      let q = supabase.from('content_moderation_queue').select('*').order('created_at', { ascending: false });
      if (filterStatus === 'pending') q = q.eq('status', 'pending');
      const { data, error } = await q;
      if (error) throw error;

      const typed = (data ?? []).map(
        (row): ModerationItem => ({
          ...row,
          status: row.status as ModerationItem['status'],
        })
      );

      setItems(typed);
    } catch (err) {
      toast.error(`Error: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id: string, action: 'approve' | 'remove' | 'dismiss') => {
    try {
      const newStatus = action === 'approve' ? 'resolved' : action === 'remove' ? 'resolved' : 'dismissed';
      const { error } = await supabase
        .from('content_moderation_queue')
        .update({ status: newStatus, moderator_notes: notes, resolved_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;

      toast.success(`Item ${action}d`);
      fetchItems();
      setSelected(null);
      setNotes('');
    } catch (err) {
      toast.error(`Error: ${err}`);
    }
  };

  // Stats
  const pendingCount = items.filter(i => i.status === 'pending').length;
  const resolvedCount = items.filter(i => i.status === 'resolved').length;
  const dismissedCount = items.filter(i => i.status === 'dismissed').length;
  const highPriorityCount = items.filter(i => i.priority && i.priority > 5 && i.status === 'pending').length;

  // Chart data
  const statusData = [
    { name: 'Pending', value: pendingCount, color: '#f59e0b' },
    { name: 'Resolved', value: resolvedCount, color: '#10b981' },
    { name: 'Dismissed', value: dismissedCount, color: '#6b7280' },
  ];

  const contentTypeData = items.reduce((acc, item) => {
    const existing = acc.find(a => a.name === item.content_type);
    if (existing) {
      existing.value++;
    } else {
      acc.push({ name: item.content_type, value: 1 });
    }
    return acc;
  }, [] as Array<{ name: string; value: number }>);

  const COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b'];

  const getPriorityColor = (priority: number | null) => {
    if (!priority) return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300';
    if (priority > 7) return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800';
    if (priority > 4) return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800';
    return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800';
      case 'resolved':
        return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800';
      case 'dismissed':
        return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700';
      default:
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800';
    }
  };

  if (loading) return <Skeleton className="h-[500px] w-full bg-gray-200 dark:bg-gray-800" />;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Content Moderation</h2>
        <p className="text-gray-600 dark:text-gray-400">Review and manage reported content</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Pending Reports</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{pendingCount}</p>
              </div>
              <div className="p-3 bg-yellow-500/10 dark:bg-yellow-500/20 rounded-lg">
                <Clock className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">High Priority</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{highPriorityCount}</p>
              </div>
              <div className="p-3 bg-red-500/10 dark:bg-red-500/20 rounded-lg">
                <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Resolved</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{resolvedCount}</p>
              </div>
              <div className="p-3 bg-green-500/10 dark:bg-green-500/20 rounded-lg">
                <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Dismissed</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{dismissedCount}</p>
              </div>
              <div className="p-3 bg-gray-500/10 dark:bg-gray-500/20 rounded-lg">
                <XCircle className="h-8 w-8 text-gray-600 dark:text-gray-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-white">Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgb(31 41 55)', 
                    border: '1px solid rgb(55 65 81)',
                    borderRadius: '0.5rem',
                    color: 'white'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-white">Content Types</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={contentTypeData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-800" />
                <XAxis dataKey="name" className="text-xs text-gray-600 dark:text-gray-400" />
                <YAxis className="text-xs text-gray-600 dark:text-gray-400" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgb(31 41 55)', 
                    border: '1px solid rgb(55 65 81)',
                    borderRadius: '0.5rem',
                    color: 'white'
                  }}
                />
                <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Moderation Queue */}
      <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-gray-900 dark:text-white">
            <span>Moderation Queue</span>
            <Select value={filterStatus} onValueChange={(v: Filter) => setFilterStatus(v)}>
              <SelectTrigger className="w-[180px] bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <SelectItem value="pending" className="text-gray-900 dark:text-white">Pending Only</SelectItem>
                <SelectItem value="all" className="text-gray-900 dark:text-white">All Items</SelectItem>
              </SelectContent>
            </Select>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800">
                  <TableHead className="text-gray-700 dark:text-gray-300">Type</TableHead>
                  <TableHead className="text-gray-700 dark:text-gray-300">Reason</TableHead>
                  <TableHead className="text-gray-700 dark:text-gray-300">Priority</TableHead>
                  <TableHead className="text-gray-700 dark:text-gray-300">Status</TableHead>
                  <TableHead className="text-gray-700 dark:text-gray-300">Reported At</TableHead>
                  <TableHead className="text-gray-700 dark:text-gray-300">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map(item => (
                  <TableRow 
                    key={item.id}
                    className="border-b border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <TableCell>
                      <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                        {item.content_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <div className="flex items-start gap-2">
                        <Flag className="h-4 w-4 text-gray-500 dark:text-gray-400 mt-0.5 flex-shrink-0" />
                        <span className="text-gray-700 dark:text-gray-300 truncate">{item.reason}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getPriorityColor(item.priority)}>
                        Priority {item.priority || 'N/A'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(item.status)}>
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-gray-700 dark:text-gray-300">
                        {new Date(item.created_at).toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setSelected(item)}
                        className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Review
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Review Dialog */}
      {selected && (
        <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
          <DialogContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-gray-900 dark:text-white">
                Review {selected.content_type}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Content Type:</span>
                  <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">
                    {selected.content_type}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Priority:</span>
                  <Badge className={getPriorityColor(selected.priority)}>
                    {selected.priority || 'N/A'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Status:</span>
                  <Badge className={getStatusColor(selected.status)}>
                    {selected.status}
                  </Badge>
                </div>
              </div>
              
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Report Reason:</p>
                <p className="text-gray-900 dark:text-white p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  {selected.reason}
                </p>
              </div>
              
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Moderator Notes:</p>
                <Textarea 
                  placeholder="Add your review notes here..." 
                  value={notes} 
                  onChange={e => setNotes(e.target.value)}
                  className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white min-h-[100px]"
                />
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button 
                  onClick={() => handleAction(selected.id, 'approve')}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve
                </Button>
                <Button 
                  variant="destructive"
                  onClick={() => handleAction(selected.id, 'remove')}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Remove
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => handleAction(selected.id, 'dismiss')}
                  className="flex-1 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300"
                >
                  Dismiss
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default ContentModeration;