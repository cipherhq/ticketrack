import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import DOMPurify from 'dompurify';
import {
  Mail, MessageSquare, Send, Clock, CheckCircle, Users, Calendar,
  Loader2, Sparkles, ChevronRight, ChevronLeft, Eye, Trash2, RefreshCw,
  FileText, UserCheck, Heart, AlertCircle, Plus,
  Phone, Zap, BarChart3, Target,
  Copy, Download, MoreVertical
} from 'lucide-react';
import { useConfirm } from '@/hooks/useConfirm';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useOrganizer } from '@/contexts/OrganizerContext';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { toast } from 'sonner';

// ============================================================================
// CONSTANTS
// ============================================================================

const CHANNELS = [
  { id: 'email', name: 'Email', icon: Mail, color: 'text-blue-600', bgColor: 'bg-blue-100', description: 'Send rich HTML emails' },
  { id: 'sms', name: 'SMS', icon: Phone, color: 'text-green-600', bgColor: 'bg-green-100', description: 'Send text messages (credits required)' },
  { id: 'whatsapp', name: 'WhatsApp', icon: MessageSquare, color: 'text-emerald-600', bgColor: 'bg-emerald-100', description: 'Send WhatsApp messages (credits required)' },
  { id: 'telegram', name: 'Telegram', icon: Send, color: 'text-sky-600', bgColor: 'bg-sky-100', description: 'Send Telegram messages (credits required)' },
];

const AUDIENCE_TYPES = [
  { id: 'all_contacts', label: 'All Contacts', icon: Users, description: 'Everyone in your contact list' },
  { id: 'event_attendees', label: 'Event Attendees', icon: UserCheck, description: 'People who bought tickets for an event' },
  { id: 'followers', label: 'Followers', icon: Heart, description: 'People following your organizer profile' },
  { id: 'segment', label: 'Custom Segment', icon: Target, description: 'A saved audience segment' },
];

const TEMPLATES = [
  {
    id: 'reminder',
    name: 'Event Reminder',
    icon: Clock,
    category: 'reminder',
    content: {
      email: {
        subject: 'Reminder: {{event_name}} is tomorrow!',
        body: `<p>Hi {{attendee_name}},</p>
<p>This is a friendly reminder that <strong>{{event_name}}</strong> is happening tomorrow!</p>
<p>📅 <strong>Date:</strong> {{event_date}} at {{event_time}}<br/>
📍 <strong>Venue:</strong> {{event_venue}}</p>
<p>Don't forget to bring your ticket or show your QR code at entry.</p>
<p>See you there!</p>
<p>Best regards,<br/>{{organizer_name}}</p>`
      },
      sms: {
        message: `Hi {{attendee_name}}! Reminder: {{event_name}} is tomorrow at {{event_time}}. Location: {{event_venue}}. Show your QR code at entry. See you there!`
      },
      whatsapp: {
        message: `Hi {{attendee_name}}! 👋

This is a friendly reminder that *{{event_name}}* is happening tomorrow!

📅 *Date:* {{event_date}} at {{event_time}}
📍 *Venue:* {{event_venue}}

Don't forget your ticket! See you there! 🎉`
      },
      telegram: {
        message: `Hi {{attendee_name}}! 👋

This is a friendly reminder that *{{event_name}}* is happening tomorrow!

📅 *Date:* {{event_date}} at {{event_time}}
📍 *Venue:* {{event_venue}}

Don't forget your ticket! See you there! 🎉`
      }
    }
  },
  {
    id: 'thankyou',
    name: 'Thank You',
    icon: Heart,
    category: 'thank_you',
    content: {
      email: {
        subject: 'Thank you for attending {{event_name}}!',
        body: `<p>Hi {{attendee_name}},</p>
<p>Thank you for attending <strong>{{event_name}}</strong>! We hope you had an amazing time.</p>
<p>Your support means the world to us. We'd love to hear your feedback!</p>
<p>Stay tuned for more exciting events!</p>
<p>Best regards,<br/>{{organizer_name}}</p>`
      },
      sms: {
        message: `Thank you for attending {{event_name}}! We hope you had a great time. Stay tuned for more events from {{organizer_name}}!`
      },
      whatsapp: {
        message: `Hi {{attendee_name}}! 🙏

Thank you for attending *{{event_name}}*! We hope you had an amazing time.

Your support means the world to us. Stay tuned for more exciting events!

- {{organizer_name}}`
      },
      telegram: {
        message: `Hi {{attendee_name}}! 🙏

Thank you for attending *{{event_name}}*! We hope you had an amazing time.

Your support means the world to us. Stay tuned for more exciting events!

- {{organizer_name}}`
      }
    }
  },
  {
    id: 'announcement',
    name: 'New Event',
    icon: Calendar,
    category: 'announcement',
    content: {
      email: {
        subject: "You're Invited: {{event_name}}",
        body: `<p>Hi {{attendee_name}},</p>
<p>We're excited to announce our upcoming event: <strong>{{event_name}}</strong>!</p>
<p>📅 <strong>Date:</strong> {{event_date}} at {{event_time}}<br/>
📍 <strong>Venue:</strong> {{event_venue}}</p>
<p>Early bird tickets are available now. Don't miss out!</p>
<p><a href="{{event_link}}">Get Your Tickets →</a></p>
<p>Best regards,<br/>{{organizer_name}}</p>`
      },
      sms: {
        message: `🎉 New Event Alert! {{event_name}} on {{event_date}}. Get your tickets now: {{event_link}}`
      },
      whatsapp: {
        message: `🎉 *New Event Announcement!*

*{{event_name}}*

📅 Date: {{event_date}}
⏰ Time: {{event_time}}
📍 Venue: {{event_venue}}

Early bird tickets available now!
🎟️ {{event_link}}`
      },
      telegram: {
        message: `🎉 *New Event Announcement!*

*{{event_name}}*

📅 Date: {{event_date}}
⏰ Time: {{event_time}}
📍 Venue: {{event_venue}}

Early bird tickets available now!
🎟️ {{event_link}}`
      }
    }
  },
  {
    id: 'custom',
    name: 'Custom Message',
    icon: FileText,
    category: 'custom',
    content: {
      email: { subject: '', body: '' },
      sms: { message: '' },
      whatsapp: { message: '' },
      telegram: { message: '' }
    }
  }
];

const VARIABLES = [
  { key: '{{attendee_name}}', label: 'Recipient Name' },
  { key: '{{event_name}}', label: 'Event Name' },
  { key: '{{event_date}}', label: 'Event Date' },
  { key: '{{event_time}}', label: 'Event Time' },
  { key: '{{event_venue}}', label: 'Venue Name' },
  { key: '{{event_link}}', label: 'Event Link' },
  { key: '{{organizer_name}}', label: 'Your Business Name' },
];

