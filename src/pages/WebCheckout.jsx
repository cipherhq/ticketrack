import { getOrganizerFees, DEFAULT_FEES, calculateFees } from '@/config/fees'
import { getPaymentProvider, getPaymentProviderWithFallback, getPaymentProviders, getProviderInfo, initStripeCheckout, initPayPalCheckout, initFlutterwaveCheckout, getActiveGateway } from '@/config/payments'
import { formatPrice, getDefaultCurrency } from '@/config/currencies'
import { useFeatureFlags } from '@/contexts/FeatureFlagsContext';
import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { CreditCard, Building2, Smartphone, Lock, ArrowLeft, Loader2, Calendar, MapPin, Clock, Tag, X, User, UserCheck, Mail, Phone } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PhoneInput } from '@/components/ui/phone-input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { markWaitlistPurchased } from '@/services/waitlist'
import { generateTicketPDFBase64, generateMultiTicketPDFBase64 } from '@/utils/ticketGenerator'
import { logger, handleApiError, getUserMessage, ERROR_CODES } from '@/lib/logger'
import { toast } from 'sonner'


// Credit promoter for referral sale
const creditPromoter = async (orderId, eventId, saleAmount, ticketCount) => {
  try {
    const refCode = localStorage.getItem('referral_code')
    const refEventId = localStorage.getItem('referral_event_id')
    
    // Only credit if referral is for this event or all events
    if (!refCode || !/^[A-Za-z0-9-]+$/.test(refCode)) return
    
    // Find promoter by code
    const { data: promoter } = await supabase
      .from('promoters')
      .select('id, commission_type, commission_value, commission_rate, organizer_id')
      .or(`short_code.eq.${refCode},referral_code.eq.${refCode}`)
      .single()
    
    if (!promoter) return
    
    // Calculate commission
    const commissionRate = promoter.commission_value || promoter.commission_rate || 10
    const commissionType = promoter.commission_type || 'percentage'
    let commissionAmount = 0
    
    if (commissionType === 'percentage') {
      commissionAmount = (saleAmount * commissionRate) / 100
    } else {
      commissionAmount = commissionRate * ticketCount
    }
    
    // Create promoter_sales record
    await supabase.from('promoter_sales').insert({
      promoter_id: promoter.id,
      event_id: eventId,
      order_id: orderId,
      ticket_count: ticketCount,
      sale_amount: saleAmount,
      commission_rate: commissionRate,
      commission_amount: commissionAmount,
      status: 'pending'
    })
    
    // Update promoter totals
    await supabase.rpc('update_promoter_sales', { 
      p_promoter_id: promoter.id,
      p_sale_amount: saleAmount,
      p_commission: commissionAmount,
      p_ticket_count: ticketCount
    })
    
    // Clear referral from localStorage
    localStorage.removeItem('referral_code')
    localStorage.removeItem('referral_event_id')
    
    console.log('Promoter credited:', { promoter_id: promoter.id, commission: commissionAmount })
  } catch (err) {
    console.error('Error crediting promoter:', err)
  }
}

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
    // send-email is a public endpoint designed to send order confirmations post-purchase.
    // The email data is validated server-side and doesn't expose sensitive operations.
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


// Credit affiliate for referral sale (platform-wide, different from promoters)
const creditAffiliate = async (orderId, eventId, platformFee, currency, buyerId, buyerEmail, buyerPhone) => {
  try {
    const affiliateCode = localStorage.getItem('affiliate_code')
    if (!affiliateCode) return

    // Get buyer IP for fraud detection
    let buyerIP = null
    try {
      const ipResponse = await fetch('https://api.ipify.org?format=json')
      const ipData = await ipResponse.json()
      buyerIP = ipData.ip
    } catch (e) {
      console.log('Could not fetch IP')
    }

    // Validate affiliate code format (alphanumeric only - XSS prevention)
    if (!/^[A-Za-z0-9-]+$/.test(affiliateCode)) {
      console.log('Invalid affiliate code format')
      localStorage.removeItem('affiliate_code')
      return
    }

    // Find user by referral code
    const { data: referrer } = await supabase
      .from('profiles')
      .select('id, email, phone, referral_code, affiliate_status')
      .eq('referral_code', affiliateCode).eq('affiliate_status', 'approved')
      .single()

    if (!referrer) {
      localStorage.removeItem('affiliate_code')
      return
    }

    // FRAUD CHECK: Prevent self-referral
    if (referrer.id === buyerId) {
      console.log('Affiliate fraud blocked: self-referral')
      localStorage.removeItem('affiliate_code')
      return
    }

    // FRAUD CHECK: Same email
    if (referrer.email && buyerEmail && referrer.email.toLowerCase() === buyerEmail.toLowerCase()) {
      console.log('Affiliate fraud blocked: same email')
      localStorage.removeItem('affiliate_code')
      return
    }

    // FRAUD CHECK: Same phone (normalize for comparison)
    if (referrer.phone && buyerPhone) {
      const normalizedReferrerPhone = referrer.phone.replace(/\D/g, '')
      const normalizedBuyerPhone = buyerPhone.replace(/\D/g, '')
      if (normalizedReferrerPhone === normalizedBuyerPhone) {
        console.log('Affiliate fraud blocked: same phone')
        localStorage.removeItem('affiliate_code')
        return
      }
    }

    // FRAUD FLAG: Check for same IP on recent referrals (flag, don't block)
    let isFlagged = false
    let flagReason = null
    
    if (buyerIP) {
      const { data: recentSameIP } = await supabase
        .from('referral_earnings')
        .select('id')
        .eq('user_id', referrer.id)
        .eq('ip_address', buyerIP)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(1)

      if (recentSameIP && recentSameIP.length > 0) {
        isFlagged = true
        flagReason = 'Same IP as previous referral within 24 hours'
      }
    }

    // FRAUD FLAG: Similar email pattern detection
    if (referrer.email && buyerEmail) {
      const referrerBase = referrer.email.toLowerCase().split('@')[0].replace(/[0-9]/g, '')
      const buyerBase = buyerEmail.toLowerCase().split('@')[0].replace(/[0-9]/g, '')
      if (referrerBase === buyerBase && referrer.email !== buyerEmail) {
        isFlagged = true
        flagReason = (flagReason ? flagReason + '; ' : '') + 'Similar email pattern detected'
      }
    }

    // Get affiliate settings
    const { data: settings } = await supabase
      .from('affiliate_settings')
      .select('commission_percent, payout_delay_days, is_enabled')
      .single()

    if (!settings || !settings.is_enabled) return

    // Calculate commission (percentage of platform fee)
    const commissionPercent = settings.commission_percent || 1.5
    const commissionAmount = (platformFee * commissionPercent) / 100

    if (commissionAmount <= 0) return

    // Get event date for payout availability
    const { data: event } = await supabase
      .from('events')
      .select('end_date')
      .eq('id', eventId)
      .single()

    const payoutDelayDays = settings.payout_delay_days || 7
    const eventEndDate = event?.end_date ? new Date(event.end_date) : new Date()
    const availableAt = new Date(eventEndDate.getTime() + (payoutDelayDays * 24 * 60 * 60 * 1000))

    // Create referral earning record
    await supabase.from('referral_earnings').insert({
      user_id: referrer.id,
      order_id: orderId,
      event_id: eventId,
      buyer_id: buyerId,
      order_amount: platformFee,
      platform_fee: platformFee,
      commission_percent: commissionPercent,
      commission_amount: commissionAmount,
      currency: currency,
      status: 'pending',
      available_at: availableAt.toISOString(),
      ip_address: buyerIP,
      is_flagged: isFlagged,
      flag_reason: flagReason,
    })

    // Update order with referral info
    await supabase
      .from('orders')
      .update({
        referred_by: referrer.id,
        referral_code_used: affiliateCode,
        referral_commission: commissionAmount,
        referral_status: 'pending'
      })
      .eq('id', orderId)

    // Update referrer's referral count
    await supabase
      .from('profiles')
      .update({ 
        referral_count: referrer.referral_count ? referrer.referral_count + 1 : 1 
      })
      .eq('id', referrer.id)

    // Clear affiliate code from localStorage
    localStorage.removeItem('affiliate_code')
    
    console.log('Affiliate commission recorded:', commissionAmount, currency)
  } catch (error) {
    console.error('Error crediting affiliate:', error)
  }
}


