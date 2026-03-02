import { supabase } from '@/lib/supabase';

// ============================================================================
// PARTY INVITE CRUD
// ============================================================================

export async function createPartyInvite(organizerId, data = {}) {
  const { data: result, error } = await supabase
    .from('party_invites')
    .insert({
      organizer_id: organizerId,
      title: data.title || '',
      description: data.description || '',
      start_date: data.startDate || null,
      end_date: data.endDate || null,
      venue_name: data.venueName || '',
      city: data.city || '',
      address: data.address || '',
      cover_image_url: data.coverImageUrl || null,
      message: data.message || '',
      allow_plus_ones: data.allowPlusOnes || false,
      max_plus_ones: data.maxPlusOnes || 1,
      rsvp_deadline: data.rsvpDeadline || null,
    })
    .select()
    .single();

  if (error) throw error;
  return result;
}

export async function getOrganizerInvites(organizerId) {
  const { data, error } = await supabase
    .from('party_invites')
    .select('*')
    .eq('organizer_id', organizerId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getInviteByToken(shareToken) {
  const { data, error } = await supabase
    .from('party_invites')
    .select(`
      *,
      organizer:organizers (id, business_name, logo_url)
    `)
    .eq('share_token', shareToken)
    .eq('is_active', true)
    .single();

  if (error) throw error;
  return data;
}

export async function updateInviteSettings(inviteId, settings) {
  const updates = {};
  if (settings.title !== undefined) updates.title = settings.title;
  if (settings.description !== undefined) updates.description = settings.description;
  if (settings.startDate !== undefined) updates.start_date = settings.startDate;
  if (settings.endDate !== undefined) updates.end_date = settings.endDate;
  if (settings.venueName !== undefined) updates.venue_name = settings.venueName;
  if (settings.city !== undefined) updates.city = settings.city;
  if (settings.address !== undefined) updates.address = settings.address;
  if (settings.coverImageUrl !== undefined) updates.cover_image_url = settings.coverImageUrl;
  if (settings.message !== undefined) updates.message = settings.message;
  if (settings.allowPlusOnes !== undefined) updates.allow_plus_ones = settings.allowPlusOnes;
  if (settings.maxPlusOnes !== undefined) updates.max_plus_ones = settings.maxPlusOnes;
  if (settings.rsvpDeadline !== undefined) updates.rsvp_deadline = settings.rsvpDeadline;
  if (settings.isActive !== undefined) updates.is_active = settings.isActive;

  const { data, error } = await supabase
    .from('party_invites')
    .update(updates)
    .eq('id', inviteId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============================================================================
// GUEST MANAGEMENT
// ============================================================================

export async function addGuestsToInvite(inviteId, organizerId, guests) {
  const rows = guests.map(g => ({
    invite_id: inviteId,
    organizer_id: organizerId,
    name: g.name,
    email: g.email || null,
    phone: g.phone || null,
    source: g.source || 'manual',
  }));

  const { data, error } = await supabase
    .from('party_invite_guests')
    .insert(rows)
    .select();

  if (error) throw error;
  return data || [];
}

export async function getInviteGuests(inviteId, filters = {}) {
  let query = supabase
    .from('party_invite_guests')
    .select('*')
    .eq('invite_id', inviteId)
    .order('created_at', { ascending: true });

  if (filters.status) {
    query = query.eq('rsvp_status', filters.status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getGuestByRsvpToken(rsvpToken) {
  const { data, error } = await supabase
    .from('party_invite_guests')
    .select(`
      *,
      invite:party_invites (
        *,
        organizer:organizers (id, business_name, logo_url)
      )
    `)
    .eq('rsvp_token', rsvpToken)
    .single();

  if (error) throw error;
  return data;
}

export async function submitGuestRSVP(rsvpToken, { status, plusOnes, plusOneNames, note }) {
  const updates = {
    rsvp_status: status,
    rsvp_responded_at: new Date().toISOString(),
  };
  if (plusOnes !== undefined) updates.plus_ones = plusOnes;
  if (plusOneNames !== undefined) updates.plus_one_names = plusOneNames;
  if (note !== undefined) updates.note = note;

  const { data, error } = await supabase
    .from('party_invite_guests')
    .update(updates)
    .eq('rsvp_token', rsvpToken)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Register a new guest from share link (no rsvp_token pre-assigned)
export async function registerAndRSVP(inviteId, organizerId, { name, email, status, plusOnes, plusOneNames, note }) {
  const { data, error } = await supabase
    .from('party_invite_guests')
    .insert({
      invite_id: inviteId,
      organizer_id: organizerId,
      name,
      email: email || null,
      rsvp_status: status,
      plus_ones: plusOnes || 0,
      plus_one_names: plusOneNames || [],
      note: note || '',
      source: 'share_link',
      rsvp_responded_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function removeGuest(guestId) {
  const { error } = await supabase
    .from('party_invite_guests')
    .delete()
    .eq('id', guestId);

  if (error) throw error;
  return true;
}

// ============================================================================
// STATS & TRACKING
// ============================================================================

export async function getInviteStats(inviteId) {
  const { data, error } = await supabase
    .from('party_invite_guests')
    .select('rsvp_status')
    .eq('invite_id', inviteId);

  if (error) throw error;

  const stats = { total: 0, going: 0, maybe: 0, pending: 0, declined: 0 };
  (data || []).forEach(g => {
    stats.total++;
    stats[g.rsvp_status] = (stats[g.rsvp_status] || 0) + 1;
  });
  return stats;
}

export async function markEmailsSent(guestIds) {
  const { error } = await supabase
    .from('party_invite_guests')
    .update({ email_sent_at: new Date().toISOString() })
    .in('id', guestIds);

  if (error) throw error;
  return true;
}

export async function markReminded(guestIds) {
  const { error } = await supabase
    .from('party_invite_guests')
    .update({ reminder_sent_at: new Date().toISOString() })
    .in('id', guestIds);

  if (error) throw error;
  return true;
}

export async function markSmsSent(guestIds) {
  const { error } = await supabase
    .from('party_invite_guests')
    .update({ sms_sent_at: new Date().toISOString() })
    .in('id', guestIds);

  if (error) throw error;
  return true;
}

export async function getFreeEmailUsage(organizerId) {
  const { data, error } = await supabase
    .from('party_invite_free_email_usage')
    .select('emails_used')
    .eq('organizer_id', organizerId)
    .maybeSingle();

  // Return 0 if table doesn't exist yet or any error
  if (error) {
    console.warn('getFreeEmailUsage:', error.message);
    return 0;
  }
  return data?.emails_used || 0;
}

export async function incrementFreeEmailUsage(organizerId, count) {
  // Upsert: insert if not exists, otherwise increment
  const current = await getFreeEmailUsage(organizerId);
  const { error } = await supabase
    .from('party_invite_free_email_usage')
    .upsert({
      organizer_id: organizerId,
      emails_used: current + count,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'organizer_id' });

  if (error) throw error;
  return current + count;
}

// Get going/maybe guests for public display (first names only)
export async function getPublicGuestList(inviteId) {
  const { data, error } = await supabase
    .from('party_invite_guests')
    .select('name, rsvp_status, plus_ones')
    .eq('invite_id', inviteId)
    .in('rsvp_status', ['going', 'maybe'])
    .order('rsvp_responded_at', { ascending: true });

  if (error) throw error;
  return (data || []).map(g => ({
    firstName: g.name.split(' ')[0],
    status: g.rsvp_status,
    plusOnes: g.plus_ones,
  }));
}
