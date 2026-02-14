import { formatPrice, getDefaultCurrency } from '@/config/currencies'
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Edit, Trash2, Eye, MoreVertical, Calendar, Loader2, MapPin, Copy, Radio, Lock, RefreshCw, BarChart3, ArrowRightLeft, Ticket, X, XCircle, CheckCircle, AlertCircle, Heart, Users, ChevronDown, ChevronRight, DollarSign, HelpCircle, Mail, Send, Key, Shield } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Label } from '../../components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { useOrganizer } from '../../contexts/OrganizerContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { HelpTip, OnboardingBanner } from '@/components/HelpTip';
import { toast } from 'sonner';
import { useConfirm } from '@/hooks/useConfirm';

const MANUAL_ISSUE_TYPES = [
  { value: 'complimentary', label: 'Complimentary' },
  { value: 'on_site_sale', label: 'On-Site Sale' },
  { value: 'vip_guest', label: 'VIP Guest' },
  { value: 'press_media', label: 'Press / Media' },
  { value: 'sponsor', label: 'Sponsor' },
  { value: 'giveaway_winner', label: 'Giveaway Winner' },
];

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'card', label: 'Card Payment' },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'paystack', label: 'Paystack' },
  { value: 'stripe', label: 'Stripe' },
  { value: 'flutterwave', label: 'Flutterwave' },
  { value: 'other', label: 'Other' },
];

