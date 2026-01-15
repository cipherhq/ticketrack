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
import { formatPrice } from '@/config/currencies'
import { generateTicketPDFBase64, generateMultiTicketPDFBase64 } from '@/utils/ticketGenerator'
import { getRSVPSettings, checkRSVPLimit } from '@/services/settings'
import { getPaymentProvider } from '@/config/payments'

// Send confirmation email via Edge Function
const sendConfirmationEmail = async (emailData) => {
  try {
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
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

// Credit promoter for referral
const creditPromoter = async (orderId, eventId, saleAmount, ticketCount) => {
  try {
    const refCode = localStorage.getItem('referral_code')
    if (!refCode || !/^[A-Za-z0-9-]+$/.test(refCode)) return
    
    const { data: promoter } = await supabase
      .from('promoters')
      .select('id, commission_type, commission_value, commission_rate')
      .or(`short_code.eq.${refCode},referral_code.eq.${refCode}`)
      .single()
    
    if (!promoter) return
    
    const commissionRate = promoter.commission_value || promoter.commission_rate || 10
    const commissionType = promoter.commission_type || 'percentage'
    let commissionAmount = 0
    
    if (commissionType === 'percentage') {
      commissionAmount = (saleAmount * commissionRate) / 100
    } else {
      commissionAmount = commissionRate * ticketCount
    }
    
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
    
    await supabase.rpc('update_promoter_sales', { 
      p_promoter_id: promoter.id,
      p_sale_amount: saleAmount,
      p_commission: commissionAmount,
      p_ticket_count: ticketCount
    })
    
    localStorage.removeItem('referral_code')
    localStorage.removeItem('referral_event_id')
  } catch (err) {
    console.error('Error crediting promoter:', err)
  }
}

export function WebFreeRSVP() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  
  const { event } = location.state || {}
  
  // Form state
  const [formData, setFormData] = useState({
    email: '',
    phone: '',
    firstName: '',
    lastName: ''
  })
  
  // RSVP state
  const [quantity, setQuantity] = useState(1)
  const [maxQuantity, setMaxQuantity] = useState(10)
  const [rsvpLimit, setRsvpLimit] = useState(null)
  
  // Donation state
  const [donationAmount, setDonationAmount] = useState(0)
  const [customDonation, setCustomDonation] = useState('')
  
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
      if (!event || !user) return
      
      try {
        // Get platform settings
        const rsvpSettings = await getRSVPSettings()
        setSettings(rsvpSettings)
        
        // Check existing RSVPs for this user/event
        const limitCheck = await checkRSVPLimit(event.id, user.email)
        setRsvpLimit(limitCheck)
        
        // Set max quantity based on limits
        const maxFromSettings = Math.min(rsvpSettings.maxTicketsPerOrder, limitCheck.remaining)
        setMaxQuantity(maxFromSettings)
        
        // If already at limit, show error
        if (!limitCheck.allowed) {
          setError(`You've already registered ${limitCheck.current} time(s) for this event (max ${limitCheck.max}).`)
        }
        
        setSettingsLoaded(true)
      } catch (err) {
        console.error('Error loading settings:', err)
        setSettingsLoaded(true)
      }
    }
    loadSettings()
  }, [event, user])

  // Generate unique ticket code
  const generateTicketCode = (index) => {
    const timestamp = Date.now().toString(36).toUpperCase()
    const random = Math.random().toString(36).substring(2, 6).toUpperCase()
    return `TKT${timestamp}${random}${index}`
  }

  // Handle free RSVP (no donation)
  const handleFreeRSVP = async () => {
    if (!validateForm()) return
    
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
      
      if (quantity > limitCheck.remaining) {
        setError(`You can only register ${limitCheck.remaining} more time(s) for this event.`)
        setLoading(false)
        return
      }

      // Create order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: user.id,
          event_id: event.id,
          order_number: `RSVP${Date.now().toString(36).toUpperCase()}`,
          status: settings.freeEventOrderStatus,
          subtotal: 0,
          platform_fee: 0,
          tax_amount: 0,
          discount_amount: 0,
          total_amount: 0,
          currency: event?.currency || 'NGN',
          payment_method: 'free',
          payment_provider: 'none',
          buyer_email: formData.email,
          buyer_phone: formData.phone || null,
          buyer_name: `${formData.firstName} ${formData.lastName}`,
          paid_at: new Date().toISOString()
        })
        .select()
        .single()

      if (orderError) throw orderError

      // Create tickets (one per quantity)
      const ticketsToCreate = []
      for (let i = 0; i < quantity; i++) {
        ticketsToCreate.push({
          event_id: event.id,
          user_id: user.id,
          ticket_type_id: null, // Free admission
          attendee_email: formData.email,
          attendee_name: `${formData.firstName} ${formData.lastName}`,
          attendee_phone: formData.phone || null,
          ticket_code: generateTicketCode(i),
          qr_code: generateTicketCode(i),
          unit_price: 0,
          total_price: 0,
          payment_reference: 'FREE',
          payment_status: 'free',
          payment_method: 'free',
          status: 'active'
        })
      }

      const { data: tickets, error: ticketsError } = await supabase
        .from('tickets')
        .insert(ticketsToCreate)
        .select()

      if (ticketsError) throw ticketsError

      // Credit promoter (even for free, track conversion)
      await creditPromoter(order.id, event.id, 0, quantity)

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
            venueName: event.venue_name || "TBA",
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
            venueName: event.venue_name || "TBA",
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

      // Navigate to success
      navigate('/payment-success', {
        state: { order, event, tickets, reference: 'FREE' }
      })

    } catch (err) {
      console.error('RSVP error:', err)
      setError(err.message || 'An error occurred. Please try again.')
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
      const currency = event?.currency || 'NGN'
      const paymentProvider = getPaymentProvider(currency)

      // Create pending order with donation
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: user.id,
          event_id: event.id,
          order_number: `DON${Date.now().toString(36).toUpperCase()}`,
          status: 'pending',
          subtotal: 0,
          platform_fee: 0,
          tax_amount: 0,
          discount_amount: 0,
          total_amount: actualDonation,
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

      const paymentRef = `DON-${order.id.slice(0, 8).toUpperCase()}-${Date.now()}`

      // Use appropriate payment provider based on currency
      if (paymentProvider === 'stripe') {
        // Use Stripe Checkout for GBP, USD, CAD donations
        try {
          const { data: checkoutData, error: stripeError } = await supabase.functions.invoke('create-stripe-checkout', {
            body: {
              orderId: order.id,
              successUrl: `${window.location.origin}/payment-success?order_id=${order.id}&reference=${paymentRef}`,
              cancelUrl: `${window.location.origin}/event/${event.slug}`,
              isDonation: true,
              donationAmount: actualDonation
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
            amount: actualDonation * 100,
            currency: currency,
            ref: paymentRef,
            metadata: {
              order_id: order.id,
              event_id: event.id,
              event_name: event.title,
              type: 'donation',
              is_donation: true,
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
      console.error('Donation RSVP error:', err)
      setError(err.message || 'An error occurred. Please try again.')
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
          ticket_code: generateTicketCode(i),
          qr_code: generateTicketCode(i),
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
      await creditPromoter(order.id, event.id, actualDonation, quantity)

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
            venueName: event.venue_name || "TBA",
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
            venueName: event.venue_name || "TBA",
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
          ticket_code: generateTicketCode(i),
          qr_code: generateTicketCode(i),
          unit_price: 0,
          total_price: 0,
          payment_reference: 'FREE',
          payment_status: 'free',
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
            venueName: event.venue_name || "TBA",
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
            venueName: event.venue_name || "TBA",
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

    if (quantity < 1 || quantity > maxQuantity) {
      setError(`Please select between 1 and ${maxQuantity} tickets.`)
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
        className="mb-6 text-[#0F0F0F]/60 hover:text-[#0F0F0F]" 
        onClick={() => navigate(-1)}
      >
        <ArrowLeft className="w-4 h-4 mr-2" />Back
      </Button>

      <div className="mb-8">
        <h1 className="text-4xl font-bold text-[#0F0F0F] mb-2">Register for Free Event</h1>
        <p className="text-[#0F0F0F]/60">Complete your free registration for {event.title}</p>
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
          <Card className="border-[#0F0F0F]/10 rounded-2xl">
            <CardHeader>
              <CardTitle className="text-[#0F0F0F]">Contact Information</CardTitle>
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
                    className="rounded-xl border-[#0F0F0F]/10" 
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
                    className="rounded-xl border-[#0F0F0F]/10" 
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
                  className="rounded-xl border-[#0F0F0F]/10" 
                  disabled={atLimit}
                  required 
                />
                <p className="text-sm text-[#0F0F0F]/60">Confirmation will be sent to this email</p>
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
                  <h3 className="font-semibold text-[#0F0F0F]">Free Event</h3>
                  <p className="text-sm text-[#0F0F0F]/60">No payment required - just fill in your details</p>
                </div>
              </div>
              
              {/* Quantity Selector */}
              <div className="pt-4 border-t border-green-200">
                <Label className="text-[#0F0F0F] font-medium mb-2 block">Number of RSVPs</Label>
                <div className="flex items-center gap-3">
                  <button 
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-10 h-10 rounded-lg border border-green-300 flex items-center justify-center text-green-700 hover:bg-green-100 transition-colors disabled:opacity-50"
                    disabled={quantity <= 1 || atLimit}
                  >
                    -
                  </button>
                  <span className="w-12 text-center text-xl font-bold text-[#0F0F0F]">{quantity}</span>
                  <button 
                    type="button"
                    onClick={() => setQuantity(Math.min(maxQuantity, quantity + 1))}
                    className="w-10 h-10 rounded-lg border border-green-300 flex items-center justify-center text-green-700 hover:bg-green-100 transition-colors disabled:opacity-50"
                    disabled={quantity >= maxQuantity || atLimit}
                  >
                    +
                  </button>
                  <span className="text-sm text-[#0F0F0F]/60 ml-2">(max {maxQuantity})</span>
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
                  <Label className="text-[#0F0F0F] font-medium mb-2 block flex items-center gap-2">
                    <span>💝</span> Support This Event (Optional)
                  </Label>
                  <p className="text-sm text-[#0F0F0F]/60 mb-3">Your donation helps make this event possible</p>
                  
                  <div className="flex flex-wrap gap-2 mb-3">
                    <button
                      type="button"
                      onClick={() => { setDonationAmount(0); setCustomDonation(''); }}
                      className={`px-4 py-2 rounded-lg font-medium transition-all ${
                        donationAmount === 0 && !customDonation
                          ? 'bg-gray-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
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
                      <span className="text-[#0F0F0F]/60 text-sm">Custom:</span>
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
          <Card className="border-[#0F0F0F]/10 rounded-2xl sticky top-16 md:top-20 lg:top-24">
            <CardHeader>
              <CardTitle className="text-[#0F0F0F]">Registration Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Event Info */}
              <div className="flex gap-4">
                <div className="w-20 h-20 rounded-xl overflow-hidden bg-[#F4F6FA] flex-shrink-0">
                  <img 
                    src={event.image_url} 
                    alt={event.title} 
                    className="w-full h-full object-cover" 
                    onError={(e) => { e.target.style.display = 'none' }} 
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-[#0F0F0F] line-clamp-2">{event.title}</h3>
                  <div className="flex items-center gap-1 text-xs text-[#0F0F0F]/60 mt-1">
                    <Calendar className="w-3 h-3" />
                    <span>{formatDate(event.start_date)}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-[#0F0F0F]/60 mt-1">
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
                  <span className="text-[#0F0F0F]/70">Free Admission × {quantity}</span>
                  <span className="text-[#0F0F0F]">Free</span>
                </div>
                
                {actualDonation > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-green-600 flex items-center gap-1">💝 Donation</span>
                    <span className="text-green-600 font-medium">
                      {formatPrice(actualDonation, event?.currency)}
                    </span>
                  </div>
                )}
              </div>

              <Separator />

              <div className="flex justify-between font-bold text-lg">
                <span className="text-[#0F0F0F]">Total</span>
                <span className={actualDonation > 0 ? "text-green-600" : "text-[#0F0F0F]"}>
                  {actualDonation > 0 ? formatPrice(actualDonation, event?.currency) : 'Free'}
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
                  <><CheckCircle className="w-5 h-5 mr-2" />RSVP & Donate {formatPrice(actualDonation, event?.currency)}</>
                ) : (
                  <><CheckCircle className="w-5 h-5 mr-2" />Complete Registration</>
                )}
              </Button>

              <p className="text-xs text-center text-[#0F0F0F]/40">
                By registering, you agree to our Terms of Service
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
