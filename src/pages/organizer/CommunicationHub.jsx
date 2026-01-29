import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import DOMPurify from 'dompurify';
import {
  Mail, MessageSquare, Bell, Send, Clock, CheckCircle, Users, Calendar, 
  Loader2, Sparkles, ChevronRight, ChevronLeft, Eye, Trash2, RefreshCw,
  FileText, UserCheck, Heart, AlertCircle, Plus, Filter, Search,
  Phone, Globe, Zap, TrendingUp, BarChart3, Settings, Tag, Target,
  Copy, Download, Upload, MoreVertical
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

  // Analytics data
  const [analytics, setAnalytics] = useState({
    loading: false,
    // Daily send counts for last 30 days
    dailySends: [],
    // Channel breakdown
    channelBreakdown: { email: 0, sms: 0, whatsapp: 0, telegram: 0 },
    // Delivery stats
    deliveryStats: { sent: 0, delivered: 0, failed: 0, pending: 0 },
    // Campaign performance
    campaignPerformance: [],
    // Credits used this month
    creditsUsedThisMonth: 0,
    // Top performing campaigns
    topCampaigns: [],
  });

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
      alert('Please enter a template name');
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
      alert(editingTemplate ? 'Template updated!' : 'Template saved!');
    } catch (error) {
      console.error('Error saving template:', error);
      alert('Failed to save template: ' + error.message);
    } finally {
      setSavingTemplate(false);
    }
  };

  const deleteTemplate = async (templateId) => {
    if (!confirm('Delete this template?')) return;

    try {
      const { error } = await supabase
        .from('message_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;
      await loadSavedTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      alert('Failed to delete template');
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

  const loadAnalytics = async () => {
    setAnalytics(prev => ({ ...prev, loading: true }));
    
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString();

      // Get messages from last 30 days
      const { data: recentMessages } = await supabase
        .from('communication_messages')
        .select('id, channel, status, delivered_at, created_at')
        .eq('organizer_id', organizer.id)
        .gte('created_at', thirtyDaysAgoStr)
        .order('created_at', { ascending: true });

      // Calculate daily sends
      const dailyMap = {};
      for (let i = 0; i < 30; i++) {
        const date = new Date();
        date.setDate(date.getDate() - (29 - i));
        const dateStr = date.toISOString().split('T')[0];
        dailyMap[dateStr] = { date: dateStr, email: 0, sms: 0, whatsapp: 0, total: 0 };
      }

      const channelBreakdown = { email: 0, sms: 0, whatsapp: 0 };
      const deliveryStats = { sent: 0, delivered: 0, failed: 0, pending: 0 };

      (recentMessages || []).forEach(msg => {
        const dateStr = msg.created_at?.split('T')[0];
        if (dailyMap[dateStr]) {
          dailyMap[dateStr][msg.channel] = (dailyMap[dateStr][msg.channel] || 0) + 1;
          dailyMap[dateStr].total += 1;
        }
        
        // Channel breakdown
        if (channelBreakdown[msg.channel] !== undefined) {
          channelBreakdown[msg.channel] += 1;
        }
        
        // Delivery stats
        if (msg.status === 'sent' || msg.status === 'delivered') {
          deliveryStats.delivered += 1;
        } else if (msg.status === 'failed') {
          deliveryStats.failed += 1;
        } else if (msg.status === 'pending') {
          deliveryStats.pending += 1;
        }
        deliveryStats.sent += 1;
      });

      const dailySends = Object.values(dailyMap);

      // Get campaign performance
      const { data: campaignData } = await supabase
        .from('communication_campaigns')
        .select('id, name, channels, sent_count, status, created_at, sent_at')
        .eq('organizer_id', organizer.id)
        .order('created_at', { ascending: false })
        .limit(10);

      // Calculate credits used this month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data: creditTxns } = await supabase
        .from('communication_credit_transactions')
        .select('amount')
        .eq('organizer_id', organizer.id)
        .eq('type', 'usage')
        .gte('created_at', startOfMonth.toISOString());

      const creditsUsedThisMonth = (creditTxns || []).reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);

      // Top campaigns by send count
      const topCampaigns = [...(campaignData || [])]
        .filter(c => c.sent_count > 0)
        .sort((a, b) => (b.sent_count || 0) - (a.sent_count || 0))
        .slice(0, 5);

      setAnalytics({
        loading: false,
        dailySends,
        channelBreakdown,
        deliveryStats,
        campaignPerformance: campaignData || [],
        creditsUsedThisMonth,
        topCampaigns,
      });
    } catch (error) {
      console.error('Error loading analytics:', error);
      setAnalytics(prev => ({ ...prev, loading: false }));
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
      setForm(f => ({
        ...f,
        content: {
          ...f.content,
          email: {
            ...f.content.email,
            body: f.content.email.body + variable,
          }
        }
      }));
    } else {
      const field = channel === 'sms' ? 'message' : 'message';
      setForm(f => ({
        ...f,
        content: {
          ...f.content,
          [channel]: {
            ...f.content[channel],
            [field]: (f.content[channel]?.[field] || '') + variable,
          }
        }
      }));
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

      // Update content for each channel
      if (data?.email) {
        setForm(f => ({
          ...f,
          content: {
            ...f.content,
            email: { subject: data.email.subject || '', body: data.email.body || '' },
          }
        }));
      }
      if (data?.sms) {
        setForm(f => ({
          ...f,
          content: { ...f.content, sms: { message: data.sms.message || data.sms } }
        }));
      }
      if (data?.whatsapp) {
        setForm(f => ({
          ...f,
          content: { ...f.content, whatsapp: { message: data.whatsapp.message || data.whatsapp } }
        }));
      }

      setAiPrompt('');
    } catch (err) {
      console.error('AI compose error:', err);
      alert('Failed to generate content. Please try again.');
    } finally {
      setAiLoading(false);
    }
  };

  const sendCampaign = async (sendNow = true) => {
    if (form.channels.length === 0) {
      alert('Please select at least one channel');
      return;
    }
    if (recipientCount === 0) {
      alert('No recipients selected');
      return;
    }

    // Validate content for each channel
    for (const channel of form.channels) {
      if (channel === 'email' && (!form.content.email.subject || !form.content.email.body)) {
        alert('Please fill in email subject and body');
        return;
      }
      if (channel === 'sms' && !form.content.sms.message) {
        alert('Please fill in SMS message');
        return;
      }
      if (channel === 'whatsapp' && !form.content.whatsapp.message) {
        alert('Please fill in WhatsApp message');
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
                
                console.log(`  💬 WhatsApp Response for ${recipient.phone}:`, waResult, error);
                
                if (error || waResult?.error) {
                  console.error(`  ❌ WhatsApp failed for ${recipient.phone}:`, error || waResult?.error);
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
                  status: (error || waResult?.error) ? 'failed' : 'sent',
                  error_message: error?.message || waResult?.error || null,
                  delivered_at: (error || waResult?.error) ? null : new Date().toISOString(),
                });
              } catch (err) {
                console.error(`Error sending WhatsApp to ${recipient.phone}:`, err);
                failCount++;
              }
            }
            
            console.log(`💬 WhatsApp campaign: ${successCount} sent, ${failCount} failed`);
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
          }
        }

        // Update campaign status
        await supabase
          .from('communication_campaigns')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            sent_count: recipientCount,
          })
          .eq('id', campaign.id);
      }

      await loadData();
      resetForm();
      setShowCreateWizard(false);
      alert(sendNow ? `Campaign sent successfully!` : 'Campaign scheduled!');
    } catch (err) {
      console.error('Send error:', err);
      alert('Failed to send campaign: ' + err.message);
    } finally {
      setSending(false);
    }
  };

  const deleteCampaign = async (id) => {
    if (!confirm('Delete this campaign?')) return;
    
    await supabase.from('communication_campaigns').delete().eq('id', id);
    await supabase.from('email_campaigns').delete().eq('id', id); // Also try legacy
    loadCampaigns();
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
          <h1 className="text-2xl font-bold text-[#0F0F0F]">Communication Hub</h1>
          <p className="text-[#0F0F0F]/60">Send emails, SMS, and WhatsApp messages to your audience</p>
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
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card className="border-[#0F0F0F]/10 rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalContacts.toLocaleString()}</p>
                <p className="text-xs text-[#0F0F0F]/60">Contacts</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#0F0F0F]/10 rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <Send className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{campaigns.length}</p>
                <p className="text-xs text-[#0F0F0F]/60">Campaigns</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#0F0F0F]/10 rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Mail className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.emailsSent.toLocaleString()}</p>
                <p className="text-xs text-[#0F0F0F]/60">Emails Sent</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#0F0F0F]/10 rounded-xl cursor-pointer hover:border-[#2969FF]/30 transition-colors" onClick={() => navigate('/organizer/credits')}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#2969FF]">{stats.messageCredits.toLocaleString()}</p>
                <p className="text-xs text-[#0F0F0F]/60">Message Credits</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#0F0F0F]/10 rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <Phone className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.smsCredits.toLocaleString()}</p>
                <p className="text-xs text-[#0F0F0F]/60">SMS Available</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#0F0F0F]/10 rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.whatsappCredits.toLocaleString()}</p>
                <p className="text-xs text-[#0F0F0F]/60">WhatsApp Available</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#0F0F0F]/10 rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{segments.length}</p>
                <p className="text-xs text-[#0F0F0F]/60">Segments</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={(tab) => {
        setActiveTab(tab);
        if (tab === 'analytics' && !analytics.dailySends.length) {
          loadAnalytics();
        }
      }}>
        <TabsList>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Campaigns Tab */}
        <TabsContent value="campaigns" className="space-y-4">
          {campaigns.length === 0 ? (
            <Card className="border-[#0F0F0F]/10 rounded-xl">
              <CardContent className="py-12 text-center">
                <Send className="w-12 h-12 text-[#0F0F0F]/20 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-[#0F0F0F] mb-2">No campaigns yet</h3>
                <p className="text-[#0F0F0F]/60 mb-4">Create your first campaign to reach your audience</p>
                <Button onClick={() => setShowCreateWizard(true)} className="bg-[#2969FF] text-white">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Campaign
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {campaigns.map(campaign => (
                <Card key={campaign.id} className="border-[#0F0F0F]/10 rounded-xl hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium truncate">
                            {campaign.name || campaign.content?.email?.subject || campaign.subject || 'Untitled'}
                          </h3>
                          <Badge variant="secondary" className={
                            campaign.status === 'sent' ? 'bg-green-100 text-green-700' :
                            campaign.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
                            campaign.status === 'sending' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-700'
                          }>
                            {campaign.status === 'sent' && <CheckCircle className="w-3 h-3 mr-1" />}
                            {campaign.status === 'scheduled' && <Clock className="w-3 h-3 mr-1" />}
                            {campaign.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-[#0F0F0F]/60">
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
                          <DropdownMenuItem onClick={() => {/* View details */}}>
                            <Eye className="w-4 h-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {/* Duplicate */}}>
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
                  <Card key={template.id} className="border-[#0F0F0F]/10 rounded-xl hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                            <FileText className="w-5 h-5 text-purple-600" />
                          </div>
                          <div>
                            <h3 className="font-medium">{template.name}</h3>
                            <p className="text-xs text-[#0F0F0F]/60">
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
                <Card key={template.id} className="border-[#0F0F0F]/10 rounded-xl hover:shadow-md transition-shadow cursor-pointer"
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
                        <p className="text-xs text-[#0F0F0F]/60">{template.category}</p>
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
            <Card className="border-dashed border-2 border-[#0F0F0F]/10 rounded-xl">
              <CardContent className="py-8 text-center">
                <FileText className="w-12 h-12 text-[#0F0F0F]/20 mx-auto mb-4" />
                <h3 className="font-medium mb-2">No custom templates yet</h3>
                <p className="text-sm text-[#0F0F0F]/60 mb-4">
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

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          {analytics.loading ? (
            <Card className="border-[#0F0F0F]/10 rounded-xl">
              <CardContent className="py-12 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#2969FF] mx-auto mb-4" />
                <p className="text-[#0F0F0F]/60">Loading analytics...</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="border-[#0F0F0F]/10 rounded-xl">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                        <Send className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{analytics.deliveryStats.sent.toLocaleString()}</p>
                        <p className="text-xs text-[#0F0F0F]/60">Messages Sent (30d)</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-[#0F0F0F]/10 rounded-xl">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">
                          {analytics.deliveryStats.sent > 0 
                            ? Math.round((analytics.deliveryStats.delivered / analytics.deliveryStats.sent) * 100)
                            : 0}%
                        </p>
                        <p className="text-xs text-[#0F0F0F]/60">Delivery Rate</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-[#0F0F0F]/10 rounded-xl">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                        <Zap className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{analytics.creditsUsedThisMonth.toLocaleString()}</p>
                        <p className="text-xs text-[#0F0F0F]/60">Credits Used (Month)</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-[#0F0F0F]/10 rounded-xl">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                        <BarChart3 className="w-5 h-5 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{analytics.campaignPerformance.length}</p>
                        <p className="text-xs text-[#0F0F0F]/60">Recent Campaigns</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Messages Over Time */}
                <Card className="border-[#0F0F0F]/10 rounded-xl">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-[#2969FF]" />
                      Messages Over Time (Last 30 Days)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {analytics.dailySends.length > 0 ? (
                      <div className="space-y-2">
                        {/* Mini bar chart using CSS */}
                        <div className="flex items-end gap-1 h-32">
                          {analytics.dailySends.map((day, idx) => {
                            const maxTotal = Math.max(...analytics.dailySends.map(d => d.total), 1);
                            const height = (day.total / maxTotal) * 100;
                            return (
                              <div 
                                key={idx} 
                                className="flex-1 bg-[#2969FF]/20 rounded-t relative group cursor-pointer"
                                style={{ height: `${Math.max(height, 4)}%` }}
                              >
                                <div 
                                  className="absolute bottom-0 left-0 right-0 bg-[#2969FF] rounded-t transition-all"
                                  style={{ height: `${height > 0 ? 100 : 0}%` }}
                                />
                                {/* Tooltip */}
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                                  <div className="bg-[#0F0F0F] text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                                    {day.date}: {day.total} sent
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex justify-between text-xs text-[#0F0F0F]/50">
                          <span>{analytics.dailySends[0]?.date?.slice(5)}</span>
                          <span>{analytics.dailySends[analytics.dailySends.length - 1]?.date?.slice(5)}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="h-32 flex items-center justify-center text-[#0F0F0F]/40">
                        No message data yet
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Channel Breakdown */}
                <Card className="border-[#0F0F0F]/10 rounded-xl">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Target className="w-4 h-4 text-[#2969FF]" />
                      Channel Breakdown
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(analytics.channelBreakdown.email + analytics.channelBreakdown.sms + analytics.channelBreakdown.whatsapp) > 0 ? (
                      <div className="space-y-4">
                        {/* Email */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <Mail className="w-4 h-4 text-blue-600" />
                              <span>Email</span>
                            </div>
                            <span className="font-medium">{analytics.channelBreakdown.email.toLocaleString()}</span>
                          </div>
                          <div className="h-2 bg-[#0F0F0F]/10 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-blue-500 rounded-full transition-all"
                              style={{ 
                                width: `${(analytics.channelBreakdown.email / Math.max(analytics.deliveryStats.sent, 1)) * 100}%` 
                              }}
                            />
                          </div>
                        </div>

                        {/* SMS */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <Phone className="w-4 h-4 text-green-600" />
                              <span>SMS</span>
                            </div>
                            <span className="font-medium">{analytics.channelBreakdown.sms.toLocaleString()}</span>
                          </div>
                          <div className="h-2 bg-[#0F0F0F]/10 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-green-500 rounded-full transition-all"
                              style={{ 
                                width: `${(analytics.channelBreakdown.sms / Math.max(analytics.deliveryStats.sent, 1)) * 100}%` 
                              }}
                            />
                          </div>
                        </div>

                        {/* WhatsApp */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <MessageSquare className="w-4 h-4 text-emerald-600" />
                              <span>WhatsApp</span>
                            </div>
                            <span className="font-medium">{analytics.channelBreakdown.whatsapp.toLocaleString()}</span>
                          </div>
                          <div className="h-2 bg-[#0F0F0F]/10 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-emerald-500 rounded-full transition-all"
                              style={{ 
                                width: `${(analytics.channelBreakdown.whatsapp / Math.max(analytics.deliveryStats.sent, 1)) * 100}%` 
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="h-32 flex items-center justify-center text-[#0F0F0F]/40">
                        No channel data yet
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Delivery Stats & Top Campaigns */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Delivery Stats */}
                <Card className="border-[#0F0F0F]/10 rounded-xl">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      Delivery Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center p-3 bg-green-50 rounded-xl">
                        <p className="text-2xl font-bold text-green-600">{analytics.deliveryStats.delivered}</p>
                        <p className="text-xs text-green-700">Delivered</p>
                      </div>
                      <div className="text-center p-3 bg-red-50 rounded-xl">
                        <p className="text-2xl font-bold text-red-600">{analytics.deliveryStats.failed}</p>
                        <p className="text-xs text-red-700">Failed</p>
                      </div>
                      <div className="text-center p-3 bg-yellow-50 rounded-xl">
                        <p className="text-2xl font-bold text-yellow-600">{analytics.deliveryStats.pending}</p>
                        <p className="text-xs text-yellow-700">Pending</p>
                      </div>
                    </div>

                    {/* Delivery rate visual */}
                    <div className="mt-4">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-[#0F0F0F]/60">Overall Delivery Rate</span>
                        <span className="font-medium">
                          {analytics.deliveryStats.sent > 0 
                            ? Math.round((analytics.deliveryStats.delivered / analytics.deliveryStats.sent) * 100)
                            : 0}%
                        </span>
                      </div>
                      <div className="h-3 bg-[#0F0F0F]/10 rounded-full overflow-hidden flex">
                        <div 
                          className="h-full bg-green-500"
                          style={{ 
                            width: `${analytics.deliveryStats.sent > 0 ? (analytics.deliveryStats.delivered / analytics.deliveryStats.sent) * 100 : 0}%` 
                          }}
                        />
                        <div 
                          className="h-full bg-red-500"
                          style={{ 
                            width: `${analytics.deliveryStats.sent > 0 ? (analytics.deliveryStats.failed / analytics.deliveryStats.sent) * 100 : 0}%` 
                          }}
                        />
                        <div 
                          className="h-full bg-yellow-500"
                          style={{ 
                            width: `${analytics.deliveryStats.sent > 0 ? (analytics.deliveryStats.pending / analytics.deliveryStats.sent) * 100 : 0}%` 
                          }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Top Campaigns */}
                <Card className="border-[#0F0F0F]/10 rounded-xl">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-amber-600" />
                      Top Campaigns
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {analytics.topCampaigns.length > 0 ? (
                      <div className="space-y-3">
                        {analytics.topCampaigns.map((campaign, idx) => (
                          <div key={campaign.id} className="flex items-center gap-3">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                              idx === 0 ? 'bg-amber-100 text-amber-700' :
                              idx === 1 ? 'bg-gray-200 text-gray-600' :
                              idx === 2 ? 'bg-orange-100 text-orange-700' :
                              'bg-[#F4F6FA] text-[#0F0F0F]/60'
                            }`}>
                              {idx + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{campaign.name || 'Untitled Campaign'}</p>
                              <p className="text-xs text-[#0F0F0F]/50">{campaign.sent_count?.toLocaleString() || 0} messages</p>
                            </div>
                            <div className="flex gap-1">
                              {campaign.channels?.map(ch => {
                                const channel = CHANNELS.find(c => c.id === ch);
                                const Icon = channel?.icon || Mail;
                                return (
                                  <Icon key={ch} className={`w-3 h-3 ${channel?.color || 'text-gray-400'}`} />
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="h-32 flex items-center justify-center text-[#0F0F0F]/40">
                        <div className="text-center">
                          <Send className="w-8 h-8 mx-auto mb-2 opacity-30" />
                          <p>No campaigns with sends yet</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Recent Campaign Activity */}
              <Card className="border-[#0F0F0F]/10 rounded-xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#2969FF]" />
                    Recent Campaign Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {analytics.campaignPerformance.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[#0F0F0F]/10">
                            <th className="text-left py-2 font-medium text-[#0F0F0F]/60">Campaign</th>
                            <th className="text-left py-2 font-medium text-[#0F0F0F]/60">Channels</th>
                            <th className="text-right py-2 font-medium text-[#0F0F0F]/60">Sent</th>
                            <th className="text-right py-2 font-medium text-[#0F0F0F]/60">Status</th>
                            <th className="text-right py-2 font-medium text-[#0F0F0F]/60">Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analytics.campaignPerformance.slice(0, 8).map(campaign => (
                            <tr key={campaign.id} className="border-b border-[#0F0F0F]/5 hover:bg-[#F4F6FA]/50">
                              <td className="py-3">
                                <p className="font-medium truncate max-w-[200px]">{campaign.name || 'Untitled'}</p>
                              </td>
                              <td className="py-3">
                                <div className="flex gap-1">
                                  {campaign.channels?.map(ch => {
                                    const channel = CHANNELS.find(c => c.id === ch);
                                    const Icon = channel?.icon || Mail;
                                    return (
                                      <div key={ch} className={`w-6 h-6 rounded-full ${channel?.bgColor} flex items-center justify-center`}>
                                        <Icon className={`w-3 h-3 ${channel?.color}`} />
                                      </div>
                                    );
                                  })}
                                </div>
                              </td>
                              <td className="py-3 text-right font-medium">
                                {campaign.sent_count?.toLocaleString() || 0}
                              </td>
                              <td className="py-3 text-right">
                                <Badge className={
                                  campaign.status === 'sent' ? 'bg-green-100 text-green-700' :
                                  campaign.status === 'sending' ? 'bg-blue-100 text-blue-700' :
                                  campaign.status === 'scheduled' ? 'bg-purple-100 text-purple-700' :
                                  campaign.status === 'draft' ? 'bg-gray-100 text-gray-600' :
                                  'bg-gray-100 text-gray-600'
                                }>
                                  {campaign.status}
                                </Badge>
                              </td>
                              <td className="py-3 text-right text-[#0F0F0F]/60">
                                {campaign.sent_at 
                                  ? format(new Date(campaign.sent_at), 'MMM d, yyyy')
                                  : format(new Date(campaign.created_at), 'MMM d, yyyy')
                                }
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="py-8 text-center text-[#0F0F0F]/40">
                      <Calendar className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p>No campaigns yet. Create your first campaign to see analytics.</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Refresh Button */}
              <div className="flex justify-center">
                <Button 
                  variant="outline" 
                  onClick={loadAnalytics}
                  className="rounded-xl"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh Analytics
                </Button>
              </div>
            </>
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
                  s < wizardStep ? 'bg-green-500 text-white' : 'bg-[#F4F6FA] text-[#0F0F0F]/40'
                }`}>
                  {s < wizardStep ? <CheckCircle className="w-4 h-4" /> : s}
                </div>
                {s < 4 && <div className={`w-12 h-1 mx-1 rounded ${s < wizardStep ? 'bg-green-500' : 'bg-[#F4F6FA]'}`} />}
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
                        : 'border-[#0F0F0F]/10 hover:border-[#0F0F0F]/20'
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
                        <p className="text-xs text-[#0F0F0F]/60">{channel.description}</p>
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
                        : 'border-[#0F0F0F]/10 hover:border-[#0F0F0F]/20'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        form.audienceType === type.id ? 'bg-[#2969FF] text-white' : 'bg-[#F4F6FA]'
                      }`}>
                        <type.icon className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-medium">{type.label}</p>
                        <p className="text-sm text-[#0F0F0F]/60">{type.description}</p>
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
                          : 'bg-[#F4F6FA] hover:bg-[#E8EBF0]'
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
                      <div className="mt-1 rounded-xl overflow-hidden border border-[#0F0F0F]/10">
                        <ReactQuill
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
                            className="px-2 py-1 bg-[#F4F6FA] hover:bg-[#E8EBF0] rounded text-xs font-mono"
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
                      <Label>SMS Message <span className="text-[#0F0F0F]/40">({(form.content.sms.message || '').length}/160)</span></Label>
                      <Textarea
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
                            className="px-2 py-1 bg-[#F4F6FA] hover:bg-[#E8EBF0] rounded text-xs font-mono"
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
                        value={form.content.whatsapp.message}
                        onChange={e => updateContent('whatsapp', 'message', e.target.value)}
                        placeholder="Write your WhatsApp message..."
                        className="mt-1 min-h-[150px]"
                      />
                      <p className="text-xs text-[#0F0F0F]/40 mt-1">Use *bold* and _italic_ for formatting</p>
                    </div>
                    <div>
                      <Label className="mb-2 block text-sm">Insert Variable</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {VARIABLES.map(v => (
                          <button
                            key={v.key}
                            onClick={() => insertVariable('whatsapp', v.key)}
                            className="px-2 py-1 bg-[#F4F6FA] hover:bg-[#E8EBF0] rounded text-xs font-mono"
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
              <div className="flex items-center justify-between pt-4 border-t border-[#0F0F0F]/10">
                <p className="text-sm text-[#0F0F0F]/60">
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
                <p className="text-[#0F0F0F]/60">Review your campaign before sending</p>
              </div>

              {/* Summary */}
              <div className="bg-[#F4F6FA] rounded-xl p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-[#0F0F0F]/60">Channels</span>
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
                  <span className="text-[#0F0F0F]/60">Audience</span>
                  <span className="font-medium">
                    {AUDIENCE_TYPES.find(t => t.id === form.audienceType)?.label}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#0F0F0F]/60">Recipients</span>
                  <span className="font-medium">{recipientCount.toLocaleString()}</span>
                </div>
                {form.channels.includes('email') && (
                  <div className="flex justify-between">
                    <span className="text-[#0F0F0F]/60">Email Subject</span>
                    <span className="font-medium truncate max-w-[200px]">{form.content.email.subject}</span>
                  </div>
                )}
              </div>

              {/* Preview */}
              <div className="border border-[#0F0F0F]/10 rounded-xl overflow-hidden">
                <div className="bg-[#F4F6FA] p-3 border-b border-[#0F0F0F]/10 flex items-center gap-2">
                  <Eye className="w-4 h-4 text-[#0F0F0F]/60" />
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
                          <div className="bg-gray-100 rounded-xl p-4 max-w-sm">
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
                <p className="text-xs text-[#0F0F0F]/40 mt-1">Leave empty to send immediately</p>
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

            <div className="bg-[#F4F6FA] rounded-lg p-3 text-sm text-[#0F0F0F]/60">
              <p className="font-medium text-[#0F0F0F] mb-1">Content Preview</p>
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
    </div>
  );
}

export default CommunicationHub;
