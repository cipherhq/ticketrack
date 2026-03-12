import { supabase } from '@/lib/supabase';
import { sanitizeFilterValue } from '@/lib/utils';

// Strip HTML tags and enforce max length to prevent XSS and abuse
function sanitizeText(str, maxLen) {
  if (!str) return '';
  const cleaned = String(str).replace(/<[^>]*>/g, '');
  return cleaned.slice(0, maxLen);
}

// ============================================================================
// PARTY INVITE CRUD
// ============================================================================

export async function createPartyInvite(organizerId, data = {}) {
  const { data: result, error } = await supabase
    .from('party_invites')
    .insert({
      organizer_id: organizerId,
      title: sanitizeText(data.title, 200) || '',
      description: sanitizeText(data.description, 5000) || '',
      start_date: data.startDate || null,
      end_date: data.endDate || null,
      venue_name: sanitizeText(data.venueName, 200) || '',
      city: sanitizeText(data.city, 100) || '',
      address: sanitizeText(data.address, 500) || '',
      cover_image_url: data.coverImageUrl || null,
      message: sanitizeText(data.message, 2000) || '',
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
  if (settings.autoRemindEnabled !== undefined) updates.auto_remind_enabled = settings.autoRemindEnabled;
  if (settings.autoRemindHoursBefore !== undefined) updates.auto_remind_hours_before = settings.autoRemindHoursBefore;
  if (settings.datePollActive !== undefined) updates.date_poll_active = settings.datePollActive;
  if (settings.seriesId !== undefined) updates.series_id = settings.seriesId;
  if (settings.recurrenceRule !== undefined) updates.recurrence_rule = settings.recurrenceRule;

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
    const s = sanitizeFilterValue(search);
    query = query.or(`name.ilike.%${s}%,email.ilike.%${s}%`);
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

export async function createWallPost(inviteId, { authorName, authorEmail, authorGuestId, isHost, content, imageUrl }) {
  const row = {
    invite_id: inviteId,
    author_name: sanitizeText(authorName, 100),
    author_email: authorEmail || null,
    author_guest_id: authorGuestId || null,
    is_host: isHost || false,
    content: sanitizeText(content, 2000),
  };
  if (imageUrl) row.image_url = imageUrl;

  const { data, error } = await supabase
    .from('party_invite_wall_posts')
    .insert(row)
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
      title: sanitizeText(title, 200),
      content: sanitizeText(content, 5000),
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
      action: sanitizeText(action, 50),
      actor_name: actorName ? sanitizeText(actorName, 100) : null,
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
    .select('id, name, rsvp_status, plus_ones')
    .eq('invite_id', inviteId)
    .in('rsvp_status', ['going', 'maybe'])
    .order('rsvp_responded_at', { ascending: true });

  if (error) throw error;
  return (data || []).map(g => ({
    id: g.id,
    firstName: g.name.split(' ')[0],
    status: g.rsvp_status,
    plusOnes: g.plus_ones,
  }));
}

// ============================================================================
// REACTIONS / "BOOPS"
// ============================================================================

export async function getReactionsForInvite(inviteId) {
  const { data, error } = await supabase
    .from('party_invite_reactions')
    .select('*')
    .eq('invite_id', inviteId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function addReaction(inviteId, { targetGuestId, reactorName, reactorGuestId, emoji }) {
  const { data, error } = await supabase
    .from('party_invite_reactions')
    .insert({
      invite_id: inviteId,
      target_guest_id: targetGuestId,
      reactor_name: sanitizeText(reactorName, 100),
      reactor_guest_id: reactorGuestId || null,
      emoji: sanitizeText(emoji, 10),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============================================================================
// POTLUCK / "WHAT TO BRING" LIST
// ============================================================================

export async function getInviteItems(inviteId) {
  const { data, error } = await supabase
    .from('party_invite_items')
    .select('*')
    .eq('invite_id', inviteId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createInviteItem(inviteId, organizerId, { name, category, quantity }) {
  const { data, error } = await supabase
    .from('party_invite_items')
    .insert({
      invite_id: inviteId,
      organizer_id: organizerId,
      name: sanitizeText(name, 200),
      category: sanitizeText(category, 50) || 'Other',
      quantity: quantity || 1,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteInviteItem(itemId) {
  const { error } = await supabase
    .from('party_invite_items')
    .delete()
    .eq('id', itemId);

  if (error) throw error;
  return true;
}

export async function claimItem(itemId, { guestId, guestName }) {
  const { data, error } = await supabase
    .from('party_invite_items')
    .update({
      claimed_by_guest_id: guestId || null,
      claimed_by_name: sanitizeText(guestName, 100),
      claimed_at: new Date().toISOString(),
    })
    .eq('id', itemId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function unclaimItem(itemId) {
  const { data, error } = await supabase
    .from('party_invite_items')
    .update({
      claimed_by_guest_id: null,
      claimed_by_name: null,
      claimed_at: null,
    })
    .eq('id', itemId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============================================================================
// PHOTO ALBUM
// ============================================================================

export async function getInvitePhotos(inviteId) {
  const { data, error } = await supabase
    .from('party_invite_photos')
    .select('*, likes:party_invite_photo_likes(id, liker_name, liker_guest_id)')
    .eq('invite_id', inviteId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function uploadPartyPhoto(inviteId, { uploadedByName, uploadedByGuestId, isHost, imageUrl, caption }) {
  const { data, error } = await supabase
    .from('party_invite_photos')
    .insert({
      invite_id: inviteId,
      uploaded_by_name: sanitizeText(uploadedByName, 100),
      uploaded_by_guest_id: uploadedByGuestId || null,
      is_host: isHost || false,
      image_url: imageUrl,
      caption: caption ? sanitizeText(caption, 200) : null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deletePartyPhoto(photoId) {
  const { error } = await supabase
    .from('party_invite_photos')
    .delete()
    .eq('id', photoId);

  if (error) throw error;
  return true;
}

export async function likePhoto(photoId, { likerName, likerGuestId }) {
  const { data, error } = await supabase
    .from('party_invite_photo_likes')
    .insert({
      photo_id: photoId,
      liker_name: sanitizeText(likerName, 100),
      liker_guest_id: likerGuestId || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function unlikePhoto(photoId, likerName) {
  const { error } = await supabase
    .from('party_invite_photo_likes')
    .delete()
    .eq('photo_id', photoId)
    .eq('liker_name', likerName);

  if (error) throw error;
  return true;
}

// ============================================================================
// CUSTOM RSVP QUESTIONS
// ============================================================================

export async function getInviteQuestions(inviteId) {
  const { data, error } = await supabase
    .from('party_invite_questions')
    .select('*')
    .eq('invite_id', inviteId)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createInviteQuestion(inviteId, organizerId, { questionText, questionType, options, isRequired, sortOrder }) {
  const { data, error } = await supabase
    .from('party_invite_questions')
    .insert({
      invite_id: inviteId,
      organizer_id: organizerId,
      question_text: questionText,
      question_type: questionType || 'text',
      options: options || [],
      is_required: isRequired || false,
      sort_order: sortOrder || 0,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateInviteQuestion(questionId, updates) {
  const mapped = {};
  if (updates.questionText !== undefined) mapped.question_text = updates.questionText;
  if (updates.questionType !== undefined) mapped.question_type = updates.questionType;
  if (updates.options !== undefined) mapped.options = updates.options;
  if (updates.isRequired !== undefined) mapped.is_required = updates.isRequired;
  if (updates.sortOrder !== undefined) mapped.sort_order = updates.sortOrder;

  const { data, error } = await supabase
    .from('party_invite_questions')
    .update(mapped)
    .eq('id', questionId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteInviteQuestion(questionId) {
  const { error } = await supabase
    .from('party_invite_questions')
    .delete()
    .eq('id', questionId);

  if (error) throw error;
  return true;
}

export async function submitAnswers(guestId, answers) {
  // answers: [{ questionId, answerText, answerChoices }]
  const rows = answers.map(a => ({
    question_id: a.questionId,
    guest_id: guestId,
    answer_text: a.answerText || null,
    answer_choices: a.answerChoices || [],
  }));

  const { data, error } = await supabase
    .from('party_invite_answers')
    .upsert(rows, { onConflict: 'question_id,guest_id' })
    .select();

  if (error) throw error;
  return data || [];
}

export async function getAnswersForInvite(inviteId) {
  const { data, error } = await supabase
    .from('party_invite_answers')
    .select('*, question:party_invite_questions!question_id(*)')
    .in('question_id',
      supabase.from('party_invite_questions').select('id').eq('invite_id', inviteId)
    );

  // Fallback: fetch questions first, then answers
  if (error) {
    const questions = await getInviteQuestions(inviteId);
    if (questions.length === 0) return [];
    const qIds = questions.map(q => q.id);
    const { data: answers, error: err2 } = await supabase
      .from('party_invite_answers')
      .select('*')
      .in('question_id', qIds);
    if (err2) throw err2;
    return answers || [];
  }
  return data || [];
}

// ============================================================================
// DATE POLLING
// ============================================================================

export async function getDatePollOptions(inviteId) {
  const { data, error } = await supabase
    .from('party_invite_date_polls')
    .select('*, votes:party_invite_date_votes(*)')
    .eq('invite_id', inviteId)
    .order('date_option', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createDatePollOption(inviteId, { dateOption, label }) {
  const { data, error } = await supabase
    .from('party_invite_date_polls')
    .insert({
      invite_id: inviteId,
      date_option: dateOption,
      label: label || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteDatePollOption(optionId) {
  const { error } = await supabase
    .from('party_invite_date_polls')
    .delete()
    .eq('id', optionId);

  if (error) throw error;
  return true;
}

export async function voteOnDateOption(optionId, { voterName, voterGuestId, vote }) {
  const { data, error } = await supabase
    .from('party_invite_date_votes')
    .upsert({
      poll_option_id: optionId,
      voter_name: voterName,
      voter_guest_id: voterGuestId || null,
      vote: vote || 'yes',
    }, { onConflict: 'poll_option_id,voter_name' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function finalizeDatePoll(inviteId, chosenDate) {
  // Set the party date and disable the poll
  const { data, error } = await supabase
    .from('party_invites')
    .update({
      start_date: chosenDate,
      date_poll_active: false,
    })
    .eq('id', inviteId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============================================================================
// CO-HOSTING
// ============================================================================

export async function getCohosts(inviteId) {
  const { data, error } = await supabase
    .from('party_invite_cohosts')
    .select('*')
    .eq('invite_id', inviteId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function inviteCohost(inviteId, { email, name, role }) {
  const { data, error } = await supabase
    .from('party_invite_cohosts')
    .insert({
      invite_id: inviteId,
      email,
      name: name || null,
      role: role || 'cohost',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function removeCohost(cohostId) {
  const { error } = await supabase
    .from('party_invite_cohosts')
    .delete()
    .eq('id', cohostId);

  if (error) throw error;
  return true;
}

export async function getCohostByToken(inviteToken) {
  const { data, error } = await supabase
    .from('party_invite_cohosts')
    .select('*, invite:party_invites(id, title, organizer:organizers(id, business_name))')
    .eq('invite_token', inviteToken)
    .single();

  if (error) throw error;
  return data;
}

export async function acceptCohostInvite(inviteToken, userId) {
  const { data, error } = await supabase
    .from('party_invite_cohosts')
    .update({
      user_id: userId,
      accepted_at: new Date().toISOString(),
    })
    .eq('invite_token', inviteToken)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============================================================================
// RECURRING EVENTS
// ============================================================================

export async function getSeriesParties(seriesId) {
  const { data, error } = await supabase
    .from('party_invites')
    .select('*')
    .eq('series_id', seriesId)
    .order('start_date', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createNextOccurrence(inviteId, organizerId, { carryOverGuests }) {
  // Load the original invite
  const { data: original, error: fetchErr } = await supabase
    .from('party_invites')
    .select('*')
    .eq('id', inviteId)
    .single();

  if (fetchErr) throw fetchErr;

  const rule = original.recurrence_rule || {};
  const frequency = rule.frequency || 'weekly';
  const lastDate = new Date(original.start_date);
  const newDate = new Date(lastDate);

  if (frequency === 'daily') newDate.setDate(newDate.getDate() + 1);
  else if (frequency === 'weekly') newDate.setDate(newDate.getDate() + 7);
  else if (frequency === 'biweekly') newDate.setDate(newDate.getDate() + 14);
  else if (frequency === 'monthly') newDate.setMonth(newDate.getMonth() + 1);

  let newEndDate = null;
  if (original.end_date) {
    const duration = new Date(original.end_date).getTime() - lastDate.getTime();
    newEndDate = new Date(newDate.getTime() + duration).toISOString();
  }

  const seriesId = original.series_id || original.id;

  // Update original to have series_id if it doesn't
  if (!original.series_id) {
    await supabase.from('party_invites').update({ series_id: seriesId }).eq('id', inviteId);
  }

  const { data: newInvite, error: insertErr } = await supabase
    .from('party_invites')
    .insert({
      organizer_id: organizerId,
      title: original.title,
      description: original.description,
      start_date: newDate.toISOString(),
      end_date: newEndDate,
      venue_name: original.venue_name,
      city: original.city,
      address: original.address,
      cover_image_url: original.cover_image_url,
      message: original.message,
      allow_plus_ones: original.allow_plus_ones,
      max_plus_ones: original.max_plus_ones,
      design_metadata: original.design_metadata,
      series_id: seriesId,
      recurrence_rule: original.recurrence_rule,
    })
    .select()
    .single();

  if (insertErr) throw insertErr;

  // Optionally carry over the guest list
  if (carryOverGuests) {
    const { data: oldGuests } = await supabase
      .from('party_invite_guests')
      .select('name, email, phone, source')
      .eq('invite_id', inviteId);

    if (oldGuests && oldGuests.length > 0) {
      const newGuests = oldGuests.map(g => ({
        invite_id: newInvite.id,
        organizer_id: organizerId,
        name: g.name,
        email: g.email,
        phone: g.phone,
        source: g.source || 'recurring',
      }));
      await supabase.from('party_invite_guests').insert(newGuests);
    }
  }

  return newInvite;
}

// ============================================================================
// MONEY COLLECTION / CASH FUND
// ============================================================================

export async function getInviteFund(inviteId) {
  const { data, error } = await supabase
    .from('party_invite_funds')
    .select('*')
    .eq('invite_id', inviteId)
    .eq('is_active', true)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createFund(inviteId, organizerId, { title, description, goalAmount, currency }) {
  const { data, error } = await supabase
    .from('party_invite_funds')
    .insert({
      invite_id: inviteId,
      organizer_id: organizerId,
      title,
      description: description || null,
      goal_amount: goalAmount || null,
      currency: currency || 'NGN',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateFund(fundId, updates) {
  const mapped = {};
  if (updates.title !== undefined) mapped.title = updates.title;
  if (updates.description !== undefined) mapped.description = updates.description;
  if (updates.goalAmount !== undefined) mapped.goal_amount = updates.goalAmount;
  if (updates.isActive !== undefined) mapped.is_active = updates.isActive;

  const { data, error } = await supabase
    .from('party_invite_funds')
    .update(mapped)
    .eq('id', fundId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getContributions(fundId) {
  const { data, error } = await supabase
    .from('party_invite_contributions')
    .select('*')
    .eq('fund_id', fundId)
    .eq('payment_status', 'completed')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createFundContribution(fundId, { guestName, guestEmail, amount, message, callbackUrl }) {
  const { data, error } = await supabase.functions.invoke('create-fund-contribution', {
    body: { fundId, guestName, guestEmail, amount, message, callbackUrl },
  });

  if (error) throw error;
  return data;
}

export async function verifyFundContribution(reference, provider) {
  const { data, error } = await supabase.functions.invoke('verify-fund-contribution', {
    body: { reference, provider },
  });

  if (error) throw error;
  return data;
}

export async function getPublicFundInfo(inviteId) {
  const fund = await getInviteFund(inviteId);
  if (!fund) return null;

  const contributions = await getContributions(fund.id);
  const totalRaised = contributions.reduce((sum, c) => sum + Number(c.amount), 0);
  const contributorCount = contributions.length;

  return {
    ...fund,
    totalRaised,
    contributorCount,
    contributions: contributions.slice(0, 20),
  };
}
