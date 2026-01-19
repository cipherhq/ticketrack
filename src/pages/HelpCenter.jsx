import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  Search, ChevronDown, ChevronUp, Ticket, Users, Megaphone, Settings, ArrowRightLeft, Send, CalendarPlus, Star,
  ShoppingCart, CreditCard, RotateCcw, QrCode, Calendar, BarChart3,
  FileText, Download, CheckCircle, UserPlus, Link as LinkIcon, Wallet,
  HelpCircle, Mail, Shield, Bell, Eye, Plus, Edit, Trash2, Clock,
  Image as ImageIcon, Building, ClipboardList, Monitor, MapPin
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// Help content organized by category
const helpContent = {
  attendees: {
    title: 'Attendees',
    icon: Ticket,
    description: 'Everything you need to know about finding events, buying tickets, and managing your bookings.',
    color: 'bg-blue-500',
    articles: [
      {
        id: 'browse-events',
        title: 'How to Browse and Find Events',
        icon: Search,
        steps: [
          'Go to the homepage or click "Browse Events" in the navigation menu.',
          'Use the search bar to search by event name, location, or category.',
          'Filter events by date, price range, or category using the filter options.',
          'Click on any event card to view full details.'
        ],
        screenshot: '/help/browse-events.png',
        tips: ['Use specific keywords for better search results', 'Check the "Free Events" filter if you\'re looking for free activities']
      },
      {
        id: 'buy-tickets',
        title: 'How to Purchase Tickets',
        icon: ShoppingCart,
        steps: [
          'Navigate to the event page you want to attend.',
          'Select the ticket type and quantity you want.',
          'Click "Buy Tickets" or "Add to Cart".',
          'Fill in your contact information (name, email, phone).',
          'Complete any custom questions the organizer has set up.',
          'Choose your payment method (Card, Bank Transfer, or USSD).',
          'Complete the payment to receive your tickets via email.'
        ],
        screenshot: '/help/buy-tickets.png',
        tips: ['Make sure your email is correct - tickets will be sent there', 'Save your order confirmation for reference']
      },
      {
        id: 'view-tickets',
        title: 'How to View My Tickets',
        icon: Ticket,
        steps: [
          'Log into your Ticketrack account.',
          'Click on "My Tickets" in the navigation menu.',
          'View all your upcoming and past event tickets.',
          'Click on any ticket to see details and QR code.',
          'You can download your ticket or add it to your calendar.'
        ],
        screenshot: '/help/my-tickets.png',
        tips: ['Keep your QR code ready for check-in at the event', 'Screenshots of your QR code work for check-in too']
      },
      {
        id: 'request-refund',
        title: 'How to Request a Refund',
        icon: RotateCcw,
        steps: [
          'Go to "My Tickets" and find the ticket you want to refund.',
          'Click the "Request Refund" button (only available for eligible tickets).',
          'Review the refund amount (a processing fee may apply).',
          'Enter a reason for your refund request.',
          'Submit your request - the organizer will review it.',
          'You\'ll receive an email notification once approved or rejected.'
        ],
        screenshot: '/help/request-refund.png',
        tips: ['Refund requests must be made before the deadline (usually 48 hours before the event)', 'Keep your reason clear and honest for faster processing'],
        important: 'Not all events allow refunds. Check the event\'s refund policy before purchasing.'
      },
      {
        id: 'escalate-refund',
        title: 'How to Escalate a Refund Request',
        icon: Shield,
        steps: [
          'If your refund was rejected and you believe it should be approved, you can escalate.',
          'Go to "My Tickets" and find the rejected refund.',
          'Click "Escalate to Admin" button.',
          'Provide a detailed reason why you think the refund should be reconsidered.',
          'Our admin team will review your case and make a final decision.',
          'You\'ll be notified via email of the outcome.'
        ],
        screenshot: '/help/escalate-refund.png',
        tips: ['Provide documentation if available (e.g., emergency proof)', 'Escalations are reviewed within 3-5 business days']
      },
      {
        id: 'check-refund-status',
        title: 'How to Check Refund Status',
        icon: Eye,
        steps: [
          'Go to "My Tickets" in your account.',
          'Find the ticket with a pending refund.',
          'Look for the refund status badge (Pending, Approved, Rejected, or Processed).',
          'Click on the ticket to see detailed refund information and notes from the organizer.'
        ],
        screenshot: '/help/refund-status.png',
        tips: ['Pending means the organizer is reviewing', 'Approved means money is being processed', 'Processed means the refund is complete']
      },
      {
        id: 'transfer-ticket',
        title: 'How to Transfer a Ticket',
        icon: Send,
        steps: [
          'Go to "My Tickets" in your account.',
          'Find the ticket you want to transfer.',
          'Click the purple "Transfer" button.',
          'Enter the recipient\'s email address (they must have a Ticketrack account).',
          'Review the transfer details and any applicable fee.',
          'Click "Transfer Ticket" or "Pay & Transfer" if a fee applies.',
          'The ticket will be removed from your account and sent to the recipient.'
        ],
        screenshot: '/help/transfer-ticket.png',
        tips: [
          'Each ticket can only be transferred once',
          'Only the original buyer can transfer (not someone who received a transfer)',
          'The recipient must have a Ticketrack account before you can transfer'
        ],
        important: 'Once transferred, you will no longer have access to this ticket. A new QR code will be generated for the recipient.'
      },
      {
        id: 'view-transferred-tickets',
        title: 'How to View Transferred Tickets',
        icon: ArrowRightLeft,
        steps: [
          'Go to "My Tickets" in your account.',
          'Click the "Transferred" tab (purple button).',
          'View all tickets you have transferred to others.',
          'Each transfer shows: Transfer ID, old ticket code, new ticket code, recipient name, and date.'
        ],
        screenshot: '/help/transferred-tickets.png',
        tips: [
          'This is your audit trail for tickets you\'ve sent to others',
          'Received tickets will show a "Received" badge in your Active tickets'
        ]
      },
      {
        id: 'add-to-calendar',
        title: 'How to Add Event to Calendar',
        icon: CalendarPlus,
        steps: [
          'Go to any event page you\'re interested in or have tickets for.',
          'Click the "Add to Calendar" button.',
          'Choose your calendar: Google Calendar, Apple Calendar, or Outlook.',
          'The event will be added with date, time, and location details.',
          'You\'ll receive a reminder before the event starts.'
        ],
        screenshot: '/help/add-calendar.png',
        tips: [
          'Google Calendar opens in a new tab for easy adding',
          'Apple and Outlook download an .ics file - open it to add to your calendar',
          'Calendar event includes venue address and event link'
        ]
      },
      {
        id: 'recommended-events',
        title: 'How to Find Recommended Events',
        icon: Star,
        steps: [
          'Go to the Browse Events page.',
          'Scroll down to see "Recommended for You" section.',
          'These events are selected based on popularity and relevance.',
          'Click any event card to view details and buy tickets.'
        ],
        screenshot: '/help/recommended-events.png',
        tips: [
          'Recommendations update regularly with new events',
          'Check back often to discover new events in your area'
        ]
      },
      {
        id: 'payment-methods',
        title: 'Available Payment Methods',
        icon: CreditCard,
        steps: [
          'At checkout, you will see payment options based on your location.',
          'Nigeria: Pay with Card, Bank Transfer, or USSD via Paystack.',
          'Ghana/Kenya: Pay with Card or Mobile Money via Paystack.',
          'US/UK/EU: Pay with Card via Stripe or PayPal.',
          'Select your preferred method and complete payment.',
          'You will receive confirmation via email immediately.'
        ],
        screenshot: '/help/payment-methods.png',
        tips: [
          'Card payments are instant',
          'Bank transfers may take a few minutes to confirm',
          'PayPal requires a PayPal account or guest checkout'
        ],
        important: 'Payment options vary by event. The organizers country determines available methods.'
      },
      {
        id: 'follow-organizers',
        title: 'How to Follow Organizers',
        icon: UserPlus,
        steps: [
          'Visit an event page or organizer profile.',
          'Click the "Follow" button next to the organizer name.',
          'You will receive notifications when they create new events.',
          'View all organizers you follow in your Profile → Following tab.',
          'Click "Unfollow" anytime to stop receiving updates.'
        ],
        screenshot: '/help/follow-organizers.png',
        tips: [
          'Follow your favorite event creators to never miss their events',
          'You can manage all your follows from your profile'
        ]
      },
      {
        id: 'multi-currency-checkout',
        title: 'Understanding Multi-Currency Pricing',
        icon: CreditCard,
        steps: [
          'Event prices are displayed in the organizers chosen currency.',
          'Supported currencies: NGN, GHS, KES, ZAR, USD, GBP, EUR.',
          'Your bank may apply conversion fees for international purchases.',
          'The price you see at checkout is the final price in that currency.',
          'Check with your bank about international transaction fees.'
        ],
        screenshot: '/help/multi-currency.png',
        tips: [
          'Prices are always shown in the the event currency',
          'Use a card with no foreign transaction fees for international events'
        ]
      },
    ]
  },
  organizers: {
    title: 'Organizers',
    icon: Users,
    description: 'Learn how to create events, manage attendees, handle refunds, and grow your audience.',
    color: 'bg-green-500',
    articles: [
      {
        id: 'create-event',
        title: 'How to Create an Event',
        icon: Plus,
        steps: [
          'Log in and go to your Organizer Dashboard.',
          'Click "+ Create Event" button.',
          'Fill in Basic Info: title, description, category, and event image.',
          'Set Date & Time: start date, end date, and timezone.',
          'Add Location: venue name, address, or mark as virtual event.',
          'Configure Tickets: add ticket types with names, prices, and quantities.',
          'Set Visibility: public, unlisted, password-protected, or invite-only.',
          'Review and click "Publish Event" to go live!'
        ],
        screenshot: '/help/create-event.png',
        tips: ['Use a high-quality event image (1200x630px recommended)', 'Write a compelling description to attract attendees']
      },
      {
        id: 'schedule-event-publishing',
        title: 'How to Schedule Event Publishing',
        icon: Clock,
        steps: [
          'When creating or editing an event, go to the "Visibility" section.',
          'Toggle on "Schedule Publishing" option.',
          'Set the date and time when you want the event to go live.',
          'Save/publish your event.',
          'The event will remain hidden until the scheduled date/time.',
          'At the scheduled time, it automatically becomes visible to the public.'
        ],
        screenshot: '/help/schedule-publishing.png',
        tips: [
          'Great for coordinating marketing campaigns with event launch',
          'Use for surprise event announcements',
          'You can edit the scheduled time before it goes live'
        ],
        important: 'Scheduled events show a "Scheduled" badge in your Events list. You can still edit them before they go live.'
      },
      {
        id: 'custom-checkout-forms',
        title: 'How to Add Custom Checkout Questions',
        icon: FileText,
        steps: [
          'When creating/editing an event, go to the "Ticketing" tab.',
          'Scroll down to "Custom Checkout Questions" section.',
          'Click "Add Question" to create a new field.',
          'Choose field type: Text (short answer) or Dropdown (multiple choice).',
          'Enter the question label (e.g., "T-Shirt Size").',
          'For dropdowns, add the options (e.g., Small, Medium, Large).',
          'Toggle "Required" if attendees must answer.',
          'Drag to reorder questions as needed.',
          'Save your event - questions will appear at checkout!'
        ],
        screenshot: '/help/custom-forms.png',
        tips: ['Keep questions minimal to avoid checkout abandonment', 'Use dropdowns when you have specific options'],
        example: 'Common custom questions: T-Shirt Size, Meal Preference, Dietary Restrictions, Emergency Contact'
      },
      {
        id: 'view-custom-responses',
        title: 'How to View Custom Form Responses',
        icon: Eye,
        steps: [
          'Go to Organizer Dashboard → Attendees.',
          'Find attendees who purchased tickets for events with custom questions.',
          'Look for the blue Eye icon (👁️) in the Actions column.',
          'Click the Eye icon to expand and see all their responses.',
          'Responses show the question label and their answer.'
        ],
        screenshot: '/help/view-responses.png',
        tips: ['Not all attendees will have the eye icon - only those who answered custom questions', 'Use the event filter to focus on specific events']
      },
      {
        id: 'export-attendees',
        title: 'How to Export Attendees to CSV',
        icon: Download,
        steps: [
          'Go to Organizer Dashboard → Attendees.',
          'Optionally filter by specific event using the dropdown.',
          'Click the "Export CSV" button.',
          'The download will include: Name, Email, Phone, Event, Ticket Type, and any Custom Form responses.',
          'Open the CSV in Excel, Google Sheets, or any spreadsheet app.'
        ],
        screenshot: '/help/export-csv.png',
        tips: ['Filter by event first to get a focused export', 'Custom form columns only appear if attendees answered questions']
      },
      {
        id: 'manage-refunds',
        title: 'How to Approve or Reject Refund Requests',
        icon: RotateCcw,
        steps: [
          'Go to Organizer Dashboard → Refunds.',
          'View pending refund requests from your attendees.',
          'Click on a request to see details (ticket info, reason, amount).',
          'Choose to "Approve" or "Reject" the request.',
          'Add a note explaining your decision (optional but recommended).',
          'Submit - the attendee will be notified via email.',
          'Approved refunds are processed by admin.'
        ],
        screenshot: '/help/organizer-refunds.png',
        tips: ['Respond quickly to maintain good attendee relationships', 'Clear notes help if the refund is escalated'],
        important: 'Approved refunds will be deducted from your payout. Reject only with valid reason.'
      },
      {
        id: 'check-in-attendees',
        title: 'How to Check-In Attendees',
        icon: QrCode,
        steps: [
          'Go to Organizer Dashboard → Check-In.',
          'Select the event from the dropdown.',
          'Use your phone/tablet camera to scan attendee QR codes.',
          'Or manually search by name/email/ticket code.',
          'Click "Check In" to mark attendance.',
          'Green checkmark confirms successful check-in.'
        ],
        screenshot: '/help/check-in.png',
        tips: ['Test the scanner before the event', 'Have a backup plan (manual search) in case of scanning issues']
      },
      {
        id: 'view-analytics',
        title: 'How to View Event Analytics',
        icon: BarChart3,
        steps: [
          'Go to Organizer Dashboard → Analytics.',
          'Select the event you want to analyze.',
          'View key metrics: total sales, tickets sold, revenue, check-ins.',
          'See sales trends over time in the chart.',
          'Review ticket type breakdown and referral sources.'
        ],
        screenshot: '/help/analytics.png',
        tips: ['Check analytics regularly to understand your audience', 'Use insights to improve future events']
      },
      {
        id: 'enable-transfers',
        title: 'How to Enable/Disable Ticket Transfers',
        icon: ArrowRightLeft,
        steps: [
          'Go to Organizer Dashboard → Events.',
          'Find the event you want to update.',
          'Click the three-dot menu (⋮) on the event card.',
          'Click "Enable Transfers" to allow attendees to transfer tickets.',
          'Or click "Disable Transfers" to turn it off.',
          'The setting updates immediately - no need to save.'
        ],
        screenshot: '/help/enable-transfers.png',
        tips: [
          'Transfers are disabled by default for all events',
          'Enable transfers for events where attendees may need flexibility',
          'Disable for exclusive or VIP events where you want strict ticket control'
        ],
        important: 'Each ticket can only be transferred once. Only the original buyer can transfer.'
      },
      {
        id: 'view-event-transfers',
        title: 'How to View Ticket Transfers for Your Events',
        icon: ArrowRightLeft,
        steps: [
          'Go to Organizer Dashboard → Transfers.',
          'View all ticket transfers for your events.',
          'See details: Transfer ID, date, from/to users, old/new ticket codes.',
          'Click the eye icon (👁️) to see full transfer details.',
          'Use the search bar to find specific transfers.',
          'Click "Export" to download transfer data as CSV.'
        ],
        screenshot: '/help/organizer-transfers.png',
        tips: [
          'Monitor transfers to track ticket movement',
          'Use the audit trail for any disputes or issues',
          'Export data for record keeping'
        ]
      },
      {
        id: 'stripe-connect-setup',
        title: 'How to Set Up Direct Payouts (Stripe Connect)',
        icon: Wallet,
        steps: [
          'Go to Organizer Dashboard → Payouts.',
          'Click "Connect with Stripe" button.',
          'You will be redirected to Stripe to create or link your account.',
          'Fill in your business details (name, address, bank account).',
          'Complete identity verification if prompted.',
          'Once approved, your Stripe account is connected.',
          'Future event earnings will be paid directly to your bank account.'
        ],
        screenshot: '/help/stripe-connect.png',
        tips: [
          'Have your bank account details ready before starting',
          'Use a business email for your Stripe account',
          'Verification usually takes 1-2 business days'
        ],
        important: 'Stripe Connect is available for organizers in supported countries (US, UK, EU, and more). Nigerian organizers use Paystack payouts.'
      },
      {
        id: 'kyc-verification',
        title: 'How to Complete KYC Verification',
        icon: Shield,
        steps: [
          'Go to Organizer Dashboard → Settings or Payouts.',
          'Look for "Verify Identity" or "Complete KYC" section.',
          'Click to start the verification process.',
          'Provide required documents: Government ID, Proof of Address.',
          'Take a selfie for identity matching (if required).',
          'Submit and wait for review (usually 1-3 business days).',
          'You will receive an email once verified.'
        ],
        screenshot: '/help/kyc-verification.png',
        tips: [
          'Ensure documents are clear and not expired',
          'Use good lighting for selfie verification',
          'Business accounts may need additional documents'
        ],
        important: 'KYC verification is required to receive payouts above certain thresholds and helps protect against fraud.'
      },
      {
        id: 'view-payouts',
        title: 'How to View and Track Payouts',
        icon: Wallet,
        steps: [
          'Go to Organizer Dashboard → Payouts.',
          'View your current balance and pending payouts.',
          'See payout history with dates and amounts.',
          'Click on any payout to see which events/orders it includes.',
          'Track payout status: Pending, Processing, Completed, Failed.'
        ],
        screenshot: '/help/view-payouts.png',
        tips: [
          'Payouts are processed after events complete',
          'Keep your bank details up to date',
          'Contact support if a payout fails'
        ]
      },
      {
        id: 'multi-currency',
        title: 'How Multi-Currency Pricing Works',
        icon: CreditCard,
        steps: [
          'When creating an event, select your event country/currency.',
          'Set ticket prices in your local currency (NGN, GHS, KES, USD, GBP, EUR, ZAR).',
          'Attendees see prices in the the event currency.',
          'Payment is processed in the event currency.',
          'You receive payouts in your connected bank account currency.',
          'Conversion rates are handled automatically by payment providers.'
        ],
        screenshot: '/help/multi-currency.png',
        tips: [
          'Choose the currency your target audience uses',
          'International events can use USD, GBP, or EUR',
          'Regional events typically use local currencies (NGN, GHS, KES, ZAR, etc.)'
        ],
        important: 'Currency is set per event and cannot be changed after tickets are sold.'
      },
      {
        id: 'create-recurring-events',
        title: 'How to Create Recurring Events',
        icon: Calendar,
        steps: [
          'When creating an event, go to the "Date & Time" section.',
          'Toggle on "This is a recurring event".',
          'Select recurring pattern: Daily, Weekly, Biweekly, or Monthly.',
          'For weekly/biweekly, choose which days of the week (e.g., Monday, Wednesday, Friday).',
          'Choose end type: After X occurrences or Until a specific date.',
          'Set the number of occurrences or end date.',
          'Each recurring date will have its own ticket inventory and can be purchased separately.',
          'Save your event - attendees will see all available dates to choose from.'
        ],
        screenshot: '/help/recurring-events.png',
        tips: [
          'Use recurring events for classes, workshops, or regular meetups',
          'Each date is treated as a separate event instance with its own tickets',
          'Promo codes from the parent event apply to all child event dates',
          'Waitlists are separate per date'
        ],
        important: 'You cannot change a regular event to recurring after tickets are sold. Plan ahead!'
      },
      {
        id: 'create-multi-day-events',
        title: 'How to Create Multi-Day Events',
        icon: Calendar,
        steps: [
          'When creating an event, go to the "Date & Time" section.',
          'Toggle on "This is a multi-day event".',
          'Set your start date and time.',
          'Click "Add Event Day" for each day of your event.',
          'For each day, set: date, start time, end time, and optional activities/description.',
          'The event end date will automatically use the last day you added.',
          'Attendees can buy tickets for the full event duration.',
          'Save your event - it will show as a multi-day event on the public page.'
        ],
        screenshot: '/help/multi-day-events.png',
        tips: [
          'Perfect for festivals, conferences, or workshops spanning multiple days',
          'You can add activities for each day to show what happens when',
          'Tickets are for the entire event, not individual days',
          'You cannot make an event multi-day after it\'s published if tickets are sold'
        ],
        important: 'Multi-day events and recurring events cannot be combined. Choose one format.'
      },
      {
        id: 'venue-layout-designer',
        title: 'How to Design Venue Layouts',
        icon: ImageIcon,
        steps: [
          'Go to Organizer Dashboard → Venues.',
          'Select a venue or create a new one.',
          'Click "Design Layout" or "Create Layout".',
          'Use the object library to add furniture: chairs, tables, stages, etc.',
          'Drag and drop objects onto the canvas.',
          'Resize and rotate objects as needed.',
          'Add labels to sections (e.g., "VIP", "General Admission").',
          'Name your layout and click "Save".',
          'You can export the layout as a PDF to share with your team or venue.'
        ],
        screenshot: '/help/venue-designer.png',
        tips: [
          'Use the AI assistant for layout suggestions based on your event type',
          'The questionnaire feature can auto-generate layouts based on your answers',
          'Export PDFs for printing or sharing with venue staff',
          'Each venue can have multiple layout designs'
        ]
      },
      {
        id: 'manual-ticket-sales',
        title: 'How to Sell Tickets Manually to Attendees',
        icon: Ticket,
        steps: [
          'Go to Organizer Dashboard → Events.',
          'Find the event you want to sell tickets for.',
          'Click the three-dot menu (⋮) and select "Issue Ticket".',
          'Choose mode: "Complimentary" (free) or "Sell Ticket" (paid).',
          'Select the ticket type and quantity.',
          'Enter attendee details: name, email, phone.',
          'If selling, select payment method (Cash, Bank Transfer, Card, etc.).',
          'Enter payment reference if applicable.',
          'Click "Issue Ticket" - the attendee will receive their ticket via email.'
        ],
        screenshot: '/help/manual-tickets.png',
        tips: [
          'Use for on-site sales or special cases',
          'Manual sales are tracked in your Orders and Analytics',
          'Payment references help you reconcile sales later',
          'Tickets issued manually appear in your attendee list'
        ]
      },
      {
        id: 'waitlist-management',
        title: 'How to Manage Waitlists',
        icon: UserPlus,
        steps: [
          'When your event sells out, attendees can join the waitlist automatically.',
          'Go to Organizer Dashboard → Events → select your event.',
          'View waitlist entries: see number of people waiting and their positions.',
          'If you have more tickets or cancellations, release them to waitlist members.',
          'Waitlist members are notified via email when tickets become available.',
          'Each recurring event date has its own separate waitlist.'
        ],
        screenshot: '/help/waitlist-management.png',
        tips: [
          'Monitor waitlist size to gauge demand for future events',
          'Consider creating additional dates if waitlist is long',
          'Waitlist members have priority access to newly released tickets'
        ]
      },
      {
        id: 'auto-refund-cancellation',
        title: 'Automatic Refunds on Event Cancellation',
        icon: RotateCcw,
        steps: [
          'When you cancel an event, refunds are processed automatically.',
          'Go to Organizer Dashboard → Events → find your event.',
          'Click "Cancel Event" and confirm cancellation.',
          'The system automatically processes refunds for all ticket purchases.',
          'Refunds are sent back to the original payment method.',
          'Attendees are notified via email about the cancellation and refund.',
          'Refund processing may take 5-10 business days depending on payment method.'
        ],
        screenshot: '/help/auto-refund.png',
        tips: [
          'Cancellation should be a last resort - consider rescheduling first',
          'Attendees appreciate prompt cancellation notifications',
          'All refunds are tracked in your Refunds dashboard',
          'For recurring events, you can cancel individual dates or the entire series'
        ],
        important: 'Cancelled events cannot be undone. All ticket holders will receive automatic refunds.'
      },
      {
        id: 'virtual-events',
        title: 'How to Create Virtual Events',
        icon: Monitor,
        steps: [
          'When creating an event, go to the "Venue Details" section.',
          'Toggle on "This is a virtual/online event".',
          'Enter your streaming URL (Zoom, YouTube, Vimeo, etc.).',
          'Select the streaming platform type.',
          'Add any access instructions or meeting details.',
          'Virtual events don\'t require a physical venue address.',
          'Attendees will receive the streaming link in their ticket confirmation.',
          'You can still add a city/country for event discovery purposes.'
        ],
        screenshot: '/help/virtual-events.png',
        tips: [
          'Test your streaming link before the event',
          'Include clear instructions for attendees on how to join',
          'Virtual events can still have ticketing and pricing',
          'Consider timezone when scheduling virtual events for global audiences'
        ]
      },
      {
        id: 'free-donation-events',
        title: 'How to Create Free or Donation-Based Events',
        icon: Ticket,
        steps: [
          'When creating an event, go to the "Ticketing" section.',
          'Toggle on "This is a free event" for completely free events.',
          'Or toggle on "Accept Donations" to allow optional donations.',
          'For donation events, set suggested donation amounts.',
          'Choose if you want to allow custom donation amounts.',
          'Free events use RSVP instead of ticket purchase.',
          'Donation events still require "purchase" but amount is optional.',
          'Both types track attendance and send confirmations via email.'
        ],
        screenshot: '/help/free-events.png',
        tips: [
          'Free events have capacity limits - set a maximum RSVP count',
          'Donation events help cover costs while keeping events accessible',
          'Both types can still have waitlists if capacity is reached',
          'Attendees receive confirmation emails for both free and donation events'
        ]
      },
      {
        id: 'venue-management',
        title: 'How to Manage Venues',
        icon: Building,
        steps: [
          'Go to Organizer Dashboard → Venues.',
          'Click "Create Venue" to add a new venue.',
          'Enter venue details: name, address, capacity, type (indoor/outdoor).',
          'Save your venue - you can reuse it for multiple events.',
          'Each venue can have multiple layout designs.',
          'Click "Design Layout" to create floor plans for the venue.',
          'When creating events, select from your saved venues.',
          'Update venue information anytime by clicking "Edit".'
        ],
        screenshot: '/help/venue-management.png',
        tips: [
          'Save venues you use frequently for faster event creation',
          'Link Google Maps to your venue address for easy navigation',
          'Upload venue photos to help attendees find the location',
          'Track which events use which venues in your analytics'
        ]
      },
      {
        id: 'project-manager',
        title: 'How to Use the Project Manager',
        icon: ClipboardList,
        steps: [
          'Go to Organizer Dashboard → Projects.',
          'You\'ll see all your events as projects in a Kanban board.',
          'Each event has tasks organized by phase: Pre-Event, During Event, Post-Event.',
          'Click "Add Task" to create tasks for an event.',
          'Assign tasks to team members, set due dates, and priorities.',
          'Drag tasks between columns (Pending, In Progress, Completed) as you work.',
          'Add subtasks, comments, and labels to organize your work.',
          'Track progress with the progress bar on each event card.'
        ],
        screenshot: '/help/project-manager.png',
        tips: [
          'Use templates to quickly create common task lists',
          'Assign tasks to team members for collaboration',
          'Add comments and notes to keep everyone in sync',
          'Mark tasks as completed to track overall event progress'
        ]
      },
      {
        id: 'team-management',
        title: 'How to Manage Your Team',
        icon: Users,
        steps: [
          'Go to Organizer Dashboard → Team.',
          'Click "Invite Team Member" to add someone new.',
          'Enter their email and select their role (Manager, Staff, etc.).',
          'Choose permissions: what they can access and edit.',
          'Send invitation - they\'ll receive an email to accept.',
          'Once accepted, they can access the dashboard based on their permissions.',
          'View all team members and their roles.',
          'Remove team members or change permissions anytime.'
        ],
        screenshot: '/help/team-management.png',
        tips: [
          'Use roles to control access - managers can create events, staff can only check-in',
          'Team members can be assigned to specific events or have access to all',
          'Track team activity in your dashboard',
          'Revoke access immediately if needed for security'
        ]
      },
      {
        id: 'post-event-dashboard',
        title: 'How to Use the Post-Event Dashboard',
        icon: BarChart3,
        steps: [
          'After your event ends, go to Organizer Dashboard → Events.',
          'Find your completed event and click "Post-Event Dashboard".',
          'View comprehensive event analytics: attendance, revenue, check-ins.',
          'See attendee feedback and ratings (if collected).',
          'Review check-in statistics and no-shows.',
          'Export final attendee lists and reports.',
          'Track refunds and final revenue calculations.',
          'Use insights to improve future events.'
        ],
        screenshot: '/help/post-event.png',
        tips: [
          'Check the post-event dashboard within 48 hours of event completion',
          'Compare actual attendance vs. tickets sold to understand no-shows',
          'Export data for accounting and record-keeping',
          'Use feedback to plan your next event'
        ]
      },
    ]
  },
  promoters: {
    title: 'Promoters',
    icon: Megaphone,
    description: 'Earn commissions by promoting events. Learn how to get started and track your earnings.',
    color: 'bg-purple-500',
    articles: [
      {
        id: 'become-promoter',
        title: 'How to Become a Promoter',
        icon: UserPlus,
        steps: [
          'Log into your Ticketrack account.',
          'Navigate to the Promoter section.',
          'Click "Become a Promoter" or "Apply Now".',
          'Fill in your details: name, phone, preferred payment method.',
          'Submit your application.',
          'Once approved, you\'ll have access to the Promoter Dashboard.'
        ],
        screenshot: '/help/become-promoter.png',
        tips: ['Make sure your contact info is correct for payouts', 'Approval usually happens within 24 hours']
      },
      {
        id: 'get-promo-link',
        title: 'How to Get Your Promo Link',
        icon: LinkIcon,
        steps: [
          'Go to your Promoter Dashboard.',
          'Browse available events you can promote.',
          'Click "Get Link" on any event.',
          'Copy your unique promotional link.',
          'Share on social media, WhatsApp, email, etc.',
          'Anyone who buys through your link earns you commission!'
        ],
        screenshot: '/help/promo-link.png',
        tips: ['Your link is unique - don\'t share someone else\'s link', 'Track which platforms work best for you']
      },
      {
        id: 'track-referrals',
        title: 'How to Track Your Referrals',
        icon: Eye,
        steps: [
          'Go to your Promoter Dashboard.',
          'View "My Referrals" section.',
          'See all purchases made through your links.',
          'Check status: Pending (unpaid), Confirmed, or Paid.',
          'Filter by event or date range.'
        ],
        screenshot: '/help/track-referrals.png',
        tips: ['Referrals may take a few minutes to appear', 'Pending referrals become confirmed after event ends']
      },
      {
        id: 'view-commissions',
        title: 'How to View Your Commissions',
        icon: Wallet,
        steps: [
          'Go to your Promoter Dashboard.',
          'View the Earnings Summary at the top.',
          'See breakdown: Total Earned, Pending, Available for Payout.',
          'Click on individual referrals to see commission details.',
          'Commission rate varies by event (usually 5-15%).'
        ],
        screenshot: '/help/commissions.png',
        tips: ['Commissions are calculated after deducting refunds', 'Different events may have different commission rates']
      },
      {
        id: 'request-payout',
        title: 'How to Request a Payout',
        icon: CreditCard,
        steps: [
          'Go to Promoter Dashboard → Payouts.',
          'Ensure you have "Available" balance (not just pending).',
          'Click "Request Payout".',
          'Enter the amount you want to withdraw.',
          'Confirm your bank details are correct.',
          'Submit request - payouts are processed weekly.',
          'You\'ll receive a confirmation email when paid.'
        ],
        screenshot: '/help/request-payout.png',
        tips: ['Minimum payout amount may apply', 'Make sure your bank details are up to date'],
        important: 'Payouts are processed every Monday. Requests made after Monday will be included in the next cycle.'
      }
    ]
  },
  general: {
    title: 'General',
    icon: Settings,
    description: 'Account settings, security, notifications, and getting help.',
    color: 'bg-gray-500',
    articles: [
      {
        id: 'account-settings',
        title: 'How to Update Account Settings',
        icon: Settings,
        steps: [
          'Click on your profile icon in the top navigation.',
          'Select "Settings" or "Account Settings".',
          'Update your profile: name, email, phone number.',
          'Change your password if needed.',
          'Save changes.'
        ],
        screenshot: '/help/account-settings.png',
        tips: ['Use a strong password with numbers and symbols', 'Keep your email up to date for important notifications']
      },
      {
        id: 'notifications',
        title: 'How to Manage Notifications',
        icon: Bell,
        steps: [
          'Go to Account Settings → Notifications.',
          'Toggle which notifications you want to receive.',
          'Options include: Email alerts, SMS reminders, Marketing updates.',
          'Save your preferences.'
        ],
        screenshot: '/help/notifications.png',
        tips: ['Keep event reminders on so you don\'t miss your events', 'You can unsubscribe from marketing but still get important alerts']
      },
      {
        id: 'contact-support',
        title: 'How to Contact Support',
        icon: Mail,
        steps: [
          'Click "Help" or "Support" in the navigation.',
          'Browse FAQs to see if your question is answered.',
          'If not, click "Contact Us" or use the chat widget.',
          'Describe your issue in detail.',
          'Include order number or event name if relevant.',
          'Our team typically responds within 24 hours.'
        ],
        screenshot: '/help/contact-support.png',
        tips: ['Include screenshots if you\'re experiencing a bug', 'The more detail you provide, the faster we can help']
      },
      {
        id: 'security',
        title: 'Security & Privacy Tips',
        icon: Shield,
        steps: [
          'Use a unique password for your Ticketrack account.',
          'Never share your login credentials with anyone.',
          'Log out from shared or public computers.',
          'Report suspicious activity to support immediately.',
          'Keep your email secure - it\'s used for password recovery.'
        ],
        screenshot: '/help/security.png',
        tips: ['Enable two-factor authentication if available', 'Review your login history periodically']
      }
    ]
  }
};

