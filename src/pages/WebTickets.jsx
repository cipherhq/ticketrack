import { formatPrice, getDefaultCurrency } from '@/config/currencies'
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Ticket, Download, Share2, Mail, Calendar, MapPin, Loader2, ArrowLeft, CheckCircle, RotateCcw, AlertCircle, X, Clock, XCircle, Monitor, ExternalLink, Send, Copy, Wallet, Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { QRCodeSVG } from 'qrcode.react'
import { downloadTicketPDF } from '@/utils/ticketGenerator'
import { WalletButtons } from '@/components/WalletButtons'
import { toast } from 'sonner'

// Helper to truncate long references with copy functionality
const TruncatedRef = ({ value, maxLength = 20 }) => {
  const [copied, setCopied] = useState(false)
  
  if (!value || value === 'N/A') return <span>N/A</span>
  
  const isLong = value.length > maxLength
  const displayValue = isLong 
    ? `${value.slice(0, 12)}...${value.slice(-4)}` 
    : value
  
  const handleCopy = () => {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  
  return (
    <span className="inline-flex items-center gap-1">
      <span 
        className="cursor-help" 
        title={value}
      >
        {displayValue}
      </span>
      {isLong && (
        <button
          onClick={handleCopy}
          className="text-foreground/30 hover:text-[#2969FF] transition-colors p-0.5"
          title="Copy full reference"
        >
          {copied ? '✓' : <Copy className="w-3 h-3" />}
        </button>
      )}
    </span>
  )
}

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
  const [transferModal, setTransferModal] = useState({ open: false, ticket: null })
  const [transferEmail, setTransferEmail] = useState('')
  const [transferLoading, setTransferLoading] = useState(false)
  const [transferError, setTransferError] = useState('')
  const [transferFee, setTransferFee] = useState(0)
  const [transferCurrency, setTransferCurrency] = useState('NGN')
  const [transferredOutTickets, setTransferredOutTickets] = useState([])

  useEffect(() => {
    if (!user) {
      navigate('/login')
      return
    }
    loadTickets()
    loadRefundStatus()
    loadTransferredOut()
  }, [user, navigate])

  const loadTickets = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('tickets')
        .select(`
          *,
          event:events(id, title, slug, start_date, end_date, venue_name, venue_address, city, image_url, is_virtual, streaming_url, streaming_platform, is_free, allow_transfers, event_sponsors(id, name, logo_url, website_url, sort_order)),
          ticket_type:ticket_types(name, price),
          order:orders(id, order_number, total_amount, is_donation, currency)
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
      case 'used': return 'bg-muted text-muted-foreground'
      case 'expired': return 'bg-red-100 text-red-600'
      case 'cancelled': return 'bg-orange-100 text-orange-600'
      default: return 'bg-muted text-muted-foreground'
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
    const venueDisplay = ticket.event?.is_virtual 
      ? 'Virtual Event (Online)' 
      : [ticket.event?.venue_name, ticket.event?.venue_address, ticket.event?.city].filter(Boolean).join(', ') || 'Venue TBA'
    const body = encodeURIComponent(
      `Here are your ticket details:\n\n` +
      `Event: ${ticket.event?.title}\n` +
      `Date: ${formatDate(ticket.event?.start_date)}\n` +
      `Time: ${formatTime(ticket.event?.start_date)}\n` +
      `Venue: ${venueDisplay}\n` +
      `Ticket Type: ${ticket.ticket_type?.name || 'General'}\n` +
      `QR Code: ${ticket.ticket_code}\n\n` +
      `Please show your QR code at the venue entrance.`
    )
    window.location.href = `mailto:${ticket.attendee_email}?subject=${subject}&body=${body}`
  }

  // Load tickets user has transferred out
  const loadTransferredOut = async () => {
    try {
      // Get all transfer data in a SINGLE query with PostgREST joins
      // This avoids N+1 queries (was: 2N+1 queries, now: 1 query)
      const { data, error } = await supabase
        .from('ticket_transfers')
        .select(`
          *,
          ticket:tickets!ticket_id (
            id, ticket_code, attendee_name,
            event:events (id, title, slug, start_date, image_url)
          ),
          to_user:profiles!to_user_id (full_name, email)
        `)
        .eq('from_user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error loading transfers:', error)
        return
      }

      setTransferredOutTickets(data || [])
    } catch (err) {
      console.error('Error loading transferred tickets:', err)
    }
  }

  // Transfer ticket to another user
  const openTransferModal = async (ticket) => {
    setTransferError('')
    setTransferEmail('')
    
    // Check if event allows transfers
    const { data: event } = await supabase
      .from('events')
      .select('allow_transfers, currency')
      .eq('id', ticket.event_id)
      .single()
    
    if (!event?.allow_transfers) {
      toast.error('Ticket transfers are disabled for this event')
      return
    }
    
    if (ticket.transfer_count >= (event.max_transfers || 2)) {
      toast.error('Maximum transfer limit reached for this ticket')
      return
    }
    
    // Get transfer fee from fee configuration
    const currency = event?.currency || getDefaultCurrency(event?.country_code || event?.country)
    const { calculateTransferFee, getFeesByCurrency } = await import('@/config/fees')
    const fees = await getFeesByCurrency(currency)
    const ticketPrice = ticket.total_price || 0
    const feeCalculation = calculateTransferFee(ticketPrice, fees)
    
    setTransferFee(feeCalculation.transferFee)
    setTransferCurrency(currency)
    
    setTransferModal({ open: true, ticket })
  }
  
  const handleTransfer = async () => {
    if (!transferEmail.trim()) {
      setTransferError('Please enter recipient email')
      return
    }
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(transferEmail)) {
      setTransferError('Please enter a valid email address')
      return
    }
    
    setTransferLoading(true)
    setTransferError('')
    
    try {
      // Check if payment is required
      if (transferFee > 0) {
        // Initiate Paystack payment
        const reference = 'TRF-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6).toUpperCase()
        
        // Get Paystack public key
        const { data: config } = await supabase
          .from('payment_gateway_config')
          .select('public_key')
          .eq('provider', 'paystack')
          .eq('is_active', true)
          .limit(1)
          .single()
        
        if (!config?.public_key) {
          setTransferError('Payment not configured. Contact support.')
          setTransferLoading(false)
          return
        }
        
        // Load Paystack if not loaded
        if (!window.PaystackPop) {
          const script = document.createElement('script')
          script.src = 'https://js.paystack.co/v1/inline.js'
          script.async = true
          await new Promise((resolve, reject) => {
            script.onload = resolve
            script.onerror = reject
            document.body.appendChild(script)
          })
        }
        
        // Initialize Paystack popup
        const handler = window.PaystackPop.setup({
          key: config.public_key,
          email: user.email,
          amount: Math.round(transferFee * 100), // Paystack uses kobo
          currency: transferCurrency,
          ref: reference,
          metadata: {
            type: 'ticket_transfer',
            ticket_id: transferModal.ticket.id,
            recipient_email: transferEmail.trim().toLowerCase()
          },
          callback: async (response) => {
            // Payment successful - complete transfer
            await completeTransfer(response.reference)
          },
          onClose: () => {
            setTransferLoading(false)
          }
        })
        handler.openIframe()
      } else {
        // Free transfer - proceed directly
        await completeTransfer(null)
      }
    } catch (err) {
      console.error('Transfer error:', err)
      setTransferError('Failed to initiate transfer. Please try again.')
      setTransferLoading(false)
    }
  }
  
  // Complete transfer after payment
  const completeTransfer = async (paymentReference) => {
    try {
      const { data, error } = await supabase.rpc('transfer_ticket', {
        p_ticket_id: transferModal.ticket.id,
        p_from_user_id: user.id,
        p_to_user_email: transferEmail.trim().toLowerCase(),
        p_payment_reference: paymentReference
      })
      
      if (error) throw error
      
      if (data?.success) {
        // Send transfer emails to both sender and recipient
        const ticket = transferModal.ticket
        const eventData = ticket.event
        
        // Email to sender (current user)
        try {
          await supabase.functions.invoke('send-email', {
            body: {
              type: 'ticket_transfer_sent',
              to: user.email,
              data: {
                senderName: ticket.attendee_name || user.email,
                recipientName: data.recipient_name,
                recipientEmail: data.recipient_email,
                eventTitle: eventData?.title,
                eventDate: eventData?.start_date,
                ticketType: ticket.ticket_type?.name || 'General',
                appUrl: window.location.origin
              }
            }
          })
        } catch (emailErr) {
          console.error('Failed to send sender notification:', emailErr)
        }
        
        // Email to recipient
        try {
          await supabase.functions.invoke('send-email', {
            body: {
              type: 'ticket_transfer_received',
              to: data.recipient_email,
              data: {
                senderName: ticket.attendee_name || user.email,
                recipientName: data.recipient_name,
                eventTitle: eventData?.title,
                eventDate: eventData?.start_date,
                ticketType: ticket.ticket_type?.name || 'General',
                appUrl: window.location.origin
              }
            }
          })
        } catch (emailErr) {
          console.error('Failed to send recipient notification:', emailErr)
        }
        
        toast.success(`Ticket transferred to ${data.recipient_name} (${data.recipient_email})`)
        setTransferModal({ open: false, ticket: null })
        setTransferEmail('')
        loadTickets()
        loadTransferredOut()
      } else {
        setTransferError(data?.message || 'Transfer failed')
      }
    } catch (err) {
      console.error('Transfer error:', err)
      setTransferError('Failed to complete transfer. Please try again.')
    } finally {
      setTransferLoading(false)
    }
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
      toast.success('Link copied to clipboard!')
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
        currency: ticket.currency || ticket.event?.currency || getDefaultCurrency(ticket.event?.country_code || ticket.event?.country)
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

      // Notify organizer about the refund request
      try {
        const session = await supabase.auth.getSession();
        
        // Get organizer's email
        const { data: organizerData } = await supabase
          .from('organizers')
          .select('user_id, business_name')
          .eq('id', orderData?.organizer_id)
          .single();
        
        if (organizerData?.user_id) {
          const { data: organizerProfile } = await supabase
            .from('profiles')
            .select('email')
            .eq('id', organizerData.user_id)
            .single();
          
          if (organizerProfile?.email) {
            await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + session.data.session?.access_token
              },
              body: JSON.stringify({
                type: 'refund_request',
                to: organizerProfile.email,
                data: {
                  eventTitle: ticket.event?.title,
                  attendeeName: ticket.attendee_name,
                  ticketType: ticket.ticket_type?.name,
                  amount: refundConfig.refundAmount,
                  reason: refundReason.trim(),
                  appUrl: window.location.origin
                }
              })
            });
          }
        }
      } catch (emailErr) {
        console.error('Failed to send organizer notification:', emailErr);
      }

      setRefundModal({ open: false, ticket: null });
      setRefundReason('');
      toast.success('Refund request submitted! You will be notified once reviewed.');
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
      toast.error('Please provide a reason for escalation');
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
      toast.success('Your refund has been escalated to admin for review.');
      loadRefundStatus();
    } catch (err) {
      console.error('Error escalating:', err);
      toast.error('Failed to escalate. Please try again.');
    } finally {
      setEscalating(false);
    }
  };

  const activeTickets = tickets.filter(t => t.status === 'active' && !isEventPast(t.event?.end_date))
  const pastTickets = tickets.filter(t => t.status !== 'active' || isEventPast(t.event?.end_date))

  const TicketCard = ({ ticket }) => {
    const isPast = isEventPast(ticket.event?.end_date)
    // QR code contains just the ticket code - matches PDF ticket
    // This creates a cleaner, more scannable QR code
    const qrValue = ticket.ticket_code
    
    return (
      <Card id={`ticket-${ticket.id}`} className="border-border/10 rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
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
            <div className="flex flex-col items-end gap-1">
              <Badge className={`${getStatusColor(isPast ? 'used' : ticket.status)} capitalize text-xs`}>
                {isPast ? 'Past' : getStatusLabel(ticket.status)}
              </Badge>
              {ticket.transfer_count > 0 && (
                <Badge className="bg-purple-100 text-purple-700 text-xs">
                  Received
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        {/* Content */}
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Ticket Details */}
            <div className="md:col-span-2 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Order Number</p>
                <p className="text-foreground font-mono">{ticket.order?.order_number || `TKT-${ticket.id.slice(0, 8).toUpperCase()}`}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ticket Type</p>
                <p className="text-foreground">{ticket.ticket_type?.name || 'General'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Event Time</p>
                <p className="text-foreground">{formatTime(ticket.event?.start_date)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Attendee</p>
                <p className="text-foreground">{ticket.attendee_name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Transaction ID</p>
                <p className="text-foreground font-mono text-xs">
                  <TruncatedRef value={ticket.payment_reference} />
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Amount Paid</p>
                <p className="text-foreground">{ticket.payment_status === "free" ? "Free" : formatPrice(ticket.total_price || 0, ticket.order?.currency || ticket.currency)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Payment Method</p>
                <p className="text-foreground capitalize">{ticket.payment_method || "N/A"}</p>
              </div>
              {/* Show donation amount for free events with donations */}
              {ticket.event?.is_free && ticket.order?.is_donation && ticket.order?.total_amount > 0 && (
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">Your Donation</p>
                  <p className="text-green-600 font-semibold flex items-center gap-1">
                    <span className="text-lg">💚</span>
                    {formatPrice(ticket.order.total_amount, ticket.order.currency || ticket.currency)}
                    <span className="text-xs font-normal text-muted-foreground ml-1">Thank you!</span>
                  </p>
                </div>
              )}
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground">{ticket.event?.is_virtual ? 'Event Type' : 'Venue'}</p>
                {ticket.event?.is_virtual ? (
                  <p className="text-foreground text-sm flex items-center gap-1">
                    <Monitor className="w-3 h-3 text-purple-600" />
                    Virtual Event (Online)
                  </p>
                ) : (
                  <div className="text-foreground text-sm flex items-start gap-1">
                    <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    <span className="break-words">
                      {[ticket.event?.venue_name, ticket.event?.venue_address, ticket.event?.city].filter(Boolean).join(', ') || 'Venue TBA'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Virtual Event - Join Button */}
            {ticket.event?.is_virtual && ticket.event?.streaming_url && (
              <div className="mb-3 p-3 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl border border-purple-200">
                <a
                  href={ticket.event.streaming_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors text-sm"
                >
                  <ExternalLink className="w-4 h-4" />
                  Join Virtual Event
                </a>
              </div>
            )}

            {/* QR Code */}
            <div className="flex flex-col items-center justify-center bg-muted rounded-xl p-3">
              <div className="bg-card rounded-lg p-2 border border-border/10 mb-2">
                <QRCodeSVG 
                  id={`qr-${ticket.id}`}
                  value={qrValue}
                  size={100}
                  level="M"
                  includeMargin={true}
                />
              </div>
              <p className="text-xs text-muted-foreground text-center font-mono">{ticket.ticket_code}</p>
              <p className="text-xs text-muted-foreground text-center mt-1">Scan at venue</p>
            </div>
          </div>

          {/* Event Sponsors */}
          {ticket.event?.event_sponsors && ticket.event.event_sponsors.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border/10">
              <p className="text-xs text-muted-foreground mb-2">Event Sponsors</p>
              <div className="flex flex-wrap gap-3 items-center">
                {ticket.event.event_sponsors
                  .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
                  .slice(0, 6)
                  .map((sponsor) => (
                    <a
                      key={sponsor.id}
                      href={sponsor.website_url || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-card rounded-lg p-2 border border-border/10 hover:shadow-sm transition-shadow"
                      title={sponsor.name}
                    >
                      <img 
                        src={sponsor.logo_url} 
                        alt={sponsor.name}
                        className="h-8 w-auto max-w-[80px] object-contain"
                        onError={(e) => { e.target.style.display = 'none' }}
                      />
                    </a>
                  ))
                }
              </div>
            </div>
          )}

          {/* Actions */}
          {ticket.status === 'active' && !isPast && (
            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border/10">
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
                className="rounded-xl border-border/10 flex items-center gap-2 text-xs"
                onClick={() => shareTicket(ticket)}
              >
                <Share2 className="w-3 h-3" />Share
              </Button>
              
              {/* Smart Wallet Button - Shows Apple/Google based on device */}
              <WalletButtons ticket={ticket} event={ticket.event} size="sm" singleButton={true} />
              {/* Only show transfer button if event allows transfers and ticket hasn't been transferred */}
              {ticket.event?.allow_transfers && ticket.transfer_count === 0 && (
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl border-purple-300 text-purple-600 hover:bg-purple-50 flex items-center gap-2 text-xs"
                onClick={() => openTransferModal(ticket)}
              >
                <Send className="w-3 h-3" />Ticket Transfer
              </Button>
              )}
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
            <div className="mt-4 pt-4 border-t border-border/10">
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
        <Button variant="ghost" className="mb-4 text-muted-foreground hover:text-foreground -ml-2" onClick={() => navigate('/profile')}>
          <ArrowLeft className="w-4 h-4 mr-2" />Back to Profile
        </Button>
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-[#2969FF]/10 rounded-xl flex items-center justify-center">
              <Ticket className="w-6 h-6 text-[#2969FF]" />
            </div>
            <h1 className="text-4xl font-bold text-foreground">My Tickets</h1>
          </div>
          <Button 
            variant="outline" 
            className="rounded-xl border-purple-200 text-purple-600 hover:bg-purple-50"
            onClick={() => navigate('/my-groups')}
          >
            <Users className="w-4 h-4 mr-2" />
            My Groups
          </Button>
        </div>
        <p className="text-muted-foreground">View and manage all your event tickets in one place</p>
      </div>

      {/* Content */}
      {tickets.length === 0 ? (
        <Card className="border-border/10 rounded-2xl">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-4">
              <Ticket className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">No tickets yet</h3>
            <p className="text-muted-foreground mb-6 text-center">Start exploring events and book your first ticket</p>
            <Button onClick={() => navigate('/events')} className="bg-[#2969FF] hover:bg-[#1a4fd8] text-white rounded-xl">
              Browse Events
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="active" className="space-y-6">
          <TabsList className="bg-card border border-border/10 rounded-xl p-1">
            <TabsTrigger value="active" className="rounded-lg data-[state=active]:bg-[#2969FF] data-[state=active]:text-white">
              Active ({activeTickets.length})
            </TabsTrigger>
            <TabsTrigger value="past" className="rounded-lg data-[state=active]:bg-[#2969FF] data-[state=active]:text-white">
              Past ({pastTickets.length})
            </TabsTrigger>
            <TabsTrigger value="transferred" className="rounded-lg data-[state=active]:bg-purple-600 data-[state=active]:text-white">
              Transferred ({transferredOutTickets.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-6">
            {activeTickets.length === 0 ? (
              <Card className="border-border/10 rounded-2xl">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                    <Ticket className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">No active tickets</h3>
                  <p className="text-muted-foreground mb-4">Your upcoming event tickets will appear here</p>
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
              <Card className="border-border/10 rounded-2xl">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <p className="text-muted-foreground">No past tickets</p>
                </CardContent>
              </Card>
            ) : (
              pastTickets.map(ticket => <TicketCard key={ticket.id} ticket={ticket} />)
            )}
          </TabsContent>

          <TabsContent value="transferred" className="space-y-6">
            {transferredOutTickets.length === 0 ? (
              <Card className="border-border/10 rounded-2xl">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <div className="w-16 h-16 bg-purple-50 rounded-full flex items-center justify-center mb-4">
                    <Send className="w-8 h-8 text-purple-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">No transferred tickets</h3>
                  <p className="text-muted-foreground">Tickets you transfer to others will appear here</p>
                </CardContent>
              </Card>
            ) : (
              transferredOutTickets.map((transfer) => (
                <Card key={transfer.id} className="border-border/10 rounded-2xl overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      {transfer.ticket?.event?.image_url && (
                        <img 
                          src={transfer.ticket.event.image_url} 
                          alt="" 
                          className="w-16 h-16 rounded-xl object-cover"
                        />
                      )}
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground">{transfer.ticket?.event?.title || 'Event'}</h3>
                        <p className="text-sm text-muted-foreground">
                          {transfer.ticket?.event?.start_date && new Date(transfer.ticket.event.start_date).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge className="bg-purple-100 text-purple-700 border-0">Transferred Out</Badge>
                    </div>
                    <div className="mt-3 p-3 bg-purple-50 rounded-xl space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Transfer ID:</span>
                        <span className="font-mono text-foreground">{transfer.transfer_reference || '-'}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Old Ticket Code:</span>
                        <span className="font-mono text-red-600">{transfer.old_ticket_code || '-'}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">New Ticket Code:</span>
                        <span className="font-mono text-green-600">{transfer.new_ticket_code || '-'}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Original Transaction:</span>
                        <span className="font-mono text-xs text-foreground">
                          <TruncatedRef value={transfer.original_transaction_id} />
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm border-t border-purple-200 pt-2 mt-2">
                        <span className="text-muted-foreground">Transferred to:</span>
                        <span className="font-medium text-foreground">{transfer.to_user?.full_name || 'Unknown'} ({transfer.to_user?.email})</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Date:</span>
                        <span className="text-foreground">{new Date(transfer.created_at).toLocaleString()}</span>
                      </div>
                      {transfer.fee_amount > 0 && (
                        <>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Transfer fee:</span>
                            <span className="text-foreground">{formatPrice(transfer.fee_amount, transfer.fee_currency)}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Payment Ref:</span>
                            <span className="font-mono text-xs text-foreground">
                              <TruncatedRef value={transfer.payment_reference} />
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
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
              <div className="p-3 bg-muted rounded-xl">
                <p className="font-medium text-foreground">{refundModal.ticket.event?.title}</p>
                <p className="text-sm text-muted-foreground">{refundModal.ticket.ticket_type?.name} - {refundModal.ticket.attendee_name}</p>
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
                  <div className="space-y-2 p-3 border border-border/10 rounded-xl">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Original Amount</span>
                      <span className="text-foreground">{formatPrice(refundConfig?.originalAmount || 0, refundConfig?.currency)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Processing Fee</span>
                      <span className="text-red-600">-{formatPrice(refundConfig?.refundFee || 0, refundConfig?.currency)}</span>
                    </div>
                    <hr className="border-border/10" />
                    <div className="flex justify-between font-medium">
                      <span className="text-foreground">Refund Amount</span>
                      <span className="text-green-600">{formatPrice(refundConfig?.refundAmount || 0, refundConfig?.currency)}</span>
                    </div>
                  </div>

                  {/* Reason */}
                  <div>
                    <label className="text-sm font-medium text-foreground">Reason for refund *</label>
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

                  <p className="text-xs text-muted-foreground">
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

      {/* Transfer Ticket Modal */}
      <Dialog open={transferModal.open} onOpenChange={(o) => { if(!o) { setTransferModal({ open: false, ticket: null }); setTransferError(''); } }}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-purple-600" />
              Ticket Transfer
            </DialogTitle>
          </DialogHeader>
          
          {transferModal.ticket && (
            <div className="space-y-4">
              {/* Ticket Info */}
              <div className="p-3 bg-purple-50 rounded-xl">
                <p className="font-medium text-foreground">{transferModal.ticket.event?.title}</p>
                <p className="text-sm text-muted-foreground">{transferModal.ticket.ticket_type?.name} - {transferModal.ticket.attendee_name}</p>
                <p className="text-xs text-purple-600 mt-1">
                  This ticket can only be transferred once
                </p>
              </div>
              
              {/* Recipient Email */}
              <div>
                <label className="text-sm font-medium text-foreground">Recipient Email *</label>
                <Input 
                  type="email"
                  value={transferEmail}
                  onChange={(e) => setTransferEmail(e.target.value)}
                  placeholder="Enter recipient's email address"
                  className="mt-1 rounded-xl"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Recipient must have a Ticketrack account
                </p>
              </div>
              
              {transferFee > 0 && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-blue-800">Transfer Fee:</span>
                    <span className="font-bold text-blue-800">{formatPrice(transferFee, transferCurrency)}</span>
                  </div>
                  <p className="text-xs text-blue-600 mt-1">Payment required to complete transfer</p>
                </div>
              )}
              
              {transferError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-sm text-red-600 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {transferError}
                  </p>
                </div>
              )}
              
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-sm text-amber-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>
                    <strong>Important:</strong> Once transferred, you will no longer have access to this ticket. A new QR code will be generated for the recipient.
                  </span>
                </p>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => { setTransferModal({ open: false, ticket: null }); setTransferError(''); }} className="rounded-xl">
              Cancel
            </Button>
            <Button 
              onClick={handleTransfer} 
              disabled={transferLoading || !transferEmail.trim()}
              className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl"
            >
              {transferLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (transferFee > 0 ? 'Pay & Transfer' : 'Transfer Ticket')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