// Generate unique 8-character ticket code (TR + 6 chars)
function generateTicketCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed similar looking chars (0,O,1,I)
  let code = 'TR';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function EventManagement() {
  const navigate = useNavigate();
  const { organizer } = useOrganizer();
  const { user } = useAuth();
  const confirm = useConfirm();
  const [searchQuery, setSearchQuery] = useState('');
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);
  const [cancelingSeries, setCancelingSeries] = useState(null);

  const [issueTicketModal, setIssueTicketModal] = useState({ open: false, event: null });
  const [issueForm, setIssueForm] = useState({
    firstName: '',
    lastName: '',
    attendee_email: '',
    attendee_phone: '',
    ticket_type_id: '',
    issue_mode: 'complimentary', // 'complimentary' or 'sell'
    manual_issue_type: 'complimentary',
    payment_method: 'cash',
    payment_reference: '',
  });
  const [issueLoading, setIssueLoading] = useState(false);
  const [issueSuccess, setIssueSuccess] = useState(null);
  const [issueError, setIssueError] = useState(null);
  
  // Track expanded recurring events and their child events
  const [expandedRecurringEvents, setExpandedRecurringEvents] = useState({});
  const [childEventsData, setChildEventsData] = useState({});
  const [loadingChildEvents, setLoadingChildEvents] = useState({});

  // Access management modal state
  const [accessModal, setAccessModal] = useState({ open: false, event: null });
  const [accessCodes, setAccessCodes] = useState([]);
  const [accessLoading, setAccessLoading] = useState(false);
  const [newAccessCode, setNewAccessCode] = useState({ code: '', name: '', maxUses: '' });
  const [newPassword, setNewPassword] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [sendingInvite, setSendingInvite] = useState(false);

  // Cancel event modal state
  const [cancelModal, setCancelModal] = useState({ open: false, event: null });
  const [cancelReason, setCancelReason] = useState('');
  const [customCancelReason, setCustomCancelReason] = useState('');
  const [cancelingEvent, setCancelingEvent] = useState(false);

  useEffect(() => {
    if (organizer?.id) {
      loadEvents();
    }
  }, [organizer?.id]);

  const loadEvents = async () => {
    try {
      setLoading(true);
      const { data: eventsData, error } = await supabase
        .from('events')
        .select(`
          *,
          ticket_types (id, name, price, quantity_available, quantity_sold)
        `)
        .eq('organizer_id', organizer.id)
        .is('parent_event_id', null)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const parentIds = (eventsData || []).filter(e => e.is_recurring).map(e => e.id);
      let childCounts = {};
      if (parentIds.length > 0) {
        const { data: children } = await supabase
          .from('events')
          .select('parent_event_id')
          .in('parent_event_id', parentIds);
        childCounts = (children || []).reduce((acc, c) => {
          acc[c.parent_event_id] = (acc[c.parent_event_id] || 0) + 1;
          return acc;
        }, {});
      }

      // For free events, get RSVP counts directly from tickets table
      const eventIds = eventsData?.map(e => e.id) || [];
      let rsvpCounts = {};
      let donationAmounts = {};
      
      if (eventIds.length > 0) {
        // Get ticket counts directly from tickets table
        const { data: tickets } = await supabase
          .from('tickets')
          .select('event_id, quantity')
          .in('event_id', eventIds);
        
        tickets?.forEach(t => {
          rsvpCounts[t.event_id] = (rsvpCounts[t.event_id] || 0) + (t.quantity || 1);
        });

        // Get donation amounts for free events
        const freeEventIds = eventsData?.filter(e => e.is_free).map(e => e.id) || [];
        if (freeEventIds.length > 0) {
          const { data: donations } = await supabase
            .from('orders')
            .select('event_id, total_amount')
            .in('event_id', freeEventIds)
            .eq('is_donation', true)
            .eq('status', 'completed');
          
          donations?.forEach(d => {
            donationAmounts[d.event_id] = (donationAmounts[d.event_id] || 0) + parseFloat(d.total_amount || 0);
          });
        }
      }

      const eventsWithStats = (eventsData || []).map(event => {
        const ticketTypes = event.ticket_types || [];
        const totalTickets = ticketTypes.reduce((sum, t) => sum + (t.quantity_available || 0), 0) || event.total_capacity || 100;
        
        // For free events, use direct ticket count; for paid events, use quantity_sold
        const soldTickets = event.is_free 
          ? (rsvpCounts[event.id] || 0)
          : ticketTypes.reduce((sum, t) => sum + (t.quantity_sold || 0), 0);
        
        // For free events, show donation amount; for paid events, show ticket revenue
        const revenue = event.is_free
          ? (donationAmounts[event.id] || 0)
          : ticketTypes.reduce((sum, t) => sum + ((t.quantity_sold || 0) * (t.price || 0)), 0);
        
        return { 
          ...event, 
          totalTickets, 
          soldTickets, 
          revenue, 
          childEventCount: childCounts[event.id] || 0,
          isFree: event.is_free,
          donationAmount: donationAmounts[event.id] || 0
        };
      });

      setEvents(eventsWithStats);
    } catch (err) {
      console.error('Error loading events:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredEvents = events.filter(event =>
    event.title?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Pagination
  const { 
    currentPage, totalPages, totalItems, itemsPerPage, 
    paginatedItems: paginatedEvents, handlePageChange, setCurrentPage 
  } = usePagination(filteredEvents, 20);
  
  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const getEventStatus = (event) => {
    if (event.status === 'draft') return 'draft';
    if (event.status === 'scheduled') return 'scheduled';
    if (event.status === 'cancelled') return 'cancelled';
    const now = new Date();
    const startDate = new Date(event.start_date);
    const endDate = new Date(event.end_date);
    if (endDate < now) return 'completed';
    if (startDate <= now && endDate >= now) return 'live';
    return 'upcoming';
  };

  const toggleTransfers = async (eventId, currentValue) => {
    try {
      const { error } = await supabase
        .from('events')
        .update({ allow_transfers: !currentValue })
        .eq('id', eventId);
      if (error) throw error;
      setEvents(prev => prev.map(e => e.id === eventId ? { ...e, allow_transfers: !currentValue } : e));
    } catch (err) {
      console.error('Error toggling transfers:', err);
      toast.error('Failed to update transfer setting');
    }
  };

  const canEditEvent = (event) => {
    const status = getEventStatus(event);
    return status === 'upcoming' || status === 'live' || status === 'draft' || status === 'scheduled';
  };

  const canDeleteEvent = (event) => event.soldTickets === 0; // soldTickets now includes RSVPs for free events

  const canIssueTickets = (event) => {
    const status = getEventStatus(event);
    return status === 'upcoming' || status === 'live';
  };

  const openIssueTicketModal = (event) => {
    setIssueTicketModal({ open: true, event });
    setIssueForm({
      firstName: '',
      lastName: '',
      attendee_email: '',
      attendee_phone: '',
      ticket_type_id: event.ticket_types?.[0]?.id || '',
      issue_mode: 'complimentary',
      manual_issue_type: 'complimentary',
      payment_method: 'cash',
      payment_reference: '',
    });
    setIssueSuccess(null);
    setIssueError(null);
  };

  const closeIssueTicketModal = () => {
    setIssueTicketModal({ open: false, event: null });
    setIssueForm({ 
      firstName: '', 
      lastName: '', 
      attendee_email: '', 
      attendee_phone: '', 
      ticket_type_id: '', 
      issue_mode: 'complimentary',
      manual_issue_type: 'complimentary',
      payment_method: 'cash',
      payment_reference: '',
    });
    setIssueSuccess(null);
    setIssueError(null);
  };

  const handleIssueTicket = async (e) => {
    e.preventDefault();
    setIssueLoading(true);
    setIssueError(null);
    setIssueSuccess(null);

    try {
      const event = issueTicketModal.event;
      if (!issueForm.firstName.trim()) throw new Error('First name is required');
      if (!issueForm.lastName.trim()) throw new Error('Last name is required');
      if (!issueForm.attendee_email.trim()) throw new Error('Email is required');
      if (!issueForm.ticket_type_id) throw new Error('Please select a ticket type');

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(issueForm.attendee_email.trim())) throw new Error('Please enter a valid email address');

      const selectedTicketType = event.ticket_types?.find(t => t.id === issueForm.ticket_type_id);
      if (!selectedTicketType) throw new Error('Invalid ticket type selected');

      const remaining = (selectedTicketType.quantity_available || 0) - (selectedTicketType.quantity_sold || 0);
      if (remaining <= 0) throw new Error('This ticket type is sold out');

      const ticketCode = generateTicketCode();
      const fullName = `${issueForm.firstName.trim()} ${issueForm.lastName.trim()}`;
      const isSelling = issueForm.issue_mode === 'sell';
      const ticketPrice = selectedTicketType.price || 0;
      const currency = event.currency || getDefaultCurrency(event.country_code || event.country);

      let orderId = null;

      // If selling, create an order first
      if (isSelling) {
        if (!issueForm.payment_method) throw new Error('Payment method is required when selling tickets');
        
        const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}`;
        const { data: newOrder, error: orderError } = await supabase
          .from('orders')
          .insert({
            order_number: orderNumber,
            event_id: event.id,
            organizer_id: organizer.id,
            user_id: null, // Manual sale, no user account
            buyer_name: fullName,
            buyer_email: issueForm.attendee_email.trim().toLowerCase(),
            buyer_phone: issueForm.attendee_phone.trim() || null,
            subtotal: ticketPrice,
            platform_fee: 0, // No platform fee for manual sales
            processing_fee: 0, // No processing fee - organizer collected payment directly
            organizer_amount: ticketPrice, // Organizer gets full amount
            total_amount: ticketPrice,
            currency: currency,
            status: 'completed',
            payment_method: issueForm.payment_method,
            payment_reference: issueForm.payment_reference.trim() || null,
            paid_at: new Date().toISOString(),
            is_manual_sale: true,
          })
          .select()
          .single();

        if (orderError) throw orderError;
        orderId = newOrder.id;

        // Create order item
        await supabase
          .from('order_items')
          .insert({
            order_id: orderId,
            ticket_type_id: issueForm.ticket_type_id,
            quantity: 1,
            unit_price: ticketPrice,
            total_price: ticketPrice,
          });
      }

      // Create ticket
      const { data: newTicket, error: ticketError } = await supabase
        .from('tickets')
        .insert({
          event_id: event.id,
          order_id: orderId,
          ticket_type_id: issueForm.ticket_type_id,
          attendee_name: fullName,
          attendee_email: issueForm.attendee_email.trim().toLowerCase(),
          attendee_phone: issueForm.attendee_phone.trim() || null,
          ticket_code: ticketCode,
          quantity: 1,
          unit_price: isSelling ? ticketPrice : 0,
          total_price: isSelling ? ticketPrice : 0,
          currency: currency,
          payment_status: isSelling ? 'paid' : 'complimentary',
          payment_method: isSelling ? issueForm.payment_method : null,
          status: 'active',
          is_manual_issue: true,
          issued_by: user?.id,
          manual_issue_type: issueForm.manual_issue_type,
        })
        .select()
        .single();

      if (ticketError) throw ticketError;

      // Update ticket type sold count
      await supabase
        .from('ticket_types')
        .update({ quantity_sold: (selectedTicketType.quantity_sold || 0) + 1 })
        .eq('id', issueForm.ticket_type_id);

      // Send confirmation email
      try {
        await supabase.functions.invoke('send-email', {
          body: {
            type: 'ticket_purchase',
            to: issueForm.attendee_email.trim().toLowerCase(),
            data: {
              attendeeName: fullName,
              eventTitle: event.title,
              eventDate: event.start_date,
              venueName: event.venue_name,
              city: event.city,
              ticketType: selectedTicketType.name,
              quantity: 1,
              orderNumber: orderId ? `ORD-${orderId.substring(0, 8)}` : ticketCode,
              totalAmount: isSelling ? ticketPrice : 0,
              currency: currency,
              isFree: !isSelling,
              appUrl: window.location.origin,
            },
            userId: null,
            eventId: event.id,
            ticketId: newTicket.id,
          }
        });
      } catch (emailError) {
        console.error('Failed to send email:', emailError);
      }

      setIssueSuccess({
        ticketCode,
        attendeeName: fullName,
        attendeeEmail: issueForm.attendee_email.trim(),
        ticketType: selectedTicketType.name,
        amount: isSelling ? ticketPrice : 0,
        paymentMethod: isSelling ? PAYMENT_METHODS.find(p => p.value === issueForm.payment_method)?.label : null,
        reason: MANUAL_ISSUE_TYPES.find(t => t.value === issueForm.manual_issue_type)?.label,
        isSelling,
      });
      loadEvents();
    } catch (err) {
      console.error('Error issuing ticket:', err);
      setIssueError(err.message || 'Failed to issue ticket');
    } finally {
      setIssueLoading(false);
    }
  };

  const handleReuseTemplate = (event) => {
    navigate('/organizer/create-event', { 
      state: { 
        template: {
          title: event.title,
          description: event.description,
          category: event.category,
          venue_name: event.venue_name,
          venue_address: event.venue_address,
          city: event.city,
          country_code: event.country_code,
          image_url: event.image_url,
          timezone: event.timezone,
          is_free: event.is_free,
          ticket_types: event.ticket_types?.map(t => ({
            name: t.name,
            description: t.description,
            price: t.price,
            quantity_available: t.quantity_available,
            max_per_order: t.max_per_order
          }))
        }
      }
    });
  };

  const deleteEvent = async (id) => {
    const event = events.find(e => e.id === id);
    if (event && event.soldTickets > 0) {
      toast.error('Cannot delete this event because tickets have been sold. For audit purposes, events with sales must be preserved.');
      return;
    }
    
    // Check if this is a recurring event with child events
    if (event && event.is_recurring && event.childEventCount > 0) {
      const confirmDelete = await confirm(
        'Delete Recurring Event',
        `This is a recurring event with ${event.childEventCount} child event(s). Deleting the parent event will also delete all child events. Are you sure you want to continue?`,
        { variant: 'destructive' }
      );
      if (!confirmDelete) return;
      
      // Delete all child events first
      try {
        const { error: childError } = await supabase
          .from('events')
          .delete()
          .eq('parent_event_id', id);
        if (childError) throw childError;
      } catch (childErr) {
        console.error('Error deleting child events:', childErr);
        toast.error('Failed to delete child events. Please try again.');
        return;
      }
    }
    
    if (!(await confirm('Delete Event', 'Are you sure you want to delete this event? This action cannot be undone.', { variant: 'destructive' }))) return;
    
    try {
      setDeleting(id);
      
      // Delete associated ticket types first (if any)
      const { error: ticketTypesError } = await supabase
        .from('ticket_types')
        .delete()
        .eq('event_id', id);
      // Don't fail if no ticket types exist
      
      // Delete the event
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      // Reload events from database to ensure consistency
      await loadEvents();
    } catch (err) {
      console.error('Error deleting event:', err);
      toast.error(`Failed to delete event: ${err.message || 'It may have associated tickets or orders.'}`);
    } finally {
      setDeleting(null);
    }
  };

  const loadChildEvents = async (parentEventId) => {
    if (childEventsData[parentEventId]) {
      // Already loaded
      return;
    }

    setLoadingChildEvents(prev => ({ ...prev, [parentEventId]: true }));
    try {
      // Load child events with ticket stats
      const { data: children, error } = await supabase
        .from('events')
        .select(`
          *,
          ticket_types (id, name, price, quantity_available, quantity_sold)
        `)
        .eq('parent_event_id', parentEventId)
        .order('start_date', { ascending: true });

      if (error) throw error;

      // Get ticket counts and revenue for each child event
      const childEventIds = children?.map(c => c.id) || [];
      let childRSVPCounts = {};
      let childDonationAmounts = {};
      
      if (childEventIds.length > 0) {
        // Get tickets for child events
        const { data: tickets } = await supabase
          .from('tickets')
          .select('event_id, quantity')
          .in('event_id', childEventIds);

        tickets?.forEach(t => {
          childRSVPCounts[t.event_id] = (childRSVPCounts[t.event_id] || 0) + (t.quantity || 1);
        });

        // Get donations for free child events
        const freeChildIds = children?.filter(c => c.is_free).map(c => c.id) || [];
        if (freeChildIds.length > 0) {
          const { data: donations } = await supabase
            .from('orders')
            .select('event_id, total_amount')
            .in('event_id', freeChildIds)
            .eq('is_donation', true)
            .eq('status', 'completed');

          donations?.forEach(d => {
            childDonationAmounts[d.event_id] = (childDonationAmounts[d.event_id] || 0) + parseFloat(d.total_amount || 0);
          });
        }
      }

      // Calculate stats for each child event
      const childrenWithStats = (children || []).map(child => {
        const ticketTypes = child.ticket_types || [];
        const totalTickets = ticketTypes.reduce((sum, t) => sum + (t.quantity_available || 0), 0) || child.total_capacity || 100;
        
        const soldTickets = child.is_free 
          ? (childRSVPCounts[child.id] || 0)
          : ticketTypes.reduce((sum, t) => sum + (t.quantity_sold || 0), 0);
        
        const revenue = child.is_free
          ? (childDonationAmounts[child.id] || 0)
          : ticketTypes.reduce((sum, t) => sum + ((t.quantity_sold || 0) * (t.price || 0)), 0);

        return {
          ...child,
          totalTickets,
          soldTickets,
          revenue,
          isFree: child.is_free,
          donationAmount: childDonationAmounts[child.id] || 0
        };
      });

      setChildEventsData(prev => ({ ...prev, [parentEventId]: childrenWithStats }));
    } catch (err) {
      console.error('Error loading child events:', err);
    } finally {
      setLoadingChildEvents(prev => ({ ...prev, [parentEventId]: false }));
    }
  };

  const toggleRecurringEvent = async (eventId) => {
    const isExpanded = expandedRecurringEvents[eventId];
    
    if (!isExpanded) {
      // Expanding - load child events
      await loadChildEvents(eventId);
    }
    
    setExpandedRecurringEvents(prev => ({
      ...prev,
      [eventId]: !isExpanded
    }));
  };

  const cancelSeries = async (event) => {
    if (!event.is_recurring) return;
    const confirmed = await confirm('Cancel Entire Series', 'This will cancel this event and all ' + (event.childEventCount || 0) + ' upcoming events in the series. All tickets will be automatically refunded.', { variant: 'destructive' });
    if (!confirmed) return;
    try {
      setCancelingSeries(event.id);
      
      // Cancel parent event
      await supabase.from('events').update({ status: 'cancelled' }).eq('id', event.id);
      
      // Cancel all child events and trigger auto-refunds
      const { data: childEvents } = await supabase
        .from('events')
        .select('id')
        .eq('parent_event_id', event.id);
      
      // Cancel all child events
      await supabase.from('events').update({ status: 'cancelled' }).eq('parent_event_id', event.id);
      
      // Trigger auto-refunds for parent event
      try {
        await supabase.functions.invoke('auto-refund-on-cancellation', {
          body: {
            eventId: event.id,
            reason: 'Event series cancelled by organizer',
            organizerId: organizer.id
          }
        });
      } catch (refundError) {
        console.error('Error processing auto-refunds for parent event:', refundError);
      }
      
      // Trigger auto-refunds for each child event
      if (childEvents && childEvents.length > 0) {
        for (const childEvent of childEvents) {
          try {
            await supabase.functions.invoke('auto-refund-on-cancellation', {
              body: {
                eventId: childEvent.id,
                reason: 'Event series cancelled by organizer',
                organizerId: organizer.id
              }
            });
          } catch (refundError) {
            console.error(`Error processing auto-refunds for child event ${childEvent.id}:`, refundError);
          }
        }
      }
      
      toast.success('Series cancelled successfully. All tickets are being automatically refunded. Attendees will receive email notifications.');
      loadEvents();
    } catch (err) {
      console.error('Error cancelling series:', err);
      toast.error('Failed to cancel series: ' + (err.message || 'Unknown error'));
    } finally {
      setCancelingSeries(null);
    }
  };

  const cancelSingleChildEvent = async (childEvent) => {
    if (!(await confirm('Cancel Event Date', `Cancel "${childEvent.title}" on ${formatDate(childEvent.start_date)}? All tickets for this date will be automatically refunded.`, { variant: 'destructive' }))) return;
    try {
      // Cancel the child event
      await supabase.from('events').update({ status: 'cancelled' }).eq('id', childEvent.id);
      
      // Trigger auto-refunds for this child event
      try {
        const { error: refundError } = await supabase.functions.invoke('auto-refund-on-cancellation', {
          body: {
            eventId: childEvent.id,
            reason: `Event date cancelled: ${formatDate(childEvent.start_date)}`,
            organizerId: organizer.id
          }
        });
        
        if (refundError) {
          console.error('Error processing auto-refunds:', refundError);
          toast.error('Event date cancelled, but there was an error processing refunds. Please check and process refunds manually.');
        } else {
          toast.success('Event date cancelled successfully. All tickets are being automatically refunded. Attendees will receive email notifications.');
        }
      } catch (refundError) {
        console.error('Error processing auto-refunds:', refundError);
        toast.error('Event date cancelled, but there was an error processing refunds. Please check and process refunds manually.');
      }
      
      // Reload child events for this parent
      await loadChildEvents(childEvent.parent_event_id);
    } catch (err) {
      console.error('Error cancelling child event:', err);
      toast.error('Failed to cancel event date: ' + (err.message || 'Unknown error'));
    }
  };

  // Cancel Event Functions
  const openCancelModal = (event) => {
    setCancelModal({ open: true, event });
    setCancelReason('');
    setCustomCancelReason('');
  };

  const closeCancelModal = () => {
    setCancelModal({ open: false, event: null });
    setCancelReason('');
    setCustomCancelReason('');
  };

  const handleCancelEvent = async () => {
    const event = cancelModal.event;
    if (!event) return;
    const reason = cancelReason === 'other' ? customCancelReason : cancelReason;
    if (!reason) return;

    setCancelingEvent(true);
    try {
      await supabase.from('events').update({
        status: 'cancelled',
        cancellation_reason: reason,
      }).eq('id', event.id);

      // If recurring, cancel all child events too
      if (event.is_recurring) {
        await supabase.from('events').update({
          status: 'cancelled',
          cancellation_reason: reason,
        }).eq('parent_event_id', event.id);
      }

      // Trigger auto-refunds
      try {
        await supabase.functions.invoke('auto-refund-on-cancellation', {
          body: {
            eventId: event.id,
            reason: reason,
            organizerId: organizer.id,
          },
        });
      } catch (refundError) {
        console.error('Error processing auto-refunds:', refundError);
      }

      // Refund child events if recurring
      if (event.is_recurring) {
        const { data: childEvents } = await supabase
          .from('events')
          .select('id')
          .eq('parent_event_id', event.id);
        if (childEvents?.length > 0) {
          for (const child of childEvents) {
            try {
              await supabase.functions.invoke('auto-refund-on-cancellation', {
                body: { eventId: child.id, reason, organizerId: organizer.id },
              });
            } catch (e) {
              console.error('Error refunding child event:', e);
            }
          }
        }
      }

      closeCancelModal();
      loadEvents();
      toast.success('Event cancelled successfully. Attendees will be notified and refunds will be processed automatically.');
    } catch (err) {
      console.error('Error cancelling event:', err);
      toast.error('Failed to cancel event: ' + (err.message || 'Unknown error'));
    } finally {
      setCancelingEvent(false);
    }
  };

  // Access Management Functions
  const openAccessModal = async (event) => {
    setAccessModal({ open: true, event });
    setNewAccessCode({ code: '', name: '', maxUses: '' });
    setNewPassword(event.access_password || '');
    setInviteEmail('');

    if (event.visibility === 'invite_only') {
      await loadAccessCodes(event.id);
    }
  };

  const closeAccessModal = () => {
    setAccessModal({ open: false, event: null });
    setAccessCodes([]);
    setNewAccessCode({ code: '', name: '', maxUses: '' });
    setNewPassword('');
    setInviteEmail('');
  };

  const loadAccessCodes = async (eventId) => {
    setAccessLoading(true);
    try {
      const { data, error } = await supabase
        .from('event_invite_codes')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAccessCodes(data || []);
    } catch (err) {
      console.error('Error loading access codes:', err);
    } finally {
      setAccessLoading(false);
    }
  };

  const generateRandomCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewAccessCode(prev => ({ ...prev, code }));
  };

  const addAccessCode = async () => {
    if (!newAccessCode.code.trim()) {
      generateRandomCode();
      return;
    }

    try {
      const { data, error } = await supabase
        .from('event_invite_codes')
        .insert({
          event_id: accessModal.event.id,
          code: newAccessCode.code.toUpperCase().trim(),
          name: newAccessCode.name.trim() || null,
          max_uses: newAccessCode.maxUses ? parseInt(newAccessCode.maxUses) : null,
        })
        .select()
        .single();

      if (error) throw error;
      setAccessCodes(prev => [data, ...prev]);
      setNewAccessCode({ code: '', name: '', maxUses: '' });
    } catch (err) {
      console.error('Error adding code:', err);
      toast.error('Failed to add code. It may already exist.');
    }
  };

  const deleteAccessCode = async (codeId) => {
    try {
      const { error } = await supabase
        .from('event_invite_codes')
        .delete()
        .eq('id', codeId);

      if (error) throw error;
      setAccessCodes(prev => prev.filter(c => c.id !== codeId));
    } catch (err) {
      console.error('Error deleting code:', err);
    }
  };

  const toggleCodeActive = async (codeId, currentStatus) => {
    try {
      const { error } = await supabase
        .from('event_invite_codes')
        .update({ is_active: !currentStatus })
        .eq('id', codeId);

      if (error) throw error;
      setAccessCodes(prev => prev.map(c => c.id === codeId ? { ...c, is_active: !currentStatus } : c));
    } catch (err) {
      console.error('Error toggling code:', err);
    }
  };

  const updateEventPassword = async () => {
    try {
      const { error } = await supabase
        .from('events')
        .update({ access_password: newPassword.trim() })
        .eq('id', accessModal.event.id);

      if (error) throw error;
      setEvents(prev => prev.map(e => e.id === accessModal.event.id ? { ...e, access_password: newPassword.trim() } : e));
      toast.success('Password updated successfully!');
    } catch (err) {
      console.error('Error updating password:', err);
      toast.error('Failed to update password');
    }
  };

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(password);
  };

  const sendInviteEmail = async () => {
    if (!inviteEmail.trim() || !inviteEmail.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

    setSendingInvite(true);
    try {
      // Get or create a code for this invite
      let codeToSend = accessCodes.find(c => c.is_active && (!c.max_uses || c.current_uses < c.max_uses));

      if (!codeToSend) {
        // Create a new code for this invite
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let newCode = '';
        for (let i = 0; i < 8; i++) {
          newCode += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        const { data, error } = await supabase
          .from('event_invite_codes')
          .insert({
            event_id: accessModal.event.id,
            code: newCode,
            name: `Email invite - ${inviteEmail}`,
            max_uses: 1,
          })
          .select()
          .single();

        if (error) throw error;
        codeToSend = data;
        setAccessCodes(prev => [data, ...prev]);
      }

      // Send the invite email
      const { error: emailError } = await supabase.functions.invoke('send-email', {
        body: {
          type: 'event_invite',
          to: inviteEmail.trim().toLowerCase(),
          data: {
            eventTitle: accessModal.event.title,
            eventDate: accessModal.event.start_date,
            eventVenue: accessModal.event.venue_name,
            eventCity: accessModal.event.city,
            inviteCode: codeToSend.code,
            eventUrl: `${window.location.origin}/e/${accessModal.event.slug || accessModal.event.id}`,
            organizerName: organizer?.business_name || 'The organizer',
          }
        }
      });

      if (emailError) throw emailError;

      toast.success(`Invite sent to ${inviteEmail}!`);
      setInviteEmail('');
    } catch (err) {
      console.error('Error sending invite:', err);
      toast.error('Failed to send invite. Please try again.');
    } finally {
      setSendingInvite(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'No date set';
    return new Date(dateString).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getStatusBadge = (event) => {
    const status = getEventStatus(event);
    switch (status) {
      case 'draft': return <Badge className="bg-muted text-foreground/80">Draft</Badge>;
      case 'cancelled': return <Badge className="bg-red-100 text-red-700">Cancelled</Badge>;
      case 'completed': return <Badge className="bg-purple-100 text-purple-700">Completed</Badge>;
      case 'live': return <Badge className="bg-green-100 text-green-700 flex items-center gap-1"><Radio className="w-3 h-3 animate-pulse" />Live</Badge>;
      case 'upcoming': return <Badge className="bg-blue-100 text-blue-700">Upcoming</Badge>;
      case 'scheduled': return <Badge className="bg-purple-100 text-purple-700">Scheduled</Badge>;
      default: return <Badge className="bg-yellow-100 text-yellow-700">{event.status}</Badge>;
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            Event Management
            <HelpTip>Create events, set ticket prices, and manage sales. Events can be one-time, recurring (weekly/monthly), or virtual online events.</HelpTip>
          </h2>
          <p className="text-muted-foreground mt-1">Create and manage your events</p>
        </div>
        <Button onClick={() => navigate('/organizer/create-event')} className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl" title="Create a new event with tickets">
          <Plus className="w-5 h-5 mr-2" />Create Event
        </Button>
      </div>

      <Card className="border-border/10 rounded-2xl">
        <CardHeader>
          <div className="flex items-center space-x-3">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input placeholder="Search events..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="h-12 pl-12 rounded-xl bg-muted border-0" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredEvents.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-16 h-16 text-foreground/20 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No events yet</h3>
              <p className="text-muted-foreground mb-6">Create your first event to start selling tickets</p>
              <Button onClick={() => navigate('/organizer/create-event')} className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl">
                <Plus className="w-5 h-5 mr-2" />Create Your First Event
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {paginatedEvents.map((event) => {
                const eventStatus = getEventStatus(event);
                const isEditable = canEditEvent(event);
                const isDeletable = canDeleteEvent(event);
                const canIssue = canIssueTickets(event);
                return (
                  <div key={event.id} className={`p-4 rounded-xl transition-colors ${
                    event.isFree
                      ? 'bg-gradient-to-r from-green-50 to-emerald-50 hover:from-green-100 hover:to-emerald-100'
                      : 'bg-muted hover:bg-muted/80'
                  }`}>
                    <div className="flex items-start gap-3">
                      {/* Event Image - hidden on mobile */}
                      {event.image_url && <img src={event.image_url} alt={event.title} className="w-20 h-20 rounded-lg object-cover hidden sm:block flex-shrink-0" />}

                      {/* Event Info - takes remaining space */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h4 className="font-medium text-foreground truncate">{event.title}</h4>
                            {getStatusBadge(event)}
                            {event.isFree && <Badge className="bg-green-100 text-green-700">Free Event</Badge>}
                            {event.soldTickets > 0 && (
                              <Badge className={`flex items-center gap-1 ${event.isFree ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                                {event.isFree ? <Users className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                                {event.soldTickets} {event.isFree ? 'RSVPs' : 'sold'}
                              </Badge>
                            )}
                            {event.is_recurring && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleRecurringEvent(event.id);
                                }}
                                className="h-auto p-1 text-purple-700 hover:bg-purple-100 rounded-lg"
                              >
                                <Badge className="bg-purple-100 text-purple-700 flex items-center gap-1 cursor-pointer hover:bg-purple-200">
                                  {expandedRecurringEvents[event.id] ? (
                                    <ChevronDown className="w-3 h-3" />
                                  ) : (
                                    <ChevronRight className="w-3 h-3" />
                                  )}
                                  <RefreshCw className="w-3 h-3" />Series ({event.childEventCount + 1} events)
                                </Badge>
                              </Button>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{formatDate(event.start_date)}</span>
                            {event.venue_name && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{event.venue_name}</span>}
                          </div>
                          <div className="flex items-center gap-4 mt-2 text-sm">
                            <span className="text-muted-foreground">
                              <span className="font-medium text-foreground">{event.soldTickets}</span>/{event.totalTickets} {event.isFree ? 'RSVPs' : 'sold'}
                            </span>
                            {event.isFree ? (
                              event.donationAmount > 0 ? (
                                <span className="text-emerald-600 font-medium flex items-center gap-1">
                                  <Heart className="w-3 h-3" />
                                  {formatPrice(event.donationAmount, event.currency)} donations
                                </span>
                              ) : (
                                <span className="text-muted-foreground">Pending RSVPs</span>
                              )
                            ) : (
                              <span className="text-[#2969FF] font-medium">{formatPrice(event.revenue, event.currency)}</span>
                            )}
                          </div>
                        </div>
                      {event.is_recurring && expandedRecurringEvents[event.id] && (
                        <div className="mt-4 ml-8 space-y-2 border-l-2 border-purple-200 pl-4">
                          {loadingChildEvents[event.id] ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                              <Loader2 className="w-4 h-4 animate-spin" />Loading event dates...
                            </div>
                          ) : childEventsData[event.id]?.length > 0 ? (
                            childEventsData[event.id].map((childEvent) => {
                              const childStatus = getEventStatus(childEvent);
                              const isChildEditable = canEditEvent(childEvent);
                              return (
                                <div
                                  key={childEvent.id}
                                  className={`p-3 rounded-lg ${
                                    childEvent.isFree 
                                      ? 'bg-green-50/50 hover:bg-green-100/50' 
                                      : 'bg-card/50 hover:bg-card'
                                  } border border-border/5`}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-1">
                                        <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                                        <span className="text-sm font-medium text-foreground">{formatDate(childEvent.start_date)}</span>
                                        {getStatusBadge(childEvent)}
                                        {childEvent.isFree && <Badge className="bg-green-100 text-green-700 text-xs">Free</Badge>}
                                      </div>
                                      <div className="flex items-center gap-4 text-xs text-muted-foreground ml-6">
                                        <span>
                                          <span className="font-medium text-foreground">{childEvent.soldTickets}</span>/{childEvent.totalTickets} {childEvent.isFree ? 'RSVPs' : 'sold'}
                                        </span>
                                        {childEvent.isFree ? (
                                          childEvent.donationAmount > 0 ? (
                                            <span className="text-emerald-600 font-medium flex items-center gap-1">
                                              <Heart className="w-3 h-3" />
                                              {formatPrice(childEvent.donationAmount, childEvent.currency)} donations
                                            </span>
                                          ) : (
                                            <span className="text-muted-foreground">No donations</span>
                                          )
                                        ) : (
                                          <span className="text-[#2969FF] font-medium flex items-center gap-1">
                                            <DollarSign className="w-3 h-3" />
                                            {formatPrice(childEvent.revenue, childEvent.currency)}
                                          </span>
                                        )}
                        </div>
                      </div>
                                    <div className="flex items-center space-x-1">
                                      <Button variant="ghost" size="icon" onClick={() => navigate(`/e/${childEvent.slug || childEvent.id}`)} className="rounded-lg h-8 w-8" title="View Public Page"><Eye className="w-3.5 h-3.5" /></Button>
                                      {isChildEditable && (
                                        <Button variant="ghost" size="icon" onClick={() => navigate(`/organizer/events/${childEvent.id}/edit`)} className="rounded-lg h-8 w-8" title="Edit Event Date"><Edit className="w-3.5 h-3.5" /></Button>
                                      )}
                                      <Button variant="ghost" size="icon" onClick={() => navigate(`/organizer/analytics?event=${childEvent.id}`)} className="rounded-lg h-8 w-8" title="View Analytics"><BarChart3 className="w-3.5 h-3.5" /></Button>
                                      {childStatus !== 'completed' && childEvent.status !== 'cancelled' && (
                                        <Button variant="ghost" size="icon" onClick={() => cancelSingleChildEvent(childEvent)} className="rounded-lg h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50" title="Cancel This Date"><X className="w-3.5 h-3.5" /></Button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <div className="text-sm text-muted-foreground py-2">No event dates found</div>
                          )}
                        </div>
                      )}
                      {/* Action Buttons - always visible */}
                      <div className="flex items-center space-x-1 flex-shrink-0 ml-auto">
                        <Button variant="ghost" size="icon" onClick={() => navigate(`/e/${event.slug || event.id}`)} className="rounded-lg hidden sm:flex" title="View Public Page"><Eye className="w-4 h-4" /></Button>
                        {isEditable ? (
                          <Button variant="ghost" size="icon" onClick={() => navigate(`/organizer/events/${event.id}/edit`)} className="rounded-lg hidden sm:flex" title="Edit Event"><Edit className="w-4 h-4" /></Button>
                        ) : (
                          <Button variant="ghost" size="icon" onClick={() => handleReuseTemplate(event)} className="rounded-lg hidden sm:flex" title="Reuse Event Template"><Copy className="w-4 h-4" /></Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="rounded-lg"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-xl">
                            <DropdownMenuItem onClick={() => navigate(`/e/${event.slug || event.id}`)}><Eye className="w-4 h-4 mr-2" />View Public Page</DropdownMenuItem>
                            {isEditable ? (
                              <DropdownMenuItem onClick={() => navigate(`/organizer/events/${event.id}/edit`)}><Edit className="w-4 h-4 mr-2" />Edit Event</DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => handleReuseTemplate(event)}><Copy className="w-4 h-4 mr-2" />Reuse Event Template</DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            {(event.visibility === 'invite_only' || event.visibility === 'password') && (
                              <DropdownMenuItem onClick={() => openAccessModal(event)}>
                                <Shield className="w-4 h-4 mr-2" />
                                {event.visibility === 'invite_only' ? 'Manage Invite Codes' : 'Manage Password'}
                              </DropdownMenuItem>
                            )}
                            {canIssue && <DropdownMenuItem onClick={() => openIssueTicketModal(event)}><Ticket className="w-4 h-4 mr-2" />Issue Tickets</DropdownMenuItem>}
                            <DropdownMenuItem onClick={() => navigate(`/organizer/events/${event.id}/attendees`)}>View Attendees</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => navigate(`/organizer/analytics?event=${event.id}`)}>View Analytics</DropdownMenuItem>
                            {eventStatus === 'completed' && <DropdownMenuItem onClick={() => navigate(`/organizer/events/${event.id}/post-event`)}><BarChart3 className="w-4 h-4 mr-2" />Post-Event Report</DropdownMenuItem>}
                            {eventStatus !== 'completed' && <DropdownMenuItem onClick={() => navigate(`/organizer/check-in?event=${event.id}`)}>Check-In Attendees</DropdownMenuItem>}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => toggleTransfers(event.id, event.allow_transfers)}><ArrowRightLeft className="w-4 h-4 mr-2" />{event.allow_transfers ? 'Disable Transfers' : 'Enable Transfers'}</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {eventStatus !== 'completed' && eventStatus !== 'cancelled' && (
                              <DropdownMenuItem onClick={() => openCancelModal(event)} className="text-red-600"><XCircle className="w-4 h-4 mr-2" />Cancel Event</DropdownMenuItem>
                            )}
                            {isDeletable ? (
                              <DropdownMenuItem onClick={() => deleteEvent(event.id)} className="text-red-600" disabled={deleting === event.id}><Trash2 className="w-4 h-4 mr-2" />{deleting === event.id ? 'Deleting...' : 'Delete Event'}</DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem disabled className="text-muted-foreground"><Lock className="w-4 h-4 mr-2" />Cannot Delete (Tickets Sold)</DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          
          {/* Pagination */}
          {filteredEvents.length > 0 && (
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

      {issueTicketModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-border/10">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Issue Ticket</h3>
                <p className="text-sm text-muted-foreground mt-1">{issueTicketModal.event?.title}</p>
              </div>
              <button onClick={closeIssueTicketModal} className="p-2 hover:bg-muted rounded-lg transition-colors"><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>
            {issueSuccess ? (
              <div className="p-6">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle className="w-8 h-8 text-green-600" /></div>
                  <h4 className="text-lg font-semibold text-foreground mb-2">Ticket Issued Successfully!</h4>
                  <p className="text-sm text-muted-foreground">Confirmation email sent to {issueSuccess.attendeeEmail}</p>
                </div>
                <div className="bg-muted rounded-xl p-4 space-y-3">
                  <div className="flex justify-between"><span className="text-sm text-muted-foreground">Attendee</span><span className="text-sm font-medium text-foreground">{issueSuccess.attendeeName}</span></div>
                  <div className="flex justify-between"><span className="text-sm text-muted-foreground">Ticket Type</span><span className="text-sm font-medium text-foreground">{issueSuccess.ticketType}</span></div>
                  <div className="flex justify-between"><span className="text-sm text-muted-foreground">Price</span>
                  {issueSuccess.isSelling ? (
                    <span className="text-sm font-medium text-foreground">{formatPrice(issueSuccess.amount, issueTicketModal.event?.currency || 'USD')}</span>
                  ) : (
                    <Badge className="bg-green-100 text-green-700">Complimentary</Badge>
                  )}
                </div>
                {issueSuccess.isSelling && issueSuccess.paymentMethod && (
                  <div className="flex justify-between"><span className="text-sm text-muted-foreground">Payment Method</span><span className="text-sm font-medium text-foreground">{issueSuccess.paymentMethod}</span></div>
                )}
                {!issueSuccess.isSelling && issueSuccess.reason && (
                  <div className="flex justify-between"><span className="text-sm text-muted-foreground">Reason</span><span className="text-sm font-medium text-foreground">{issueSuccess.reason}</span></div>
                )}
                  <div className="flex justify-between pt-2 border-t border-border/20"><span className="text-sm text-muted-foreground">Ticket Code</span><span className="text-sm font-mono font-medium text-[#2969FF]">{issueSuccess.ticketCode}</span></div>
                </div>
                <div className="flex gap-3 mt-6">
                  <Button onClick={() => { setIssueSuccess(null); setIssueForm({ firstName: '', lastName: '', attendee_email: '', attendee_phone: '', ticket_type_id: issueTicketModal.event?.ticket_types?.[0]?.id || '', issue_mode: 'complimentary', manual_issue_type: 'complimentary', payment_method: 'cash', payment_reference: '' }); }} variant="outline" className="flex-1 rounded-xl">Issue Another</Button>
                  <Button onClick={closeIssueTicketModal} className="flex-1 bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl">Done</Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleIssueTicket} className="p-6 space-y-4">
                {issueError && <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm"><AlertCircle className="w-4 h-4 flex-shrink-0" />{issueError}</div>}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="firstName" className="text-sm font-medium text-foreground">First Name <span className="text-red-500">*</span></Label>
                    <Input id="firstName" type="text" placeholder="John" value={issueForm.firstName} onChange={(e) => setIssueForm(prev => ({ ...prev, firstName: e.target.value }))} className="h-12 rounded-xl bg-muted border-0" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName" className="text-sm font-medium text-foreground">Last Name <span className="text-red-500">*</span></Label>
                    <Input id="lastName" type="text" placeholder="Doe" value={issueForm.lastName} onChange={(e) => setIssueForm(prev => ({ ...prev, lastName: e.target.value }))} className="h-12 rounded-xl bg-muted border-0" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="attendee_email" className="text-sm font-medium text-foreground">Email <span className="text-red-500">*</span></Label>
                  <Input id="attendee_email" type="email" placeholder="email@example.com" value={issueForm.attendee_email} onChange={(e) => setIssueForm(prev => ({ ...prev, attendee_email: e.target.value }))} className="h-12 rounded-xl bg-muted border-0" required />
                  <p className="text-xs text-muted-foreground">Ticket will be sent to this email</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="attendee_phone" className="text-sm font-medium text-foreground">Phone Number <span className="text-muted-foreground">(optional)</span></Label>
                  <Input id="attendee_phone" type="tel" placeholder="+234 800 000 0000" value={issueForm.attendee_phone} onChange={(e) => setIssueForm(prev => ({ ...prev, attendee_phone: e.target.value }))} className="h-12 rounded-xl bg-muted border-0" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ticket_type" className="text-sm font-medium text-foreground">Ticket Type <span className="text-red-500">*</span></Label>
                  <select id="ticket_type" value={issueForm.ticket_type_id} onChange={(e) => setIssueForm(prev => ({ ...prev, ticket_type_id: e.target.value }))} className="w-full h-12 px-4 rounded-xl bg-muted border-0 text-foreground focus:ring-2 focus:ring-primary" required>
                    <option value="">Select ticket type</option>
                    {issueTicketModal.event?.ticket_types?.map((type) => {
                      const remaining = (type.quantity_available || 0) - (type.quantity_sold || 0);
                      const selectedTicketType = issueTicketModal.event?.ticket_types?.find(t => t.id === issueForm.ticket_type_id);
                      return <option key={type.id} value={type.id} disabled={remaining <= 0}>{type.name} - {formatPrice(type.price, issueTicketModal.event?.currency)} ({remaining} left)</option>;
                    })}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">Issue Mode <span className="text-red-500">*</span></Label>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setIssueForm(prev => ({ ...prev, issue_mode: 'complimentary' }))}
                      className={`flex-1 h-12 px-4 rounded-xl font-medium transition-all ${
                        issueForm.issue_mode === 'complimentary'
                          ? 'bg-green-100 text-green-700 border-2 border-green-300'
                          : 'bg-muted text-muted-foreground border-2 border-transparent hover:bg-[#E8EAED]'
                      }`}
                    >
                      Complimentary
                    </button>
                    <button
                      type="button"
                      onClick={() => setIssueForm(prev => ({ ...prev, issue_mode: 'sell' }))}
                      className={`flex-1 h-12 px-4 rounded-xl font-medium transition-all ${
                        issueForm.issue_mode === 'sell'
                          ? 'bg-[#2969FF]/10 text-[#2969FF] border-2 border-[#2969FF]'
                          : 'bg-muted text-muted-foreground border-2 border-transparent hover:bg-[#E8EAED]'
                      }`}
                    >
                      Sell Ticket
                    </button>
                  </div>
                </div>
                {issueForm.issue_mode === 'complimentary' && (
                <div className="space-y-2">
                  <Label htmlFor="issue_type" className="text-sm font-medium text-foreground">Reason for Issue <span className="text-red-500">*</span></Label>
                  <select id="issue_type" value={issueForm.manual_issue_type} onChange={(e) => setIssueForm(prev => ({ ...prev, manual_issue_type: e.target.value }))} className="w-full h-12 px-4 rounded-xl bg-muted border-0 text-foreground focus:ring-2 focus:ring-primary" required>
                    {MANUAL_ISSUE_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                  </select>
                </div>
                )}
                {issueForm.issue_mode === 'sell' && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="payment_method" className="text-sm font-medium text-foreground">Payment Method <span className="text-red-500">*</span></Label>
                      <select id="payment_method" value={issueForm.payment_method} onChange={(e) => setIssueForm(prev => ({ ...prev, payment_method: e.target.value }))} className="w-full h-12 px-4 rounded-xl bg-muted border-0 text-foreground focus:ring-2 focus:ring-primary" required>
                        {PAYMENT_METHODS.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="payment_reference" className="text-sm font-medium text-foreground">Payment Reference <span className="text-muted-foreground">(optional)</span></Label>
                      <Input id="payment_reference" type="text" placeholder="Transaction ID, receipt number, etc." value={issueForm.payment_reference} onChange={(e) => setIssueForm(prev => ({ ...prev, payment_reference: e.target.value }))} className="h-12 rounded-xl bg-muted border-0" />
                    </div>
                    {(() => {
                      const selectedTicketType = issueTicketModal.event?.ticket_types?.find(t => t.id === issueForm.ticket_type_id);
                      return (
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                          <p className="text-sm text-blue-700"><span className="font-medium">Ticket Price:</span> {formatPrice(selectedTicketType?.price || 0, issueTicketModal.event?.currency || 'USD')}</p>
                          <p className="text-xs text-blue-600 mt-1">This sale will be recorded and counted toward revenue reports.</p>
                        </div>
                      );
                    })()}
                  </>
                )}
                {issueForm.issue_mode === 'complimentary' && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                  <p className="text-sm text-green-700"><span className="font-medium">Price:</span> Complimentary (Free)</p>
                  <p className="text-xs text-green-600 mt-1">This ticket will not count toward revenue reports.</p>
                </div>
                )}
                <Button type="submit" disabled={issueLoading} className="w-full h-12 bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl font-medium">
                  {issueLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Issuing Ticket...</> : <><Ticket className="w-4 h-4 mr-2" />Issue Ticket</>}
                </Button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Access Management Modal */}
      {accessModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-border/10">
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  {accessModal.event?.visibility === 'invite_only' ? 'Manage Invite Codes' : 'Manage Event Password'}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">{accessModal.event?.title}</p>
              </div>
              <button onClick={closeAccessModal} className="p-2 hover:bg-muted rounded-lg transition-colors">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Password Protected Event */}
              {accessModal.event?.visibility === 'password' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-4">
                    <Lock className="w-5 h-5" />
                    <span className="text-sm">Attendees must enter this password to access your event</span>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-foreground">Event Password</Label>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter event password"
                        className="flex-1 h-12 rounded-xl bg-muted border-0 font-mono"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={generateRandomPassword}
                        className="h-12 rounded-xl"
                        title="Generate random password"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => copyToClipboard(newPassword)}
                        className="h-12 rounded-xl"
                        title="Copy password"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <Button
                    onClick={updateEventPassword}
                    className="w-full h-12 bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl"
                  >
                    <Key className="w-4 h-4 mr-2" />
                    Update Password
                  </Button>
                </div>
              )}

              {/* Invite Code Event */}
              {accessModal.event?.visibility === 'invite_only' && (
                <div className="space-y-6">
                  {/* Send Invite by Email */}
                  <div className="p-4 bg-blue-50 rounded-xl space-y-3">
                    <div className="flex items-center gap-2 text-blue-700">
                      <Mail className="w-5 h-5" />
                      <span className="font-medium">Send Invite by Email</span>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="Enter email address"
                        className="flex-1 h-10 rounded-lg bg-card border border-blue-200"
                      />
                      <Button
                        onClick={sendInviteEmail}
                        disabled={sendingInvite}
                        className="h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                      >
                        {sendingInvite ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-blue-600">A unique invite code will be generated and sent to this email</p>
                  </div>

                  {/* Add New Code */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium text-foreground">Create New Invite Code</Label>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        value={newAccessCode.code}
                        onChange={(e) => setNewAccessCode(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                        placeholder="Code (e.g., VIP2024)"
                        className="flex-1 h-10 rounded-lg bg-muted border-0 font-mono uppercase"
                        maxLength={20}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={generateRandomCode}
                        className="h-10 rounded-lg"
                        title="Generate random code"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="text"
                        value={newAccessCode.name}
                        onChange={(e) => setNewAccessCode(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Label (optional)"
                        className="h-10 rounded-lg bg-muted border-0"
                      />
                      <Input
                        type="number"
                        value={newAccessCode.maxUses}
                        onChange={(e) => setNewAccessCode(prev => ({ ...prev, maxUses: e.target.value }))}
                        placeholder="Max uses (unlimited)"
                        className="h-10 rounded-lg bg-muted border-0"
                        min="1"
                      />
                    </div>
                    <Button
                      onClick={addAccessCode}
                      className="w-full h-10 bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-lg"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Code
                    </Button>
                  </div>

                  {/* Existing Codes */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium text-foreground">
                      Existing Codes ({accessCodes.length})
                    </Label>

                    {accessLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-[#2969FF]" />
                      </div>
                    ) : accessCodes.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Ticket className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <p>No invite codes yet</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {accessCodes.map((code) => (
                          <div
                            key={code.id}
                            className={`p-3 rounded-lg border ${
                              code.is_active ? 'bg-muted border-transparent' : 'bg-muted border-border/20 opacity-60'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-medium text-foreground">{code.code}</span>
                                  {code.name && (
                                    <Badge className="bg-purple-100 text-purple-700 text-xs">{code.name}</Badge>
                                  )}
                                  {!code.is_active && (
                                    <Badge className="bg-muted text-muted-foreground text-xs">Disabled</Badge>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  Used: {code.current_uses || 0}
                                  {code.max_uses && ` / ${code.max_uses}`}
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => copyToClipboard(code.code)}
                                  className="h-8 w-8 rounded-lg"
                                  title="Copy code"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => toggleCodeActive(code.id, code.is_active)}
                                  className={`h-8 w-8 rounded-lg ${code.is_active ? 'text-orange-600 hover:bg-orange-50' : 'text-green-600 hover:bg-green-50'}`}
                                  title={code.is_active ? 'Disable code' : 'Enable code'}
                                >
                                  {code.is_active ? <X className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => deleteAccessCode(code.id)}
                                  className="h-8 w-8 rounded-lg text-red-600 hover:bg-red-50"
                                  title="Delete code"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-border/10">
              <Button
                onClick={closeAccessModal}
                variant="outline"
                className="w-full h-12 rounded-xl"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Event Modal */}
      {cancelModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-border/10">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Cancel Event</h3>
                <p className="text-sm text-muted-foreground mt-1">{cancelModal.event?.title}</p>
              </div>
              <button onClick={closeCancelModal} className="p-2 hover:bg-muted rounded-lg transition-colors">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {cancelModal.event?.soldTickets > 0 && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>This event has {cancelModal.event.soldTickets} ticket(s) sold. All attendees will be automatically refunded and notified via email.</span>
                </div>
              )}
              <div className="space-y-2">
                <Label className="font-medium">Reason for cancellation <span className="text-red-500">*</span></Label>
                <div className="space-y-2">
                  {[
                    'Low ticket sales',
                    'Venue unavailable',
                    'Scheduling conflict',
                    'Weather conditions',
                    'Artist/performer cancellation',
                    'Personal reasons',
                  ].map((reason) => (
                    <label
                      key={reason}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        cancelReason === reason ? 'border-red-400 bg-red-50' : 'border-border hover:border-border/80'
                      }`}
                    >
                      <input
                        type="radio"
                        name="cancelReason"
                        value={reason}
                        checked={cancelReason === reason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        className="accent-red-500"
                      />
                      <span className="text-sm">{reason}</span>
                    </label>
                  ))}
                  <label
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      cancelReason === 'other' ? 'border-red-400 bg-red-50' : 'border-border hover:border-border/80'
                    }`}
                  >
                    <input
                      type="radio"
                      name="cancelReason"
                      value="other"
                      checked={cancelReason === 'other'}
                      onChange={(e) => setCancelReason(e.target.value)}
                      className="accent-red-500"
                    />
                    <span className="text-sm">Other</span>
                  </label>
                  {cancelReason === 'other' && (
                    <Input
                      placeholder="Please specify the reason..."
                      value={customCancelReason}
                      onChange={(e) => setCustomCancelReason(e.target.value)}
                      className="h-12 rounded-xl mt-2"
                    />
                  )}
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-border/10 flex gap-3">
              <Button
                variant="outline"
                onClick={closeCancelModal}
                className="flex-1 h-12 rounded-xl"
              >
                Keep Event
              </Button>
              <Button
                onClick={handleCancelEvent}
                disabled={cancelingEvent || !cancelReason || (cancelReason === 'other' && !customCancelReason.trim())}
                className="flex-1 h-12 rounded-xl bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
              >
                {cancelingEvent ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Cancelling...</>
                ) : (
                  'Cancel Event'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
