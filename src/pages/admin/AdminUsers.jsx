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


export function AdminUsers() {
  const { admin, logAdminAction } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [allUsersData, setAllUsersData] = useState([]);
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
  }, []);

  useEffect(() => {
    if (organizerUserIds !== null) {
      loadUsers();
    }
  }, [organizerUserIds]);

  // Re-filter when filters/page change (no refetch needed)
  useEffect(() => {
    applyFilters();
  }, [allUsersData, userTypeFilter, searchTerm, page]);

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

  const loadUsers = async () => {
    setLoading(true);
    try {
      // Fetch profiles and ticket attendees in parallel
      const [profilesResult, ticketsResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, email, phone, avatar_url, is_admin, admin_role, created_at')
          .order('created_at', { ascending: false }),
        supabase
          .from('tickets')
          .select('attendee_name, attendee_email, attendee_phone, created_at')
          .in('payment_status', ['completed', 'paid'])
          .order('created_at', { ascending: false }),
      ]);

      const profiles = profilesResult.data || [];
      const tickets = ticketsResult.data || [];

      // Build profile email set for deduplication
      const profileEmailSet = new Set();
      profiles.forEach(p => {
        if (p.email) profileEmailSet.add(p.email.toLowerCase().trim());
      });

      // Extract unique guest attendees (ticket buyers without profiles)
      const guestMap = new Map();
      tickets.forEach(t => {
        if (!t.attendee_email) return;
        const emailKey = t.attendee_email.toLowerCase().trim();
        if (profileEmailSet.has(emailKey)) return;
        if (guestMap.has(emailKey)) return;
        guestMap.set(emailKey, {
          id: `guest-${emailKey}`,
          full_name: t.attendee_name || 'Guest',
          email: t.attendee_email,
          phone: t.attendee_phone || '',
          avatar_url: null,
          is_admin: false,
          admin_role: null,
          created_at: t.created_at,
          isGuest: true,
          roles: ['attendee'],
          primaryRole: 'attendee',
          status: 'active',
        });
      });

      // Enrich profiles with role data
      const enrichedProfiles = profiles.map(profile => {
        const organizer = organizerMap[profile.id];
        const promoter = promoterMap[profile.id];
        const roles = [];
        if (profile.is_admin) roles.push('admin');
        if (organizer) roles.push('organizer');
        if (promoter) roles.push('promoter');
        if (roles.length === 0) roles.push('attendee');
        return { ...profile, roles, primaryRole: roles[0], status: 'active', organizer, promoter, isGuest: false };
      });

      // Combine and sort by newest first
      const combined = [...enrichedProfiles, ...Array.from(guestMap.values())];
      combined.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      setAllUsersData(combined);

      // Update stats
      const organizers = combined.filter(u => u.roles.includes('organizer')).length;
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      setStats({
        total: combined.length,
        attendees: combined.length - organizers,
        organizers,
        newThisMonth: combined.filter(u => new Date(u.created_at) >= monthStart).length,
      });
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...allUsersData];

    // Tab filter
    if (userTypeFilter === 'attendee' && organizerUserIds && organizerUserIds.length > 0) {
      filtered = filtered.filter(u => !organizerUserIds.includes(u.id));
    } else if (userTypeFilter === 'organizer') {
      filtered = filtered.filter(u => organizerUserIds?.includes(u.id));
    }

    // Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(u =>
        u.full_name?.toLowerCase().includes(term) ||
        u.email?.toLowerCase().includes(term) ||
        u.phone?.includes(searchTerm)
      );
    }

    setTotalCount(filtered.length);
    const from = (page - 1) * PAGE_SIZE;
    setUsers(filtered.slice(from, from + PAGE_SIZE));
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

  const getStatusBadge = () => {
    return <Badge className="bg-green-100 text-green-700">Active</Badge>;
  };

  const getRoleBadges = (user) => {
    return user.roles.map(role => {
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
    }).concat(user.isGuest ? [
      <Badge key="guest" className="bg-orange-100 text-orange-700 mr-1">Guest</Badge>
    ] : []);
  };

  const exportUsers = () => {
    // Use already-filtered in-memory data
    let filtered = [...allUsersData];

    if (userTypeFilter === 'attendee' && organizerUserIds?.length > 0) {
      filtered = filtered.filter(u => !organizerUserIds.includes(u.id));
    } else if (userTypeFilter === 'organizer') {
      filtered = filtered.filter(u => organizerUserIds?.includes(u.id));
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(u =>
        u.full_name?.toLowerCase().includes(term) ||
        u.email?.toLowerCase().includes(term) ||
        u.phone?.includes(searchTerm)
      );
    }

    if (filtered.length === 0) return;

    const csv = [
      ['Name', 'Email', 'Phone', 'Type', 'Source', 'Joined'],
      ...filtered.map(u => {
        const type = u.roles.includes('organizer') ? 'Organizer' : u.roles.includes('admin') ? 'Admin' : 'Attendee';
        return [
          u.full_name || '',
          u.email || '',
          u.phone || '',
          type,
          u.isGuest ? 'Guest (Ticket Purchase)' : 'Registered',
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
          <Button variant="outline" onClick={() => { loadRoleData(); }} className="rounded-xl border-border/10">
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
                              <p className="text-xs text-muted-foreground">{user.isGuest ? 'Guest' : `ID: ${user.id.slice(0, 8)}...`}</p>
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
                            {getRoleBadges(user)}
                          </div>
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
                              {!user.isGuest && (
                                <>
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
                                </>
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
                    {getRoleBadges(selectedUser)}
                    {getStatusBadge()}
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
                  <p className="font-medium font-mono text-sm">{selectedUser.isGuest ? 'Guest (Ticket Purchase)' : selectedUser.id}</p>
                </div>
                <div className="p-4 rounded-xl bg-muted">
                  <p className="text-sm text-muted-foreground">Joined</p>
                  <p className="font-medium">{new Date(selectedUser.created_at).toLocaleString()}</p>
                </div>
                <div className="p-4 rounded-xl bg-muted">
                  <p className="text-sm text-muted-foreground">Email Verified</p>
                  <p className="font-medium">Active</p>
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
              {actionType === 'make_admin' && <Shield className="w-5 h-5 text-purple-600" />}
              {actionType === 'remove_admin' && <Shield className="w-5 h-5 text-red-600" />}
              Confirm Action
            </DialogTitle>
            <DialogDescription>
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
