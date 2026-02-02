// Telegram Bot Webhook - Handle incoming messages and account linking

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
const TELEGRAM_API_URL = 'https://api.telegram.org';
const APP_URL = Deno.env.get('APP_URL') || 'https://ticketrack.com';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (!TELEGRAM_BOT_TOKEN) {
      return new Response(
        JSON.stringify({ error: 'Telegram bot not configured' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const update = await req.json();
    console.log('Telegram update received:', JSON.stringify(update));

    // Handle different update types
    if (update.message) {
      await handleMessage(supabase, update.message);
    } else if (update.callback_query) {
      await handleCallbackQuery(supabase, update.callback_query);
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Telegram webhook error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ============================================================================
// MESSAGE HANDLERS
// ============================================================================

async function handleMessage(supabase: any, message: any) {
  const chatId = message.chat.id;
  const text = message.text || '';
  const username = message.from?.username;
  const firstName = message.from?.first_name || 'User';

  console.log(`Processing message from ${chatId}: "${text}"`);

  // Handle commands
  if (text.startsWith('/')) {
    const [command, ...args] = text.split(' ');
    console.log(`Command detected: ${command}, args: ${args.join(', ')}`);

    switch (command) {
      case '/start':
        console.log('Handling /start command...');
        await handleStart(supabase, chatId, firstName, args[0]);
        console.log('/start command handled');
        break;
      case '/link':
        await handleLinkRequest(chatId, firstName);
        break;
      case '/unlink':
        await handleUnlink(supabase, chatId);
        break;
      case '/mytickets':
        await handleMyTickets(supabase, chatId);
        break;
      case '/help':
        await handleHelp(chatId);
        break;
      default:
        await sendMessage(chatId, `Unknown command. Type /help for available commands.`);
    }
  } else {
    // Handle regular messages
    await sendMessage(chatId, 
      `Hi ${firstName}! 👋\n\nI'm the Ticketrack bot. I can send you event reminders and ticket updates.\n\nType /help to see what I can do.`
    );
  }
}

async function handleCallbackQuery(supabase: any, query: any) {
  const chatId = query.message?.chat.id;
  const data = query.data;

  // Answer callback query to remove loading state
  await answerCallbackQuery(query.id);

  if (data.startsWith('confirm_link:')) {
    const token = data.replace('confirm_link:', '');
    await confirmLink(supabase, chatId, token, query.from);
  } else if (data.startsWith('view_ticket:')) {
    const ticketId = data.replace('view_ticket:', '');
    await sendTicketDetails(supabase, chatId, ticketId);
  }
}

// ============================================================================
// COMMAND HANDLERS
// ============================================================================

async function handleStart(supabase: any, chatId: number, firstName: string, linkToken?: string) {
  if (linkToken) {
    // User is trying to link their account
    await handleLinkWithToken(supabase, chatId, firstName, linkToken);
  } else {
    const welcomeMessage = `
🎉 *Welcome to Ticketrack!*

Hi ${firstName}! I'm your personal event assistant.

*What I can do:*
• Send event reminders
• Notify you about ticket updates
• Share your ticket QR codes
• Alert you about new events from organizers you follow

*Get started:*
1. Link your Ticketrack account with /link
2. Make sure to enable Telegram notifications in your profile settings

Type /help for more commands.
`;
    await sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' });
  }
}

async function handleLinkRequest(chatId: number, firstName: string) {
  const message = `
🔗 *Link Your Ticketrack Account*

To link your account:

1. Go to your Ticketrack profile settings
2. Click "Link Telegram"
3. You'll receive a confirmation here

Or visit: ${APP_URL}/profile?tab=settings

Once linked, you'll receive event reminders and updates directly here!
`;
  await sendMessage(chatId, message, { parse_mode: 'Markdown' });
}

async function handleLinkWithToken(supabase: any, chatId: number, firstName: string, token: string) {
  console.log(`handleLinkWithToken called: chatId=${chatId}, token=${token.substring(0, 20)}...`);

  // Verify the link token
  const { data: linkRequest, error } = await supabase
    .from('telegram_link_requests')
    .select('user_id, expires_at')
    .eq('token', token)
    .eq('status', 'pending')
    .single();

  console.log(`Token lookup result: data=${JSON.stringify(linkRequest)}, error=${JSON.stringify(error)}`);

  if (error || !linkRequest) {
    console.log('Token invalid or not found');
    await sendMessage(chatId,
      `❌ Invalid or expired link. Please try again from your Ticketrack profile settings.`
    );
    return;
  }

  // Check expiry
  if (new Date(linkRequest.expires_at) < new Date()) {
    console.log('Token expired');
    await sendMessage(chatId,
      `⏰ This link has expired. Please request a new one from your Ticketrack profile settings.`
    );
    return;
  }

  console.log('Token valid, linking account directly');

  // Link the account directly (no confirmation button needed)
  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      telegram_chat_id: chatId.toString(),
      telegram_linked_at: new Date().toISOString(),
    })
    .eq('id', linkRequest.user_id);

  if (updateError) {
    console.error('Failed to update profile:', updateError);
    await sendMessage(chatId, `❌ Failed to link account. Please try again.`);
    return;
  }

  // Mark link request as completed
  await supabase
    .from('telegram_link_requests')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('token', token);

  console.log('Account linked successfully');

  await sendMessage(chatId,
    `✅ *Success!*\n\nHi ${firstName}! Your Telegram is now linked to Ticketrack.\n\nYou'll receive event reminders and ticket updates here.\n\nType /help to see what I can do.`,
    { parse_mode: 'Markdown' }
  );
}

async function confirmLink(supabase: any, chatId: number, token: string, telegramUser: any) {
  // Get the link request
  const { data: linkRequest, error } = await supabase
    .from('telegram_link_requests')
    .select('user_id')
    .eq('token', token)
    .eq('status', 'pending')
    .single();

  if (error || !linkRequest) {
    await sendMessage(chatId, `❌ Link request not found or already used.`);
    return;
  }

  // Update the user's profile with Telegram info
  await supabase
    .from('profiles')
    .update({
      telegram_chat_id: chatId.toString(),
      telegram_username: telegramUser.username || null,
      telegram_linked_at: new Date().toISOString(),
    })
    .eq('id', linkRequest.user_id);

  // Mark link request as completed
  await supabase
    .from('telegram_link_requests')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('token', token);

  await sendMessage(chatId, 
    `✅ *Success!*\n\nYour Telegram is now linked to Ticketrack.\n\nYou'll receive event reminders and ticket updates here.`,
    { parse_mode: 'Markdown' }
  );
}

async function handleUnlink(supabase: any, chatId: number) {
  // Find user by chat ID and unlink
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('telegram_chat_id', chatId.toString())
    .single();

  if (error || !profile) {
    await sendMessage(chatId, `❌ No linked account found for this Telegram.`);
    return;
  }

  await supabase
    .from('profiles')
    .update({
      telegram_chat_id: null,
      telegram_username: null,
      telegram_linked_at: null,
    })
    .eq('id', profile.id);

  await sendMessage(chatId, 
    `✅ Your Telegram has been unlinked from Ticketrack.\n\nYou'll no longer receive notifications here.`
  );
}

async function handleMyTickets(supabase: any, chatId: number) {
  // Find user by chat ID
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('telegram_chat_id', chatId.toString())
    .single();

  if (!profile) {
    await sendMessage(chatId, 
      `❌ Please link your account first with /link`
    );
    return;
  }

  // Get upcoming tickets
  const { data: tickets } = await supabase
    .from('tickets')
    .select(`
      id, 
      ticket_code,
      events:event_id (title, start_date, venue_name)
    `)
    .eq('user_id', profile.id)
    .eq('payment_status', 'completed')
    .gte('events.start_date', new Date().toISOString())
    .order('events(start_date)')
    .limit(5);

  if (!tickets || tickets.length === 0) {
    await sendMessage(chatId, 
      `🎫 No upcoming tickets found.\n\nExplore events at ${APP_URL}/events`
    );
    return;
  }

  let message = `🎫 *Your Upcoming Tickets*\n\n`;
  const buttons = [];

  for (const ticket of tickets) {
    const event = ticket.events;
    const date = new Date(event.start_date).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
    
    message += `📍 *${event.title}*\n`;
    message += `📅 ${date}\n`;
    message += `📌 ${event.venue_name || 'TBA'}\n\n`;

    buttons.push([
      { text: `View: ${event.title.substring(0, 20)}...`, callback_data: `view_ticket:${ticket.id}` }
    ]);
  }

  await sendMessage(chatId, message, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: buttons },
  });
}

async function sendTicketDetails(supabase: any, chatId: number, ticketId: string) {
  const { data: ticket } = await supabase
    .from('tickets')
    .select(`
      *,
      events:event_id (title, start_date, end_date, venue_name, venue_address)
    `)
    .eq('id', ticketId)
    .single();

  if (!ticket) {
    await sendMessage(chatId, `❌ Ticket not found.`);
    return;
  }

  const event = ticket.events;
  const message = `
🎫 *${event.title}*

📅 *Date:* ${new Date(event.start_date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })}
⏰ *Time:* ${new Date(event.start_date).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })}
📍 *Venue:* ${event.venue_name || 'TBA'}
${event.venue_address ? `📌 ${event.venue_address}` : ''}

🎟 *Ticket Code:* \`${ticket.ticket_code}\`

Show this code or your QR at entry!
`;

  await sendMessage(chatId, message, { parse_mode: 'Markdown' });
}

async function handleHelp(chatId: number) {
  const message = `
📚 *Ticketrack Bot Commands*

/start - Welcome message
/link - Link your Ticketrack account
/unlink - Unlink your account
/mytickets - View your upcoming tickets
/help - Show this help message

*Need support?*
Visit ${APP_URL}/support
`;
  await sendMessage(chatId, message, { parse_mode: 'Markdown' });
}

// ============================================================================
// TELEGRAM API HELPERS
// ============================================================================

async function sendMessage(chatId: number, text: string, options: any = {}) {
  console.log(`Sending message to ${chatId}: "${text.substring(0, 50)}..."`);
  try {
    const url = `${TELEGRAM_API_URL}/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    console.log(`Telegram API URL: ${url.substring(0, 50)}...`);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        ...options,
      }),
    });

    const result = await response.json();
    console.log(`Telegram sendMessage result: ${JSON.stringify(result).substring(0, 100)}`);
    if (!result.ok) {
      console.error('Telegram sendMessage error:', result);
    }
    return result;
  } catch (error) {
    console.error('Telegram sendMessage fetch error:', error);
    return { ok: false };
  }
}

async function answerCallbackQuery(queryId: string, text?: string) {
  try {
    await fetch(`${TELEGRAM_API_URL}/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: queryId,
        text,
      }),
    });
  } catch (error) {
    console.error('Telegram answerCallbackQuery error:', error);
  }
}