export function WebCheckout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const { isEnabledForCurrency } = useFeatureFlags()
  
  // Extract checkout data - includes waitlist info if coming from waitlist purchase
  const { event, selectedTickets, ticketTypes, totalAmount, fromWaitlist, waitlistId, selectedEventId } = location.state || {}
  
  // For recurring events, ensure child event exists in database before creating order
  // This ensures payouts are correctly calculated based on child event's end_date
  const ensureChildEventExists = async () => {
    // If event is virtual (not in DB), we need to create it or find existing child event
    // When purchasing a future recurring event date, use that exact date for the child event
    if (event?.is_virtual || (typeof event?.id === 'string' && event?.id?.startsWith('virtual-'))) {
      const parentEventId = event?.parent_event_id;
      // Use the start_date and end_date from the event object (which should be the future date selected)
      const childEventStartDate = event?.start_date;
      const childEventEndDate = event?.end_date;
      
      if (!parentEventId || !childEventStartDate || !childEventEndDate) {
        // Fall back to parent event if we can't determine child event dates
        return event?.parent_event_id || event?.id?.replace('virtual-', '');
      }
      
      // Check if child event already exists for this date
      // start_date is a timestamp, so we need to compare dates properly
      const dateStr = childEventStartDate.split('T')[0]; // YYYY-MM-DD
      const dateStart = `${dateStr}T00:00:00`;
      const dateEnd = `${dateStr}T23:59:59`;
      
      const { data: existingChildren } = await supabase
        .from('events')
        .select('id, start_date, end_date')
        .eq('parent_event_id', parentEventId)
        .gte('start_date', dateStart)
        .lte('start_date', dateEnd);
      
      const existingChild = existingChildren && existingChildren.length > 0 ? existingChildren[0] : null;
      
      if (existingChild) {
        // Child event exists, use it
        return existingChild.id;
      }
      
      // Create child event in database
      // Get parent event details first
      const { data: parentEvent } = await supabase
        .from('events')
        .select('*')
        .eq('id', parentEventId)
        .single();
      
      if (!parentEvent) {
        // Parent event not found, fall back
        return parentEventId;
      }
      
      // Generate slug for child event (dateStr already defined above)
      const childSlug = `${parentEvent.slug}-${dateStr}`.replace(/--+/g, '-').substring(0, 100);
      
      // Create child event
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
          start_date: childEventStartDate, // Use the future date from the virtual event
          end_date: childEventEndDate, // Use the future end date from the virtual event
          venue_name: parentEvent.venue_name,
          venue_address: parentEvent.venue_address,
          city: parentEvent.city,
          country_code: parentEvent.country_code,
          currency: parentEvent.currency,
          status: 'published',
          is_recurring: false, // Child events are not recurring themselves
          timezone: parentEvent.timezone,
          image_url: parentEvent.image_url,
          // Copy other relevant fields from parent
        })
        .select()
        .single();
      
      if (createError || !newChildEvent) {
        console.error('Error creating child event:', createError);
        // Fall back to parent event ID
        return parentEventId;
      }
      
      // Check if ticket types already exist for this child event
      const { data: existingChildTicketTypes } = await supabase
        .from('ticket_types')
        .select('id')
        .eq('event_id', newChildEvent.id)
        .limit(1);
      
      // Only create ticket types if they don't already exist
      if (!existingChildTicketTypes || existingChildTicketTypes.length === 0) {
        // Get parent event's ticket types to create separate inventory for child event
        const { data: parentTicketTypes } = await supabase
          .from('ticket_types')
          .select('*')
          .eq('event_id', parentEventId)
          .eq('is_active', true);
        
        if (parentTicketTypes && parentTicketTypes.length > 0) {
          // Create ticket types for child event with their own inventory
          // Each child event gets its own ticket inventory (separate from parent)
          const childTicketTypes = parentTicketTypes.map(tt => ({
            event_id: newChildEvent.id,
            name: tt.name,
            description: tt.description,
            price: tt.price,
            quantity_available: tt.quantity_available, // Same capacity as parent, but separate inventory
            quantity_sold: 0, // Fresh count for child event
            max_per_order: tt.max_per_order,
            is_active: tt.is_active,
            is_table_ticket: tt.is_table_ticket || false,
            seats_per_table: tt.seats_per_table || null,
          }));
          
          const { error: ticketTypesError } = await supabase
            .from('ticket_types')
            .insert(childTicketTypes);
          
          if (ticketTypesError) {
            console.error('Error creating ticket types for child event:', ticketTypesError);
          }
        }
      }
      
      return newChildEvent.id;
    }
    
    // Not a virtual event, return the event ID as-is
    return event?.id;
  };
  
  const [paymentMethod, setPaymentMethod] = useState('card')
  const [formData, setFormData] = useState({
    email: user?.email || '',
    phone: '',
    firstName: '',
    lastName: '',
    communicationConsent: true // Default to true - user can uncheck if they don't want communications
  })
  const [formErrors, setFormErrors] = useState({})
  const [buyingForSelf, setBuyingForSelf] = useState(true)

  // Validation patterns
  const validationPatterns = {
    // Names: letters, hyphens, apostrophes, spaces (Unicode letters for international names)
    name: /^[\p{L}\s'-]{1,50}$/u,
    // Email: standard email format
    email: /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,
    // Promo code: alphanumeric, hyphens, underscores only
    promoCode: /^[A-Za-z0-9_-]{1,30}$/
  }

  // Validate a single field
  const validateField = (field, value) => {
    if (!value || value.trim() === '') {
      return field === 'phone' ? null : 'This field is required'
    }

    switch (field) {
      case 'firstName':
      case 'lastName':
        if (!validationPatterns.name.test(value.trim())) {
          return 'Please enter a valid name (letters, hyphens, apostrophes only)'
        }
        break
      case 'email':
        if (!validationPatterns.email.test(value.trim())) {
          return 'Please enter a valid email address'
        }
        break
    }
    return null
  }

  // Handle form input with validation
  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    const error = validateField(field, value)
    setFormErrors(prev => ({ ...prev, [field]: error }))
  }

  // Validate all required fields before payment
  const validateForm = () => {
    const errors = {}
    errors.firstName = validateField('firstName', formData.firstName)
    errors.lastName = validateField('lastName', formData.lastName)
    errors.email = validateField('email', formData.email)

    setFormErrors(errors)
    return !errors.firstName && !errors.lastName && !errors.email
  }
  const [customFields, setCustomFields] = useState([])
  const [customFieldResponses, setCustomFieldResponses] = useState({})
  
  // Promo code state
  const [promoCode, setPromoCode] = useState('')
  const [promoApplied, setPromoApplied] = useState(null)
  const [promoError, setPromoError] = useState('')
  const [applyingPromo, setApplyingPromo] = useState(false)
  const [loading, setLoading] = useState(false)

  // Checkout countdown timer (5 minutes)
  const [timeLeft, setTimeLeft] = useState(300)
  const [timerExpired, setTimerExpired] = useState(false)
  const [error, setError] = useState(null)
  const [fees, setFees] = useState(DEFAULT_FEES)
  const [paymentProvider, setPaymentProvider] = useState('paystack')
  const [availablePaymentMethods, setAvailablePaymentMethods] = useState([{ id: 'card', icon: 'CreditCard', label: 'Card' }])

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
        }
      }
    }
    loadProfile()
  }, [user])

  useEffect(() => {
    // Require event and tickets for checkout
    if (!event || !selectedTickets || Object.keys(selectedTickets).length === 0) {
      navigate('/events')
    }
  }, [event, selectedTickets, navigate])


  // Load custom fields for the event
  useEffect(() => {
    async function loadCustomFields() {
      if (event?.id) {
        const { data, error } = await supabase
          .from('event_custom_fields')
          .select('*')
          .eq('event_id', event.id)
          .order('display_order', { ascending: true });
        
        if (!error && data) {
          setCustomFields(data);
          // Initialize responses object
          const initialResponses = {};
          data.forEach(field => {
            initialResponses[field.id] = '';
          });
          setCustomFieldResponses(initialResponses);
        }
      }
    }
    loadCustomFields();
  }, [event?.id]);

  // Fetch service fee rate based on event currency and organizer custom fees
  useEffect(() => {
    async function loadFees() {
      if (event?.currency) {
        const organizerId = event?.organizer?.id;
        const loadedFees = await getOrganizerFees(organizerId, event.currency);
        setFees(loadedFees);
      }
    }
    loadFees();
  }, [event?.currency, event?.organizer?.id]);


  // Detect payment provider and available methods based on currency and features
  // Includes fallback logic (Paystack -> Flutterwave for NGN/GHS)
  useEffect(() => {
    const loadPaymentOptions = async () => {
      if (!event?.currency || !event?.country_code) return;
      
      // Get provider with fallback support
      const { provider, isBackup } = await getPaymentProviderWithFallback(
        event.currency, 
        event.country_code
      );
      setPaymentProvider(provider);
      
      // Build available payment methods based on provider and features
      const methods = [];
      
      if (provider === 'stripe') {
        methods.push({ id: 'card', label: 'Card / Apple Pay / Google Pay' });
      } else if (provider === 'paypal') {
        methods.push({ id: 'paypal', label: 'PayPal' });
      } else if (provider === 'flutterwave') {
        // Flutterwave - check features for each method
        methods.push({ id: 'card', label: 'Card' });
        
        const bankEnabled = await isEnabledForCurrency(event.currency, 'bank_transfer');
        if (bankEnabled) methods.push({ id: 'bank', label: 'Bank Transfer' });
        
        const ussdEnabled = await isEnabledForCurrency(event.currency, 'ussd');
        if (ussdEnabled) methods.push({ id: 'ussd', label: 'USSD' });
        
        methods.push({ id: 'mobile_money', label: 'Mobile Money' });
      } else {
        // Paystack - check features for each method
        methods.push({ id: 'card', label: 'Card' });
        
        const bankEnabled = await isEnabledForCurrency(event.currency, 'bank_transfer');
        if (bankEnabled) methods.push({ id: 'bank', label: 'Bank Transfer' });
        
        const ussdEnabled = await isEnabledForCurrency(event.currency, 'ussd');
        if (ussdEnabled) methods.push({ id: 'ussd', label: 'USSD' });
      }
      
      setAvailablePaymentMethods(methods);
      if (methods.length > 0) setPaymentMethod(methods[0].id);
    };
    
    loadPaymentOptions();
  }, [event?.currency, event?.country_code]);

  useEffect(() => {
    const TIMER_KEY = `checkout_timer_${event?.id}`
    const TIMER_DURATION = 300 // 5 minutes in seconds
    
    // Get or set start time
    let startTime = localStorage.getItem(TIMER_KEY)
    if (!startTime) {
      startTime = Date.now()
      localStorage.setItem(TIMER_KEY, startTime)
    } else {
      startTime = parseInt(startTime)
    }
    
    const updateTimer = () => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000)
      const remaining = TIMER_DURATION - elapsed
      
      if (remaining <= 0) {
        setTimeLeft(0)
        setTimerExpired(true)
        localStorage.removeItem(TIMER_KEY)
        toast.error("Time expired! Your session has ended. Please select your tickets again.")
        navigate(`/e/${event?.slug || event?.id}`)
      } else {
        setTimeLeft(remaining)
      }
    }
    
    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    
    return () => {
      clearInterval(interval)
    }
  }, [event?.id, navigate])

  if (!event) return null

  const ticketCount = Object.values(selectedTickets).reduce((sum, qty) => sum + (qty || 0), 0)
  const feeProvider = ["NGN", "GHS"].includes(event?.currency) ? "paystack" : "stripe"
  const { displayFee: calculatedFee, serviceFee: platformFee, processingFee } = calculateFees(totalAmount, ticketCount, fees, feeProvider)
  
  // Check if organizer is absorbing the fee
  const organizerAbsorbsFee = event?.fee_handling === 'absorb'
  // If organizer absorbs, attendee sees no fee; otherwise show calculated fee
  const serviceFee = organizerAbsorbsFee ? 0 : calculatedFee
  // Store the actual fee for payout calculations (always calculated, even if not shown to attendee)
  const actualPlatformFee = calculatedFee
  
  const discountAmount = promoApplied?.discountAmount || 0
  const finalTotal = totalAmount + serviceFee - discountAmount

  const ticketSummary = Object.entries(selectedTickets)
    .filter(([_, qty]) => qty > 0)
    .map(([tierId, qty]) => {
      const tier = ticketTypes.find(t => t.id === tierId)
      return { 
        id: tierId,
        name: tier?.name || 'Ticket', 
        quantity: qty, 
        price: tier?.price || 0, 
        subtotal: (tier?.price || 0) * qty 
      }
    })

  const totalTicketCount = ticketSummary.reduce((sum, t) => sum + t.quantity, 0)

  // Helper function to ensure child event exists and map ticket types for future recurring events
  const prepareChildEventAndTickets = async () => {
    // Ensure child event exists
    const finalEventId = await ensureChildEventExists();
    
    // If we're purchasing a future date (child event), map parent ticket type IDs to child ticket type IDs
    let mappedTicketSummary = ticketSummary;
    if (finalEventId !== event?.id && (event?.is_virtual || event?.id?.startsWith('virtual-'))) {
      // Get child event's ticket types (should match parent's by name/price)
      const { data: childTicketTypes } = await supabase
        .from('ticket_types')
        .select('*')
        .eq('event_id', finalEventId)
        .eq('is_active', true);
      
      if (childTicketTypes && childTicketTypes.length > 0) {
        // Map parent ticket type IDs to child ticket type IDs by matching name and price
        mappedTicketSummary = ticketSummary.map(parentTicket => {
          const matchingChildTicket = childTicketTypes.find(
            child => child.name === parentTicket.name && 
                     parseFloat(child.price) === parseFloat(parentTicket.price)
          );
          
          if (matchingChildTicket) {
            return {
              ...parentTicket,
              id: matchingChildTicket.id // Use child ticket type ID for availability check
            };
          }
          return parentTicket; // Fallback to parent if no match found
        });
      }
    }
    
    return { finalEventId, mappedTicketSummary };
  };

  // Reserve tickets atomically (prevents overselling)
  // For future recurring events, this should use child event's ticket type IDs
  const reserveAllTickets = async (ticketSummaryToUse = ticketSummary) => {
    const reservations = []
    
    for (const item of ticketSummaryToUse) {
      const { data, error } = await supabase.rpc('reserve_tickets', {
        p_ticket_type_id: item.id,
        p_quantity: item.quantity
      })
      
      if (error) {
        logger.error('Reserve tickets RPC error', error)
        // Release any already reserved tickets
        await releaseAllTickets(reservations)
        throw new Error('Failed to reserve tickets')
      }
      
      if (!data.success) {
        // Release any already reserved tickets
        await releaseAllTickets(reservations)
        throw new Error(data.error || 'Not enough tickets available')
      }
      
      reservations.push({ ticketTypeId: item.id, quantity: item.quantity })
    }
    
    return reservations
  }

  // Release tickets (for failed payments or refunds)
  const releaseAllTickets = async (reservations) => {
    for (const res of reservations) {
      try {
        await supabase.rpc('release_tickets', {
          p_ticket_type_id: res.ticketTypeId,
          p_quantity: res.quantity
        })
      } catch (err) {
        console.error('Failed to release tickets:', err)
      }
    }
  }

  // Generate unique ticket number
  const generateTicketNumber = (index) => {
    const timestamp = Date.now().toString(36).toUpperCase()
    const random = Math.random().toString(36).substring(2, 6).toUpperCase()
    return `TKT${timestamp}${random}${index}`
  }

  // Create tickets in database
  const createTickets = async (orderId, paymentRef) => {
    // Get order with order_items (which have the correct ticket_type_id for child events)
    const { data: orderData } = await supabase
      .from('orders')
      .select(`
        event_id,
        order_items (
          ticket_type_id,
          quantity,
          unit_price
        )
      `)
      .eq('id', orderId)
      .single();
    
    if (!orderData) {
      throw new Error('Order not found')
    }
    
    const ticketEventId = orderData?.event_id || event?.id;
    const orderItems = orderData?.order_items || [];
    
    // If no order_items, fall back to ticketSummary (for backward compatibility)
    const itemsToUse = orderItems.length > 0 
      ? orderItems 
      : ticketSummary.map(t => ({ 
          ticket_type_id: t.id, 
          quantity: t.quantity, 
          unit_price: t.price 
        }));
    
    const ticketsToCreate = []
    let ticketIndex = 0
    
    for (const item of itemsToUse) {
      const ticketTypeId = item.ticket_type_id || item.id;
      const quantity = item.quantity || 0;
      const unitPrice = parseFloat(item.unit_price || item.price || 0);
      
      for (let i = 0; i < quantity; i++) {
        const ticketCode = generateTicketNumber(ticketIndex++)
        ticketsToCreate.push({
          event_id: ticketEventId,
          ticket_type_id: ticketTypeId, // Use correct ticket type ID from order_items
          user_id: user.id,
          attendee_email: formData.email,
          attendee_name: `${formData.firstName} ${formData.lastName}`,
          attendee_phone: formData.phone || null,
          ticket_code: ticketCode,
          qr_code: ticketCode,
          unit_price: unitPrice,
          total_price: unitPrice,
          payment_reference: paymentRef,
          payment_status: 'completed',
          payment_method: paymentProvider || 'paystack',
          order_id: orderId,
          status: 'active',
          metadata: {
            communication_consent: formData.communicationConsent,
            consent_timestamp: new Date().toISOString()
          }
        })
      }
    }

    // Debug log removed - contains user data
    // if (import.meta.env.DEV) console.log('Creating tickets:', ticketsToCreate.length)
    const { data, error } = await supabase.from('tickets').insert(ticketsToCreate).select()
    
    if (error) {
      console.error('Tickets insert error:', error)
      throw error
    }
    
    return data || ticketsToCreate
  }

  // Finalize order after Paystack payment (called from callback)
  const finalizePayment = async (orderId, reference) => {
    try {
      // Update order status
      await supabase.from('orders').update({ 
        status: 'completed',
        payment_reference: reference,
        paid_at: new Date().toISOString()
      }).eq('id', orderId)

      // Create tickets
      const tickets = await createTickets(orderId, reference)

      // Save custom field responses
      if (customFields.length > 0 && tickets && tickets.length > 0) {
        const responsesToInsert = []
        tickets.forEach(ticket => {
          customFields.forEach(field => {
            const response = customFieldResponses[field.id]
            if (response) {
              responsesToInsert.push({
                custom_field_id: field.id,
                ticket_id: ticket.id,
                response_value: response
              })
            }
          })
        })
        
        if (responsesToInsert.length > 0) {
          const { error: responseError } = await supabase
            .from('custom_field_responses')
            .insert(responsesToInsert)
          
          if (responseError) {
            console.error('Error saving custom field responses:', responseError)
          }
        }
      }

      // If this purchase came from waitlist, mark the waitlist entry as purchased
      if (fromWaitlist && waitlistId) {
        try {
          await markWaitlistPurchased(waitlistId)
          console.log('Waitlist entry marked as purchased:', waitlistId)
        } catch (waitlistErr) {
          console.error('Failed to update waitlist status:', waitlistErr)
        }
      }

      // Credit promoter for referral sale - get order's event_id
      const { data: orderData } = await supabase
        .from('orders')
        .select('event_id')
        .eq('id', orderId)
        .single();
      
      await creditPromoter(orderId, orderData?.event_id || event?.id, finalTotal, totalTicketCount)

      // Increment promo code usage if applied
      if (promoApplied?.id) {
        try {
          await supabase.rpc('increment_promo_usage', { promo_id: promoApplied.id })
        } catch (promoErr) {
          console.error('Failed to increment promo usage:', promoErr)
        }
      }

      // Credit affiliate for referral sale - use order's event_id
      await creditAffiliate(orderId, orderData?.event_id || event?.id, serviceFee, event.currency, user?.id, formData.email, formData.phone)

      // Generate PDF tickets and send confirmation email
      try {
        // Generate PDF for ALL tickets (multi-page PDF)
        const ticketsForPdf = tickets.map(t => ({
          ticket_code: t.ticket_code,
          attendee_name: `${formData.firstName} ${formData.lastName}`,
          attendee_email: formData.email,
          ticket_type_name: t.ticket_type_name || ticketSummary.find(ts => ts.id === t.ticket_type_id)?.name || "General"
        }))
        // Debug log removed for production security
        // console.log("DEBUG PDF:", { ticketCount: ticketsForPdf.length, ... })
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
            ticketType: ticketSummary.map(t => t.name).join(", "),
            quantity: totalTicketCount,
            orderNumber: `ORD${orderId}`,
            totalAmount: finalTotal,
            currency: event.currency || "",
            isFree: false,
            appUrl: window.location.origin
          },
          attachments: [{
            filename: pdfData.filename,
            content: pdfData.base64,
            type: 'application/pdf'
          }]
        })

        // Send notification to organizer (if enabled)
        const organizerEmail = event.organizer?.email || event.organizer?.business_email
        if (organizerEmail && event.notify_organizer_on_sale !== false) {
          sendConfirmationEmail({
            type: "new_ticket_sale",
            to: organizerEmail,
            data: {
              eventTitle: event.title,
              eventId: event.id,
              ticketType: ticketSummary.map(t => t.name).join(", "),
              quantity: totalTicketCount,
              buyerName: `${formData.firstName} ${formData.lastName}`,
              buyerEmail: formData.email,
              buyerPhone: formData.phone || null,
              amount: finalTotal,
              currency: event.currency || 'GBP',
              isFree: false,
              totalSold: event.tickets_sold || 0,
              totalCapacity: event.capacity || 0,
              appUrl: window.location.origin
            }
          })
        }
      } catch (pdfErr) {
        console.error('PDF generation failed, sending email without attachment:', pdfErr)
        // Fallback: send email without PDF attachment
        sendConfirmationEmail({
          type: "ticket_purchase",
          to: formData.email,
          data: {
            attendeeName: `${formData.firstName} ${formData.lastName}`,
            eventTitle: event.title,
            eventDate: event.start_date,
            venueName: [event.venue_name, event.venue_address, event.city].filter(Boolean).join(', ') || "TBA",
            city: event.city || "",
            ticketType: ticketSummary.map(t => t.name).join(", "),
            quantity: totalTicketCount,
            orderNumber: `ORD${orderId}`,
            totalAmount: finalTotal,
            currency: event.currency || "",
            isFree: false,
            appUrl: window.location.origin
          }
        })
      }
      return { success: true, tickets }
    } catch (err) {
      console.error('Finalize payment error:', err)
      return { success: false, error: err }
    }
  }

  // Handle Paystack payment
  const handlePaystackPayment = async () => {
    if (!validateForm()) {
      setError('Please correct the errors in the form')
      return
    }

    // Validate required custom fields
    const missingRequiredFields = customFields
      .filter(field => field.is_required && !customFieldResponses[field.id])
      .map(field => field.field_label)
    
    if (missingRequiredFields.length > 0) {
      setError(`Please fill in required fields: ${missingRequiredFields.join(', ')}`)
      return
    }

    if (!user) {
      setError('Please log in to continue')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // For recurring events, ensure child event exists and map ticket types FIRST
      // This ensures availability is checked against the child event's inventory, not parent's
      const { finalEventId, mappedTicketSummary } = await prepareChildEventAndTickets();

      // Reserve tickets first (prevents overselling) - use mapped ticket summary for child events
      await reserveAllTickets(mappedTicketSummary)

      // Create order - use finalEventId which will be the child event ID if it was created
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: user.id,
          event_id: finalEventId,
          order_number: `ORD${Date.now().toString(36).toUpperCase()}`,
          status: 'pending',
          subtotal: totalAmount,
          platform_fee: actualPlatformFee, // Always store actual fee for payout calculation
          platform_fee_absorbed: organizerAbsorbsFee, // Track if organizer absorbed the fee
          tax_amount: 0,
          discount_amount: discountAmount,
          promo_code_id: promoApplied?.id || null,
          total_amount: finalTotal,
          currency: event?.currency,
          payment_method: paymentMethod,
          payment_provider: 'paystack',
          buyer_email: formData.email,
          buyer_phone: formData.phone || null,
          buyer_name: `${formData.firstName} ${formData.lastName}`,
          waitlist_id: fromWaitlist ? waitlistId : null
        })
        .select()
        .single()

      if (orderError) {
        console.error('Order error:', orderError)
        throw orderError
      }

      console.log('Order created:', order)

      // Create order items - required for webhook ticket creation
      const orderItems = mappedTicketSummary.map(ticket => ({
        order_id: order.id,
        ticket_type_id: ticket.id,
        quantity: ticket.quantity,
        unit_price: ticket.price,
        subtotal: ticket.subtotal
      }));

      await supabase.from('order_items').insert(orderItems);

      const paymentRef = `TKT-${order.id.slice(0, 8).toUpperCase()}-${Date.now()}`

      // Save payment reference to order so webhook can find it
      await supabase.from('orders').update({ payment_reference: paymentRef }).eq('id', order.id);

      // Get organizer subaccount info if available
      const organizer = event?.organizer
      const useSubaccount = 
        organizer?.paystack_subaccount_id &&
        organizer?.paystack_subaccount_status === 'active' &&
        organizer?.paystack_subaccount_enabled === true

      // Initialize Paystack
      if (window.PaystackPop) {
        const paystackConfig = {
          key: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY,
          email: formData.email,
          amount: finalTotal * 100,
          currency: event?.currency,
          ref: paymentRef,
          metadata: {
            order_id: order.id,
            event_id: event.id,
            event_name: event.title,
            custom_fields: [
              { display_name: "Customer Name", variable_name: "customer_name", value: `${formData.firstName} ${formData.lastName}` }
            ]
          },
          callback: function(response) {
            // Call async function and handle with .then()
            finalizePayment(order.id, response.reference).then(function(result) {
              if (result.success) {
                navigate('/payment-success', { 
                  state: { order, event, tickets: result.tickets, reference: response.reference } 
                })
              } else {
                setError('Payment received but there was an error creating tickets. Please contact support.')
                setLoading(false)
              }
            })
          },
          onClose: function() {
            setLoading(false)
          }
        }

        // Add subaccount if available
        if (useSubaccount && organizer.paystack_subaccount_id) {
          paystackConfig.split_code = organizer.paystack_subaccount_id
        }

        const handler = window.PaystackPop.setup(paystackConfig)
        handler.openIframe()
      } else {
        // Paystack not loaded, try Flutterwave as fallback if available
        const { primary, backup } = getPaymentProviders(event?.currency)
        if (backup === 'flutterwave') {
          console.log('Paystack not available, trying Flutterwave fallback')
          // Use mapped ticket summary for child events (already prepared above)
          await handleFlutterwavePaymentFallback(order, mappedTicketSummary)
      } else {
        setError('Payment system not loaded. Please refresh the page.')
        setLoading(false)
        }
      }
    } catch (err) {
      logger.error('Checkout error', err)
      const safeError = handleApiError(err, 'Checkout')
      setError(getUserMessage(safeError.code, 'Payment could not be processed. Please try again.'))
      setLoading(false)
    }
  }

  // Handle Stripe payment (USD, GBP, EUR)
  const handleStripePayment = async () => {
    if (!validateForm()) {
      setError('Please correct the errors in the form');
      return;
    }

    if (!user) {
      setError('Please log in to continue');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // For recurring events, ensure child event exists and map ticket types FIRST
      const { finalEventId, mappedTicketSummary } = await prepareChildEventAndTickets();

      // Reserve tickets first - use mapped ticket summary for child events
      await reserveAllTickets(mappedTicketSummary);

      // Create order - use finalEventId which will be the child event ID if it was created
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: user.id,
          event_id: finalEventId,
          order_number: `ORD${Date.now().toString(36).toUpperCase()}`,
          status: 'pending',
          subtotal: totalAmount,
          platform_fee: actualPlatformFee, // Always store actual fee for payout calculation
          platform_fee_absorbed: organizerAbsorbsFee, // Track if organizer absorbed the fee
          tax_amount: 0,
          discount_amount: discountAmount,
          promo_code_id: promoApplied?.id || null,
          total_amount: finalTotal,
          currency: event?.currency || getDefaultCurrency(event?.country_code || event?.country),
          payment_method: 'card',
          payment_provider: 'stripe',
          buyer_email: formData.email,
          buyer_phone: formData.phone || null,
          buyer_name: `${formData.firstName} ${formData.lastName}`,
          waitlist_id: fromWaitlist ? waitlistId : null
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items - use mappedTicketSummary to ensure child event ticket types are used
      const orderItems = mappedTicketSummary.map(ticket => ({
        order_id: order.id,
        ticket_type_id: ticket.id,
        quantity: ticket.quantity,
        unit_price: ticket.price,
        subtotal: ticket.subtotal
      }));

      await supabase.from('order_items').insert(orderItems);

      // Initialize Stripe Checkout
      const successUrl = `${window.location.origin}/payment-success`;
      const cancelUrl = `${window.location.origin}/e/${event.slug || event.id}`;

      const { url } = await initStripeCheckout(order.id, successUrl, cancelUrl);

      if (url) {
        window.location.href = url;
      } else {
        throw new Error('Failed to create Stripe checkout session');
      }
    } catch (err) {
      logger.error('Stripe checkout error', err);
      const safeError = handleApiError(err, 'Stripe Checkout');
      setError(getUserMessage(safeError.code, 'Payment could not be processed. Please try again.'));
      setLoading(false);
    }
  };

  // Handle PayPal payment
  const handlePayPalPayment = async () => {
    if (!validateForm()) {
      setError('Please correct the errors in the form');
      return;
    }

    if (!user) {
      setError('Please log in to continue');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // For recurring events, ensure child event exists and map ticket types FIRST
      const { finalEventId, mappedTicketSummary } = await prepareChildEventAndTickets();

      // Reserve tickets first - use mapped ticket summary for child events
      await reserveAllTickets(mappedTicketSummary);

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: user.id,
          event_id: finalEventId,
          order_number: `ORD${Date.now().toString(36).toUpperCase()}`,
          status: 'pending',
          subtotal: totalAmount,
          platform_fee: actualPlatformFee, // Always store actual fee for payout calculation
          platform_fee_absorbed: organizerAbsorbsFee, // Track if organizer absorbed the fee
          tax_amount: 0,
          discount_amount: discountAmount,
          promo_code_id: promoApplied?.id || null,
          total_amount: finalTotal,
          currency: event?.currency || getDefaultCurrency(event?.country_code || event?.country),
          payment_method: 'paypal',
          payment_provider: 'paypal',
          buyer_email: formData.email,
          buyer_phone: formData.phone || null,
          buyer_name: `${formData.firstName} ${formData.lastName}`,
          waitlist_id: fromWaitlist ? waitlistId : null
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items - use mappedTicketSummary to ensure child event ticket types are used
      const orderItems = mappedTicketSummary.map(ticket => ({
        order_id: order.id,
        ticket_type_id: ticket.id,
        quantity: ticket.quantity,
        unit_price: ticket.price,
        subtotal: ticket.subtotal
      }));

      await supabase.from('order_items').insert(orderItems);

      const successUrl = `${window.location.origin}/payment-success`;
      const cancelUrl = `${window.location.origin}/e/${event.slug || event.id}`;

      const { approvalUrl } = await initPayPalCheckout(order.id, successUrl, cancelUrl);

      if (approvalUrl) {
        window.location.href = approvalUrl;
      } else {
        throw new Error('Failed to create PayPal checkout');
      }
    } catch (err) {
      logger.error('PayPal checkout error', err);
      const safeError = handleApiError(err, 'PayPal Checkout');
      setError(getUserMessage(safeError.code, 'Payment could not be processed. Please try again.'));
      setLoading(false);
    }
  };

  // Handle Flutterwave payment (server-side like Stripe)
  const handleFlutterwavePayment = async (existingOrder = null) => {
    if (!validateForm()) {
      setError('Please correct the errors in the form');
      return;
    }

    if (!user) {
      setError('Please log in to continue');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // For recurring events, ensure child event exists and map ticket types FIRST
      const { finalEventId, mappedTicketSummary } = await prepareChildEventAndTickets();

      // Reserve tickets first - use mapped ticket summary for child events
      await reserveAllTickets(mappedTicketSummary);

      let order = existingOrder;
      
      // Create order if not provided
      if (!order) {
        const { data: newOrder, error: orderError } = await supabase
          .from('orders')
          .insert({
            user_id: user.id,
            event_id: finalEventId,
            order_number: `ORD${Date.now().toString(36).toUpperCase()}`,
            status: 'pending',
            subtotal: totalAmount,
            platform_fee: actualPlatformFee, // Always store actual fee for payout calculation
            platform_fee_absorbed: organizerAbsorbsFee, // Track if organizer absorbed the fee
            tax_amount: 0,
            discount_amount: discountAmount,
            promo_code_id: promoApplied?.id || null,
            total_amount: finalTotal,
            currency: event?.currency,
            payment_method: paymentMethod,
            payment_provider: 'flutterwave',
            buyer_email: formData.email,
            buyer_phone: formData.phone || null,
            buyer_name: `${formData.firstName} ${formData.lastName}`,
            waitlist_id: fromWaitlist ? waitlistId : null
          })
          .select()
          .single();

        if (orderError) throw orderError;
        order = newOrder;
      }

      // Create order items - use mappedTicketSummary to ensure child event ticket types are used
      const orderItems = mappedTicketSummary.map(ticket => ({
        order_id: order.id,
        ticket_type_id: ticket.id,
        quantity: ticket.quantity,
        unit_price: ticket.price,
        subtotal: ticket.subtotal
      }));

      await supabase.from('order_items').insert(orderItems);

      // Initialize Flutterwave Checkout
      const successUrl = `${window.location.origin}/payment-success`;
      const cancelUrl = `${window.location.origin}/e/${event.slug || event.id}`;

      const { url } = await initFlutterwaveCheckout(order.id, successUrl, cancelUrl);

      if (url) {
        window.location.href = url;
      } else {
        throw new Error('Failed to create Flutterwave payment link');
      }
    } catch (err) {
      logger.error('Flutterwave checkout error', err);
      const safeError = handleApiError(err, 'Flutterwave Checkout');
      setError(getUserMessage(safeError.code, 'Payment could not be processed. Please try again.'));
      setLoading(false);
    }
  };

  // Fallback Flutterwave handler (called when Paystack fails)
  const handleFlutterwavePaymentFallback = async (order, mappedTicketSummaryForOrder = ticketSummary) => {
    // Update order provider to Flutterwave
    await supabase
      .from('orders')
      .update({ payment_provider: 'flutterwave' })
      .eq('id', order.id);

    // Create order items if not exists - use mapped ticket summary for child events
    const { count } = await supabase
      .from('order_items')
      .select('id', { count: 'exact', head: true })
      .eq('order_id', order.id);

    if (count === 0) {
      const orderItems = mappedTicketSummaryForOrder.map(ticket => ({
        order_id: order.id,
        ticket_type_id: ticket.id,
        quantity: ticket.quantity,
        unit_price: ticket.price,
        subtotal: ticket.subtotal
      }));
      await supabase.from('order_items').insert(orderItems);
    }

    // Initialize Flutterwave Checkout
    const successUrl = `${window.location.origin}/payment-success`;
    const cancelUrl = `${window.location.origin}/e/${event.slug || event.id}`;

    try {
      const { url } = await initFlutterwaveCheckout(order.id, successUrl, cancelUrl);
      if (url) {
        window.location.href = url;
      } else {
        setError('Failed to create Flutterwave payment link');
        setLoading(false);
      }
    } catch (err) {
      setError('Payment system error. Please try again.');
      setLoading(false);
    }
  };

  // Handle payment based on provider
  const handlePayment = () => {
    if (paymentProvider === 'stripe') {
      handleStripePayment();
    } else if (paymentProvider === 'paypal') {
      handlePayPalPayment();
    } else if (paymentProvider === 'flutterwave') {
      handleFlutterwavePayment();
    } else {
      handlePaystackPayment();
    }
  };

  
  // Apply promo code
  const applyPromoCode = async () => {
    if (!promoCode.trim()) return

    // Validate promo code format (alphanumeric, hyphens, underscores only)
    if (!validationPatterns.promoCode.test(promoCode.trim())) {
      setPromoError('Invalid promo code format')
      return
    }

    setApplyingPromo(true)
    setPromoError('')

    try {
      const code = promoCode.trim().toUpperCase()

      // Find promo code in database
      const { data: promo, error } = await supabase
        .from('promo_codes')
        .select('*')
        .eq('code', code)
        .eq('is_active', true)
        .single()
      
      if (error || !promo) {
        setPromoError('Invalid promo code')
        setPromoApplied(null)
        return
      }
      
      // Check if promo is for this event or all events
      // For recurring events: if promo is on parent event, it applies to all child events
      if (promo.event_id) {
        // Get the actual event ID we're purchasing (could be child or parent)
        // For virtual child events, we'll need to check parent_event_id after ensureChildEventExists
        // But for now, check if promo.event_id matches event.id or event.parent_event_id
        const isParentPromoForChildEvent = 
          promo.event_id === event?.parent_event_id || 
          promo.event_id === event?.id;
        
        if (!isParentPromoForChildEvent) {
        setPromoError('This code is not valid for this event')
        setPromoApplied(null)
        return
        }
      }
      
      // Check if promo has started
      if (promo.starts_at && new Date(promo.starts_at) > new Date()) {
        setPromoError('This promo code is not yet active')
        setPromoApplied(null)
        return
      }
      
      // Check if promo has expired
      if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
        setPromoError('This promo code has expired')
        setPromoApplied(null)
        return
      }
      
      // Check usage limit
      if (promo.max_uses && promo.times_used >= promo.max_uses) {
        setPromoError('This promo code has reached its usage limit')
        setPromoApplied(null)
        return
      }
      
      // Check minimum purchase amount
      if (promo.min_purchase_amount && totalAmount < promo.min_purchase_amount) {
        setPromoError('Minimum purchase of ' + formatPrice(promo.min_purchase_amount, event?.currency) + ' required')
        setPromoApplied(null)
        return
      }
      
      // Calculate discount
      let discountAmt = 0
      if (promo.discount_type === 'percentage') {
        discountAmt = Math.round(totalAmount * (promo.discount_value / 100))
        // Apply max discount cap if set
        if (promo.max_discount_amount && discountAmt > promo.max_discount_amount) {
          discountAmt = promo.max_discount_amount
        }
      } else {
        // Fixed amount discount
        discountAmt = Math.min(promo.discount_value, totalAmount)
      }
      
      setPromoApplied({
        ...promo,
        discountAmount: discountAmt
      })
      setPromoError('')
      
    } catch (err) {
      logger.error('Error applying promo', err)
      setPromoError('Failed to apply promo code. Please try again.')
    } finally {
      setApplyingPromo(false)
    }
  }
  
  // Remove promo code
  const removePromoCode = () => {
    setPromoCode('')
    setPromoApplied(null)
    setPromoError('')
  }

