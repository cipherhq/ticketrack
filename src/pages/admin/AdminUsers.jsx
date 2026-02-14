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
import { Pagination } from '@/components/ui/pagination';

const USER_TYPES = {
  attendee: { label: 'All Users', icon: Users },
  organizer: { label: 'Organizers', icon: UserCheck },
};

const PAGE_SIZE = 20;

const STATUS_OPTIONS = {
  all: 'All Status',
  active: 'Active',
  pending: 'Pending',
};

export function AdminUsers() {
  const { admin, logAdminAction } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [stats, setStats] = useState({
    total: 0,
    attendees: 0,
    organizers: 0,
    newThisMonth: 0,
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [userTypeFilter, setUserTypeFilter] = useState('attendee');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState(null);
  const [actionReason, setActionReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [organizerUserIds, setOrganizerUserIds] = useState(null);
  const [organizerMap, setOrganizerMap] = useState({});
  const [promoterMap, setPromoterMap] = useState({});

  useEffect(() => {
    loadRoleData();
    loadStats();
  }, []);

  useEffect(() => {
    if (organizerUserIds !== null) {
      loadUsers();
    }
  }, [page, userTypeFilter, statusFilter, searchTerm, organizerUserIds]);

  const loadRoleData = async () => {
    try {
      const [orgResult, promoResult] = await Promise.all([
        supabase.from('organizers').select('user_id, business_name, is_verified, kyc_status'),
        supabase.from('promoters').select('user_id, status'),
      ]);

      const orgMap = {};
      const orgIds = [];
      orgResult.data?.forEach(o => {
        orgMap[o.user_id] = o;
        orgIds.push(o.user_id);
      });
      setOrganizerMap(orgMap);
      setOrganizerUserIds(orgIds);

      const promoMap = {};
      promoResult.data?.forEach(p => { promoMap[p.user_id] = p; });
      setPromoterMap(promoMap);
    } catch (error) {
      console.error('Error loading role data:', error);
      setOrganizerUserIds([]);
    }
  };

  const loadStats = async () => {
    try {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const [totalResult, orgResult, newResult] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('organizers').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', monthStart.toISOString()),
      ]);

      const total = totalResult.count || 0;
      const organizers = orgResult.count || 0;
      setStats({
        total,
        attendees: total - organizers,
        organizers,
        newThisMonth: newResult.count || 0,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('profiles')
        .select(`
          id, full_name, email, phone, avatar_url, is_admin, admin_role,
          created_at, email_verified
        `, { count: 'exact' })
        .order('created_at', { ascending: false });

      // Tab-based role filter
      if (userTypeFilter === 'attendee' && organizerUserIds.length > 0) {
        query = query.not('id', 'in', `(${organizerUserIds.join(',')})`);
      } else if (userTypeFilter === 'organizer') {
        if (organizerUserIds.length === 0) {
          setUsers([]);
          setTotalCount(0);
          setLoading(false);
          return;
        }
        query = query.in('id', organizerUserIds);
      }

      // Server-side search
      if (searchTerm.trim()) {
        query = query.or(`full_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`);
      }

      // Server-side status filter
      if (statusFilter === 'active') {
        query = query.eq('email_verified', true);
      } else if (statusFilter === 'pending') {
        query = query.eq('email_verified', false);
      }

      // Pagination
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data: profiles, count, error } = await query.range(from, to);

      if (error) throw error;

      // Enrich with role data
      const enrichedUsers = (profiles || []).map(profile => {
        const organizer = organizerMap[profile.id];
        const promoter = promoterMap[profile.id];

        const roles = [];
        if (profile.is_admin) roles.push('admin');
        if (organizer) roles.push('organizer');
        if (promoter) roles.push('promoter');
        if (roles.length === 0) roles.push('attendee');

        let status = 'active';
        if (!profile.email_verified) status = 'pending';

        return { ...profile, roles, primaryRole: roles[0], status, organizer, promoter };
      });

      setUsers(enrichedUsers);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

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
      loadStats();
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
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-700">Pending</Badge>;
      default:
        return <Badge className="bg-muted text-foreground/80">{status}</Badge>;
    }
  };

  const getRoleBadges = (roles) => {
    return roles.map(role => {
      const colors = {
        admin: 'bg-purple-100 text-purple-700',
        organizer: 'bg-blue-100 text-blue-700',
        promoter: 'bg-cyan-100 text-cyan-700',
        affiliate: 'bg-pink-100 text-pink-700',
        attendee: 'bg-muted text-foreground/80',
      };
      return (
        <Badge key={role} className={`${colors[role]} capitalize mr-1`}>
          {role}
        </Badge>
      );
    });
  };

  const exportUsers = async () => {
    try {
      let query = supabase
        .from('profiles')
        .select('id, full_name, email, phone, is_admin, created_at, email_verified')
        .order('created_at', { ascending: false });

      if (userTypeFilter === 'attendee' && organizerUserIds && organizerUserIds.length > 0) {
        query = query.not('id', 'in', `(${organizerUserIds.join(',')})`);
      } else if (userTypeFilter === 'organizer' && organizerUserIds && organizerUserIds.length > 0) {
        query = query.in('id', organizerUserIds);
      }

      if (searchTerm.trim()) {
        query = query.or(`full_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      if (!data || data.length === 0) return;

      const csv = [
        ['Name', 'Email', 'Phone', 'Type', 'Status', 'Created'],
        ...data.map(u => {
          const isOrg = organizerMap[u.id];
          const type = isOrg ? 'Organizer' : 'Attendee';
          let status = 'Active';
          if (!u.email_verified) status = 'Pending';
          return [
            u.full_name || '',
            u.email || '',
            u.phone || '',
            type,
            status,
            new Date(u.created_at).toLocaleDateString(),
          ];
        })
      ].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `users-export-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export error:', error);
    }
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
          <h1 className="text-2xl font-semibold text-foreground">User Management</h1>
          <p className="text-muted-foreground">Manage all users on the platform</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { loadRoleData(); loadStats(); }} className="rounded-xl border-border/10">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={exportUsers} className="rounded-xl border-border/10">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border/10 rounded-2xl">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Users</p>
                <p className="text-2xl font-semibold text-foreground">{stats.total.toLocaleString()}</p>
              </div>
              <Users className="w-8 h-8 text-[#2969FF]" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/10 rounded-2xl">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Attendees</p>
                <p className="text-2xl font-semibold text-green-600">{stats.attendees.toLocaleString()}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/10 rounded-2xl">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Organizers</p>
                <p className="text-2xl font-semibold text-blue-600">{stats.organizers.toLocaleString()}</p>
              </div>
              <UserCheck className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/10 rounded-2xl">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">New This Month</p>
                <p className="text-2xl font-semibold text-[#2969FF]">{stats.newThisMonth.toLocaleString()}</p>
              </div>
              <Calendar className="w-8 h-8 text-[#2969FF]" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-border/10 rounded-2xl">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or phone..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                className="pl-10 rounded-xl h-10 border-border/10"
              />
            </div>
            <div className="flex gap-1 bg-muted rounded-xl p-1">
              {Object.entries(USER_TYPES).map(([key, { label }]) => (
                <button
                  key={key}
                  onClick={() => { setUserTypeFilter(key); setPage(1); }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    userTypeFilter === key
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[150px] rounded-xl border-border/10">
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
      <Card className="border-border/10 rounded-2xl">
        <CardHeader>
          <CardTitle className="text-foreground">
            {userTypeFilter === 'organizer' ? 'Organizers' : 'Users'} ({totalCount.toLocaleString()})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-foreground/20 mx-auto mb-4" />
              <p className="text-muted-foreground">No users found</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/10">
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">User</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Contact</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Roles</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Joined</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} className="border-b border-border/5 hover:bg-muted/50">
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
                              <p className="font-medium text-foreground">{user.full_name || 'Unnamed'}</p>
                              <p className="text-xs text-muted-foreground">ID: {user.id.slice(0, 8)}...</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-sm">
                            <p className="text-foreground flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {user.email}
                            </p>
                            {user.phone && (
                              <p className="text-muted-foreground flex items-center gap-1">
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
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          {new Date(user.created_at).toLocaleDateString()}
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
                currentPage={page}
                totalPages={Math.ceil(totalCount / PAGE_SIZE)}
                totalItems={totalCount}
                itemsPerPage={PAGE_SIZE}
                onPageChange={setPage}
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
                  <p className="text-muted-foreground">{selectedUser.email}</p>
                  <div className="flex gap-2 mt-2">
                    {getRoleBadges(selectedUser.roles)}
                    {getStatusBadge(selectedUser.status)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-muted">
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium">{selectedUser.phone || 'Not provided'}</p>
                </div>
                <div className="p-4 rounded-xl bg-muted">
                  <p className="text-sm text-muted-foreground">User ID</p>
                  <p className="font-medium font-mono text-sm">{selectedUser.id}</p>
                </div>
                <div className="p-4 rounded-xl bg-muted">
                  <p className="text-sm text-muted-foreground">Joined</p>
                  <p className="font-medium">{new Date(selectedUser.created_at).toLocaleString()}</p>
                </div>
                <div className="p-4 rounded-xl bg-muted">
                  <p className="text-sm text-muted-foreground">Email Verified</p>
                  <p className="font-medium">{selectedUser.email_verified ? 'Yes' : 'No'}</p>
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
              {actionType === 'verify' && <CheckCircle className="w-5 h-5 text-green-600" />}
              {actionType === 'make_admin' && <Shield className="w-5 h-5 text-purple-600" />}
              {actionType === 'remove_admin' && <Shield className="w-5 h-5 text-red-600" />}
              Confirm Action
            </DialogTitle>
            <DialogDescription>
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
                actionType === 'remove_admin'
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
