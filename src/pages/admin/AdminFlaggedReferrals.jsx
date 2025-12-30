import { useState, useEffect } from 'react';
import { 
  AlertTriangle, CheckCircle, XCircle, Loader2, RefreshCw, 
  User, Mail, Phone, Globe, Calendar, DollarSign, Eye
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';

export function AdminFlaggedReferrals() {
  const [loading, setLoading] = useState(true);
  const [flagged, setFlagged] = useState([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [processing, setProcessing] = useState(null);

  useEffect(() => {
    loadFlagged();
  }, []);

  const loadFlagged = async () => {
    setLoading(true);
    try {
      // Get all flagged referrals
      const { data, error } = await supabase
        .from('referral_earnings')
        .select(`
          *,
          referrer:user_id (id, email, phone, full_name, referral_code),
          buyer:buyer_id (id, email, phone, full_name),
          event:event_id (title),
          order:order_id (order_number, total_amount)
        `)
        .eq('is_flagged', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFlagged(data || []);

      // Calculate stats
      const pending = data?.filter(r => r.status === 'pending').length || 0;
      const approved = data?.filter(r => r.status === 'available' || r.status === 'paid').length || 0;
      const rejected = data?.filter(r => r.status === 'reversed').length || 0;

      setStats({
        total: data?.length || 0,
        pending,
        approved,
        rejected
      });
    } catch (error) {
      console.error('Error loading flagged referrals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (referral) => {
    setProcessing(referral.id);
    try {
      // Update status to available (approved)
      await supabase
        .from('referral_earnings')
        .update({ 
          status: 'available',
          reviewed_by: (await supabase.auth.getUser()).data.user?.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', referral.id);

      // Add commission to affiliate balance
      await supabase
        .from('profiles')
        .update({ 
          affiliate_balance: supabase.raw(`affiliate_balance + ${referral.commission_amount}`),
          total_referral_earnings: supabase.raw(`total_referral_earnings + ${referral.commission_amount}`)
        })
        .eq('id', referral.user_id);

      loadFlagged();
    } catch (error) {
      console.error('Error approving referral:', error);
      alert('Failed to approve');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (referral) => {
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;

    setProcessing(referral.id);
    try {
      await supabase
        .from('referral_earnings')
        .update({ 
          status: 'reversed',
          flag_reason: referral.flag_reason + ` | Rejected: ${reason}`,
          reviewed_by: (await supabase.auth.getUser()).data.user?.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', referral.id);

      // Update order referral status
      await supabase
        .from('orders')
        .update({ referral_status: 'reversed' })
        .eq('id', referral.order_id);

      loadFlagged();
    } catch (error) {
      console.error('Error rejecting referral:', error);
      alert('Failed to reject');
    } finally {
      setProcessing(null);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0F0F0F]">Flagged Referrals</h1>
          <p className="text-[#0F0F0F]/60 mt-1">Review suspicious affiliate referrals</p>
        </div>
        <Button onClick={loadFlagged} variant="outline" className="rounded-xl">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Total Flagged</p>
                <h3 className="text-xl font-semibold">{stats.total}</h3>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-yellow-100 flex items-center justify-center">
                <Eye className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Pending Review</p>
                <h3 className="text-xl font-semibold">{stats.pending}</h3>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Approved</p>
                <h3 className="text-xl font-semibold">{stats.approved}</h3>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                <XCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Rejected</p>
                <h3 className="text-xl font-semibold">{stats.rejected}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Flagged List */}
      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardHeader>
          <CardTitle>Pending Review</CardTitle>
        </CardHeader>
        <CardContent>
          {flagged.filter(r => r.status === 'pending').length === 0 ? (
            <div className="text-center py-8 text-[#0F0F0F]/50">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No flagged referrals to review</p>
            </div>
          ) : (
            <div className="space-y-4">
              {flagged.filter(r => r.status === 'pending').map((referral) => (
                <div key={referral.id} className="border border-orange-200 bg-orange-50 rounded-xl p-4">
                  {/* Flag Reason */}
                  <div className="flex items-start gap-2 mb-4 p-3 bg-orange-100 rounded-lg">
                    <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-orange-800">Flag Reason</p>
                      <p className="text-sm text-orange-700">{referral.flag_reason}</p>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-3 gap-4 mb-4">
                    {/* Referrer Info */}
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-[#0F0F0F]/60">Referrer (Affiliate)</p>
                      <div className="bg-white rounded-lg p-3 space-y-1">
                        <p className="font-medium">{referral.referrer?.full_name || 'Unknown'}</p>
                        <p className="text-sm text-[#0F0F0F]/60 flex items-center gap-1">
                          <Mail className="w-3 h-3" /> {referral.referrer?.email}
                        </p>
                        <p className="text-sm text-[#0F0F0F]/60 flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {referral.referrer?.phone || 'N/A'}
                        </p>
                        <Badge variant="outline" className="text-xs">{referral.referrer?.referral_code}</Badge>
                      </div>
                    </div>

                    {/* Buyer Info */}
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-[#0F0F0F]/60">Buyer</p>
                      <div className="bg-white rounded-lg p-3 space-y-1">
                        <p className="font-medium">{referral.buyer?.full_name || 'Unknown'}</p>
                        <p className="text-sm text-[#0F0F0F]/60 flex items-center gap-1">
                          <Mail className="w-3 h-3" /> {referral.buyer?.email}
                        </p>
                        <p className="text-sm text-[#0F0F0F]/60 flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {referral.buyer?.phone || 'N/A'}
                        </p>
                        <p className="text-sm text-[#0F0F0F]/60 flex items-center gap-1">
                          <Globe className="w-3 h-3" /> IP: {referral.ip_address || 'Unknown'}
                        </p>
                      </div>
                    </div>

                    {/* Transaction Info */}
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-[#0F0F0F]/60">Transaction</p>
                      <div className="bg-white rounded-lg p-3 space-y-1">
                        <p className="font-medium">{referral.event?.title || 'Unknown Event'}</p>
                        <p className="text-sm text-[#0F0F0F]/60">
                          Order: {referral.order?.order_number || 'N/A'}
                        </p>
                        <p className="text-sm text-green-600 font-medium flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          Commission: {referral.currency} {parseFloat(referral.commission_amount).toLocaleString()}
                        </p>
                        <p className="text-xs text-[#0F0F0F]/50 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(referral.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 justify-end">
                    <Button
                      onClick={() => handleReject(referral)}
                      variant="outline"
                      className="rounded-xl border-red-200 text-red-600 hover:bg-red-50"
                      disabled={processing === referral.id}
                    >
                      {processing === referral.id ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <XCircle className="w-4 h-4 mr-2" />
                      )}
                      Reject
                    </Button>
                    <Button
                      onClick={() => handleApprove(referral)}
                      className="rounded-xl bg-green-600 hover:bg-green-700"
                      disabled={processing === referral.id}
                    >
                      {processing === referral.id ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4 mr-2" />
                      )}
                      Approve
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* History */}
      {flagged.filter(r => r.status !== 'pending').length > 0 && (
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardHeader>
            <CardTitle>Review History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {flagged.filter(r => r.status !== 'pending').map((referral) => (
                <div key={referral.id} className="flex items-center justify-between p-3 bg-[#F4F6FA] rounded-xl">
                  <div className="flex items-center gap-3">
                    {referral.status === 'reversed' ? (
                      <XCircle className="w-5 h-5 text-red-500" />
                    ) : (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    )}
                    <div>
                      <p className="font-medium">{referral.referrer?.full_name}</p>
                      <p className="text-sm text-[#0F0F0F]/60">{referral.event?.title}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-medium ${referral.status === 'reversed' ? 'text-red-600' : 'text-green-600'}`}>
                      {referral.currency} {parseFloat(referral.commission_amount).toLocaleString()}
                    </p>
                    <Badge className={referral.status === 'reversed' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}>
                      {referral.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
