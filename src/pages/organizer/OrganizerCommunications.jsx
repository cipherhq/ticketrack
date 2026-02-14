import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import DOMPurify from 'dompurify';
import {
  Mail, Send, Clock, CheckCircle, Users, Calendar, Loader2,
  Sparkles, ChevronRight, ChevronLeft, Eye, Trash2, RefreshCw,
  FileText, UserCheck, Heart, AlertCircle
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useOrganizer } from '@/contexts/OrganizerContext';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { toast } from 'sonner';

// ============================================================================
// CONSTANTS
// ============================================================================

const TEMPLATES = [
  {
    id: 'reminder',
    name: 'Event Reminder',
    icon: Clock,
    subject: 'Reminder: {{event_name}} is tomorrow!',
    body: `<p>Hi {{attendee_name}},</p>
<p>This is a friendly reminder that <strong>{{event_name}}</strong> is happening tomorrow!</p>
<p>📅 <strong>Date:</strong> {{event_date}} at {{event_time}}<br/>
📍 <strong>Venue:</strong> {{event_venue}}, {{event_city}}</p>
<p>Don't forget to bring your ticket or show your QR code at entry.</p>
<p>See you there!</p>
<p>Best regards,<br/>{{organizer_name}}</p>`
  },
  {
    id: 'thankyou',
    name: 'Thank You',
    icon: Heart,
    subject: 'Thank you for attending {{event_name}}!',
    body: `<p>Hi {{attendee_name}},</p>
<p>Thank you for attending <strong>{{event_name}}</strong>! We hope you had an amazing time.</p>
<p>Your support means the world to us. We'd love to hear your feedback to help us improve future events.</p>
<p>Stay tuned for more exciting events coming soon!</p>
<p>Best regards,<br/>{{organizer_name}}</p>`
  },
  {
    id: 'announcement',
    name: 'New Event',
    icon: Calendar,
    subject: "You're Invited: {{event_name}}",
    body: `<p>Hi {{attendee_name}},</p>
<p>We're excited to announce our upcoming event: <strong>{{event_name}}</strong>!</p>
<p>📅 <strong>Date:</strong> {{event_date}} at {{event_time}}<br/>
📍 <strong>Venue:</strong> {{event_venue}}, {{event_city}}</p>
<p>Early bird tickets are available now. Don't miss out!</p>
<p><a href="{{event_link}}">Get Your Tickets →</a></p>
<p>Best regards,<br/>{{organizer_name}}</p>`
  },
  {
    id: 'update',
    name: 'Important Update',
    icon: AlertCircle,
    subject: 'Important Update: {{event_name}}',
    body: `<p>Hi {{attendee_name}},</p>
<p>We have an important update regarding <strong>{{event_name}}</strong>.</p>
<p>[Your update message here]</p>
<p>If you have any questions, please don't hesitate to reach out.</p>
<p>Best regards,<br/>{{organizer_name}}</p>`
  },
  {
    id: 'custom',
    name: 'Custom Email',
    icon: FileText,
    subject: '',
    body: ''
  }
];

const RECIPIENT_TYPES = [
  { id: 'event_attendees', label: 'Event Attendees', icon: UserCheck, description: 'People who bought tickets for a specific event' },
  { id: 'followers', label: 'Followers', icon: Heart, description: 'People following your organizer profile' },
  { id: 'team', label: 'Team Members', icon: Users, description: 'Your team members' },
];

const VARIABLES = [
  { key: '{{attendee_name}}', label: 'Recipient Name' },
  { key: '{{event_name}}', label: 'Event Name' },
  { key: '{{event_date}}', label: 'Event Date' },
  { key: '{{event_time}}', label: 'Event Time' },
  { key: '{{event_venue}}', label: 'Venue Name' },
  { key: '{{event_city}}', label: 'City' },
  { key: '{{event_link}}', label: 'Event Link' },
  { key: '{{ticket_type}}', label: 'Ticket Type' },
  { key: '{{organizer_name}}', label: 'Your Business Name' },
  { key: '{{organizer_email}}', label: 'Your Email' },
];

