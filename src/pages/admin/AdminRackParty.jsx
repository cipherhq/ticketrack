import { useState, useEffect } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import {
  Search,
  MoreVertical,
  Calendar,
  Users,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
  Eye,
  Trash2,
  Ban,
  Clock,
  ExternalLink,
  PartyPopper,
  MapPin,
  HelpCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { supabase } from '@/lib/supabase';
import { useAdmin } from '@/contexts/AdminContext';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { toast } from 'sonner';

export function AdminRackParty() {
  const { logAdminAction, admin } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [parties, setParties] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedParty, setSelectedParty] = useState(null);
  const [actionDialog, setActionDialog] = useState(null);
  const [detailsDialog, setDetailsDialog] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [partyGuests, setPartyGuests] = useState([]);

  useEffect(() => {
    loadParties();
  }, []);

  const loadParties = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('party_invites')
        .select(`
          *,
          organizers (
            id,
            business_name,
            email
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const inviteIds = (data || []).map(p => p.id);

      const guestStatsRes = inviteIds.length > 0
        ? await supabase
            .from('party_invite_guests')
            .select('invite_id, rsvp_status')
            .in('invite_id', inviteIds)
        : { data: [] };

      // Aggregate guest stats per invite
      const guestStats = {};
      (guestStatsRes.data || []).forEach(g => {
        if (!guestStats[g.invite_id]) {
          guestStats[g.invite_id] = { total: 0, going: 0, pending: 0, maybe: 0, declined: 0 };
        }
        guestStats[g.invite_id].total += 1;
        const status = g.rsvp_status || 'pending';
        if (guestStats[g.invite_id][status] !== undefined) {
          guestStats[g.invite_id][status] += 1;
        }
      });

      const partiesWithStats = (data || []).map(party => ({
        ...party,
        guestTotal: guestStats[party.id]?.total || 0,
        guestGoing: guestStats[party.id]?.going || 0,
        guestPending: guestStats[party.id]?.pending || 0,
        guestMaybe: guestStats[party.id]?.maybe || 0,
        guestDeclined: guestStats[party.id]?.declined || 0,
      }));

      setParties(partiesWithStats);
    } catch (error) {
      console.error('Error loading parties:', error);
      toast.error('Failed to load parties');
    } finally {
      setLoading(false);
    }
  };

  const loadPartyDetails = async (party) => {
    try {
      const { data: guests } = await supabase
        .from('party_invite_guests')
        .select('id, name, email, phone, rsvp_status, plus_ones, email_sent_at, sms_sent_at, created_at')
        .eq('invite_id', party.id)
        .order('created_at', { ascending: false })
        .limit(50);

      setPartyGuests(guests || []);
    } catch (error) {
      console.error('Error loading party details:', error);
    }
  };

  const openDetailsDialog = async (party) => {
    setSelectedParty(party);
    setDetailsDialog(true);
    await loadPartyDetails(party);
  };

  const handleAction = (action, party) => {
    setSelectedParty(party);
    setActionDialog(action);
  };

  const confirmAction = async () => {
    if (!selectedParty) return;
    setProcessing(true);

    try {
      if (actionDialog === 'deactivate') {
        const { error } = await supabase
          .from('party_invites')
          .update({ is_active: false })
          .eq('id', selectedParty.id);
        if (error) throw error;
        await logAdminAction('rackparty_deactivated', 'party_invite', selectedParty.id, { title: selectedParty.title });
        toast.success('Party deactivated successfully!');
      } else if (actionDialog === 'reactivate') {
        const { error } = await supabase
          .from('party_invites')
          .update({ is_active: true })
          .eq('id', selectedParty.id);
        if (error) throw error;
        await logAdminAction('rackparty_reactivated', 'party_invite', selectedParty.id, { title: selectedParty.title });
        toast.success('Party reactivated successfully!');
      } else if (actionDialog === 'delete') {
        // Delete guests first
        await supabase.from('party_invite_guests').delete().eq('invite_id', selectedParty.id);

        const { error } = await supabase
          .from('party_invites')
          .delete()
          .eq('id', selectedParty.id);
        if (error) throw error;
        await logAdminAction('rackparty_deleted', 'party_invite', selectedParty.id, { title: selectedParty.title });
        toast.success('Party deleted successfully!');
      }

      setActionDialog(null);
      setSelectedParty(null);
      loadParties();
    } catch (error) {
      console.error('Action error:', error);
      toast.error(`Failed to perform action: ${error.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (isActive) => {
    if (isActive) {
      return <Badge className="bg-green-500 text-white rounded-lg">Active</Badge>;
    }
    return <Badge className="bg-gray-500 text-white rounded-lg">Inactive</Badge>;
  };

  const filteredParties = parties.filter((party) => {
    const matchesSearch = !debouncedSearch ||
      party.title?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      party.organizers?.business_name?.toLowerCase().includes(debouncedSearch.toLowerCase());
    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'active' && party.is_active) ||
      (statusFilter === 'inactive' && !party.is_active);
    return matchesSearch && matchesStatus;
  });

  const { currentPage, totalPages, totalItems, itemsPerPage, paginatedItems: paginatedParties, handlePageChange } = usePagination(filteredParties, 20);

  // Reset to page 1 when search or filter changes
  useEffect(() => {
    handlePageChange(1);
  }, [debouncedSearch, statusFilter]);

  const totalGuests = parties.reduce((sum, p) => sum + p.guestTotal, 0);
  const totalGoing = parties.reduce((sum, p) => sum + p.guestGoing, 0);

  const stats = {
    total: parties.length,
    active: parties.filter(p => p.is_active).length,
    totalGuests,
    totalGoing,
  };

  const isSuperAdmin = admin?.role === 'super_admin';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">RackParty Management</h2>
          <p className="text-muted-foreground mt-1">Manage all platform party invites</p>
        </div>
        <Button variant="outline" size="icon" onClick={loadParties} className="rounded-xl">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground mb-1">Total Parties</p>
                <h3 className="text-2xl font-semibold text-foreground">{stats.total}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#2969FF]/10 flex items-center justify-center">
                <PartyPopper className="w-5 h-5 text-[#2969FF]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground mb-1">Active</p>
                <h3 className="text-2xl font-semibold text-green-600">{stats.active}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground mb-1">Total Guests</p>
                <h3 className="text-2xl font-semibold text-purple-600">{stats.totalGuests.toLocaleString()}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-purple-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground mb-1">Total Going</p>
                <h3 className="text-2xl font-semibold text-emerald-600">{stats.totalGoing.toLocaleString()}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filter */}
      <Card className="border-border/10 rounded-2xl">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Search parties or organizers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-card border-border/10 rounded-xl"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Parties Table */}
      <Card className="border-border/10 rounded-2xl">
        <CardHeader>
          <CardTitle className="text-foreground">All Parties ({filteredParties.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/10">
                  <th className="text-left py-4 px-4 text-muted-foreground font-medium">Title</th>
                  <th className="text-left py-4 px-4 text-muted-foreground font-medium">Organizer</th>
                  <th className="text-left py-4 px-4 text-muted-foreground font-medium">Date</th>
                  <th className="text-left py-4 px-4 text-muted-foreground font-medium">Guests</th>
                  <th className="text-left py-4 px-4 text-muted-foreground font-medium">Going</th>
                  <th className="text-left py-4 px-4 text-muted-foreground font-medium">Status</th>
                  <th className="text-left py-4 px-4 text-muted-foreground font-medium">Created</th>
                  <th className="text-right py-4 px-4 text-muted-foreground font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedParties.map((party) => (
                  <tr key={party.id} className="border-b border-border/5 hover:bg-muted/50">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        {party.cover_image_url ? (
                          <img src={party.cover_image_url} alt={party.title} className="w-12 h-12 rounded-lg object-cover" />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center">
                            <PartyPopper className="w-6 h-6 text-purple-500" />
                          </div>
                        )}
                        <div>
                          <p className="text-foreground font-medium">{party.title || 'Untitled'}</p>
                          {party.venue_name && (
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <MapPin className="w-3 h-3" /> {party.venue_name}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <p className="text-foreground/80">{party.organizers?.business_name || 'Unknown'}</p>
                    </td>
                    <td className="py-4 px-4">
                      <p className="text-foreground/80">
                        {party.start_date ? new Date(party.start_date).toLocaleDateString() : 'TBD'}
                      </p>
                    </td>
                    <td className="py-4 px-4">
                      <p className="text-foreground/80">{party.guestTotal.toLocaleString()}</p>
                    </td>
                    <td className="py-4 px-4">
                      <p className="text-foreground/80">{party.guestGoing.toLocaleString()}</p>
                    </td>
                    <td className="py-4 px-4">{getStatusBadge(party.is_active)}</td>
                    <td className="py-4 px-4">
                      <p className="text-foreground/80 text-sm">
                        {new Date(party.created_at).toLocaleDateString()}
                      </p>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="rounded-xl">
                            <MoreVertical className="w-5 h-5 text-muted-foreground" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl">
                          <DropdownMenuItem onClick={() => openDetailsDialog(party)}>
                            <Eye className="w-4 h-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          {party.share_token && (
                            <DropdownMenuItem onClick={() => window.open(`/invite/${party.share_token}`, '_blank')}>
                              <ExternalLink className="w-4 h-4 mr-2" />
                              Open Public Link
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          {party.is_active ? (
                            <DropdownMenuItem onClick={() => handleAction('deactivate', party)}>
                              <Ban className="w-4 h-4 mr-2 text-orange-600" />
                              Deactivate
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => handleAction('reactivate', party)}>
                              <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                              Reactivate
                            </DropdownMenuItem>
                          )}
                          {isSuperAdmin && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-red-500"
                                onClick={() => handleAction('delete', party)}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete Party
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
                {filteredParties.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-muted-foreground">
                      No parties found
                    </td>
                  </tr>
                )}
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
        </CardContent>
      </Card>

      {/* Party Details Dialog */}
      <Dialog open={detailsDialog} onOpenChange={setDetailsDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>Party Details</DialogTitle>
          </DialogHeader>
          {selectedParty && (
            <div className="space-y-6 py-4">
              {/* Party Header */}
              <div className="flex gap-4">
                {selectedParty.cover_image_url ? (
                  <img src={selectedParty.cover_image_url} alt={selectedParty.title} className="w-32 h-32 rounded-2xl object-cover" />
                ) : (
                  <div className="w-32 h-32 rounded-2xl bg-purple-500/10 flex items-center justify-center">
                    <PartyPopper className="w-12 h-12 text-purple-500" />
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-2xl font-semibold text-foreground">{selectedParty.title || 'Untitled'}</h3>
                    {getStatusBadge(selectedParty.is_active)}
                  </div>
                  <p className="text-muted-foreground mb-2">{selectedParty.description || 'No description'}</p>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    {selectedParty.venue_name && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {[selectedParty.venue_name, selectedParty.city].filter(Boolean).join(', ')}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {selectedParty.start_date ? new Date(selectedParty.start_date).toLocaleDateString() : 'TBD'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Guest Stats */}
              <div className="grid grid-cols-5 gap-3">
                {[
                  { label: 'Total', count: selectedParty.guestTotal, color: 'text-[#2969FF]', bg: 'bg-[#2969FF]/10', icon: Users },
                  { label: 'Going', count: selectedParty.guestGoing, color: 'text-green-600', bg: 'bg-green-50', icon: CheckCircle },
                  { label: 'Maybe', count: selectedParty.guestMaybe, color: 'text-amber-600', bg: 'bg-amber-50', icon: HelpCircle },
                  { label: 'Pending', count: selectedParty.guestPending, color: 'text-blue-600', bg: 'bg-blue-50', icon: Clock },
                  { label: 'Declined', count: selectedParty.guestDeclined, color: 'text-gray-500', bg: 'bg-gray-50', icon: XCircle },
                ].map(s => (
                  <div key={s.label} className={`p-3 ${s.bg} rounded-xl text-center`}>
                    <s.icon className={`w-5 h-5 ${s.color} mx-auto mb-1`} />
                    <p className={`text-xl font-semibold ${s.color}`}>{s.count}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Party Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-muted rounded-xl">
                  <p className="text-sm text-muted-foreground mb-1">Organizer</p>
                  <p className="text-foreground">{selectedParty.organizers?.business_name || 'Unknown'}</p>
                  <p className="text-xs text-muted-foreground">{selectedParty.organizers?.email || 'N/A'}</p>
                </div>
                <div className="p-4 bg-muted rounded-xl">
                  <p className="text-sm text-muted-foreground mb-1">Start Date</p>
                  <p className="text-foreground">
                    {selectedParty.start_date ? new Date(selectedParty.start_date).toLocaleString() : 'TBD'}
                  </p>
                </div>
                <div className="p-4 bg-muted rounded-xl">
                  <p className="text-sm text-muted-foreground mb-1">RSVP Deadline</p>
                  <p className="text-foreground">
                    {selectedParty.rsvp_deadline ? new Date(selectedParty.rsvp_deadline).toLocaleString() : 'None'}
                  </p>
                </div>
                <div className="p-4 bg-muted rounded-xl">
                  <p className="text-sm text-muted-foreground mb-1">Plus-Ones</p>
                  <p className="text-foreground">
                    {selectedParty.allow_plus_ones ? `Allowed (max ${selectedParty.max_plus_ones || 1})` : 'Not allowed'}
                  </p>
                </div>
                <div className="p-4 bg-muted rounded-xl">
                  <p className="text-sm text-muted-foreground mb-1">Created</p>
                  <p className="text-foreground">{new Date(selectedParty.created_at).toLocaleDateString()}</p>
                </div>
                <div className="p-4 bg-muted rounded-xl">
                  <p className="text-sm text-muted-foreground mb-1">Party ID</p>
                  <p className="text-foreground text-xs font-mono">{selectedParty.id}</p>
                </div>
              </div>

              {/* Guest List Preview */}
              <div>
                <h4 className="text-sm font-medium text-foreground mb-3">Recent Guests ({partyGuests.length})</h4>
                {partyGuests.length === 0 ? (
                  <p className="text-center text-muted-foreground py-6">No guests yet</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {partyGuests.map((guest) => (
                      <div key={guest.id} className="flex items-center justify-between p-3 bg-muted rounded-xl">
                        <div>
                          <p className="text-foreground font-medium">{guest.name}</p>
                          <p className="text-sm text-muted-foreground">{guest.email || guest.phone || 'No contact'}</p>
                        </div>
                        <div className="text-right flex items-center gap-2">
                          <Badge className={
                            guest.rsvp_status === 'going' ? 'bg-green-100 text-green-700' :
                            guest.rsvp_status === 'maybe' ? 'bg-amber-100 text-amber-700' :
                            guest.rsvp_status === 'declined' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-700'
                          }>
                            {guest.rsvp_status || 'pending'}
                          </Badge>
                          {guest.plus_ones > 0 && (
                            <span className="text-xs text-muted-foreground">+{guest.plus_ones}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <div className="flex gap-3 pt-4 border-t border-border/10">
                {selectedParty.is_active ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDetailsDialog(false);
                      handleAction('deactivate', selectedParty);
                    }}
                    className="rounded-xl border-orange-200 text-orange-600 hover:bg-orange-50"
                  >
                    <Ban className="w-4 h-4 mr-2" />
                    Deactivate
                  </Button>
                ) : (
                  <Button
                    onClick={() => {
                      setDetailsDialog(false);
                      handleAction('reactivate', selectedParty);
                    }}
                    className="rounded-xl bg-green-500 hover:bg-green-600 text-white"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Reactivate
                  </Button>
                )}
                {isSuperAdmin && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDetailsDialog(false);
                      handleAction('delete', selectedParty);
                    }}
                    className="rounded-xl border-red-200 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Action Confirmation Dialog */}
      <Dialog open={!!actionDialog} onOpenChange={() => setActionDialog(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {actionDialog === 'deactivate' && 'Deactivate Party'}
              {actionDialog === 'reactivate' && 'Reactivate Party'}
              {actionDialog === 'delete' && 'Delete Party'}
            </DialogTitle>
            <DialogDescription>
              {actionDialog === 'deactivate' &&
                `Are you sure you want to deactivate "${selectedParty?.title}"? The public invite link will stop working.`}
              {actionDialog === 'reactivate' &&
                `Are you sure you want to reactivate "${selectedParty?.title}"? The public invite link will work again.`}
              {actionDialog === 'delete' &&
                `Are you sure you want to delete "${selectedParty?.title}"? This action cannot be undone and will remove all guest data.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setActionDialog(null)}
              className="rounded-xl border-border/10"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmAction}
              disabled={processing}
              className={`rounded-xl ${
                actionDialog === 'delete' ? 'bg-red-500 hover:bg-red-600' :
                actionDialog === 'deactivate' ? 'bg-orange-500 hover:bg-orange-600' :
                'bg-[#2969FF] hover:bg-[#2969FF]/90'
              } text-white`}
            >
              {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
