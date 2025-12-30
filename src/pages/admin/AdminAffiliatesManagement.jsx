import { useState, useEffect } from 'react';
import { 
  Search, Loader2, RefreshCw, Users, DollarSign, TrendingUp, 
  Eye, Download, CheckCircle, Clock, Banknote
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { formatPrice } from '@/config/currencies';

export function AdminAffiliatesManagement() {
  const [loading, setLoading] = useState(true);
  const [affiliates, setAffiliates] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedAffiliate, setSelectedAffiliate] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [earnings, setEarnings] = useState([]);
  const [stats, setStats] = useState({
    totalAffiliates: 0,
    activeAffiliates: 0,
    totalEarnings: 0,
    pendingPayouts: 0,
  });

  useEffect(() => {
    loadAffiliates();
  }, []);

  const loadAffiliates = async () => {
    setLoading(true);
    try {
      // Get all users who have made referrals or have referral code
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, email, phone, full_name, referral_code, affiliate_balance, total_referral_earnings, referral_count, affiliate_status, created_at')
        .not('affiliate_status', 'is', null)
        .order('total_referral_earnings', { ascending: false });

      if (error) throw error;

      // Get earnings summary per user
      const { data: earningsData } = await supabase
        .from('referral_earnings')
        .select('user_id, commission_amount, status');

      // Aggregate earnings by user
      const earningsByUser = {};
      earningsData?.forEach(e => {
        if (!earningsByUser[e.user_id]) {
          earningsByUser[e.user_id] = { pending: 0, available: 0, paid: 0, total: 0 };
        }
        const amount = parseFloat(e.commission_amount) || 0;
        earningsByUser[e.user_id].total += amount;
        if (e.status === 'pending') earningsByUser[e.user_id].pending += amount;
        if (e.status === 'available') earningsByUser[e.user_id].available += amount;
        if (e.status === 'paid') earningsByUser[e.user_id].paid += amount;
      });

      // Merge with profiles
      const affiliatesWithEarnings = profiles?.map(p => ({
        ...p,
        earnings: earningsByUser[p.id] || { pending: 0, available: 0, paid: 0, total: 0 }
      })) || [];

      setAffiliates(affiliatesWithEarnings);

      // Calculate stats
      const active = affiliatesWithEarnings.filter(a => a.referral_count > 0).length;
      const totalEarnings = affiliatesWithEarnings.reduce((sum, a) => sum + (a.total_referral_earnings || 0), 0);
      const pendingPayouts = affiliatesWithEarnings.reduce((sum, a) => sum + (a.affiliate_balance || 0), 0);

      setStats({
        totalAffiliates: affiliatesWithEarnings.length,
        activeAffiliates: active,
        totalEarnings,
        pendingPayouts,
      });
    } catch (error) {
      console.error('Error loading affiliates:', error);
    } finally {
      setLoading(false);
    }
  };

  const viewDetails = async (affiliate) => {
    setSelectedAffiliate(affiliate);
    setDetailsOpen(true);

    // Load their earnings history
    const { data } = await supabase
      .from('referral_earnings')
      .select(`
        *,
        event:event_id (title),
        order:order_id (order_number)
      `)
      .eq('user_id', affiliate.id)
      .order('created_at', { ascending: false })
      .limit(20);

    setEarnings(data || []);
  };

  const filteredAffiliates = affiliates.filter(a => {
    const matchesSearch = !searchTerm || 
      a.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.referral_code?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'active' && a.referral_count > 0) ||
      (statusFilter === 'inactive' && a.referral_count === 0) ||
      (statusFilter === 'has_balance' && a.affiliate_balance > 0);

    return matchesSearch && matchesStatus;
  });

  const exportToCSV = () => {
    const headers = ['Name', 'Email', 'Referral Code', 'Referrals', 'Total Earned', 'Balance', 'Joined'];
    const rows = filteredAffiliates.map(a => [
      a.full_name || '',
      a.email || '',
      a.referral_code || '',
      a.referral_count || 0,
      a.total_referral_earnings || 0,
      a.affiliate_balance || 0,
      new Date(a.created_at).toLocaleDateString()
    ]);

    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `affiliates-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0F0F0F]">Affiliates</h1>
          <p className="text-[#0F0F0F]/60 mt-1">Users earning by sharing event links platform-wide</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadAffiliates} variant="outline" className="rounded-xl">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={exportToCSV} variant="outline" className="rounded-xl">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#2969FF]/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-[#2969FF]" />
              </div>
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Total Affiliates</p>
                <h3 className="text-2xl font-semibold">{stats.totalAffiliates}</h3>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Active Affiliates</p>
                <h3 className="text-2xl font-semibold">{stats.activeAffiliates}</h3>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Total Commissions</p>
                <h3 className="text-2xl font-semibold">{formatPrice(stats.totalEarnings, 'NGN')}</h3>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
                <Banknote className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Pending Payouts</p>
                <h3 className="text-2xl font-semibold">{formatPrice(stats.pendingPayouts, 'NGN')}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0F0F0F]/40" />
          <Input
            placeholder="Search by name, email, or code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 rounded-xl"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48 rounded-xl">
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Affiliates</SelectItem>
            <SelectItem value="active">Active (has referrals)</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="has_balance">Has Balance</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Affiliates List */}
      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardHeader>
          <CardTitle>Affiliates ({filteredAffiliates.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredAffiliates.length === 0 ? (
            <div className="text-center py-8 text-[#0F0F0F]/50">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No affiliates found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#0F0F0F]/10">
                    <th className="text-left py-3 px-4 font-medium text-[#0F0F0F]/60">User</th>
                    <th className="text-left py-3 px-4 font-medium text-[#0F0F0F]/60">Code</th>
                    <th className="text-center py-3 px-4 font-medium text-[#0F0F0F]/60">Referrals</th>
                    <th className="text-right py-3 px-4 font-medium text-[#0F0F0F]/60">Earned</th>
                    <th className="text-right py-3 px-4 font-medium text-[#0F0F0F]/60">Balance</th>
                    <th className="text-center py-3 px-4 font-medium text-[#0F0F0F]/60">Status</th>
                    <th className="text-right py-3 px-4 font-medium text-[#0F0F0F]/60">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAffiliates.map((affiliate) => (
                    <tr key={affiliate.id} className="border-b border-[#0F0F0F]/5 hover:bg-[#F4F6FA]">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#2969FF] flex items-center justify-center text-white font-medium">
                            {affiliate.full_name?.charAt(0) || affiliate.email?.charAt(0) || 'A'}
                          </div>
                          <div>
                            <p className="font-medium text-[#0F0F0F]">{affiliate.full_name || 'Unknown'}</p>
                            <p className="text-sm text-[#0F0F0F]/60">{affiliate.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <code className="px-2 py-1 bg-[#F4F6FA] rounded text-sm">{affiliate.referral_code}</code>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-medium">{affiliate.referral_count || 0}</span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="font-medium text-green-600">
                          {formatPrice(affiliate.total_referral_earnings || 0, 'NGN')}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className={`font-medium ${affiliate.affiliate_balance > 0 ? 'text-orange-600' : 'text-[#0F0F0F]/40'}`}>
                          {formatPrice(affiliate.affiliate_balance || 0, 'NGN')}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {affiliate.referral_count > 0 ? (
                          <Badge className="bg-green-100 text-green-700">Active</Badge>
                        ) : (
                          <Badge className="bg-gray-100 text-gray-600">Inactive</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => viewDetails(affiliate)}
                          className="rounded-lg"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle>Affiliate Details</DialogTitle>
            <DialogDescription>View affiliate earnings and activity</DialogDescription>
          </DialogHeader>
          {selectedAffiliate && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-[#2969FF] flex items-center justify-center text-white text-2xl font-medium">
                  {selectedAffiliate.full_name?.charAt(0) || 'A'}
                </div>
                <div>
                  <h3 className="text-xl font-semibold">{selectedAffiliate.full_name || 'Unknown'}</h3>
                  <p className="text-[#0F0F0F]/60">{selectedAffiliate.email}</p>
                  <code className="text-sm bg-[#F4F6FA] px-2 py-0.5 rounded">{selectedAffiliate.referral_code}</code>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3">
                <div className="p-3 bg-blue-50 rounded-xl text-center">
                  <p className="text-xl font-semibold text-blue-600">{selectedAffiliate.referral_count || 0}</p>
                  <p className="text-xs text-[#0F0F0F]/60">Referrals</p>
                </div>
                <div className="p-3 bg-green-50 rounded-xl text-center">
                  <p className="text-lg font-semibold text-green-600">{formatPrice(selectedAffiliate.total_referral_earnings || 0, 'NGN')}</p>
                  <p className="text-xs text-[#0F0F0F]/60">Total Earned</p>
                </div>
                <div className="p-3 bg-orange-50 rounded-xl text-center">
                  <p className="text-lg font-semibold text-orange-600">{formatPrice(selectedAffiliate.affiliate_balance || 0, 'NGN')}</p>
                  <p className="text-xs text-[#0F0F0F]/60">Balance</p>
                </div>
                <div className="p-3 bg-purple-50 rounded-xl text-center">
                  <p className="text-lg font-semibold text-purple-600">{formatPrice(selectedAffiliate.earnings?.paid || 0, 'NGN')}</p>
                  <p className="text-xs text-[#0F0F0F]/60">Paid Out</p>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Recent Earnings</h4>
                {earnings.length === 0 ? (
                  <p className="text-sm text-[#0F0F0F]/50 text-center py-4">No earnings yet</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {earnings.map((e) => (
                      <div key={e.id} className="flex items-center justify-between p-3 bg-[#F4F6FA] rounded-xl">
                        <div>
                          <p className="font-medium text-sm">{e.event?.title || 'Unknown Event'}</p>
                          <p className="text-xs text-[#0F0F0F]/60">{new Date(e.created_at).toLocaleDateString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-green-600">{formatPrice(e.commission_amount, e.currency || 'NGN')}</p>
                          <Badge className={`text-xs ${
                            e.status === 'available' ? 'bg-green-100 text-green-700' :
                            e.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                            e.status === 'paid' ? 'bg-blue-100 text-blue-700' :
                            e.status === 'reversed' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100'
                          }`}>
                            {e.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
