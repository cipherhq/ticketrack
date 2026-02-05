import { supabase } from '@/lib/supabase';

// =====================================================
// ORGANIZER FUNCTIONS
// =====================================================

export async function getOrCreateOrganizer(userId) {
  const { data: existing, error: fetchError } = await supabase
    .from('organizers')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (existing) return existing;

  const { data: newOrganizer, error: createError } = await supabase
    .from('organizers')
    .insert({
      user_id: userId,
      business_name: 'My Organization',
      is_active: true,
      verification_level: 'basic',
      country_code: 'NG',
    })
    .select()
    .single();

  if (createError) throw createError;
  return newOrganizer;
}

export async function getOrganizerProfile(organizerId) {
  const { data, error } = await supabase
    .from('organizers')
    .select('*')
    .eq('id', organizerId)
    .single();

  if (error) throw error;
  return data;
}

export async function updateOrganizerProfile(organizerId, profileData) {
  const { data, error } = await supabase
    .from('organizers')
    .update({
      ...profileData,
      updated_at: new Date().toISOString(),
    })
    .eq('id', organizerId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getOrganizerStats(organizerId) {
  const { data: organizer } = await supabase
    .from('organizers')
    .select('total_events, total_tickets_sold, total_revenue, available_balance, pending_balance')
    .eq('id', organizerId)
    .single();

  const { count: followersCount } = await supabase
    .from('followers')
    .select('*', { count: 'exact', head: true })
    .eq('organizer_id', organizerId);

  const { count: eventsCount } = await supabase
    .from('events')
    .select('*', { count: 'exact', head: true })
    .eq('organizer_id', organizerId);

  const { count: upcomingEvents } = await supabase
    .from('events')
    .select('*', { count: 'exact', head: true })
    .eq('organizer_id', organizerId)
    .gte('start_date', new Date().toISOString());

  return {
    totalEvents: eventsCount || organizer?.total_events || 0,
    totalTicketsSold: organizer?.total_tickets_sold || 0,
    totalRevenue: organizer?.total_revenue || 0,
    totalFollowers: followersCount || 0,
    upcomingEvents: upcomingEvents || 0,
    availableBalance: organizer?.available_balance || 0,
    pendingBalance: organizer?.pending_balance || 0,
  };
}

// =====================================================
// EVENT FUNCTIONS
// =====================================================

export async function getOrganizerEvents(organizerId, options = {}) {
  let query = supabase
    .from('events')
    .select(`
      *,
      ticket_types (id, name, price, quantity_available, quantity_sold)
    `)
    .eq('organizer_id', organizerId);

  if (options.status) {
    query = query.eq('status', options.status);
  }

  if (options.upcoming) {
    query = query.gte('start_date', new Date().toISOString());
  }

  query = query.order('created_at', { ascending: false });

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getEventById(eventId) {
  const { data, error } = await supabase
    .from('events')
    .select(`
      *,
      ticket_types (*),
      event_images (*),
      sponsor_logos (*)
    `)
    .eq('id', eventId)
    .single();

  if (error) throw error;
  return data;
}

export async function createEvent(organizerId, eventData) {
  // Generate unique slug - use provided or create from title with sequential numbering
  let slug = eventData.slug;
  
  // Remove slug from eventData so we can handle it separately
  const { slug: _slug, ...restEventData } = eventData;
  
  // Generate base slug from title
  const baseSlug = eventData.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .substring(0, 50);
  
  // If slug provided, check if it's unique, otherwise use baseSlug
  const targetSlug = slug || baseSlug;
  
  // Check if slug exists, if so append -2, -3, etc.
  const { data: existing } = await supabase
    .from('events')
    .select('slug')
    .like('slug', `${targetSlug}%`)
    .order('slug', { ascending: false });
  
  if (!existing || existing.length === 0) {
    slug = targetSlug;
  } else {
    // Check if exact slug exists
    const exactMatch = existing.find(e => e.slug === targetSlug);
    if (!exactMatch) {
      slug = targetSlug;
    } else {
      // Find highest number suffix
      const slugPattern = new RegExp(`^${targetSlug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(-\\d+)?$`);
      const matchingSlugs = existing.filter(e => slugPattern.test(e.slug));
      
      const numbers = matchingSlugs.map(e => {
        const match = e.slug.match(/-(\d+)$/);
        return match ? parseInt(match[1]) : 1;
      });
      const maxNum = matchingSlugs.length > 0 ? Math.max(...numbers) : 0;
      slug = `${targetSlug}-${maxNum + 1}`;
    }
  }

  const { data, error } = await supabase
    .from('events')
    .insert({
      organizer_id: organizerId,
      slug,
      status: 'published',
      tickets_sold: 0,
      total_revenue: 0,
      views_count: 0,
      is_featured: false,
      is_free: false,
      country_code: 'NG',
      ...restEventData,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateEvent(eventId, eventData) {
  const { data, error } = await supabase
    .from('events')
    .update({
      ...eventData,
      updated_at: new Date().toISOString(),
    })
    .eq('id', eventId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateEventStatus(eventId, status) {
  const updateData = { status, updated_at: new Date().toISOString() };
  if (status === 'published') {
    updateData.published_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('events')
    .update(updateData)
    .eq('id', eventId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteEvent(eventId) {
  const { error } = await supabase.from('events').delete().eq('id', eventId);
  if (error) throw error;
}

export async function duplicateEvent(eventId) {
  const event = await getEventById(eventId);
  if (!event) throw new Error('Event not found');

  const { id, created_at, updated_at, published_at, slug, tickets_sold, total_revenue, views_count, ticket_types, event_images, sponsor_logos, ...eventData } = event;

  const newEvent = await createEvent(event.organizer_id, {
    ...eventData,
    title: `${eventData.title} (Copy)`,
    status: 'published',
  });

  if (ticket_types?.length > 0) {
    await createTicketTypes(newEvent.id, ticket_types.map(t => ({
      name: t.name,
      price: t.price,
      quantity: t.quantity_available,
      description: t.description,
    })));
  }

  return newEvent;
}

// =====================================================
// TICKET TYPE FUNCTIONS
// =====================================================

export async function createTicketTypes(eventId, ticketTypes, currency = null) {
  // If no currency provided, fetch it from the event
  let ticketCurrency = currency;
  if (!ticketCurrency) {
    const { data: event } = await supabase
      .from('events')
      .select('currency')
      .eq('id', eventId)
      .single();
    ticketCurrency = event?.currency || 'GBP'; // Default to GBP if not set
  }
  
  const ticketsToInsert = ticketTypes.map((ticket, index) => ({
    event_id: eventId,
    name: ticket.name,
    description: ticket.description || '',
    price: parseFloat(ticket.price) || 0,
    quantity_available: parseInt(ticket.quantity) || 0,
    quantity_sold: 0,
    currency: ticket.currency || ticketCurrency,
    is_active: true,
    sort_order: index,
    is_refundable: ticket.isRefundable !== false,
    is_table_ticket: ticket.isTableTicket || false,
    seats_per_table: ticket.seatsPerTable ? parseInt(ticket.seatsPerTable) : null,
    min_per_order: 1,
    max_per_order: 10,
  }));

  const { data, error } = await supabase
    .from('ticket_types')
    .insert(ticketsToInsert)
    .select();

  if (error) throw error;
  return data;
}

export async function updateTicketType(ticketTypeId, ticketData) {
  const { data, error } = await supabase
    .from('ticket_types')
    .update({ ...ticketData, updated_at: new Date().toISOString() })
    .eq('id', ticketTypeId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteTicketType(ticketTypeId) {
  const { error } = await supabase.from('ticket_types').delete().eq('id', ticketTypeId);
  if (error) throw error;
}

// =====================================================
// TICKETS (PURCHASES) FUNCTIONS
// =====================================================

export async function getEventAttendees(eventId) {
  const { data, error } = await supabase
    .from('tickets')
    .select(`*, ticket_types (name, price)`)
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getOrganizerAttendees(organizerId) {
  const { data, error } = await supabase
    .from('tickets')
    .select(`
      *,
      events!inner (id, title, organizer_id, start_date, image_url),
      ticket_types (name, price)
    `)
    .eq('events.organizer_id', organizerId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function checkInAttendee(ticketId, checkedInBy) {
  const { data, error } = await supabase
    .from('tickets')
    .update({
      is_checked_in: true,
      checked_in_at: new Date().toISOString(),
      checked_in_by: checkedInBy,
    })
    .eq('id', ticketId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function undoCheckIn(ticketId) {
  const { data, error } = await supabase
    .from('tickets')
    .update({ is_checked_in: false, checked_in_at: null, checked_in_by: null })
    .eq('id', ticketId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getTicketByCode(ticketCode) {
  const { data, error } = await supabase
    .from('tickets')
    .select(`
      *,
      events (id, title, start_date, venue_name),
      ticket_types (name)
    `)
    .eq('ticket_code', ticketCode)
    .single();

  if (error) throw error;
  return data;
}

// =====================================================
// BANK ACCOUNT FUNCTIONS
// =====================================================

export async function getBankAccounts(organizerId) {
  const { data, error } = await supabase
    .from('bank_accounts')
    .select('*')
    .eq('organizer_id', organizerId)
    .order('is_default', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function addBankAccount(organizerId, bankData) {
  if (bankData.is_default) {
    await supabase
      .from('bank_accounts')
      .update({ is_default: false })
      .eq('organizer_id', organizerId);
  }

  const { data, error } = await supabase
    .from('bank_accounts')
    .insert({ organizer_id: organizerId, ...bankData })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateBankAccount(bankAccountId, bankData) {
  const { data, error } = await supabase
    .from('bank_accounts')
    .update({ ...bankData, updated_at: new Date().toISOString() })
    .eq('id', bankAccountId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteBankAccount(bankAccountId) {
  const { error } = await supabase.from('bank_accounts').delete().eq('id', bankAccountId);
  if (error) throw error;
}

export async function setDefaultBankAccount(organizerId, bankAccountId) {
  await supabase
    .from('bank_accounts')
    .update({ is_default: false })
    .eq('organizer_id', organizerId);

  const { data, error } = await supabase
    .from('bank_accounts')
    .update({ is_default: true })
    .eq('id', bankAccountId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// =====================================================
// PAYOUT FUNCTIONS
// =====================================================

export async function getPayouts(organizerId) {
  const { data, error } = await supabase
    .from('payouts')
    .select(`*, bank_accounts (bank_name, account_number, account_name)`)
    .eq('organizer_id', organizerId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function requestPayout(organizerId, bankAccountId, amount) {
  const reference = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const { data, error } = await supabase
    .from('payouts')
    .insert({ organizer_id: organizerId, bank_account_id: bankAccountId, amount, reference, status: 'pending' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// =====================================================
// PROMO CODE FUNCTIONS
// =====================================================

export async function getPromoCodes(organizerId) {
  const { data, error } = await supabase
    .from('promo_codes')
    .select(`*, events (id, title)`)
    .eq('organizer_id', organizerId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createPromoCode(organizerId, promoData) {
  const { data, error } = await supabase
    .from('promo_codes')
    .insert({
      organizer_id: organizerId,
      code: promoData.code.toUpperCase(),
      description: promoData.description,
      discount_type: promoData.discount_type,
      discount_value: parseFloat(promoData.discount_value),
      max_uses: promoData.max_uses ? parseInt(promoData.max_uses) : null,
      event_id: promoData.event_id || null,
      valid_from: promoData.valid_from,
      valid_until: promoData.valid_until,
      is_active: true,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updatePromoCode(promoCodeId, promoData) {
  const { data, error } = await supabase
    .from('promo_codes')
    .update({ ...promoData, code: promoData.code?.toUpperCase(), updated_at: new Date().toISOString() })
    .eq('id', promoCodeId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deletePromoCode(promoCodeId) {
  const { error } = await supabase.from('promo_codes').delete().eq('id', promoCodeId);
  if (error) throw error;
}

export async function togglePromoCodeStatus(promoCodeId, isActive) {
  const { data, error } = await supabase
    .from('promo_codes')
    .update({ is_active: isActive })
    .eq('id', promoCodeId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// =====================================================
// PROMOTER FUNCTIONS
// =====================================================

export async function getPromoters(organizerId) {
  const { data, error } = await supabase
    .from('promoters')
    .select('*')
    .eq('organizer_id', organizerId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createPromoter(organizerId, promoterData) {
  const promoCode = `PROMO-${promoterData.name.substring(0, 3).toUpperCase()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
  const baseUrl = window.location.origin;

  const { data, error } = await supabase
    .from('promoters')
    .insert({
      organizer_id: organizerId,
      full_name: promoterData.name,
      short_code: promoCode,
      email: promoterData.email,
      name: promoterData.name,
      phone: promoterData.phone || null,
      commission_type: promoterData.commission_type || 'percentage',
      commission_value: parseFloat(promoterData.commission_value) || 0,
      commission_rate: parseFloat(promoterData.commission_value) || 0,
      referral_code: promoCode,
      referral_link: `${baseUrl}/events?ref=${promoCode}`,
      status: 'active',
      is_active: true,
      total_clicks: 0,
      total_sales: 0,
      total_revenue: 0,
      total_commission: 0,
      paid_commission: 0,
      total_earned: 0,
      total_paid: 0,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updatePromoter(promoterId, promoterData) {
  const { data, error } = await supabase
    .from('promoters')
    .update({ ...promoterData, updated_at: new Date().toISOString() })
    .eq('id', promoterId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deletePromoter(promoterId) {
  const { error } = await supabase.from('promoters').delete().eq('id', promoterId);
  if (error) throw error;
}

// =====================================================
// EMAIL CAMPAIGN FUNCTIONS
// =====================================================

export async function getEmailCampaigns(organizerId) {
  const { data, error } = await supabase
    .from('email_campaigns')
    .select(`*, events (id, title)`)
    .eq('organizer_id', organizerId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createEmailCampaign(organizerId, campaignData) {
  const { data, error } = await supabase
    .from('email_campaigns')
    .insert({
      organizer_id: organizerId,
      name: campaignData.name,
      subject: campaignData.subject,
      body: campaignData.body,
      target_audience: campaignData.target_audience || 'all',
      event_id: campaignData.event_id || null,
      status: 'published',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateEmailCampaign(campaignId, campaignData) {
  const { data, error } = await supabase
    .from('email_campaigns')
    .update({ ...campaignData, updated_at: new Date().toISOString() })
    .eq('id', campaignId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteEmailCampaign(campaignId) {
  const { error } = await supabase.from('email_campaigns').delete().eq('id', campaignId);
  if (error) throw error;
}

export async function sendEmailCampaign(campaignId) {
  const { data, error } = await supabase
    .from('email_campaigns')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', campaignId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// =====================================================
// SMS CAMPAIGN FUNCTIONS
// =====================================================

export async function getSmsCampaigns(organizerId) {
  const { data, error } = await supabase
    .from('sms_campaigns')
    .select(`*, events (id, title)`)
    .eq('organizer_id', organizerId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createSmsCampaign(organizerId, campaignData) {
  const { data, error } = await supabase
    .from('sms_campaigns')
    .insert({
      organizer_id: organizerId,
      name: campaignData.name,
      message: campaignData.message,
      target_audience: campaignData.target_audience || 'all',
      event_id: campaignData.event_id || null,
      status: 'published',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteSmsCampaign(campaignId) {
  const { error } = await supabase.from('sms_campaigns').delete().eq('id', campaignId);
  if (error) throw error;
}

// =====================================================
// KYC FUNCTIONS
// =====================================================

export async function getKycDocuments(organizerId) {
  const { data, error } = await supabase
    .from('kyc_documents')
    .select('*')
    .eq('organizer_id', organizerId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function uploadKycDocument(organizerId, documentData) {
  const { data, error } = await supabase
    .from('kyc_documents')
    .insert({
      organizer_id: organizerId,
      document_type: documentData.document_type,
      document_url: documentData.document_url,
      document_number: documentData.document_number,
      expires_at: documentData.expires_at,
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw error;

  await supabase
    .from('organizers')
    .update({ kyc_status: 'submitted' })
    .eq('id', organizerId);

  return data;
}

export async function deleteKycDocument(documentId) {
  const { error } = await supabase.from('kyc_documents').delete().eq('id', documentId);
  if (error) throw error;
}

// =====================================================
// FOLLOWERS FUNCTIONS
// =====================================================

export async function getFollowers(organizerId) {
  const { data, error } = await supabase
    .from('followers')
    .select(`*, profiles (id, first_name, last_name, email, avatar_url)`)
    .eq('organizer_id', organizerId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getFollowersCount(organizerId) {
  const { count, error } = await supabase
    .from('followers')
    .select('*', { count: 'exact', head: true })
    .eq('organizer_id', organizerId);

  if (error) throw error;
  return count || 0;
}

// =====================================================
// ANALYTICS FUNCTIONS
// =====================================================

export async function getEventAnalytics(eventId) {
  const { data: event } = await supabase.from('events').select('*').eq('id', eventId).single();
  const { data: tickets } = await supabase.from('tickets').select('*').eq('event_id', eventId);
  const { data: ticketTypes } = await supabase.from('ticket_types').select('*').eq('event_id', eventId);

  const totalTicketsSold = tickets?.reduce((sum, t) => sum + t.quantity, 0) || 0;
  const totalRevenue = tickets?.reduce((sum, t) => sum + parseFloat(t.total_price), 0) || 0;
  const checkedInCount = tickets?.filter(t => t.is_checked_in).length || 0;

  const salesByType = ticketTypes?.map(type => {
    const typeTickets = tickets?.filter(t => t.ticket_type_id === type.id) || [];
    return {
      name: type.name,
      sold: typeTickets.reduce((sum, t) => sum + t.quantity, 0),
      revenue: typeTickets.reduce((sum, t) => sum + parseFloat(t.total_price), 0),
      available: type.quantity_available,
    };
  }) || [];

  const salesByDay = {};
  tickets?.forEach(ticket => {
    const date = new Date(ticket.created_at).toISOString().split('T')[0];
    if (!salesByDay[date]) salesByDay[date] = { count: 0, revenue: 0 };
    salesByDay[date].count += ticket.quantity;
    salesByDay[date].revenue += parseFloat(ticket.total_price);
  });

  return {
    event,
    totalTicketsSold,
    totalRevenue,
    checkedInCount,
    checkInRate: totalTicketsSold > 0 ? (checkedInCount / totalTicketsSold * 100).toFixed(1) : 0,
    salesByType,
    salesByDay: Object.entries(salesByDay).map(([date, data]) => ({ date, ...data })).sort((a, b) => a.date.localeCompare(b.date)),
    viewsCount: event?.views_count || 0,
    conversionRate: event?.views_count > 0 ? (totalTicketsSold / event.views_count * 100).toFixed(1) : 0,
  };
}

export async function getOrganizerAnalytics(organizerId) {
  const { data: events } = await supabase
    .from('events')
    .select('id, title, start_date, tickets_sold, total_revenue, views_count')
    .eq('organizer_id', organizerId);

  const { data: organizer } = await supabase
    .from('organizers')
    .select('total_revenue, total_tickets_sold')
    .eq('id', organizerId)
    .single();

  const { count: followersCount } = await supabase
    .from('followers')
    .select('*', { count: 'exact', head: true })
    .eq('organizer_id', organizerId);

  return {
    totalEvents: events?.length || 0,
    totalRevenue: organizer?.total_revenue || 0,
    totalTicketsSold: organizer?.total_tickets_sold || 0,
    totalFollowers: followersCount || 0,
    events: events || [],
  };
}

// =====================================================
// IMAGE UPLOAD HELPERS
// =====================================================

export async function uploadImage(bucket, organizerId, file) {
  const fileExt = file.name.split('.').pop();
  const fileName = `${organizerId}/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;

  const { error: uploadError } = await supabase.storage.from(bucket).upload(fileName, file);
  if (uploadError) throw uploadError;

  const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(fileName);
  return publicUrl;
}

export async function deleteImage(bucket, imageUrl) {
  const path = imageUrl.split(`/${bucket}/`)[1];
  if (path) await supabase.storage.from(bucket).remove([path]);
}

export const uploadEventImage = (organizerId, file) => uploadImage('event-images', organizerId, file);
export const uploadOrganizerLogo = (organizerId, file) => uploadImage('organizer-logos', organizerId, file);
export const uploadKycFile = (organizerId, file) => uploadImage('kyc-documents', organizerId, file);
export const uploadSponsorLogo = (organizerId, file) => uploadImage('sponsor-logos', organizerId, file);

// =====================================================
// EVENT SPEAKERS FUNCTIONS
// =====================================================

export async function getEventSpeakers(eventId) {
  const { data, error } = await supabase
    .from('event_speakers')
    .select('*')
    .eq('event_id', eventId)
    .order('display_order', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function saveEventSpeakers(eventId, speakers) {
  // Delete existing speakers for this event
  await supabase
    .from('event_speakers')
    .delete()
    .eq('event_id', eventId);

  // If no speakers to save, return early
  if (!speakers || speakers.length === 0) {
    return [];
  }

  // Insert new speakers
  const speakersToInsert = speakers.map((speaker, index) => ({
    event_id: eventId,
    name: speaker.name,
    role: speaker.role || null,
    bio: speaker.bio || null,
    image_url: speaker.image_url || null,
    social_links: speaker.social_links || {},
    display_order: index,
  }));

  const { data, error } = await supabase
    .from('event_speakers')
    .insert(speakersToInsert)
    .select();

  if (error) throw error;
  return data;
}

export async function uploadSpeakerImage(eventId, file) {
  const fileExt = file.name.split('.').pop();
  const fileName = `${eventId}/speakers/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;

  const { error: uploadError } = await supabase.storage.from('event-images').upload(fileName, file);
  if (uploadError) throw uploadError;

  const { data: { publicUrl } } = supabase.storage.from('event-images').getPublicUrl(fileName);
  return publicUrl;
}

export async function deleteSpeaker(speakerId) {
  const { error } = await supabase.from('event_speakers').delete().eq('id', speakerId);
  if (error) throw error;
}
