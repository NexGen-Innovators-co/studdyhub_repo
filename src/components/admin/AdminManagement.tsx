import React, { useEffect, useState } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { Skeleton } from '../ui/skeleton';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '../ui/dialog';
import { Label } from '../ui/label';
import { AdminUser, AdminRole } from '../../integrations/supabase/admin';
import { Shield, Crown, UserCheck, UserX, Clock, Mail, Plus, Filter, Search } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip as RechartsTooltip } from 'recharts';

const AdminManagement = () => {
    const [admins, setAdmins] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterRole, setFilterRole] = useState<'all' | AdminRole>('all');
    const [newAdminEmail, setNewAdminEmail] = useState('');
    const [newAdminRole, setNewAdminRole] = useState<AdminRole>('moderator');
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [createType, setCreateType] = useState<'new' | 'existing'>('new'); // new state
    const [userSearchTerm, setUserSearchTerm] = useState(''); // new state
    const [searchResults, setSearchResults] = useState<any[]>([]); // new state
    const [selectedUser, setSelectedUser] = useState<any | null>(null); // new state

    useEffect(() => {
        fetchAdmins();
    }, []);

    const fetchAdmins = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('admin_users')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            const typed = (data ?? []).map(
                (row): AdminUser => ({
                    ...row,
                    permissions: (row.permissions as Record<string, boolean>) ?? {},
                })
            );

            setAdmins(typed);
        } catch (err) {
            toast.error(`Error fetching admins: ${err}`);
        } finally {
            setLoading(false);
        }
    };
    const generateStrongPassword = () => {
        const minLength = 12;
        const uppercaseChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        const lowercaseChars = "abcdefghijklmnopqrstuvwxyz";
        const numberChars = "0123456789";
        const symbolChars = "!@#$%^&*()_+~`|}{[]:;?><,./-=";

        let password = "";

        // Ensure at least one character from each category
        password += uppercaseChars.charAt(Math.floor(Math.random() * uppercaseChars.length));
        password += lowercaseChars.charAt(Math.floor(Math.random() * lowercaseChars.length));
        password += numberChars.charAt(Math.floor(Math.random() * numberChars.length));
        password += symbolChars.charAt(Math.floor(Math.random() * symbolChars.length));

        // Force a *second* symbol
        password += symbolChars.charAt(Math.floor(Math.random() * symbolChars.length));

        // Fill the rest of the password with random characters
        let allChars = uppercaseChars + lowercaseChars + numberChars + symbolChars;
        while (password.length < minLength) {
            password += allChars.charAt(Math.floor(Math.random() * allChars.length));
        }

        // Shuffle the password to randomize the order of characters
        password = password.split('').sort(() => Math.random() - 0.5).join('');
        return password;
    };
    const handleCreateAdmin = async () => {
        try {
            if (createType === 'new') {
                // Create a completely new admin
                const generatedPassword = generateStrongPassword();
                const { data: authData, error: authErr } = await supabase.auth.signUp({
                    email: newAdminEmail,
                    password: generatedPassword,
                });

                if (authErr) {
                    console.error("Supabase Auth Error:", authErr); // Log the full error
                    if (authErr.message.includes("Password should be at least")) {
                        toast.error("Password error: Password does not meet complexity requirements. Please check Supabase Auth settings.");
                    } else {
                        toast.error(`Supabase Auth Error: ${authErr.message}`); // Display the Supabase error
                    }
                    return; // Stop if there's an auth error
                }

                // *** IMPORTANT: Create a corresponding record in the `profiles` table ***
                const { error: profileError } = await supabase
                    .from('profiles')
                    .insert({
                        id: authData.user.id, // *** CRITICAL: Set `profiles.id` to `auth.users.id` ***
                        email: newAdminEmail, // You might want to add the email here
                        username: generateUniqueUsername(newAdminEmail), // Generate a username.
                    });

                if (profileError) {
                    console.error("Error creating profile:", profileError);
                    toast.error(`Error creating profile: ${profileError.message}`);
                    // Consider deleting the auth user if profile creation fails.
                    await supabase.auth.admin.deleteUser(authData.user.id);
                    return;
                }

                const { error } = await supabase.from('admin_users').insert({
                    user_id: authData.user?.id,
                    email: newAdminEmail,
                    role: newAdminRole,
                    permissions: {},
                    is_active: true,
                });
                if (error) throw error;

                toast.success('Admin created invite sent.');
            } else {
                // Select existing user to become an admin
                if (!selectedUser) {
                    toast.error('Please select a user.');
                    return;
                }

                // Check if the selected user already exists as an admin
                const existingAdmin = admins.find(admin => admin.user_id === selectedUser.id);
                if (existingAdmin) {
                    toast.error('User is already an admin.');
                    return;
                }

                const { error } = await supabase.from('admin_users').insert({
                    user_id: selectedUser.id,
                    email: selectedUser.email,
                    role: newAdminRole,
                    permissions: {},
                    is_active: true,
                });
                if (error) throw error;

                toast.success('Admin role assigned to selected user.');
            }

            setIsCreateOpen(false);
            setNewAdminEmail('');
            setNewAdminRole('moderator');
            setSelectedUser(null);
            setSearchResults([]);
            setUserSearchTerm('');
            fetchAdmins();
        } catch (err) {
            toast.error(`Error: ${err}`);
        }
    };

    function generateUniqueUsername(email: string): string {
        // Implement a robust username generation logic here
        // to avoid collisions. This is a placeholder.
        return email.split('@')[0] + Math.floor(Math.random() * 1000);
    }
    const toggleActive = async (adminId: string, makeActive: boolean) => {
        try {
            const { error } = await supabase
                .from('admin_users')
                .update({ is_active: makeActive })
                .eq('id', adminId);
            if (error) throw error;
            toast.success(makeActive ? 'Admin activated' : 'Admin deactivated');
            fetchAdmins();
        } catch (err) {
            toast.error(`Error: ${err}`);
        }
    };

    const filteredAdmins = admins.filter(a => {
        const matchesSearch = a.email.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesRole = filterRole === 'all' || a.role === filterRole;
        return matchesSearch && matchesRole;
    });

    // Stats
    const totalAdmins = admins.length;
    const activeAdmins = admins.filter(a => a.is_active).length;
    const superAdmins = admins.filter(a => a.role === 'super_admin').length;
    const regularAdmins = admins.filter(a => a.role === 'admin').length;
    const moderators = admins.filter(a => a.role === 'moderator').length;

    const roleDistribution = [
        { name: 'Super Admin', value: superAdmins, color: '#ef4444' },
        { name: 'Admin', value: regularAdmins, color: '#3b82f6' },
        { name: 'Moderator', value: moderators, color: '#10b981' },
    ];

    const getRoleIcon = (role: AdminRole) => {
        switch (role) {
            case 'super_admin':
                return <Crown className="h-4 w-4" />;
            case 'admin':
                return <Shield className="h-4 w-4" />;
            case 'moderator':
                return <UserCheck className="h-4 w-4" />;
            default:
                return <UserCheck className="h-4 w-4" />;
        }
    };

    const getRoleBadgeColor = (role: AdminRole) => {
        switch (role) {
            case 'super_admin':
                return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800';
            case 'admin':
                return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800';
            case 'moderator':
                return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800';
            default:
                return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700';
        }
    };

    const handleUserSearch = async () => {
        const searchTerm = userSearchTerm.trim(); // Trim whitespace
        if (!searchTerm) {
            setSearchResults([]);
            return;
        }

        try {
            console.log("Searching for users with term:", searchTerm); // Debugging

            const { data, error } = await supabase
                .from('profiles') // Replace with your user table name
                .select('id, email, full_name') // Select relevant fields
                .ilike('email', `%${searchTerm}%`) // Adjust search based on your needs
                .limit(5); // Limit the number of results

            if (error) {
                throw error;
            }

            console.log("Search results:", data); // Debugging
            setSearchResults(data || []);
        } catch (err) {
            toast.error(`Error searching users: ${err}`);
        }
    };

    if (loading) return <Skeleton className="h-[500px] w-full bg-gray-200 dark:bg-gray-800" />;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Admin Management</h2>
                    <p className="text-gray-600 dark:text-gray-400">Manage admin users and permissions</p>
                </div>

                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                            <Plus className="h-4 w-4 mr-2" />
                            Create New Admin
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                        <DialogHeader>
                            <DialogTitle className="text-gray-900 dark:text-white">Create Admin</DialogTitle>
                            <DialogDescription className="text-gray-600 dark:text-gray-400">
                                Add a new admin user to the platform
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                            {/* Toggle between creating a new admin or selecting an existing user */}
                            <div className="flex gap-2">
                                <Button
                                    variant={createType === 'new' ? 'default' : 'outline'}
                                    onClick={() => setCreateType('new')}
                                >
                                    New Admin
                                </Button>
                                <Button
                                    variant={createType === 'existing' ? 'default' : 'outline'}
                                    onClick={() => setCreateType('existing')}
                                >
                                    Existing User
                                </Button>
                            </div>

                            {createType === 'new' ? (
                                // Form for creating a new admin with email
                                <>
                                    <div>
                                        <Label className="text-gray-700 dark:text-gray-300">Email</Label>
                                        <Input
                                            value={newAdminEmail}
                                            onChange={e => setNewAdminEmail(e.target.value)}
                                            placeholder="admin@example.com"
                                            className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white"
                                        />
                                    </div>
                                </>
                            ) : (
                                // Section for selecting an existing user
                                <>
                                    <div>
                                        <Label className="text-gray-700 dark:text-gray-300">Select User</Label>
                                        <div className="relative">
                                            <Input
                                                placeholder="Search by email..."
                                                value={userSearchTerm}
                                                onChange={e => setUserSearchTerm(e.target.value)}
                                                className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white"
                                            />
                                            <Button
                                                onClick={handleUserSearch}
                                                className="absolute right-1 top-1/2 -translate-y-1/2"
                                                size="sm"
                                            >
                                                <Search className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        {searchResults.length > 0 && (
                                            <Select onValueChange={(userId) => {
                                                const user = searchResults.find(u => u.id === userId);
                                                setSelectedUser(user);
                                            }}>
                                                <SelectTrigger className="w-full mt-2 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white">
                                                    <SelectValue placeholder="Select a user" />
                                                </SelectTrigger>
                                                <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                                                    {searchResults.map(user => (
                                                        <SelectItem key={user.id} value={user.id} className="text-gray-900 dark:text-white">
                                                            {user.email} ({user.username})
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )}
                                        {selectedUser && (
                                            <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded-md">
                                                Selected: {selectedUser.email} ({selectedUser.username})
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}

                            <div>
                                <Label className="text-gray-700 dark:text-gray-300">Role</Label>
                                <Select value={newAdminRole} onValueChange={(v: AdminRole) => setNewAdminRole(v)}>
                                    <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                                        <SelectItem value="moderator" className="text-gray-900 dark:text-white">Moderator</SelectItem>
                                        <SelectItem value="admin" className="text-gray-900 dark:text-white">Admin</SelectItem>
                                        <SelectItem value="super_admin" className="text-gray-900 dark:text-white">Super Admin</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button onClick={handleCreateAdmin} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                                Create Admin
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Total Admins</p>
                                <p className="text-3xl font-bold text-gray-900 dark:text-white">{totalAdmins}</p>
                            </div>
                            <div className="p-3 bg-blue-500/10 dark:bg-blue-500/20 rounded-lg">
                                <Shield className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Active</p>
                                <p className="text-3xl font-bold text-gray-900 dark:text-white">{activeAdmins}</p>
                            </div>
                            <div className="p-3 bg-green-500/10 dark:bg-green-500/20 rounded-lg">
                                <UserCheck className="h-8 w-8 text-green-600 dark:text-green-400" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Super Admins</p>
                                <p className="text-3xl font-bold text-gray-900 dark:text-white">{superAdmins}</p>
                            </div>
                            <div className="p-3 bg-red-500/10 dark:bg-red-500/20 rounded-lg">
                                <Crown className="h-8 w-8 text-red-600 dark:text-red-400" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Inactive</p>
                                <p className="text-3xl font-bold text-gray-900 dark:text-white">{totalAdmins - activeAdmins}</p>
                            </div>
                            <div className="p-3 bg-gray-500/10 dark:bg-gray-500/20 rounded-lg">
                                <UserX className="h-8 w-8 text-gray-600 dark:text-gray-400" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Role Distribution Chart */}
            <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                <CardHeader>
                    <CardTitle className="text-gray-900 dark:text-white">Role Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={roleDistribution}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ name, value }) => `${name}: ${value}`}
                                outerRadius={100}
                                fill="#8884d8"
                                dataKey="value"
                            >
                                {roleDistribution.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <RechartsTooltip
                                contentStyle={{
                                    backgroundColor: 'rgb(31 41 55)',
                                    border: '1px solid rgb(55 65 81)',
                                    borderRadius: '0.5rem',
                                    color: 'white'
                                }}
                            />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* Admin List */}
            <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                <CardHeader>
                    <CardTitle className="text-gray-900 dark:text-white">
                        <div className="flex items-center justify-between">
                            <span>Admin Users</span>
                            <div className="flex items-center gap-2">
                                <Input
                                    placeholder="Search by email..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="max-w-xs bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white"
                                />
                                <Select value={filterRole} onValueChange={(value) => setFilterRole(value as typeof filterRole)}>
                                    <SelectTrigger className="w-[180px] bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white">
                                        <Filter className="h-4 w-4 mr-2" />
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                                        <SelectItem value="all" className="text-gray-900 dark:text-white">All Roles</SelectItem>
                                        <SelectItem value="moderator" className="text-gray-900 dark:text-white">Moderator</SelectItem>
                                        <SelectItem value="admin" className="text-gray-900 dark:text-white">Admin</SelectItem>
                                        <SelectItem value="super_admin" className="text-gray-900 dark:text-white">Super Admin</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800">
                                    <TableHead className="text-gray-700 dark:text-gray-300">Email</TableHead>
                                    <TableHead className="text-gray-700 dark:text-gray-300">Role</TableHead>
                                    <TableHead className="text-gray-700 dark:text-gray-300">Status</TableHead>
                                    <TableHead className="text-gray-700 dark:text-gray-300">Last Login</TableHead>
                                    <TableHead className="text-gray-700 dark:text-gray-300">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredAdmins.map(admin => (
                                    <TableRow
                                        key={admin.id}
                                        className="border-b border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                                    >
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Mail className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                                                <span className="text-gray-900 dark:text-white">{admin.email}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge className={`flex items-center gap-1 w-fit ${getRoleBadgeColor(admin.role)}`}>
                                                {getRoleIcon(admin.role)}
                                                <span className="capitalize">{admin.role.replace('_', ' ')}</span>
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={admin.is_active ? 'default' : 'destructive'}
                                                className={admin.is_active
                                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800'
                                                    : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
                                                }
                                            >
                                                {admin.is_active ? 'Active' : 'Inactive'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Clock className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                                                <span className="text-gray-700 dark:text-gray-300">
                                                    {admin.last_login ? new Date(admin.last_login).toLocaleString() : 'Never'}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => toggleActive(admin.id, !admin.is_active)}
                                                className={`${admin.is_active
                                                    ? 'bg-white dark:bg-gray-800 border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                                                    : 'bg-white dark:bg-gray-800 border-green-300 dark:border-green-800 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20'
                                                    }`}
                                            >
                                                {admin.is_active ? 'Deactivate' : 'Activate'}
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default AdminManagement;