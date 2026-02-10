import { useState, useEffect } from 'react';
import { 
  Search, Filter, Download, RefreshCw, Loader2, 
  Receipt, CreditCard, Calendar, User, Mail, ChevronDown, ChevronUp, Clock,
  CheckCircle, XCircle, AlertCircle, Eye, RotateCcw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { toast } from 'sonner';
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
import { useOrganizer } from '../../contexts/OrganizerContext';
import { supabase } from '@/lib/supabase';
import { formatPrice, getDefaultCurrency } from '@/config/currencies';
import { Pagination, usePagination } from '@/components/ui/pagination';

export function OrganizerOrders() {
  const { organizer } = useOrganizer();
  
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [events, setEvents] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [eventFilter, setEventFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [stats, setStats] = useState({
    totalOrders: 0,
    revenueByCurrency: {},
    completedOrders: 0,
    pendingOrders: 0,
  });

  // Refund dialog state
  const [refundDialog, setRefundDialog] = useState(false);
  const [refundOrder, setRefundOrder] = useState(null);
  const [refundReasonCategory, setRefundReasonCategory] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refunding, setRefunding] = useState(false);

  // Predefined refund reasons
  const refundReasons = [
    'Event cancelled',
    'Event postponed',
    'Attendee cannot attend',
    'Duplicate purchase',
    'Technical issue during purchase',
    'Pricing error',
    'Other'
  ];

  useEffect(() => {
    if (organizer?.id) {
      loadData();
    }
  }, [organizer?.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadEvents(), loadOrders()]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadEvents = async () => {
    // Load both parent events and child events (for recurring events)
    const { data, error } = await supabase
      .from('events')
      .select('id, title, start_date, parent_event_id')
      .eq('organizer_id', organizer.id)
      .order('start_date', { ascending: false });

    if (!error) setEvents(data || []);
  };

  const loadOrders = async () => {
    // Get organizer's events (both parent and child events for recurring events)
    const { data: orgEvents } = await supabase
      .from('events')
      .select('id, title, currency, start_date, end_date, parent_event_id, is_recurring')
      .eq('organizer_id', organizer.id);

    if (!orgEvents || orgEvents.length === 0) {
      setOrders([]);
      return;
    }

    // Include child events by checking parent_event_id
    const parentEventIds = orgEvents.filter(e => !e.parent_event_id).map(e => e.id);
    const { data: childEvents } = await supabase
      .from('events')
      .select('id, title, currency, start_date, end_date, parent_event_id, is_recurring')
      .in('parent_event_id', parentEventIds);

    // Combine all events (parent + child)
    const allEvents = [...orgEvents, ...(childEvents || [])];
    const eventIds = allEvents.map(e => e.id);
    const eventMap = {};
    allEvents.forEach(e => { eventMap[e.id] = e; });

    // Get orders for these events
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
        is_stripe_connect,
        platform_fee_amount,
        organizer_payout_amount,
        paid_at,
        created_at,
        promo_code_id
      `)
      .in('event_id', eventIds)
      .not('status', 'in', '("cancelled","failed")')
      .order('created_at', { ascending: false });

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
          event: eventMap[order.event_id],
          tickets: tickets || [],
          ticketCount: tickets?.length || 0,
        };
      })
    );

    setOrders(ordersWithTickets);

    // Calculate stats
    const completed = ordersWithTickets.filter(o => o.status === 'completed');
    const pending = ordersWithTickets.filter(o => o.status === 'pending');
    // Group revenue by currency
    const revenueByCurrency = completed.reduce((acc, o) => {
      const currency = o.currency || o.event?.currency || getDefaultCurrency(o.event?.country_code || o.event?.country);
      acc[currency] = (acc[currency] || 0) + (parseFloat(o.total_amount) || 0);
      return acc;
    }, {});
    
    setStats({
      totalOrders: ordersWithTickets.length,
      revenueByCurrency,
      completedOrders: completed.length,
      pendingOrders: pending.length,
    });
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.buyer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.buyer_email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesEvent = eventFilter === 'all' || order.event_id === eventFilter;
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesEvent && matchesStatus;
  });

  // Pagination
  const { 
    currentPage, totalPages, totalItems, itemsPerPage, 
    paginatedItems: paginatedOrders, handlePageChange, setCurrentPage 
  } = usePagination(filteredOrders, 20);
  
  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, eventFilter, statusFilter]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-700"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-700"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'refunded':
        return <Badge className="bg-red-100 text-red-700"><RotateCcw className="w-3 h-3 mr-1" />Refunded</Badge>;
      case 'cancelled':
        return <Badge className="bg-muted text-foreground/80"><XCircle className="w-3 h-3 mr-1" />Cancelled</Badge>;
      default:
        return <Badge className="bg-muted text-foreground/80">{status}</Badge>;
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
    const headers = ['Order No', 'Date', 'Buyer', 'Email', 'Event', 'Tickets', 'Amount', 'Status', 'Payment Method'];
    const csvData = filteredOrders.map(o => [
      o.order_number,
      formatDate(o.created_at),
      o.buyer_name,
      o.buyer_email,
      o.event?.title || 'Unknown',
      o.ticketCount,
      `${o.currency} ${o.total_amount}`,
      o.status,
      o.payment_method || 'N/A'
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(cell => `"${cell || ''}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `orders_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const handleRefundClick = (order) => {
    setRefundOrder(order);
    setRefundReasonCategory('');
    setRefundReason('');
    setRefundDialog(true);
  };

  const processRefund = async () => {
    if (!refundOrder || !refundReasonCategory || (refundReasonCategory === 'Other' && !refundReason.trim())) return;
    
    setRefunding(true);
    try {
      // Get the first ticket from this order to create a refund request
      const { data: orderTickets, error: ticketError } = await supabase
        .from('tickets')
        .select('id, total_price, event_id, user_id')
        .eq('order_id', refundOrder.id)
        .limit(1);

      if (ticketError || !orderTickets?.length) {
        throw new Error('No tickets found for this order');
      }

      const ticket = orderTickets[0];

      // Check if refund request already exists
      const { data: existingRequest } = await supabase
        .from('refund_requests')
        .select('id, status')
        .eq('order_id', refundOrder.id)
        .not('status', 'eq', 'rejected')
        .single();

      if (existingRequest) {
        toast.error('A refund request already exists for this order. Status: ' + existingRequest.status);
        setRefundDialog(false);
        return;
      }

      // Create refund request for finance team to review
      const { error: insertError } = await supabase
        .from('refund_requests')
        .insert({
          ticket_id: ticket.id,
          order_id: refundOrder.id,
          event_id: ticket.event_id,
          organizer_id: organizer.id,
          user_id: refundOrder.user_id || ticket.user_id,
          amount: parseFloat(refundOrder.total_amount) || ticket.total_price,
          original_amount: parseFloat(refundOrder.total_amount) || ticket.total_price,
          currency: refundOrder.currency || refundOrder.events?.currency || getDefaultCurrency(refundOrder.events?.country_code || refundOrder.events?.country),
          reason: refundReasonCategory === 'Other' ? refundReason : refundReasonCategory,
          status: 'pending',
          organizer_decision: 'approved',
          organizer_notes: refundReasonCategory === 'Other' ? refundReason : `Reason: ${refundReasonCategory}`,
          organizer_decided_at: new Date().toISOString(),
          escalated_to_admin: true,
          escalated_at: new Date().toISOString(),
          escalation_reason: 'Organizer initiated refund request',
        });

      if (insertError) throw insertError;

      // Update order to show refund is pending
      await supabase
        .from('orders')
        .update({ 
          status: 'refund_pending',
          notes: `Refund requested: ${refundReason}`
        })
        .eq('id', refundOrder.id);

      toast.success('Refund request submitted! Ticketrack Finance will process it within 3-5 business days.');
      
      setRefundDialog(false);
      loadOrders();
    } catch (error) {
      console.error('Refund request error:', error);
      toast.error('Failed to submit refund request: ' + (error.message || 'Unknown error'));
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
          <h2 className="text-2xl font-semibold text-foreground">Orders</h2>
          <p className="text-muted-foreground mt-1">View and manage all ticket orders</p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={loadData} variant="outline" size="icon" className="rounded-xl border-border/10">
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button onClick={exportToCSV} variant="outline" className="rounded-xl border-border/10" disabled={filteredOrders.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#2969FF]/10 flex items-center justify-center">
                <Receipt className="w-5 h-5 text-[#2969FF]" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Total Orders</p>
                <h3 className="text-2xl font-semibold text-foreground">{stats.totalOrders}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Revenue</p>
                <h3 className="text-2xl font-semibold text-foreground">{Object.entries(stats.revenueByCurrency || {}).map(([currency, amount]) => formatPrice(amount, currency)).join(' | ') || formatPrice(0, getDefaultCurrency(organizer?.country_code || organizer?.country))}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Completed</p>
                <h3 className="text-2xl font-semibold text-foreground">{stats.completedOrders}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-yellow-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Pending</p>
                <h3 className="text-2xl font-semibold text-foreground">{stats.pendingOrders}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-border/10 rounded-2xl">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input 
                placeholder="Search by order number, name, or email..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                className="pl-10 h-12 bg-muted border-0 rounded-xl" 
              />
            </div>
            <Select value={eventFilter} onValueChange={setEventFilter}>
              <SelectTrigger className="md:w-64 h-12 rounded-xl border-border/10">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter by event" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">All Events</SelectItem>
                {events.map((event) => (
                  <SelectItem key={event.id} value={event.id}>{event.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="md:w-48 h-12 rounded-xl border-border/10">
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
      <Card className="border-border/10 rounded-2xl">
        <CardHeader>
          <CardTitle className="text-foreground">All Orders ({filteredOrders.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredOrders.length === 0 ? (
            <div className="text-center py-12">
              <Receipt className="w-12 h-12 text-foreground/20 mx-auto mb-4" />
              <p className="text-muted-foreground">{orders.length === 0 ? 'No orders yet' : 'No orders match your filters'}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {paginatedOrders.map((order) => (
                <div key={order.id} className="border border-border/10 rounded-xl overflow-hidden">
                  {/* Order Row */}
                  <div 
                    className="p-4 hover:bg-muted/50 cursor-pointer flex flex-col md:flex-row md:items-center gap-4"
                    onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono font-medium text-foreground">{order.order_number}</span>
                        {getStatusBadge(order.status)}
                        {order.is_stripe_connect && <Badge className="bg-purple-100 text-purple-700 ml-1"><CreditCard className="w-3 h-3 mr-1" />Connect</Badge>}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        {order.event?.title && (
                          <span className="flex items-center gap-1" title="Event">
                            <Calendar className="w-4 h-4" />
                            {order.event.title}
                            {order.event.start_date && (
                              <span className="ml-1">• {formatDate(order.event.start_date)}</span>
                            )}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          {order.buyer_name || 'N/A'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Mail className="w-4 h-4" />
                          {order.buyer_email}
                        </span>
                        <span className="flex items-center gap-1" title="Order Date">
                          {formatDate(order.created_at)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-semibold text-foreground">
                          {formatPrice(order.total_amount, order.currency || order.event?.currency || getDefaultCurrency(order.event?.country_code || order.event?.country))}
                        </p>
                        <p className="text-sm text-muted-foreground">{order.ticketCount} ticket(s)</p>
                      </div>
                      {expandedOrder === order.id ? (
                        <ChevronUp className="w-5 h-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {expandedOrder === order.id && (
                    <div className="border-t border-border/10 bg-muted/30 p-4">
                      <div className="grid md:grid-cols-2 gap-6">
                        {/* Order Details */}
                        <div>
                          <h4 className="font-medium text-foreground mb-3">Order Details</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Event</span>
                              <span className="font-medium">{order.event?.title || 'Unknown'}</span>
                            </div>
                            {order.event?.start_date && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Event Date</span>
                                <span className="font-medium">{formatDate(order.event.start_date)}</span>
                              </div>
                            )}
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Payment Method</span>
                              <span className="font-medium capitalize">{order.payment_method || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Payment Reference</span>
                              <span className="font-mono text-xs">{maskPaymentRef(order.payment_reference)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Subtotal</span>
                              <span>{formatPrice(order.subtotal, order.currency || order.event?.currency || getDefaultCurrency(order.event?.country_code || order.event?.country))}</span>
                            </div>
                            {parseFloat(order.discount_amount) > 0 && (
                              <div className="flex justify-between text-green-600">
                                <span>Discount</span>
                                <span>-{formatPrice(order.discount_amount, order.currency || order.event?.currency || getDefaultCurrency(order.event?.country_code || order.event?.country))}</span>
                              </div>
                            )}
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Platform Fee</span>
                              <span>{formatPrice(order.platform_fee || 0, order.currency || order.event?.currency || getDefaultCurrency(order.event?.country_code || order.event?.country))}</span>
                            </div>
                            <div className="flex justify-between font-semibold border-t border-border/10 pt-2 mt-2">
                              <span>Total</span>
                              <span>{formatPrice(order.total_amount, order.currency || order.event?.currency || getDefaultCurrency(order.event?.country_code || order.event?.country))}</span>
                            </div>
                          </div>
                        </div>

                        {/* Attendees */}
                        <div>
                          <h4 className="font-medium text-foreground mb-3">Attendees ({order.tickets.length})</h4>
                          <div className="space-y-2">
                            {order.tickets.map((ticket) => (
                              <div key={ticket.id} className="p-3 bg-card rounded-lg border border-border/10">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <p className="font-medium text-foreground">{ticket.attendee_name}</p>
                                    <p className="text-xs text-muted-foreground">{ticket.attendee_email}</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {ticket.ticket_types?.name || 'Standard'} • {ticket.ticket_code}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    {ticket.is_checked_in ? (
                                      <Badge className="bg-green-100 text-green-700 text-xs">Checked In</Badge>
                                    ) : (
                                      <Badge className="bg-muted text-muted-foreground text-xs">Not Checked In</Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      {((order.status === 'completed' && parseFloat(order.total_amount) > 0) || order.status === 'refund_pending' || order.status === 'refunded') && (
                        <div className="mt-4 pt-4 border-t border-border/10 flex justify-end items-center gap-3">
                          {order.status === 'completed' && parseFloat(order.total_amount) > 0 && (
                            <Button 
                              variant="outline" 
                              className="rounded-xl text-red-600 border-red-200 hover:bg-red-50"
                              onClick={(e) => { e.stopPropagation(); handleRefundClick(order); }}
                            >
                              <RotateCcw className="w-4 h-4 mr-2" />
                              Request Refund
                            </Button>
                          )}
                          {order.status === 'refund_pending' && (
                            <Badge className="bg-yellow-100 text-yellow-700 rounded-lg px-3 py-1">
                              <Clock className="w-3 h-3 mr-1" />
                              Refund Pending Review
                            </Badge>
                          )}
                          {order.status === 'refunded' && (
                            <Badge className="bg-green-100 text-green-700 rounded-lg px-3 py-1">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Refunded
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          
          {/* Pagination */}
          {filteredOrders.length > 0 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              itemsPerPage={itemsPerPage}
              onPageChange={handlePageChange}
            />
          )}
        </CardContent>
      </Card>

      {/* Refund Dialog */}
      <Dialog open={refundDialog} onOpenChange={setRefundDialog}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Request Refund</DialogTitle>
            <DialogDescription>
              This will submit a refund request to Ticketrack Finance. The finance team will review and process the actual refund within 3-5 business days.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 bg-muted rounded-xl">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Order</span>
                <span className="font-mono">{refundOrder?.order_number}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-semibold">{formatPrice(refundOrder?.total_amount, refundOrder?.currency || refundOrder?.event?.currency || getDefaultCurrency(refundOrder?.event?.country_code || refundOrder?.event?.country))}</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Refund Reason *</Label>
              <Select value={refundReasonCategory} onValueChange={setRefundReasonCategory}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Select a reason..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {refundReasons.map((reason) => (
                    <SelectItem key={reason} value={reason}>{reason}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {refundReasonCategory === 'Other' && (
              <div className="space-y-2">
                <Label>Please explain *</Label>
                <Textarea 
                  placeholder="Enter the specific reason for this refund..."
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  className="rounded-xl"
                  rows={3}
                />
              </div>
            )}
            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-xl flex gap-2">
              <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              <p className="text-sm text-blue-800 dark:text-blue-300">
                Ticketrack Finance will process the actual refund. You and the attendee will be notified via email once completed.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundDialog(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button 
              onClick={processRefund} 
              disabled={!refundReasonCategory || (refundReasonCategory === 'Other' && !refundReason.trim()) || refunding}
              className="bg-red-600 hover:bg-red-700 text-white rounded-xl"
            >
              {refunding ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</> : 'Submit Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
