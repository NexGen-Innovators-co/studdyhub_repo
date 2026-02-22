import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Shield, AlertTriangle, CheckCircle, XCircle, Eye, Ban, Trash2, User, MessageSquare, FileText } from 'lucide-react';
import { Database } from '@/integrations/supabase/types';

type SocialReport = Database['public']['Tables']['social_reports']['Row'];
type ReportWithDetails = SocialReport & {
  reporter: { id: string; display_name: string; avatar_url?: string } | null;
  reported_user: { id: string; display_name: string; avatar_url?: string } | null;
  post: { id: string; content: string; created_at: string } | null;
  comment: { id: string; content: string; created_at: string } | null;
  moderator: { id: string; display_name: string } | null;
};

export const ReportsManagement: React.FC = () => {
  const { toast } = useToast();
  const [reports, setReports] = useState<ReportWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [selectedReport, setSelectedReport] = useState<ReportWithDetails | null>(null);
  const [actionDialog, setActionDialog] = useState<'resolve' | 'dismiss' | 'ban' | null>(null);
  const [actionNote, setActionNote] = useState('');
  const [banDuration, setBanDuration] = useState<string>('7');

  useEffect(() => {
    fetchReports();
  }, [statusFilter]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('social_reports')
        .select(`
          *,
          reporter:social_users!social_reports_reporter_id_fkey(id, display_name, avatar_url),
          reported_user:social_users!social_reports_reported_user_id_fkey(id, display_name, avatar_url),
          post:social_posts!social_reports_post_id_fkey(id, content, created_at),
          comment:social_comments!social_reports_comment_id_fkey(id, content, created_at),
          moderator:social_users!social_reports_moderator_id_fkey(id, display_name)
        `)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setReports(data as ReportWithDetails[]);
    } catch (error: any) {

      toast({
        title: 'Error',
        description: 'Failed to load reports',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResolveReport = async () => {
    if (!selectedReport) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Update report status
      const { error: reportError } = await supabase
        .from('social_reports')
        .update({
          status: 'resolved',
          moderator_id: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedReport.id);

      if (reportError) throw reportError;

      // Optional: Remove the reported content
      if (selectedReport.post_id && actionNote.toLowerCase().includes('remove')) {
        await supabase
          .from('social_posts')
          .delete()
          .eq('id', selectedReport.post_id);
      }

      if (selectedReport.comment_id && actionNote.toLowerCase().includes('remove')) {
        await supabase
          .from('social_comments')
          .delete()
          .eq('id', selectedReport.comment_id);
      }

      toast({
        title: 'Report Resolved',
        description: 'The report has been marked as resolved.',
      });

      setActionDialog(null);
      setSelectedReport(null);
      setActionNote('');
      fetchReports();
    } catch (error: any) {

      toast({
        title: 'Error',
        description: 'Failed to resolve report',
        variant: 'destructive',
      });
    }
  };

  const handleDismissReport = async () => {
    if (!selectedReport) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('social_reports')
        .update({
          status: 'dismissed',
          moderator_id: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedReport.id);

      if (error) throw error;

      toast({
        title: 'Report Dismissed',
        description: 'The report has been dismissed.',
      });

      setActionDialog(null);
      setSelectedReport(null);
      setActionNote('');
      fetchReports();
    } catch (error: any) {

      toast({
        title: 'Error',
        description: 'Failed to dismiss report',
        variant: 'destructive',
      });
    }
  };

  const handleBanUser = async () => {
    if (!selectedReport?.reported_user_id) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Calculate ban end date
      const banEndDate = new Date();
      banEndDate.setDate(banEndDate.getDate() + parseInt(banDuration));
      const isPermanent = parseInt(banDuration) >= 99999;

      // Suspend the user (using is_verified as active flag)
      const { error: userError } = await supabase
        .from('social_users')
        .update({
          is_verified: false,
        })
        .eq('id', selectedReport.reported_user_id);

      if (userError) throw userError;

      // Mark report as resolved
      const { error: reportError } = await supabase
        .from('social_reports')
        .update({
          status: 'resolved',
          moderator_id: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedReport.id);

      if (reportError) throw reportError;

      // Log ban details with duration in activity logs for audit trail
      await supabase.from('admin_activity_logs').insert({
        admin_id: user.id,
        action: 'ban_user',
        target_type: 'user',
        target_id: selectedReport.reported_user_id,
        details: {
          report_id: selectedReport.id,
          ban_duration_days: parseInt(banDuration),
          ban_until: isPermanent ? 'permanent' : banEndDate.toISOString(),
          reason: actionNote || 'No reason provided',
          reported_user_name: selectedReport.reported_user?.display_name || 'Unknown',
        },
      });

      toast({
        title: 'User Banned',
        description: `User has been banned for ${banDuration} days.`,
      });

      setActionDialog(null);
      setSelectedReport(null);
      setActionNote('');
      setBanDuration('7');
      fetchReports();
    } catch (error: any) {

      toast({
        title: 'Error',
        description: 'Failed to ban user',
        variant: 'destructive',
      });
    }
  };

  const getReportTypeIcon = (report: ReportWithDetails) => {
    if (report.post_id) return <FileText className="h-4 w-4" />;
    if (report.comment_id) return <MessageSquare className="h-4 w-4" />;
    return <User className="h-4 w-4" />;
  };

  const getReportTypeName = (report: ReportWithDetails) => {
    if (report.post_id) return 'Post';
    if (report.comment_id) return 'Comment';
    return 'User';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300"><AlertTriangle className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'resolved':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300"><CheckCircle className="h-3 w-3 mr-1" />Resolved</Badge>;
      case 'dismissed':
        return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-300"><XCircle className="h-3 w-3 mr-1" />Dismissed</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getReasonLabel = (reason: string) => {
    return reason.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-8 w-8 text-blue-600" />
            Reports Management
          </h2>
          <p className="text-muted-foreground mt-1">
            Review and manage user reports from the social feed
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Reports</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {reports.filter(r => r.status === 'pending').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolved</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {reports.filter(r => r.status === 'resolved').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dismissed</CardTitle>
            <XCircle className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {reports.filter(r => r.status === 'dismissed').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Filter Reports</CardTitle>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Reports</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="dismissed">Dismissed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading reports...</div>
          ) : reports.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No reports found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Reporter</TableHead>
                  <TableHead>Reported User</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getReportTypeIcon(report)}
                        <span className="font-medium">{getReportTypeName(report)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {report.reporter?.avatar_url && (
                          <img src={report.reporter.avatar_url} alt="" className="h-6 w-6 rounded-full" />
                        )}
                        <span>{report.reporter?.display_name || 'Unknown'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {report.reported_user?.avatar_url && (
                          <img src={report.reported_user.avatar_url} alt="" className="h-6 w-6 rounded-full" />
                        )}
                        <span>{report.reported_user?.display_name || 'Unknown'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{getReasonLabel(report.reason)}</Badge>
                    </TableCell>
                    <TableCell>{getStatusBadge(report.status)}</TableCell>
                    <TableCell>
                      {new Date(report.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedReport(report)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {report.status === 'pending' && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedReport(report);
                                setActionDialog('resolve');
                              }}
                            >
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedReport(report);
                                setActionDialog('dismiss');
                              }}
                            >
                              <XCircle className="h-4 w-4 text-gray-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedReport(report);
                                setActionDialog('ban');
                              }}
                            >
                              <Ban className="h-4 w-4 text-red-600" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* View Report Dialog */}
      <Dialog open={!!selectedReport && !actionDialog} onOpenChange={() => setSelectedReport(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Report Details</DialogTitle>
            <DialogDescription>
              Review the full details of this report
            </DialogDescription>
          </DialogHeader>
          {selectedReport && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Report Type</p>
                  <p className="text-sm">{getReportTypeName(selectedReport)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Status</p>
                  <div className="mt-1">{getStatusBadge(selectedReport.status)}</div>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Reporter</p>
                  <p className="text-sm">{selectedReport.reporter?.display_name || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Reported User</p>
                  <p className="text-sm">{selectedReport.reported_user?.display_name || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Reason</p>
                  <p className="text-sm">{getReasonLabel(selectedReport.reason)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Date</p>
                  <p className="text-sm">{new Date(selectedReport.created_at).toLocaleString()}</p>
                </div>
              </div>
              {selectedReport.description && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Description</p>
                  <p className="text-sm bg-muted p-3 rounded-md">{selectedReport.description}</p>
                </div>
              )}
              {selectedReport.post && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Reported Post</p>
                  <p className="text-sm bg-muted p-3 rounded-md">{selectedReport.post.content}</p>
                </div>
              )}
              {selectedReport.comment && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Reported Comment</p>
                  <p className="text-sm bg-muted p-3 rounded-md">{selectedReport.comment.content}</p>
                </div>
              )}
              {selectedReport.moderator && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Handled By</p>
                  <p className="text-sm">{selectedReport.moderator.display_name}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Resolve Report Dialog */}
      <Dialog open={actionDialog === 'resolve'} onOpenChange={() => setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Report</DialogTitle>
            <DialogDescription>
              Mark this report as resolved. Add a note if you want to remove the content.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Add a note (include 'remove' to delete the content)..."
            value={actionNote}
            onChange={(e) => setActionNote(e.target.value)}
            className="min-h-[100px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>Cancel</Button>
            <Button onClick={handleResolveReport}>Resolve Report</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dismiss Report Dialog */}
      <Dialog open={actionDialog === 'dismiss'} onOpenChange={() => setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dismiss Report</DialogTitle>
            <DialogDescription>
              Dismiss this report as invalid or not requiring action.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Add a note (optional)..."
            value={actionNote}
            onChange={(e) => setActionNote(e.target.value)}
            className="min-h-[100px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>Cancel</Button>
            <Button onClick={handleDismissReport}>Dismiss Report</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ban User Dialog */}
      <Dialog open={actionDialog === 'ban'} onOpenChange={() => setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ban User</DialogTitle>
            <DialogDescription>
              Suspend this user's account for the specified duration.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Ban Duration</label>
              <Select value={banDuration} onValueChange={setBanDuration}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 Day</SelectItem>
                  <SelectItem value="3">3 Days</SelectItem>
                  <SelectItem value="7">7 Days</SelectItem>
                  <SelectItem value="14">14 Days</SelectItem>
                  <SelectItem value="30">30 Days</SelectItem>
                  <SelectItem value="365">1 Year</SelectItem>
                  <SelectItem value="99999">Permanent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Textarea
              placeholder="Reason for ban..."
              value={actionNote}
              onChange={(e) => setActionNote(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleBanUser}>Ban User</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReportsManagement;
