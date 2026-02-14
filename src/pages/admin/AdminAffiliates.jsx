import { useState, useEffect } from 'react';
import { formatPrice } from "@/config/currencies";
import {
  Search,
  MoreVertical,
  Loader2,
  RefreshCw,
  Users,
  DollarSign,
  TrendingUp,
  Link2,
  CheckCircle,
  XCircle,
  Eye,
  Wallet,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle, DialogDescription,
  DialogFooter,
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

export function AdminAffiliates() {
  const { logAdminAction } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [affiliates, setAffiliates] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedAffiliate, setSelectedAffiliate] = useState(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadAffiliates();
  }, []);

  const loadAffiliates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('promoters')
        .select(`
          *,
          organizers (
            id,
            business_name
          ),
          events (
            id,
            title,
            currency
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAffiliates(data || []);
    } catch (error) {
      console.error('Error loading affiliates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async () => {
    if (!selectedAffiliate) return;
    setProcessing(true);

    try {
      if (actionType === 'approve') {
        const { error } = await supabase
          .from('promoters')
          .update({ status: 'approved', is_active: true })
          .eq('id', selectedAffiliate.id);
        if (error) throw error;
        await logAdminAction('affiliate_approved', 'promoter', selectedAffiliate.id);
        alert('Affiliate approved successfully');
      } else if (actionType === 'suspend') {
        const { error } = await supabase
          .from('promoters')
          .update({ is_active: false })
          .eq('id', selectedAffiliate.id);
        if (error) throw error;
        await logAdminAction('affiliate_suspended', 'promoter', selectedAffiliate.id);
        alert('Affiliate suspended');
      } else if (actionType === 'activate') {
        const { error } = await supabase
          .from('promoters')
          .update({ is_active: true })
          .eq('id', selectedAffiliate.id);
        if (error) throw error;
        await logAdminAction('affiliate_activated', 'promoter', selectedAffiliate.id);
        alert('Affiliate activated');
      } else if (actionType === 'payout') {
        // Mark commission as paid
        const { error } = await supabase
          .from('promoters')
          .update({ 
            paid_commission: selectedAffiliate.total_commission,
          })
          .eq('id', selectedAffiliate.id);
        if (error) throw error;
        await logAdminAction('affiliate_payout', 'promoter', selectedAffiliate.id, { amount: selectedAffiliate.total_commission - selectedAffiliate.paid_commission });
        alert('Commission marked as paid');
      }

      setActionDialogOpen(false);
      loadAffiliates();
    } catch (error) {
      console.error('Action error:', error);
      alert('Failed to perform action');
    } finally {
      setProcessing(false);
    }
  };

  const openActionDialog = (affiliate, action) => {
    setSelectedAffiliate(affiliate);
    setActionType(action);
    setActionDialogOpen(true);
  };

  const openDetailsDialog = (affiliate) => {
    setSelectedAffiliate(affiliate);
    setDetailsDialogOpen(true);
  };

  const formatCurrencyVal = (amount, currency = 'NGN') => {
    return formatPrice(amount || 0, currency);
  };

  const getStatusBadge = (affiliate) => {
    if (affiliate.status === 'pending') {
      return <Badge className="bg-yellow-100 text-yellow-700">Pending</Badge>;
    } else if (!affiliate.is_active) {
      return <Badge className="bg-red-100 text-red-700">Suspended</Badge>;
    } else {
      return <Badge className="bg-green-100 text-green-700">Active</Badge>;
    }
  };

  const filteredAffiliates = affiliates.filter((affiliate) => {
    const matchesSearch =
      affiliate.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      affiliate.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      affiliate.promo_code?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (statusFilter === 'all') return matchesSearch;
    if (statusFilter === 'active') return matchesSearch && affiliate.is_active && affiliate.status !== 'pending';
    if (statusFilter === 'pending') return matchesSearch && affiliate.status === 'pending';
    if (statusFilter === 'suspended') return matchesSearch && !affiliate.is_active;
    return matchesSearch;
  });

  const stats = {
    total: affiliates.length,
    active: affiliates.filter(a => a.is_active && a.status !== 'pending').length,
    pending: affiliates.filter(a => a.status === 'pending').length,
    totalSales: affiliates.reduce((sum, a) => sum + (a.total_sales || 0), 0),
    totalRevenue: affiliates.reduce((sum, a) => sum + (parseFloat(a.total_revenue) || 0), 0),
    totalCommission: affiliates.reduce((sum, a) => sum + (parseFloat(a.total_commission) || 0), 0),
    unpaidCommission: affiliates.reduce((sum, a) => sum + ((parseFloat(a.total_commission) || 0) - (parseFloat(a.paid_commission) || 0)), 0),
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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Affiliate Management</h2>
          <p className="text-muted-foreground mt-1">Manage platform affiliates and promoters</p>
        </div>
        <Button variant="outline" size="icon" onClick={loadAffiliates} className="rounded-xl">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Affiliates</p>
                <p className="text-2xl font-semibold">{stats.total}</p>
                <p className="text-xs text-green-600">{stats.active} active</p>
              </div>
              <Users className="w-8 h-8 text-[#2969FF]/20" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Sales</p>
                <p className="text-2xl font-semibold">{stats.totalSales.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">tickets</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-200" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Revenue Generated</p>
                <p className="text-xl font-semibold text-green-600">{formatCurrencyVal(stats.totalRevenue)}</p>
              </div>
              <DollarSign className="w-8 h-8 text-green-200" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Unpaid Commission</p>
                <p className="text-xl font-semibold text-orange-600">{formatCurrencyVal(stats.unpaidCommission)}</p>
              </div>
              <Wallet className="w-8 h-8 text-orange-200" />
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
                placeholder="Search affiliates..."
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
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Affiliates Table */}
      <Card className="border-border/10 rounded-2xl">
        <CardHeader>
          <CardTitle className="text-foreground">Affiliates ({filteredAffiliates.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/10">
                  <th className="text-left py-4 px-4 text-muted-foreground font-medium">Affiliate</th>
                  <th className="text-left py-4 px-4 text-muted-foreground font-medium">Promo Code</th>
                  <th className="text-left py-4 px-4 text-muted-foreground font-medium">Event/Organizer</th>
                  <th className="text-left py-4 px-4 text-muted-foreground font-medium">Sales</th>
                  <th className="text-left py-4 px-4 text-muted-foreground font-medium">Revenue</th>
                  <th className="text-left py-4 px-4 text-muted-foreground font-medium">Commission</th>
                  <th className="text-left py-4 px-4 text-muted-foreground font-medium">Status</th>
                  <th className="text-right py-4 px-4 text-muted-foreground font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAffiliates.map((affiliate) => {
                  const unpaid = (parseFloat(affiliate.total_commission) || 0) - (parseFloat(affiliate.paid_commission) || 0);
                  return (
                    <tr key={affiliate.id} className="border-b border-border/5 hover:bg-muted/50">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#2969FF] flex items-center justify-center text-white font-medium">
                            {affiliate.name?.charAt(0) || 'A'}
                          </div>
                          <div>
                            <p className="text-foreground font-medium">{affiliate.name}</p>
                            <p className="text-sm text-muted-foreground">{affiliate.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <code className="px-2 py-1 bg-muted rounded text-sm">{affiliate.promo_code}</code>
                      </td>
                      <td className="py-4 px-4">
                        <p className="text-foreground/80">{affiliate.events?.title || 'All Events'}</p>
                        <p className="text-sm text-muted-foreground">{affiliate.organizers?.business_name || 'N/A'}</p>
                      </td>
                      <td className="py-4 px-4">
                        <p className="text-foreground">{affiliate.total_sales || 0}</p>
                      </td>
                      <td className="py-4 px-4">
                        <p className="text-foreground font-medium">{formatCurrencyVal(affiliate.total_revenue, affiliate.events?.currency || 'NGN')}</p>
                      </td>
                      <td className="py-4 px-4">
                        <p className="text-foreground">{formatCurrencyVal(affiliate.total_commission, affiliate.events?.currency || 'NGN')}</p>
                        {unpaid > 0 && (
                          <p className="text-xs text-orange-600">{formatCurrencyVal(unpaid, affiliate.events?.currency || 'NGN')} unpaid</p>
                        )}
                      </td>
                      <td className="py-4 px-4">{getStatusBadge(affiliate)}</td>
                      <td className="py-4 px-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="rounded-xl">
                              <MoreVertical className="w-5 h-5 text-muted-foreground" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-xl">
                            <DropdownMenuItem onClick={() => openDetailsDialog(affiliate)}>
                              <Eye className="w-4 h-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            {affiliate.status === 'pending' && (
                              <DropdownMenuItem onClick={() => openActionDialog(affiliate, 'approve')}>
                                <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                                Approve
                              </DropdownMenuItem>
                            )}
                            {unpaid > 0 && affiliate.is_active && (
                              <DropdownMenuItem onClick={() => openActionDialog(affiliate, 'payout')}>
                                <Wallet className="w-4 h-4 mr-2 text-orange-500" />
                                Mark Paid
                              </DropdownMenuItem>
                            )}
                            {affiliate.is_active ? (
                              <DropdownMenuItem
                                className="text-red-500"
                                onClick={() => openActionDialog(affiliate, 'suspend')}
                              >
                                <XCircle className="w-4 h-4 mr-2" />
                                Suspend
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                className="text-green-600"
                                onClick={() => openActionDialog(affiliate, 'activate')}
                              >
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Activate
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
                {filteredAffiliates.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-muted-foreground">
                      No affiliates found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle>Affiliate Details</DialogTitle><DialogDescription>View affiliate performance and details</DialogDescription>
          </DialogHeader>
          {selectedAffiliate && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-[#2969FF] flex items-center justify-center text-white text-2xl font-medium">
                  {selectedAffiliate.name?.charAt(0) || 'A'}
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-foreground">{selectedAffiliate.name}</h3>
                  <p className="text-muted-foreground">{selectedAffiliate.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-xl">
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="text-foreground">{selectedAffiliate.phone || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Promo Code</p>
                  <code className="px-2 py-1 bg-card rounded">{selectedAffiliate.promo_code}</code>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Commission Rate</p>
                  <p className="text-foreground">
                    {selectedAffiliate.commission_type === 'percentage'
                      ? `${selectedAffiliate.commission_value}%`
                      : formatCurrencyVal(selectedAffiliate.commission_value, selectedAffiliate.events?.currency || 'NGN')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Joined</p>
                  <p className="text-foreground">{new Date(selectedAffiliate.created_at).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div className="p-4 bg-blue-50 rounded-xl text-center">
                  <p className="text-2xl font-semibold text-[#2969FF]">{selectedAffiliate.total_clicks || 0}</p>
                  <p className="text-sm text-muted-foreground">Clicks</p>
                </div>
                <div className="p-4 bg-green-50 rounded-xl text-center">
                  <p className="text-2xl font-semibold text-green-600">{selectedAffiliate.total_sales || 0}</p>
                  <p className="text-sm text-muted-foreground">Sales</p>
                </div>
                <div className="p-4 bg-purple-50 rounded-xl text-center">
                  <p className="text-lg font-semibold text-purple-600">{formatCurrencyVal(selectedAffiliate.total_revenue, selectedAffiliate.events?.currency || 'NGN')}</p>
                  <p className="text-sm text-muted-foreground">Revenue</p>
                </div>
                <div className="p-4 bg-orange-50 rounded-xl text-center">
                  <p className="text-lg font-semibold text-orange-600">{formatCurrencyVal(selectedAffiliate.total_commission, selectedAffiliate.events?.currency || 'NGN')}</p>
                  <p className="text-sm text-muted-foreground">Commission</p>
                </div>
              </div>

              {selectedAffiliate.referral_link && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Referral Link</p>
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-xl">
                    <Link2 className="w-4 h-4 text-muted-foreground" />
                    <code className="text-sm flex-1 truncate">{selectedAffiliate.referral_link}</code>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Action Dialog */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>
              {actionType === 'approve' && 'Approve Affiliate'}
              {actionType === 'suspend' && 'Suspend Affiliate'}
              {actionType === 'activate' && 'Activate Affiliate'}
              {actionType === 'payout' && 'Process Payout'}
            </DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            {actionType === 'approve' &&
              `Approve ${selectedAffiliate?.name} as an affiliate? They will be able to start promoting events.`}
            {actionType === 'suspend' &&
              `Suspend ${selectedAffiliate?.name}? Their promo code will be deactivated.`}
            {actionType === 'activate' &&
              `Activate ${selectedAffiliate?.name}? Their promo code will be reactivated.`}
            {actionType === 'payout' &&
              `Mark ${formatCurrencyVal((parseFloat(selectedAffiliate?.total_commission) || 0) - (parseFloat(selectedAffiliate?.paid_commission) || 0), selectedAffiliate?.events?.currency || 'NGN')} commission as paid to ${selectedAffiliate?.name}?`}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialogOpen(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button
              onClick={handleAction}
              disabled={processing}
              className={`rounded-xl ${
                actionType === 'suspend' ? 'bg-red-500 hover:bg-red-600' : 'bg-[#2969FF] hover:bg-[#2969FF]/90'
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
