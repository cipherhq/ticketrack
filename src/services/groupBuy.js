import { supabase } from '@/lib/supabase';

/**
 * Group Buy Service
 * Handles group purchase sessions where friends buy tickets together
 */

// Generate a random 6-character group code
function generateGroupCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars like O, 0, I, 1
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Create a new group session
export async function createGroupSession(eventId, groupName = null, durationMinutes = 60) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Please sign in to start a group');

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', user.id)
    .single();

  const hostName = profile?.full_name || user.email?.split('@')[0] || 'Host';
  const hostEmail = profile?.email || user.email;

  // First, try the RPC function
  try {
    const { data, error } = await supabase.rpc('create_group_session', {
      p_event_id: eventId,
      p_host_user_id: user.id,
      p_host_name: hostName,
      p_group_name: groupName,
      p_duration_minutes: durationMinutes
    });

    if (!error && data?.success) {
      return data;
    }
    if (data && !data.success) {
      throw new Error(data.error);
    }
    // If RPC fails, fall through to direct table approach
    console.log('RPC not available, using direct table approach');
  } catch (rpcError) {
    console.log('RPC create_group_session not available:', rpcError.message);
  }

  // Fallback: Direct table operations
  const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);
  
  // Generate unique code
  let code = generateGroupCode();
  let attempts = 0;
  while (attempts < 5) {
    const { data: existing } = await supabase
      .from('group_buy_sessions')
      .select('id')
      .eq('code', code)
      .maybeSingle();
    
    if (!existing) break;
    code = generateGroupCode();
    attempts++;
  }

  // Create session
  const { data: session, error: sessionError } = await supabase
    .from('group_buy_sessions')
    .insert({
      code,
      name: groupName,
      event_id: eventId,
      host_user_id: user.id,
      host_name: hostName,
      expires_at: expiresAt.toISOString(),
      duration_minutes: durationMinutes,
      status: 'active',
      max_members: 20,
      member_count: 1
    })
    .select()
    .single();

  if (sessionError) throw sessionError;

  // Add host as first member
  const { data: member, error: memberError } = await supabase
    .from('group_buy_members')
    .insert({
      session_id: session.id,
      user_id: user.id,
      email: hostEmail,
      name: hostName,
      is_host: true,
      status: 'joined',
      joined_at: new Date().toISOString()
    })
    .select()
    .single();

  if (memberError) throw memberError;

  return {
    success: true,
    session_id: session.id,
    code: session.code,
    member_id: member.id
  };
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

  const userName = profile?.full_name || user.email?.split('@')[0] || 'Guest';
  const userEmail = profile?.email || user.email;

  // First, try the RPC function
  try {
    const { data, error } = await supabase.rpc('join_group_session', {
      p_code: code.toUpperCase(),
      p_user_id: user.id,
      p_user_name: userName,
      p_user_email: userEmail
    });

    if (!error && data?.success) {
      return data;
    }
    if (data && !data.success) {
      throw new Error(data.error);
    }
    // If RPC fails, fall through to direct table approach
    console.log('RPC not available, using direct table approach');
  } catch (rpcError) {
    console.log('RPC join_group_session not available:', rpcError.message);
  }

  // Fallback: Direct table operations
  // Find the session
  const { data: session, error: sessionError } = await supabase
    .from('group_buy_sessions')
    .select('*')
    .eq('code', code.toUpperCase())
    .eq('status', 'active')
    .maybeSingle();

  if (sessionError) throw sessionError;
  if (!session) throw new Error('Group not found or expired');

  // Check if already a member
  const { data: existingMember } = await supabase
    .from('group_buy_members')
    .select('*')
    .eq('session_id', session.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existingMember) {
    // Update existing member if they dropped
    if (existingMember.status === 'dropped') {
      await supabase
        .from('group_buy_members')
        .update({ status: 'joined', last_active_at: new Date().toISOString() })
        .eq('id', existingMember.id);
    }
    return {
      success: true,
      session_id: session.id,
      member_id: existingMember.id,
      rejoined: true
    };
  }

  // Check if session is full
  if (session.member_count >= session.max_members) {
    throw new Error('This group is full');
  }

  // Add new member
  const { data: newMember, error: insertError } = await supabase
    .from('group_buy_members')
    .insert({
      session_id: session.id,
      user_id: user.id,
      email: userEmail,
      name: userName,
      status: 'joined',
      joined_at: new Date().toISOString()
    })
    .select()
    .single();

  if (insertError) throw insertError;

  return {
    success: true,
    session_id: session.id,
    member_id: newMember.id,
    event_id: session.event_id
  };
}

// Get session details
export async function getGroupSession(sessionId) {
  const { data, error } = await supabase
    .from('group_buy_sessions')
    .select(`
      *,
      event:events(id, title, slug, start_date, end_date, venue_name, venue_address, city, image_url, currency, is_virtual),
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
  console.log('Fetching group session by code:', code.toUpperCase());
  
  const { data, error } = await supabase
    .from('group_buy_sessions')
    .select(`
      *,
      event:events(id, title, slug, start_date, end_date, venue_name, venue_address, city, image_url, currency, is_virtual),
      members:group_buy_members(
        id, user_id, name, email, is_host, status, 
        selected_tickets, total_amount, joined_at, completed_at
      )
    `)
    .eq('code', code.toUpperCase())
    .maybeSingle(); // Use maybeSingle to avoid error when not found

  if (error) {
    console.error('Error fetching group session:', error);
    throw error;
  }
  
  if (!data) {
    throw new Error('Group not found. Please check the code and try again.');
  }
  
  console.log('Found group session:', data);
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
