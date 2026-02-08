import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, Loader2, Calendar, MapPin, CheckCircle, Clock, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PhoneInput } from '@/components/ui/phone-input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { formatPrice, getDefaultCurrency } from '@/config/currencies'
import { generateTicketPDFBase64, generateMultiTicketPDFBase64 } from '@/utils/ticketGenerator'
import { logger, handleApiError, getUserMessage, ERROR_CODES } from '@/lib/logger'
import { getRSVPSettings, checkRSVPLimit } from '@/services/settings'
import { getPaymentProvider } from '@/config/payments'
import { getDonationFeePercent } from '@/config/fees'

// Send confirmation email via Edge Function
const sendConfirmationEmail = async (emailData) => {
  try {
    // Get the current session to use the user's auth token if available
    let { data: { session } } = await supabase.auth.getSession()

    // If no session or token expired, try to refresh
    if (!session?.access_token) {
      const { data: refreshData } = await supabase.auth.refreshSession()
      session = refreshData?.session
    }

    // Use session token if available. Anon key fallback is acceptable here because
    // send-email is a public endpoint for order confirmations. Even authenticated RSVPs
    // may hit edge cases where session refresh fails but the email should still be sent.
    const authToken = session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken}`
      },
      body: JSON.stringify(emailData)
    })
    const result = await response.json()
    if (!result.success) console.error("Email send failed:", result.error)
    return result
  } catch (err) {
    console.error("Email send error:", err)
    return { success: false, error: err.message }
  }
}

// Credit promoter for referral - non-blocking, errors won't affect RSVP
const creditPromoter = async (orderId, eventId, saleAmount, ticketCount) => {
  try {
    const refCode = localStorage.getItem('referral_code')
    if (!refCode || !/^[A-Za-z0-9-]+$/.test(refCode)) return
    
    const { data: promoter, error: promoterError } = await supabase
      .from('promoters')
      .select('id, commission_type, commission_value, commission_rate')
      .or(`short_code.eq.${refCode},referral_code.eq.${refCode}`)
      .single()
    
    if (promoterError || !promoter) {
      // Silently ignore - promoter may not exist
      localStorage.removeItem('referral_code')
      localStorage.removeItem('referral_event_id')
      return
    }
    
    const commissionRate = promoter.commission_value || promoter.commission_rate || 10
    const commissionType = promoter.commission_type || 'percentage'
    let commissionAmount = 0
    
    if (commissionType === 'percentage') {
      commissionAmount = (saleAmount * commissionRate) / 100
    } else {
      commissionAmount = commissionRate * ticketCount
    }
    
    // Insert promoter sale - ignore errors
    await supabase.from('promoter_sales').insert({
      promoter_id: promoter.id,
      event_id: eventId,
      order_id: orderId,
      ticket_count: ticketCount,
      sale_amount: saleAmount,
      commission_rate: commissionRate,
      commission_amount: commissionAmount,
      status: 'pending'
    }).catch(e => console.warn('Promoter sale insert skipped:', e.message))
    
    // Update promoter stats - ignore errors (RPC may not exist)
    await supabase.rpc('update_promoter_sales', { 
      p_promoter_id: promoter.id,
      p_sale_amount: saleAmount,
      p_commission: commissionAmount,
      p_ticket_count: ticketCount
    }).catch(e => console.warn('Promoter stats update skipped:', e.message))
    
    localStorage.removeItem('referral_code')
    localStorage.removeItem('referral_event_id')
  } catch (err) {
    // Silently ignore - don't let promoter credit fail the RSVP
    console.warn('Promoter credit skipped:', err.message)
    localStorage.removeItem('referral_code')
    localStorage.removeItem('referral_event_id')
  }
}

export function WebFreeRSVP() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  
  // Support both event and selectedEventId from navigation state
  const { event: passedEvent, selectedEventId } = location.state || {}
  const event = passedEvent
  
  // Form state
  const [formData, setFormData] = useState({
    email: '',
    phone: '',
    firstName: '',
    lastName: ''
  })

  // Function to ensure child event exists for recurring events
  // Creates child event on-demand when user RSVPs for a future date
  const ensureChildEventExists = async () => {
    // Check if this is a virtual event (future date without child event in DB)
    const isVirtual = event?.is_virtual || 
                      (typeof selectedEventId === 'string' && selectedEventId?.startsWith('virtual-'))
    
    if (!isVirtual) {
      // Not a virtual event - use selectedEventId if it's a real UUID, otherwise event.id
      if (selectedEventId && !selectedEventId.startsWith('virtual-')) {
        return selectedEventId
      }
      return event?.id
    }
    
    // This is a virtual event - need to create or find child event
    const parentEventId = event?.parent_event_id || event?.id
    const childEventStartDate = event?.start_date
    const childEventEndDate = event?.end_date
    
    if (!parentEventId || !childEventStartDate || !childEventEndDate) {
      console.warn('Missing data for child event creation, using parent event')
      return parentEventId || event?.id
    }
    
    // Check if child event already exists for this date
    const dateStr = childEventStartDate.split('T')[0] // YYYY-MM-DD
    const dateStart = `${dateStr}T00:00:00`
    const dateEnd = `${dateStr}T23:59:59`
    
    const { data: existingChildren } = await supabase
      .from('events')
      .select('id, start_date, end_date')
      .eq('parent_event_id', parentEventId)
      .gte('start_date', dateStart)
      .lte('start_date', dateEnd)
    
    if (existingChildren && existingChildren.length > 0) {
      console.log('Found existing child event:', existingChildren[0].id)
      return existingChildren[0].id
    }
    
    // Get parent event details to create child
    const { data: parentEvent, error: parentError } = await supabase
      .from('events')
      .select('*')
      .eq('id', parentEventId)
      .single()
    
    if (parentError || !parentEvent) {
      console.error('Parent event not found:', parentEventId)
      return parentEventId
    }
    
    // Generate slug for child event
    const childSlug = `${parentEvent.slug}-${dateStr}`.replace(/--+/g, '-').substring(0, 100)
    
    // Create child event
    console.log('Creating child event for date:', dateStr)
    const { data: newChildEvent, error: createError } = await supabase
      .from('events')
      .insert({
        organizer_id: parentEvent.organizer_id,
        parent_event_id: parentEventId,
        title: parentEvent.title,
        slug: childSlug,
        description: parentEvent.description,
        event_type: parentEvent.event_type,
        category: parentEvent.category,
        start_date: childEventStartDate,
        end_date: childEventEndDate,
        venue_name: parentEvent.venue_name,
        venue_address: parentEvent.venue_address,
        city: parentEvent.city,
        country_code: parentEvent.country_code,
        currency: parentEvent.currency,
        status: 'published',
        is_recurring: false, // Child events are not recurring themselves
        is_free: parentEvent.is_free,
        timezone: parentEvent.timezone,
        image_url: parentEvent.image_url,
        cover_image_url: parentEvent.cover_image_url,
        is_virtual: parentEvent.is_virtual,
        streaming_url: parentEvent.streaming_url,
        streaming_platform: parentEvent.streaming_platform,
        total_capacity: parentEvent.total_capacity,
        max_tickets_per_order: parentEvent.max_tickets_per_order,
        accepts_donations: parentEvent.accepts_donations,
        donation_amounts: parentEvent.donation_amounts,
        allow_custom_donation: parentEvent.allow_custom_donation,
      })
      .select()
      .single()
    
    if (createError || !newChildEvent) {
      console.error('Error creating child event:', createError)
      // Fall back to parent event
      return parentEventId
    }
    
    console.log('Created child event:', newChildEvent.id)
    
    // If parent has ticket types, copy them to child event
    const { data: parentTicketTypes } = await supabase
      .from('ticket_types')
      .select('*')
      .eq('event_id', parentEventId)
      .eq('is_active', true)
    
    if (parentTicketTypes && parentTicketTypes.length > 0) {
      const childTicketTypes = parentTicketTypes.map(tt => ({
        event_id: newChildEvent.id,
        name: tt.name,
        description: tt.description,
        price: tt.price,
        quantity_available: tt.quantity_available,
        quantity_sold: 0,
        max_per_order: tt.max_per_order,
        min_per_order: tt.min_per_order,
        sales_start: tt.sales_start,
        sales_end: tt.sales_end,
        is_active: true,
        sort_order: tt.sort_order,
      }))
      
      await supabase.from('ticket_types').insert(childTicketTypes)
      console.log('Created', childTicketTypes.length, 'ticket types for child event')
    }
    
    return newChildEvent.id
  }
  
  // RSVP state
  const [quantity, setQuantity] = useState(1)
  const [maxQuantity, setMaxQuantity] = useState(10)
  const [rsvpLimit, setRsvpLimit] = useState(null)
  
  // Donation state
  const [donationAmount, setDonationAmount] = useState(0)
  const [customDonation, setCustomDonation] = useState('')
  const [donationFee, setDonationFee] = useState(0)
  const [donationFeePercent, setDonationFeePercent] = useState(0.05) // Default 5%
  
  // UI state
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  
  // Settings from DB
  const [settings, setSettings] = useState({
    maxTicketsPerOrder: 10,
    requirePhone: false,
    freeEventOrderStatus: 'completed',
    donationFailedStillRsvp: true
  })

  // Donation options from event
  const acceptsDonations = event?.accepts_donations && event?.donation_amounts?.length > 0
  const donationOptions = event?.donation_amounts || []
  const allowCustomDonation = event?.allow_custom_donation !== false
  const actualDonation = customDonation ? parseInt(customDonation) || 0 : donationAmount
  
  // Donation fee handling - check if donor pays the fee or organizer absorbs it
  const donorPaysFee = event?.donation_fee_handling === 'pass_to_attendee'
  const donationTotal = donorPaysFee ? actualDonation + donationFee : actualDonation

  // Redirect if no event or not logged in
  useEffect(() => {
    if (!event) {
      navigate('/events')
      return
    }
    if (!user) {
      navigate('/login', { state: { from: location.pathname, event } })
      return
    }
  }, [event, user, navigate, location.pathname])

  // Load donation fee percentage and calculate fee when donation changes
  useEffect(() => {
    async function loadDonationFee() {
      if (!event?.currency || actualDonation <= 0) {
        setDonationFee(0)
        return
      }
      
      try {
        const feePercent = await getDonationFeePercent(event.currency)
        setDonationFeePercent(feePercent)
        const calculatedFee = Math.round(actualDonation * feePercent * 100) / 100
        setDonationFee(calculatedFee)
      } catch (err) {
        console.warn('Error loading donation fee:', err)
        // Default to 5%
        setDonationFee(Math.round(actualDonation * 0.05 * 100) / 100)
      }
    }
    loadDonationFee()
  }, [event?.currency, actualDonation])

  // Load user profile
  useEffect(() => {
    async function loadProfile() {
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
        
        if (profile) {
          setFormData(prev => ({
            ...prev,
            email: profile.email || user.email || '',
            phone: profile.phone || '',
            firstName: profile.first_name || '',
            lastName: profile.last_name || ''
          }))
        } else {
          setFormData(prev => ({
            ...prev,
            email: user.email || ''
          }))
        }
      }
    }
    loadProfile()
  }, [user])

  // Load platform settings and check RSVP limit
  useEffect(() => {
    async function loadSettings() {
      if (!event?.id || !user?.email) {
        setSettingsLoaded(true)
        return
      }
      
      try {
        // Get platform settings (will return defaults if DB fails)
        const rsvpSettings = await getRSVPSettings()
        setSettings(rsvpSettings)
        
        // For initial load, use parent event ID for RSVP limit check
        // The actual child event will be created during RSVP submission
        const checkEventId = event?.parent_event_id || event?.id
        
        // Check existing RSVPs for this user/event (will allow if check fails)
        const limitCheck = await checkRSVPLimit(checkEventId, user.email)
        setRsvpLimit(limitCheck)
        
        // Set max quantity based on limits
        const maxFromSettings = Math.min(rsvpSettings.maxTicketsPerOrder || 10, limitCheck.remaining || 10)
        setMaxQuantity(Math.max(1, maxFromSettings))
        
        // If already at limit, show error
        if (!limitCheck.allowed && limitCheck.current > 0) {
          setError(`You've already registered ${limitCheck.current} time(s) for this event (max ${limitCheck.max}).`)
        }
      } catch (err) {
        console.warn('Error loading RSVP settings:', err.message)
        // Use defaults on failure - don't block the user
        setMaxQuantity(10)
      } finally {
        setSettingsLoaded(true)
      }
    }
    loadSettings()
  }, [event?.id, event?.parent_event_id, user?.email])

  // Generate unique 8-character ticket code (TR + 6 chars)
  const generateTicketCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Removed similar looking chars (0,O,1,I)
    let code = 'TR'
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
  }

  // Handle free RSVP (no donation)
  const handleFreeRSVP = async () => {
    // Prevent double submission
    if (loading) return
    
    if (!validateForm()) return
    
    if (!event?.id) {
      setError('Event information is missing. Please go back and try again.')
      return
    }
    
    if (!user?.id) {
      setError('Please log in to register for this event.')
      navigate('/login', { state: { from: location.pathname, event } })
      return
    }
    
    setLoading(true)
    setError(null)

    try {
      // Verify session is still valid
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session) {
        setError('Your session has expired. Please log in again.')
        setLoading(false)
        navigate('/login', { state: { from: location.pathname, event } })
        return
      }
      
      // For recurring events, ensure child event exists (creates on-demand if needed)
      // This handles virtual IDs like "virtual-2026-04-04"
      console.log('Ensuring child event exists for:', selectedEventId || event?.id)
      const eventId = await ensureChildEventExists()
      console.log('Final eventId to use:', eventId)
      
      if (!eventId) {
        setError('Event not found. Please go back and try again.')
        setLoading(false)
        return
      }
      
      // Verify event exists in database (should always exist now after ensureChildEventExists)
      const { data: eventCheck, error: eventCheckError } = await supabase
        .from('events')
        .select('id, currency, country_code')
        .eq('id', eventId)
        .single()
      
      if (eventCheckError || !eventCheck) {
        console.error('Event not found after creation:', eventId, eventCheckError)
        setError('Failed to prepare event. Please try again.')
        setLoading(false)
        return
      }
      
      // Double-check RSVP limit (will allow if check fails)
      const limitCheck = await checkRSVPLimit(eventId, formData.email)
      if (!limitCheck.allowed && limitCheck.current > 0) {
        setError(`You've reached the maximum RSVPs for this event (${limitCheck.max}).`)
        setLoading(false)
        return
      }
      
      if (limitCheck.remaining > 0 && quantity > limitCheck.remaining) {
        setError(`You can only register ${limitCheck.remaining} more time(s) for this event.`)
        setLoading(false)
        return
      }
      
      // Create order - use verified event data for currency
      const orderData = {
        user_id: user.id,
        event_id: eventId,
        order_number: `RSVP${Date.now().toString(36).toUpperCase()}`,
        status: settings.freeEventOrderStatus || 'completed',
        subtotal: 0,
        platform_fee: 0,
        tax_amount: 0,
        discount_amount: 0,
        total_amount: 0,
        currency: eventCheck?.currency || event?.currency || getDefaultCurrency(eventCheck?.country_code || event?.country_code || event?.country) || 'NGN',
        payment_method: 'free',
        payment_provider: 'none',
        buyer_email: formData.email,
        buyer_phone: formData.phone || null,
        buyer_name: `${formData.firstName} ${formData.lastName}`.trim(),
        paid_at: new Date().toISOString()
      }

      console.log('Creating order with data:', { eventId, userId: user.id, email: formData.email })
      
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert(orderData)
        .select()
        .single()

      if (orderError) {
        console.error('Order creation failed:', {
          code: orderError.code,
          message: orderError.message,
          details: orderError.details,
          hint: orderError.hint
        })
        throw orderError
      }

      // Create tickets (one per quantity)
      const ticketsToCreate = []
      for (let i = 0; i < quantity; i++) {
        ticketsToCreate.push({
          event_id: eventId, // Use same eventId as order
          user_id: user.id,
          order_id: order.id, // Link to order
          ticket_type_id: null, // Free admission
          attendee_email: formData.email,
          attendee_name: `${formData.firstName} ${formData.lastName}`,
          attendee_phone: formData.phone || null,
          ticket_code: generateTicketCode(),
          qr_code: generateTicketCode(),
          unit_price: 0,
          total_price: 0,
          payment_reference: 'FREE',
          payment_status: 'completed',
          payment_method: 'free',
          status: 'active'
        })
      }

      const { data: tickets, error: ticketsError } = await supabase
        .from('tickets')
        .insert(ticketsToCreate)
        .select()

      if (ticketsError) {
        console.error('Ticket creation failed:', ticketsError)
        throw ticketsError
      }

      // Credit promoter (even for free, track conversion)
      await creditPromoter(order.id, eventId, 0, quantity)

      // Generate PDF and send confirmation email
      try {
        // Generate PDF for ALL tickets (multi-page PDF)
        const ticketsForPdf = tickets.map(t => ({
          ticket_code: t.ticket_code,
          attendee_name: `${formData.firstName} ${formData.lastName}`,
          attendee_email: formData.email,
          ticket_type_name: 'Free Admission'
        }))
        const pdfData = await generateMultiTicketPDFBase64(ticketsForPdf, event)
        
        sendConfirmationEmail({
          type: "ticket_purchase",
          to: formData.email,
          data: {
            attendeeName: `${formData.firstName} ${formData.lastName}`,
            eventTitle: event.title,
            eventDate: event.start_date,
            venueName: [event.venue_name, event.venue_address, event.city].filter(Boolean).join(', ') || "TBA",
            city: event.city || "",
            ticketType: "Free Admission",
            quantity: quantity,
            orderNumber: order.order_number,
            totalAmount: 0,
            isFree: true,
            appUrl: window.location.origin
          },
          attachments: [{
            filename: pdfData.filename,
            content: pdfData.base64,
            type: 'application/pdf'
          }]
        })
      } catch (pdfErr) {
        console.error('PDF generation failed:', pdfErr)
        sendConfirmationEmail({
          type: "ticket_purchase",
          to: formData.email,
          data: {
            attendeeName: `${formData.firstName} ${formData.lastName}`,
            eventTitle: event.title,
            eventDate: event.start_date,
            venueName: [event.venue_name, event.venue_address, event.city].filter(Boolean).join(', ') || "TBA",
            city: event.city || "",
            ticketType: "Free Admission",
            quantity: quantity,
            orderNumber: order.order_number,
            totalAmount: 0,
            isFree: true,
            appUrl: window.location.origin
          }
        })
      }

      // Send notification to organizer for new RSVP
      try {
        // Fetch organizer email
        const { data: eventWithOrganizer } = await supabase
          .from('events')
          .select('organizers(email, business_name, profiles(email))')
          .eq('id', eventId)
          .single()
        
        const organizerEmail = eventWithOrganizer?.organizers?.email || 
                               eventWithOrganizer?.organizers?.profiles?.email
        
        // Only send if organizer notifications are enabled
        if (organizerEmail && event.notify_organizer_on_sale !== false) {
          sendConfirmationEmail({
            type: "new_ticket_sale",
            to: organizerEmail,
            data: {
              eventTitle: event.title,
              eventId: eventId,
              ticketType: "Free RSVP",
              quantity: quantity,
              buyerName: `${formData.firstName} ${formData.lastName}`,
              buyerEmail: formData.email,
              buyerPhone: formData.phone || null,
              amount: 0,
              isFree: true,
              currency: event.currency || 'NGN',
              totalSold: (event.tickets_sold || 0) + quantity,
              totalCapacity: event.capacity || 0,
              appUrl: window.location.origin
            }
          })
        }
      } catch (orgEmailErr) {
        console.warn('Organizer notification failed:', orgEmailErr?.message)
      }

      // Navigate to success
      navigate('/payment-success', {
        state: { order, event, tickets, reference: 'FREE' }
      })

    } catch (err) {
      logger.error('RSVP error', err)
      
      // Provide more specific error messages based on error type
      let errorMessage = 'An error occurred. Please try again.'
      
      if (err?.code === '23505') {
        errorMessage = 'You have already registered for this event.'
      } else if (err?.code === '42501' || err?.code === '42P01' || err?.message?.includes('permission') || err?.message?.includes('policy')) {
        errorMessage = 'Unable to process registration. Please try logging in again.'
      } else if (err?.message?.includes('network') || err?.message?.includes('fetch') || err?.message?.includes('Failed to fetch')) {
        errorMessage = 'Network error. Please check your connection and try again.'
      } else if (err?.code?.startsWith('PGRST') || err?.code === '400') {
        errorMessage = 'Server error. Please try again in a moment.'
      } else if (err?.code === '23503') {
        errorMessage = 'Event not found. Please go back and try again.'
      } else if (err?.message) {
        // Log the actual error for debugging but show generic message
        console.error('RSVP error details:', err.message)
      }
      
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  // Handle RSVP with donation
  const handleDonationRSVP = async () => {
    if (!validateForm()) return
    if (actualDonation <= 0) {
      handleFreeRSVP()
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Double-check RSVP limit
      const limitCheck = await checkRSVPLimit(event.id, formData.email)
      if (!limitCheck.allowed) {
        setError(`You've reached the maximum RSVPs for this event (${limitCheck.max}).`)
        setLoading(false)
        return
      }

      // Determine payment provider based on currency
      const currency = event?.currency || getDefaultCurrency(event?.country_code || event?.country)
      const paymentProvider = getPaymentProvider(currency)

      // Calculate the platform fee (from pre-calculated state)
      const calculatedPlatformFee = donationFee
      
      // Check if organizer absorbs fee or donor pays
      const organizerAbsorbsFee = event?.donation_fee_handling !== 'pass_to_attendee'
      
      // Total amount to charge:
      // - If donor pays: donation + fee
      // - If organizer absorbs: just the donation (fee deducted from their payout)
      const chargeAmount = organizerAbsorbsFee ? actualDonation : donationTotal

      // Create pending order with donation
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: user.id,
          event_id: event.id,
          order_number: `DON${Date.now().toString(36).toUpperCase()}`,
          status: 'pending',
          subtotal: actualDonation, // The donation amount before any fee
          platform_fee: calculatedPlatformFee, // Always store the fee for payout calculation
          platform_fee_absorbed: organizerAbsorbsFee, // Track if organizer absorbs the fee
          tax_amount: 0,
          discount_amount: 0,
          total_amount: chargeAmount, // What the donor actually pays
          currency: currency,
          payment_method: 'card',
          payment_provider: paymentProvider,
          buyer_email: formData.email,
          buyer_phone: formData.phone || null,
          buyer_name: `${formData.firstName} ${formData.lastName}`,
          is_donation: true,
          payout_status: 'pending'
        })
        .select()
        .single()

      if (orderError) throw orderError

      // Create order_items for webhook/edge function ticket creation
      // For free events with donations, we need order_items so complete-stripe-order can create tickets
      const { data: freeTicketType } = await supabase
        .from('ticket_types')
        .select('id')
        .eq('event_id', event.id)
        .eq('is_active', true)
        .order('price', { ascending: true })
        .limit(1)
        .single()

      await supabase.from('order_items').insert({
        order_id: order.id,
        ticket_type_id: freeTicketType?.id || null,
        quantity: quantity,
        unit_price: 0,
        subtotal: 0
      })

      const paymentRef = `DON-${order.id.slice(0, 8).toUpperCase()}-${Date.now()}`

      // Use appropriate payment provider based on currency
      if (paymentProvider === 'stripe') {
        // Use Stripe Checkout for GBP, USD, CAD donations
        try {
          const { data: checkoutData, error: stripeError } = await supabase.functions.invoke('create-stripe-checkout', {
            body: {
              orderId: order.id,
              successUrl: `${window.location.origin}/payment-success`,
              cancelUrl: `${window.location.origin}/event/${event.slug}`,
              isDonation: true,
              donationAmount: chargeAmount // Charge the correct total
            }
          })

          if (stripeError) throw stripeError

          if (checkoutData?.url) {
            window.location.href = checkoutData.url
          } else {
            throw new Error('Failed to create Stripe checkout session')
          }
        } catch (stripeErr) {
          console.error('Stripe checkout error:', stripeErr)
          // Fallback to free RSVP if Stripe fails
          if (settings.donationFailedStillRsvp) {
            handleFreeRSVPFallback(order)
          } else {
            setError('Payment system error. Please try again.')
            setLoading(false)
          }
        }
      } else {
        // Use Paystack for NGN, GHS donations
        if (window.PaystackPop) {
          const handler = window.PaystackPop.setup({
            key: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY,
            email: formData.email,
            amount: chargeAmount * 100, // Charge the correct total
            currency: currency,
            ref: paymentRef,
            metadata: {
              order_id: order.id,
              event_id: event.id,
              event_name: event.title,
              type: 'donation',
              is_donation: true,
              fee_absorbed: organizerAbsorbsFee,
              custom_fields: [
                { display_name: "Donor Name", variable_name: "donor_name", value: `${formData.firstName} ${formData.lastName}` },
                { display_name: "Type", variable_name: "type", value: "Event Donation" }
              ]
            },
            callback: function(response) {
              finalizeDonationRSVP(order, response.reference)
            },
            onClose: function() {
              // If donation failed but setting allows, still complete RSVP
              if (settings.donationFailedStillRsvp) {
                handleFreeRSVPFallback(order)
              } else {
                // Cancel the order
                supabase.from('orders').update({ status: 'cancelled' }).eq('id', order.id)
                setError('Payment was cancelled. Please try again.')
                setLoading(false)
              }
            }
          })
          handler.openIframe()
        } else {
          setError('Payment system not loaded. Please refresh the page.')
          setLoading(false)
        }
      }

    } catch (err) {
      logger.error('Donation RSVP error', err)
      const safeError = handleApiError(err, 'Donation RSVP')
      setError(getUserMessage(safeError.code, 'An error occurred. Please try again.'))
      setLoading(false)
    }
  }

  // Finalize RSVP after successful donation payment
  const finalizeDonationRSVP = async (order, paymentRef) => {
    try {
      // Update order status
      await supabase.from('orders').update({
        status: 'completed',
        payment_reference: paymentRef,
        paid_at: new Date().toISOString()
      }).eq('id', order.id)

      // Create tickets
      const ticketsToCreate = []
      for (let i = 0; i < quantity; i++) {
        ticketsToCreate.push({
          event_id: event.id,
          user_id: user.id,
          ticket_type_id: null,
          attendee_email: formData.email,
          attendee_name: `${formData.firstName} ${formData.lastName}`,
          attendee_phone: formData.phone || null,
          ticket_code: generateTicketCode(),
          qr_code: generateTicketCode(),
          unit_price: 0,
          total_price: 0,
          payment_reference: paymentRef,
          payment_status: 'completed',
          payment_method: 'paystack',
          status: 'active'
        })
      }

      const { data: tickets } = await supabase
        .from('tickets')
        .insert(ticketsToCreate)
        .select()

      // Credit promoter
      const netDonation = actualDonation - (donationFee || 0)
      await creditPromoter(order.id, event.id, netDonation, quantity)

      // Generate PDF and send confirmation email
      try {
        // Generate PDF for ALL tickets (multi-page PDF)
        const ticketsForPdf = tickets.map(t => ({
          ticket_code: t.ticket_code,
          attendee_name: `${formData.firstName} ${formData.lastName}`,
          attendee_email: formData.email,
          ticket_type_name: 'Free Admission + Donation'
        }))
        const pdfData = await generateMultiTicketPDFBase64(ticketsForPdf, event)
        
        sendConfirmationEmail({
          type: "ticket_purchase",
          to: formData.email,
          data: {
            attendeeName: `${formData.firstName} ${formData.lastName}`,
            eventTitle: event.title,
            eventDate: event.start_date,
            venueName: [event.venue_name, event.venue_address, event.city].filter(Boolean).join(', ') || "TBA",
            city: event.city || "",
            ticketType: "Free Admission + Donation",
            quantity: quantity,
            orderNumber: order.order_number,
            totalAmount: actualDonation,
            isFree: false,
            appUrl: window.location.origin
          },
          attachments: [{
            filename: pdfData.filename,
            content: pdfData.base64,
            type: 'application/pdf'
          }]
        })
      } catch (pdfErr) {
        console.error('PDF generation failed:', pdfErr)
        sendConfirmationEmail({
          type: "ticket_purchase",
          to: formData.email,
          data: {
            attendeeName: `${formData.firstName} ${formData.lastName}`,
            eventTitle: event.title,
            eventDate: event.start_date,
            venueName: [event.venue_name, event.venue_address, event.city].filter(Boolean).join(', ') || "TBA",
            city: event.city || "",
            ticketType: "Free Admission + Donation",
            quantity: quantity,
            orderNumber: order.order_number,
            totalAmount: actualDonation,
            isFree: false,
            appUrl: window.location.origin
          }
        })
      }

      // Send notification to organizer for donation RSVP
      try {
        const { data: eventWithOrganizer } = await supabase
          .from('events')
          .select('organizers(email, profiles(email))')
          .eq('id', event.id)
          .single()
        
        const organizerEmail = eventWithOrganizer?.organizers?.email || 
                               eventWithOrganizer?.organizers?.profiles?.email
        
        // Only send if organizer notifications are enabled
        if (organizerEmail && event.notify_organizer_on_sale !== false) {
          sendConfirmationEmail({
            type: "new_ticket_sale",
            to: organizerEmail,
            data: {
              eventTitle: event.title,
              eventId: event.id,
              ticketType: "Free RSVP + Donation",
              quantity: quantity,
              buyerName: `${formData.firstName} ${formData.lastName}`,
              buyerEmail: formData.email,
              buyerPhone: formData.phone || null,
              amount: actualDonation,
              isFree: false,
              currency: event.currency || 'NGN',
              totalSold: (event.tickets_sold || 0) + quantity,
              totalCapacity: event.capacity || 0,
              appUrl: window.location.origin
            }
          })
        }
      } catch (orgEmailErr) {
        console.warn('Organizer notification failed:', orgEmailErr?.message)
      }

      navigate('/payment-success', {
        state: { order, event, tickets, reference: paymentRef }
      })

    } catch (err) {
      console.error('Finalize donation error:', err)
      setError('Payment received but there was an error. Please contact support.')
      setLoading(false)
    }
  }

  // Fallback: Complete RSVP without donation if payment cancelled
  const handleFreeRSVPFallback = async (existingOrder) => {
    try {
      // Update order to free
      await supabase.from('orders').update({
        status: settings.freeEventOrderStatus,
        total_amount: 0,
        payment_method: 'free',
        payment_provider: 'none',
        paid_at: new Date().toISOString()
      }).eq('id', existingOrder.id)

      // Create tickets
      const ticketsToCreate = []
      for (let i = 0; i < quantity; i++) {
        ticketsToCreate.push({
          event_id: event.id,
          user_id: user.id,
          ticket_type_id: null,
          attendee_email: formData.email,
          attendee_name: `${formData.firstName} ${formData.lastName}`,
          attendee_phone: formData.phone || null,
          ticket_code: generateTicketCode(),
          qr_code: generateTicketCode(),
          unit_price: 0,
          total_price: 0,
          payment_reference: 'FREE',
          payment_status: 'completed',
          payment_method: 'free',
          status: 'active'
        })
      }

      const { data: tickets } = await supabase
        .from('tickets')
        .insert(ticketsToCreate)
        .select()

      await creditPromoter(existingOrder.id, event.id, 0, quantity)

      // Generate PDF and send confirmation email
      try {
        // Generate PDF for ALL tickets (multi-page PDF)
        const ticketsForPdf = tickets.map(t => ({
          ticket_code: t.ticket_code,
          attendee_name: `${formData.firstName} ${formData.lastName}`,
          attendee_email: formData.email,
          ticket_type_name: 'Free Admission'
        }))
        const pdfData = await generateMultiTicketPDFBase64(ticketsForPdf, event)
        
        sendConfirmationEmail({
          type: "ticket_purchase",
          to: formData.email,
          data: {
            attendeeName: `${formData.firstName} ${formData.lastName}`,
            eventTitle: event.title,
            eventDate: event.start_date,
            venueName: [event.venue_name, event.venue_address, event.city].filter(Boolean).join(', ') || "TBA",
            city: event.city || "",
            ticketType: "Free Admission",
            quantity: quantity,
            orderNumber: existingOrder.order_number,
            totalAmount: 0,
            isFree: true,
            appUrl: window.location.origin
          },
          attachments: [{
            filename: pdfData.filename,
            content: pdfData.base64,
            type: 'application/pdf'
          }]
        })
      } catch (pdfErr) {
        console.error('PDF generation failed:', pdfErr)
        sendConfirmationEmail({
          type: "ticket_purchase",
          to: formData.email,
          data: {
            attendeeName: `${formData.firstName} ${formData.lastName}`,
            eventTitle: event.title,
            eventDate: event.start_date,
            venueName: [event.venue_name, event.venue_address, event.city].filter(Boolean).join(', ') || "TBA",
            city: event.city || "",
            ticketType: "Free Admission",
            quantity: quantity,
            orderNumber: existingOrder.order_number,
            totalAmount: 0,
            isFree: true,
            appUrl: window.location.origin
          }
        })
      }

      // Send notification to organizer for fallback RSVP
      try {
        const { data: eventWithOrganizer } = await supabase
          .from('events')
          .select('organizers(email, profiles(email))')
          .eq('id', event.id)
          .single()
        
        const organizerEmail = eventWithOrganizer?.organizers?.email || 
                               eventWithOrganizer?.organizers?.profiles?.email
        
        // Only send if organizer notifications are enabled
        if (organizerEmail && event.notify_organizer_on_sale !== false) {
          sendConfirmationEmail({
            type: "new_ticket_sale",
            to: organizerEmail,
            data: {
              eventTitle: event.title,
              eventId: event.id,
              ticketType: "Free RSVP",
              quantity: quantity,
              buyerName: `${formData.firstName} ${formData.lastName}`,
              buyerEmail: formData.email,
              buyerPhone: formData.phone || null,
              amount: 0,
              isFree: true,
              currency: event.currency || 'NGN',
              totalSold: (event.tickets_sold || 0) + quantity,
              totalCapacity: event.capacity || 0,
              appUrl: window.location.origin
            }
          })
        }
      } catch (orgEmailErr) {
        console.warn('Organizer notification failed:', orgEmailErr?.message)
      }

      navigate('/payment-success', {
        state: { order: existingOrder, event, tickets, reference: 'FREE' }
      })

    } catch (err) {
      console.error('Fallback RSVP error:', err)
      setError('An error occurred. Please try again.')
      setLoading(false)
    }
  }

  // Form validation
  const validateForm = () => {
    if (!formData.email || !formData.firstName || !formData.lastName) {
      setError('Please fill in all required fields.')
      return false
    }
    
    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address.')
      return false
    }

    if (settings.requirePhone && !formData.phone) {
      setError('Phone number is required.')
      return false
    }

    const effectiveMax = maxQuantity || 10
    if (quantity < 1 || quantity > effectiveMax) {
      setError(`Please select between 1 and ${effectiveMax} tickets.`)
      return false
    }

    return true
  }

  // Handle submit
  const handleSubmit = () => {
    if (actualDonation > 0) {
      handleDonationRSVP()
    } else {
      handleFreeRSVP()
    }
  }

  // Format date helper
  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    })
  }

  if (!event || !settingsLoaded) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" />
      </div>
    )
  }

  // Check if at limit
  const atLimit = rsvpLimit && !rsvpLimit.allowed

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Button 
        variant="ghost" 
        className="mb-6 text-muted-foreground hover:text-foreground" 
        onClick={() => navigate(-1)}
      >
        <ArrowLeft className="w-4 h-4 mr-2" />Back
      </Button>

      <div className="mb-8">
        <h1 className="text-4xl font-bold text-foreground mb-2">Register for Free Event</h1>
        <p className="text-muted-foreground">Complete your free registration for {event.title}</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {atLimit && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <span>You've already registered {rsvpLimit.current} time(s) for this event (maximum {rsvpLimit.max}).</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form Section */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Information */}
          <Card className="border-border/10 rounded-2xl">
            <CardHeader>
              <CardTitle className="text-foreground">Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input 
                    id="firstName" 
                    placeholder="John" 
                    value={formData.firstName} 
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} 
                    className="rounded-xl border-border/10" 
                    disabled={atLimit}
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input 
                    id="lastName" 
                    placeholder="Doe" 
                    value={formData.lastName} 
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} 
                    className="rounded-xl border-border/10" 
                    disabled={atLimit}
                    required 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="your@email.com" 
                  value={formData.email} 
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })} 
                  className="rounded-xl border-border/10" 
                  disabled={atLimit}
                  required 
                />
                <p className="text-sm text-muted-foreground">Confirmation will be sent to this email</p>
              </div>

            </CardContent>
          </Card>

          {/* RSVP Details */}
          <Card className="border-green-200 bg-green-50/50 rounded-2xl">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Free Event</h3>
                  <p className="text-sm text-muted-foreground">No payment required - just fill in your details</p>
                </div>
              </div>
              
              {/* Quantity Selector */}
              <div className="pt-4 border-t border-green-200">
                <Label className="text-foreground font-medium mb-2 block">Number of RSVPs</Label>
                <div className="flex items-center gap-3">
                  <button 
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-10 h-10 rounded-lg border border-green-300 flex items-center justify-center text-green-700 hover:bg-green-100 transition-colors disabled:opacity-50"
                    disabled={quantity <= 1 || atLimit}
                  >
                    -
                  </button>
                  <span className="w-12 text-center text-xl font-bold text-foreground">{quantity}</span>
                  <button 
                    type="button"
                    onClick={() => setQuantity(Math.min(maxQuantity, quantity + 1))}
                    className="w-10 h-10 rounded-lg border border-green-300 flex items-center justify-center text-green-700 hover:bg-green-100 transition-colors disabled:opacity-50"
                    disabled={quantity >= maxQuantity || atLimit}
                  >
                    +
                  </button>
                  <span className="text-sm text-muted-foreground ml-2">(max {maxQuantity || 10})</span>
                </div>
                {rsvpLimit && rsvpLimit.current > 0 && (
                  <p className="text-sm text-amber-600 mt-2">
                    You've already registered {rsvpLimit.current} time(s) for this event.
                  </p>
                )}
              </div>
              
              {/* Donation Options */}
              {acceptsDonations && !atLimit && (
                <div className="pt-4 border-t border-green-200">
                  <Label className="text-foreground font-medium mb-2 block flex items-center gap-2">
                    <span>💝</span> Support This Event (Optional)
                  </Label>
                  <p className="text-sm text-muted-foreground mb-3">
                    Your donation helps make this event possible
                    {donorPaysFee && <span className="text-muted-foreground"> (processing fee will be added)</span>}
                  </p>
                  
                  <div className="flex flex-wrap gap-2 mb-3">
                    <button
                      type="button"
                      onClick={() => { setDonationAmount(0); setCustomDonation(''); }}
                      className={`px-4 py-2 rounded-lg font-medium transition-all ${
                        donationAmount === 0 && !customDonation
                          ? 'bg-gray-600 text-white'
                          : 'bg-muted text-foreground/80 hover:bg-muted border border-border/20'
                      }`}
                    >
                      No Thanks
                    </button>
                    {donationOptions.map((amount) => (
                      <button
                        key={amount}
                        type="button"
                        onClick={() => { setDonationAmount(amount); setCustomDonation(''); }}
                        className={`px-4 py-2 rounded-lg font-medium transition-all ${
                          donationAmount === amount && !customDonation
                            ? 'bg-green-600 text-white'
                            : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                        }`}
                      >
                        {formatPrice(amount, event?.currency)}
                      </button>
                    ))}
                  </div>
                  
                  {allowCustomDonation && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-sm">Custom:</span>
                      <input
                        type="number"
                        placeholder="Enter amount"
                        value={customDonation}
                        onChange={(e) => {
                          setCustomDonation(e.target.value);
                          setDonationAmount(0);
                        }}
                        min="0"
                        className="flex-1 px-3 py-2 rounded-lg border border-green-300 focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Order Summary Sidebar */}
        <div className="lg:col-span-1">
          <Card className="border-border/10 rounded-2xl sticky top-16 md:top-20 lg:top-24">
            <CardHeader>
              <CardTitle className="text-foreground">Registration Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Event Info */}
              <div className="flex gap-4">
                <div className="w-20 h-20 rounded-xl overflow-hidden bg-muted flex-shrink-0">
                  <img 
                    src={event.image_url} 
                    alt={event.title} 
                    className="w-full h-full object-cover" 
                    onError={(e) => { e.target.style.display = 'none' }} 
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground line-clamp-2">{event.title}</h3>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                    <Calendar className="w-3 h-3" />
                    <span>{formatDate(event.start_date)}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                    <MapPin className="w-3 h-3" />
                    <span>{event.venue_name}</span>
                  </div>
                </div>
              </div>

              <Badge className="bg-green-100 text-green-700 border-0 w-full justify-center py-2">
                🎉 Free Event
              </Badge>

              <Separator />

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-foreground/70">Free Admission × {quantity}</span>
                  <span className="text-foreground">Free</span>
                </div>
                
                {actualDonation > 0 && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-green-600 flex items-center gap-1">💝 Donation</span>
                      <span className="text-green-600 font-medium">
                        {formatPrice(actualDonation, event?.currency)}
                      </span>
                    </div>
                    {donorPaysFee && donationFee > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-1">
                          Processing Fee ({(donationFeePercent * 100).toFixed(1)}%)
                        </span>
                        <span className="text-muted-foreground">
                          {formatPrice(donationFee, event?.currency)}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>

              <Separator />

              <div className="flex justify-between font-bold text-lg">
                <span className="text-foreground">Total</span>
                <span className={actualDonation > 0 ? "text-green-600" : "text-foreground"}>
                  {actualDonation > 0 ? formatPrice(donationTotal, event?.currency) : 'Free'}
                </span>
              </div>

              <Button 
                className={`w-full text-white rounded-xl py-6 text-lg ${
                  actualDonation > 0 
                    ? 'bg-green-600 hover:bg-green-700' 
                    : 'bg-[#2969FF] hover:bg-[#1a4fd8]'
                }`}
                onClick={handleSubmit} 
                disabled={loading || atLimit || !formData.email || !formData.firstName || !formData.lastName}
              >
                {loading ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Processing...</>
                ) : atLimit ? (
                  <>Registration Limit Reached</>
                ) : actualDonation > 0 ? (
                  <><CheckCircle className="w-5 h-5 mr-2" />RSVP & Donate {formatPrice(donationTotal, event?.currency)}</>
                ) : (
                  <><CheckCircle className="w-5 h-5 mr-2" />Complete Registration</>
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                By registering, you agree to our Terms of Service
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
