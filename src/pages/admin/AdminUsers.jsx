import { useState, useEffect } from 'react';
import {
  Search, Loader2, RefreshCw, Users, UserCheck, UserX, Ban, Shield,
  Mail, Phone, Calendar, MoreVertical, Eye, Edit, Trash2, Download,
  CheckCircle, Clock, XCircle, AlertTriangle, Filter, ChevronDown
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase';
import { useAdmin } from '@/contexts/AdminContext';
import { Pagination, usePagination } from '@/components/ui/pagination';

const USER_TYPES = {
  all: { label: 'All Users', icon: Users },
  attendee: { label: 'Attendees', icon: Users },
  organizer: { label: 'Organizers', icon: UserCheck },
  promoter: { label: 'Promoters', icon: UserCheck },
  affiliate: { label: 'Affiliates', icon: UserCheck },
  admin: { label: 'Admins', icon: Shield },
};

const STATUS_OPTIONS = {
  all: 'All Status',
  active: 'Active',
  suspended: 'Suspended',
  banned: 'Banned',
  pending: 'Pending',
};

export function AdminUsers() {
  const { admin, logAdminAction } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    suspended: 0,
    organizers: 0,
    newThisMonth: 0,
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [userTypeFilter, setUserTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState(null);
  const [actionReason, setActionReason] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      // Load profiles with related data
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          email,
          phone,
          avatar_url,
          is_admin,
          admin_role,
          is_suspended,
          is_banned,
          created_at,
          last_sign_in_at,
          email_verified
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Load organizers
      const { data: organizers } = await supabase
        .from('organizers')
        .select('user_id, business_name, is_verified, kyc_status');

      // Load promoters
      const { data: promoters } = await supabase
        .from('promoters')
        .select('user_id, status');

      // Load affiliates (users with referral codes)
      const { data: affiliates } = await supabase
        .from('profiles')
        .select('id, referral_code')
        .not('referral_code', 'is', null);

      // Enrich profiles with role info
      const enrichedUsers = (profiles || []).map(profile => {
        const organizer = organizers?.find(o => o.user_id === profile.id);
        const promoter = promoters?.find(p => p.user_id === profile.id);
        const isAffiliate = affiliates?.some(a => a.id === profile.id);

        const roles = [];
        if (profile.is_admin) roles.push('admin');
        if (organizer) roles.push('organizer');
        if (promoter) roles.push('promoter');
        if (isAffiliate) roles.push('affiliate');
        if (roles.length === 0) roles.push('attendee');

        let status = 'active';
        if (profile.is_banned) status = 'banned';
        else if (profile.is_suspended) status = 'suspended';
        else if (!profile.email_verified) status = 'pending';

        return {
          ...profile,
          roles,
          primaryRole: roles[0],
          status,
          organizer,
          promoter,
        };
      });

      setUsers(enrichedUsers);

      // Calculate stats
      const now = new Date();
      const monthAgo = new Date(now.getFullYear(), now.getMonth(), 1);
      
      setStats({
        total: enrichedUsers.length,
        active: enrichedUsers.filter(u => u.status === 'active').length,
        suspended: enrichedUsers.filter(u => u.status === 'suspended' || u.status === 'banned').length,
        organizers: enrichedUsers.filter(u => u.roles.includes('organizer')).length,
        newThisMonth: enrichedUsers.filter(u => new Date(u.created_at) >= monthAgo).length,
      });

    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter users
  const filteredUsers = users.filter(user => {
    const matchesSearch = !searchTerm || 
      user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.phone?.includes(searchTerm);
    
    const matchesType = userTypeFilter === 'all' || user.roles.includes(userTypeFilter);
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;

    return matchesSearch && matchesType && matchesStatus;
  });

  // Pagination
  const {
    currentPage,
    totalPages,
    totalItems,
    itemsPerPage,
    paginatedItems,
    handlePageChange,
  } = usePagination(filteredUsers, 20);

  const openActionDialog = (user, action) => {
    setSelectedUser(user);
    setActionType(action);
    setActionReason('');
    setActionDialogOpen(true);
  };

  const handleAction = async () => {
    if (!selectedUser || !actionType) return;
    setProcessing(true);

    try {
      let updates = {};
      
      switch (actionType) {
        case 'suspend':
          updates = { is_suspended: true };
          break;
        case 'unsuspend':
          updates = { is_suspended: false };
          break;
        case 'ban':
          updates = { is_banned: true, is_suspended: true };
          break;
        case 'unban':
          updates = { is_banned: false, is_suspended: false };
          break;
        case 'verify':
          updates = { email_verified: true };
          break;
        case 'make_admin':
          updates = { is_admin: true, admin_role: 'admin' };
          break;
        case 'remove_admin':
          updates = { is_admin: false, admin_role: null };
          break;
        default:
          throw new Error('Unknown action');
      }

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', selectedUser.id);

      if (error) throw error;

      // Log admin action
      await logAdminAction('user_management', actionType, {
        userId: selectedUser.id,
        userEmail: selectedUser.email,
        reason: actionReason,
      });

      setActionDialogOpen(false);
      loadUsers();
    } catch (error) {
      console.error('Action error:', error);
      alert('Failed to perform action: ' + error.message);
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-700">Active</Badge>;
      case 'suspended':
        return <Badge className="bg-orange-100 text-orange-700">Suspended</Badge>;
      case 'banned':
        return <Badge className="bg-red-100 text-red-700">Banned</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-700">Pending</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-700">{status}</Badge>;
    }
  };

  const getRoleBadges = (roles) => {
    return roles.map(role => {
      const colors = {
        admin: 'bg-purple-100 text-purple-700',
        organizer: 'bg-blue-100 text-blue-700',
        promoter: 'bg-cyan-100 text-cyan-700',
        affiliate: 'bg-pink-100 text-pink-700',
        attendee: 'bg-gray-100 text-gray-700',
      };
      return (
        <Badge key={role} className={`${colors[role]} capitalize mr-1`}>
          {role}
        </Badge>
      );
    });
  };

  const exportUsers = () => {
    const csv = [
      ['Name', 'Email', 'Phone', 'Roles', 'Status', 'Created', 'Last Login'],
      ...filteredUsers.map(u => [
        u.full_name || '',
        u.email || '',
        u.phone || '',
        u.roles.join(', '),
        u.status,
        new Date(u.created_at).toLocaleDateString(),
        u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString() : 'Never',
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#0F0F0F]">User Management</h1>
          <p className="text-[#0F0F0F]/60">Manage all users on the platform</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadUsers} className="rounded-xl border-[#0F0F0F]/10">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={exportUsers} className="rounded-xl border-[#0F0F0F]/10">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Total Users</p>
                <p className="text-2xl font-semibold text-[#0F0F0F]">{stats.total.toLocaleString()}</p>
              </div>
              <Users className="w-8 h-8 text-[#2969FF]" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Active</p>
                <p className="text-2xl font-semibold text-green-600">{stats.active.toLocaleString()}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Suspended</p>
                <p className="text-2xl font-semibold text-orange-600">{stats.suspended}</p>
              </div>
              <Ban className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Organizers</p>
                <p className="text-2xl font-semibold text-blue-600">{stats.organizers}</p>
              </div>
              <UserCheck className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#0F0F0F]/60">New This Month</p>
                <p className="text-2xl font-semibold text-[#2969FF]">{stats.newThisMonth}</p>
              </div>
              <Calendar className="w-8 h-8 text-[#2969FF]" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0F0F0F]/40" />
              <Input
                placeholder="Search by name, email, or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 rounded-xl h-10 border-[#0F0F0F]/10"
              />
            </div>
            <Select value={userTypeFilter} onValueChange={setUserTypeFilter}>
              <SelectTrigger className="w-[180px] rounded-xl border-[#0F0F0F]/10">
                <SelectValue placeholder="User Type" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {Object.entries(USER_TYPES).map(([key, { label }]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px] rounded-xl border-[#0F0F0F]/10">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {Object.entries(STATUS_OPTIONS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardHeader>
          <CardTitle className="text-[#0F0F0F]">
            Users ({filteredUsers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {paginatedItems.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-[#0F0F0F]/20 mx-auto mb-4" />
              <p className="text-[#0F0F0F]/60">No users found</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#0F0F0F]/10">
                      <th className="text-left py-3 px-4 text-sm font-medium text-[#0F0F0F]/60">User</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-[#0F0F0F]/60">Contact</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-[#0F0F0F]/60">Roles</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-[#0F0F0F]/60">Status</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-[#0F0F0F]/60">Joined</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-[#0F0F0F]/60">Last Login</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-[#0F0F0F]/60">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedItems.map((user) => (
                      <tr key={user.id} className="border-b border-[#0F0F0F]/5 hover:bg-[#F4F6FA]/50">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-[#2969FF] flex items-center justify-center text-white font-medium">
                              {user.avatar_url ? (
                                <img src={user.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                              ) : (
                                user.full_name?.charAt(0) || user.email?.charAt(0) || '?'
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-[#0F0F0F]">{user.full_name || 'Unnamed'}</p>
                              <p className="text-xs text-[#0F0F0F]/50">ID: {user.id.slice(0, 8)}...</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-sm">
                            <p className="text-[#0F0F0F] flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {user.email}
                            </p>
                            {user.phone && (
                              <p className="text-[#0F0F0F]/60 flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {user.phone}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1">
                            {getRoleBadges(user.roles)}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {getStatusBadge(user.status)}
                        </td>
                        <td className="py-3 px-4 text-sm text-[#0F0F0F]/60">
                          {new Date(user.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-sm text-[#0F0F0F]/60">
                          {user.last_sign_in_at 
                            ? new Date(user.last_sign_in_at).toLocaleDateString()
                            : 'Never'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="rounded-xl">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-xl">
                              <DropdownMenuItem onClick={() => { setSelectedUser(user); setDetailsOpen(true); }}>
                                <Eye className="w-4 h-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {user.status === 'pending' && (
                                <DropdownMenuItem onClick={() => openActionDialog(user, 'verify')}>
                                  <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                                  Verify Email
                                </DropdownMenuItem>
                              )}
                              {user.status === 'active' && (
                                <DropdownMenuItem onClick={() => openActionDialog(user, 'suspend')}>
                                  <UserX className="w-4 h-4 mr-2 text-orange-600" />
                                  Suspend User
                                </DropdownMenuItem>
                              )}
                              {user.status === 'suspended' && (
                                <>
                                  <DropdownMenuItem onClick={() => openActionDialog(user, 'unsuspend')}>
                                    <UserCheck className="w-4 h-4 mr-2 text-green-600" />
                                    Unsuspend User
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => openActionDialog(user, 'ban')} className="text-red-600">
                                    <Ban className="w-4 h-4 mr-2" />
                                    Ban User
                                  </DropdownMenuItem>
                                </>
                              )}
                              {user.status === 'banned' && (
                                <DropdownMenuItem onClick={() => openActionDialog(user, 'unban')}>
                                  <UserCheck className="w-4 h-4 mr-2 text-green-600" />
                                  Unban User
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              {!user.is_admin ? (
                                <DropdownMenuItem onClick={() => openActionDialog(user, 'make_admin')}>
                                  <Shield className="w-4 h-4 mr-2 text-purple-600" />
                                  Make Admin
                                </DropdownMenuItem>
                              ) : user.id !== admin.id && (
                                <DropdownMenuItem onClick={() => openActionDialog(user, 'remove_admin')} className="text-red-600">
                                  <Shield className="w-4 h-4 mr-2" />
                                  Remove Admin
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
                onPageChange={handlePageChange}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* User Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-[#2969FF] flex items-center justify-center text-white text-2xl font-medium">
                  {selectedUser.avatar_url ? (
                    <img src={selectedUser.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    selectedUser.full_name?.charAt(0) || selectedUser.email?.charAt(0) || '?'
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-semibold">{selectedUser.full_name || 'Unnamed'}</h3>
                  <p className="text-[#0F0F0F]/60">{selectedUser.email}</p>
                  <div className="flex gap-2 mt-2">
                    {getRoleBadges(selectedUser.roles)}
                    {getStatusBadge(selectedUser.status)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-[#F4F6FA]">
                  <p className="text-sm text-[#0F0F0F]/60">Phone</p>
                  <p className="font-medium">{selectedUser.phone || 'Not provided'}</p>
                </div>
                <div className="p-4 rounded-xl bg-[#F4F6FA]">
                  <p className="text-sm text-[#0F0F0F]/60">User ID</p>
                  <p className="font-medium font-mono text-sm">{selectedUser.id}</p>
                </div>
                <div className="p-4 rounded-xl bg-[#F4F6FA]">
                  <p className="text-sm text-[#0F0F0F]/60">Joined</p>
                  <p className="font-medium">{new Date(selectedUser.created_at).toLocaleString()}</p>
                </div>
                <div className="p-4 rounded-xl bg-[#F4F6FA]">
                  <p className="text-sm text-[#0F0F0F]/60">Last Login</p>
                  <p className="font-medium">
                    {selectedUser.last_sign_in_at 
                      ? new Date(selectedUser.last_sign_in_at).toLocaleString() 
                      : 'Never'}
                  </p>
                </div>
              </div>

              {selectedUser.organizer && (
                <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">
                  <h4 className="font-medium text-blue-900 mb-2">Organizer Details</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-blue-600">Business Name</p>
                      <p className="font-medium text-blue-900">{selectedUser.organizer.business_name}</p>
                    </div>
                    <div>
                      <p className="text-blue-600">KYC Status</p>
                      <p className="font-medium text-blue-900 capitalize">{selectedUser.organizer.kyc_status || 'Not submitted'}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Action Confirmation Dialog */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {actionType === 'ban' && <Ban className="w-5 h-5 text-red-600" />}
              {actionType === 'suspend' && <UserX className="w-5 h-5 text-orange-600" />}
              {actionType === 'unsuspend' && <UserCheck className="w-5 h-5 text-green-600" />}
              {actionType === 'unban' && <UserCheck className="w-5 h-5 text-green-600" />}
              {actionType === 'verify' && <CheckCircle className="w-5 h-5 text-green-600" />}
              {actionType === 'make_admin' && <Shield className="w-5 h-5 text-purple-600" />}
              {actionType === 'remove_admin' && <Shield className="w-5 h-5 text-red-600" />}
              Confirm Action
            </DialogTitle>
            <DialogDescription>
              {actionType === 'ban' && `Are you sure you want to permanently ban ${selectedUser?.full_name || selectedUser?.email}?`}
              {actionType === 'suspend' && `Are you sure you want to suspend ${selectedUser?.full_name || selectedUser?.email}?`}
              {actionType === 'unsuspend' && `Are you sure you want to unsuspend ${selectedUser?.full_name || selectedUser?.email}?`}
              {actionType === 'unban' && `Are you sure you want to unban ${selectedUser?.full_name || selectedUser?.email}?`}
              {actionType === 'verify' && `Mark ${selectedUser?.email} as verified?`}
              {actionType === 'make_admin' && `Grant admin privileges to ${selectedUser?.full_name || selectedUser?.email}?`}
              {actionType === 'remove_admin' && `Remove admin privileges from ${selectedUser?.full_name || selectedUser?.email}?`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Reason (optional)</Label>
              <Textarea
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder="Enter reason for this action..."
                className="rounded-xl mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialogOpen(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button 
              onClick={handleAction} 
              disabled={processing}
              className={`rounded-xl ${
                actionType === 'ban' || actionType === 'remove_admin' 
                  ? 'bg-red-600 hover:bg-red-700' 
                  : 'bg-[#2969FF] hover:bg-[#1e4fd6]'
              }`}
            >
              {processing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
