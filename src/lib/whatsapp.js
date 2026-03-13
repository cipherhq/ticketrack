// WhatsApp Cloud API Service for ticketRack
// Uses Supabase Edge Function for secure API key handling
import { supabase } from './supabase';

export async function sendWhatsAppMessage(to, message) {
  const { data, error } = await supabase.functions.invoke('send-whatsapp', {
    body: { to, message }
  });
  
  if (error) throw new Error(error.message || 'Failed to send WhatsApp message');
  if (!data?.success) throw new Error(data?.error || 'Failed to send');
  
  return data;
}

export async function sendTicketConfirmation(phone, ticketData) {
  const { attendeeName, eventName, eventDate, eventVenue, ticketType, ticketCode, quantity = 1 } = ticketData;
  const message = `🎫 *Ticket Confirmed!*

Hi ${attendeeName},

Your ticket for *${eventName}* has been confirmed!

📅 *Date:* ${eventDate}
📍 *Venue:* ${eventVenue}
🎟️ *Ticket:* ${ticketType}${quantity > 1 ? ' (x' + quantity + ')' : ''}
🔑 *Code:* ${ticketCode}

Please show this message or your QR code at the venue.

Thank you for booking with ticketRack! 🙌`;
  return sendWhatsAppMessage(phone, message);
}

export async function sendEventReminder(phone, eventData) {
  const { attendeeName, eventName, eventDate, eventTime, eventVenue, ticketCode } = eventData;
  const message = `⏰ *Event Reminder*

Hi ${attendeeName},

*${eventName}* is coming up!

📅 *Date:* ${eventDate}
🕐 *Time:* ${eventTime}
📍 *Venue:* ${eventVenue}
🔑 *Your Code:* ${ticketCode}

See you there! 🎉`;
  return sendWhatsAppMessage(phone, message);
}

export async function sendCheckInConfirmation(phone, checkInData) {
  const { attendeeName, eventName } = checkInData;
  const message = `✅ *Checked In!*

Hi ${attendeeName}, you've been checked in to *${eventName}*!

Enjoy the event! 🎊`;
  return sendWhatsAppMessage(phone, message);
}

export default { sendWhatsAppMessage, sendTicketConfirmation, sendEventReminder, sendCheckInConfirmation };