const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Button variant="ghost" className="mb-6 text-[#0F0F0F]/60 hover:text-[#0F0F0F]" onClick={() => navigate(-1)}>
        <ArrowLeft className="w-4 h-4 mr-2" />Back
      </Button>

      {/* Countdown Timer */}
      <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-600" />
          <span className="text-amber-800 font-medium">Complete checkout in:</span>
        </div>
        <span className={`text-xl font-bold ${timeLeft <= 60 ? "text-red-600" : "text-amber-800"}`}>
          {String(Math.floor(timeLeft / 60)).padStart(2, "0")}:{String(timeLeft % 60).padStart(2, "0")}
        </span>
      </div>

      <div className="mb-8">
        <h1 className="text-4xl font-bold text-[#0F0F0F] mb-2">Checkout</h1>
        <p className="text-[#0F0F0F]/60">Complete your ticket purchase</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-[#0F0F0F]/10 rounded-2xl">
            <CardHeader><CardTitle className="text-[#0F0F0F]">Contact Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {/* Toggle: Buying for self or someone else */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setBuyingForSelf(true)}
                  className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${
                    buyingForSelf 
                      ? 'border-[#2969FF] bg-[#2969FF]/5 text-[#2969FF]' 
                      : 'border-[#0F0F0F]/10 text-[#0F0F0F]/60 hover:border-[#0F0F0F]/20'
                  }`}
                >
                  <UserCheck className="w-5 h-5" />
                  <span className="font-medium">Tickets are for me</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBuyingForSelf(false)}
                  className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${
                    !buyingForSelf 
                      ? 'border-[#2969FF] bg-[#2969FF]/5 text-[#2969FF]' 
                      : 'border-[#0F0F0F]/10 text-[#0F0F0F]/60 hover:border-[#0F0F0F]/20'
                  }`}
                >
                  <User className="w-5 h-5" />
                  <span className="font-medium">Buying for someone else</span>
                </button>
              </div>

              {buyingForSelf ? (
                /* Read-only profile display for fast checkout */
                <div className="space-y-3 p-4 bg-[#F4F6FA] rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#2969FF] flex items-center justify-center text-white font-semibold">
                      {formData.firstName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <div>
                      <p className="font-semibold text-[#0F0F0F]">
                        {formData.firstName && formData.lastName 
                          ? `${formData.firstName} ${formData.lastName}` 
                          : 'Complete your profile'}
                      </p>
                      <p className="text-sm text-[#0F0F0F]/60">Ticket holder</p>
                    </div>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 text-sm">
                      <Mail className="w-4 h-4 text-[#0F0F0F]/40" />
                      <span className="text-[#0F0F0F]">{formData.email || 'No email set'}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <Phone className="w-4 h-4 text-[#0F0F0F]/40" />
                      <span className="text-[#0F0F0F]">{formData.phone || 'No phone set'}</span>
                    </div>
                  </div>
                  {(!formData.firstName || !formData.lastName || !formData.email) && (
                    <p className="text-sm text-amber-600 bg-amber-50 p-2 rounded-lg">
                      ⚠️ Please complete your profile to continue checkout
                    </p>
                  )}
                  <p className="text-xs text-[#0F0F0F]/50">Tickets will be sent to your email address</p>
                </div>
              ) : (
                /* Editable form for buying for someone else */
                <div className="space-y-4">
                  <div className="p-3 bg-blue-50 rounded-xl text-sm text-blue-700">
                    💡 Enter the ticket recipient's details below. They will receive the tickets.
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name *</Label>
                      <Input
                        id="firstName"
                        placeholder="John"
                        value={formData.firstName}
                        onChange={(e) => handleInputChange('firstName', e.target.value)}
                        className={`rounded-xl border-[#0F0F0F]/10 ${formErrors.firstName ? 'border-red-500' : ''}`}
                        required
                      />
                      {formErrors.firstName && <p className="text-xs text-red-500">{formErrors.firstName}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name *</Label>
                      <Input
                        id="lastName"
                        placeholder="Doe"
                        value={formData.lastName}
                        onChange={(e) => handleInputChange('lastName', e.target.value)}
                        className={`rounded-xl border-[#0F0F0F]/10 ${formErrors.lastName ? 'border-red-500' : ''}`}
                        required
                      />
                      {formErrors.lastName && <p className="text-xs text-red-500">{formErrors.lastName}</p>}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address *</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="their@email.com"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      className={`rounded-xl border-[#0F0F0F]/10 ${formErrors.email ? 'border-red-500' : ''}`}
                      required
                    />
                    {formErrors.email && <p className="text-xs text-red-500">{formErrors.email}</p>}
                    <p className="text-sm text-[#0F0F0F]/60">Tickets will be sent to this email</p>
                  </div>

                </div>
              )}
            </CardContent>
          </Card>

          {/* Custom Form Fields */}
          {customFields.length > 0 && (
            <Card className="border-[#0F0F0F]/10 rounded-2xl">
              <CardHeader><CardTitle className="text-[#0F0F0F]">Additional Information</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {customFields.map((field) => (
                  <div key={field.id} className="space-y-2">
                    <Label htmlFor={`custom-${field.id}`}>
                      {field.field_label} {field.is_required && <span className="text-red-500">*</span>}
                    </Label>
                    {field.field_type === 'text' && (
                      <Input
                        id={`custom-${field.id}`}
                        value={customFieldResponses[field.id] || ''}
                        onChange={(e) => setCustomFieldResponses(prev => ({ ...prev, [field.id]: e.target.value }))}
                        className="rounded-xl border-[#0F0F0F]/10"
                        required={field.is_required}
                      />
                    )}
                    {field.field_type === 'dropdown' && (
                      <select
                        id={`custom-${field.id}`}
                        value={customFieldResponses[field.id] || ''}
                        onChange={(e) => setCustomFieldResponses(prev => ({ ...prev, [field.id]: e.target.value }))}
                        className="w-full h-12 px-4 rounded-xl border border-[#0F0F0F]/10 bg-white"
                        required={field.is_required}
                      >
                        <option value="">Select an option</option>
                        {(field.field_options || []).map((option, idx) => (
                          <option key={idx} value={option}>{option}</option>
                        ))}
                      </select>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card className="border-[#0F0F0F]/10 rounded-2xl">
            <CardHeader><CardTitle className="text-[#0F0F0F]">Payment Method</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className={`grid gap-3 ${availablePaymentMethods.length === 1 ? 'grid-cols-1' : availablePaymentMethods.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                {availablePaymentMethods.map(({ id, label }) => {
                  const Icon = id === 'card' ? CreditCard : id === 'bank' ? Building2 : id === 'ussd' ? Smartphone : CreditCard;
                  return (
                    <button key={id} type="button" onClick={() => setPaymentMethod(id)} className={`p-4 border rounded-xl flex flex-col items-center gap-2 transition-all ${paymentMethod === id ? 'border-[#2969FF] bg-[#2969FF]/5' : 'border-[#0F0F0F]/10 hover:border-[#0F0F0F]/20'}`}>
                      <Icon className={`w-6 h-6 ${paymentMethod === id ? 'text-[#2969FF]' : 'text-[#0F0F0F]/60'}`} />
                      <span className={`text-sm ${paymentMethod === id ? 'text-[#2969FF]' : 'text-[#0F0F0F]/60'}`}>{label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="p-4 bg-[#F4F6FA] rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <Lock className="w-4 h-4 text-[#2969FF]" />
                  <p className="font-medium text-[#0F0F0F]">{getProviderInfo(event?.currency).description}</p>
                </div>
                <p className="text-sm text-[#0F0F0F]/60">
                  {paymentMethod === 'card' && (paymentProvider === 'stripe' ? 'Pay securely with Card, Apple Pay, or Google Pay.' : 'You will be redirected to enter your card details securely.')}
                  {paymentMethod === 'bank' && 'You will receive bank transfer details to complete payment.'}
                  {paymentMethod === 'ussd' && 'You will receive a USSD code to dial from your phone.'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card className="border-[#0F0F0F]/10 rounded-2xl sticky top-16 md:top-20 lg:top-24">
            <CardHeader><CardTitle className="text-[#0F0F0F]">Order Summary</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <div className="w-20 h-20 rounded-xl overflow-hidden bg-[#F4F6FA] flex-shrink-0">
                  <img src={event.image_url} alt={event.title} className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-[#0F0F0F] line-clamp-2">{event.title}</h3>
                  <div className="flex items-center gap-1 text-xs text-[#0F0F0F]/60 mt-1"><Calendar className="w-3 h-3" /><span>{formatDate(event.start_date)}</span></div>
                  <div className="flex items-center gap-1 text-xs text-[#0F0F0F]/60 mt-1"><MapPin className="w-3 h-3" /><span>{event.venue_name}</span></div>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                {ticketSummary.map((ticket, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span className="text-[#0F0F0F]/70">{ticket.name} × {ticket.quantity}</span>
                    <span className="text-[#0F0F0F]">{formatPrice(ticket.subtotal, event?.currency)}</span>
                  </div>
                ))}
              </div>

              <Separator />

              {/* Promo Code Input */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-[#0F0F0F]">Have a promo code?</p>
                {promoApplied ? (
                  <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-xl">
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-green-600" />
                      <span className="font-mono font-medium text-green-700">{promoApplied.code}</span>
                      <span className="text-sm text-green-600">
                        ({promoApplied.discount_type === 'percentage' ? promoApplied.discount_value + '% off' : formatPrice(promoApplied.discount_value, event?.currency) + ' off'})
                      </span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={removePromoCode} className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 px-2">
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter code"
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                      className="rounded-xl border-[#0F0F0F]/10 font-mono uppercase flex-1"
                      onKeyDown={(e) => e.key === 'Enter' && applyPromoCode()}
                    />
                    <Button 
                      variant="outline" 
                      onClick={applyPromoCode} 
                      disabled={applyingPromo || !promoCode.trim()}
                      className="rounded-xl border-[#0F0F0F]/10"
                    >
                      {applyingPromo ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
                    </Button>
                  </div>
                )}
                {promoError && <p className="text-sm text-red-500">{promoError}</p>}
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-[#0F0F0F]/60">Subtotal ({totalTicketCount} {totalTicketCount === 1 ? 'ticket' : 'tickets'})</span>
                  <span className="text-[#0F0F0F]">{formatPrice(totalAmount, event?.currency)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#0F0F0F]/60">Service Fee</span>
                  <span className="text-[#0F0F0F]">{formatPrice(serviceFee, event?.currency)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-green-600">Discount ({promoApplied?.code})</span>
                    <span className="text-green-600">-{formatPrice(discountAmount, event?.currency)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-bold text-lg">
                  <span className="text-[#0F0F0F]">Total</span>
                  <span className="text-[#2969FF]">{formatPrice(finalTotal, event?.currency)}</span>
                </div>
              </div>

              <Button
                className="w-full bg-[#2969FF] hover:bg-[#1a4fd8] text-white rounded-xl py-6 text-lg"
                onClick={handlePayment}
                disabled={loading || !formData.email || !formData.firstName || !formData.lastName || formErrors.email || formErrors.firstName || formErrors.lastName}
              >
                {loading ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Processing...</>
                ) : (
                  <><Lock className="w-5 h-5 mr-2" />Pay {formatPrice(finalTotal, event?.currency)}</>
                )}
              </Button>

              <div className="space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.communicationConsent}
                    onChange={(e) => setFormData(f => ({ ...f, communicationConsent: e.target.checked }))}
                    className="mt-0.5 w-4 h-4 rounded border-gray-300 text-[#2969FF] focus:ring-[#2969FF]"
                  />
                  <span className="text-xs text-[#0F0F0F]/60">
                    I agree to receive event updates, reminders, and promotional messages from the organizer via email, SMS, and WhatsApp. You can unsubscribe anytime.
                  </span>
                </label>
                <p className="text-xs text-center text-[#0F0F0F]/40">
                  By purchasing, you agree to our <a href="/terms" className="underline hover:text-[#2969FF]">Terms of Service</a> and <a href="/privacy" className="underline hover:text-[#2969FF]">Privacy Policy</a>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