const QUILL_MODULES = {
  toolbar: [
    ['bold', 'italic', 'underline'],
    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
    ['link'],
    ['clean']
  ],
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function CommunicationHub() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { organizer } = useOrganizer();
  const confirm = useConfirm();

  // View state
  const [activeTab, setActiveTab] = useState('campaigns');
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);

  // Data
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [segments, setSegments] = useState([]);
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState({
    totalContacts: 0,
    totalCampaigns: 0,
    emailsSent: 0,
    smsSent: 0,
    whatsappSent: 0,
    messageCredits: 0,
    emailCredits: 0,
    smsCredits: 0,
    whatsappCredits: 0,
  });

  // Message History
  const [messageHistory, setMessageHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyChannel, setHistoryChannel] = useState('all');
  const [historyStatus, setHistoryStatus] = useState('all');
  const [historyOffset, setHistoryOffset] = useState(0);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);

  // Campaign form
  const [form, setForm] = useState({
    name: '',
    channels: [],
    audienceType: '',
    eventId: '',
    segmentId: '',
    template: '',
    content: {
      email: { subject: '', body: '' },
      sms: { message: '' },
      whatsapp: { message: '' },
      telegram: { message: '' },
    },
    scheduleFor: '',
  });

  // Recipients
  const [recipientCount, setRecipientCount] = useState(0);
  const [recipientsByChannel, setRecipientsByChannel] = useState({ email: 0, sms: 0, whatsapp: 0 });

  // AI
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // Sending
  const [sending, setSending] = useState(false);

  // Custom Templates
  const [savedTemplates, setSavedTemplates] = useState([]);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);

  // Campaign detail view
  const [viewingCampaign, setViewingCampaign] = useState(null);
  const [campaignMessages, setCampaignMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  // Refs for cursor-position variable insertion
  const quillRef = useRef(null);
  const smsRef = useRef(null);
  const whatsappRef = useRef(null);

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  useEffect(() => {
    if (organizer?.id) {
      loadData();
      // Check if we should open create wizard from URL params
      if (searchParams.get('create') === 'true') {
        setShowCreateWizard(true);
      }
    }
  }, [organizer?.id]);

  useEffect(() => {
    if (organizer?.id && form.audienceType) {
      calculateRecipients();
    }
  }, [form.audienceType, form.eventId, form.segmentId, form.channels, organizer?.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadCampaigns(),
        loadContacts(),
        loadSegments(),
        loadEvents(),
        loadStats(),
        loadSavedTemplates(),
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCampaigns = async () => {
    // Try new table first, fall back to legacy
    const { data: newCampaigns } = await supabase
      .from('communication_campaigns')
      .select('*')
      .eq('organizer_id', organizer.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (newCampaigns && newCampaigns.length > 0) {
      setCampaigns(newCampaigns);
    } else {
      // Fall back to legacy email campaigns
      const { data: legacyCampaigns } = await supabase
        .from('email_campaigns')
        .select('*')
        .eq('organizer_id', organizer.id)
        .order('created_at', { ascending: false })
        .limit(50);

      // Transform to unified format
      const transformed = (legacyCampaigns || []).map(c => ({
        ...c,
        channels: ['email'],
        content: { email: { subject: c.subject, body: c.body } },
        audience_type: c.recipient_type,
      }));
      setCampaigns(transformed);
    }
  };

  const loadContacts = async () => {
    const { data, count } = await supabase
      .from('contacts')
      .select('*', { count: 'exact' })
      .eq('organizer_id', organizer.id)
      .eq('is_active', true)
      .limit(100);

    setContacts(data || []);
    setStats(s => ({ ...s, totalContacts: count || 0 }));
  };

  const loadSegments = async () => {
    const { data } = await supabase
      .from('contact_segments')
      .select('*')
      .eq('organizer_id', organizer.id)
      .order('name');

    setSegments(data || []);
  };

  const loadEvents = async () => {
    const { data } = await supabase
      .from('events')
      .select('id, title, start_date, venue_name, city')
      .eq('organizer_id', organizer.id)
      .order('start_date', { ascending: false });

    setEvents(data || []);
  };

  const loadStats = async () => {
    // Get unified message credits balance
    const { data: creditBalance } = await supabase
      .from('communication_credit_balances')
      .select('balance, bonus_balance')
      .eq('organizer_id', organizer.id)
      .single();

    const totalCredits = (creditBalance?.balance || 0) + (creditBalance?.bonus_balance || 0);

    // Get message counts from communication_messages
    const { count: emailMsgCount } = await supabase
      .from('communication_messages')
      .select('id', { count: 'exact', head: true })
      .eq('organizer_id', organizer.id)
      .eq('channel', 'email')
      .eq('status', 'sent');

    const { count: smsMsgCount } = await supabase
      .from('communication_messages')
      .select('id', { count: 'exact', head: true })
      .eq('organizer_id', organizer.id)
      .eq('channel', 'sms')
      .eq('status', 'sent');

    const { count: waMsgCount } = await supabase
      .from('communication_messages')
      .select('id', { count: 'exact', head: true })
      .eq('organizer_id', organizer.id)
      .eq('channel', 'whatsapp')
      .eq('status', 'sent');
    
    // Also count from campaigns sent_count for email campaigns (fallback for older campaigns)
    const { data: emailCampaigns } = await supabase
      .from('communication_campaigns')
      .select('sent_count, channels')
      .eq('organizer_id', organizer.id)
      .eq('status', 'sent');
    
    const emailFromCampaigns = (emailCampaigns || [])
      .filter(c => c.channels?.includes('email'))
      .reduce((sum, c) => sum + (c.sent_count || 0), 0);
    
    const smsFromCampaigns = (emailCampaigns || [])
      .filter(c => c.channels?.includes('sms'))
      .reduce((sum, c) => sum + (c.sent_count || 0), 0);
    
    const waFromCampaigns = (emailCampaigns || [])
      .filter(c => c.channels?.includes('whatsapp'))
      .reduce((sum, c) => sum + (c.sent_count || 0), 0);
    
    // Use max of both sources to avoid double-counting
    const emailCount = Math.max(emailMsgCount || 0, emailFromCampaigns);
    const smsCount = Math.max(smsMsgCount || 0, smsFromCampaigns);
    const waCount = Math.max(waMsgCount || 0, waFromCampaigns);

    setStats(s => ({
      ...s,
      messageCredits: totalCredits,
      // Calculate how many messages can be sent with current credits
      // Email: 1 credit, SMS: 3 credits, WhatsApp Marketing: 5 credits
      emailCredits: totalCredits, // 1 credit per email
      smsCredits: Math.floor(totalCredits / 3), // 3 credits per SMS
      whatsappCredits: Math.floor(totalCredits / 5), // 5 credits per WhatsApp
      emailsSent: emailCount || 0,
      smsSent: smsCount || 0,
      whatsappSent: waCount || 0,
      totalCampaigns: campaigns.length,
    }));
  };

  // ============================================================================
  // TEMPLATE MANAGEMENT
  // ============================================================================

  const loadSavedTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('message_templates')
        .select('*')
        .eq('organizer_id', organizer.id)
        .order('created_at', { ascending: false });

      if (error) {
        // Table might not exist yet
        console.log('Could not load templates:', error.message);
        setSavedTemplates([]);
        return;
      }

      setSavedTemplates(data || []);
    } catch (err) {
      console.error('Error loading templates:', err);
      setSavedTemplates([]);
    }
  };

  const saveAsTemplate = async () => {
    if (!templateName.trim()) {
      toast.error('Please enter a template name');
      return;
    }

    setSavingTemplate(true);
    try {
      const templateData = {
        organizer_id: organizer.id,
        name: templateName.trim(),
        category: 'custom',
        content: form.content,
        channels: form.channels,
      };

      if (editingTemplate) {
        // Update existing template
        const { error } = await supabase
          .from('message_templates')
          .update(templateData)
          .eq('id', editingTemplate.id);

        if (error) throw error;
      } else {
        // Create new template
        const { error } = await supabase
          .from('message_templates')
          .insert(templateData);

        if (error) throw error;
      }

      setShowSaveTemplate(false);
      setTemplateName('');
      setEditingTemplate(null);
      await loadSavedTemplates();
      toast.success(editingTemplate ? 'Template updated!' : 'Template saved!');
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error('Failed to save template: ' + error.message);
    } finally {
      setSavingTemplate(false);
    }
  };

  const deleteTemplate = async (templateId) => {
    if (!(await confirm('Delete Template', 'Delete this template?', { variant: 'destructive' }))) return;

    try {
      const { error } = await supabase
        .from('message_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;
      await loadSavedTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error('Failed to delete template');
    }
  };

  const loadTemplateForEditing = (template) => {
    setForm(f => ({
      ...f,
      template: 'custom',
      channels: template.channels || [],
      content: template.content || {
        email: { subject: '', body: '' },
        sms: { message: '' },
        whatsapp: { message: '' },
      },
    }));
    setEditingTemplate(template);
    setTemplateName(template.name);
    setShowCreateWizard(true);
    setWizardStep(3);
  };

  const useSavedTemplate = (template) => {
    setForm(f => ({
      ...f,
      template: 'saved_' + template.id,
      channels: template.channels || [],
      content: template.content || {
        email: { subject: '', body: '' },
        sms: { message: '' },
        whatsapp: { message: '' },
      },
    }));
    setShowCreateWizard(true);
    setWizardStep(2);
  };

  const loadMessageHistory = async (reset = false) => {
    setHistoryLoading(true);
    try {
      const offset = reset ? 0 : historyOffset;
      let query = supabase
        .from('communication_messages')
        .select('id, channel, recipient_email, recipient_phone, subject, content, status, delivered_at, created_at')
        .eq('organizer_id', organizer.id)
        .order('created_at', { ascending: false })
        .range(offset, offset + 49);

      if (historyChannel !== 'all') {
        query = query.eq('channel', historyChannel);
      }
      if (historyStatus !== 'all') {
        query = query.eq('status', historyStatus);
      }

      const { data, error } = await query;
      if (error) throw error;

      const rows = data || [];
      if (reset) {
        setMessageHistory(rows);
        setHistoryOffset(rows.length);
      } else {
        setMessageHistory(prev => [...prev, ...rows]);
        setHistoryOffset(offset + rows.length);
      }
      setHasMoreHistory(rows.length === 50);
    } catch (error) {
      console.error('Error loading message history:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const calculateRecipients = async () => {
    let emailCount = 0;
    let smsCount = 0;
    let whatsappCount = 0;

    if (form.audienceType === 'all_contacts') {
      const { data, error } = await supabase
        .from('contacts')
        .select('email, phone, email_opt_in, sms_opt_in, whatsapp_opt_in')
        .eq('organizer_id', organizer.id)
        .eq('is_active', true);

      console.log('📊 Contacts data:', data, 'Error:', error);
      
      (data || []).forEach(c => {
        console.log(`  Contact: phone=${c.phone}, sms_opt_in=${c.sms_opt_in}, whatsapp_opt_in=${c.whatsapp_opt_in}`);
        if (c.email && c.email_opt_in !== false) emailCount++;
        if (c.phone && c.sms_opt_in !== false) smsCount++;
        if (c.phone && c.whatsapp_opt_in !== false) whatsappCount++;
      });
      
      console.log(`📊 Counts: email=${emailCount}, sms=${smsCount}, whatsapp=${whatsappCount}`);
    } else if (form.audienceType === 'event_attendees' && form.eventId) {
      const { data } = await supabase
        .from('tickets')
        .select('attendee_email, attendee_phone')
        .eq('event_id', form.eventId)
        .in('payment_status', ['completed', 'free', 'paid', 'complimentary']);

      emailCount = (data || []).filter(t => t.attendee_email).length;
      smsCount = (data || []).filter(t => t.attendee_phone).length;
      whatsappCount = smsCount; // Assume same as SMS for phone-based
    } else if (form.audienceType === 'followers') {
      const { data } = await supabase
        .from('followers')
        .select('profiles(email, phone)')
        .eq('organizer_id', organizer.id);

      emailCount = (data || []).filter(f => f.profiles?.email).length;
      smsCount = (data || []).filter(f => f.profiles?.phone).length;
      whatsappCount = smsCount;
    } else if (form.audienceType === 'segment' && form.segmentId) {
      const { count } = await supabase
        .from('contacts')
        .select('id', { count: 'exact', head: true })
        .eq('organizer_id', organizer.id)
        .contains('segments', [form.segmentId]);

      emailCount = count || 0;
      smsCount = Math.floor(emailCount * 0.7); // Estimate
      whatsappCount = Math.floor(emailCount * 0.5);
    }

    setRecipientsByChannel({ email: emailCount, sms: smsCount, whatsapp: whatsappCount });
    setRecipientCount(Math.max(emailCount, smsCount, whatsappCount));
  };

  // Fetch actual recipients with opt-out filtering for sending
  const fetchRecipients = async (channel) => {
    let recipients = [];

    if (form.audienceType === 'all_contacts') {
      const { data } = await supabase
        .from('contacts')
        .select('id, full_name, email, phone, email_opt_in, sms_opt_in, whatsapp_opt_in')
        .eq('organizer_id', organizer.id)
        .eq('is_active', true);

      (data || []).forEach(c => {
        if (channel === 'email' && c.email && c.email_opt_in !== false) {
          recipients.push({ id: c.id, name: c.full_name, email: c.email });
        } else if (channel === 'sms' && c.phone && c.sms_opt_in !== false) {
          recipients.push({ id: c.id, name: c.full_name, phone: c.phone });
        } else if (channel === 'whatsapp' && c.phone && c.whatsapp_opt_in !== false) {
          recipients.push({ id: c.id, name: c.full_name, phone: c.phone });
        }
      });

      // For Telegram, query profiles with linked Telegram accounts
      if (channel === 'telegram') {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, telegram_chat_id')
          .not('telegram_chat_id', 'is', null);
        (profiles || []).forEach(p => {
          recipients.push({ id: p.id, name: p.full_name, chatId: p.telegram_chat_id });
        });
      }
    } else if (form.audienceType === 'event_attendees' && form.eventId) {
      const { data } = await supabase
        .from('tickets')
        .select('id, attendee_name, attendee_email, attendee_phone, ticket_type_name')
        .eq('event_id', form.eventId)
        .in('payment_status', ['completed', 'free', 'paid', 'complimentary']);

      (data || []).forEach(t => {
        if (channel === 'email' && t.attendee_email) {
          recipients.push({ id: t.id, name: t.attendee_name, email: t.attendee_email, ticket_type: t.ticket_type_name });
        } else if ((channel === 'sms' || channel === 'whatsapp') && t.attendee_phone) {
          recipients.push({ id: t.id, name: t.attendee_name, phone: t.attendee_phone, ticket_type: t.ticket_type_name });
        }
      });

      // For Telegram, find profiles with telegram linked who bought tickets for this event
      if (channel === 'telegram') {
        const { data: ticketProfiles } = await supabase
          .from('tickets')
          .select('user_id, attendee_name, profiles:user_id(telegram_chat_id)')
          .eq('event_id', form.eventId)
          .in('payment_status', ['completed', 'free', 'paid', 'complimentary'])
          .not('profiles.telegram_chat_id', 'is', null);
        (ticketProfiles || []).forEach(t => {
          if (t.profiles?.telegram_chat_id) {
            recipients.push({ id: t.user_id, name: t.attendee_name, chatId: t.profiles.telegram_chat_id });
          }
        });
      }
    } else if (form.audienceType === 'followers') {
      const { data } = await supabase
        .from('followers')
        .select('profiles(id, full_name, email, phone, telegram_chat_id)')
        .eq('organizer_id', organizer.id);

      (data || []).forEach(f => {
        if (channel === 'email' && f.profiles?.email) {
          recipients.push({ id: f.profiles.id, name: f.profiles.full_name, email: f.profiles.email });
        } else if ((channel === 'sms' || channel === 'whatsapp') && f.profiles?.phone) {
          recipients.push({ id: f.profiles.id, name: f.profiles.full_name, phone: f.profiles.phone });
        } else if (channel === 'telegram' && f.profiles?.telegram_chat_id) {
          recipients.push({ id: f.profiles.id, name: f.profiles.full_name, chatId: f.profiles.telegram_chat_id });
        }
      });
    } else if (form.audienceType === 'segment' && form.segmentId) {
      const { data } = await supabase
        .from('contacts')
        .select('id, full_name, email, phone, email_opt_in, sms_opt_in, whatsapp_opt_in')
        .eq('organizer_id', organizer.id)
        .eq('is_active', true)
        .contains('segments', [form.segmentId]);

      (data || []).forEach(c => {
        if (channel === 'email' && c.email && c.email_opt_in !== false) {
          recipients.push({ id: c.id, name: c.full_name, email: c.email });
        } else if (channel === 'sms' && c.phone && c.sms_opt_in !== false) {
          recipients.push({ id: c.id, name: c.full_name, phone: c.phone });
        } else if (channel === 'whatsapp' && c.phone && c.whatsapp_opt_in !== false) {
          recipients.push({ id: c.id, name: c.full_name, phone: c.phone });
        }
      });
    }

    return recipients;
  };

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const toggleChannel = (channelId) => {
    setForm(f => ({
      ...f,
      channels: f.channels.includes(channelId)
        ? f.channels.filter(c => c !== channelId)
        : [...f.channels, channelId]
    }));
  };

  const selectTemplate = (templateId) => {
    const template = TEMPLATES.find(t => t.id === templateId);
    if (template) {
      setForm(f => ({
        ...f,
        template: templateId,
        content: { ...template.content },
      }));
    }
  };

  const updateContent = (channel, field, value) => {
    setForm(f => ({
      ...f,
      content: {
        ...f.content,
        [channel]: {
          ...f.content[channel],
          [field]: value,
        }
      }
    }));
  };

  const insertVariable = (channel, variable) => {
    if (channel === 'email') {
      const editor = quillRef.current?.getEditor?.();
      if (editor) {
        const selection = editor.getSelection();
        const pos = selection ? selection.index : editor.getLength() - 1;
        editor.insertText(pos, variable);
        editor.setSelection(pos + variable.length);
      } else {
        setForm(f => ({
          ...f,
          content: { ...f.content, email: { ...f.content.email, body: f.content.email.body + variable } }
        }));
      }
    } else {
      const ref = channel === 'sms' ? smsRef : whatsappRef;
      const el = ref.current;
      if (el) {
        const start = el.selectionStart ?? el.value.length;
        const end = el.selectionEnd ?? start;
        const current = el.value;
        const newValue = current.slice(0, start) + variable + current.slice(end);
        updateContent(channel, 'message', newValue);
        // Restore cursor after React re-render
        requestAnimationFrame(() => {
          el.focus();
          const newPos = start + variable.length;
          el.setSelectionRange(newPos, newPos);
        });
      } else {
        setForm(f => ({
          ...f,
          content: { ...f.content, [channel]: { ...f.content[channel], message: (f.content[channel]?.message || '') + variable } }
        }));
      }
    }
  };

  const generateWithAI = async () => {
    if (!aiPrompt.trim()) return;

    setAiLoading(true);
    try {
      const event = events.find(e => e.id === form.eventId);
      const { data, error } = await supabase.functions.invoke('ai-compose', {
        body: {
          prompt: aiPrompt,
          channels: form.channels,
          context: {
            organizerName: organizer.business_name || organizer.name,
            eventName: event?.title,
          }
        }
      });

      if (error) throw error;

      // Edge function returns { subject, body } — map to each selected channel
      const subject = data?.subject || '';
      const htmlBody = data?.body || '';
      // Strip HTML tags for plain text channels
      const plainText = htmlBody.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

      setForm(f => {
        const updated = { ...f, content: { ...f.content } };

        if (f.channels.includes('email')) {
          updated.content.email = { subject, body: htmlBody };
        }
        if (f.channels.includes('sms')) {
          updated.content.sms = { message: plainText.slice(0, 160) };
        }
        if (f.channels.includes('whatsapp')) {
          updated.content.whatsapp = { message: plainText };
        }
        if (f.channels.includes('telegram')) {
          updated.content.telegram = { message: plainText };
        }

        return updated;
      });

      setAiPrompt('');
    } catch (err) {
      console.error('AI compose error:', err);
      toast.error('Failed to generate content. Please try again.');
    } finally {
      setAiLoading(false);
    }
  };

  const sendCampaign = async (sendNow = true) => {
    if (form.channels.length === 0) {
      toast.error('Please select at least one channel');
      return;
    }
    if (recipientCount === 0) {
      toast.info('No recipients selected');
      return;
    }

    // Validate content for each channel
    for (const channel of form.channels) {
      if (channel === 'email' && (!form.content.email.subject || !form.content.email.body)) {
        toast.error('Please fill in email subject and body');
        return;
      }
      if (channel === 'sms' && !form.content.sms.message) {
        toast.error('Please fill in SMS message');
        return;
      }
      if (channel === 'whatsapp' && !form.content.whatsapp.message) {
        toast.error('Please fill in WhatsApp message');
        return;
      }
    }

    setSending(true);
    try {
      // Create campaign record
      const { data: campaign, error: campaignError } = await supabase
        .from('communication_campaigns')
        .insert({
          organizer_id: organizer.id,
          name: form.name || form.content.email.subject?.substring(0, 50) || 'Campaign',
          channels: form.channels,
          content: form.content,
          audience_type: form.audienceType,
          audience_event_id: form.eventId || null,
          audience_segment_id: form.segmentId || null,
          status: sendNow ? 'sending' : 'scheduled',
          scheduled_for: form.scheduleFor || null,
          total_recipients: recipientCount,
          recipients_by_channel: recipientsByChannel,
        })
        .select()
        .single();

      if (campaignError) throw campaignError;

      let totalSuccess = 0;
      let totalFail = 0;

      // If sending now, trigger the send
      if (sendNow) {
        const event = events.find(e => e.id === form.eventId);

        // Send via each channel with properly filtered recipients
        for (const channel of form.channels) {
          // Fetch recipients with opt-out filtering
          const recipients = await fetchRecipients(channel);
          
          if (recipients.length === 0) {
            console.log(`No recipients for ${channel} channel (all opted out or no valid contacts)`);
            continue;
          }
          
          if (channel === 'email') {
            // Send emails one by one using the deployed send-email function
            let successCount = 0;
            let failCount = 0;
            
            console.log(`📧 Sending emails to ${recipients.length} recipients...`);
            
            for (const recipient of recipients) {
              try {
                console.log(`  → Sending to: ${recipient.email}`);
                
                // Replace variables in subject and body
                let personalizedSubject = form.content.email.subject;
                let personalizedBody = form.content.email.body;
                
                personalizedSubject = personalizedSubject.replace(/\{\{attendee_name\}\}/g, recipient.name || 'there');
                personalizedBody = personalizedBody.replace(/\{\{attendee_name\}\}/g, recipient.name || 'there');
                personalizedSubject = personalizedSubject.replace(/\{\{event_name\}\}/g, event?.title || '');
                personalizedBody = personalizedBody.replace(/\{\{event_name\}\}/g, event?.title || '');
                personalizedBody = personalizedBody.replace(/\{\{event_date\}\}/g, event?.start_date ? format(new Date(event.start_date), 'MMMM d, yyyy') : '');
                personalizedBody = personalizedBody.replace(/\{\{event_venue\}\}/g, event?.venue_name || '');
                personalizedBody = personalizedBody.replace(/\{\{organizer_name\}\}/g, organizer.business_name || '');
                
                const { data: emailResult, error } = await supabase.functions.invoke('send-email', {
                  body: {
                    type: 'bulk_campaign',
                    to: recipient.email,
                    organizerId: organizer.id,
                    data: {
                      subject: personalizedSubject,
                      title: personalizedSubject,
                      body: personalizedBody,
                    }
                  }
                });
                
                console.log(`  ✉️ Response for ${recipient.email}:`, emailResult, error);
                
                if (error) {
                  console.error(`  ❌ Failed to send to ${recipient.email}:`, error);
                  failCount++;
                } else if (emailResult?.success === false) {
                  console.error(`  ❌ API error for ${recipient.email}:`, emailResult?.error);
                  failCount++;
                } else {
                  console.log(`  ✅ Sent to ${recipient.email}`);
                  successCount++;
                }
                
                // Log to communication_messages
                await supabase.from('communication_messages').insert({
                  organizer_id: organizer.id,
                  campaign_id: campaign.id,
                  channel: 'email',
                  recipient_email: recipient.email,
                  subject: personalizedSubject,
                  content: personalizedBody,
                  status: error ? 'failed' : 'sent',
                  error_message: error?.message || null,
                  delivered_at: error ? null : new Date().toISOString(),
                });
              } catch (err) {
                console.error(`Error sending to ${recipient.email}:`, err);
                failCount++;
              }
            }
            
            console.log(`📧 Email campaign: ${successCount} sent, ${failCount} failed`);
            totalSuccess += successCount;
            totalFail += failCount;
          }
          
          // SMS sending
          if (channel === 'sms') {
            console.log(`📱 Sending SMS to ${recipients.length} recipients...`);
            
            let successCount = 0;
            let failCount = 0;
            
            for (const recipient of recipients) {
              try {
                console.log(`  → Sending SMS to: ${recipient.phone}`);
                
                // Replace variables in message
                let personalizedMessage = form.content.sms.message;
                personalizedMessage = personalizedMessage.replace(/\{\{attendee_name\}\}/g, recipient.name || 'there');
                personalizedMessage = personalizedMessage.replace(/\{\{event_name\}\}/g, event?.title || '');
                personalizedMessage = personalizedMessage.replace(/\{\{event_date\}\}/g, event?.start_date ? format(new Date(event.start_date), 'MMM d, yyyy') : '');
                personalizedMessage = personalizedMessage.replace(/\{\{event_venue\}\}/g, event?.venue_name || '');
                personalizedMessage = personalizedMessage.replace(/\{\{organizer_name\}\}/g, organizer.business_name || '');
                
                // Send SMS via edge function (single recipient mode)
                const { data: smsResult, error } = await supabase.functions.invoke('send-sms', {
                  body: {
                    organizer_id: organizer.id,
                    phone: recipient.phone,
                    name: recipient.name,
                    message: personalizedMessage,
                  }
                });
                
                console.log(`  📱 SMS Response for ${recipient.phone}:`, smsResult, error);
                
                if (error || smsResult?.error) {
                  console.error(`  ❌ SMS failed for ${recipient.phone}:`, error || smsResult?.error);
                  failCount++;
                } else {
                  console.log(`  ✅ SMS sent to ${recipient.phone}`);
                  successCount++;
                }
                
                // Log to communication_messages
                await supabase.from('communication_messages').insert({
                  organizer_id: organizer.id,
                  campaign_id: campaign.id,
                  channel: 'sms',
                  recipient_phone: recipient.phone,
                  content: personalizedMessage,
                  status: (error || smsResult?.error) ? 'failed' : 'sent',
                  error_message: error?.message || smsResult?.error || null,
                  delivered_at: (error || smsResult?.error) ? null : new Date().toISOString(),
                });
              } catch (err) {
                console.error(`Error sending SMS to ${recipient.phone}:`, err);
                failCount++;
              }
            }
            
            console.log(`📱 SMS campaign: ${successCount} sent, ${failCount} failed`);
            totalSuccess += successCount;
            totalFail += failCount;
          }
          
          // WhatsApp sending
          if (channel === 'whatsapp') {
            console.log(`💬 Sending WhatsApp to ${recipients.length} recipients...`);

            let successCount = 0;
            let failCount = 0;

            for (const recipient of recipients) {
              try {
                console.log(`  → Sending WhatsApp to: ${recipient.phone}`);

                // Replace variables in message
                let personalizedMessage = form.content.whatsapp.message;
                personalizedMessage = personalizedMessage.replace(/\{\{attendee_name\}\}/g, recipient.name || 'there');
                personalizedMessage = personalizedMessage.replace(/\{\{event_name\}\}/g, event?.title || '');
                personalizedMessage = personalizedMessage.replace(/\{\{event_date\}\}/g, event?.start_date ? format(new Date(event.start_date), 'MMM d, yyyy') : '');
                personalizedMessage = personalizedMessage.replace(/\{\{event_time\}\}/g, event?.start_date ? format(new Date(event.start_date), 'h:mm a') : '');
                personalizedMessage = personalizedMessage.replace(/\{\{event_venue\}\}/g, event?.venue_name || '');
                personalizedMessage = personalizedMessage.replace(/\{\{organizer_name\}\}/g, organizer.business_name || '');

                // Send WhatsApp via edge function
                const { data: waResult, error } = await supabase.functions.invoke('send-whatsapp', {
                  body: {
                    to: recipient.phone,
                    message: personalizedMessage,
                    type: 'text',
                  }
                });

                const failed = error || !waResult?.success || waResult?.error;
                const errorMsg = error?.message || waResult?.error || null;

                if (failed) {
                  console.error(`  ❌ WhatsApp failed for ${recipient.phone}:`, errorMsg);
                  failCount++;
                } else {
                  console.log(`  ✅ WhatsApp sent to ${recipient.phone}`);
                  successCount++;
                }

                // Log to communication_messages
                await supabase.from('communication_messages').insert({
                  organizer_id: organizer.id,
                  campaign_id: campaign.id,
                  channel: 'whatsapp',
                  recipient_phone: recipient.phone,
                  content: personalizedMessage,
                  status: failed ? 'failed' : 'sent',
                  error_message: errorMsg,
                  delivered_at: failed ? null : new Date().toISOString(),
                });
              } catch (err) {
                console.error(`Error sending WhatsApp to ${recipient.phone}:`, err);
                failCount++;
              }
            }

            console.log(`💬 WhatsApp campaign: ${successCount} sent, ${failCount} failed`);
            totalSuccess += successCount;
            totalFail += failCount;
          }

          // Send Telegram messages
          if (channel === 'telegram') {
            let successCount = 0;
            let failCount = 0;

            console.log(`📨 Sending Telegram to ${recipients.length} recipients...`);

            for (const recipient of recipients) {
              try {
                console.log(`  → Sending to chat ID: ${recipient.chatId}`);

                // Replace variables in message
                let personalizedMessage = form.content.telegram?.message || '';
                personalizedMessage = personalizedMessage.replace(/\{\{attendee_name\}\}/g, recipient.name || 'there');
                personalizedMessage = personalizedMessage.replace(/\{\{event_name\}\}/g, selectedEvent?.title || '');
                personalizedMessage = personalizedMessage.replace(/\{\{event_date\}\}/g, selectedEvent?.start_date ? new Date(selectedEvent.start_date).toLocaleDateString() : '');
                personalizedMessage = personalizedMessage.replace(/\{\{event_time\}\}/g, selectedEvent?.start_date ? new Date(selectedEvent.start_date).toLocaleTimeString() : '');
                personalizedMessage = personalizedMessage.replace(/\{\{event_venue\}\}/g, selectedEvent?.venue_name || '');
                personalizedMessage = personalizedMessage.replace(/\{\{event_link\}\}/g, selectedEvent?.id ? `${window.location.origin}/events/${selectedEvent.id}` : '');
                personalizedMessage = personalizedMessage.replace(/\{\{organizer_name\}\}/g, organizer.business_name || '');

                const { data: tgResult, error } = await supabase.functions.invoke('send-telegram', {
                  body: {
                    chatId: recipient.chatId,
                    userId: recipient.id,
                    organizerId: organizer.id,
                    message: personalizedMessage,
                    parseMode: 'Markdown',
                  }
                });

                console.log(`  📨 Telegram Response for ${recipient.chatId}:`, tgResult, error);

                if (error || tgResult?.error) {
                  failCount++;
                } else {
                  console.log(`  ✅ Telegram sent to ${recipient.chatId}`);
                  successCount++;
                }

                // Log to communication_messages
                await supabase.from('communication_messages').insert({
                  organizer_id: organizer.id,
                  campaign_id: campaign.id,
                  channel: 'telegram',
                  recipient_metadata: { chat_id: recipient.chatId, user_id: recipient.id },
                  content: { message: personalizedMessage },
                  status: (error || tgResult?.error) ? 'failed' : 'sent',
                  error_message: error?.message || tgResult?.error || null,
                  delivered_at: (error || tgResult?.error) ? null : new Date().toISOString(),
                });
              } catch (err) {
                console.error(`Error sending Telegram to ${recipient.chatId}:`, err);
                failCount++;
              }
            }

            console.log(`📨 Telegram campaign: ${successCount} sent, ${failCount} failed`);
            totalSuccess += successCount;
            totalFail += failCount;
          }
        }

        // Update campaign status based on results
        const campaignStatus = totalFail === 0 ? 'sent' : totalSuccess === 0 ? 'failed' : 'partially_failed';
        await supabase
          .from('communication_campaigns')
          .update({
            status: campaignStatus,
            sent_at: new Date().toISOString(),
            sent_count: totalSuccess,
            failed_count: totalFail,
          })
          .eq('id', campaign.id);
      }

      await loadData();
      resetForm();
      setShowCreateWizard(false);
      if (!sendNow) {
        toast.success('Campaign scheduled!');
      } else if (totalFail === 0) {
        toast.success('Campaign sent successfully!');
      } else if (totalSuccess === 0) {
        toast.error(`Campaign failed: all ${totalFail} messages failed to send.`);
      } else {
        toast.warning(`Campaign partially sent: ${totalSuccess} delivered, ${totalFail} failed.`);
      }
    } catch (err) {
      console.error('Send error:', err);
      toast.error('Failed to send campaign: ' + err.message);
    } finally {
      setSending(false);
    }
  };

  const deleteCampaign = async (id) => {
    if (!(await confirm('Delete Campaign', 'Delete this campaign?', { variant: 'destructive' }))) return;

    await supabase.from('communication_campaigns').delete().eq('id', id);
    await supabase.from('email_campaigns').delete().eq('id', id); // Also try legacy
    loadCampaigns();
  };

  const viewCampaignDetails = async (campaign) => {
    setViewingCampaign(campaign);
    setCampaignMessages([]);
    setMessagesLoading(true);
    try {
      const { data } = await supabase
        .from('communication_messages')
        .select('id, channel, recipient_email, recipient_phone, subject, content, status, error_message, delivered_at, created_at')
        .eq('campaign_id', campaign.id)
        .order('created_at', { ascending: false })
        .limit(100);
      setCampaignMessages(data || []);
    } catch (err) {
      console.error('Error loading campaign messages:', err);
    } finally {
      setMessagesLoading(false);
    }
  };

  const duplicateCampaign = (campaign) => {
    setForm({
      name: (campaign.name || 'Campaign') + ' (copy)',
      channels: campaign.channels || ['email'],
      audienceType: campaign.audience_type || '',
      eventId: campaign.audience_event_id || '',
      segmentId: campaign.audience_segment_id || '',
      template: 'custom',
      content: campaign.content || {
        email: { subject: '', body: '' },
        sms: { message: '' },
        whatsapp: { message: '' },
        telegram: { message: '' },
      },
      scheduleFor: '',
    });
    setWizardStep(1);
    setShowCreateWizard(true);
  };

  const resetForm = () => {
    setForm({
      name: '',
      channels: [],
      audienceType: '',
      eventId: '',
      segmentId: '',
      template: '',
      content: {
        email: { subject: '', body: '' },
        sms: { message: '' },
        whatsapp: { message: '' },
        telegram: { message: '' },
      },
      scheduleFor: '',
    });
    setWizardStep(1);
    setRecipientCount(0);
  };

  // ============================================================================
  // PREVIEW
  // ============================================================================

  const getPreviewContent = (channel) => {
    const event = events.find(e => e.id === form.eventId);
    const replacements = {
      '{{attendee_name}}': 'John Doe',
      '{{event_name}}': event?.title || 'Event Name',
      '{{event_date}}': event?.start_date ? format(new Date(event.start_date), 'MMMM d, yyyy') : 'January 1, 2026',
      '{{event_time}}': '7:00 PM',
      '{{event_venue}}': event?.venue_name || 'Venue Name',
      '{{event_link}}': '#',
      '{{organizer_name}}': organizer?.business_name || 'Organizer',
    };

    let content = channel === 'email' ? form.content.email.body : form.content[channel]?.message || '';
    Object.entries(replacements).forEach(([key, value]) => {
      content = content.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
    });

    return content;
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Communication Hub</h1>
          <p className="text-muted-foreground">Send emails, SMS, and WhatsApp messages to your audience</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate('/organizer/contacts')}>
            <Users className="w-4 h-4 mr-2" />
            Contacts
          </Button>
          <Button onClick={() => { resetForm(); setShowCreateWizard(true); }} className="bg-[#2969FF] text-white">
            <Plus className="w-4 h-4 mr-2" />
            New Campaign
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border/10 rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalContacts.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Contacts</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/10 rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <Send className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{campaigns.length}</p>
                <p className="text-xs text-muted-foreground">Campaigns</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/10 rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <Mail className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{(stats.emailsSent + stats.smsSent + stats.whatsappSent).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Messages Sent</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/10 rounded-xl cursor-pointer hover:border-[#2969FF]/30 transition-colors" onClick={() => navigate('/organizer/credits')}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#2969FF]">{stats.messageCredits.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Message Credits</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={(tab) => {
        setActiveTab(tab);
        if (tab === 'history' && messageHistory.length === 0) {
          loadMessageHistory(true);
        }
      }}>
        <TabsList>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* Campaigns Tab */}
        <TabsContent value="campaigns" className="space-y-4">
          {campaigns.length === 0 ? (
            <Card className="border-border/10 rounded-xl">
              <CardContent className="py-12 text-center">
                <Send className="w-12 h-12 text-foreground/20 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No campaigns yet</h3>
                <p className="text-muted-foreground mb-4">Create your first campaign to reach your audience</p>
                <Button onClick={() => setShowCreateWizard(true)} className="bg-[#2969FF] text-white">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Campaign
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {campaigns.map(campaign => (
                <Card key={campaign.id} className="border-border/10 rounded-xl hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium truncate">
                            {campaign.name || campaign.content?.email?.subject || campaign.subject || 'Untitled'}
                          </h3>
                          <Badge variant="secondary" className={
                            campaign.status === 'sent' ? 'bg-green-100 text-green-700' :
                            campaign.status === 'failed' ? 'bg-red-100 text-red-700' :
                            campaign.status === 'partially_failed' ? 'bg-amber-100 text-amber-700' :
                            campaign.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
                            campaign.status === 'sending' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-muted text-foreground/80'
                          }>
                            {campaign.status === 'sent' && <CheckCircle className="w-3 h-3 mr-1" />}
                            {campaign.status === 'failed' && <AlertCircle className="w-3 h-3 mr-1" />}
                            {campaign.status === 'partially_failed' && <AlertCircle className="w-3 h-3 mr-1" />}
                            {campaign.status === 'scheduled' && <Clock className="w-3 h-3 mr-1" />}
                            {campaign.status === 'partially_failed' ? 'partial' : campaign.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            {(campaign.channels || ['email']).map(ch => {
                              const channel = CHANNELS.find(c => c.id === ch);
                              return channel ? <channel.icon key={ch} className={`w-3.5 h-3.5 ${channel.color}`} /> : null;
                            })}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5" />
                            {campaign.sent_count || campaign.total_recipients || 0} recipients
                          </span>
                          <span>{format(new Date(campaign.created_at), 'MMM d, yyyy')}</span>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => viewCampaignDetails(campaign)}>
                            <Eye className="w-4 h-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => duplicateCampaign(campaign)}>
                            <Copy className="w-4 h-4 mr-2" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => deleteCampaign(campaign.id)} className="text-red-600">
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-6">
          {/* Saved Templates */}
          {savedTemplates.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-lg">Your Templates</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingTemplate(null);
                    setTemplateName('');
                    setForm(f => ({
                      ...f,
                      template: 'custom',
                      content: { email: { subject: '', body: '' }, sms: { message: '' }, whatsapp: { message: '' } },
                    }));
                    setShowCreateWizard(true);
                    setWizardStep(3);
                  }}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Create Template
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {savedTemplates.map(template => (
                  <Card key={template.id} className="border-border/10 rounded-xl hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                            <FileText className="w-5 h-5 text-purple-600" />
                          </div>
                          <div>
                            <h3 className="font-medium">{template.name}</h3>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(template.created_at), 'MMM d, yyyy')}
                            </p>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => useSavedTemplate(template)}>
                              <Send className="w-4 h-4 mr-2" />
                              Use Template
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => loadTemplateForEditing(template)}>
                              <FileText className="w-4 h-4 mr-2" />
                              Edit Template
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => deleteTemplate(template.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="flex items-center gap-2 mb-3">
                        {(template.channels || []).map(chId => {
                          const ch = CHANNELS.find(c => c.id === chId);
                          return ch ? (
                            <div key={ch.id} className={`w-6 h-6 rounded flex items-center justify-center ${ch.bgColor}`}>
                              <ch.icon className={`w-3 h-3 ${ch.color}`} />
                            </div>
                          ) : null;
                        })}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => useSavedTemplate(template)}
                      >
                        Use Template
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Pre-built Templates */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">Pre-built Templates</h3>
              {savedTemplates.length === 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingTemplate(null);
                    setTemplateName('');
                    setForm(f => ({
                      ...f,
                      template: 'custom',
                      content: { email: { subject: '', body: '' }, sms: { message: '' }, whatsapp: { message: '' } },
                    }));
                    setShowCreateWizard(true);
                    setWizardStep(3);
                  }}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Create Custom Template
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {TEMPLATES.filter(t => t.id !== 'custom').map(template => (
                <Card key={template.id} className="border-border/10 rounded-xl hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => {
                    selectTemplate(template.id);
                    setShowCreateWizard(true);
                    setWizardStep(2);
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg bg-[#2969FF]/10 flex items-center justify-center">
                        <template.icon className="w-5 h-5 text-[#2969FF]" />
                      </div>
                      <div>
                        <h3 className="font-medium">{template.name}</h3>
                        <p className="text-xs text-muted-foreground">{template.category}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {CHANNELS.map(ch => (
                        <div key={ch.id} className={`w-6 h-6 rounded flex items-center justify-center ${ch.bgColor}`}>
                          <ch.icon className={`w-3 h-3 ${ch.color}`} />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Empty State */}
          {savedTemplates.length === 0 && (
            <Card className="border-dashed border-2 border-border/10 rounded-xl">
              <CardContent className="py-8 text-center">
                <FileText className="w-12 h-12 text-foreground/20 mx-auto mb-4" />
                <h3 className="font-medium mb-2">No custom templates yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Create your own templates to save time when composing campaigns
                </p>
                <Button
                  onClick={() => {
                    setEditingTemplate(null);
                    setTemplateName('');
                    setForm(f => ({
                      ...f,
                      template: 'custom',
                      content: { email: { subject: '', body: '' }, sms: { message: '' }, whatsapp: { message: '' } },
                    }));
                    setShowCreateWizard(true);
                    setWizardStep(3);
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Template
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <Select value={historyChannel} onValueChange={(v) => { setHistoryChannel(v); setHistoryOffset(0); setHasMoreHistory(true); }}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Channel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Channels</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
              </SelectContent>
            </Select>

            <Select value={historyStatus} onValueChange={(v) => { setHistoryStatus(v); setHistoryOffset(0); setHasMoreHistory(true); }}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" size="sm" onClick={() => loadMessageHistory(true)}>
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </Button>

            <div className="ml-auto">
              <Button variant="outline" size="sm" onClick={() => navigate('/organizer/analytics')}>
                <BarChart3 className="w-4 h-4 mr-1" />
                View Analytics
              </Button>
            </div>
          </div>

          {/* Message Table */}
          {historyLoading && messageHistory.length === 0 ? (
            <Card className="border-border/10 rounded-xl">
              <CardContent className="py-12 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#2969FF] mx-auto mb-4" />
                <p className="text-muted-foreground">Loading message history...</p>
              </CardContent>
            </Card>
          ) : messageHistory.length === 0 ? (
            <Card className="border-border/10 rounded-xl">
              <CardContent className="py-12 text-center">
                <Clock className="w-12 h-12 text-foreground/20 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No messages yet</h3>
                <p className="text-muted-foreground">Messages you send will appear here with delivery status</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border/10 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/10 bg-muted/50">
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Recipient</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Channel</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Content</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground">Date/Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {messageHistory.map(msg => {
                      const channel = CHANNELS.find(c => c.id === msg.channel);
                      const ChannelIcon = channel?.icon || Mail;
                      const recipient = msg.recipient_email || msg.recipient_phone || '-';
                      const contentPreview = (msg.subject || (typeof msg.content === 'string' ? msg.content : msg.content?.message) || '').replace(/<[^>]+>/g, '').slice(0, 60);
                      const timestamp = msg.delivered_at || msg.created_at;

                      return (
                        <tr key={msg.id} className="border-b border-border/5 hover:bg-muted/30">
                          <td className="py-3 px-4">
                            <span className="truncate max-w-[180px] block">{recipient}</span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5">
                              <ChannelIcon className={`w-3.5 h-3.5 ${channel?.color || 'text-muted-foreground'}`} />
                              <span className="capitalize">{msg.channel}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="truncate max-w-[250px] block text-muted-foreground">
                              {contentPreview || '-'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <Badge className={
                              msg.status === 'sent' ? 'bg-green-100 text-green-700' :
                              msg.status === 'delivered' ? 'bg-blue-100 text-blue-700' :
                              msg.status === 'failed' ? 'bg-red-100 text-red-700' :
                              msg.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-muted text-muted-foreground'
                            }>
                              {msg.status}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-right text-muted-foreground whitespace-nowrap">
                            {timestamp ? format(new Date(timestamp), 'MMM d, yyyy h:mm a') : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Load More */}
              {hasMoreHistory && (
                <div className="p-4 text-center border-t border-border/10">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadMessageHistory(false)}
                    disabled={historyLoading}
                  >
                    {historyLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                    Load More
                  </Button>
                </div>
              )}
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Campaign Wizard */}
      <Dialog open={showCreateWizard} onOpenChange={setShowCreateWizard}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Campaign</DialogTitle>
            <DialogDescription>
              Step {wizardStep} of 4: {
                wizardStep === 1 ? 'Select Channels' :
                wizardStep === 2 ? 'Choose Audience' :
                wizardStep === 3 ? 'Compose Message' :
                'Review & Send'
              }
            </DialogDescription>
          </DialogHeader>

          {/* Progress */}
          <div className="flex items-center gap-2 py-4">
            {[1, 2, 3, 4].map(s => (
              <div key={s} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  s === wizardStep ? 'bg-[#2969FF] text-white' :
                  s < wizardStep ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'
                }`}>
                  {s < wizardStep ? <CheckCircle className="w-4 h-4" /> : s}
                </div>
                {s < 4 && <div className={`w-12 h-1 mx-1 rounded ${s < wizardStep ? 'bg-green-500' : 'bg-muted'}`} />}
              </div>
            ))}
          </div>

          {/* Step 1: Channels */}
          {wizardStep === 1 && (
            <div className="space-y-4">
              <Label className="text-base font-medium">Select communication channels</Label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {CHANNELS.map(channel => (
                  <button
                    key={channel.id}
                    onClick={() => toggleChannel(channel.id)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      form.channels.includes(channel.id)
                        ? 'border-[#2969FF] bg-[#2969FF]/5'
                        : 'border-border/10 hover:border-border/20'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        form.channels.includes(channel.id) ? 'bg-[#2969FF] text-white' : channel.bgColor
                      }`}>
                        <channel.icon className={`w-5 h-5 ${form.channels.includes(channel.id) ? 'text-white' : channel.color}`} />
                      </div>
                      <div>
                        <p className="font-medium">{channel.name}</p>
                        <p className="text-xs text-muted-foreground">{channel.description}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {(form.channels.includes('sms') || form.channels.includes('whatsapp')) && (
                <div className="flex items-center gap-4 p-3 bg-amber-50 rounded-xl text-amber-700">
                  <Zap className="w-5 h-5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Your Message Credits: {stats.messageCredits.toLocaleString()}</p>
                    <p className="text-sm">Can send ~{stats.smsCredits} SMS or ~{stats.whatsappCredits} WhatsApp messages</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Audience */}
          {wizardStep === 2 && (
            <div className="space-y-4">
              <Label className="text-base font-medium">Who do you want to reach?</Label>
              <div className="grid gap-3">
                {AUDIENCE_TYPES.map(type => (
                  <button
                    key={type.id}
                    onClick={() => setForm(f => ({ ...f, audienceType: type.id, eventId: '', segmentId: '' }))}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      form.audienceType === type.id
                        ? 'border-[#2969FF] bg-[#2969FF]/5'
                        : 'border-border/10 hover:border-border/20'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        form.audienceType === type.id ? 'bg-[#2969FF] text-white' : 'bg-muted'
                      }`}>
                        <type.icon className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-medium">{type.label}</p>
                        <p className="text-sm text-muted-foreground">{type.description}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {form.audienceType === 'event_attendees' && (
                <div>
                  <Label>Select Event</Label>
                  <Select value={form.eventId} onValueChange={v => setForm(f => ({ ...f, eventId: v }))}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Choose an event" />
                    </SelectTrigger>
                    <SelectContent>
                      {events.map(event => (
                        <SelectItem key={event.id} value={event.id}>
                          {event.title} ({format(new Date(event.start_date), 'MMM d')})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {form.audienceType === 'segment' && (
                <div>
                  <Label>Select Segment</Label>
                  <Select value={form.segmentId} onValueChange={v => setForm(f => ({ ...f, segmentId: v }))}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Choose a segment" />
                    </SelectTrigger>
                    <SelectContent>
                      {segments.map(seg => (
                        <SelectItem key={seg.id} value={seg.id}>
                          {seg.name} ({seg.contact_count} contacts)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {recipientCount > 0 && (
                <div className="p-4 bg-green-50 rounded-xl">
                  <div className="flex items-center gap-2 text-green-700 mb-2">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-medium">Estimated Recipients</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    {form.channels.includes('email') && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-blue-600" />
                        <span>{recipientsByChannel.email} emails</span>
                      </div>
                    )}
                    {form.channels.includes('sms') && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-green-600" />
                        <span>{recipientsByChannel.sms} SMS</span>
                      </div>
                    )}
                    {form.channels.includes('whatsapp') && (
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-emerald-600" />
                        <span>{recipientsByChannel.whatsapp} WhatsApp</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Compose */}
          {wizardStep === 3 && (
            <div className="space-y-4">
              {/* Template Selection */}
              <div>
                <Label className="mb-2 block">Start with a template</Label>
                <div className="flex flex-wrap gap-2">
                  {TEMPLATES.map(t => (
                    <button
                      key={t.id}
                      onClick={() => selectTemplate(t.id)}
                      className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 transition-all ${
                        form.template === t.id
                          ? 'bg-[#2969FF] text-white'
                          : 'bg-muted hover:bg-[#E8EBF0]'
                      }`}
                    >
                      <t.icon className="w-3.5 h-3.5" />
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* AI Compose */}
              <div className="p-3 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl">
                <Label className="mb-2 block text-sm font-medium flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  AI Compose
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={aiPrompt}
                    onChange={e => setAiPrompt(e.target.value)}
                    placeholder="Describe what you want to say..."
                    className="rounded-lg"
                  />
                  <Button
                    onClick={generateWithAI}
                    disabled={aiLoading || !aiPrompt.trim()}
                    className="rounded-lg bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              {/* Channel-specific content */}
              <Tabs defaultValue={form.channels[0] || 'email'}>
                <TabsList>
                  {form.channels.map(ch => {
                    const channel = CHANNELS.find(c => c.id === ch);
                    return (
                      <TabsTrigger key={ch} value={ch} className="flex items-center gap-1">
                        <channel.icon className={`w-4 h-4 ${channel.color}`} />
                        {channel.name}
                      </TabsTrigger>
                    );
                  })}
                </TabsList>

                {form.channels.includes('email') && (
                  <TabsContent value="email" className="space-y-4 mt-4">
                    <div>
                      <Label>Subject Line</Label>
                      <Input
                        value={form.content.email.subject}
                        onChange={e => updateContent('email', 'subject', e.target.value)}
                        placeholder="Enter email subject..."
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Message Body</Label>
                      <div className="mt-1 rounded-xl overflow-hidden border border-border/10">
                        <ReactQuill
                          ref={quillRef}
                          theme="snow"
                          value={form.content.email.body}
                          onChange={v => updateContent('email', 'body', v)}
                          modules={QUILL_MODULES}
                          placeholder="Write your email..."
                          style={{ minHeight: '200px' }}
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="mb-2 block text-sm">Insert Variable</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {VARIABLES.map(v => (
                          <button
                            key={v.key}
                            onClick={() => insertVariable('email', v.key)}
                            className="px-2 py-1 bg-muted hover:bg-[#E8EBF0] rounded text-xs font-mono"
                            title={v.label}
                          >
                            {v.key}
                          </button>
                        ))}
                      </div>
                    </div>
                  </TabsContent>
                )}

                {form.channels.includes('sms') && (
                  <TabsContent value="sms" className="space-y-4 mt-4">
                    <div>
                      <Label>SMS Message <span className="text-muted-foreground">({(form.content.sms.message || '').length}/160)</span></Label>
                      <Textarea
                        ref={smsRef}
                        value={form.content.sms.message}
                        onChange={e => updateContent('sms', 'message', e.target.value)}
                        placeholder="Write your SMS message..."
                        className="mt-1 min-h-[120px]"
                        maxLength={480}
                      />
                    </div>
                    <div>
                      <Label className="mb-2 block text-sm">Insert Variable</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {VARIABLES.map(v => (
                          <button
                            key={v.key}
                            onClick={() => insertVariable('sms', v.key)}
                            className="px-2 py-1 bg-muted hover:bg-[#E8EBF0] rounded text-xs font-mono"
                          >
                            {v.key}
                          </button>
                        ))}
                      </div>
                    </div>
                  </TabsContent>
                )}

                {form.channels.includes('whatsapp') && (
                  <TabsContent value="whatsapp" className="space-y-4 mt-4">
                    <div>
                      <Label>WhatsApp Message</Label>
                      <Textarea
                        ref={whatsappRef}
                        value={form.content.whatsapp.message}
                        onChange={e => updateContent('whatsapp', 'message', e.target.value)}
                        placeholder="Write your WhatsApp message..."
                        className="mt-1 min-h-[150px]"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Use *bold* and _italic_ for formatting</p>
                    </div>
                    <div>
                      <Label className="mb-2 block text-sm">Insert Variable</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {VARIABLES.map(v => (
                          <button
                            key={v.key}
                            onClick={() => insertVariable('whatsapp', v.key)}
                            className="px-2 py-1 bg-muted hover:bg-[#E8EBF0] rounded text-xs font-mono"
                          >
                            {v.key}
                          </button>
                        ))}
                      </div>
                    </div>
                  </TabsContent>
                )}
              </Tabs>

              {/* Save as Template Button */}
              <div className="flex items-center justify-between pt-4 border-t border-border/10">
                <p className="text-sm text-muted-foreground">
                  {editingTemplate ? `Editing: ${editingTemplate.name}` : 'Save this content as a reusable template'}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (editingTemplate) {
                      setTemplateName(editingTemplate.name);
                    }
                    setShowSaveTemplate(true);
                  }}
                  disabled={form.channels.length === 0}
                >
                  <Download className="w-4 h-4 mr-1" />
                  {editingTemplate ? 'Update Template' : 'Save as Template'}
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {wizardStep === 4 && (
            <div className="space-y-4">
              <div className="text-center py-4">
                <div className="w-16 h-16 rounded-full bg-[#2969FF]/10 flex items-center justify-center mx-auto mb-4">
                  <Send className="w-8 h-8 text-[#2969FF]" />
                </div>
                <h2 className="text-xl font-semibold mb-2">Ready to Send</h2>
                <p className="text-muted-foreground">Review your campaign before sending</p>
              </div>

              {/* Summary */}
              <div className="bg-muted rounded-xl p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Channels</span>
                  <div className="flex items-center gap-2">
                    {form.channels.map(ch => {
                      const channel = CHANNELS.find(c => c.id === ch);
                      return (
                        <Badge key={ch} className={channel.bgColor + ' ' + channel.color}>
                          <channel.icon className="w-3 h-3 mr-1" />
                          {channel.name}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Audience</span>
                  <span className="font-medium">
                    {AUDIENCE_TYPES.find(t => t.id === form.audienceType)?.label}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Recipients</span>
                  <span className="font-medium">{recipientCount.toLocaleString()}</span>
                </div>
                {form.channels.includes('email') && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Email Subject</span>
                    <span className="font-medium truncate max-w-[200px]">{form.content.email.subject}</span>
                  </div>
                )}
              </div>

              {/* Preview */}
              <div className="border border-border/10 rounded-xl overflow-hidden">
                <div className="bg-muted p-3 border-b border-border/10 flex items-center gap-2">
                  <Eye className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Preview</span>
                </div>
                <div className="p-4">
                  <Tabs defaultValue={form.channels[0] || 'email'}>
                    <TabsList className="mb-4">
                      {form.channels.map(ch => {
                        const channel = CHANNELS.find(c => c.id === ch);
                        return <TabsTrigger key={ch} value={ch}>{channel.name}</TabsTrigger>;
                      })}
                    </TabsList>
                    {form.channels.map(ch => (
                      <TabsContent key={ch} value={ch}>
                        {ch === 'email' ? (
                          <div
                            className="prose prose-sm max-w-none"
                            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(getPreviewContent('email')) }}
                          />
                        ) : (
                          <div className="bg-muted rounded-xl p-4 max-w-sm">
                            <p className="whitespace-pre-wrap text-sm">{getPreviewContent(ch)}</p>
                          </div>
                        )}
                      </TabsContent>
                    ))}
                  </Tabs>
                </div>
              </div>

              {/* Schedule Option */}
              <div>
                <Label>Schedule for later (optional)</Label>
                <Input
                  type="datetime-local"
                  value={form.scheduleFor}
                  onChange={e => setForm(f => ({ ...f, scheduleFor: e.target.value }))}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">Leave empty to send immediately</p>
              </div>
            </div>
          )}

          <DialogFooter className="flex justify-between pt-4">
            <div>
              {wizardStep > 1 && (
                <Button variant="outline" onClick={() => setWizardStep(s => s - 1)}>
                  <ChevronLeft className="w-4 h-4 mr-1" /> Back
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { resetForm(); setShowCreateWizard(false); }}>
                Cancel
              </Button>
              {wizardStep < 4 ? (
                <Button
                  onClick={() => setWizardStep(s => s + 1)}
                  disabled={
                    (wizardStep === 1 && form.channels.length === 0) ||
                    (wizardStep === 2 && (!form.audienceType || recipientCount === 0)) ||
                    (wizardStep === 3 && form.channels.some(ch => {
                      if (ch === 'email') return !form.content.email.subject || !form.content.email.body;
                      if (ch === 'sms') return !form.content.sms.message;
                      if (ch === 'whatsapp') return !form.content.whatsapp.message;
                      return false;
                    }))
                  }
                  className="bg-[#2969FF] text-white"
                >
                  Continue <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              ) : (
                <div className="flex gap-2">
                  {form.scheduleFor && (
                    <Button
                      onClick={() => sendCampaign(false)}
                      disabled={sending}
                      variant="outline"
                    >
                      {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Clock className="w-4 h-4 mr-2" />}
                      Schedule
                    </Button>
                  )}
                  <Button
                    onClick={() => sendCampaign(true)}
                    disabled={sending}
                    className="bg-[#2969FF] text-white"
                  >
                    {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                    Send Now
                  </Button>
                </div>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save Template Dialog */}
      <Dialog open={showSaveTemplate} onOpenChange={setShowSaveTemplate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Update Template' : 'Save as Template'}
            </DialogTitle>
            <DialogDescription>
              {editingTemplate 
                ? 'Update this template with your current content'
                : 'Save your current message content as a reusable template'
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            <div>
              <Label>Template Name</Label>
              <Input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g., Monthly Newsletter, VIP Event Invite..."
                className="mt-1"
              />
            </div>
            
            <div>
              <Label className="mb-2 block">Channels Included</Label>
              <div className="flex items-center gap-2">
                {form.channels.map(chId => {
                  const ch = CHANNELS.find(c => c.id === chId);
                  return ch ? (
                    <Badge key={ch.id} className={`${ch.bgColor} ${ch.color}`}>
                      <ch.icon className="w-3 h-3 mr-1" />
                      {ch.name}
                    </Badge>
                  ) : null;
                })}
              </div>
            </div>

            <div className="bg-muted rounded-lg p-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Content Preview</p>
              {form.channels.includes('email') && form.content.email.subject && (
                <p>Email: {form.content.email.subject}</p>
              )}
              {form.channels.includes('sms') && form.content.sms.message && (
                <p>SMS: {form.content.sms.message.slice(0, 50)}...</p>
              )}
              {form.channels.includes('whatsapp') && form.content.whatsapp.message && (
                <p>WhatsApp: {form.content.whatsapp.message.slice(0, 50)}...</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveTemplate(false)}>
              Cancel
            </Button>
            <Button
              onClick={saveAsTemplate}
              disabled={savingTemplate || !templateName.trim()}
              className="bg-[#2969FF] text-white"
            >
              {savingTemplate ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              {editingTemplate ? 'Update Template' : 'Save Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Campaign Details Dialog */}
      <Dialog open={!!viewingCampaign} onOpenChange={(open) => { if (!open) setViewingCampaign(null); }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Campaign Details</DialogTitle>
            <DialogDescription>
              {viewingCampaign?.name || viewingCampaign?.content?.email?.subject || 'Untitled'}
            </DialogDescription>
          </DialogHeader>

          {viewingCampaign && (
            <div className="space-y-4">
              {/* Campaign Summary */}
              <div className="bg-muted rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Badge className={
                    viewingCampaign.status === 'sent' ? 'bg-green-100 text-green-700' :
                    viewingCampaign.status === 'failed' ? 'bg-red-100 text-red-700' :
                    viewingCampaign.status === 'partially_failed' ? 'bg-amber-100 text-amber-700' :
                    viewingCampaign.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
                    'bg-muted text-foreground/80'
                  }>
                    {viewingCampaign.status === 'partially_failed' ? 'Partially Sent' : viewingCampaign.status}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Channels</span>
                  <div className="flex items-center gap-1.5">
                    {(viewingCampaign.channels || ['email']).map(ch => {
                      const channel = CHANNELS.find(c => c.id === ch);
                      return channel ? (
                        <div key={ch} className="flex items-center gap-1">
                          <channel.icon className={`w-3.5 h-3.5 ${channel.color}`} />
                          <span>{channel.name}</span>
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Recipients</span>
                  <span className="font-medium">{viewingCampaign.sent_count || viewingCampaign.total_recipients || 0}</span>
                </div>
                {viewingCampaign.failed_count > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Failed</span>
                    <span className="font-medium text-red-600">{viewingCampaign.failed_count}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sent At</span>
                  <span>{viewingCampaign.sent_at ? format(new Date(viewingCampaign.sent_at), 'MMM d, yyyy h:mm a') : format(new Date(viewingCampaign.created_at), 'MMM d, yyyy h:mm a')}</span>
                </div>
                {viewingCampaign.content?.email?.subject && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subject</span>
                    <span className="font-medium truncate max-w-[300px]">{viewingCampaign.content.email.subject}</span>
                  </div>
                )}
              </div>

              {/* Message Delivery Log */}
              <div>
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  Delivery Log
                </h3>

                {messagesLoading ? (
                  <div className="py-8 text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-[#2969FF] mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Loading messages...</p>
                  </div>
                ) : campaignMessages.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground text-sm">
                    No message records found for this campaign
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-border/10 rounded-xl">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border/10 bg-muted/50">
                          <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">Recipient</th>
                          <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">Channel</th>
                          <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">Status</th>
                          <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {campaignMessages.map(msg => {
                          const channel = CHANNELS.find(c => c.id === msg.channel);
                          const ChannelIcon = channel?.icon || Mail;
                          return (
                            <tr key={msg.id} className="border-b border-border/5 hover:bg-muted/30">
                              <td className="py-2.5 px-3">
                                <span className="truncate max-w-[200px] block">
                                  {msg.recipient_email || msg.recipient_phone || '-'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="flex items-center gap-1.5">
                                  <ChannelIcon className={`w-3.5 h-3.5 ${channel?.color || 'text-muted-foreground'}`} />
                                  <span className="capitalize">{msg.channel}</span>
                                </div>
                              </td>
                              <td className="py-2.5 px-3">
                                <Badge className={
                                  msg.status === 'sent' ? 'bg-green-100 text-green-700' :
                                  msg.status === 'delivered' ? 'bg-blue-100 text-blue-700' :
                                  msg.status === 'failed' ? 'bg-red-100 text-red-700' :
                                  msg.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-muted text-muted-foreground'
                                }>
                                  {msg.status}
                                </Badge>
                                {msg.error_message && (
                                  <p className="text-xs text-red-500 mt-0.5 truncate max-w-[200px]">{msg.error_message}</p>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right text-muted-foreground whitespace-nowrap">
                                {msg.delivered_at
                                  ? format(new Date(msg.delivered_at), 'h:mm a')
                                  : msg.created_at
                                    ? format(new Date(msg.created_at), 'h:mm a')
                                    : '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default CommunicationHub;
