import {
  getPendingCheckIns,
  markCheckInSynced,
  markCheckInFailed,
  cacheEventData,
} from './offlineDb';

/**
 * Process all pending offline check-ins against Supabase.
 * - Oldest first
 * - Idempotent: if server already matches desired state, mark synced
 * - On failure: mark failed, continue to next
 * - After all processed: re-cache event data from server
 */
export async function syncPendingCheckIns(supabase) {
  const pending = await getPendingCheckIns();
  if (pending.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;
  const eventsToRefresh = new Set();

  for (const record of pending) {
    try {
      // Fetch current server state
      const { data: ticket, error: fetchError } = await supabase
        .from('tickets')
        .select('id, is_checked_in, event_id')
        .eq('id', record.ticket_id)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!ticket) {
        await markCheckInFailed(record.id, 'Ticket not found on server');
        failed++;
        continue;
      }

      eventsToRefresh.add(ticket.event_id);

      const desiredState = record.is_undo ? false : true;

      // If server already matches desired state, mark synced (idempotent)
      if (ticket.is_checked_in === desiredState) {
        await markCheckInSynced(record.id);
        synced++;
        continue;
      }

      // Apply update
      const { error: updateError } = await supabase
        .from('tickets')
        .update({
          is_checked_in: desiredState,
          checked_in_at: desiredState ? record.checked_in_at : null,
          checked_in_by: desiredState ? record.checked_in_by : null,
        })
        .eq('id', record.ticket_id);

      if (updateError) throw updateError;

      await markCheckInSynced(record.id);
      synced++;
    } catch (err) {
      console.error('Sync failed for record', record.id, err);
      await markCheckInFailed(record.id, err.message || 'Unknown error');
      failed++;
    }
  }

  // Re-cache event data from server for any affected events
  for (const eventId of eventsToRefresh) {
    try {
      await refreshEventCache(supabase, eventId);
    } catch (err) {
      console.error('Failed to refresh cache for event', eventId, err);
    }
  }

  return { synced, failed };
}

async function refreshEventCache(supabase, eventId) {
  const { data: event } = await supabase
    .from('events')
    .select('id, title, start_date, venue_name, organizer_id')
    .eq('id', eventId)
    .single();

  if (!event) return;

  const { data: tickets } = await supabase
    .from('tickets')
    .select('id, attendee_name, attendee_email, ticket_code, quantity, is_checked_in, checked_in_at, checked_in_by, created_at, event_id, payment_status, ticket_types(id, name)')
    .eq('event_id', eventId)
    .in('payment_status', ['completed', 'free', 'paid', 'complimentary'])
    .order('attendee_name', { ascending: true });

  if (tickets) {
    await cacheEventData(eventId, event, tickets);
  }
}
