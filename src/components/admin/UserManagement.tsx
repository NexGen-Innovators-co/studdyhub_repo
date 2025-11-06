// src/components/admin/UserManagement.tsx
import React, { useEffect, useState } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { Skeleton } from '../ui/skeleton';
import { useToast } from '../ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';

interface UserProfile {
  id: string;
  username: string;
  email: string | null;
  display_name: string | null;
  created_at: string;
  last_active: string | null;
  is_verified: boolean | null;
  posts_count: number | null;
  followers_count: number | null;
}

const UserManagement = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'suspended'>('all');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [isSuspendOpen, setIsSuspendOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('social_users')
        .select(`
          id,
          username,
          email,
          display_name,
          created_at,
          last_active,
          is_verified,
          posts_count,
          followers_count
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers((data ?? []) as UserProfile[]);
    } catch (err) {
      toast({ title: 'Error fetching users', description: `${err}`, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (userId: string, makeActive: boolean) => {
    try {
      const { error } = await supabase
        .from('social_users')
        .update({ is_verified: makeActive }) // using is_verified as active flag
        .eq('id', userId);
      if (error) throw error;
      toast({ title: 'Success', description: makeActive ? 'User activated' : 'User suspended' });
      fetchUsers();
    } catch (err) {
      toast({ title: 'Error', description: `${err}`, variant: 'destructive' });
    }
  };

  const filtered = users.filter(u => {
    const matchesSearch =
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'active' && u.is_verified) ||
      (filterStatus === 'suspended' && !u.is_verified);
    return matchesSearch && matchesStatus;
  });

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
        <Button onClick={fetchUsers}>Refresh</Button>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <Input
          placeholder="Search by username or email..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="max-w-md"
        />
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
            <TableHead>Username</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead>Posts</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map(u => (
            <TableRow key={u.id}>
              <TableCell>{u.username}</TableCell>
              <TableCell>{u.email ?? '-'}</TableCell>
              <TableCell>{new Date(u.created_at).toLocaleDateString()}</TableCell>
              <TableCell>{u.posts_count ?? 0}</TableCell>
              <TableCell>
                <Badge variant={u.is_verified ? 'default' : 'destructive'}>
                  {u.is_verified ? 'Active' : 'Suspended'}
                </Badge>
              </TableCell>
              <TableCell className="flex gap-2">
                <Button variant="outline" size="sm">View</Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    setSelectedUser(u);
                    setIsSuspendOpen(true);
                  }}
                >
                  {u.is_verified ? 'Suspend' : 'Activate'}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={isSuspendOpen} onOpenChange={setIsSuspendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedUser?.is_verified ? 'Suspend' : 'Activate'} {selectedUser?.username}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Switch id="suspend" checked={!selectedUser?.is_verified} />
              <Label htmlFor="suspend">Suspend account</Label>
            </div>
            <Input placeholder="Reason..." value={suspendReason} onChange={e => setSuspendReason(e.target.value)} />
            <Button
              onClick={() => {
                if (selectedUser) toggleActive(selectedUser.id, !selectedUser.is_verified);
                setIsSuspendOpen(false);
              }}
            >
              Confirm
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserManagement;