import { formatPrice } from '@/config/currencies'
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Ticket, Download, Share2, Mail, Calendar, MapPin, Loader2, ArrowLeft, CheckCircle, RotateCcw, AlertCircle, X, Clock, XCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { QRCodeSVG } from 'qrcode.react'
import { downloadTicketPDF } from '@/utils/ticketGenerator'

export function WebTickets() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [refundModal, setRefundModal] = useState({ open: false, ticket: null })
  const [refundReason, setRefundReason] = useState('')
  const [refundLoading, setRefundLoading] = useState(false)
  const [refundConfig, setRefundConfig] = useState(null)
  const [refundError, setRefundError] = useState('')
  const [ticketRefundStatus, setTicketRefundStatus] = useState({})
  const [escalateModal, setEscalateModal] = useState({ open: false, refund: null })
  const [escalateReason, setEscalateReason] = useState('')
  const [escalating, setEscalating] = useState(false)

  useEffect(() => {
    if (!user) {
      navigate('/login')
      return
    }
    loadTickets()
    loadRefundStatus()
  }, [user, navigate])

  const loadTickets = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('tickets')
        .select(`
          *,
          event:events(id, title, slug, start_date, end_date, venue_name, venue_address, city, image_url),
          ticket_type:ticket_types(name, price)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setTickets(data || [])
    } catch (error) {
      console.error('Error loading tickets:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatTime = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-700'
      case 'used': return 'bg-gray-100 text-gray-600'
      case 'expired': return 'bg-red-100 text-red-600'
      case 'cancelled': return 'bg-orange-100 text-orange-600'
      default: return 'bg-gray-100 text-gray-600'
    }
  }

  const getStatusLabel = (status) => {
    switch (status) {
      case 'active': return 'Active'
      case 'used': return 'Used'
      case 'expired': return 'Expired'
      case 'cancelled': return 'Cancelled'
      default: return status
    }
  }

  const isEventPast = (eventDate) => {
    if (!eventDate) return false
    return new Date(eventDate) < new Date()
  }

  // Download ticket as image
  const downloadTicket = (ticket) => {
    const ticketElement = document.getElementById(`ticket-${ticket.id}`)
    if (!ticketElement) return

    // Create canvas from the ticket card
    import('html2canvas').then(({ default: html2canvas }) => {
      html2canvas(ticketElement, { 
        scale: 2,
        backgroundColor: '#ffffff'
      }).then(canvas => {
        const link = document.createElement('a')
        link.download = `ticket-${ticket.ticket_code}.png`
        link.href = canvas.toDataURL('image/png')
        link.click()
      })
    }).catch(() => {
      // Fallback: download QR code only
      const svg = document.getElementById(`qr-${ticket.id}`)
      if (svg) {
        const svgData = new XMLSerializer().serializeToString(svg)
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        const img = new Image()
        img.onload = () => {
          canvas.width = img.width
          canvas.height = img.height
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(0, 0, canvas.width, canvas.height)
          ctx.drawImage(img, 0, 0)
          const link = document.createElement('a')
          link.download = `qr-${ticket.ticket_code}.png`
          link.href = canvas.toDataURL('image/png')
          link.click()
        }
        img.src = 'data:image/svg+xml;base64,' + btoa(svgData)
      }
    })
  }

  // Email ticket
  const emailTicket = (ticket) => {
    const subject = encodeURIComponent(`Your Ticket for ${ticket.event?.title}`)
    const body = encodeURIComponent(
      `Here are your ticket details:\n\n` +
      `Event: ${ticket.event?.title}\n` +
      `Date: ${formatDate(ticket.event?.start_date)}\n` +
      `Time: ${formatTime(ticket.event?.start_date)}\n` +
      `Venue: ${ticket.event?.venue_name}, ${ticket.event?.city}\n` +
      `Ticket Type: ${ticket.ticket_type?.name || 'General'}\n` +
      `QR Code: ${ticket.ticket_code}\n\n` +
      `Please show your QR code at the venue entrance.`
    )
    window.location.href = `mailto:${ticket.attendee_email}?subject=${subject}&body=${body}`
  }

  // Share ticket
  const shareTicket = async (ticket) => {
    const shareData = {
      title: `Ticket for ${ticket.event?.title}`,
      text: `I'm attending ${ticket.event?.title} on ${formatDate(ticket.event?.start_date)}!`,
      url: window.location.href
    }

    if (navigator.share) {
      try {
        await navigator.share(shareData)
      } catch (err) {
        console.log('Share cancelled')
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(`${shareData.text}\n${shareData.url}`)
      alert('Link copied to clipboard!')
    }
  }

  

  // Check if ticket is eligible for refund
  const checkRefundEligibility = async (ticket) => {
    try {
      // Get event details with refund settings
      const { data: event } = await supabase
        .from('events')
        .select('allow_refunds, refund_deadline_hours, start_date, country_code')
        .eq('id', ticket.event_id)
        .single();

      if (!event) return { eligible: false, reason: 'Event not found' };
      if (!event.allow_refunds) return { eligible: false, reason: 'This event does not allow refunds' };

      const eventStart = new Date(event.start_date);
      const now = new Date();
      const hoursUntilEvent = (eventStart - now) / (1000 * 60 * 60);

      if (hoursUntilEvent <= 0) return { eligible: false, reason: 'Event has already started' };
      if (hoursUntilEvent < (event.refund_deadline_hours || 48)) {
        return { eligible: false, reason: 'Refund deadline has passed (' + (event.refund_deadline_hours || 48) + ' hours before event)' };
      }

      // Check if refund already requested
      const { data: existingRefund } = await supabase
        .from('refund_requests')
        .select('id, status')
        .eq('ticket_id', ticket.id)
        .in('status', ['pending', 'approved'])
        .single();

      if (existingRefund) return { eligible: false, reason: 'Refund already requested for this ticket' };

      // Get refund fee config
      const { data: feeConfig } = await supabase
        .from('country_features')
        .select('config')
        .eq('country_code', event.country_code || 'NG')
        .eq('feature_id', 'refund_fee')
        .single();

      const config = feeConfig?.config || { fee_type: 'percentage', fee_value: 5, min_fee: 0, max_fee: 99999 };
      const ticketPrice = ticket.total_price || ticket.ticket_type?.price || 0;
      
      let fee = config.fee_type === 'percentage' 
        ? ticketPrice * (config.fee_value / 100) 
        : config.fee_value;
      fee = Math.max(config.min_fee || 0, Math.min(config.max_fee || 99999, fee));
      
      return { 
        eligible: true, 
        config,
        originalAmount: ticketPrice,
        refundFee: fee,
        refundAmount: ticketPrice - fee,
        currency: ticket.currency || 'NGN'
      };
    } catch (error) {
      console.error('Error checking refund eligibility:', error);
      return { eligible: false, reason: 'Unable to check refund eligibility' };
    }
  };

  const openRefundModal = async (ticket) => {
    setRefundError('');
    setRefundReason('');
    const eligibility = await checkRefundEligibility(ticket);
    
    if (!eligibility.eligible) {
      setRefundError(eligibility.reason);
      setRefundModal({ open: true, ticket, eligible: false });
    } else {
      setRefundConfig(eligibility);
      setRefundModal({ open: true, ticket, eligible: true });
    }
  };

  const submitRefundRequest = async () => {
    if (!refundReason.trim()) {
      setRefundError('Please provide a reason for your refund request');
      return;
    }

    setRefundLoading(true);
    setRefundError('');

    try {
      const ticket = refundModal.ticket;
      
      // Get order and organizer info
      const { data: orderData } = await supabase
        .from('orders')
        .select('id, payment_reference, organizer_id')
        .eq('id', ticket.order_id)
        .single();

      const { error } = await supabase
        .from('refund_requests')
        .insert({
          order_id: ticket.order_id,
          user_id: user.id,
          ticket_id: ticket.id,
          event_id: ticket.event_id,
          organizer_id: orderData?.organizer_id,
          original_amount: refundConfig.originalAmount,
          refund_fee: refundConfig.refundFee,
          amount: refundConfig.refundAmount,
          currency: refundConfig.currency,
          reason: refundReason.trim(),
          status: 'pending',
          organizer_decision: 'pending',
          payment_reference: orderData?.payment_reference
        });

      if (error) throw error;

      setRefundModal({ open: false, ticket: null });
      setRefundReason('');
      alert('Refund request submitted successfully! You will be notified once the organizer reviews your request.');
      loadTickets();
    } catch (error) {
      console.error('Error submitting refund:', error);
      setRefundError('Failed to submit refund request. Please try again.');
    } finally {
      setRefundLoading(false);
    }
  };

  

  // Load refund status for all tickets
  const loadRefundStatus = async () => {
    try {
      const { data } = await supabase
        .from('refund_requests')
        .select('id, ticket_id, status, organizer_decision, escalated_to_admin, amount, reason, organizer_notes')
        .eq('user_id', user.id);
      
      const statusMap = {};
      (data || []).forEach(r => {
        statusMap[r.ticket_id] = r;
      });
      setTicketRefundStatus(statusMap);
    } catch (err) {
      console.error('Error loading refund status:', err);
    }
  };

  // Escalate refund to admin
  const escalateRefund = async () => {
    if (!escalateReason.trim()) {
      alert('Please provide a reason for escalation');
      return;
    }
    setEscalating(true);
    try {
      await supabase
        .from('refund_requests')
        .update({
          escalated_to_admin: true,
          escalation_reason: escalateReason.trim(),
          escalated_at: new Date().toISOString(),
          status: 'escalated'
        })
        .eq('id', escalateModal.refund.id);
      
      setEscalateModal({ open: false, refund: null });
      setEscalateReason('');
      alert('Your refund has been escalated to admin for review.');
      loadRefundStatus();
    } catch (err) {
      console.error('Error escalating:', err);
      alert('Failed to escalate. Please try again.');
    } finally {
      setEscalating(false);
    }
  };

  const activeTickets = tickets.filter(t => t.status === 'active' && !isEventPast(t.event?.end_date))
  const pastTickets = tickets.filter(t => t.status !== 'active' || isEventPast(t.event?.end_date))

  const TicketCard = ({ ticket }) => {
    const isPast = isEventPast(ticket.event?.end_date)
    const qrValue = JSON.stringify({
      ticketId: ticket.id,
      qrCode: ticket.ticket_code,
      eventId: ticket.event_id,
      attendee: ticket.attendee_name
    })
    
    return (
      <Card id={`ticket-${ticket.id}`} className="border-[#0F0F0F]/10 rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
        {/* Header */}
        <CardHeader className="bg-gradient-to-r from-[#2969FF] to-[#2969FF]/80 text-white p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-white mb-1 text-lg line-clamp-1">{ticket.event?.title}</CardTitle>
              <div className="flex items-center gap-2 text-white/80 text-xs">
                <Calendar className="w-3 h-3" />
                <span>{formatDate(ticket.event?.start_date)}</span>
              </div>
            </div>
            <Badge className={`${getStatusColor(isPast ? 'used' : ticket.status)} capitalize text-xs`}>
              {isPast ? 'Past' : getStatusLabel(ticket.status)}
            </Badge>
          </div>
        </CardHeader>

        {/* Content */}
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Ticket Details */}
            <div className="md:col-span-2 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-[#0F0F0F]/60">Order Number</p>
                <p className="text-[#0F0F0F] font-mono">{ticket.order?.order_number || `TKT-${ticket.id.slice(0, 8).toUpperCase()}`}</p>
              </div>
              <div>
                <p className="text-xs text-[#0F0F0F]/60">Ticket Type</p>
                <p className="text-[#0F0F0F]">{ticket.ticket_type?.name || 'General'}</p>
              </div>
              <div>
                <p className="text-xs text-[#0F0F0F]/60">Event Time</p>
                <p className="text-[#0F0F0F]">{formatTime(ticket.event?.start_date)}</p>
              </div>
              <div>
                <p className="text-xs text-[#0F0F0F]/60">Attendee</p>
                <p className="text-[#0F0F0F]">{ticket.attendee_name}</p>
              </div>
              <div>
                <p className="text-xs text-[#0F0F0F]/60">Transaction ID</p>
                <p className="text-[#0F0F0F] font-mono text-xs">{ticket.payment_reference || "N/A"}</p>
              </div>
              <div>
                <p className="text-xs text-[#0F0F0F]/60">Amount Paid</p>
                <p className="text-[#0F0F0F]">{ticket.payment_status === "free" ? "Free" : formatPrice(ticket.total_price || 0, ticket.currency)}</p>
              </div>
              <div>
                <p className="text-xs text-[#0F0F0F]/60">Payment Method</p>
                <p className="text-[#0F0F0F] capitalize">{ticket.payment_method || "N/A"}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-[#0F0F0F]/60">Venue</p>
                <p className="text-[#0F0F0F] text-sm flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {ticket.event?.venue_name}, {ticket.event?.city}
                </p>
              </div>
            </div>

            {/* QR Code */}
            <div className="flex flex-col items-center justify-center bg-[#F4F6FA] rounded-xl p-3">
              <div className="bg-white rounded-lg p-2 border border-[#0F0F0F]/10 mb-2">
                <QRCodeSVG 
                  id={`qr-${ticket.id}`}
                  value={qrValue}
                  size={100}
                  level="H"
                  includeMargin={true}
                />
              </div>
              <p className="text-xs text-[#0F0F0F]/60 text-center font-mono">{ticket.ticket_code}</p>
              <p className="text-xs text-[#0F0F0F]/40 text-center mt-1">Scan at venue</p>
            </div>
          </div>

          {/* Actions */}
          {ticket.status === 'active' && !isPast && (
            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-[#0F0F0F]/10">
              <Button 
                size="sm" 
                variant="outline" 
                className="rounded-xl border-[#0F0F0F]/10 flex items-center gap-2 text-xs"
                onClick={() => downloadTicket(ticket)}
              >
                <Download className="w-3 h-3" />Image
              </Button>
              <Button 
                size="sm" 
                className="bg-[#2969FF] hover:bg-[#1a4fd8] text-white rounded-xl flex items-center gap-2 text-xs"
                onClick={() => downloadTicketPDF(ticket, ticket.event, ticket.ticket_type)}
              >
                <Download className="w-3 h-3" />PDF Ticket
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                className="rounded-xl border-[#0F0F0F]/10 flex items-center gap-2 text-xs"
                onClick={() => emailTicket(ticket)}
              >
                <Mail className="w-3 h-3" />Email
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                className="rounded-xl border-[#0F0F0F]/10 flex items-center gap-2 text-xs"
                onClick={() => shareTicket(ticket)}
              >
                <Share2 className="w-3 h-3" />Share
              </Button>
              {!ticketRefundStatus[ticket.id] ? (
                <Button 
                  size="sm" 
                  variant="outline"
                  className="rounded-xl border-orange-300 text-orange-600 hover:bg-orange-50 flex items-center gap-2 text-xs"
                  onClick={() => openRefundModal(ticket)}
                >
                  <RotateCcw className="w-3 h-3" />Refund
                </Button>
              ) : (
                <Button 
                  size="sm" 
                  variant="outline"
                  disabled
                  className="rounded-xl border-yellow-300 text-yellow-600 bg-yellow-50 flex items-center gap-2 text-xs cursor-not-allowed"
                >
                  <Clock className="w-3 h-3" />
                  {ticketRefundStatus[ticket.id].refund_reference ? 'Refunded' : 
                   ticketRefundStatus[ticket.id].status === 'approved' ? 'Refund Approved' :
                   ticketRefundStatus[ticket.id].status === 'rejected' ? 'Refund Rejected' :
                   'Refund Requested'}
                </Button>
              )}
              <Button 
                size="sm" 
                className="bg-[#2969FF] hover:bg-[#1a4fd8] text-white rounded-xl ml-auto text-xs"
                onClick={() => navigate(`/event/${ticket.event?.slug}`)}
              >
                View Event
              </Button>
            </div>
          )}

          {/* Refund Status */}
          {ticketRefundStatus[ticket.id] && (
            <div className="mt-4 pt-4 border-t border-[#0F0F0F]/10">
              {ticketRefundStatus[ticket.id].status === 'pending' || ticketRefundStatus[ticket.id].organizer_decision === 'pending' ? (
                <div className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-xl">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-yellow-600" />
                    <span className="text-sm text-yellow-800">Refund request pending</span>
                  </div>
                </div>
              ) : ticketRefundStatus[ticket.id].status === 'approved' ? (
                <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-xl">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-sm text-green-800">Refund approved - processing</span>
                  </div>
                </div>
              ) : ticketRefundStatus[ticket.id].status === 'rejected' && !ticketRefundStatus[ticket.id].escalated_to_admin ? (
                <div className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-xl">
                  <div>
                    <div className="flex items-center gap-2">
                      <XCircle className="w-4 h-4 text-red-600" />
                      <span className="text-sm text-red-800">Refund rejected</span>
                    </div>
                    {ticketRefundStatus[ticket.id].organizer_notes && (
                      <p className="text-xs text-red-600 mt-1">Reason: {ticketRefundStatus[ticket.id].organizer_notes}</p>
                    )}
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="rounded-xl border-red-300 text-red-600 hover:bg-red-100 text-xs"
                    onClick={() => setEscalateModal({ open: true, refund: ticketRefundStatus[ticket.id] })}
                  >
                    Escalate to Admin
                  </Button>
                </div>
              ) : ticketRefundStatus[ticket.id].escalated_to_admin ? (
                <div className="flex items-center justify-between p-3 bg-purple-50 border border-purple-200 rounded-xl">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-purple-600" />
                    <span className="text-sm text-purple-800">Escalated to admin - under review</span>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <Button variant="ghost" className="mb-4 text-[#0F0F0F]/60 hover:text-[#0F0F0F] -ml-2" onClick={() => navigate('/profile')}>
          <ArrowLeft className="w-4 h-4 mr-2" />Back to Profile
        </Button>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-[#2969FF]/10 rounded-xl flex items-center justify-center">
            <Ticket className="w-6 h-6 text-[#2969FF]" />
          </div>
          <h1 className="text-4xl font-bold text-[#0F0F0F]">My Tickets</h1>
        </div>
        <p className="text-[#0F0F0F]/60">View and manage all your event tickets in one place</p>
      </div>

      {/* Content */}
      {tickets.length === 0 ? (
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-20 h-20 bg-[#F4F6FA] rounded-full flex items-center justify-center mb-4">
              <Ticket className="w-10 h-10 text-[#0F0F0F]/40" />
            </div>
            <h3 className="text-xl font-semibold text-[#0F0F0F] mb-2">No tickets yet</h3>
            <p className="text-[#0F0F0F]/60 mb-6 text-center">Start exploring events and book your first ticket</p>
            <Button onClick={() => navigate('/events')} className="bg-[#2969FF] hover:bg-[#1a4fd8] text-white rounded-xl">
              Browse Events
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="active" className="space-y-6">
          <TabsList className="bg-white border border-[#0F0F0F]/10 rounded-xl p-1">
            <TabsTrigger value="active" className="rounded-lg data-[state=active]:bg-[#2969FF] data-[state=active]:text-white">
              Active ({activeTickets.length})
            </TabsTrigger>
            <TabsTrigger value="past" className="rounded-lg data-[state=active]:bg-[#2969FF] data-[state=active]:text-white">
              Past ({pastTickets.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-6">
            {activeTickets.length === 0 ? (
              <Card className="border-[#0F0F0F]/10 rounded-2xl">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <div className="w-16 h-16 bg-[#F4F6FA] rounded-full flex items-center justify-center mb-4">
                    <Ticket className="w-8 h-8 text-[#0F0F0F]/40" />
                  </div>
                  <h3 className="text-lg font-semibold text-[#0F0F0F] mb-2">No active tickets</h3>
                  <p className="text-[#0F0F0F]/60 mb-4">Your upcoming event tickets will appear here</p>
                  <Button onClick={() => navigate('/events')} variant="outline" className="rounded-xl">
                    Browse Events
                  </Button>
                </CardContent>
              </Card>
            ) : (
              activeTickets.map(ticket => <TicketCard key={ticket.id} ticket={ticket} />)
            )}
          </TabsContent>

          <TabsContent value="past" className="space-y-6">
            {pastTickets.length === 0 ? (
              <Card className="border-[#0F0F0F]/10 rounded-2xl">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <p className="text-[#0F0F0F]/60">No past tickets</p>
                </CardContent>
              </Card>
            ) : (
              pastTickets.map(ticket => <TicketCard key={ticket.id} ticket={ticket} />)
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Refund Request Modal */}
      <Dialog open={refundModal.open} onOpenChange={(o) => { if(!o) setRefundModal({ open: false, ticket: null }); }}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-orange-500" />
              Request Refund
            </DialogTitle>
          </DialogHeader>
          
          {refundModal.ticket && (
            <div className="space-y-4">
              {/* Ticket Info */}
              <div className="p-3 bg-[#F4F6FA] rounded-xl">
                <p className="font-medium text-[#0F0F0F]">{refundModal.ticket.event?.title}</p>
                <p className="text-sm text-[#0F0F0F]/60">{refundModal.ticket.ticket_type?.name} - {refundModal.ticket.attendee_name}</p>
              </div>

              {!refundModal.eligible ? (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-red-700">Refund Not Available</p>
                      <p className="text-sm text-red-600 mt-1">{refundError}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Refund Breakdown */}
                  <div className="space-y-2 p-3 border border-[#0F0F0F]/10 rounded-xl">
                    <div className="flex justify-between text-sm">
                      <span className="text-[#0F0F0F]/60">Original Amount</span>
                      <span className="text-[#0F0F0F]">{formatPrice(refundConfig?.originalAmount || 0, refundConfig?.currency)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[#0F0F0F]/60">Processing Fee</span>
                      <span className="text-red-600">-{formatPrice(refundConfig?.refundFee || 0, refundConfig?.currency)}</span>
                    </div>
                    <hr className="border-[#0F0F0F]/10" />
                    <div className="flex justify-between font-medium">
                      <span className="text-[#0F0F0F]">Refund Amount</span>
                      <span className="text-green-600">{formatPrice(refundConfig?.refundAmount || 0, refundConfig?.currency)}</span>
                    </div>
                  </div>

                  {/* Reason */}
                  <div>
                    <label className="text-sm font-medium text-[#0F0F0F]">Reason for refund *</label>
                    <Textarea 
                      value={refundReason}
                      onChange={(e) => setRefundReason(e.target.value)}
                      placeholder="Please explain why you're requesting a refund..."
                      className="mt-1 rounded-xl resize-none"
                      rows={3}
                    />
                  </div>

                  {refundError && (
                    <p className="text-sm text-red-600">{refundError}</p>
                  )}

                  <p className="text-xs text-[#0F0F0F]/60">
                    Your request will be reviewed by the event organizer. Approved refunds are typically processed within 5-7 business days.
                  </p>
                </>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundModal({ open: false, ticket: null })} className="rounded-xl">
              {refundModal.eligible ? 'Cancel' : 'Close'}
            </Button>
            {refundModal.eligible && (
              <Button 
                onClick={submitRefundRequest} 
                disabled={refundLoading}
                className="bg-orange-500 hover:bg-orange-600 text-white rounded-xl"
              >
                {refundLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit Request'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
