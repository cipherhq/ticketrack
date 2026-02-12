import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  cacheEventData,
  getOfflineTickets,
  findTicketByCode,
  findTicketById,
  updateTicketLocally,
  queueCheckIn,
  getPendingCount,
  isEventCached,
} from '@/lib/offlineDb';
import { syncPendingCheckIns } from '@/lib/offlineSync';

export function useOfflineCheckIn(selectedEventId, organizerId) {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [cachedEvent, setCachedEvent] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCaching, setIsCaching] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  const syncTimeoutRef = useRef(null);
  const wasOfflineRef = useRef(!navigator.onLine);

  // Track online/offline state
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      // Auto-sync when transitioning from offline to online
      if (wasOfflineRef.current) {
        syncTimeoutRef.current = setTimeout(() => {
          syncNow();
        }, 2000);
      }
      wasOfflineRef.current = false;
    };

    const handleOffline = () => {
      setIsOffline(true);
      wasOfflineRef.current = true;
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, []);

  // Check cache status when event changes
  useEffect(() => {
    if (selectedEventId) {
      checkCacheStatus();
      refreshPendingCount();
    } else {
      setCachedEvent(null);
    }
  }, [selectedEventId]);

  // Periodically refresh pending count
  useEffect(() => {
    const interval = setInterval(refreshPendingCount, 5000);
    return () => clearInterval(interval);
  }, []);

  const checkCacheStatus = useCallback(async () => {
    if (!selectedEventId) return;
    const cached = await isEventCached(selectedEventId);
    setCachedEvent(cached);
  }, [selectedEventId]);

  const refreshPendingCount = useCallback(async () => {
    const count = await getPendingCount();
    setPendingCount(count);
  }, []);

  /**
   * Download current event data from Supabase into IndexedDB.
   */
  const cacheCurrentEvent = useCallback(async () => {
    if (!selectedEventId || !organizerId) return;
    setIsCaching(true);

    try {
      const { data: event, error: eventError } = await supabase
        .from('events')
        .select('id, title, start_date, venue_name, organizer_id')
        .eq('id', selectedEventId)
        .eq('organizer_id', organizerId)
        .single();

      if (eventError) throw eventError;

      const { data: tickets, error: ticketsError } = await supabase
        .from('tickets')
        .select('id, attendee_name, attendee_email, ticket_code, quantity, is_checked_in, checked_in_at, checked_in_by, created_at, event_id, payment_status, ticket_types(id, name)')
        .eq('event_id', selectedEventId)
        .in('payment_status', ['completed', 'free', 'paid', 'complimentary'])
        .order('attendee_name', { ascending: true });

      if (ticketsError) throw ticketsError;

      await cacheEventData(selectedEventId, event, tickets || []);
      await checkCacheStatus();

      return { success: true, ticketCount: tickets?.length || 0 };
    } catch (err) {
      console.error('Failed to cache event data:', err);
      return { success: false, error: err.message };
    } finally {
      setIsCaching(false);
    }
  }, [selectedEventId, organizerId, checkCacheStatus]);

  /**
   * Perform a check-in using local IndexedDB data (offline mode).
   * Returns a result object matching the shape used by CheckInByEvents.
   */
  const performOfflineCheckIn = useCallback(async (ticketCodeOrId, isUndo = false) => {
    const cleanCode = ticketCodeOrId?.trim()?.toUpperCase();

    if (!cleanCode) {
      return {
        success: false,
        message: 'Please enter a valid ticket code.',
      };
    }

    try {
      // Lookup ticket
      const isUUID = cleanCode.length === 36 && cleanCode.split('-').length === 5;
      let ticket;

      if (isUUID) {
        ticket = await findTicketById(cleanCode);
      } else {
        ticket = await findTicketByCode(cleanCode);
      }

      if (!ticket) {
        return {
          success: false,
          message: `Ticket "${cleanCode}" not found in offline cache. Try downloading event data first.`,
        };
      }

      // Validate payment status
      const validStatuses = ['completed', 'free', 'paid', 'complimentary'];
      if (!validStatuses.includes(ticket.payment_status)) {
        return {
          success: false,
          message: `This ticket has status "${ticket.payment_status}" and cannot be checked in.`,
          attendeeName: ticket.attendee_name,
        };
      }

      // Validate event
      if (ticket.event_id !== selectedEventId) {
        return {
          success: false,
          message: 'This ticket is for a different event.',
          attendeeName: ticket.attendee_name,
        };
      }

      // Check current state - prevent duplicate check-in
      if (!isUndo && ticket.is_checked_in) {
        const checkedInTime = ticket.checked_in_at
          ? new Date(ticket.checked_in_at).toLocaleString('en-NG', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })
          : '';
        return {
          success: false,
          message: checkedInTime
            ? `This ticket was already checked in at ${checkedInTime}.`
            : 'This ticket has already been checked in.',
          attendeeName: ticket.attendee_name,
          alreadyCheckedIn: true,
        };
      }

      if (isUndo && !ticket.is_checked_in) {
        return {
          success: false,
          message: 'This ticket is not checked in.',
          attendeeName: ticket.attendee_name,
        };
      }

      const now = new Date().toISOString();
      const { data: userData } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
      const userId = userData?.user?.id || 'offline-user';

      // Update local IndexedDB ticket
      await updateTicketLocally(ticket.id, {
        is_checked_in: !isUndo,
        checked_in_at: !isUndo ? now : null,
        checked_in_by: !isUndo ? userId : null,
      });

      // Queue for sync
      await queueCheckIn({
        ticket_id: ticket.id,
        event_id: selectedEventId,
        is_undo: isUndo,
        checked_in_at: now,
        checked_in_by: userId,
      });

      await refreshPendingCount();

      return {
        success: true,
        message: isUndo
          ? 'Check-in reversed (offline). Will sync when online.'
          : `${ticket.attendee_name} checked in (offline). Will sync when online.`,
        attendeeName: ticket.attendee_name,
        ticketCode: ticket.ticket_code,
        offline: true,
      };
    } catch (err) {
      console.error('Offline check-in error:', err);
      return {
        success: false,
        message: 'Offline check-in failed: ' + (err.message || 'Unknown error'),
      };
    }
  }, [selectedEventId, refreshPendingCount]);

  /**
   * Manually trigger sync of pending check-ins.
   */
  const syncNow = useCallback(async () => {
    if (isSyncing || !navigator.onLine) return;
    setIsSyncing(true);
    setSyncResult(null);

    try {
      const result = await syncPendingCheckIns(supabase);
      setSyncResult(result);
      await refreshPendingCount();
      await checkCacheStatus();

      // Auto-dismiss sync result after 3 seconds
      setTimeout(() => setSyncResult(null), 3000);

      return result;
    } catch (err) {
      console.error('Sync failed:', err);
      setSyncResult({ synced: 0, failed: 0, error: err.message });
      return { synced: 0, failed: 0, error: err.message };
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, refreshPendingCount, checkCacheStatus]);

  /**
   * Get attendees from offline cache (for rendering when offline).
   */
  const getOfflineAttendees = useCallback(async () => {
    if (!selectedEventId) return [];

    const tickets = await getOfflineTickets(selectedEventId);
    return tickets.map((t) => ({
      id: t.id,
      name: t.attendee_name,
      email: t.attendee_email,
      ticketCode: t.ticket_code,
      ticketType: t.ticket_types?.name || 'Standard',
      quantity: t.quantity || 1,
      checkedIn: t.is_checked_in || false,
      checkInTime: t.checked_in_at,
      checkedInBy: t.checked_in_by,
      purchaseDate: t.created_at,
    }));
  }, [selectedEventId]);

  return {
    isOffline,
    isEventCached: !!cachedEvent,
    lastCachedAt: cachedEvent?.cached_at || null,
    pendingCount,
    isSyncing,
    isCaching,
    syncResult,
    cacheCurrentEvent,
    performOfflineCheckIn,
    syncNow,
    getOfflineAttendees,
  };
}
