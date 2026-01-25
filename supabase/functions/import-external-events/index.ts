import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ImportRequest {
  platform: 'eventbrite' | 'tixafrica' | 'afrotix' | 'partyvest'
  connectionId: string
  organizerId: string
  eventIds?: string[] // Specific events to import, or all if empty
  importAttendees?: boolean
}

// Eventbrite API client
async function fetchEventbriteEvents(accessToken: string, eventIds?: string[]) {
  const baseUrl = 'https://www.eventbriteapi.com/v3'
  const headers = { 'Authorization': `Bearer ${accessToken}` }
  
  if (eventIds && eventIds.length > 0) {
    // Fetch specific events
    const events = await Promise.all(
      eventIds.map(async (id) => {
        const res = await fetch(`${baseUrl}/events/${id}/?expand=venue,ticket_classes`, { headers })
        if (!res.ok) return null
        return res.json()
      })
    )
    return events.filter(Boolean)
  }
  
  // Fetch all user's events
  const res = await fetch(`${baseUrl}/users/me/events/?expand=venue,ticket_classes&status=live,started,ended`, { headers })
  if (!res.ok) {
    throw new Error(`Eventbrite API error: ${res.status}`)
  }
  const data = await res.json()
  return data.events || []
}

async function fetchEventbriteAttendees(accessToken: string, eventId: string) {
  const baseUrl = 'https://www.eventbriteapi.com/v3'
  const headers = { 'Authorization': `Bearer ${accessToken}` }
  
  const res = await fetch(`${baseUrl}/events/${eventId}/attendees/`, { headers })
  if (!res.ok) {
    console.error(`Failed to fetch attendees for event ${eventId}`)
    return []
  }
  const data = await res.json()
  return data.attendees || []
}

// Tix.Africa API client
async function fetchTixAfricaEvents(apiKey: string, eventIds?: string[]) {
  const baseUrl = 'https://api.tix.africa/v1'
  const headers = { 'Authorization': `Bearer ${apiKey}` }
  
  if (eventIds && eventIds.length > 0) {
    const events = await Promise.all(
      eventIds.map(async (id) => {
        const res = await fetch(`${baseUrl}/events/${id}`, { headers })
        if (!res.ok) return null
        return res.json()
      })
    )
    return events.filter(Boolean)
  }
  
  const res = await fetch(`${baseUrl}/organizer/events`, { headers })
  if (!res.ok) {
    throw new Error(`Tix.Africa API error: ${res.status}`)
  }
  const data = await res.json()
  return data.data || data.events || []
}

// Merge custom mappings with defaults (custom takes precedence)
function mergeFieldMappings(defaults: any, custom: any): any {
  const merged = { ...defaults }
  
  for (const [targetField, customConfig] of Object.entries(custom)) {
    if (customConfig && (customConfig as any).sourceField) {
      // Convert from UI format to processing format
      const uiConfig = customConfig as any
      merged[targetField] = {
        source: uiConfig.sourceField,
        type: uiConfig.type || 'string',
        transformation: uiConfig.transformation,
        combineWith: uiConfig.combineWith,
      }
    }
  }
  
  return merged
}

// Apply field transformation
function applyTransformation(value: any, transformation: string, combineWith?: string[], sourceRecord?: any): any {
  if (!transformation || transformation === 'none') return value
  
  switch (transformation) {
    case 'combine':
      if (combineWith && sourceRecord) {
        const parts = [value, ...combineWith.map(f => getNestedValue(sourceRecord, f))].filter(Boolean)
        return parts.join(' ').trim()
      }
      return value
    case 'split_first':
      return String(value || '').split(/\s+/)[0] || value
    case 'split_last':
      const parts2 = String(value || '').split(/\s+/)
      return parts2[parts2.length - 1] || value
    case 'lowercase':
      return String(value || '').toLowerCase()
    case 'uppercase':
      return String(value || '').toUpperCase()
    case 'trim':
      return String(value || '').trim()
    case 'parse_date':
      try {
        return new Date(value).toISOString()
      } catch {
        return value
      }
    case 'parse_phone':
      return String(value || '').replace(/[^\d+]/g, '')
    case 'boolean':
      const truthy = ['yes', 'true', '1', 'y', 'checked', 'active']
      return truthy.includes(String(value || '').toLowerCase())
    default:
      return value
  }
}

