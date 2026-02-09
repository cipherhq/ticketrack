import { openDB } from 'idb';

const DB_NAME = 'ticketrack-offline';
const DB_VERSION = 1;

function getDb() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Tickets store
      if (!db.objectStoreNames.contains('tickets')) {
        const ticketStore = db.createObjectStore('tickets', { keyPath: 'id' });
        ticketStore.createIndex('by-event', 'event_id');
        ticketStore.createIndex('by-ticket-code', 'ticket_code', { unique: true });
      }

      // Events store
      if (!db.objectStoreNames.contains('events')) {
        const eventStore = db.createObjectStore('events', { keyPath: 'id' });
        eventStore.createIndex('by-organizer', 'organizer_id');
      }

      // Pending check-ins queue
      if (!db.objectStoreNames.contains('pendingCheckIns')) {
        const pendingStore = db.createObjectStore('pendingCheckIns', {
          keyPath: 'id',
          autoIncrement: true,
        });
        pendingStore.createIndex('by-event', 'event_id');
        pendingStore.createIndex('by-ticket', 'ticket_id');
        pendingStore.createIndex('by-status', 'status');
      }
    },
  });
}

/**
 * Cache event metadata and its tickets into IndexedDB.
 */
export async function cacheEventData(eventId, eventMeta, tickets) {
  const db = await getDb();
  const tx = db.transaction(['events', 'tickets'], 'readwrite');

  // Store event with cache timestamp
  await tx.objectStore('events').put({
    ...eventMeta,
    id: eventId,
    cached_at: new Date().toISOString(),
  });

  // Bulk-store tickets
  const ticketStore = tx.objectStore('tickets');
  for (const ticket of tickets) {
    await ticketStore.put(ticket);
  }

  await tx.done;
}

/**
 * Get all cached tickets for an event.
 */
export async function getOfflineTickets(eventId) {
  const db = await getDb();
  return db.getAllFromIndex('tickets', 'by-event', eventId);
}

/**
 * Find a ticket by its ticket_code.
 */
export async function findTicketByCode(code) {
  const db = await getDb();
  return db.getFromIndex('tickets', 'by-ticket-code', code);
}

/**
 * Find a ticket by its UUID id.
 */
export async function findTicketById(id) {
  const db = await getDb();
  return db.get('tickets', id);
}

/**
 * Patch a local ticket record (e.g. mark as checked in).
 */
export async function updateTicketLocally(ticketId, updates) {
  const db = await getDb();
  const ticket = await db.get('tickets', ticketId);
  if (!ticket) return null;

  const updated = { ...ticket, ...updates };
  await db.put('tickets', updated);
  return updated;
}

/**
 * Add a check-in record to the pending sync queue.
 */
export async function queueCheckIn(record) {
  const db = await getDb();
  return db.add('pendingCheckIns', {
    ...record,
    status: 'pending',
    created_at: new Date().toISOString(),
  });
}

/**
 * Get all pending check-in records, ordered by creation time.
 */
export async function getPendingCheckIns() {
  const db = await getDb();
  const all = await db.getAllFromIndex('pendingCheckIns', 'by-status', 'pending');
  return all.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

/**
 * Count pending check-ins.
 */
export async function getPendingCount() {
  const db = await getDb();
  return db.countFromIndex('pendingCheckIns', 'by-status', 'pending');
}

/**
 * Mark a queued check-in as synced.
 */
export async function markCheckInSynced(id) {
  const db = await getDb();
  const record = await db.get('pendingCheckIns', id);
  if (!record) return;
  record.status = 'synced';
  record.synced_at = new Date().toISOString();
  await db.put('pendingCheckIns', record);
}

/**
 * Mark a queued check-in as failed.
 */
export async function markCheckInFailed(id, error) {
  const db = await getDb();
  const record = await db.get('pendingCheckIns', id);
  if (!record) return;
  record.status = 'failed';
  record.error = error;
  await db.put('pendingCheckIns', record);
}

/**
 * Check whether an event has been cached.
 */
export async function isEventCached(eventId) {
  const db = await getDb();
  const event = await db.get('events', eventId);
  return event || null;
}

/**
 * Clear cache for a specific event (event metadata + its tickets).
 */
export async function clearEventCache(eventId) {
  const db = await getDb();
  const tx = db.transaction(['events', 'tickets'], 'readwrite');

  await tx.objectStore('events').delete(eventId);

  const tickets = await tx.objectStore('tickets').index('by-event').getAllKeys(eventId);
  for (const key of tickets) {
    await tx.objectStore('tickets').delete(key);
  }

  await tx.done;
}

/**
 * Clear all offline data.
 */
export async function clearAllCache() {
  const db = await getDb();
  const tx = db.transaction(['events', 'tickets', 'pendingCheckIns'], 'readwrite');
  await tx.objectStore('events').clear();
  await tx.objectStore('tickets').clear();
  await tx.objectStore('pendingCheckIns').clear();
  await tx.done;
}
