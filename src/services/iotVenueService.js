/**
 * IoT Smart Venue Management Service
 * Handles real-time sensor data, capacity monitoring, and venue analytics
 */

import { supabase } from '@/lib/supabase'
import { IOT_CONFIG } from '@/config/payments'

class IoTVenueService {
  constructor() {
    this.subscribers = new Map()
    this.sensorBuffers = new Map()
    this.capacityCache = new Map()
    this.isConnected = false
  }

  // =====================================================
  // REAL-TIME DATA PROCESSING
  // =====================================================

  /**
   * Initialize WebSocket connection for real-time updates
   */
  async initializeRealTimeUpdates(venueId) {
    try {
      const channel = supabase.channel(`venue-${venueId}`, {
        config: {
          presence: { key: `venue-${venueId}` },
          broadcast: { self: true }
        }
      })

      channel
        .on('broadcast', { event: 'sensor-update' }, ({ payload }) => {
          this.handleSensorUpdate(payload)
        })
        .on('broadcast', { event: 'capacity-update' }, ({ payload }) => {
          this.handleCapacityUpdate(payload)
        })
        .on('broadcast', { event: 'checkin-update' }, ({ payload }) => {
          this.handleCheckinUpdate(payload)
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            this.isConnected = true
            console.log('Connected to venue real-time updates')
          }
        })

      return channel
    } catch (error) {
      console.error('Failed to initialize real-time updates:', error)
      return null
    }
  }

  /**
   * Process incoming sensor data
   */
  async processSensorData(sensorData) {
    const { sensorId, readings, timestamp } = sensorData

    try {
      // Batch readings for efficiency
      const batchSize = IOT_CONFIG.realTime.batchSize
      const batches = []

      for (let i = 0; i < readings.length; i += batchSize) {
        batches.push(readings.slice(i, i + batchSize))
      }

      // Process batches
      for (const batch of batches) {
        const formattedReadings = batch.map(reading => ({
          sensor_id: sensorId,
          reading_type: reading.type,
          value: reading.value,
          unit: reading.unit,
          quality_score: reading.quality || 1.0,
          metadata: reading.metadata || {},
          reading_timestamp: timestamp || new Date().toISOString()
        }))

        const { error } = await supabase
          .from('sensor_readings')
          .insert(formattedReadings)

        if (error) {
          console.error('Failed to insert sensor readings:', error)
          return false
        }
      }

      // Update sensor last seen
      await supabase
        .from('iot_sensors')
        .update({
          last_seen: timestamp || new Date().toISOString(),
          battery_level: sensorData.batteryLevel,
          updated_at: new Date().toISOString()
        })
        .eq('id', sensorId)

      // Process specific reading types
      await this.processReadingsByType(readings, sensorId)

      // Broadcast updates to subscribers
      this.broadcastSensorUpdate(sensorData)

      return true
    } catch (error) {
      console.error('Failed to process sensor data:', error)
      return false
    }
  }

  /**
   * Process readings based on type (occupancy, environmental, etc.)
   */
  async processReadingsByType(readings, sensorId) {
    for (const reading of readings) {
      switch (reading.type) {
        case 'occupancy_count':
          await this.updateCapacityFromOccupancy(sensorId, reading.value)
          break
        case 'temperature':
        case 'humidity':
        case 'co2_level':
          await this.updateEnvironmentalData(sensorId, reading)
          break
        case 'motion_detected':
          await this.handleMotionDetection(sensorId, reading)
          break
        case 'beacon_signal':
          await this.handleBeaconDetection(sensorId, reading)
          break
      }
    }
  }

  // =====================================================
  // CAPACITY MANAGEMENT
  // =====================================================

  /**
   * Update venue capacity based on occupancy sensors
   */
  async updateCapacityFromOccupancy(sensorId, occupancyCount) {
    try {
      // Get sensor details
      const { data: sensor } = await supabase
        .from('iot_sensors')
        .select(`
          id,
          venue_id,
          zone_id,
          configuration
        `)
        .eq('id', sensorId)
        .single()

      if (!sensor) return

      // Get zone capacity
      const { data: zone } = await supabase
        .from('venue_zones')
        .select('capacity')
        .eq('id', sensor.zone_id)
        .single()

      const maxCapacity = zone?.capacity || sensor.configuration?.maxCapacity || 100
      const utilizationRate = (occupancyCount / maxCapacity) * 100

      // Update capacity
      const { error } = await supabase
        .from('venue_capacity')
        .upsert({
          venue_id: sensor.venue_id,
          zone_id: sensor.zone_id,
          current_occupancy: occupancyCount,
          max_capacity: maxCapacity,
          utilization_rate: Math.min(utilizationRate, 100),
          last_updated: new Date().toISOString(),
          updated_by_sensor: sensorId
        }, {
          onConflict: 'venue_id,zone_id'
        })

      if (!error) {
        // Cache and broadcast
        const cacheKey = `${sensor.venue_id}-${sensor.zone_id}`
        this.capacityCache.set(cacheKey, {
          occupancy: occupancyCount,
          capacity: maxCapacity,
          utilization: utilizationRate,
          updated: new Date()
        })

        this.broadcastCapacityUpdate(sensor.venue_id, sensor.zone_id, {
          occupancy: occupancyCount,
          capacity: maxCapacity,
          utilization: utilizationRate
        })
      }
    } catch (error) {
      console.error('Failed to update capacity:', error)
    }
  }

  /**
   * Get real-time capacity for venue/zone
   */
  async getVenueCapacity(venueId, zoneId = null) {
    try {
      let query = supabase
        .from('venue_capacity')
        .select('*')
        .eq('venue_id', venueId)

      if (zoneId) {
        query = query.eq('zone_id', zoneId)
      }

      const { data, error } = await query

      if (error) throw error

      return data?.map(capacity => ({
        zoneId: capacity.zone_id,
        currentOccupancy: capacity.current_occupancy,
        maxCapacity: capacity.max_capacity,
        utilizationRate: capacity.utilization_rate,
        lastUpdated: capacity.last_updated
      })) || []
    } catch (error) {
      console.error('Failed to get venue capacity:', error)
      return []
    }
  }

  // =====================================================
  // SMART CHECK-IN SYSTEM
  // =====================================================

  /**
   * Process smart check-in from IoT devices
   */
  async processSmartCheckin(checkinData) {
    const {
      ticketId,
      eventId,
      attendeeId,
      venueId,
      zoneId,
      method,
      sensorId,
      deviceInfo,
      locationAccuracy
    } = checkinData

    try {
      // Verify ticket validity
      const { data: ticket } = await supabase
        .from('tickets')
        .select('status, event_id')
        .eq('id', ticketId)
        .eq('user_id', attendeeId)
        .single()

      if (!ticket || ticket.status !== 'valid') {
        throw new Error('Invalid ticket')
      }

      if (ticket.event_id !== eventId) {
        throw new Error('Ticket not for this event')
      }

      // Check for existing check-in
      const { data: existingCheckin } = await supabase
        .from('smart_checkins')
        .select('id')
        .eq('ticket_id', ticketId)
        .eq('event_id', eventId)
        .is('checkout_timestamp', null)
        .single()

      if (existingCheckin) {
        // Update checkout time (re-entry or exit)
        await supabase
          .from('smart_checkins')
          .update({
            checkout_timestamp: new Date().toISOString()
          })
          .eq('id', existingCheckin.id)

        // Calculate duration
        const checkinTime = new Date(existingCheckin.checkin_timestamp)
        const checkoutTime = new Date()
        const durationMinutes = Math.round((checkoutTime - checkinTime) / (1000 * 60))

        await supabase
          .from('smart_checkins')
          .update({ duration_minutes: durationMinutes })
          .eq('id', existingCheckin.id)

        return { type: 'checkout', duration: durationMinutes }
      } else {
        // New check-in
        const { data, error } = await supabase
          .from('smart_checkins')
          .insert({
            ticket_id: ticketId,
            event_id: eventId,
            attendee_id: attendeeId,
            venue_id: venueId,
            zone_id: zoneId,
            checkin_method: method,
            sensor_id: sensorId,
            device_info: deviceInfo,
            location_accuracy: locationAccuracy
          })
          .select()
          .single()

        if (error) throw error

        // Update ticket status to checked_in
        await supabase
          .from('tickets')
          .update({ status: 'checked_in' })
          .eq('id', ticketId)

        // Broadcast check-in event
        this.broadcastCheckinUpdate(venueId, {
          ticketId,
          attendeeId,
          zoneId,
          method,
          timestamp: data.checkin_timestamp
        })

        return { type: 'checkin', checkinId: data.id }
      }
    } catch (error) {
      console.error('Smart check-in failed:', error)
      throw error
    }
  }

  // =====================================================
  // ENVIRONMENTAL MONITORING
  // =====================================================

  /**
   * Update environmental data
   */
  async updateEnvironmentalData(sensorId, reading) {
    try {
      const { data: sensor } = await supabase
        .from('iot_sensors')
        .select('venue_id, zone_id')
        .eq('id', sensorId)
        .single()

      if (!sensor) return

      const envData = {
        venue_id: sensor.venue_id,
        zone_id: sensor.zone_id,
        sensor_id: sensorId,
        recorded_at: new Date().toISOString()
      }

      // Map reading types to database columns
      switch (reading.type) {
        case 'temperature':
          envData.temperature = reading.value
          break
        case 'humidity':
          envData.humidity = reading.value
          break
        case 'co2_level':
          envData.co2_level = reading.value
          break
        case 'voc_level':
          envData.voc_level = reading.value
          break
        case 'noise_level':
          envData.noise_level = reading.value
          break
        case 'air_pressure':
          envData.air_pressure = reading.value
          break
        case 'light_level':
          envData.light_level = reading.value
          break
      }

      const { error } = await supabase
        .from('environmental_data')
        .insert(envData)

      if (error) {
        console.error('Failed to insert environmental data:', error)
      }
    } catch (error) {
      console.error('Failed to update environmental data:', error)
    }
  }

  /**
   * Get environmental conditions for venue
   */
  async getEnvironmentalData(venueId, hours = 24) {
    try {
      const cutoffTime = new Date()
      cutoffTime.setHours(cutoffTime.getHours() - hours)

      const { data, error } = await supabase
        .from('environmental_data')
        .select(`
          *,
          venue_zones (name),
          iot_sensors (sensor_type)
        `)
        .eq('venue_id', venueId)
        .gte('recorded_at', cutoffTime.toISOString())
        .order('recorded_at', { ascending: false })

      if (error) throw error

      return data || []
    } catch (error) {
      console.error('Failed to get environmental data:', error)
      return []
    }
  }

  // =====================================================
  // PREDICTIVE MAINTENANCE
  // =====================================================

  /**
   * Analyze sensor data for maintenance predictions
   */
  async analyzeMaintenanceNeeds(venueId) {
    try {
      const alerts = []

      // Check for equipment issues based on sensor readings
      const recentReadings = await supabase
        .from('sensor_readings')
        .select(`
          *,
          iot_sensors (
            id,
            sensor_type,
            venue_equipment (
              id,
              equipment_type,
              status
            )
          )
        `)
        .eq('iot_sensors.venue_id', venueId)
        .gte('reading_timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours

      // Analyze patterns and create alerts
      for (const reading of recentReadings || []) {
        const equipment = reading.iot_sensors?.venue_equipment
        if (!equipment) continue

        // Check for abnormal readings
        const alert = this.detectAnomalies(reading, equipment)
        if (alert) {
          alerts.push(alert)
        }
      }

      // Insert alerts
      if (alerts.length > 0) {
        const { error } = await supabase
          .from('maintenance_alerts')
          .insert(alerts)

        if (error) {
          console.error('Failed to insert maintenance alerts:', error)
        }
      }

      return alerts
    } catch (error) {
      console.error('Failed to analyze maintenance needs:', error)
      return []
    }
  }

  /**
   * Detect anomalies in sensor readings
   */
  detectAnomalies(reading, equipment) {
    const { reading_type, value } = reading

    // Define normal ranges for different sensor types
    const normalRanges = {
      temperature: { min: 15, max: 30 },
      humidity: { min: 30, max: 70 },
      noise_level: { min: 0, max: 85 },
      vibration: { min: 0, max: 5 }
    }

    const range = normalRanges[reading_type]
    if (!range) return null

    if (value < range.min || value > range.max) {
      return {
        equipment_id: equipment.id,
        venue_id: equipment.venue_id,
        alert_type: value > range.max * 1.5 ? 'emergency' : 'preventive',
        severity: value > range.max * 1.2 ? 'high' : 'medium',
        title: `${equipment.equipment_type} ${reading_type} anomaly`,
        description: `${reading_type} reading of ${value} is outside normal range (${range.min}-${range.max})`,
        sensor_data: { reading_type, value, timestamp: reading.reading_timestamp },
        recommended_action: `Inspect ${equipment.equipment_type} and perform maintenance if needed`
      }
    }

    return null
  }

  // =====================================================
  // REAL-TIME SUBSCRIPTIONS & BROADCASTING
  // =====================================================

  /**
   * Subscribe to venue updates
   */
  subscribeToVenueUpdates(venueId, callback) {
    if (!this.subscribers.has(venueId)) {
      this.subscribers.set(venueId, new Set())
    }
    this.subscribers.get(venueId).add(callback)

    // Return unsubscribe function
    return () => {
      const subscribers = this.subscribers.get(venueId)
      if (subscribers) {
        subscribers.delete(callback)
        if (subscribers.size === 0) {
          this.subscribers.delete(venueId)
        }
      }
    }
  }

  /**
   * Broadcast sensor updates to subscribers
   */
  broadcastSensorUpdate(data) {
    const subscribers = this.subscribers.get(data.venueId)
    if (subscribers) {
      subscribers.forEach(callback => {
        try {
          callback({ type: 'sensor', data })
        } catch (error) {
          console.error('Subscriber callback error:', error)
        }
      })
    }
  }

  /**
   * Broadcast capacity updates
   */
  broadcastCapacityUpdate(venueId, zoneId, data) {
    const subscribers = this.subscribers.get(venueId)
    if (subscribers) {
      subscribers.forEach(callback => {
        try {
          callback({ type: 'capacity', zoneId, data })
        } catch (error) {
          console.error('Subscriber callback error:', error)
        }
      })
    }
  }

  /**
   * Broadcast check-in updates
   */
  broadcastCheckinUpdate(venueId, data) {
    const subscribers = this.subscribers.get(venueId)
    if (subscribers) {
      subscribers.forEach(callback => {
        try {
          callback({ type: 'checkin', data })
        } catch (error) {
          console.error('Subscriber callback error:', error)
        }
      })
    }
  }

  // =====================================================
  // ANALYTICS & REPORTING
  // =====================================================

  /**
   * Generate venue analytics for an event
   */
  async generateVenueAnalytics(eventId) {
    try {
      const { data: event } = await supabase
        .from('events')
        .select('id, venue_id, start_date, end_date')
        .eq('id', eventId)
        .single()

      if (!event?.venue_id) return null

      // Get capacity data
      const { data: capacityData } = await supabase
        .from('venue_capacity')
        .select('*')
        .eq('venue_id', event.venue_id)
        .gte('last_updated', event.start_date)
        .lte('last_updated', event.end_date)

      // Get check-in data
      const { data: checkinData } = await supabase
        .from('smart_checkins')
        .select('*')
        .eq('event_id', eventId)

      // Calculate analytics
      const analytics = {
        eventId,
        venueId: event.venue_id,
        date: new Date().toISOString().split('T')[0],
        peakOccupancy: Math.max(...(capacityData?.map(c => c.current_occupancy) || [0])),
        averageOccupancy: capacityData?.length ?
          capacityData.reduce((sum, c) => sum + c.current_occupancy, 0) / capacityData.length : 0,
        totalCheckins: checkinData?.length || 0,
        averageDwellTime: checkinData?.length ?
          checkinData.reduce((sum, c) => sum + (c.duration_minutes || 0), 0) / checkinData.length : 0
      }

      // Store analytics
      const { error } = await supabase
        .from('venue_analytics')
        .insert(analytics)

      if (error) {
        console.error('Failed to store venue analytics:', error)
      }

      return analytics
    } catch (error) {
      console.error('Failed to generate venue analytics:', error)
      return null
    }
  }

  // =====================================================
  // UTILITY METHODS
  // =====================================================

  /**
   * Get venue sensor status
   */
  async getVenueSensorStatus(venueId) {
    try {
      const { data, error } = await supabase
        .from('iot_sensors')
        .select(`
          id,
          sensor_type,
          device_id,
          status,
          battery_level,
          last_seen,
          venue_zones (name)
        `)
        .eq('venue_id', venueId)
        .order('last_seen', { ascending: false })

      if (error) throw error

      return data?.map(sensor => ({
        id: sensor.id,
        type: sensor.sensor_type,
        deviceId: sensor.device_id,
        status: sensor.status,
        batteryLevel: sensor.battery_level,
        lastSeen: sensor.last_seen,
        zone: sensor.venue_zones?.name,
        isOnline: sensor.last_seen &&
          new Date() - new Date(sensor.last_seen) < 5 * 60 * 1000 // 5 minutes
      })) || []
    } catch (error) {
      console.error('Failed to get sensor status:', error)
      return []
    }
  }

  /**
   * Handle motion detection events
   */
  async handleMotionDetection(sensorId, reading) {
    // Could trigger security alerts, lighting automation, etc.
    console.log(`Motion detected by sensor ${sensorId}`)
  }

  /**
   * Handle beacon proximity detection
   */
  async handleBeaconDetection(sensorId, reading) {
    // Could be used for location-based services, navigation, etc.
    console.log(`Beacon signal detected by sensor ${sensorId}`)
  }
}

// Export singleton instance
export const iotVenueService = new IoTVenueService()
export default iotVenueService