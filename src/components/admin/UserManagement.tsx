// src/components/admin/UserManagement.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { Skeleton } from '../ui/skeleton';
import { useToast } from '../ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Select as PlanSelect, SelectTrigger as PlanSelectTrigger, SelectValue as PlanSelectValue, SelectContent as PlanSelectContent, SelectItem as PlanSelectItem } from '../ui/select';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { useNavigate } from 'react-router-dom';
import { Textarea } from '../ui/textarea';
import { AlertTriangle, MoreVertical } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '../ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { logAdminActivity } from '../../utils/adminActivityLogger';

interface UserProfile {
  id: string;
  username: string;
  email: string | null;
  display_name: string | null;
  created_at: string;
  last_active: string | null;
  status: 'active' | 'suspended' | 'banned' | 'deactivated';
  is_verified?: boolean | null; // deprecated - will be removed
  posts_count: number | null;
  followers_count: number | null;
  avatar_url: string | null;
}

const UserManagement = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isUpgradeOpen, setIsUpgradeOpen] = useState(false);
  const [upgradePlan, setUpgradePlan] = useState<'scholar' | 'genius'>('scholar');
  const [isUpgrading, setIsUpgrading] = useState(false);
  // Credit amounts by plan (matches MONTHLY_CREDIT_GRANTS)
  const PLAN_CREDITS: Record<string, number> = { scholar: 5, genius: 15 };

  // Manual upgrade handler
  const handleManualUpgrade = async () => {
    if (!selectedUser) return;
    setIsUpgrading(true);
    try {
      // Upsert subscription for user
      const { error } = await supabase
        .from('subscriptions')
        .upsert({
          user_id: selectedUser.id,
          plan_type: upgradePlan,
          status: 'active',
          current_period_end: '2099-12-31', // Far future for indefinite access
          paystack_sub_code: null
        }, { onConflict: 'user_id' });
      if (error) throw error;

      // Grant podcast credits for the new tier
      const creditAmount = PLAN_CREDITS[upgradePlan] ?? 0;
      if (creditAmount > 0) {
        const { error: creditError } = await supabase.rpc('add_podcast_credits' as any, {
          p_user_id: selectedUser.id,
          p_amount: creditAmount,
          p_type: 'admin_adjustment',
          p_description: `Admin granted ${upgradePlan} tier credits (${creditAmount} credits)`,
        });
        if (creditError) {
          console.error('Credit grant error:', creditError);
          // Non-fatal — subscription upgrade succeeded, log but don't block
          toast({
            title: 'Partial Success',
            description: `User upgraded to ${upgradePlan} but credit grant failed: ${creditError.message}`,
            variant: 'destructive',
          });
          setIsUpgradeOpen(false);
          return;
        }
      }

      toast({ title: 'Success', description: `User upgraded to ${upgradePlan} plan with ${creditAmount} podcast credits.` });
      setIsUpgradeOpen(false);
    } catch (err) {
      toast({ title: 'Error upgrading user', description: `${err}`, variant: 'destructive' });
    } finally {
      setIsUpgrading(false);
    }
  };
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'suspended'>('all');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [isSuspendOpen, setIsSuspendOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');
  const [isPurgeOpen, setIsPurgeOpen] = useState(false);
  const [purgeReason, setPurgeReason] = useState('');
  const [purgeConfirmText, setPurgeConfirmText] = useState('');
  const [isPurging, setIsPurging] = useState(false);
  
  // Verification states
  const [isEligibilityOpen, setIsEligibilityOpen] = useState(false);
  const [isMakeVerifiedOpen, setIsMakeVerifiedOpen] = useState(false);
  const [isRemoveVerifiedOpen, setIsRemoveVerifiedOpen] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isRemovingVerified, setIsRemovingVerified] = useState(false);
  const [eligibilityResults, setEligibilityResults] = useState<any>(null);
  // Store verified_creator badge UUID
  const [verifiedBadgeId, setVerifiedBadgeId] = useState<string | null>(null);
    // Fetch verified_creator badge UUID
    useEffect(() => {
      const fetchVerifiedBadgeId = async () => {
        const { data, error } = await supabase
          .from('badges')
          .select('id')
          .eq('name', 'verified_creator')
          .single();
        if (error) {
          toast({ title: 'Error', description: `Failed to fetch badge UUID: ${error.message}`, variant: 'destructive' });
          setVerifiedBadgeId(null);
        } else {
          setVerifiedBadgeId(data?.id || null);
        }
      };
      fetchVerifiedBadgeId();
    }, [toast]);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10); // Items per page
  const [totalCount, setTotalCount] = useState(0);

  const fetchUsers = useCallback(async (page: number = 1) => {
    try {
      setLoading(true);
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const trimmedSearch = searchTerm.trim();

      let countQuery = supabase
        .from('social_users')
        .select('id', { count: 'exact', head: true });

      if (filterStatus !== 'all') {
        countQuery = countQuery.eq('status', filterStatus);
      }

      if (trimmedSearch) {
        countQuery = countQuery.or(`username.ilike.%${trimmedSearch}%,email.ilike.%${trimmedSearch}%,display_name.ilike.%${trimmedSearch}%`);
      }

      // Fetch total count
      const { count, error: countError } = await countQuery;

      if (countError) throw countError;
      setTotalCount(count || 0);

      let usersQuery = supabase
        .from('social_users')
        .select(`
          id,
          username,
          email,
          display_name,
          created_at,
          last_active,
          status,
          posts_count,
          followers_count,
          is_verified
        `);

      if (filterStatus !== 'all') {
        usersQuery = usersQuery.eq('status', filterStatus);
      }

      if (trimmedSearch) {
        usersQuery = usersQuery.or(`username.ilike.%${trimmedSearch}%,email.ilike.%${trimmedSearch}%,display_name.ilike.%${trimmedSearch}%`);
      }

      // Fetch paginated users
      const { data, error } = await usersQuery
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;
      
      // Fetch avatars from profiles table
      const userIds = (data ?? []).map(u => u.id);
      let avatarMap: Record<string, string | null> = {};
      
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, avatar_url')
          .in('id', userIds);
        
        profilesData?.forEach(profile => {
          avatarMap[profile.id] = profile.avatar_url;
        });
      }
      
      // Merge avatar data into users
      const flattenedData = (data ?? []).map((user: any) => ({
        ...user,
        avatar_url: avatarMap[user.id] || null,
        is_verified: !!user.is_verified,
      }));

      setUsers(flattenedData as UserProfile[]);
      setCurrentPage(page);
    } catch (err) {
      toast({ title: 'Error fetching users', description: `${err}`, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [pageSize, toast, searchTerm, filterStatus]);

  useEffect(() => {
    fetchUsers(1);
  }, [searchTerm, filterStatus, fetchUsers]);

  const applySearch = () => {
    setSearchTerm(searchInput.trim());
  };

  const toggleActive = async (userId: string, makeActive: boolean) => {
    try {
      const { error } = await supabase
        .from('social_users')
        .update({ status: makeActive ? 'active' : 'suspended' })
        .eq('id', userId);
      if (error) throw error;

      logAdminActivity({
        action: makeActive ? 'activate_user' : 'suspend_user',
        target_type: 'user',
        target_id: userId,
        details: {
          reason: suspendReason || 'No reason provided',
          previous_status: makeActive ? 'suspended' : 'active',
          new_status: makeActive ? 'active' : 'suspended',
        },
      });

      toast({ title: 'Success', description: makeActive ? 'User activated' : 'User suspended' });
      setSuspendReason('');
      fetchUsers();
    } catch (err) {
      toast({ title: 'Error', description: `${err}`, variant: 'destructive' });
    }
  };

  const checkEligibility = async () => {
    if (!selectedUser) return;
    setIsChecking(true);
    try {
      const { data, error } = await supabase.rpc('check_creator_verification_eligibility' as any, {
        p_user_id: selectedUser.id,
      });
      if (error) throw error;
      
      if (data && data.length > 0) {
        setEligibilityResults(data[0]);
      }
    } catch (err) {
      toast({ title: 'Error', description: `Failed to check eligibility: ${err}`, variant: 'destructive' });
    } finally {
      setIsChecking(false);
    }
  };

  const makeUserVerified = async () => {
    if (!selectedUser) return;
    setIsVerifying(true);
    try {
      const { error: verifyError } = await supabase.rpc('admin_verify_user' as any, {
        p_user_id: selectedUser.id,
      });
      if (verifyError) throw verifyError;
      toast({ title: 'Success', description: `${selectedUser.username} is now verified!` });
      setIsMakeVerifiedOpen(false);
      fetchUsers();
    } catch (err) {
      toast({ title: 'Error', description: `Failed to verify user: ${err}`, variant: 'destructive' });
    } finally {
      setIsVerifying(false);
    }
  };

  // Remove verified handler
  const removeUserVerified = async () => {
    if (!selectedUser || !verifiedBadgeId) return;
    setIsRemovingVerified(true);
    try {
      // Update social_users to reflect removal of verified status
      const { error: updateError } = await supabase
        .from('social_users')
        .update({ is_verified: false })
        .eq('id', selectedUser.id);
      if (updateError) throw updateError;

      // Also remove the verified_creator badge from achievements (if it exists)
      if (verifiedBadgeId) {
        const { error: removeError } = await supabase
          .from('achievements')
          .delete()
          .eq('user_id', selectedUser.id)
          .eq('badge_id', verifiedBadgeId);
        if (removeError) throw removeError;
      }

      toast({ title: 'Success', description: `${selectedUser.username} is no longer verified.` });
      setIsRemoveVerifiedOpen(false);
      fetchUsers();
    } catch (err) {
      toast({ title: 'Error', description: `Failed to remove verification: ${err}`, variant: 'destructive' });
    } finally {
      setIsRemovingVerified(false);
    }
  };

  const handlePurgeUser = async () => {
    if (!selectedUser || purgeConfirmText !== 'PURGE') return;
    setIsPurging(true);
    try {
      const { error } = await supabase.rpc('purge_user_data' as any, {
        p_user_id: selectedUser.id,
      });
      if (error) throw error;

      logAdminActivity({
        action: 'purge_user_data',
        target_type: 'user',
        target_id: selectedUser.id,
        details: {
          reason: purgeReason || 'No reason provided',
          username: selectedUser.username,
          email: selectedUser.email,
        },
      });

      toast({ title: 'User Data Purged', description: `All data for ${selectedUser.username} has been deleted. The account can still log in but will start fresh.` });
      setPurgeReason('');
      setPurgeConfirmText('');
      setIsPurgeOpen(false);
      fetchUsers();
    } catch (err) {
      toast({ title: 'Purge Failed', description: `${err}`, variant: 'destructive' });
    } finally {
      setIsPurging(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Table>
          <TableHeader>
            <TableRow>
              {['Username', 'Email', 'Joined', 'Posts', 'Status', 'Actions'].map(t => (
                <TableHead key={t}><Skeleton className="h-4 w-20" /></TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(5)].map((_, i) => (
              <TableRow key={i}>
                {[...Array(6)].map((_, j) => (
                  <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-3xl font-bold">User Management</h2>
        <Button onClick={() => { fetchUsers(currentPage); }}>Refresh</Button>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <Input
          placeholder="Search by username or email..."
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              applySearch();
            }
          }}
          className="max-w-md"
        />
        <Button variant="outline" onClick={applySearch}>Search</Button>
        <Select value={filterStatus} onValueChange={(v: typeof filterStatus) => setFilterStatus(v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Avatar</TableHead>
            <TableHead>Username</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead>Posts</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map(u => (
            <TableRow key={u.id}>
              <TableCell>
                <Avatar className="h-10 w-10">
                  <AvatarImage src={u.avatar_url || undefined} alt={u.username} />
                  <AvatarFallback>
                    {(u.display_name?.[0] || u.username?.[0] || 'U').toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </TableCell>
              <TableCell>{u.username}</TableCell>
              <TableCell>{u.email ?? '-'}</TableCell>
              <TableCell>{new Date(u.created_at).toLocaleDateString()}</TableCell>
              <TableCell>{u.posts_count ?? 0}</TableCell>
              <TableCell>
                <Badge variant={u.status === 'active' ? 'default' : u.status === 'banned' ? 'secondary' : 'destructive'}>
                  {u.status.charAt(0).toUpperCase() + u.status.slice(1)}
                </Badge>
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => navigate(`/social/profile/${u.id}`)}>
                      View Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => {
                      setSelectedUser(u);
                      setIsUpgradeOpen(true);
                    }}>
                      Make Paid
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => {
                      setSelectedUser(u);
                      checkEligibility();
                      setIsEligibilityOpen(true);
                    }}>
                      Check Eligibility
                    </DropdownMenuItem>
                    {!u.is_verified && (
                      <DropdownMenuItem onClick={() => {
                        setSelectedUser(u);
                        setIsMakeVerifiedOpen(true);
                      }}>
                        Make Verified
                      </DropdownMenuItem>
                    )}
                    {u.is_verified && (
                      <DropdownMenuItem onClick={() => {
                        setSelectedUser(u);
                        setIsRemoveVerifiedOpen(true);
                      }}>
                        Remove Verified
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => {
                      setSelectedUser(u);
                      setIsSuspendOpen(true);
                    }}>
                      {u.status === 'active' ? 'Suspend' : 'Activate'}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => {
                      setSelectedUser(u);
                      setIsPurgeOpen(true);
                    }} className="text-red-600">
                      Purge Data
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Manual Upgrade Dialog */}
      <Dialog open={isUpgradeOpen} onOpenChange={setIsUpgradeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Grant Paid Access</DialogTitle>
            <DialogDescription>
              Manually upgrade a user to a paid plan and grant podcast credits
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Select Plan</Label>
              <PlanSelect value={upgradePlan} onValueChange={v => setUpgradePlan(v as 'scholar' | 'genius')}>
                <PlanSelectTrigger className="w-full">
                  <PlanSelectValue />
                </PlanSelectTrigger>
                <PlanSelectContent>
                  <PlanSelectItem value="scholar">Scholar (Standard Paid)</PlanSelectItem>
                  <PlanSelectItem value="genius">Genius (Full Access)</PlanSelectItem>
                </PlanSelectContent>
              </PlanSelect>
            </div>
            <Button onClick={handleManualUpgrade} disabled={isUpgrading} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
              {isUpgrading ? 'Granting...' : 'Grant Paid Access'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pagination Controls */}
      <div className="flex items-center justify-between mt-6">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Showing {users.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} users
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchUsers(currentPage - 1)}
            disabled={currentPage === 1 || loading}
          >
            Previous
          </Button>
          <div className="flex items-center px-3 py-2 border rounded-md bg-gray-50 dark:bg-gray-900">
            <span className="text-sm font-medium">Page {currentPage} of {Math.ceil(totalCount / pageSize)}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchUsers(currentPage + 1)}
            disabled={currentPage * pageSize >= totalCount || loading}
          >
            Next
          </Button>
        </div>
      </div>

      {/* Purge User Data Dialog */}
      <Dialog open={isPurgeOpen} onOpenChange={(open) => { setIsPurgeOpen(open); if (!open) { setPurgeConfirmText(''); setPurgeReason(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Purge All Data for {selectedUser?.username}
            </DialogTitle>
            <DialogDescription>
              This action permanently deletes all user content but preserves the login account
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
              <strong>Warning:</strong> This will permanently delete ALL user data (posts, chats, quizzes, documents, flashcards, social content, etc.). The user&apos;s login will be preserved but they will start completely fresh like a new user.
            </div>
            <div>
              <Label>Reason for purge</Label>
              <Textarea
                placeholder="Why is this user's data being purged?"
                value={purgeReason}
                onChange={e => setPurgeReason(e.target.value)}
              />
            </div>
            <div>
              <Label>Type <strong>PURGE</strong> to confirm</Label>
              <Input
                placeholder="PURGE"
                value={purgeConfirmText}
                onChange={e => setPurgeConfirmText(e.target.value)}
              />
            </div>
            <Button
              variant="destructive"
              onClick={handlePurgeUser}
              disabled={purgeConfirmText !== 'PURGE' || isPurging}
              className="w-full"
            >
              {isPurging ? 'Purging...' : 'Permanently Purge All User Data'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isSuspendOpen} onOpenChange={setIsSuspendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedUser?.status === 'active' ? 'Suspend' : 'Activate'} {selectedUser?.username}
            </DialogTitle>
            <DialogDescription>
              Toggle the account status between active and suspended
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Switch id="suspend" checked={selectedUser?.status !== 'active'} />
              <Label htmlFor="suspend">Suspend account</Label>
            </div>
            <Input placeholder="Reason..." value={suspendReason} onChange={e => setSuspendReason(e.target.value)} />
            <Button
              onClick={() => {
                if (selectedUser) toggleActive(selectedUser.id, selectedUser.status !== 'active');
                setIsSuspendOpen(false);
              }}
            >
              Confirm
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Check Eligibility Dialog */}
      <Dialog open={isEligibilityOpen} onOpenChange={setIsEligibilityOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verification Eligibility Check</DialogTitle>
            <DialogDescription>
              Check if the user meets all requirements for the verified creator badge
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {isChecking ? (
              <div className="text-center py-4">
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ) : eligibilityResults ? (
              <>
                <div className={`p-3 rounded-lg ${eligibilityResults.eligible ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'}`}>
                  <p className={`font-semibold ${eligibilityResults.eligible ? 'text-green-700 dark:text-green-300' : 'text-yellow-700 dark:text-yellow-300'}`}>
                    {eligibilityResults.eligible ? '✓ Eligible for verification' : '✗ Not yet eligible'}
                  </p>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
                    <span>Posts (need 50+)</span>
                    <span className={eligibilityResults.posts_count >= 50 ? 'text-green-600 font-semibold' : 'text-gray-600'}>{eligibilityResults.posts_count}</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
                    <span>Followers (need 500+)</span>
                    <span className={eligibilityResults.followers_count >= 500 ? 'text-green-600 font-semibold' : 'text-gray-600'}>{eligibilityResults.followers_count}</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
                    <span>Account Age (need 30+ days)</span>
                    <span className={eligibilityResults.account_age_days >= 30 ? 'text-green-600 font-semibold' : 'text-gray-600'}>{eligibilityResults.account_age_days} days</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
                    <span>Engagement Rate (need 2%+)</span>
                    <span className={eligibilityResults.engagement_rate >= 2 ? 'text-green-600 font-semibold' : 'text-gray-600'}>{eligibilityResults.engagement_rate}%</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
                    <span>Days Since Last Active (need ≤15)</span>
                    <span className={eligibilityResults.last_active_days <= 15 ? 'text-green-600 font-semibold' : 'text-gray-600'}>{eligibilityResults.last_active_days} days</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
                    <span>Violations (need 0)</span>
                    <span className={eligibilityResults.violation_count === 0 ? 'text-green-600 font-semibold' : 'text-red-600'}>{eligibilityResults.violation_count}</span>
                  </div>
                </div>
              </>
            ) : null}
            <Button onClick={() => setIsEligibilityOpen(false)} className="w-full">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Make Verified Dialog */}
      <Dialog open={isMakeVerifiedOpen} onOpenChange={setIsMakeVerifiedOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Make {selectedUser?.username} Verified?</DialogTitle>
            <DialogDescription>
              Award the verified creator badge via admin override
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm">
              <p className="text-blue-700 dark:text-blue-300">
                This will award the <strong>Verified Creator</strong> badge to this user. Use this for testing or special admin cases.
              </p>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              User: <strong>{selectedUser?.username}</strong>
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setIsMakeVerifiedOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={makeUserVerified} 
                disabled={isVerifying}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isVerifying ? 'Verifying...' : 'Confirm Verification'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Remove Verified Dialog */}
      <Dialog open={isRemoveVerifiedOpen} onOpenChange={setIsRemoveVerifiedOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Verified Badge</DialogTitle>
            <DialogDescription>
              This will revoke the verified creator badge from the user.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm">
              <p className="text-red-700 dark:text-red-300">
                Are you sure you want to remove the <strong>Verified Creator</strong> badge from <strong>{selectedUser?.username}</strong>?
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setIsRemoveVerifiedOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={removeUserVerified} 
                disabled={isRemovingVerified}
                className="bg-red-600 hover:bg-red-700"
              >
                {isRemovingVerified ? 'Removing...' : 'Confirm Remove'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserManagement;