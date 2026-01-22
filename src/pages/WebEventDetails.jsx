import { getFeesByCurrency, DEFAULT_FEES } from '@/config/fees'
import DOMPurify from 'dompurify'
import { formatPrice } from '@/config/currencies'
import { useState, useEffect } from 'react'
import { useNavigate, useParams, useLocation, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { WaitlistDialog } from '@/components/WaitlistDialog'
import { StartGroupModal } from '@/components/StartGroupModal'
import { getWaitlistPosition } from '@/services/waitlist'
import { Calendar, MapPin, Users, Clock, Share2, Heart, Minus, Plus, ArrowLeft, Loader2, CheckCircle, DoorOpen, Car, Camera, Video, UtensilsCrossed, Wine, Accessibility, AlertCircle, ExternalLink, Play, Monitor, Mail, UserPlus, UserCheck, Grid3x3, ChevronLeft, ChevronRight, UsersRound } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { getEvent } from '@/services/events'
import { supabase } from '@/lib/supabase'
import { EventAccessGate } from '@/components/EventAccessGate'
import { toast } from 'sonner'

export function WebEventDetails() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { id } = useParams()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  
  const [event, setEvent] = useState(null)
  const [ticketTypes, setTicketTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [waitlistOpen, setWaitlistOpen] = useState(false)
  const [isOnWaitlist, setIsOnWaitlist] = useState(false)
  const [waitlistPosition, setWaitlistPosition] = useState(null)
  const [error, setError] = useState(null)
  
  const [selectedTickets, setSelectedTickets] = useState(location.state?.selectedTickets || {})
  const [isFavorite, setIsFavorite] = useState(false)
  const [savingFavorite, setSavingFavorite] = useState(false)
  const [childEvents, setChildEvents] = useState([])
  const [selectedDate, setSelectedDate] = useState(null)
  const [fees, setFees] = useState({
    serviceFeePercent: DEFAULT_FEES.serviceFeePercent || 0.05,
    serviceFeeFixedPerTicket: DEFAULT_FEES.serviceFeeFixedPerTicket || 0,
    serviceFeeCap: DEFAULT_FEES.serviceFeeCap || null
  })
  const [accessGranted, setAccessGranted] = useState(false)
  const [recommendedEvents, setRecommendedEvents] = useState([])
  const [isFollowing, setIsFollowing] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)
  const [recurringViewMode, setRecurringViewMode] = useState('grid') // 'grid' or 'calendar'
  const [recurringPage, setRecurringPage] = useState(1)
  const [showGroupModal, setShowGroupModal] = useState(false) // Group Buy modal

  // Function to load tickets for a specific event (for recurring events)
  const loadTicketsForEvent = async (eventId) => {
    if (!eventId) return
    
    try {
      const { data: tickets, error: ticketsError } = await supabase
        .from('ticket_types')
        .select('*')
        .eq('event_id', eventId)
        .eq('is_active', true)
        .order('price', { ascending: true })
      
      if (ticketsError) {
        console.warn('Error loading tickets for event:', ticketsError.message)
        // Don't throw - free events may not have tickets
      }
      
      // Set ticket types (empty array if none found - free events won't have tickets)
      setTicketTypes(tickets || [])
      // Reset selected tickets when switching dates
      setSelectedTickets({})
    } catch (err) {
      console.warn('Error loading tickets:', err.message)
      // Set empty array on error - page can still show free event info
      setTicketTypes([])
    }
  }

  useEffect(() => {
    async function loadEvent() {
      setLoading(true)
      setError(null)
      try {
        // Fetch event details
        const eventData = await getEvent(id)
        if (!eventData) {
          setError('Event not found')
          return
        }
        setEvent(eventData)
        
        // Fetch ticket types for this event
        await loadTicketsForEvent(eventData.id)
      } catch (err) {
        console.error('Error loading event:', err)
        // Provide more helpful error messages
        if (err.code === 'PGRST116') {
        setError('Event not found')
        } else if (err.message?.includes('fetch') || err.message?.includes('network')) {
          setError('Network error. Please check your connection and try again.')
        } else {
          setError('Event not found')
        }
      } finally {
        setLoading(false)
      }
    }
    
    if (id) {
      loadEvent()
    }
  }, [id])

  // Check if user has saved this event
  useEffect(() => {
    async function checkIfSaved() {
      if (!user || !event) {
        setIsFavorite(false)
        return
      }
      
      try {
        const { data, error } = await supabase
          .from('saved_events')
          .select('id')
          .eq('user_id', user.id)
          .eq('event_id', event.id)
          .maybeSingle() // Use maybeSingle() instead of single() to avoid errors when no row found
        
        setIsFavorite(!!data && !error)
      } catch (err) {
        // Not saved - that's fine
        setIsFavorite(false)
      }
    }
    
    checkIfSaved()
  }, [user, event])

  // Check if user is following the organizer
  useEffect(() => {
    async function checkIfFollowing() {
      if (!user || !event?.organizer?.id) {
        setIsFollowing(false)
        return
      }
      
      try {
        const { data, error } = await supabase
          .from('followers')
          .select('id')
          .eq('user_id', user.id)
          .eq('organizer_id', event.organizer.id)
          .maybeSingle() // Use maybeSingle() instead of single() to avoid errors when no row found
        
        setIsFollowing(!!data && !error)
      } catch (err) {
        // Not following - that's fine
        setIsFollowing(false)
      }
    }
    
    checkIfFollowing()
  }, [user, event?.organizer?.id])

  // Toggle save/unsave event
  const toggleFavorite = async () => {
    if (!user) {
      // Redirect to login if not logged in
      navigate('/login', { state: { from: location.pathname } })
      return
    }
    
    if (!event) return
    
    setSavingFavorite(true)
    try {
      if (isFavorite) {
        // Unsave the event
        const { error } = await supabase
          .from('saved_events')
          .delete()
          .eq('user_id', user.id)
          .eq('event_id', event.id)
        
        if (error) throw error
        setIsFavorite(false)
      } else {
        // Save the event
        const { error } = await supabase
          .from('saved_events')
          .insert({
            user_id: user.id,
            event_id: event.id
          })
        
        if (error) throw error
        setIsFavorite(true)
      }
    } catch (err) {
      console.error('Error toggling favorite:', err)
    } finally {
      setSavingFavorite(false)
    }
  }

  // Toggle follow/unfollow organizer
  const toggleFollow = async () => {
    if (!user) {
      navigate('/login', { state: { from: location.pathname } })
      return
    }
    
    if (!event?.organizer?.id) return
    
    setFollowLoading(true)
    try {
      if (isFollowing) {
        await supabase
          .from('followers')
          .delete()
          .eq('user_id', user.id)
          .eq('organizer_id', event.organizer.id)
        setIsFollowing(false)
      } else {
        await supabase
          .from('followers')
          .insert({
            user_id: user.id,
            organizer_id: event.organizer.id,
            notifications_enabled: true
          })
        setIsFollowing(true)
      }
    } catch (err) {
      console.error('Error toggling follow:', err)
    } finally {
      setFollowLoading(false)
    }
  }

  // Check if access has been granted for private events
  useEffect(() => {
    if (event) {
      const visibility = event.visibility || 'public'
      
      // Public and unlisted events don't need access verification
      if (visibility === 'public' || visibility === 'unlisted') {
        setAccessGranted(true)
        return
      }
      
      // Check if access was previously granted (stored in sessionStorage)
      const storedAccess = sessionStorage.getItem(`event_access_${event.id}`)
      if (storedAccess === 'granted') {
        setAccessGranted(true)
        return
      }
      
      // Access not yet granted for private events
      setAccessGranted(false)
    }
  }, [event])

  // Load recommended events based on category and city
  useEffect(() => {
    async function loadRecommendedEvents() {
      if (!event) return
      
      try {
        const { data, error } = await supabase
          .from('events')
          .select('id, title, slug, image_url, start_date, venue_name, city, category, is_free, currency')
          .eq('status', 'published')
          .neq('id', event.id)
          .gte('start_date', new Date().toISOString())
          .order('start_date', { ascending: true })
          .limit(20)
        
        if (error) throw error
        
        // Score and sort by relevance
        const scored = (data || []).map(e => {
          let score = 0
          if (e.category === event.category) score += 3
          if (e.city === event.city) score += 2
          return { ...e, score }
        }).sort((a, b) => b.score - a.score).slice(0, 5)
        
        setRecommendedEvents(scored)
      } catch (err) {
        console.error('Error loading recommended events:', err)
      }
    }
    
    loadRecommendedEvents()
  }, [event])



  // Fetch service fee rate based on event currency
  useEffect(() => {
    async function loadFees() {
      if (event?.currency) {
        const feeData = await getFeesByCurrency(event.currency);
        setFees({
          serviceFeePercent: feeData?.serviceFeePercent || 0.05,
          serviceFeeFixedPerTicket: feeData?.serviceFeeFixedPerTicket || 0,
          serviceFeeCap: feeData?.serviceFeeCap || null
        });
      }
    }
    loadFees();
  }, [event?.currency]);

  // Load child events and generate future dates for recurring events
  useEffect(() => {
    async function loadChildEvents() {
      if (event?.is_recurring) {
        // Get all existing child events (future dates)
        const { data: children } = await supabase
          .from('events')
          .select('id, title, start_date, end_date, slug, status')
          .eq('parent_event_id', event.id)
          .gte('start_date', new Date().toISOString()) // Only future dates
          .order('start_date', { ascending: true });
        
        const existingChildren = children || [];
        
        // Generate future dates dynamically (up to 1 year ahead) even if child events don't exist
        const { generateRecurringDates } = await import('@/utils/recurringDates');
        const maxFutureDate = new Date();
        maxFutureDate.setFullYear(maxFutureDate.getFullYear() + 1); // 1 year ahead
        
        // Generate dates based on recurring pattern
        const generatedDates = generateRecurringDates(
          event.start_date.split('T')[0],
          event.start_date.split('T')[1]?.substring(0, 5) || '00:00',
          event.end_date.split('T')[1]?.substring(0, 5) || '23:59',
          event.recurring_type || 'weekly',
          event.recurring_days || [],
          event.recurring_end_type || 'never',
          event.recurring_occurrences || 52,
          maxFutureDate.toISOString().split('T')[0] // Use 1 year as end date for generation
        );
        
        // Filter to only future dates and create virtual events for dates that don't have child events
        const now = new Date();
        const virtualEvents = [];
        const existingDates = new Set(existingChildren.map(c => c.start_date.split('T')[0]));
        
        generatedDates.forEach((date, index) => {
          // Skip first date (parent event)
          if (index === 0) return;
          
          // Only include future dates
          if (date <= now) return;
          
          const dateStr = date.toISOString().split('T')[0];
          
          // If a child event exists for this date, use it
          const existingChild = existingChildren.find(c => c.start_date.startsWith(dateStr));
          if (existingChild) {
            virtualEvents.push(existingChild);
          } else {
            // Create virtual event for dates that don't have child events yet
            const startDateTime = `${dateStr}T${event.start_date.split('T')[1] || '00:00:00'}`;
            const endDateTime = event.is_multi_day 
              ? `${event.end_date.split('T')[0]}T${event.end_date.split('T')[1] || '23:59:00'}`
              : `${dateStr}T${event.end_date.split('T')[1] || '23:59:00'}`;
            
            virtualEvents.push({
              id: `virtual-${dateStr}`, // Virtual ID for dates without child events
              title: event.title,
              start_date: startDateTime,
              end_date: endDateTime,
              slug: null,
              status: 'published',
              image_url: event.image_url, // Inherit parent event image
              cover_image_url: event.cover_image_url, // Inherit parent event cover image
              is_virtual: true, // Flag to indicate this is a virtual event
              parent_event_id: event.id
            });
          }
        });
        
        // Limit to reasonable number (e.g., next 52 occurrences or 1 year)
        setChildEvents(virtualEvents.slice(0, 52));
        
        // Set current event as default selected date
        if (!selectedDate) {
          setSelectedDate(event.id);
        }
      } else {
        // For non-recurring events, ensure selectedDate is the current event
        setSelectedDate(event?.id || null);
      }
    }
    loadChildEvents();
  }, [event?.is_recurring, event?.id, event?.recurring_type, event?.recurring_days, event?.recurring_end_type]);

  // Track referral code from URL
  useEffect(() => {
    const refCode = searchParams.get('ref')
    if (refCode && id && /^[A-Za-z0-9-]+$/.test(refCode)) {
      // Store in localStorage for checkout
      localStorage.setItem('referral_code', refCode)
      localStorage.setItem('referral_event_id', id)
      
      // Record click in database
      const recordClick = async () => {
        try {
          // Find promoter by short_code or referral_code
          const { data: promoter } = await supabase
            .from('promoters')
            .select('id')
            .or(`short_code.eq.${refCode},referral_code.eq.${refCode}`)
            .single()
          
          if (promoter) {
            // Record the click
            await supabase.from('promoter_clicks').insert({
              promoter_id: promoter.id,
              event_id: id,
              referrer: document.referrer || null
            })
            
            // Update promoter total_clicks
            await supabase.rpc('increment_promoter_clicks', { promoter_id: promoter.id })
          }
        } catch (err) {
          console.error('Error recording referral click:', err)
        }
      }
      recordClick()
    }
  }, [searchParams, id])

  // Track affiliate code from URL
  useEffect(() => {
    const affCode = searchParams.get('aff')
    if (affCode) {
      // Validate format (alphanumeric and dash only - XSS prevention)
      if (/^[A-Za-z0-9-]+$/.test(affCode)) {
        localStorage.setItem('affiliate_code', affCode)
        console.log('Affiliate code stored:', affCode)
      }
    }
  }, [searchParams])


  const updateTicketQuantity = (tierId, delta) => {
    setSelectedTickets(prev => {
      const current = prev[tierId] || 0
      const tier = ticketTypes.find(t => t.id === tierId)
      const maxAvailable = tier?.quantity_available || 100
      const maxPerOrder = event?.max_tickets_per_order || 10;
      const newQuantity = Math.max(0, Math.min(maxAvailable, Math.min(maxPerOrder, current + delta)))
      return { ...prev, [tierId]: newQuantity }
    })
  }

  const totalTickets = Object.values(selectedTickets).reduce((sum, qty) => sum + qty, 0)
  const isAllSoldOut = ticketTypes.length > 0 && ticketTypes.every(t => (t.quantity_sold || 0) >= (t.quantity_available || t.quantity_total || 0))
  
  // Free event detection - use DB flag or fallback to checking ticket prices
  const isFreeEvent = event?.is_free || (ticketTypes.length === 0) || (ticketTypes.length > 0 && ticketTypes.every(t => t.price === 0))
  
  const totalAmount = Object.entries(selectedTickets).reduce((sum, [tierId, qty]) => {
    const tier = ticketTypes.find(t => t.id === tierId)
    return sum + (tier?.price || 0) * qty
  }, 0)

  // Calculate service fee (percentage + fixed per ticket, with cap)
  const calculatedFee = (() => {
    let fee = (totalAmount * fees.serviceFeePercent) + (fees.serviceFeeFixedPerTicket * totalTickets);
    if (fees.serviceFeeCap && fee > fees.serviceFeeCap) {
      fee = fees.serviceFeeCap;
    }
    return Math.round(fee * 100) / 100;
  })();
  
  // Check if organizer is absorbing the fee
  const organizerAbsorbsFee = event?.fee_handling === 'absorb';
  // If organizer absorbs, attendee sees no fee; otherwise show calculated fee
  const serviceFee = organizerAbsorbsFee ? 0 : calculatedFee;
  
  const totalWithFees = totalAmount + serviceFee;

  // Handle checkout/RSVP routing
  const handleCheckout = async () => {
    // For recurring events, use selected date's event ID, otherwise use current event
    const targetEventId = (event?.is_recurring && selectedDate) ? selectedDate : event?.id;
    
    // If child event is selected, ensure it has all required fields
    let checkoutEvent = event;
    if (selectedDate && selectedDate !== event.id) {
      const childEvent = childEvents.find(e => e.id === selectedDate);
      if (childEvent) {
        // If child event exists, use it but merge with parent's essential fields
        checkoutEvent = {
          ...event, // Parent event has all the metadata (organizer, currency, etc.)
          ...childEvent, // Child event has the specific date
          id: childEvent.id,
          start_date: childEvent.start_date,
          end_date: childEvent.end_date,
          slug: childEvent.slug || event.slug,
          parent_event_id: event.id
        };
      } else {
        // Child event not found, fall back to parent
        checkoutEvent = event;
      }
    }
    
    // Free event - go directly to free RSVP page (handles auth there)
    if (isFreeEvent) {
      navigate('/free-rsvp', { 
        state: { 
          event: checkoutEvent,
          selectedEventId: targetEventId
        } 
      })
      return
    }
    
    // Paid events require login first
    if (!user) {
      navigate("/login", { state: { from: location.pathname, selectedTickets } })
      return
    }
    
    // Paid event - need tickets selected, go to checkout
    if (totalTickets > 0) {
      navigate('/checkout', { 
        state: { 
          event: checkoutEvent,
          selectedEventId: targetEventId,
          selectedTickets, 
          ticketTypes,
          totalAmount
        } 
      })
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
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

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: event.title,
          text: event.description,
          url: window.location.href,
        })
      } catch (err) {
        console.log('Share cancelled')
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href)
      toast.success('Link copied to clipboard!')
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" />
      </div>
    )
  }

  if (error || !event) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <div className="text-6xl mb-4">😢</div>
        <h1 className="text-2xl font-bold text-[#0F0F0F] mb-2">Event Not Found</h1>
        <p className="text-[#0F0F0F]/60 mb-6">The event you're looking for doesn't exist or has been removed.</p>
        <Button onClick={() => navigate('/events')} className="bg-[#2969FF] hover:bg-[#1a4fd8] text-white rounded-xl">
          Browse Events
        </Button>
      </div>
    )
  }

  // Show access gate for private events
  const needsAccessGate = event && 
    ['password', 'invite_only', 'email_whitelist'].includes(event.visibility) && 
    !accessGranted

  if (needsAccessGate) {
    return (
      <EventAccessGate
        event={event}
        onAccessGranted={() => setAccessGranted(true)}
        onBack={() => navigate('/events')}
      />
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back Button */}
      <Button 
        variant="ghost" 
        className="mb-6 text-[#0F0F0F]/60 hover:text-[#0F0F0F]"
        onClick={() => navigate(-1)}
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Event Image */}
          <div className="aspect-video rounded-2xl overflow-hidden bg-[#F4F6FA]">
            <img 
              src={event.image_url} 
              alt={event.title}
              className="w-full h-full object-cover"
              onError={(e) => { 
                e.target.src = 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200'
              }}
            />
          </div>

          {/* Event Header */}
          <div className="relative">
            {/* Favorite and Share Buttons - Positioned absolutely on mobile, flex on desktop */}
            <div className="absolute top-0 right-0 z-10 flex gap-2 sm:relative sm:z-auto">
              <Button 
                variant="outline" 
                size="icon" 
                onClick={(e) => { e.stopPropagation(); toggleFavorite(); }}
                disabled={savingFavorite}
                className={`rounded-xl w-11 h-11 touch-manipulation flex-shrink-0 ${isFavorite ? 'text-red-500 border-red-500 bg-red-50 hover:bg-red-100' : ''}`}
                aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              >
                {savingFavorite ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Heart className={`w-5 h-5 ${isFavorite ? 'fill-red-500' : ''}`} />
                )}
              </Button>
              <Button 
                variant="outline" 
                size="icon" 
                className="rounded-xl w-11 h-11 touch-manipulation flex-shrink-0"
                onClick={(e) => { e.stopPropagation(); handleShare(); }}
                aria-label="Share event"
              >
                <Share2 className="w-5 h-5" />
              </Button>
            </div>

            <div className="pr-24 sm:pr-0">
              <div className="flex flex-wrap gap-2 mb-3">
                <Badge className="bg-[#2969FF]/10 text-[#2969FF] border-0 rounded-lg">
                  {event.category?.icon} {event.category?.name || 'Event'}
                </Badge>
                {event.is_recurring && (
                  <Badge className="bg-purple-100 text-purple-700 border-0 rounded-lg">
                    🔄 Recurring Event
                  </Badge>
                )}
                {event.parent_event_id && (
                  <Badge className="bg-orange-100 text-orange-700 border-0 rounded-lg">
                    Part of Series
                  </Badge>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#0F0F0F] mb-4">{event.title}</h1>
              <div className="flex flex-wrap gap-4 text-[#0F0F0F]/60">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 flex-shrink-0" />
                  <span>{formatDate(event.start_date)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 flex-shrink-0" />
                  <span>{formatTime(event.start_date)} - {formatTime(event.end_date)}</span>
                </div>
                <div className="flex items-center gap-2">
                  {event.is_virtual ? (
                    <>
                      <Monitor className="w-5 h-5 text-purple-600 flex-shrink-0" />
                      <span className="text-purple-600 font-medium">Virtual Event (Online)</span>
                    </>
                  ) : (
                    <>
                      <MapPin className="w-5 h-5 flex-shrink-0 mt-0.5" />
                      <div className="flex flex-col">
                        {event.venue_name && (
                          <span className="font-medium text-[#0F0F0F]">{event.venue_name}</span>
                        )}
                        {event.venue_address && (
                          <span className="text-[#0F0F0F]/80 text-sm">{event.venue_address}</span>
                        )}
                        <span className="text-[#0F0F0F]/60 text-sm">
                          {[event.city, event.state, event.country].filter(Boolean).join(', ') || (!event.venue_name && !event.venue_address && 'Location TBA')}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Organizer */}
          <div>
            <h2 className="text-2xl font-bold text-[#0F0F0F] mb-4">Organized By</h2>
            <Card className="border-[#0F0F0F]/10 rounded-xl">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div 
                    className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
                    onClick={() => navigate(`/o/${event.organizer?.id}`)}
                  >
                    <div className="w-12 h-12 rounded-full bg-[#2969FF]/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {event.organizer?.logo_url ? (
                        <img 
                          src={event.organizer.logo_url} 
                          alt={event.organizer.business_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Users className="w-6 h-6 text-[#2969FF]" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-[#0F0F0F] truncate">{event.organizer?.business_name}</h3>
                        {event.organizer?.is_verified && (
                          <CheckCircle className="w-4 h-4 text-[#2969FF] flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-sm text-[#0F0F0F]/60">{event.organizer?.total_events || 0} events hosted</p>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      variant={isFollowing ? "default" : "outline"}
                      size="sm"
                      className={isFollowing 
                        ? "rounded-lg bg-[#2969FF] hover:bg-[#1a4fd8] text-white" 
                        : "rounded-lg text-[#2969FF] border-[#2969FF]/30 hover:bg-[#2969FF]/5"
                      }
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFollow();
                      }}
                      disabled={followLoading}
                    >
                      {followLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : isFollowing ? (
                        <>
                          <UserCheck className="w-4 h-4 mr-1" />
                          Following
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-4 h-4 mr-1" />
                          Follow
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-lg text-[#2969FF] border-[#2969FF]/30 hover:bg-[#2969FF]/5"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.location.href = `mailto:${event.organizer?.business_email || event.organizer?.email}`;
                      }}
                    >
                      <Mail className="w-4 h-4 mr-1" />
                      Contact
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Separator />

          {/* About */}
          <div>
            <h2 className="text-2xl font-bold text-[#0F0F0F] mb-4">About This Event</h2>
            <div 
              className="text-[#0F0F0F]/80 prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(event.description || '', { ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'b', 'i', 'u', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'blockquote', 'span'], ALLOWED_ATTR: ['href', 'target', 'rel', 'class'] }) }}
            />
          </div>

          {/* Upcoming Dates - for recurring events */}
          {event.is_recurring && (
            <>
              <Separator />
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold text-[#0F0F0F]">🔄 Upcoming Dates</h2>
                  <div className="flex items-center gap-2">
                    <Button
                      variant={recurringViewMode === 'grid' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        setRecurringViewMode('grid');
                        setRecurringPage(1);
                      }}
                      className={`rounded-lg ${recurringViewMode === 'grid' ? 'bg-[#2969FF] hover:bg-[#1a4fd8] text-white' : ''}`}
                    >
                      <Grid3x3 className="w-4 h-4 mr-1" />
                      Grid
                    </Button>
                    <Button
                      variant={recurringViewMode === 'calendar' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        setRecurringViewMode('calendar');
                        setRecurringPage(1);
                      }}
                      className={`rounded-lg ${recurringViewMode === 'calendar' ? 'bg-[#2969FF] hover:bg-[#1a4fd8] text-white' : ''}`}
                    >
                      <Calendar className="w-4 h-4 mr-1" />
                      Calendar
                    </Button>
                  </div>
                </div>
                <p className="text-[#0F0F0F]/60 mb-4">This is a recurring event. Select a date to purchase tickets for that specific occurrence:</p>
                {recurringViewMode === 'grid' ? (
                  <>
                        {(() => {
                      // Combine parent event and child events with images
                      const allEvents = [{ 
                        id: event.id, 
                        start_date: event.start_date, 
                        end_date: event.end_date, 
                        image_url: event.image_url,
                        cover_image_url: event.cover_image_url,
                        isParent: true 
                      }, ...childEvents];
                      const eventsPerPage = 12;
                      const totalPages = Math.ceil(allEvents.length / eventsPerPage);
                      const startIndex = (recurringPage - 1) * eventsPerPage;
                      const endIndex = startIndex + eventsPerPage;
                      const paginatedEvents = allEvents.slice(startIndex, endIndex);
                      
                      return (
                        <>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {paginatedEvents.map((evt) => (
                              <div 
                                key={evt.id}
                    onClick={() => {
                                  setSelectedDate(evt.id);
                                  loadTicketsForEvent(evt.id);
                    }}
                                className={`rounded-xl cursor-pointer transition-all overflow-hidden ${
                                  selectedDate === evt.id
                        ? 'bg-[#2969FF]/10 border-2 border-[#2969FF] shadow-md'
                        : 'bg-[#F4F6FA] hover:bg-[#2969FF]/5 border border-[#0F0F0F]/10'
                    }`}
                  >
                                {/* Event Image */}
                                {(evt.image_url || evt.cover_image_url || event.image_url || event.cover_image_url) ? (
                                  <div className="relative h-32 w-full overflow-hidden">
                                    <img 
                                      src={evt.image_url || evt.cover_image_url || event.image_url || event.cover_image_url}
                                      alt={evt.title || event.title}
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                ) : (
                                  <div className="h-32 w-full bg-gradient-to-br from-[#2969FF]/20 to-purple-500/20 flex items-center justify-center">
                                    <Calendar className="w-8 h-8 text-[#2969FF]/40" />
                                  </div>
                                )}
                                
                                {/* Event Details */}
                                <div className="p-4">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex-1 min-w-0">
                                      <p className="font-semibold text-[#0F0F0F] text-sm truncate">
                                        {new Date(evt.start_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                                      </p>
                                      <p className="text-xs text-[#0F0F0F]/60 mt-0.5">
                                        {new Date(evt.start_date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - {new Date(evt.end_date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        </p>
                      </div>
                                    {selectedDate === evt.id ? (
                                      <Badge className="bg-[#2969FF] text-white ml-2 flex-shrink-0">Selected</Badge>
                      ) : (
                                      <Badge variant="outline" className="border-[#0F0F0F]/20 ml-2 flex-shrink-0">Select</Badge>
                      )}
                    </div>
                                </div>
                              </div>
                            ))}
                  </div>
                  
                          {/* Pagination Controls */}
                          {totalPages > 1 && (
                            <div className="flex items-center justify-between mt-6 pt-4 border-t border-[#0F0F0F]/10">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setRecurringPage(prev => Math.max(1, prev - 1))}
                                disabled={recurringPage === 1}
                                className="rounded-lg"
                              >
                                <ChevronLeft className="w-4 h-4 mr-1" />
                                Previous
                              </Button>
                              <span className="text-sm text-[#0F0F0F]/60">
                                Page {recurringPage} of {totalPages}
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setRecurringPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={recurringPage === totalPages}
                                className="rounded-lg"
                              >
                                Next
                                <ChevronRight className="w-4 h-4 ml-1" />
                              </Button>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </>
                ) : (
                  // Calendar View
                  <div className="space-y-6">
                    {(() => {
                      // Group events by month
                      const allEvents = [{ id: event.id, start_date: event.start_date, end_date: event.end_date }, ...childEvents];
                      const eventsByMonth = {};
                      
                      allEvents.forEach(evt => {
                        const date = new Date(evt.start_date);
                        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                        if (!eventsByMonth[monthKey]) {
                          eventsByMonth[monthKey] = [];
                        }
                        eventsByMonth[monthKey].push(evt);
                      });
                      
                      return Object.keys(eventsByMonth).sort().map(monthKey => {
                        const events = eventsByMonth[monthKey];
                        const firstDate = new Date(events[0].start_date);
                        const monthName = firstDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                        
                        // Get first day of month and days in month
                        const year = firstDate.getFullYear();
                        const month = firstDate.getMonth();
                        const firstDayOfMonth = new Date(year, month, 1);
                        const lastDayOfMonth = new Date(year, month + 1, 0);
                        const daysInMonth = lastDayOfMonth.getDate();
                        const startingDayOfWeek = firstDayOfMonth.getDay();
                        
                        // Create calendar grid
                        const calendarDays = [];
                        
                        // Add empty cells for days before month starts
                        for (let i = 0; i < startingDayOfWeek; i++) {
                          calendarDays.push(null);
                        }
                        
                        // Add days of month with events marked
                        for (let day = 1; day <= daysInMonth; day++) {
                          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                          const dayEvent = events.find(e => e.start_date.startsWith(dateStr));
                          calendarDays.push({
                            day,
                            dateStr,
                            event: dayEvent,
                            isToday: dateStr === new Date().toISOString().split('T')[0]
                          });
                        }
                        
                        return (
                          <div key={monthKey} className="space-y-3">
                            <h3 className="text-lg font-semibold text-[#0F0F0F]">{monthName}</h3>
                            <div className="grid grid-cols-7 gap-2">
                              {/* Day headers */}
                              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                                <div key={day} className="text-center text-sm font-medium text-[#0F0F0F]/60 py-2">
                                  {day}
                                </div>
                              ))}
                              {/* Calendar days */}
                              {calendarDays.map((dayData, idx) => (
                                <div
                                  key={idx}
                                  className={`aspect-square flex items-center justify-center text-sm rounded-lg transition-all ${
                                    dayData === null
                                      ? 'bg-transparent'
                                      : dayData.event
                                      ? `cursor-pointer ${
                                          selectedDate === dayData.event.id
                                            ? 'bg-[#2969FF] text-white shadow-md'
                                            : 'bg-[#2969FF]/10 text-[#2969FF] hover:bg-[#2969FF]/20'
                                        }`
                                      : dayData.isToday
                                      ? 'bg-[#F4F6FA] border-2 border-[#2969FF]/30 text-[#0F0F0F]'
                                      : 'bg-[#F4F6FA] text-[#0F0F0F]/40'
                                  }`}
                                  onClick={dayData?.event ? () => {
                                    setSelectedDate(dayData.event.id);
                                    loadTicketsForEvent(dayData.event.id);
                                  } : undefined}
                                  title={dayData?.event ? new Date(dayData.event.start_date).toLocaleDateString('en-US', { 
                                    weekday: 'long', 
                                    month: 'long', 
                                    day: 'numeric', 
                                    year: 'numeric',
                                    hour: 'numeric',
                                    minute: '2-digit'
                                  }) : undefined}
                                >
                                  {dayData?.day || ''}
                                </div>
                              ))}
                            </div>
                            {/* List of events for this month with time */}
                            <div className="space-y-2 mt-4">
                              {events.map(evt => (
                                <div
                                  key={evt.id}
                      onClick={() => {
                                    setSelectedDate(evt.id);
                                    loadTicketsForEvent(evt.id);
                                  }}
                                  className={`p-3 rounded-lg cursor-pointer transition-all ${
                                    selectedDate === evt.id
                                      ? 'bg-[#2969FF]/10 border-2 border-[#2969FF]'
                          : 'bg-[#F4F6FA] hover:bg-[#2969FF]/5 border border-[#0F0F0F]/10'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                                      <p className="font-medium text-[#0F0F0F]">
                                        {new Date(evt.start_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                          </p>
                          <p className="text-sm text-[#0F0F0F]/60">
                                        {new Date(evt.start_date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - {new Date(evt.end_date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                          </p>
                        </div>
                                    {selectedDate === evt.id && (
                          <Badge className="bg-[#2969FF] text-white">Selected</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Link to parent event if this is a child */}
          {event.parent_event_id && (
            <>
              <Separator />
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl">
                <p className="text-orange-800 mb-2">This event is part of a recurring series.</p>
                <Button 
                  variant="outline" 
                  className="border-orange-300 text-orange-700 hover:bg-orange-100 rounded-xl"
                  onClick={async () => {
                    const { data } = await supabase
                      .from('events')
                      .select('slug, id')
                      .eq('id', event.parent_event_id)
                      .single();
                    if (data) navigate(`/event/${data.slug || data.id}`);
                  }}
                >
                  View All Dates
                </Button>
              </div>
            </>
          )}

          {/* Promo Video */}
          {event.promo_video_url && (
            <>
              <Separator />
              <div>
                <h2 className="text-2xl font-bold text-[#0F0F0F] mb-4">Event Video</h2>
                <div className="aspect-video rounded-2xl overflow-hidden bg-[#F4F6FA]">
                  {event.promo_video_url.includes('youtube.com') || event.promo_video_url.includes('youtu.be') ? (
                    <iframe
                      src={`https://www.youtube.com/embed/${event.promo_video_url.includes('youtu.be') 
                        ? event.promo_video_url.split('youtu.be/')[1]?.split('?')[0]
                        : event.promo_video_url.split('v=')[1]?.split('&')[0]}`}
                      className="w-full h-full"
                      allowFullScreen
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    />
                  ) : event.promo_video_url.includes('vimeo.com') ? (
                    <iframe
                      src={`https://player.vimeo.com/video/${event.promo_video_url.split('vimeo.com/')[1]?.split('?')[0]}`}
                      className="w-full h-full"
                      allowFullScreen
                    />
                  ) : event.promo_video_url.includes('tiktok.com') ? (
                    <div className="w-full h-full flex items-center justify-center">
                      <a 
                        href={event.promo_video_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-[#2969FF] hover:underline"
                      >
                        <Play className="w-8 h-8" />
                        <span>Watch on TikTok</span>
                      </a>
                    </div>
                  ) : (
                    <video src={event.promo_video_url} controls className="w-full h-full" />
                  )}
                </div>
              </div>
            </>
          )}

          {/* Multi-Day Schedule */}
          {event.is_multi_day && event.event_days && event.event_days.length > 0 && (
            <>
              <Separator />
              <div>
                <h2 className="text-2xl font-bold text-[#0F0F0F] mb-4">Event Schedule</h2>
                <div className="space-y-4">
                  {event.event_days
                    .sort((a, b) => a.day_number - b.day_number)
                    .map((day) => (
                    <Card key={day.id} className="border-[#0F0F0F]/10 rounded-xl overflow-hidden">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-10 h-10 rounded-full bg-[#2969FF]/10 flex items-center justify-center">
                            <span className="text-[#2969FF] font-bold">{day.day_number}</span>
                          </div>
                          <div>
                            <h3 className="font-semibold text-[#0F0F0F]">
                              {day.title || `Day ${day.day_number}`}
                            </h3>
                            <p className="text-sm text-[#0F0F0F]/60">
                              {new Date(day.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                              {day.start_time && ` • ${day.start_time.slice(0,5)} - ${day.end_time?.slice(0,5) || 'Late'}`}
                            </p>
                          </div>
                        </div>
                        {day.description && (
                          <p className="text-[#0F0F0F]/70 text-sm ml-13 pl-13">{day.description}</p>
                        )}
                        {day.event_day_activities && day.event_day_activities.length > 0 && (
                          <div className="mt-3 ml-13 pl-4 border-l-2 border-[#2969FF]/20 space-y-2">
                            {day.event_day_activities
                              .sort((a, b) => a.sort_order - b.sort_order)
                              .map((activity) => (
                              <div key={activity.id} className="text-sm">
                                <span className="text-[#2969FF] font-medium">{activity.start_time?.slice(0,5)}</span>
                                <span className="mx-2 text-[#0F0F0F]/40">•</span>
                                <span className="text-[#0F0F0F]">{activity.title}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Event Info Badges */}
          {(event.gate_opening_time || event.dress_code || event.is_adult_only || event.is_wheelchair_accessible || event.is_byob || event.is_photography_allowed === false || event.is_recording_allowed === false || event.is_parking_available || event.is_outside_food_allowed) && (
            <>
              <Separator />
              <div>
                <h2 className="text-2xl font-bold text-[#0F0F0F] mb-4">Event Information</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {event.gate_opening_time && (
                    <div className="flex items-center gap-2 p-3 bg-[#F4F6FA] rounded-xl">
                      <DoorOpen className="w-5 h-5 text-[#2969FF]" />
                      <div>
                        <p className="text-xs text-[#0F0F0F]/60">Gates Open</p>
                        <p className="text-sm font-medium">{event.gate_opening_time.slice(0,5)}</p>
                      </div>
                    </div>
                  )}
                  {event.dress_code && (
                    <div className="flex items-center gap-2 p-3 bg-[#F4F6FA] rounded-xl">
                      <Users className="w-5 h-5 text-[#2969FF]" />
                      <div>
                        <p className="text-xs text-[#0F0F0F]/60">Dress Code</p>
                        <p className="text-sm font-medium">{event.dress_code}</p>
                      </div>
                    </div>
                  )}
                  {event.is_adult_only && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 rounded-xl">
                      <AlertCircle className="w-5 h-5 text-red-500" />
                      <p className="text-sm font-medium text-red-700">18+ Event</p>
                    </div>
                  )}
                  {event.is_wheelchair_accessible && (
                    <div className="flex items-center gap-2 p-3 bg-green-50 rounded-xl">
                      <Accessibility className="w-5 h-5 text-green-600" />
                      <p className="text-sm font-medium text-green-700">Wheelchair Accessible</p>
                    </div>
                  )}
                  {event.is_parking_available && (
                    <div className="flex items-center gap-2 p-3 bg-[#F4F6FA] rounded-xl">
                      <Car className="w-5 h-5 text-[#2969FF]" />
                      <p className="text-sm font-medium">Parking Available</p>
                    </div>
                  )}
                  {event.is_byob && (
                    <div className="flex items-center gap-2 p-3 bg-[#F4F6FA] rounded-xl">
                      <Wine className="w-5 h-5 text-[#2969FF]" />
                      <p className="text-sm font-medium">BYOB Allowed</p>
                    </div>
                  )}
                  {event.is_outside_food_allowed && (
                    <div className="flex items-center gap-2 p-3 bg-[#F4F6FA] rounded-xl">
                      <UtensilsCrossed className="w-5 h-5 text-[#2969FF]" />
                      <p className="text-sm font-medium">Outside Food Allowed</p>
                    </div>
                  )}
                  {event.is_photography_allowed === false && (
                    <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-xl">
                      <Camera className="w-5 h-5 text-amber-600" />
                      <p className="text-sm font-medium text-amber-700">No Photography</p>
                    </div>
                  )}
                  {event.is_recording_allowed === false && (
                    <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-xl">
                      <Video className="w-5 h-5 text-amber-600" />
                      <p className="text-sm font-medium text-amber-700">No Recording</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Location */}
          <div>
            <h2 className="text-2xl font-bold text-[#0F0F0F] mb-4">Location</h2>
            <Card className="border-[#0F0F0F]/10 rounded-xl overflow-hidden">
              {event.google_map_link ? (
                <div className="h-40">
                  <iframe
                    src={event.google_map_link.includes('embed') 
                      ? event.google_map_link 
                      : `https://maps.google.com/maps?q=${encodeURIComponent((event.venue_address || '') + ', ' + (event.city || ''))}&output=embed`}
                    className="w-full h-full border-0"
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
              ) : event.venue_lat && event.venue_lng ? (
                <div className="h-40">
                  <iframe
                    src={`https://maps.google.com/maps?q=${event.venue_lat},${event.venue_lng}&output=embed`}
                    className="w-full h-full border-0"
                    allowFullScreen
                    loading="lazy"
                  />
                </div>
              ) : (
                <div className="h-24 bg-[#F4F6FA] flex items-center justify-center">
                  <MapPin className="w-8 h-8 text-[#0F0F0F]/20" />
                </div>
              )}
              <CardContent className="p-4">
                <div className="space-y-3">
                  {event.venue_name && (
                    <div>
                      <h3 className="font-semibold text-[#0F0F0F] mb-1">{event.venue_name}</h3>
                    </div>
                  )}
                  <div className="space-y-1">
                    {event.venue_address && (
                      <p className="text-sm text-[#0F0F0F]">{event.venue_address}</p>
                    )}
                    <p className="text-sm text-[#0F0F0F]/60">
                      {[event.city, event.state, event.country].filter(Boolean).join(', ') || 'Address TBA'}
                    </p>
                  </div>
                  <a 
                    href={event.google_map_link || `https://maps.google.com/maps?q=${encodeURIComponent([event.venue_address, event.city, event.state, event.country].filter(Boolean).join(', '))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[#2969FF] hover:text-[#1e54cc] hover:underline text-sm font-medium transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Get Directions
                  </a>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sponsors */}
          {event.event_sponsors && event.event_sponsors.length > 0 && (
            <>
              <Separator />
              <div>
                <h2 className="text-2xl font-bold text-[#0F0F0F] mb-4">Sponsors</h2>
                <div className="flex flex-wrap gap-6 items-center">
                  {event.event_sponsors
                    .sort((a, b) => a.sort_order - b.sort_order)
                    .map((sponsor) => (
                    <div key={sponsor.id} className="bg-white rounded-xl p-4 border border-[#0F0F0F]/10 hover:shadow-md transition-shadow">
                      <img 
                        src={sponsor.logo_url} 
                        alt={sponsor.name || 'Sponsor'}
                        className="h-16 w-auto max-w-[150px] object-contain"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <Separator />

        </div>

        {/* Ticket Sidebar */}
        <div className="lg:col-span-1">
          <Card className="border-[#0F0F0F]/10 rounded-2xl sticky top-16 md:top-20 lg:top-24">
            <CardContent className="p-6 space-y-6">
              {/* Recurring Event Date Selector */}
              {event?.is_recurring && (childEvents.length > 0 || event) && (
                <div className="mb-4 p-4 bg-purple-50 border border-purple-200 rounded-xl">
                  <label className="text-sm font-medium text-[#0F0F0F] mb-2 block">
                    📅 Select Event Date
                  </label>
                  <select
                    value={selectedDate || event.id}
                    onChange={(e) => {
                      const eventId = e.target.value;
                      setSelectedDate(eventId);
                      loadTicketsForEvent(eventId);
                    }}
                    className="w-full p-2 rounded-lg border border-purple-300 bg-white text-[#0F0F0F] focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value={event.id}>
                      {new Date(event.start_date).toLocaleDateString('en-US', { 
                        weekday: 'short', 
                        month: 'short', 
                        day: 'numeric', 
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit'
                      })}
                    </option>
                    {childEvents.map((child) => (
                      <option key={child.id} value={child.id}>
                        {new Date(child.start_date).toLocaleDateString('en-US', { 
                          weekday: 'short', 
                          month: 'short', 
                          day: 'numeric', 
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit'
                        })}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-purple-600 mt-2">
                    Tickets will be purchased for the selected date
                  </p>
                </div>
              )}
              
              <div>
                <h2 className="text-2xl font-bold text-[#0F0F0F] mb-4">
                  {isFreeEvent ? 'Register' : 'Select Tickets'}
                </h2>
                
                {isFreeEvent ? (
                  <div className="space-y-4">
                    {/* Free Event Badge */}
                    <div className="text-center py-4">
                      <Badge className="bg-green-100 text-green-700 border-0 text-lg px-4 py-2">
                        🎉 Free Event
                      </Badge>
                      <p className="text-[#0F0F0F]/60 mt-2">This event is free to attend!</p>
                    </div>
                    
                    {/* Donation Options */}
                    {/* Donation Options */}
                    {event.accepts_donations && event.donation_amounts?.length > 0 && (
                      <div className="space-y-3 pt-2 border-t border-green-200">
                        <p className="text-sm font-medium text-[#0F0F0F] flex items-center gap-2">
                          <span>💝</span> Support This Event (Optional)
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {event.donation_amounts.map((amount, idx) => (
                            <button
                              key={idx}
                              className="px-4 py-3 rounded-xl border-2 border-green-300 bg-green-50 hover:bg-green-100 text-green-700 font-semibold transition-colors"
                            >
                              {formatPrice(amount, event.currency)}
                            </button>
                          ))}
                        </div>
                        {event.allow_custom_donation && (
                          <p className="text-xs text-[#0F0F0F]/50 text-center">Custom amount available on next page</p>
                        )}
                      </div>
                    )}

                  </div>
                ) : (
                  <div className="space-y-4">
                    {ticketTypes.map(tier => {
                      const remaining = tier.quantity_available - (tier.quantity_sold || 0);
                      const isSoldOut = remaining <= 0;
                      
                      return (
                        <div 
                          key={tier.id} 
                          className={`p-4 border rounded-xl space-y-3 ${
                            isSoldOut 
                              ? 'border-red-200 bg-red-50/50 opacity-75' 
                              : 'border-[#0F0F0F]/10'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className={`font-semibold ${isSoldOut ? 'text-[#0F0F0F]/50' : 'text-[#0F0F0F]'}`}>
                                {tier.name}
                              </h3>
                              <p className={`text-2xl font-bold mt-1 ${isSoldOut ? 'text-[#0F0F0F]/40' : 'text-[#2969FF]'}`}>
                                {formatPrice(tier.price, event?.currency)}
                              </p>
                            </div>
                            {isSoldOut ? (
                              <Badge className="bg-red-100 text-red-600 border-red-200 rounded-lg">
                                Sold Out
                              </Badge>
                            ) : (() => {
                              const total = tier.quantity_available || tier.quantity_total || 100;
                              const percentRemaining = (remaining / total) * 100;
                              const isLowStock = remaining <= 10 || percentRemaining <= 20;
                              
                              return (
                                <Badge 
                                  variant="outline" 
                                  className={`rounded-lg ${
                                    isLowStock 
                                      ? 'bg-amber-50 text-amber-600 border-amber-300' 
                                      : 'border-[#0F0F0F]/20 text-[#0F0F0F]/60'
                                  }`}
                                >
                                  {isLowStock ? <><AlertCircle className="w-3 h-3 inline mr-1" />Few left</> : `${remaining} left`}
                                </Badge>
                              );
                            })()}
                          </div>
                          {!isSoldOut && (
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-[#0F0F0F]/60">Quantity</span>
                              <div className="flex items-center gap-3">
                                <Button 
                                  size="icon" 
                                  variant="outline" 
                                  onClick={() => updateTicketQuantity(tier.id, -1)} 
                                  disabled={!selectedTickets[tier.id]} 
                                  className="w-8 h-8 rounded-lg"
                                >
                                  <Minus className="w-4 h-4" />
                                </Button>
                                <span className="w-8 text-center font-medium text-[#0F0F0F]">
                                  {selectedTickets[tier.id] || 0}
                                </span>
                                <Button 
                                  size="icon" 
                                  variant="outline" 
                                  onClick={() => updateTicketQuantity(tier.id, 1)} 
                                  disabled={
                                    (selectedTickets[tier.id] || 0) >= remaining || 
                                    (selectedTickets[tier.id] || 0) >= 10
                                  } 
                                  className="w-8 h-8 rounded-lg"
                                >
                                  <Plus className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Paid event totals */}
              {!isFreeEvent && totalTickets > 0 && (
                <>
                  <Separator />
                  
                  <div className="space-y-3">
                    <div className="flex justify-between text-[#0F0F0F]/60">
                      <span>Tickets ({totalTickets})</span>
                      <span>{formatPrice(totalAmount, event?.currency)}</span>
                    </div>
                    <div className="flex justify-between text-[#0F0F0F]/60">
                      <span>Service Fee</span>
                      <span>{formatPrice(serviceFee, event?.currency)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-bold text-lg text-[#0F0F0F]">
                      <span>Total</span>
                      <span>{formatPrice(totalWithFees, event?.currency)}</span>
                    </div>
                  </div>
                </>
              )}

              {/* Action Button */}
              {isAllSoldOut && !isFreeEvent ? (
                <Button 
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-xl py-6 text-lg"
                  onClick={() => setWaitlistOpen(true)}
                >
                  <Clock className="w-5 h-5 mr-2" />
                  {isOnWaitlist ? `On Waitlist (#${waitlistPosition})` : 'Join Waitlist'}
                </Button>
              ) : isFreeEvent ? (
                <Button 
                  className="w-full bg-green-600 hover:bg-green-700 text-white rounded-xl py-6 text-lg"
                  onClick={handleCheckout}
                >
                  <CheckCircle className="w-5 h-5 mr-2" />
                  RSVP - Free
                </Button>
              ) : (
                <Button 
                  className="w-full bg-[#2969FF] hover:bg-[#1a4fd8] text-white rounded-xl py-6 text-lg"
                  onClick={handleCheckout}
                  disabled={totalTickets === 0}
                >
                  {totalTickets > 0 ? (
                    <>
                      Proceed to Checkout - {formatPrice(totalWithFees, event?.currency)}
                    </>
                  ) : (
                    'Select Tickets'
                  )}
                </Button>
              )}
              
              {/* Buy with Friends Button */}
              <Button 
                variant="outline"
                className="w-full rounded-xl py-5 border-[#2969FF]/30 text-[#2969FF] hover:bg-[#2969FF]/5"
                onClick={() => setShowGroupModal(true)}
              >
                <UsersRound className="w-5 h-5 mr-2" />
                Buy with Friends
              </Button>

              <p className="text-xs text-center text-[#0F0F0F]/40">
                By {isFreeEvent ? 'registering' : 'purchasing'}, you agree to our Terms of Service
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Group Buy Modal */}
      <StartGroupModal 
        open={showGroupModal} 
        onOpenChange={setShowGroupModal} 
        event={event}
      />

      {/* Recommended Events */}
      {recommendedEvents.length > 0 && (
        <div className="max-w-6xl mx-auto px-4 py-12">
          <h2 className="text-2xl font-bold text-[#0F0F0F] mb-6">You Might Also Like</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            {recommendedEvents.map(recEvent => (
              <Card 
                key={recEvent.id} 
                className="border-0 rounded-2xl shadow-md hover:shadow-xl transition-all cursor-pointer overflow-hidden group"
                onClick={() => navigate(`/events/${recEvent.slug || recEvent.id}`)}
              >
                <div className="aspect-[4/3] relative overflow-hidden">
                  <img 
                    src={recEvent.image_url || '/placeholder-event.jpg'} 
                    alt={recEvent.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => { e.target.src = '/placeholder-event.jpg' }}
                  />
                  {recEvent.is_free && (
                    <Badge className="absolute top-3 left-3 bg-green-500 text-white border-0">
                      Free
                    </Badge>
                  )}
                  {recEvent.category === event?.category && (
                    <Badge className="absolute top-3 right-3 bg-[#2969FF]/90 text-white border-0 text-xs">
                      Similar
                    </Badge>
                  )}
                </div>
                <CardContent className="p-4">
                  <h3 className="font-semibold text-[#0F0F0F] line-clamp-2 mb-2 group-hover:text-[#2969FF] transition-colors">
                    {recEvent.title}
                  </h3>
                  <div className="space-y-1 text-sm text-[#0F0F0F]/60">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 flex-shrink-0" />
                      <span>{new Date(recEvent.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{recEvent.city || recEvent.venue_name || 'TBA'}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

{/* Waitlist Dialog */}
      <WaitlistDialog 
        open={waitlistOpen} 
        onOpenChange={setWaitlistOpen} 
        event={(() => {
          // For recurring events, use the selected child event if a date is selected
          // This ensures waitlist is per child event date, not parent event
          if (event?.is_recurring && selectedDate && selectedDate !== event.id) {
            const childEvent = childEvents.find(e => e.id === selectedDate);
            if (childEvent) {
              // Return child event with parent event's data merged (for organizer, currency, etc.)
              return { ...event, ...childEvent, id: childEvent.id };
            }
          }
          return event;
        })()}
      />
    </div>
  )
}
