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
  if (settings.designMetadata !== undefined) updates.design_metadata = settings.designMetadata;

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

export async function submitGuestRSVP(rsvpToken, { status, plusOnes, plusOneNames, note, email, phone }) {
  const updates = {
    rsvp_status: status,
    rsvp_responded_at: new Date().toISOString(),
  };
  if (plusOnes !== undefined) updates.plus_ones = plusOnes;
  if (plusOneNames !== undefined) updates.plus_one_names = plusOneNames;
  if (note !== undefined) updates.note = note;
  if (email) updates.email = email;
  if (phone) updates.phone = phone;

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
export async function registerAndRSVP(inviteId, organizerId, { name, email, phone, status, plusOnes, plusOneNames, note }) {
  const { data, error } = await supabase
    .from('party_invite_guests')
    .insert({
      invite_id: inviteId,
      organizer_id: organizerId,
      name,
      email: email || null,
      phone: phone || null,
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

// ============================================================================
// NEW: ID-BASED LOOKUP, CROSS-PARTY GUESTS, ANALYTICS
// ============================================================================

export async function getInviteById(inviteId) {
  const { data, error } = await supabase
    .from('party_invites')
    .select('*')
    .eq('id', inviteId)
    .single();

  if (error) throw error;
  return data;
}

export async function getAllOrganizerGuests(organizerId, { search, status, partyId } = {}) {
  let query = supabase
    .from('party_invite_guests')
    .select('*, invite:party_invites!invite_id(id, title, start_date)')
    .eq('organizer_id', organizerId)
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('rsvp_status', status);
  }
  if (partyId) {
    query = query.eq('invite_id', partyId);
  }
  if (search) {
    query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getOrganizerPartyAnalytics(organizerId) {
  // Load all invites
  const { data: invites, error: invErr } = await supabase
    .from('party_invites')
    .select('*')
    .eq('organizer_id', organizerId)
    .order('created_at', { ascending: false });

  if (invErr) throw invErr;

  // Load all guests across all invites
  const { data: allGuests, error: gErr } = await supabase
    .from('party_invite_guests')
    .select('invite_id, rsvp_status, rsvp_responded_at')
    .eq('organizer_id', organizerId);

  if (gErr) throw gErr;

  const guests = allGuests || [];
  const parties = invites || [];

  // Compute per-party stats
  const perParty = parties.map(inv => {
    const partyGuests = guests.filter(g => g.invite_id === inv.id);
    const total = partyGuests.length;
    const going = partyGuests.filter(g => g.rsvp_status === 'going').length;
    const maybe = partyGuests.filter(g => g.rsvp_status === 'maybe').length;
    const pending = partyGuests.filter(g => g.rsvp_status === 'pending').length;
    const declined = partyGuests.filter(g => g.rsvp_status === 'declined').length;
    const responded = partyGuests.filter(g => g.rsvp_responded_at).length;
    return { ...inv, total, going, maybe, pending, declined, responded };
  });

  // Compute totals
  const totalParties = parties.length;
  const totalGuests = guests.length;
  const going = guests.filter(g => g.rsvp_status === 'going').length;
  const maybe = guests.filter(g => g.rsvp_status === 'maybe').length;
  const pending = guests.filter(g => g.rsvp_status === 'pending').length;
  const declined = guests.filter(g => g.rsvp_status === 'declined').length;
  const responded = guests.filter(g => g.rsvp_responded_at).length;

  return {
    totals: { totalParties, totalGuests, going, maybe, pending, declined, responded },
    perParty,
  };
}

// ============================================================================
// DESIGN
// ============================================================================

export async function updateInviteDesign(inviteId, designMetadata) {
  const { data, error } = await supabase
    .from('party_invites')
    .update({ design_metadata: designMetadata })
    .eq('id', inviteId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function duplicatePartyInvite(inviteId, organizerId) {
  // Load the original invite
  const { data: original, error: fetchErr } = await supabase
    .from('party_invites')
    .select('*')
    .eq('id', inviteId)
    .single();

  if (fetchErr) throw fetchErr;

  // Create a copy (new share_token generated by DB, no guests)
  const { data: copy, error: insertErr } = await supabase
    .from('party_invites')
    .insert({
      organizer_id: organizerId,
      title: `${original.title} (Copy)`,
      description: original.description,
      start_date: original.start_date,
      end_date: original.end_date,
      venue_name: original.venue_name,
      city: original.city,
      address: original.address,
      cover_image_url: original.cover_image_url,
      message: original.message,
      allow_plus_ones: original.allow_plus_ones,
      max_plus_ones: original.max_plus_ones,
      design_metadata: original.design_metadata,
    })
    .select()
    .single();

  if (insertErr) throw insertErr;
  return copy;
}

// ============================================================================
// WALL POSTS
// ============================================================================

export async function getWallPosts(inviteId) {
  const { data, error } = await supabase
    .from('party_invite_wall_posts')
    .select('*')
    .eq('invite_id', inviteId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw error;
  return data || [];
}

export async function getPublicWallPosts(inviteId) {
  return getWallPosts(inviteId);
}

export async function createWallPost(inviteId, { authorName, authorEmail, authorGuestId, isHost, content }) {
  const { data, error } = await supabase
    .from('party_invite_wall_posts')
    .insert({
      invite_id: inviteId,
      author_name: authorName,
      author_email: authorEmail || null,
      author_guest_id: authorGuestId || null,
      is_host: isHost || false,
      content,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteWallPost(postId) {
  const { error } = await supabase
    .from('party_invite_wall_posts')
    .delete()
    .eq('id', postId);

  if (error) throw error;
  return true;
}

// ============================================================================
// ANNOUNCEMENTS
// ============================================================================

export async function getAnnouncements(inviteId) {
  const { data, error } = await supabase
    .from('party_invite_announcements')
    .select('*')
    .eq('invite_id', inviteId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getPublicAnnouncements(inviteId) {
  return getAnnouncements(inviteId);
}

export async function createAnnouncement(inviteId, organizerId, { title, content, sendEmail }) {
  const { data, error } = await supabase
    .from('party_invite_announcements')
    .insert({
      invite_id: inviteId,
      organizer_id: organizerId,
      title,
      content,
      send_email: sendEmail || false,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteAnnouncement(announcementId) {
  const { error } = await supabase
    .from('party_invite_announcements')
    .delete()
    .eq('id', announcementId);

  if (error) throw error;
  return true;
}

// ============================================================================
// ACTIVITY LOG
// ============================================================================

export async function logActivity(inviteId, action, actorName, metadata = {}) {
  const { data, error } = await supabase
    .from('party_invite_activity')
    .insert({
      invite_id: inviteId,
      action,
      actor_name: actorName || null,
      metadata,
    })
    .select()
    .single();

  if (error) {
    console.warn('logActivity error:', error.message);
    return null;
  }
  return data;
}

export async function getActivityLog(inviteId) {
  const { data, error } = await supabase
    .from('party_invite_activity')
    .select('*')
    .eq('invite_id', inviteId)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) throw error;
  return data || [];
}

// ============================================================================
// LINK VIEW TRACKING
// ============================================================================

export async function markLinkViewed(rsvpToken) {
  try {
    await supabase
      .from('party_invite_guests')
      .update({ link_viewed_at: new Date().toISOString() })
      .eq('rsvp_token', rsvpToken)
      .is('link_viewed_at', null);
  } catch {
    // Silently swallow — tracking should never break the RSVP page
  }
}

// ============================================================================
// PUBLIC GUEST LIST
// ============================================================================

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