const QUILL_MODULES = {
  toolbar: [
    ['bold', 'italic', 'underline'],
    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
    ['link'],
    ['clean']
  ],
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function OrganizerCommunications() {
  const navigate = useNavigate();
  const { organizer } = useOrganizer();
  
  // View state
  const [view, setView] = useState('list'); // list, create
  const [step, setStep] = useState(1); // 1: Recipients, 2: Compose, 3: Review
  
  // Data
  const [campaigns, setCampaigns] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [recipientCount, setRecipientCount] = useState(0);
  
  // Form
  const [form, setForm] = useState({
    recipientType: '',
    eventId: '',
    template: '',
    subject: '',
    body: '',
    scheduleFor: '',
  });
  
  // AI
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  useEffect(() => {
    if (organizer?.id) loadData();
  }, [organizer?.id]);

  useEffect(() => {
    if (organizer?.id && form.recipientType) {
      calculateRecipients();
    }
  }, [form.recipientType, form.eventId, organizer?.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [campaignsRes, eventsRes] = await Promise.all([
        supabase
          .from('email_campaigns')
          .select('*')
          .eq('organizer_id', organizer.id)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('events')
          .select('id, title, start_date, venue_name, city')
          .eq('organizer_id', organizer.id)
          .order('start_date', { ascending: false }),
      ]);
      
      setCampaigns(campaignsRes.data || []);
      setEvents(eventsRes.data || []);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateRecipients = async () => {
    let count = 0;
    
    if (form.recipientType === 'event_attendees' && form.eventId) {
      const { count: c } = await supabase
        .from('tickets')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', form.eventId)
        .in('payment_status', ['completed', 'free', 'paid', 'complimentary']);
      count = c || 0;
    } else if (form.recipientType === 'followers') {
      const { count: c } = await supabase
        .from('followers')
        .select('id', { count: 'exact', head: true })
        .eq('organizer_id', organizer.id);
      count = c || 0;
    } else if (form.recipientType === 'team') {
      const { count: c } = await supabase
        .from('organizer_team_members')
        .select('id', { count: 'exact', head: true })
        .eq('organizer_id', organizer.id)
        .in('status', ['active', 'pending']);
      count = c || 0;
    }
    
    setRecipientCount(count);
  };

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const selectTemplate = (templateId) => {
    const template = TEMPLATES.find(t => t.id === templateId);
    if (template) {
      setForm(f => ({
        ...f,
        template: templateId,
        subject: template.subject,
        body: template.body,
      }));
    }
  };

  const generateWithAI = async () => {
    if (!aiPrompt.trim()) return;
    
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-compose', {
        body: {
          prompt: aiPrompt,
          context: {
            organizerName: organizer.business_name || organizer.name,
            eventName: events.find(e => e.id === form.eventId)?.title,
          }
        }
      });
      
      if (error) throw error;
      
      if (data?.subject) setForm(f => ({ ...f, subject: data.subject }));
      if (data?.body) setForm(f => ({ ...f, body: data.body }));
      setAiPrompt('');
    } catch (err) {
      console.error('AI compose error:', err);
      toast.error('Failed to generate content. Please try again.');
    } finally {
      setAiLoading(false);
    }
  };

  const sendCampaign = async (sendNow = true) => {
    if (!form.subject.trim() || !form.body.trim()) {
      toast.error('Please fill in subject and message');
      return;
    }
    if (recipientCount === 0) {
      toast.info('No recipients selected');
      return;
    }

    setSending(true);
    try {
      // 1. Create campaign record
      const { data: campaign, error: campaignError } = await supabase
        .from('email_campaigns')
        .insert({
          organizer_id: organizer.id,
          name: form.subject.substring(0, 50),
          subject: form.subject,
          body: form.body,
          recipient_type: form.recipientType,
          event_id: form.eventId || null,
          status: sendNow ? 'sending' : 'scheduled',
          scheduled_for: form.scheduleFor || null,
          total_recipients: recipientCount,
        })
        .select()
        .single();

      if (campaignError) throw campaignError;

      // 2. If sending now, fetch recipients and send emails
      if (sendNow) {
        const recipients = await fetchRecipients();
        
        if (recipients.length > 0) {
          const event = events.find(e => e.id === form.eventId);
          
          // Send via edge function
          const { error: sendError } = await supabase.functions.invoke('send-bulk-email', {
            body: {
              campaignId: campaign.id,
              recipients: recipients,
              subject: form.subject,
              body: form.body,
              variables: {
                event_name: event?.title || '',
                event_date: event?.start_date ? format(new Date(event.start_date), 'MMMM d, yyyy') : '',
                event_time: event?.start_time || '',
                event_venue: event?.venue_name || '',
                event_city: event?.city || '',
                event_link: event ? `${window.location.origin}/events/${event.id}` : '',
                organizer_name: organizer.business_name || organizer.name,
                organizer_email: organizer.email || '',
              },
              organizerId: organizer.id,
            }
          });

          if (sendError) throw sendError;
        }

        // Update status
        await supabase
          .from('email_campaigns')
          .update({ status: 'sent', sent_at: new Date().toISOString(), total_sent: recipients.length })
          .eq('id', campaign.id);
      }

      await loadData();
      resetForm();
      setView('list');
      toast.success(sendNow ? `Campaign sent to ${recipientCount} recipients!` : 'Campaign scheduled successfully!');
    } catch (err) {
      console.error('Send error:', err);
      toast.error('Failed to send campaign: ' + err.message);
    } finally {
      setSending(false);
    }
  };

  const fetchRecipients = async () => {
    let recipients = [];

    if (form.recipientType === 'event_attendees' && form.eventId) {
      const { data } = await supabase
        .from('tickets')
        .select('attendee_email, attendee_name, ticket_types(name)')
        .eq('event_id', form.eventId)
        .in('payment_status', ['completed', 'free', 'paid', 'complimentary']);
      
      recipients = (data || []).map(t => ({
        email: t.attendee_email,
        name: t.attendee_name,
        ticket_type: t.ticket_types?.name || 'General',
      }));
    } else if (form.recipientType === 'followers') {
      const { data } = await supabase
        .from('followers')
        .select('profiles(email, full_name)')
        .eq('organizer_id', organizer.id);
      
      recipients = (data || []).map(f => ({
        email: f.profiles?.email,
        name: f.profiles?.full_name || 'there',
      })).filter(r => r.email);
    } else if (form.recipientType === 'team') {
      const { data } = await supabase
        .from('organizer_team_members')
        .select('email, name')
        .eq('organizer_id', organizer.id)
        .in('status', ['active', 'pending']);
      
      recipients = (data || []).map(m => ({
        email: m.email,
        name: m.name || 'Team Member',
      }));
    }

    return recipients;
  };

  const deleteCampaign = async (id) => {
    if (!confirm('Delete this campaign?')) return;
    await supabase.from('email_campaigns').delete().eq('id', id);
    loadData();
  };

  const resetForm = () => {
    setForm({ recipientType: '', eventId: '', template: '', subject: '', body: '', scheduleFor: '' });
    setStep(1);
    setRecipientCount(0);
  };

  // ============================================================================
  // PREVIEW
  // ============================================================================

  const previewHtml = useMemo(() => {
    let html = form.body;
    const event = events.find(e => e.id === form.eventId);
    
    const replacements = {
      '{{attendee_name}}': 'John Doe',
      '{{event_name}}': event?.title || 'Event Name',
      '{{event_date}}': event?.start_date ? format(new Date(event.start_date), 'MMMM d, yyyy') : 'January 1, 2026',
      '{{event_time}}': event?.start_time || '7:00 PM',
      '{{event_venue}}': event?.venue_name || 'Venue Name',
      '{{event_city}}': event?.city || 'City',
      '{{event_link}}': '#',
      '{{ticket_type}}': 'General Admission',
      '{{organizer_name}}': organizer?.business_name || organizer?.name || 'Organizer',
      '{{organizer_email}}': organizer?.email || 'email@example.com',
    };

    Object.entries(replacements).forEach(([key, value]) => {
      html = html.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
    });

    return html;
  }, [form.body, form.eventId, events, organizer]);

  // ============================================================================
  // RENDER: CAMPAIGN LIST
  // ============================================================================

  if (view === 'list') {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Communications</h1>
            <p className="text-muted-foreground">Send emails to your attendees, followers, and team</p>
          </div>
          <Button onClick={() => setView('create')} className="bg-[#2969FF] text-white rounded-xl">
            <Mail className="w-4 h-4 mr-2" />
            New Campaign
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="rounded-2xl border-border/10">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <Mail className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{campaigns.length}</p>
                <p className="text-xs text-muted-foreground">Total Campaigns</p>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-border/10">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                <Send className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{campaigns.reduce((sum, c) => sum + (c.total_sent || 0), 0)}</p>
                <p className="text-xs text-muted-foreground">Emails Sent</p>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-border/10">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{campaigns.filter(c => c.status === 'scheduled').length}</p>
                <p className="text-xs text-muted-foreground">Scheduled</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Campaign List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" />
          </div>
        ) : campaigns.length === 0 ? (
          <Card className="rounded-2xl border-border/10">
            <CardContent className="py-12 text-center">
              <Mail className="w-12 h-12 text-foreground/20 mx-auto mb-3" />
              <p className="text-muted-foreground mb-4">No campaigns yet</p>
              <Button onClick={() => setView('create')} className="bg-[#2969FF] text-white rounded-xl">
                Create Your First Campaign
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {campaigns.map(campaign => (
              <Card key={campaign.id} className="rounded-2xl border-border/10 hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium truncate">{campaign.subject || campaign.name}</h3>
                        <Badge variant="secondary" className={
                          campaign.status === 'sent' ? 'bg-green-100 text-green-700' :
                          campaign.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
                          campaign.status === 'sending' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-muted text-foreground/80'
                        }>
                          {campaign.status === 'sent' && <CheckCircle className="w-3 h-3 mr-1" />}
                          {campaign.status === 'scheduled' && <Clock className="w-3 h-3 mr-1" />}
                          {campaign.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          {campaign.total_sent || campaign.total_recipients || 0} recipients
                        </span>
                        <span>
                          {format(new Date(campaign.created_at), 'MMM d, yyyy')}
                        </span>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => deleteCampaign(campaign.id)} className="text-red-500 hover:text-red-600 hover:bg-red-50">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ============================================================================
  // RENDER: CREATE CAMPAIGN
  // ============================================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">New Campaign</h1>
          <p className="text-muted-foreground">
            Step {step} of 3: {step === 1 ? 'Select Recipients' : step === 2 ? 'Compose Message' : 'Review & Send'}
          </p>
        </div>
        <Button variant="outline" onClick={() => { resetForm(); setView('list'); }} className="rounded-xl">
          Cancel
        </Button>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map(s => (
          <div key={s} className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              s === step ? 'bg-[#2969FF] text-white' : 
              s < step ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'
            }`}>
              {s < step ? <CheckCircle className="w-4 h-4" /> : s}
            </div>
            {s < 3 && <div className={`w-16 h-1 mx-2 rounded ${s < step ? 'bg-green-500' : 'bg-muted'}`} />}
          </div>
        ))}
      </div>

      {/* Step 1: Recipients */}
      {step === 1 && (
        <Card className="rounded-2xl border-border/10">
          <CardContent className="p-6 space-y-6">
            <div>
              <Label className="text-base font-medium mb-3 block">Who do you want to email?</Label>
              <div className="grid gap-3">
                {RECIPIENT_TYPES.map(type => (
                  <button
                    key={type.id}
                    onClick={() => setForm(f => ({ ...f, recipientType: type.id, eventId: '' }))}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      form.recipientType === type.id 
                        ? 'border-[#2969FF] bg-[#2969FF]/5' 
                        : 'border-border/10 hover:border-border/20'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        form.recipientType === type.id ? 'bg-[#2969FF] text-white' : 'bg-muted'
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
            </div>

            {form.recipientType === 'event_attendees' && (
              <div>
                <Label>Select Event</Label>
                <Select value={form.eventId} onValueChange={v => setForm(f => ({ ...f, eventId: v }))}>
                  <SelectTrigger className="rounded-xl mt-1">
                    <SelectValue placeholder="Choose an event" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {events.map(event => (
                      <SelectItem key={event.id} value={event.id}>
                        {event.title} ({format(new Date(event.start_date), 'MMM d')})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {recipientCount > 0 && (
              <div className="flex items-center gap-2 p-3 bg-green-50 rounded-xl text-green-700">
                <CheckCircle className="w-5 h-5" />
                <span>This campaign will be sent to <strong>{recipientCount}</strong> recipients</span>
              </div>
            )}

            <div className="flex justify-end">
              <Button 
                onClick={() => setStep(2)} 
                disabled={!form.recipientType || (form.recipientType === 'event_attendees' && !form.eventId) || recipientCount === 0}
                className="bg-[#2969FF] text-white rounded-xl"
              >
                Continue <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Compose */}
      {step === 2 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Editor */}
          <Card className="rounded-2xl border-border/10">
            <CardContent className="p-6 space-y-4">
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

              {/* Subject */}
              <div>
                <Label>Subject Line</Label>
                <Input
                  value={form.subject}
                  onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                  placeholder="Enter email subject..."
                  className="rounded-xl mt-1"
                />
              </div>

              {/* Body */}
              <div>
                <Label>Message</Label>
                <div className="mt-1 rounded-xl overflow-hidden border border-border/10">
                  <ReactQuill
                    theme="snow"
                    value={form.body}
                    onChange={v => setForm(f => ({ ...f, body: v }))}
                    modules={QUILL_MODULES}
                    placeholder="Write your message..."
                    style={{ minHeight: '200px' }}
                  />
                </div>
              </div>

              {/* Variables */}
              <div>
                <Label className="mb-2 block text-sm">Insert Variable</Label>
                <div className="flex flex-wrap gap-1.5">
                  {VARIABLES.map(v => (
                    <button
                      key={v.key}
                      onClick={() => setForm(f => ({ ...f, body: f.body + v.key }))}
                      className="px-2 py-1 bg-muted hover:bg-[#E8EBF0] rounded text-xs font-mono"
                      title={v.label}
                    >
                      {v.key}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep(1)} className="rounded-xl">
                  <ChevronLeft className="w-4 h-4 mr-1" /> Back
                </Button>
                <Button 
                  onClick={() => setStep(3)} 
                  disabled={!form.subject.trim() || !form.body.trim()}
                  className="bg-[#2969FF] text-white rounded-xl"
                >
                  Continue <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Preview */}
          <Card className="rounded-2xl border-border/10">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Eye className="w-4 h-4 text-muted-foreground" />
                <Label>Preview</Label>
              </div>
              <div className="border border-border/10 rounded-xl overflow-hidden">
                <div className="bg-muted p-3 border-b border-border/10">
                  <p className="text-sm"><strong>Subject:</strong> {form.subject || '(No subject)'}</p>
                </div>
                <div
                  className="p-4 prose prose-sm max-w-none min-h-[300px]"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(previewHtml || '<p class="text-muted-foreground">Your message will appear here...</p>', { ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'b', 'i', 'u', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'blockquote', 'span'], ALLOWED_ATTR: ['href', 'target', 'rel', 'class'] }) }}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Step 3: Review & Send */}
      {step === 3 && (
        <Card className="rounded-2xl border-border/10">
          <CardContent className="p-6 space-y-6">
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full bg-[#2969FF]/10 flex items-center justify-center mx-auto mb-4">
                <Send className="w-8 h-8 text-[#2969FF]" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Ready to Send</h2>
              <p className="text-muted-foreground">
                Your campaign will be sent to <strong>{recipientCount}</strong> recipients
              </p>
            </div>

            {/* Summary */}
            <div className="bg-muted rounded-xl p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Recipients</span>
                <span className="font-medium">{RECIPIENT_TYPES.find(t => t.id === form.recipientType)?.label} ({recipientCount})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subject</span>
                <span className="font-medium truncate max-w-[200px]">{form.subject}</span>
              </div>
            </div>

            {/* Schedule Option */}
            <div>
              <Label>Schedule for later (optional)</Label>
              <Input
                type="datetime-local"
                value={form.scheduleFor}
                onChange={e => setForm(f => ({ ...f, scheduleFor: e.target.value }))}
                className="rounded-xl mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">Leave empty to send immediately</p>
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(2)} className="rounded-xl">
                <ChevronLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <div className="flex gap-2">
                {form.scheduleFor && (
                  <Button 
                    onClick={() => sendCampaign(false)} 
                    disabled={sending}
                    variant="outline"
                    className="rounded-xl"
                  >
                    {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Clock className="w-4 h-4 mr-2" />}
                    Schedule
                  </Button>
                )}
                <Button 
                  onClick={() => sendCampaign(true)} 
                  disabled={sending}
                  className="bg-[#2969FF] text-white rounded-xl"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                  Send Now
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default OrganizerCommunications;
