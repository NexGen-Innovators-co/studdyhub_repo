// src/components/admin/RoleVerificationAdmin.tsx
// Admin panel for reviewing and approving/rejecting educator role verification requests.

import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { logAdminActivity } from '@/utils/adminActivityLogger';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Eye,
  FileText,
  ExternalLink,
  Loader2,
  ShieldCheck,
  Users,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';

interface VerificationRequest {
  id: string;
  user_id: string;
  requested_role: string;
  institution_id: string | null;
  status: 'pending' | 'approved' | 'rejected';
  documents: { name: string; path: string; uploaded_at: string; size?: number }[];
  qualifications: string | null;
  years_experience: string | null;
  specializations: string[] | null;
  additional_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined profile info
  profile?: {
    full_name: string | null;
    avatar_url: string | null;
    email?: string;
  };
}

type FilterStatus = 'all' | 'pending' | 'approved' | 'rejected';

const ROLE_LABELS: Record<string, string> = {
  school_admin: 'School Administrator',
  tutor_affiliated: 'Affiliated Tutor',
  tutor_independent: 'Independent Tutor',
};

const STATUS_CONFIG: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  pending: { color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: Clock, label: 'Pending' },
  approved: { color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle, label: 'Approved' },
  rejected: { color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: XCircle, label: 'Rejected' },
};

