import { getFeesByCurrency, DEFAULT_FEES } from '@/config/fees'
import DOMPurify from 'dompurify'
import { formatPrice } from '@/config/currencies'
import { useState, useEffect } from 'react'
import { useNavigate, useParams, useLocation, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { WaitlistDialog } from '@/components/WaitlistDialog'
import { getWaitlistPosition } from '@/services/waitlist'
import { Calendar, MapPin, Users, Clock, Share2, Heart, Minus, Plus, ArrowLeft, Loader2, CheckCircle, DoorOpen, Car, Camera, Video, UtensilsCrossed, Wine, Accessibility, AlertCircle, ExternalLink, Play, Monitor, Mail, UserPlus, UserCheck } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { getEvent } from '@/services/events'
import { supabase } from '@/lib/supabase'
import { EventAccessGate } from '@/components/EventAccessGate'

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
  const [feeRate, setFeeRate] = useState(DEFAULT_FEES.serviceFee)
  const [accessGranted, setAccessGranted] = useState(false)
  const [recommendedEvents, setRecommendedEvents] = useState([])
  const [isFollowing, setIsFollowing] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)

  useEffect(() => {
    async function loadEvent() {
      setLoading(true)
      setError(null)
      try {
        // Fetch event details
        const eventData = await getEvent(id)
        setEvent(eventData)
        
        // Fetch ticket types for this event
        const { data: tickets, error: ticketsError } = await supabase
          .from('ticket_types')
          .select('*')
          .eq('event_id', eventData.id)
          .eq('is_active', true)
          .order('price', { ascending: true })
        
        if (ticketsError) throw ticketsError
        
        // Set ticket types (empty array if none found - free events won't have tickets)
        setTicketTypes(tickets || [])
      } catch (err) {
        console.error('Error loading event:', err)
        setError('Event not found')
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
      if (!user || !event) return
      
      try {
        const { data, error } = await supabase
          .from('saved_events')
          .select('id')
          .eq('user_id', user.id)
          .eq('event_id', event.id)
          .single()
        
        if (data && !error) {
          setIsFavorite(true)
        }
      } catch (err) {
        // Not saved - that's fine
      }
    }
    
    checkIfSaved()
  }, [user, event])

  // Check if user is following the organizer
  useEffect(() => {
    async function checkIfFollowing() {
      if (!user || !event?.organizer?.id) return
      
      try {
        const { data } = await supabase
          .from('followers')
          .select('id')
          .eq('user_id', user.id)
          .eq('organizer_id', event.organizer.id)
          .single()
        
        setIsFollowing(!!data)
      } catch (err) {
        // Not following - that's fine
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
        const fees = await getFeesByCurrency(event.currency);
        setFeeRate(fees.serviceFee);
      }
    }
    loadFees();
  }, [event?.currency]);

  // Load child events for recurring events
  useEffect(() => {
    async function loadChildEvents() {
      if (event?.is_recurring) {
        const { data: children } = await supabase
          .from('events')
          .select('id, title, start_date, end_date, slug')
          .eq('parent_event_id', event.id)
          .order('start_date', { ascending: true });
        setChildEvents(children || []);
      }
    }
    loadChildEvents();
  }, [event?.is_recurring, event?.id]);

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

  // Handle checkout/RSVP routing
  const handleCheckout = () => {
    // Free event - go directly to free RSVP page (handles auth there)
    if (isFreeEvent) {
      navigate('/free-rsvp', { 
        state: { event } 
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
          event,
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
      alert('Link copied to clipboard!')
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
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
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
              <h1 className="text-3xl md:text-4xl font-bold text-[#0F0F0F] mb-4">{event.title}</h1>
              <div className="flex flex-wrap gap-4 text-[#0F0F0F]/60">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  <span>{formatDate(event.start_date)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  <span>{formatTime(event.start_date)} - {formatTime(event.end_date)}</span>
                </div>
                <div className="flex items-center gap-2">
                  {event.is_virtual ? (
                    <>
                      <Monitor className="w-5 h-5 text-purple-600" />
                      <span className="text-purple-600 font-medium">Virtual Event (Online)</span>
                    </>
                  ) : (
                    <>
                      <MapPin className="w-5 h-5" />
                      <span>{[event.venue_name, event.venue_address, event.city].filter(Boolean).join(', ') || 'Location TBA'}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="icon" 
                onClick={toggleFavorite}
                disabled={savingFavorite}
                className={`rounded-xl ${isFavorite ? 'text-red-500 border-red-500 bg-red-50' : ''}`}
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
                className="rounded-xl"
                onClick={handleShare}
              >
                <Share2 className="w-5 h-5" />
              </Button>
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
          {event.is_recurring && childEvents.length > 0 && (
            <>
              <Separator />
              <div>
                <h2 className="text-2xl font-bold text-[#0F0F0F] mb-4">🔄 Upcoming Dates</h2>
                <p className="text-[#0F0F0F]/60 mb-4">This is a recurring event. Choose a date below:</p>
                <div className="grid gap-3">
                  {/* Current/Parent Event */}
                  <div 
                    className="p-4 bg-[#2969FF]/5 border-2 border-[#2969FF] rounded-xl cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-[#0F0F0F]">
                          {new Date(event.start_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                        </p>
                        <p className="text-sm text-[#0F0F0F]/60">
                          {new Date(event.start_date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - {new Date(event.end_date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        </p>
                      </div>
                      <Badge className="bg-[#2969FF] text-white">Current</Badge>
                    </div>
                  </div>
                  
                  {/* Child Events */}
                  {childEvents.map((child) => (
                    <div 
                      key={child.id}
                      onClick={() => navigate(`/event/${child.slug || child.id}`)}
                      className="p-4 bg-[#F4F6FA] hover:bg-[#2969FF]/10 border border-[#0F0F0F]/10 rounded-xl cursor-pointer transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-[#0F0F0F]">
                            {new Date(child.start_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                          </p>
                          <p className="text-sm text-[#0F0F0F]/60">
                            {new Date(child.start_date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - {new Date(child.end_date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                          </p>
                        </div>
                        <Badge variant="outline" className="border-[#0F0F0F]/20">View</Badge>
                      </div>
                    </div>
                  ))}
                </div>
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
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    {event.venue_name && <h3 className="font-semibold text-[#0F0F0F]">{event.venue_name}</h3>}
                    <p className="text-sm text-[#0F0F0F]/60">{[event.venue_address, event.city].filter(Boolean).join(', ') || 'Address TBA'}</p>
                  </div>
                  <a 
                    href={event.google_map_link || `https://maps.google.com/maps?q=${encodeURIComponent((event.venue_address || '') + ', ' + (event.city || ''))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[#2969FF] hover:underline text-sm flex-shrink-0"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Directions
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
                      <span>{formatPrice(Math.round(totalAmount * feeRate), event?.currency)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-bold text-lg text-[#0F0F0F]">
                      <span>Total</span>
                      <span>{formatPrice(Math.round(totalAmount * (1 + feeRate)), event?.currency)}</span>
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
                  {totalTickets > 0 ? 'Proceed to Checkout' : 'Select Tickets'}
                </Button>
              )}

              <p className="text-xs text-center text-[#0F0F0F]/40">
                By {isFreeEvent ? 'registering' : 'purchasing'}, you agree to our Terms of Service
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      

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
        event={event}
      />
    </div>
  )
}
