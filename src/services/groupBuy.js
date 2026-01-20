import { supabase } from '@/lib/supabase';

/**
 * Group Buy Service
 * Handles group purchase sessions where friends buy tickets together
 */

// Create a new group session
export async function createGroupSession(eventId, groupName = null, durationMinutes = 60) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Please sign in to start a group');

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single();

  const { data, error } = await supabase.rpc('create_group_session', {
    p_event_id: eventId,
    p_host_user_id: user.id,
    p_host_name: profile?.full_name || user.email?.split('@')[0] || 'Host',
    p_group_name: groupName,
    p_duration_minutes: durationMinutes
  });

  if (error) throw error;
  if (!data.success) throw new Error(data.error);

  return data;
}

// Join an existing group session
export async function joinGroupSession(code) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Please sign in to join a group');

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', user.id)
    .single();

  const { data, error } = await supabase.rpc('join_group_session', {
    p_code: code.toUpperCase(),
    p_user_id: user.id,
    p_user_name: profile?.full_name || user.email?.split('@')[0] || 'Guest',
    p_user_email: profile?.email || user.email
  });

  if (error) throw error;
  if (!data.success) throw new Error(data.error);

  return data;
}

// Get session details
export async function getGroupSession(sessionId) {
  const { data, error } = await supabase
    .from('group_buy_sessions')
    .select(`
      *,
      event:events(id, title, slug, start_date, end_date, venue_name, city, image_url, currency),
      members:group_buy_members(
        id, user_id, name, email, is_host, status, 
        selected_tickets, total_amount, joined_at, completed_at
      )
    `)
    .eq('id', sessionId)
    .single();

  if (error) throw error;
  return data;
}

// Get session by code
export async function getGroupSessionByCode(code) {
  const { data, error } = await supabase
    .from('group_buy_sessions')
    .select(`
      *,
      event:events(id, title, slug, start_date, end_date, venue_name, city, image_url, currency),
      members:group_buy_members(
        id, user_id, name, email, is_host, status, 
        selected_tickets, total_amount, joined_at, completed_at
      )
    `)
    .eq('code', code.toUpperCase())
    .single();

  if (error) throw error;
  return data;
}

// Get current user's member record for a session
export async function getMyMembership(sessionId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('group_buy_members')
    .select('*')
    .eq('session_id', sessionId)
    .eq('user_id', user.id)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

// Update ticket selection
export async function updateTicketSelection(memberId, selectedTickets, totalAmount) {
  const { data, error } = await supabase.rpc('update_member_selection', {
    p_member_id: memberId,
    p_selected_tickets: selectedTickets,
    p_total_amount: totalAmount
  });

  if (error) throw error;
  return data;
}

// Mark member as completed after payment
export async function completeMemberPurchase(memberId, orderId, ticketCount, amount) {
  const { data, error } = await supabase.rpc('complete_group_member', {
    p_member_id: memberId,
    p_order_id: orderId,
    p_ticket_count: ticketCount,
    p_amount: amount
  });

  if (error) throw error;
  return data;
}

// Send a message in the group
export async function sendGroupMessage(sessionId, message) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Please sign in');

  const { data: member } = await supabase
    .from('group_buy_members')
    .select('id, name')
    .eq('session_id', sessionId)
    .eq('user_id', user.id)
    .single();

  if (!member) throw new Error('You are not a member of this group');

  const { error } = await supabase
    .from('group_buy_messages')
    .insert({
      session_id: sessionId,
      member_id: member.id,
      user_name: member.name,
      message: message,
      message_type: 'chat'
    });

  if (error) throw error;
}

// Get group messages
export async function getGroupMessages(sessionId, limit = 50) {
  const { data, error } = await supabase
    .from('group_buy_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

// Leave group (drop out)
export async function leaveGroup(memberId) {
  const { error } = await supabase
    .from('group_buy_members')
    .update({ status: 'dropped', updated_at: new Date().toISOString() })
    .eq('id', memberId);

  if (error) throw error;
}

// Subscribe to real-time updates for a session
export function subscribeToSession(sessionId, callbacks) {
  const { onMemberChange, onMessageReceived, onSessionChange } = callbacks;

  // Subscribe to member changes
  const memberChannel = supabase
    .channel(`group-members-${sessionId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'group_buy_members',
      filter: `session_id=eq.${sessionId}`
    }, payload => {
      if (onMemberChange) onMemberChange(payload);
    })
    .subscribe();

  // Subscribe to messages
  const messageChannel = supabase
    .channel(`group-messages-${sessionId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'group_buy_messages',
      filter: `session_id=eq.${sessionId}`
    }, payload => {
      if (onMessageReceived) onMessageReceived(payload.new);
    })
    .subscribe();

  // Subscribe to session changes
  const sessionChannel = supabase
    .channel(`group-session-${sessionId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'group_buy_sessions',
      filter: `id=eq.${sessionId}`
    }, payload => {
      if (onSessionChange) onSessionChange(payload.new);
    })
    .subscribe();

  // Return unsubscribe function
  return () => {
    supabase.removeChannel(memberChannel);
    supabase.removeChannel(messageChannel);
    supabase.removeChannel(sessionChannel);
  };
}

// Get user's active group sessions
export async function getMyGroupSessions() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('group_buy_members')
    .select(`
      *,
      session:group_buy_sessions(
        *,
        event:events(id, title, slug, start_date, image_url)
      )
    `)
    .eq('user_id', user.id)
    .in('status', ['joined', 'selecting', 'ready', 'paying'])
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data?.filter(m => m.session?.status === 'active') || [];
}

// Generate shareable link
export function getShareableLink(code) {
  return `${window.location.origin}/group/${code}`;
}

// Format time remaining
export function formatTimeRemaining(expiresAt) {
  const now = new Date();
  const expires = new Date(expiresAt);
  const diff = expires - now;

  if (diff <= 0) return 'Expired';

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${seconds}s`;
}