const RoleVerificationAdmin: React.FC = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>('pending');
  const [searchQuery, setSearchQuery] = useState('');

  // Review dialog state
  const [selectedRequest, setSelectedRequest] = useState<VerificationRequest | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  // Stats
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0, total: 0 });

  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('role_verification_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch profile info for each request
      const userIds = [...new Set((data || []).map((r: any) => r.user_id))];
      let profileMap: Record<string, any> = {};

      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', userIds);

        if (profiles) {
          profileMap = Object.fromEntries(profiles.map((p: any) => [p.id, p]));
        }

        // Also try to get emails from auth (admin might have access via RLS)
        const { data: socialUsers } = await supabase
          .from('social_users')
          .select('id, display_name')
          .in('id', userIds);

        if (socialUsers) {
          for (const su of socialUsers) {
            if (profileMap[su.id]) {
              profileMap[su.id].display_name = su.display_name;
            }
          }
        }
      }

      const enriched = (data || []).map((r: any) => ({
        ...r,
        documents: Array.isArray(r.documents) ? r.documents : JSON.parse(r.documents || '[]'),
        specializations: Array.isArray(r.specializations) ? r.specializations : null,
        profile: profileMap[r.user_id] || null,
      })) as VerificationRequest[];

      setRequests(enriched);
    } catch (err: any) {
      toast.error('Failed to load verification requests');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('role_verification_requests')
        .select('status');

      if (!error && data) {
        const s = { pending: 0, approved: 0, rejected: 0, total: data.length };
        for (const r of data) {
          if (r.status === 'pending') s.pending++;
          else if (r.status === 'approved') s.approved++;
          else if (r.status === 'rejected') s.rejected++;
        }
        setStats(s);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchRequests();
    fetchStats();
  }, [fetchRequests, fetchStats]);

  // ─── Approve handler ───
  const handleApprove = async () => {
    if (!selectedRequest || !user?.id) return;
    setIsApproving(true);

    try {
      const { error } = await supabase.rpc('approve_role_request', {
        _request_id: selectedRequest.id,
        _admin_id: user.id,
        _review_notes: reviewNotes || null,
      });

      if (error) throw error;

      toast.success(`Approved ${selectedRequest.profile?.full_name || 'user'} as ${ROLE_LABELS[selectedRequest.requested_role] || selectedRequest.requested_role}`);

      logAdminActivity({
        action: 'approve_role_verification',
        target_type: 'role_verification_request',
        target_id: selectedRequest.id,
        details: {
          user_id: selectedRequest.user_id,
          requested_role: selectedRequest.requested_role,
          review_notes: reviewNotes || null,
        },
      });

      setSelectedRequest(null);
      setReviewNotes('');
      fetchRequests();
      fetchStats();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to approve request');
    } finally {
      setIsApproving(false);
    }
  };

  // ─── Reject handler ───
  const handleReject = async () => {
    if (!selectedRequest || !user?.id) return;
    if (!reviewNotes.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }
    setIsRejecting(true);

    try {
      const { error } = await supabase.rpc('reject_role_request', {
        _request_id: selectedRequest.id,
        _admin_id: user.id,
        _review_notes: reviewNotes,
      });

      if (error) throw error;

      toast.success(`Rejected verification request from ${selectedRequest.profile?.full_name || 'user'}`);

      logAdminActivity({
        action: 'reject_role_verification',
        target_type: 'role_verification_request',
        target_id: selectedRequest.id,
        details: {
          user_id: selectedRequest.user_id,
          requested_role: selectedRequest.requested_role,
          review_notes: reviewNotes,
        },
      });

      setSelectedRequest(null);
      setReviewNotes('');
      fetchRequests();
      fetchStats();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to reject request');
    } finally {
      setIsRejecting(false);
    }
  };

  // ─── Open document in new tab ───
  const openDocument = async (doc: { path: string; name: string }) => {
    try {
      // Extract bucket and path from the stored path
      const parts = doc.path.split('/');
      const bucket = parts[0];
      const filePath = parts.slice(1).join('/');

      const { data } = await supabase.storage
        .from(bucket)
        .createSignedUrl(filePath, 3600); // 1-hour signed URL

      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      } else {
        toast.error('Could not generate document link');
      }
    } catch {
      toast.error('Failed to open document');
    }
  };

  // Filter by search
  const filtered = requests.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (r.profile?.full_name || '').toLowerCase().includes(q) ||
      r.requested_role.toLowerCase().includes(q) ||
      r.user_id.toLowerCase().includes(q) ||
      (r.qualifications || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Role Verification</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Review and approve educator role verification requests
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="rounded-xl">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.pending}</p>
              <p className="text-xs text-gray-500">Pending</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.approved}</p>
              <p className="text-xs text-gray-500">Approved</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
              <XCircle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.rejected}</p>
              <p className="text-xs text-gray-500">Rejected</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
              <p className="text-xs text-gray-500">Total</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by name, role, or qualifications..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as FilterStatus)}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Requests</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="rounded-xl">
          <CardContent className="p-8 text-center">
            <ShieldCheck className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">
              {filter === 'pending' ? 'No pending verification requests' : 'No requests found'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Requested Role</TableHead>
                <TableHead>Documents</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((req) => {
                const statusCfg = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;
                const StatusIcon = statusCfg.icon;

                return (
                  <TableRow key={req.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {req.profile?.avatar_url ? (
                          <img
                            src={req.profile.avatar_url}
                            alt=""
                            className="h-8 w-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-sm font-medium text-blue-600">
                            {(req.profile?.full_name || '?')[0]?.toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-sm text-gray-900 dark:text-white truncate">
                            {req.profile?.full_name || 'Unknown User'}
                          </p>
                          <p className="text-xs text-gray-400 truncate">{req.user_id.slice(0, 8)}...</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium">
                        {ROLE_LABELS[req.requested_role] || req.requested_role}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <FileText className="h-4 w-4 text-gray-400" />
                        <span className="text-sm">{req.documents?.length || 0}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${statusCfg.color} gap-1`}>
                        <StatusIcon className="h-3 w-3" />
                        {statusCfg.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {new Date(req.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedRequest(req);
                          setReviewNotes('');
                        }}
                        className="gap-1"
                      >
                        <Eye className="h-4 w-4" />
                        Review
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ─── Review Dialog ─── */}
      <Dialog open={!!selectedRequest} onOpenChange={(open) => !open && setSelectedRequest(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Verification Request</DialogTitle>
            <DialogDescription>
              Review this user's credentials and approve or reject their educator role request.
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4 py-2">
              {/* User info */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                {selectedRequest.profile?.avatar_url ? (
                  <img
                    src={selectedRequest.profile.avatar_url}
                    alt=""
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-sm font-bold text-blue-600">
                    {(selectedRequest.profile?.full_name || '?')[0]?.toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {selectedRequest.profile?.full_name || 'Unknown User'}
                  </p>
                  <p className="text-xs text-gray-500">{selectedRequest.user_id}</p>
                </div>
              </div>

              {/* Requested role */}
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Requested Role</label>
                <p className="font-medium text-gray-900 dark:text-white mt-0.5">
                  {ROLE_LABELS[selectedRequest.requested_role] || selectedRequest.requested_role}
                </p>
              </div>

              {/* Qualifications */}
              {selectedRequest.qualifications && (
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Qualifications</label>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5 whitespace-pre-wrap">
                    {selectedRequest.qualifications}
                  </p>
                </div>
              )}

              {/* Experience */}
              {selectedRequest.years_experience && (
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Years of Experience</label>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">
                    {selectedRequest.years_experience}
                  </p>
                </div>
              )}

              {/* Specializations */}
              {selectedRequest.specializations && selectedRequest.specializations.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Specializations</label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedRequest.specializations.map((s, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {s}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Additional notes */}
              {selectedRequest.additional_notes && (
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Additional Notes</label>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">
                    {selectedRequest.additional_notes}
                  </p>
                </div>
              )}

              {/* Documents */}
              {selectedRequest.documents && selectedRequest.documents.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Uploaded Documents ({selectedRequest.documents.length})
                  </label>
                  <div className="space-y-2 mt-1">
                    {selectedRequest.documents.map((doc, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="h-4 w-4 text-blue-500 shrink-0" />
                          <span className="text-sm truncate">{doc.name}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDocument(doc)}
                          className="gap-1 shrink-0"
                        >
                          <ExternalLink className="h-3 w-3" />
                          View
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Already reviewed info */}
              {selectedRequest.reviewed_at && (
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Previous Review</label>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">
                    {selectedRequest.status === 'approved' ? '✅ Approved' : '❌ Rejected'} on{' '}
                    {new Date(selectedRequest.reviewed_at).toLocaleDateString()}
                  </p>
                  {selectedRequest.review_notes && (
                    <p className="text-sm text-gray-500 mt-1">Notes: {selectedRequest.review_notes}</p>
                  )}
                </div>
              )}

              {/* Review notes input (only for pending) */}
              {selectedRequest.status === 'pending' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Review Notes <span className="text-gray-400">(required for rejection)</span>
                  </label>
                  <textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="Add notes about your decision..."
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm min-h-[80px] focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    maxLength={1000}
                  />
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          {selectedRequest?.status === 'pending' && (
            <DialogFooter className="flex gap-2 sm:gap-2">
              <Button
                variant="outline"
                onClick={handleReject}
                disabled={isRejecting || isApproving}
                className="gap-1 text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20"
              >
                {isRejecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                Reject
              </Button>
              <Button
                onClick={handleApprove}
                disabled={isApproving || isRejecting}
                className="gap-1 bg-green-600 hover:bg-green-700 text-white"
              >
                {isApproving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
                Approve
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RoleVerificationAdmin;
