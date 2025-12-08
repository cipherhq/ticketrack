// WhatsApp Cloud API Service for Ticketrack
const WHATSAPP_API_URL = 'https://graph.facebook.com/v21.0';

export async function sendWhatsAppMessage(to, message) {
  const phoneId = import.meta.env.VITE_WHATSAPP_PHONE_ID;
  const token = import.meta.env.VITE_WHATSAPP_TOKEN;
  if (!phoneId || !token) throw new Error('WhatsApp credentials not configured');

  const formattedPhone = to.replace(/[\s+\-]/g, '');
  const response = await fetch(`${WHATSAPP_API_URL}/${phoneId}/messages`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: formattedPhone,
      type: 'text',
      text: { preview_url: false, body: message }
    })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'Failed to send');
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

Thank you for booking with Ticketrack! 🙌`;
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
