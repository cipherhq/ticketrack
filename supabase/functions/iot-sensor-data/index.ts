/**
 * IoT Sensor Data Ingestion Endpoint
 * Receives and processes sensor data from IoT devices
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SENSOR_API_KEY = Deno.env.get('SENSOR_API_KEY') || 'ticketrack-sensor-2024'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-sensor-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed" }),
      { status: 405, headers: corsHeaders }
    )
  }

  try {
    // Validate sensor API key
    const sensorKey = req.headers.get('x-sensor-key')
    if (!sensorKey || sensorKey !== SENSOR_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid sensor key" }),
        { status: 401, headers: corsHeaders }
      )
    }

    const sensorData = await req.json()

    // Validate required fields
    const { sensorId, readings, timestamp } = sensorData
    if (!sensorId || !readings || !Array.isArray(readings)) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields: sensorId, readings[]" }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Verify sensor exists and is active
    const { data: sensor, error: sensorError } = await supabase
      .from('iot_sensors')
      .select('id, venue_id, status')
      .eq('device_id', sensorId)
      .eq('status', 'active')
      .single()

    if (sensorError || !sensor) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid or inactive sensor" }),
        { status: 403, headers: corsHeaders }
      )
    }

    // Process sensor data
    const processedData = {
      sensorId: sensor.id,
      readings: readings,
      timestamp: timestamp || new Date().toISOString(),
      batteryLevel: sensorData.batteryLevel,
      venueId: sensor.venue_id
    }

    // Import and use the IoT service
    // Note: In production, this would be imported from the main codebase
    const result = await processSensorData(processedData)

    if (result) {
      // Broadcast real-time updates via Supabase channels
      await supabase.channel(`venue-${sensor.venue_id}`).send({
        type: 'broadcast',
        event: 'sensor-update',
        payload: processedData
      })

      return new Response(
        JSON.stringify({
          success: true,
          message: `Processed ${readings.length} readings`,
          sensorId: sensor.id
        }),
        { headers: corsHeaders }
      )
    } else {
      return new Response(
        JSON.stringify({ success: false, error: "Failed to process sensor data" }),
        { status: 500, headers: corsHeaders }
      )
    }

  } catch (error) {
    console.error('Sensor data processing error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: corsHeaders }
    )
  }
})

// Simplified sensor data processing (in production, import from main service)
async function processSensorData(sensorData: any): Promise<boolean> {
  const { sensorId, readings, timestamp } = sensorData

  try {
    // Batch readings for efficiency
    const batchSize = 100
    const batches = []

    for (let i = 0; i < readings.length; i += batchSize) {
      batches.push(readings.slice(i, i + batchSize))
    }

    // Process batches
    for (const batch of batches) {
      const formattedReadings = batch.map((reading: any) => ({
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
    await processReadingsByType(readings, sensorId, sensorData.venueId)

    return true
  } catch (error) {
    console.error('Failed to process sensor data:', error)
    return false
  }
}

async function processReadingsByType(readings: any[], sensorId: string, venueId: string) {
  for (const reading of readings) {
    switch (reading.type) {
      case 'occupancy_count':
        await updateCapacityFromOccupancy(sensorId, reading.value, venueId)
        break
      case 'temperature':
      case 'humidity':
      case 'co2_level':
        await updateEnvironmentalData(sensorId, reading, venueId)
        break
    }
  }
}

async function updateCapacityFromOccupancy(sensorId: string, occupancyCount: number, venueId: string) {
  try {
    // Get sensor details
    const { data: sensor } = await supabase
      .from('iot_sensors')
      .select('zone_id, configuration')
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
    await supabase
      .from('venue_capacity')
      .upsert({
        venue_id: venueId,
        zone_id: sensor.zone_id,
        current_occupancy: occupancyCount,
        max_capacity: maxCapacity,
        utilization_rate: Math.min(utilizationRate, 100),
        last_updated: new Date().toISOString(),
        updated_by_sensor: sensorId
      }, {
        onConflict: 'venue_id,zone_id'
      })

  } catch (error) {
    console.error('Failed to update capacity:', error)
  }
}

async function updateEnvironmentalData(sensorId: string, reading: any, venueId: string) {
  try {
    const { data: sensor } = await supabase
      .from('iot_sensors')
      .select('zone_id')
      .eq('id', sensorId)
      .single()

    if (!sensor) return

    const envData = {
      venue_id: venueId,
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
    }

    await supabase
      .from('environmental_data')
      .insert(envData)

  } catch (error) {
    console.error('Failed to update environmental data:', error)
  }
}