// Accordion Component
function Accordion({ article, isOpen, onToggle }) {
  return (
    <div className="border border-[#0F0F0F]/10 rounded-xl overflow-hidden mb-3">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 bg-white hover:bg-[#F4F6FA]/50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#2969FF]/10 flex items-center justify-center">
            <article.icon className="w-5 h-5 text-[#2969FF]" />
          </div>
          <span className="font-medium text-[#0F0F0F]">{article.title}</span>
        </div>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-[#0F0F0F]/60" />
        ) : (
          <ChevronDown className="w-5 h-5 text-[#0F0F0F]/60" />
        )}
      </button>
      
      {isOpen && (
        <div className="p-4 pt-0 bg-white">
          {/* Steps */}
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-[#0F0F0F]/60 uppercase tracking-wide mb-3">Steps</h4>
            <ol className="space-y-2">
              {article.steps.map((step, idx) => (
                <li key={idx} className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#2969FF] text-white text-sm flex items-center justify-center font-medium">
                    {idx + 1}
                  </span>
                  <span className="text-[#0F0F0F]/80 pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Screenshot Placeholder */}
          {article.screenshot && (
            <div className="mb-4 p-6 bg-[#F4F6FA] rounded-xl border-2 border-dashed border-[#0F0F0F]/20 text-center">
              <ImageIcon className="w-8 h-8 text-[#0F0F0F]/30 mx-auto mb-2" />
              <p className="text-sm text-[#0F0F0F]/50">Screenshot: {article.screenshot}</p>
              <p className="text-xs text-[#0F0F0F]/40 mt-1">Image will be added here</p>
            </div>
          )}

          {/* Tips */}
          {article.tips && article.tips.length > 0 && (
            <div className="mb-4 p-4 bg-blue-50 rounded-xl">
              <h4 className="text-sm font-semibold text-blue-700 mb-2 flex items-center gap-2">
                <HelpCircle className="w-4 h-4" /> Tips
              </h4>
              <ul className="space-y-1">
                {article.tips.map((tip, idx) => (
                  <li key={idx} className="text-sm text-blue-700 flex items-start gap-2">
                    <span className="text-blue-400">•</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Example */}
          {article.example && (
            <div className="mb-4 p-4 bg-green-50 rounded-xl">
              <h4 className="text-sm font-semibold text-green-700 mb-1">Example</h4>
              <p className="text-sm text-green-700">{article.example}</p>
            </div>
          )}

          {/* Important Note */}
          {article.important && (
            <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
              <h4 className="text-sm font-semibold text-amber-700 mb-1 flex items-center gap-2">
                <Shield className="w-4 h-4" /> Important
              </h4>
              <p className="text-sm text-amber-700">{article.important}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function HelpCenter() {
  const [activeTab, setActiveTab] = useState('attendees');
  const [searchTerm, setSearchTerm] = useState('');
  const [openArticles, setOpenArticles] = useState({});

  // Filter articles based on search
  const filteredContent = useMemo(() => {
    if (!searchTerm.trim()) return null;
    
    const results = [];
    const term = searchTerm.toLowerCase();
    
    Object.entries(helpContent).forEach(([category, data]) => {
      data.articles.forEach(article => {
        const matchTitle = article.title.toLowerCase().includes(term);
        const matchSteps = article.steps.some(s => s.toLowerCase().includes(term));
        const matchTips = article.tips?.some(t => t.toLowerCase().includes(term));
        
        if (matchTitle || matchSteps || matchTips) {
          results.push({ ...article, category, categoryTitle: data.title, categoryColor: data.color });
        }
      });
    });
    
    return results;
  }, [searchTerm]);

  const toggleArticle = (articleId) => {
    setOpenArticles(prev => ({ ...prev, [articleId]: !prev[articleId] }));
  };

  const currentCategory = helpContent[activeTab];

  return (
    <div className="min-h-screen bg-[#F4F6FA]">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#2969FF] to-[#1a4fd6] text-white py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-4xl font-bold mb-4">Help Center</h1>
          <p className="text-white/80 text-lg mb-8">
            Find answers, guides, and tips on how to use Ticketrack
          </p>
          
          {/* Search */}
          <div className="relative max-w-xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#0F0F0F]/40" />
            <Input
              type="text"
              placeholder="Search for help articles..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 pr-4 py-3 h-14 rounded-2xl bg-white text-[#0F0F0F] border-0 shadow-lg text-lg"
            />
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Search Results */}
        {filteredContent && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-[#0F0F0F]">
                Search Results ({filteredContent.length})
              </h2>
              <Button 
                variant="ghost" 
                onClick={() => setSearchTerm('')}
                className="text-[#2969FF]"
              >
                Clear Search
              </Button>
            </div>
            
            {filteredContent.length === 0 ? (
              <Card className="border-[#0F0F0F]/10 rounded-2xl">
                <CardContent className="p-8 text-center">
                  <Search className="w-12 h-12 text-[#0F0F0F]/20 mx-auto mb-4" />
                  <p className="text-[#0F0F0F]/60">No results found for "{searchTerm}"</p>
                  <p className="text-sm text-[#0F0F0F]/40 mt-2">Try different keywords or browse categories below</p>
                </CardContent>
              </Card>
            ) : (
              <div>
                {filteredContent.map(article => (
                  <div key={article.id} className="mb-2">
                    <Badge className={`${article.categoryColor} text-white mb-2`}>
                      {article.categoryTitle}
                    </Badge>
                    <Accordion
                      article={article}
                      isOpen={openArticles[article.id]}
                      onToggle={() => toggleArticle(article.id)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Category Tabs */}
        {!filteredContent && (
          <>
            <div className="flex flex-wrap gap-2 mb-8 justify-center">
              {Object.entries(helpContent).map(([key, category]) => {
                const Icon = category.icon;
                return (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    className={`flex items-center gap-2 px-5 py-3 rounded-xl font-medium transition-all ${
                      activeTab === key
                        ? 'bg-[#2969FF] text-white shadow-lg shadow-[#2969FF]/25'
                        : 'bg-white text-[#0F0F0F]/70 hover:bg-[#0F0F0F]/5 border border-[#0F0F0F]/10'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {category.title}
                  </button>
                );
              })}
            </div>

            {/* Category Header */}
            <Card className="border-[#0F0F0F]/10 rounded-2xl mb-6 overflow-hidden">
              <div className={`${currentCategory.color} p-6`}>
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center">
                    <currentCategory.icon className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">{currentCategory.title}</h2>
                    <p className="text-white/80">{currentCategory.description}</p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Articles */}
            <div>
              {currentCategory.articles.map(article => (
                <Accordion
                  key={article.id}
                  article={article}
                  isOpen={openArticles[article.id]}
                  onToggle={() => toggleArticle(article.id)}
                />
              ))}
            </div>
          </>
        )}

        {/* Still Need Help */}
        <Card className="border-[#0F0F0F]/10 rounded-2xl mt-8 overflow-hidden">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-[#2969FF]/10 flex items-center justify-center mx-auto mb-4">
              <Mail className="w-8 h-8 text-[#2969FF]" />
            </div>
            <h3 className="text-xl font-semibold text-[#0F0F0F] mb-2">Still Need Help?</h3>
            <p className="text-[#0F0F0F]/60 mb-6">
              Cannot find what you are looking for? Our support team is here to help.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button 
                className="bg-[#2969FF] hover:bg-[#1a4fd6] text-white rounded-xl px-6"
                asChild
              >
                <a href="mailto:support@ticketrack.com">
                  <Mail className="w-4 h-4 mr-2" /> Email Support
                </a>
              </Button>
              <Button 
                variant="outline" 
                className="rounded-xl px-6 border-[#0F0F0F]/20"
                asChild
              >
                <Link to="/contact">
                  <HelpCircle className="w-4 h-4 mr-2" /> Contact Us
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Footer Note */}
        <p className="text-center text-sm text-[#0F0F0F]/40 mt-8">
          Last updated: January 2025 • Ticketrack Help Center
        </p>
      </div>
    </div>
  );
}
