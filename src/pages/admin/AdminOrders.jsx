import { useState, useEffect } from 'react';
import { 
  Search, Filter, Download, RefreshCw, Loader2, 
  Receipt, CreditCard, Calendar, User, Mail, ChevronDown, ChevronUp,
  CheckCircle, Clock, XCircle, AlertCircle, RotateCcw, Building
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { supabase } from '@/lib/supabase';
import { formatPrice, getDefaultCurrency } from '@/config/currencies';

export function AdminOrders() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [organizers, setOrganizers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [organizerFilter, setOrganizerFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalRevenue: 0,
    revenueByCurrency: {}, // { NGN: 1000, GBP: 500, etc. }
    platformFees: 0,
    platformFeesByCurrency: {},
    completedOrders: 0,
    pendingOrders: 0,
    refundedOrders: 0,
  });

  // Refund dialog state
  const [refundDialog, setRefundDialog] = useState(false);
  const [refundOrder, setRefundOrder] = useState(null);
  const [refundReason, setRefundReason] = useState('');
  const [refunding, setRefunding] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadOrganizers(), loadOrders()]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadOrganizers = async () => {
    const { data, error } = await supabase
      .from('organizers')
      .select('id, business_name')
      .order('business_name', { ascending: true });

    if (!error) setOrganizers(data || []);
  };

  const loadOrders = async () => {
    // Get all orders with event and organizer info
    const { data: ordersData, error } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        buyer_name,
        buyer_email,
        buyer_phone,
        event_id,
        status,
        subtotal,
        platform_fee,
        discount_amount,
        total_amount,
        currency,
        payment_method,
        payment_reference,
        payment_provider,
        paid_at,
        created_at,
        promo_code_id,
        events (
          id,
          title,
          organizer_id,
          organizers (
            id,
            business_name
          )
        )
      `)
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      console.error('Error loading orders:', error);
      return;
    }

    // Get tickets for each order
    const ordersWithTickets = await Promise.all(
      (ordersData || []).map(async (order) => {
        const { data: tickets } = await supabase
          .from('tickets')
          .select(`
            id,
            attendee_name,
            attendee_email,
            ticket_code,
            is_checked_in,
            checked_in_at,
            status,
            unit_price,
            ticket_types (name)
          `)
          .eq('order_id', order.id);

        return {
          ...order,
          tickets: tickets || [],
          ticketCount: tickets?.length || 0,
          organizer: order.events?.organizers,
          eventTitle: order.events?.title,
        };
      })
    );

    setOrders(ordersWithTickets);

    // Calculate stats with multi-currency support
    const completed = ordersWithTickets.filter(o => o.status === 'completed');
    const pending = ordersWithTickets.filter(o => o.status === 'pending');
    const refunded = ordersWithTickets.filter(o => o.status === 'refunded');
    
    // Calculate revenue by currency
    const revenueByCurrency = {};
    const platformFeesByCurrency = {};
    
    completed.forEach(order => {
      const currency = order.currency || order.event?.currency || getDefaultCurrency(order.event?.country_code || order.event?.country);
      const amount = parseFloat(order.total_amount) || 0;
      const fee = parseFloat(order.platform_fee) || 0;
      
      revenueByCurrency[currency] = (revenueByCurrency[currency] || 0) + amount;
      platformFeesByCurrency[currency] = (platformFeesByCurrency[currency] || 0) + fee;
    });

    // For backward compatibility, keep total (sum all)
    const totalRevenue = Object.values(revenueByCurrency).reduce((sum, val) => sum + val, 0);
    const platformFees = Object.values(platformFeesByCurrency).reduce((sum, val) => sum + val, 0);

    setStats({
      totalOrders: ordersWithTickets.length,
      totalRevenue,
      revenueByCurrency,
      platformFees,
      platformFeesByCurrency,
      completedOrders: completed.length,
      pendingOrders: pending.length,
      refundedOrders: refunded.length,
    });
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.buyer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.buyer_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.eventTitle?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesOrganizer = organizerFilter === 'all' || order.organizer?.id === organizerFilter;
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesOrganizer && matchesStatus;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-700"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-700"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'refunded':
        return <Badge className="bg-red-100 text-red-700"><RotateCcw className="w-3 h-3 mr-1" />Refunded</Badge>;
      case 'cancelled':
        return <Badge className="bg-gray-100 text-gray-700"><XCircle className="w-3 h-3 mr-1" />Cancelled</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-700">{status}</Badge>;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-NG', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const maskPaymentRef = (ref) => {
    if (!ref) return 'N/A';
    if (ref.length <= 8) return ref;
    return `${ref.slice(0, 4)}...${ref.slice(-4)}`;
  };

  const exportToCSV = () => {
    const headers = ['Order No', 'Date', 'Buyer', 'Email', 'Event', 'Organizer', 'Tickets', 'Amount', 'Platform Fee', 'Status', 'Payment Method'];
    const csvData = filteredOrders.map(o => [
      o.order_number,
      formatDate(o.created_at),
      o.buyer_name,
      o.buyer_email,
      o.eventTitle || 'Unknown',
      o.organizer?.business_name || 'Unknown',
      o.ticketCount,
      `${o.currency} ${o.total_amount}`,
      `${o.currency} ${o.platform_fee || 0}`,
      o.status,
      o.payment_method || 'N/A'
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(cell => `"${cell || ''}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `platform_orders_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const handleRefundClick = (order) => {
    setRefundOrder(order);
    setRefundReason('');
    setRefundDialog(true);
  };

  const processRefund = async () => {
    if (!refundOrder || !refundReason.trim()) return;
    
    setRefunding(true);
    try {
      // Update order status
      await supabase
        .from('orders')
        .update({ 
          status: 'refunded',
          notes: `Admin refund: ${refundReason}`
        })
        .eq('id', refundOrder.id);

      // Update tickets
      await supabase
        .from('tickets')
        .update({ 
          status: 'refunded',
          refund_reason: refundReason,
          refunded_at: new Date().toISOString()
        })
        .eq('order_id', refundOrder.id);

      // Reverse affiliate commission if applicable
      if (refundOrder.referred_by && refundOrder.referral_commission > 0) {
        // Get the earning record first
        const { data: earning } = await supabase
          .from('referral_earnings')
          .select('id, user_id, commission_amount, status')
          .eq('order_id', refundOrder.id)
          .single();

        if (earning) {
          // Update referral earning status to reversed
          await supabase
            .from('referral_earnings')
            .update({ 
              status: 'reversed',
              flag_reason: `Admin refund: ${refundReason}`
            })
            .eq('id', earning.id);

          // Deduct from affiliate balance if already credited (status was 'available')
          if (earning.status === 'available') {
            const { data: profile } = await supabase
              .from('profiles')
              .select('affiliate_balance')
              .eq('id', earning.user_id)
              .single();

            if (profile) {
              const newBalance = Math.max(0, (profile.affiliate_balance || 0) - earning.commission_amount);
              await supabase
                .from('profiles')
                .update({ affiliate_balance: newBalance })
                .eq('id', earning.user_id);
            }
          }

          // Update order referral status
          await supabase
            .from('orders')
            .update({ referral_status: 'reversed' })
            .eq('id', refundOrder.id);
        }
      }

      alert('Refund processed successfully. Note: Actual payment refund must be processed manually through the payment provider.');
      
      setRefundDialog(false);
      loadOrders();
    } catch (error) {
      console.error('Refund error:', error);
      alert('Failed to process refund');
    } finally {
      setRefunding(false);
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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-[#0F0F0F]">Platform Orders</h2>
          <p className="text-[#0F0F0F]/60 mt-1">View and manage all orders across the platform</p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={loadData} variant="outline" size="icon" className="rounded-xl border-[#0F0F0F]/10">
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button onClick={exportToCSV} variant="outline" className="rounded-xl border-[#0F0F0F]/10" disabled={filteredOrders.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#2969FF]/10 flex items-center justify-center">
                <Receipt className="w-5 h-5 text-[#2969FF]" />
              </div>
              <div>
                <p className="text-[#0F0F0F]/60 text-sm">Total Orders</p>
                <h3 className="text-2xl font-semibold text-[#0F0F0F]">{stats.totalOrders}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-[#0F0F0F]/60 text-sm">Total Revenue</p>
                {Object.keys(stats.revenueByCurrency || {}).length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(stats.revenueByCurrency).map(([currency, amount]) => (
                      <span key={currency} className="text-lg font-semibold text-[#0F0F0F]">
                        {formatPrice(amount, currency)}
                      </span>
                    ))}
                  </div>
                ) : (
                  <h3 className="text-2xl font-semibold text-[#0F0F0F]">{formatPrice(stats.totalRevenue, 'NGN')}</h3>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-[#0F0F0F]/60 text-sm">Platform Fees</p>
                {Object.keys(stats.platformFeesByCurrency || {}).length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(stats.platformFeesByCurrency).map(([currency, amount]) => (
                      <span key={currency} className="text-lg font-semibold text-[#0F0F0F]">
                        {formatPrice(amount, currency)}
                      </span>
                    ))}
                  </div>
                ) : (
                  <h3 className="text-2xl font-semibold text-[#0F0F0F]">{formatPrice(stats.platformFees || 0, 'NGN')}</h3>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-[#0F0F0F]/60 text-sm">Completed</p>
                <h3 className="text-2xl font-semibold text-[#0F0F0F]">{stats.completedOrders}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                <RotateCcw className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-[#0F0F0F]/60 text-sm">Refunded</p>
                <h3 className="text-2xl font-semibold text-[#0F0F0F]">{stats.refundedOrders}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#0F0F0F]/40" />
              <Input 
                placeholder="Search by order number, name, email, or event..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                className="pl-10 h-12 bg-[#F4F6FA] border-0 rounded-xl" 
              />
            </div>
            <Select value={organizerFilter} onValueChange={setOrganizerFilter}>
              <SelectTrigger className="md:w-64 h-12 rounded-xl border-[#0F0F0F]/10">
                <Building className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter by organizer" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">All Organizers</SelectItem>
                {organizers.map((org) => (
                  <SelectItem key={org.id} value={org.id}>{org.business_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="md:w-48 h-12 rounded-xl border-[#0F0F0F]/10">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Orders List */}
      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardHeader>
          <CardTitle className="text-[#0F0F0F]">All Orders ({filteredOrders.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredOrders.length === 0 ? (
            <div className="text-center py-12">
              <Receipt className="w-12 h-12 text-[#0F0F0F]/20 mx-auto mb-4" />
              <p className="text-[#0F0F0F]/60">{orders.length === 0 ? 'No orders yet' : 'No orders match your filters'}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredOrders.map((order) => (
                <div key={order.id} className="border border-[#0F0F0F]/10 rounded-xl overflow-hidden">
                  {/* Order Row */}
                  <div 
                    className="p-4 hover:bg-[#F4F6FA]/50 cursor-pointer flex flex-col md:flex-row md:items-center gap-4"
                    onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-mono font-medium text-[#0F0F0F]">{order.order_number}</span>
                        {getStatusBadge(order.status)}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-[#0F0F0F]/60">
                        <span className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          {order.buyer_name || 'N/A'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Mail className="w-4 h-4" />
                          {order.buyer_email}
                        </span>
                        <span className="flex items-center gap-1">
                          <Building className="w-4 h-4" />
                          {order.organizer?.business_name || 'Unknown'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {formatDate(order.created_at)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-semibold text-[#0F0F0F]">
                          {formatPrice(order.total_amount, order.currency || order.event?.currency || getDefaultCurrency(order.event?.country_code || order.event?.country))}
                        </p>
                        <p className="text-sm text-[#0F0F0F]/60">{order.ticketCount} ticket(s)</p>
                      </div>
                      {expandedOrder === order.id ? (
                        <ChevronUp className="w-5 h-5 text-[#0F0F0F]/40" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-[#0F0F0F]/40" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {expandedOrder === order.id && (
                    <div className="border-t border-[#0F0F0F]/10 bg-[#F4F6FA]/30 p-4">
                      <div className="grid md:grid-cols-3 gap-6">
                        {/* Order Details */}
                        <div>
                          <h4 className="font-medium text-[#0F0F0F] mb-3">Order Details</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-[#0F0F0F]/60">Event</span>
                              <span className="font-medium">{order.eventTitle || 'Unknown'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-[#0F0F0F]/60">Organizer</span>
                              <span className="font-medium">{order.organizer?.business_name || 'Unknown'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-[#0F0F0F]/60">Payment Method</span>
                              <span className="font-medium capitalize">{order.payment_method || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-[#0F0F0F]/60">Payment Reference</span>
                              <span className="font-mono text-xs">{maskPaymentRef(order.payment_reference)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Financial Details */}
                        <div>
                          <h4 className="font-medium text-[#0F0F0F] mb-3">Financial Details</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-[#0F0F0F]/60">Subtotal</span>
                              <span>{formatPrice(order.subtotal, order.currency || 'NGN')}</span>
                            </div>
                            {parseFloat(order.discount_amount) > 0 && (
                              <div className="flex justify-between text-green-600">
                                <span>Discount</span>
                                <span>-{formatPrice(order.discount_amount, order.currency || 'NGN')}</span>
                              </div>
                            )}
                            <div className="flex justify-between text-purple-600">
                              <span>Platform Fee</span>
                              <span>{formatPrice(order.platform_fee || 0, order.currency || 'NGN')}</span>
                            </div>
                            <div className="flex justify-between font-semibold border-t border-[#0F0F0F]/10 pt-2 mt-2">
                              <span>Total</span>
                              <span>{formatPrice(order.total_amount, order.currency || 'NGN')}</span>
                            </div>
                          </div>
                        </div>

                        {/* Attendees */}
                        <div>
                          <h4 className="font-medium text-[#0F0F0F] mb-3">Attendees ({order.tickets.length})</h4>
                          <div className="space-y-2 max-h-40 overflow-y-auto">
                            {order.tickets.map((ticket) => (
                              <div key={ticket.id} className="p-2 bg-white rounded-lg border border-[#0F0F0F]/10">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <p className="font-medium text-[#0F0F0F] text-sm">{ticket.attendee_name}</p>
                                    <p className="text-xs text-[#0F0F0F]/60">{ticket.ticket_types?.name || 'Standard'}</p>
                                  </div>
                                  {ticket.is_checked_in ? (
                                    <Badge className="bg-green-100 text-green-700 text-xs">In</Badge>
                                  ) : (
                                    <Badge className="bg-gray-100 text-gray-600 text-xs">-</Badge>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      {order.status === 'completed' && (
                        <div className="mt-4 pt-4 border-t border-[#0F0F0F]/10 flex justify-end">
                          <Button 
                            variant="outline" 
                            className="rounded-xl text-red-600 border-red-200 hover:bg-red-50"
                            onClick={(e) => { e.stopPropagation(); handleRefundClick(order); }}
                          >
                            <RotateCcw className="w-4 h-4 mr-2" />
                            Process Refund
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Refund Dialog */}
      <Dialog open={refundDialog} onOpenChange={setRefundDialog}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Process Refund (Admin)</DialogTitle>
            <DialogDescription>
              This will mark the order as refunded. You must process the actual payment refund manually through the payment provider.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 bg-[#F4F6FA] rounded-xl">
              <div className="flex justify-between text-sm">
                <span className="text-[#0F0F0F]/60">Order</span>
                <span className="font-mono">{refundOrder?.order_number}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-[#0F0F0F]/60">Organizer</span>
                <span>{refundOrder?.organizer?.business_name}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-[#0F0F0F]/60">Amount</span>
                <span className="font-semibold">{formatPrice(refundOrder?.total_amount, refundOrder?.currency || 'NGN')}</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Refund Reason *</Label>
              <Textarea 
                placeholder="Enter the reason for this refund..."
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="p-3 bg-yellow-50 rounded-xl flex gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
              <p className="text-sm text-yellow-800">
                Remember to process the actual payment refund through Paystack or the payment provider's dashboard.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundDialog(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button 
              onClick={processRefund} 
              disabled={!refundReason.trim() || refunding}
              className="bg-red-600 hover:bg-red-700 text-white rounded-xl"
            >
              {refunding ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</> : 'Confirm Refund'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