// Generic field mapper
function mapEventFields(externalEvent: any, platform: string, mappings: any): any {
  const mapped: any = {}
  
  for (const [targetField, config] of Object.entries(mappings)) {
    const { source, type, transformation, combineWith } = config as any
    let value = getNestedValue(externalEvent, source)
    
    // Apply transformation if specified
    if (transformation) {
      value = applyTransformation(value, transformation, combineWith, externalEvent)
    }
    
    // Type conversions (fallback)
    if (type === 'datetime' && value && !transformation) {
      value = new Date(value).toISOString()
    } else if (type === 'boolean' && !transformation) {
      value = Boolean(value)
    }
    
    mapped[targetField] = value
  }
  
  return mapped
}

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj)
}

// Generate slug from title
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50) + '-' + Date.now().toString(36)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { platform, connectionId, organizerId, eventIds, importAttendees = true }: ImportRequest = await req.json()

    // Create import job
    const { data: job, error: jobError } = await supabaseClient
      .from('import_jobs')
      .insert({
        organizer_id: organizerId,
        connection_id: connectionId,
        job_type: eventIds?.length ? 'single_event' : 'full_import',
        platform,
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (jobError) throw jobError

    // Get connection credentials
    const { data: connection, error: connError } = await supabaseClient
      .from('external_platform_connections')
      .select('*')
      .eq('id', connectionId)
      .single()

    if (connError || !connection) {
      throw new Error('Connection not found')
    }

    // Get platform mappings (default)
    const { data: platformConfig } = await supabaseClient
      .from('supported_import_platforms')
      .select('*')
      .eq('id', platform)
      .single()

    // Use custom mappings if organizer has configured them, otherwise use defaults
    const defaultEventMappings = platformConfig?.event_field_mappings || {}
    const defaultAttendeeMappings = platformConfig?.attendee_field_mappings || {}
    
    // Custom mappings override defaults
    const eventMappings = connection.custom_event_mappings && Object.keys(connection.custom_event_mappings).length > 0
      ? mergeFieldMappings(defaultEventMappings, connection.custom_event_mappings)
      : defaultEventMappings
      
    const attendeeMappings = connection.custom_attendee_mappings && Object.keys(connection.custom_attendee_mappings).length > 0
      ? mergeFieldMappings(defaultAttendeeMappings, connection.custom_attendee_mappings)
      : defaultAttendeeMappings

    let externalEvents: any[] = []
    let stats = {
      total: 0,
      imported: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
    }

    // Fetch events from external platform
    try {
      if (platform === 'eventbrite') {
        externalEvents = await fetchEventbriteEvents(connection.access_token, eventIds)
      } else if (platform === 'tixafrica') {
        externalEvents = await fetchTixAfricaEvents(connection.api_key, eventIds)
      } else {
        throw new Error(`Unsupported platform: ${platform}`)
      }
    } catch (error) {
      // Update job with error
      await supabaseClient
        .from('import_jobs')
        .update({
          status: 'failed',
          error_message: error.message,
          completed_at: new Date().toISOString(),
        })
        .eq('id', job.id)
      
      throw error
    }

    stats.total = externalEvents.length

    // Process each event
    for (const externalEvent of externalEvents) {
      try {
        const externalId = externalEvent.id?.toString() || externalEvent.event_id?.toString()
        
        // Check if already imported
        const { data: existingImport } = await supabaseClient
          .from('imported_events')
          .select('id, event_id')
          .eq('platform', platform)
          .eq('external_event_id', externalId)
          .single()

        // Map fields
        const mappedEvent = mapEventFields(externalEvent, platform, eventMappings)
        
        // Prepare event data
        const eventData = {
          organizer_id: organizerId,
          title: mappedEvent.name || externalEvent.name?.text || externalEvent.title || 'Imported Event',
          slug: generateSlug(mappedEvent.name || externalEvent.name?.text || externalEvent.title || 'event'),
          description: mappedEvent.description || '',
          start_date: mappedEvent.start_date,
          end_date: mappedEvent.end_date,
          venue_name: mappedEvent.venue_name || '',
          venue_address: mappedEvent.venue_address || '',
          city: mappedEvent.city || '',
          country_code: mappedEvent.country_code || 'NG',
          image_url: mappedEvent.image_url || '',
          is_virtual: mappedEvent.is_virtual || false,
          is_free: mappedEvent.is_free || false,
          currency: mappedEvent.currency || 'NGN',
          status: 'draft',
          external_url: mappedEvent.external_url || '',
        }

        let eventId: string

        if (existingImport?.event_id) {
          // Update existing event
          const { error: updateError } = await supabaseClient
            .from('events')
            .update(eventData)
            .eq('id', existingImport.event_id)
          
          if (updateError) throw updateError
          
          eventId = existingImport.event_id
          stats.updated++

          // Update imported_events record
          await supabaseClient
            .from('imported_events')
            .update({
              external_data: externalEvent,
              last_synced_at: new Date().toISOString(),
              import_status: 'updated',
            })
            .eq('id', existingImport.id)
        } else {
          // Create new event
          const { data: newEvent, error: createError } = await supabaseClient
            .from('events')
            .insert(eventData)
            .select()
            .single()
          
          if (createError) throw createError
          
          eventId = newEvent.id
          stats.imported++

          // Create imported_events record
          await supabaseClient
            .from('imported_events')
            .insert({
              organizer_id: organizerId,
              connection_id: connectionId,
              event_id: eventId,
              platform,
              external_event_id: externalId,
              external_event_url: mappedEvent.external_url || externalEvent.url,
              import_status: 'imported',
              external_data: externalEvent,
              last_synced_at: new Date().toISOString(),
            })

          // Import ticket types if available
          const ticketClasses = externalEvent.ticket_classes || externalEvent.tickets || []
          for (const ticket of ticketClasses) {
            await supabaseClient
              .from('ticket_types')
              .insert({
                event_id: eventId,
                name: ticket.name || ticket.ticket_name || 'General',
                description: ticket.description || '',
                price: parseFloat(ticket.cost?.major_value || ticket.price || 0),
                quantity_available: ticket.quantity_total || ticket.quantity || 100,
                currency: ticket.cost?.currency || mappedEvent.currency || 'NGN',
              })
          }
        }

        // Import attendees if requested
        if (importAttendees && eventId) {
          let attendees: any[] = []
          
          if (platform === 'eventbrite') {
            attendees = await fetchEventbriteAttendees(connection.access_token, externalId)
          }
          
          for (const attendee of attendees) {
            const mappedAttendee = mapEventFields(attendee, platform, attendeeMappings)
            const externalAttendeeId = attendee.id?.toString()
            
            // Check if already imported
            const { data: existingAttendee } = await supabaseClient
              .from('imported_attendees')
              .select('id')
              .eq('platform', platform)
              .eq('external_attendee_id', externalAttendeeId)
              .single()
            
            if (!existingAttendee) {
              // Get or create contact
              let contactId: string | null = null
              if (mappedAttendee.email) {
                const { data: existingContact } = await supabaseClient
                  .from('contacts')
                  .select('id')
                  .eq('organizer_id', organizerId)
                  .eq('email', mappedAttendee.email)
                  .single()
                
                if (existingContact) {
                  contactId = existingContact.id
                } else {
                  const { data: newContact } = await supabaseClient
                    .from('contacts')
                    .insert({
                      organizer_id: organizerId,
                      email: mappedAttendee.email,
                      full_name: mappedAttendee.full_name,
                      first_name: mappedAttendee.first_name,
                      last_name: mappedAttendee.last_name,
                      phone: mappedAttendee.phone,
                      source_type: 'import',
                      source_metadata: { platform, external_id: externalAttendeeId },
                    })
                    .select()
                    .single()
                  
                  contactId = newContact?.id
                }
              }

              // Get imported event record
              const { data: importedEvent } = await supabaseClient
                .from('imported_events')
                .select('id')
                .eq('event_id', eventId)
                .single()

              await supabaseClient
                .from('imported_attendees')
                .insert({
                  imported_event_id: importedEvent?.id,
                  contact_id: contactId,
                  platform,
                  external_attendee_id: externalAttendeeId,
                  external_order_id: mappedAttendee.order_id,
                  email: mappedAttendee.email,
                  full_name: mappedAttendee.full_name,
                  phone: mappedAttendee.phone,
                  ticket_type_name: mappedAttendee.ticket_type,
                  import_status: 'imported',
                  external_data: attendee,
                  last_synced_at: new Date().toISOString(),
                })
            }
          }
        }
      } catch (eventError) {
        console.error(`Error importing event:`, eventError)
        stats.failed++
      }
    }

    // Update job status
    await supabaseClient
      .from('import_jobs')
      .update({
        status: 'completed',
        total_items: stats.total,
        processed_items: stats.total,
        imported_items: stats.imported,
        updated_items: stats.updated,
        skipped_items: stats.skipped,
        failed_items: stats.failed,
        completed_at: new Date().toISOString(),
        result_summary: stats,
      })
      .eq('id', job.id)

    // Update connection last sync
    await supabaseClient
      .from('external_platform_connections')
      .update({
        last_sync_at: new Date().toISOString(),
        last_error: null,
      })
      .eq('id', connectionId)

    return new Response(
      JSON.stringify({
        success: true,
        jobId: job.id,
        stats,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Import error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
