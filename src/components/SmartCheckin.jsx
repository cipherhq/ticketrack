/**
 * Smart Check-in Component
 * Handles IoT-based check-ins via NFC, Bluetooth beacons, or QR codes
 */

import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { CheckCircle, XCircle, Loader2, Smartphone, Zap, QrCode } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'
import { iotVenueService } from '@/services/iotVenueService'

export function SmartCheckin() {
  const { eventId } = useParams()
  const [searchParams] = useSearchParams()
  const ticketId = searchParams.get('ticket')

  const [status, setStatus] = useState('scanning') // scanning, success, error, checked_out
  const [message, setMessage] = useState('')
  const [checkinData, setCheckinData] = useState(null)
  const [event, setEvent] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    if (eventId) {
      loadEvent()
    }
  }, [eventId])

  useEffect(() => {
    if (ticketId && event) {
      handleTicketCheckin(ticketId)
    }
  }, [ticketId, event])

  const loadEvent = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select(`
          id,
          title,
          venue_id,
          venues (
            name,
            iot_enabled
          )
        `)
        .eq('id', eventId)
        .single()

      if (error) throw error
      setEvent(data)
    } catch (error) {
      console.error('Failed to load event:', error)
      setStatus('error')
      setMessage('Event not found')
    }
  }

  const handleTicketCheckin = async (ticketId) => {
    if (isProcessing) return

    setIsProcessing(true)
    setStatus('processing')
    setMessage('Validating ticket...')

    try {
      // Get ticket details
      const { data: ticket, error: ticketError } = await supabase
        .from('tickets')
        .select(`
          id,
          status,
          user_id,
          event_id,
          ticket_type_id,
          ticket_types (name),
          events (
            id,
            title,
            venue_id,
            venues (
              id,
              iot_enabled
            )
          )
        `)
        .eq('id', ticketId)
        .single()

      if (ticketError || !ticket) {
        throw new Error('Invalid ticket')
      }

      if (ticket.event_id !== eventId) {
        throw new Error('Ticket is not for this event')
      }

      // Check current check-in status
      const { data: existingCheckin } = await supabase
        .from('smart_checkins')
        .select('*')
        .eq('ticket_id', ticketId)
        .eq('event_id', eventId)
        .is('checkout_timestamp', null)
        .single()

      if (existingCheckin) {
        // Handle check-out
        const result = await iotVenueService.processSmartCheckin({
          ticketId,
          eventId,
          attendeeId: ticket.user_id,
          venueId: ticket.events.venue_id,
          zoneId: existingCheckin.zone_id,
          method: 'manual',
          sensorId: null,
          deviceInfo: { userAgent: navigator.userAgent, platform: navigator.platform },
          locationAccuracy: null
        })

        if (result.type === 'checkout') {
          setStatus('checked_out')
          setMessage(`Checked out successfully! You were here for ${result.duration} minutes.`)
          setCheckinData({
            ...existingCheckin,
            duration: result.duration,
            checkoutTime: new Date().toISOString()
          })
        }
      } else {
        // Handle check-in
        const result = await iotVenueService.processSmartCheckin({
          ticketId,
          eventId,
          attendeeId: ticket.user_id,
          venueId: ticket.events.venue_id,
          zoneId: null, // Default to main entrance
          method: 'qr_code', // Since this is manual via QR
          sensorId: null,
          deviceInfo: { userAgent: navigator.userAgent, platform: navigator.platform },
          locationAccuracy: null
        })

        if (result.type === 'checkin') {
          setStatus('success')
          setMessage(`Welcome to ${ticket.events.title}!`)
          setCheckinData({
            checkinId: result.checkinId,
            ticketType: ticket.ticket_types?.name || 'Ticket',
            checkinTime: new Date().toISOString()
          })
        }
      }

    } catch (error) {
      console.error('Check-in error:', error)
      setStatus('error')
      setMessage(error.message || 'Check-in failed. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleManualCheckin = () => {
    // This would typically be triggered by scanning a QR code
    // For demo purposes, we'll simulate with a prompt
    const ticketCode = prompt('Enter ticket code or ID:')
    if (ticketCode) {
      handleTicketCheckin(ticketCode)
    }
  }

  const renderStatusIcon = () => {
    switch (status) {
      case 'processing':
        return <Loader2 className="w-16 h-16 text-blue-500 animate-spin" />
      case 'success':
        return <CheckCircle className="w-16 h-16 text-green-500" />
      case 'checked_out':
        return <CheckCircle className="w-16 h-16 text-blue-500" />
      case 'error':
        return <XCircle className="w-16 h-16 text-red-500" />
      default:
        return <Smartphone className="w-16 h-16 text-gray-400" />
    }
  }

  const renderStatusMessage = () => {
    switch (status) {
      case 'scanning':
        return (
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">Ready to Check In</h2>
            <p className="text-gray-600 mb-4">Use your phone's NFC, scan QR code, or tap to check in manually</p>
            <div className="flex justify-center gap-4 mb-4">
              <Badge variant="outline" className="flex items-center gap-1">
                <Zap className="w-3 h-3" />
                NFC
              </Badge>
              <Badge variant="outline" className="flex items-center gap-1">
                <QrCode className="w-3 h-3" />
                QR Code
              </Badge>
            </div>
            <Button onClick={handleManualCheckin} variant="outline">
              Manual Check-in
            </Button>
          </div>
        )
      case 'processing':
        return (
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">Processing...</h2>
            <p className="text-gray-600">{message}</p>
          </div>
        )
      case 'success':
        return (
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2 text-green-600">Check-in Successful!</h2>
            <p className="text-gray-600 mb-4">{message}</p>
            {checkinData && (
              <div className="bg-green-50 p-4 rounded-lg mb-4">
                <p className="font-medium">{checkinData.ticketType}</p>
                <p className="text-sm text-gray-600">
                  Checked in at {new Date(checkinData.checkinTime).toLocaleTimeString()}
                </p>
              </div>
            )}
            <p className="text-sm text-gray-500">Enjoy the event!</p>
          </div>
        )
      case 'checked_out':
        return (
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2 text-blue-600">Checked Out</h2>
            <p className="text-gray-600 mb-4">{message}</p>
            {checkinData && (
              <div className="bg-blue-50 p-4 rounded-lg mb-4">
                <p className="font-medium">Session Summary</p>
                <p className="text-sm text-gray-600">
                  Duration: {Math.floor(checkinData.duration / 60)}h {checkinData.duration % 60}m
                </p>
              </div>
            )}
            <p className="text-sm text-gray-500">Thanks for attending!</p>
          </div>
        )
      case 'error':
        return (
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2 text-red-600">Check-in Failed</h2>
            <p className="text-gray-600 mb-4">{message}</p>
            <Button onClick={() => setStatus('scanning')} variant="outline">
              Try Again
            </Button>
          </div>
        )
    }
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
            <p>Loading event...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-lg">
            {event.title}
          </CardTitle>
          <p className="text-sm text-gray-600">
            {event.venues?.iot_enabled ? 'Smart Venue Check-in' : 'Standard Check-in'}
          </p>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex flex-col items-center space-y-6">
            {renderStatusIcon()}
            {renderStatusMessage()}

            {event.venues?.iot_enabled && status === 'scanning' && (
              <div className="w-full bg-blue-50 p-4 rounded-lg text-center">
                <p className="text-sm text-blue-700 font-medium mb-1">IoT Features Available</p>
                <p className="text-xs text-blue-600">
                  NFC, Bluetooth beacons, and environmental monitoring active
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}