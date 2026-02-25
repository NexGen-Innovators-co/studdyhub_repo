// src/components/admin/AdminInstitutions.tsx
// Admin panel tab for managing institutions: list, verify, deactivate.

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Building2,
  Search,
  Loader2,
  CheckCircle,
  XCircle,
  ShieldAlert,
  Users,
  Globe,
  Calendar,
  Eye,
  Ban,
  RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import type { Institution, VerificationStatus } from '@/types/Education';

type FilterStatus = 'all' | VerificationStatus;

const VERIFICATION_COLORS: Record<VerificationStatus, string> = {
  unverified: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  verified: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

const AdminInstitutions: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [selectedInstitution, setSelectedInstitution] = useState<Institution | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Fetch all institutions
  const { data: institutions = [], isLoading } = useQuery({
    queryKey: ['admin-institutions', filterStatus],
    queryFn: async () => {
      let query = supabase
        .from('institutions')
        .select('*')
        .order('created_at', { ascending: false });

      if (filterStatus !== 'all') {
        query = query.eq('verification_status', filterStatus);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Institution[];
    },
  });

  // Fetch member counts
  const { data: memberCounts = {} } = useQuery({
    queryKey: ['admin-institution-member-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('institution_members')
        .select('institution_id')
        .eq('status', 'active');

      if (error) throw error;

      const counts: Record<string, number> = {};
      data?.forEach((m) => {
        counts[m.institution_id] = (counts[m.institution_id] || 0) + 1;
      });
      return counts;
    },
  });

  // Verify mutation — uses RPC first (auto-approves owner), falls back to direct update
  const verifyMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: VerificationStatus }) => {
      // Try RPC first — it handles both institution verification AND owner role approval
      const { error: rpcError } = await supabase.rpc('admin_verify_institution', {
        _institution_id: id,
        _status: status,
        _admin_id: user?.id,
      });

      if (!rpcError) return; // Success — institution updated + owner auto-approved

      // RPC not available — fall back to direct update
      console.warn('RPC admin_verify_institution unavailable, using direct update:', rpcError.message);

      const updates: Record<string, any> = {
        verification_status: status,
        updated_at: new Date().toISOString(),
      };
      if (status === 'verified') {
        updates.verified_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('institutions')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      // If verifying, also try to auto-approve the institution owner's role
      if (status === 'verified') {
        try {
          const { data: owner } = await supabase
            .from('institution_members')
            .select('user_id')
            .eq('institution_id', id)
            .eq('role', 'owner')
            .eq('status', 'active')
            .limit(1)
            .maybeSingle();

          if (owner?.user_id) {
            // Update owner's profile role verification
            await supabase
              .from('profiles')
              .update({
                role_verification_status: 'verified',
                role_verified_at: new Date().toISOString(),
                role_verified_by: user?.id,
                role_rejection_reason: null,
              } as any)
              .eq('id', owner.user_id);

            // Approve any pending role request
            await supabase
              .from('role_verification_requests')
              .update({
                status: 'approved',
                reviewed_by: user?.id,
                reviewed_at: new Date().toISOString(),
                review_notes: 'Auto-approved: institution verified by admin',
                updated_at: new Date().toISOString(),
              })
              .eq('user_id', owner.user_id)
              .eq('status', 'pending');
          }
        } catch (err) {
          console.warn('Could not auto-approve institution owner role:', err);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-institutions'] });
      toast.success('Institution status updated');
    },
    onError: (err: any) => toast.error(err.message ?? 'Failed to update'),
  });

  // Toggle active mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('institutions')
        .update({ is_active, updated_at: new Date().toISOString() })
        .eq('id', id);
      // If direct update fails due to RLS, use the verify RPC with current verification_status
      if (error) {
        const inst = institutions.find((i) => i.id === id);
        if (inst) {
          // Try toggling via direct update one more time (may succeed after migration)
          const { error: retryErr } = await supabase
            .from('institutions')
            .update({ is_active })
            .eq('id', id);
          if (retryErr) throw retryErr;
        } else {
          throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-institutions'] });
      toast.success('Institution active status updated');
    },
    onError: (err: any) => toast.error(err.message ?? 'Failed to update'),
  });

  const filteredInstitutions = institutions.filter(
    (inst) =>
      inst.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inst.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (inst.city && inst.city.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const stats = {
    total: institutions.length,
    verified: institutions.filter((i) => i.verification_status === 'verified').length,
    pending: institutions.filter((i) => i.verification_status === 'pending').length,
    unverified: institutions.filter((i) => i.verification_status === 'unverified').length,
  };

  const handleViewDetails = (inst: Institution) => {
    setSelectedInstitution(inst);
    setDetailsOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: 'Total', value: stats.total, icon: Building2, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
          { label: 'Verified', value: stats.verified, icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20' },
          { label: 'Pending', value: stats.pending, icon: ShieldAlert, color: 'text-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-900/20' },
          { label: 'Unverified', value: stats.unverified, icon: XCircle, color: 'text-gray-500', bg: 'bg-gray-50 dark:bg-gray-800/50' },
        ].map((stat) => (
          <Card key={stat.label} className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:shadow-md transition-shadow duration-200">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`p-2 rounded-lg ${stat.bg}`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
          <Input
            placeholder="Search institutions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
          />
        </div>
        <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as FilterStatus)}>
          <SelectTrigger className="w-full sm:w-44 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white">
            <SelectValue placeholder="Filter status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="unverified">Unverified</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="verified">Verified</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Institution List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : filteredInstitutions.length === 0 ? (
        <div className="text-center py-12">
          <Building2 className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <p className="text-gray-500 dark:text-gray-400">No institutions found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredInstitutions.map((inst) => (
            <Card
              key={inst.id}
              className={`bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:shadow-md transition-all duration-200 ${!inst.is_active ? 'opacity-60' : ''}`}
            >
              <CardContent className="p-3 sm:p-4">
                {/* Mobile: stack layout */}
                <div className="flex items-start gap-3 sm:gap-4">
                  {inst.logo_url ? (
                    <img
                      src={inst.logo_url}
                      alt={inst.name}
                      className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-5 h-5 text-white" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <p className="font-semibold text-gray-900 dark:text-white truncate">{inst.name}</p>
                      {!inst.is_active && (
                        <Badge variant="outline" className="text-xs text-red-500 dark:text-red-400 border-red-300 dark:border-red-500">
                          Deactivated
                        </Badge>
                      )}
                      <Badge
                        className={`${VERIFICATION_COLORS[inst.verification_status as VerificationStatus]} capitalize text-xs ml-auto sm:ml-0`}
                      >
                        {inst.verification_status}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                      <span className="capitalize">{inst.type.replace('_', ' ')}</span>
                      {inst.city && (
                        <span className="flex items-center gap-1">
                          <Globe className="w-3 h-3" />
                          {inst.city}
                          {inst.region && `, ${inst.region}`}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {memberCounts[inst.id] || 0} members
                      </span>
                      <span className="hidden sm:flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(inst.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action buttons - separate row on mobile */}
                <div className="flex items-center justify-end gap-1 mt-2 sm:mt-0 sm:-mt-8 sm:ml-14">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                    onClick={() => handleViewDetails(inst)}
                    title="View Details"
                  >
                    <Eye className="w-4 h-4" />
                  </Button>

                  {inst.verification_status === 'pending' && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-green-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                        onClick={() => verifyMutation.mutate({ id: inst.id, status: 'verified' })}
                        title="Verify"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        onClick={() => verifyMutation.mutate({ id: inst.id, status: 'rejected' })}
                        title="Reject"
                      >
                        <XCircle className="w-4 h-4" />
                      </Button>
                    </>
                  )}

                  {inst.verification_status === 'unverified' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-green-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                      onClick={() => verifyMutation.mutate({ id: inst.id, status: 'verified' })}
                      title="Verify"
                    >
                      <CheckCircle className="w-4 h-4" />
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-yellow-500 hover:text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 transition-colors"
                    onClick={() =>
                      toggleActiveMutation.mutate({ id: inst.id, is_active: !inst.is_active })
                    }
                    title={inst.is_active ? 'Deactivate' : 'Reactivate'}
                  >
                    {inst.is_active ? <Ban className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-white">Institution Details</DialogTitle>
          </DialogHeader>
          {selectedInstitution && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-3">
                {selectedInstitution.logo_url ? (
                  <img
                    src={selectedInstitution.logo_url}
                    alt={selectedInstitution.name}
                    className="w-14 h-14 rounded-xl object-cover"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    <Building2 className="w-7 h-7 text-white" />
                  </div>
                )}
                <div>
                  <h3 className="font-bold text-lg text-gray-900 dark:text-white">{selectedInstitution.name}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">/{selectedInstitution.slug}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400 text-xs">Type</span>
                  <p className="font-medium text-gray-900 dark:text-white capitalize">{selectedInstitution.type.replace('_', ' ')}</p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400 text-xs">Status</span>
                  <p className="font-medium text-gray-900 dark:text-white capitalize">{selectedInstitution.verification_status}</p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400 text-xs">Active</span>
                  <p className="font-medium text-gray-900 dark:text-white">{selectedInstitution.is_active ? 'Yes' : 'No'}</p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400 text-xs">Members</span>
                  <p className="font-medium text-gray-900 dark:text-white">{memberCounts[selectedInstitution.id] || 0}</p>
                </div>
                {selectedInstitution.city && (
                  <div>
                    <span className="text-gray-500 dark:text-gray-400 text-xs">Location</span>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {selectedInstitution.city}
                      {selectedInstitution.region && `, ${selectedInstitution.region}`}
                    </p>
                  </div>
                )}
                {selectedInstitution.website && (
                  <div>
                    <span className="text-gray-500 dark:text-gray-400 text-xs">Website</span>
                    <a
                      href={selectedInstitution.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-blue-600 dark:text-blue-400 hover:underline truncate block"
                    >
                      {selectedInstitution.website}
                    </a>
                  </div>
                )}
              </div>

              {selectedInstitution.description && (
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Description</span>
                  <p className="text-sm mt-1 text-gray-700 dark:text-gray-300">{selectedInstitution.description}</p>
                </div>
              )}

              <div className="text-xs text-gray-400 dark:text-gray-500">
                Created: {new Date(selectedInstitution.created_at).toLocaleString()}
              </div>
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="ghost" onClick={() => setDetailsOpen(false)}>
              Close
            </Button>
            {selectedInstitution && selectedInstitution.verification_status !== 'verified' && (
              <Button
                onClick={() => {
                  verifyMutation.mutate({ id: selectedInstitution.id, status: 'verified' });
                  setDetailsOpen(false);
                }}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Verify Institution
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminInstitutions;
