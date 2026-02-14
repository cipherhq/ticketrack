import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Zap, Clock, Mail, Phone, MessageSquare, Calendar, Plus, Edit,
  Trash2, Play, Pause, CheckCircle, AlertCircle, Loader2, Copy,
  ChevronRight, ChevronDown, Settings, Users, Ticket, ShoppingCart,
  Heart, Bell, Send, ArrowRight, MoreVertical, Eye, TrendingUp
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

// Trigger types configuration
const TRIGGER_TYPES = [
  {
    id: 'ticket_purchase',
    name: 'Ticket Purchase',
    icon: Ticket,
    description: 'When someone buys a ticket',
    category: 'transaction',
  },
  {
    id: 'event_reminder_7d',
    name: 'Event Reminder (7 days)',
    icon: Calendar,
    description: '7 days before event starts',
    category: 'reminder',
  },
  {
    id: 'event_reminder_1d',
    name: 'Event Reminder (1 day)',
    icon: Calendar,
    description: '1 day before event starts',
    category: 'reminder',
  },
  {
    id: 'event_reminder_2h',
    name: 'Event Reminder (2 hours)',
    icon: Clock,
    description: '2 hours before event starts',
    category: 'reminder',
  },
  {
    id: 'post_event',
    name: 'Post-Event Follow-up',
    icon: Heart,
    description: '1 day after event ends',
    category: 'follow_up',
  },
  {
    id: 'cart_abandoned',
    name: 'Abandoned Cart',
    icon: ShoppingCart,
    description: 'When checkout is not completed',
    category: 'recovery',
  },
  {
    id: 'new_follower',
    name: 'New Follower',
    icon: Users,
    description: 'When someone follows your profile',
    category: 'engagement',
  },
  {
    id: 'waitlist_joined',
    name: 'Waitlist Signup',
    icon: Bell,
    description: 'When someone joins a waitlist',
    category: 'engagement',
  },
];

// Pre-built automation templates
const AUTOMATION_TEMPLATES = [
  {
    id: 'event_reminder_sequence',
    name: 'Event Reminder Sequence',
    description: 'Automatic reminders at 7 days, 1 day, and 2 hours before event',
    icon: Calendar,
    triggers: ['event_reminder_7d', 'event_reminder_1d', 'event_reminder_2h'],
    actions: [
      { trigger: 'event_reminder_7d', channel: 'email', delay: 0 },
      { trigger: 'event_reminder_1d', channel: 'whatsapp', delay: 0 },
      { trigger: 'event_reminder_2h', channel: 'sms', delay: 0 },
    ],
  },
  {
    id: 'ticket_confirmation',
    name: 'Ticket Confirmation',
    description: 'Send confirmation via email and WhatsApp after purchase',
    icon: Ticket,
    triggers: ['ticket_purchase'],
    actions: [
      { trigger: 'ticket_purchase', channel: 'email', delay: 0 },
      { trigger: 'ticket_purchase', channel: 'whatsapp', delay: 0 },
    ],
  },
  {
    id: 'post_event_feedback',
    name: 'Post-Event Feedback',
    description: 'Thank attendees and request feedback after the event',
    icon: Heart,
    triggers: ['post_event'],
    actions: [
      { trigger: 'post_event', channel: 'email', delay: 24 * 60 }, // 24 hours after
    ],
  },
  {
    id: 'cart_recovery',
    name: 'Cart Recovery',
    description: 'Remind users to complete their purchase',
    icon: ShoppingCart,
    triggers: ['cart_abandoned'],
    actions: [
      { trigger: 'cart_abandoned', channel: 'whatsapp', delay: 30 },
      { trigger: 'cart_abandoned', channel: 'email', delay: 120 },
      { trigger: 'cart_abandoned', channel: 'sms', delay: 24 * 60 },
    ],
  },
];

export function CommunicationAutomations() {
  const navigate = useNavigate();
  const { organizer } = useOrganizer();

  // State
  const [loading, setLoading] = useState(true);
  const [automations, setAutomations] = useState([]);
  const [stats, setStats] = useState({
    totalAutomations: 0,
    activeAutomations: 0,
    totalTriggered: 0,
    totalCompleted: 0,
  });

  // Dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedAutomation, setSelectedAutomation] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  // Form state
  const [form, setForm] = useState({
    name: '',
    triggerType: '',
    eventId: '',
    isActive: true,
    actions: [],
  });

  // Events
  const [events, setEvents] = useState([]);
  const [saving, setSaving] = useState(false);

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  useEffect(() => {
    if (organizer?.id) {
      loadData();
    }
  }, [organizer?.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadAutomations(),
        loadEvents(),
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAutomations = async () => {
    const { data, error } = await supabase
      .from('communication_automations')
      .select('*')
      .eq('organizer_id', organizer.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading automations:', error);
      // Table might not exist yet, use empty array
      setAutomations([]);
      return;
    }

    setAutomations(data || []);

    // Calculate stats
    const active = (data || []).filter(a => a.status === 'active').length;
    const triggered = (data || []).reduce((sum, a) => sum + (a.total_triggered || 0), 0);
    const completed = (data || []).reduce((sum, a) => sum + (a.total_completed || 0), 0);

    setStats({
      totalAutomations: (data || []).length,
      activeAutomations: active,
      totalTriggered: triggered,
      totalCompleted: completed,
    });
  };

  const loadEvents = async () => {
    const { data } = await supabase
      .from('events')
      .select('id, title, start_date')
      .eq('organizer_id', organizer.id)
      .gte('start_date', new Date().toISOString())
      .order('start_date');

    setEvents(data || []);
  };

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const selectTemplate = (template) => {
    setSelectedTemplate(template);
    setForm({
      name: template.name,
      triggerType: template.triggers[0],
      eventId: '',
      isActive: true,
      actions: template.actions.map((a, i) => ({
        id: Date.now() + i,
        channel: a.channel,
        delayMinutes: a.delay,
        content: getDefaultContent(a.channel, template.triggers[0]),
      })),
    });
    setShowCreateDialog(true);
  };

  const getDefaultContent = (channel, trigger) => {
    const templates = {
      email: {
        ticket_purchase: {
          subject: 'Your Tickets for {{event_name}}',
          body: `<p>Hi {{attendee_name}},</p><p>Thank you for your purchase! Here are your tickets for <strong>{{event_name}}</strong>.</p><p>📅 {{event_date}}<br/>📍 {{event_venue}}</p><p>Show your QR code at entry. See you there!</p>`,
        },
        event_reminder_7d: {
          subject: '{{event_name}} is in 7 days!',
          body: `<p>Hi {{attendee_name}},</p><p>Just a reminder that <strong>{{event_name}}</strong> is coming up in 7 days!</p><p>📅 {{event_date}}<br/>📍 {{event_venue}}</p><p>See you there!</p>`,
        },
        event_reminder_1d: {
          subject: '{{event_name}} is tomorrow!',
          body: `<p>Hi {{attendee_name}},</p><p><strong>{{event_name}}</strong> is happening tomorrow!</p><p>📅 {{event_date}}<br/>📍 {{event_venue}}</p><p>Don't forget your ticket!</p>`,
        },
        post_event: {
          subject: 'Thank you for attending {{event_name}}!',
          body: `<p>Hi {{attendee_name}},</p><p>Thank you for attending <strong>{{event_name}}</strong>! We hope you had an amazing time.</p><p>We'd love to hear your feedback. Please take a moment to rate your experience.</p>`,
        },
        cart_abandoned: {
          subject: 'You left something behind...',
          body: `<p>Hi there,</p><p>You left tickets for <strong>{{event_name}}</strong> in your cart. Complete your purchase before they're gone!</p>`,
        },
      },
      sms: {
        ticket_purchase: { message: 'Thanks for purchasing tickets to {{event_name}}! Your tickets are ready. See you there!' },
        event_reminder_7d: { message: 'Reminder: {{event_name}} is in 7 days! {{event_date}} at {{event_venue}}' },
        event_reminder_1d: { message: 'Tomorrow! {{event_name}} at {{event_venue}}. Don\'t forget your ticket!' },
        event_reminder_2h: { message: '{{event_name}} starts in 2 hours! Head to {{event_venue}} now. Show your QR code at entry.' },
        cart_abandoned: { message: 'Your tickets to {{event_name}} are waiting! Complete your purchase now.' },
      },
      whatsapp: {
        ticket_purchase: { message: `🎉 *Your tickets are confirmed!*\n\n*{{event_name}}*\n📅 {{event_date}}\n📍 {{event_venue}}\n\nShow your QR code at entry. See you there!` },
        event_reminder_7d: { message: `📅 *Reminder: 7 days to go!*\n\n*{{event_name}}*\n{{event_date}}\n📍 {{event_venue}}\n\nGet ready!` },
        event_reminder_1d: { message: `⏰ *Tomorrow is the day!*\n\n*{{event_name}}*\n📍 {{event_venue}}\n\nDon't forget your ticket!` },
        event_reminder_2h: { message: `🚀 *Starting in 2 hours!*\n\n*{{event_name}}* is about to begin at {{event_venue}}.\n\nHead there now!` },
        cart_abandoned: { message: `Hey! 👋\n\nYou left tickets for *{{event_name}}* in your cart.\n\nComplete your purchase before they sell out!` },
      },
    };

    return templates[channel]?.[trigger] || (channel === 'email' ? { subject: '', body: '' } : { message: '' });
  };

  const addAction = () => {
    setForm(f => ({
      ...f,
      actions: [
        ...f.actions,
        {
          id: Date.now(),
          channel: 'email',
          delayMinutes: 0,
          content: getDefaultContent('email', f.triggerType),
        },
      ],
    }));
  };

  const updateAction = (actionId, field, value) => {
    setForm(f => ({
      ...f,
      actions: f.actions.map(a =>
        a.id === actionId
          ? { ...a, [field]: value, ...(field === 'channel' ? { content: getDefaultContent(value, f.triggerType) } : {}) }
          : a
      ),
    }));
  };

  const removeAction = (actionId) => {
    setForm(f => ({
      ...f,
      actions: f.actions.filter(a => a.id !== actionId),
    }));
  };

  const saveAutomation = async () => {
    if (!form.name || !form.triggerType || form.actions.length === 0) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSaving(true);
    try {
      const automationData = {
        organizer_id: organizer.id,
        name: form.name,
        trigger_type: form.triggerType,
        trigger_config: {
          eventId: form.eventId || null,
        },
        status: form.isActive ? 'active' : 'paused',
        actions: form.actions.map(a => ({
          channel: a.channel,
          delay_minutes: a.delayMinutes,
          content: a.content,
        })),
      };

      if (selectedAutomation) {
        // Update
        const { error } = await supabase
          .from('communication_automations')
          .update(automationData)
          .eq('id', selectedAutomation.id);

        if (error) throw error;
      } else {
        // Create
        const { error } = await supabase
          .from('communication_automations')
          .insert(automationData);

        if (error) throw error;
      }

      await loadAutomations();
      setShowCreateDialog(false);
      setShowEditDialog(false);
      resetForm();
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save automation: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleAutomation = async (automation) => {
    const newStatus = automation.status === 'active' ? 'paused' : 'active';

    try {
      const { error } = await supabase
        .from('communication_automations')
        .update({ status: newStatus })
        .eq('id', automation.id);

      if (error) throw error;
      await loadAutomations();
    } catch (error) {
      console.error('Toggle error:', error);
    }
  };

  const deleteAutomation = async (id) => {
    if (!confirm('Delete this automation?')) return;

    try {
      const { error } = await supabase
        .from('communication_automations')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await loadAutomations();
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  const editAutomation = (automation) => {
    setSelectedAutomation(automation);
    setForm({
      name: automation.name,
      triggerType: automation.trigger_type,
      eventId: automation.trigger_config?.eventId || '',
      isActive: automation.status === 'active',
      actions: (automation.actions || []).map((a, i) => ({
        id: i,
        channel: a.channel,
        delayMinutes: a.delay_minutes,
        content: a.content,
      })),
    });
    setShowEditDialog(true);
  };

  const resetForm = () => {
    setForm({
      name: '',
      triggerType: '',
      eventId: '',
      isActive: true,
      actions: [],
    });
    setSelectedAutomation(null);
    setSelectedTemplate(null);
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
          <h1 className="text-2xl font-bold text-foreground">Automations</h1>
          <p className="text-muted-foreground">Set up automated messages for your events</p>
        </div>
        <Button onClick={() => { resetForm(); setShowCreateDialog(true); }} className="bg-[#2969FF] text-white">
          <Plus className="w-4 h-4 mr-2" />
          New Automation
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border/10 rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Zap className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalAutomations}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/10 rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <Play className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{stats.activeAutomations}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/10 rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalTriggered}</p>
                <p className="text-xs text-muted-foreground">Triggered</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/10 rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalCompleted}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Templates */}
      {automations.length === 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Quick Start Templates</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {AUTOMATION_TEMPLATES.map((template) => (
              <Card
                key={template.id}
                className="border-border/10 rounded-xl hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => selectTemplate(template)}
              >
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-xl bg-[#2969FF]/10 flex items-center justify-center">
                      <template.icon className="w-6 h-6 text-[#2969FF]" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{template.name}</h3>
                      <p className="text-sm text-muted-foreground">{template.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {template.actions.slice(0, 3).map((action, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {action.channel}
                      </Badge>
                    ))}
                    {template.actions.length > 3 && (
                      <Badge variant="secondary" className="text-xs">
                        +{template.actions.length - 3}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Automations List */}
      {automations.length > 0 && (
        <Card className="border-border/10 rounded-xl">
          <CardHeader>
            <CardTitle>Your Automations</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-[#0F0F0F]/5">
              {automations.map((automation) => {
                const trigger = TRIGGER_TYPES.find(t => t.id === automation.trigger_type);
                return (
                  <div key={automation.id} className="flex items-center justify-between p-4 hover:bg-muted/50">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        automation.status === 'active' ? 'bg-green-100' : 'bg-muted'
                      }`}>
                        {trigger ? <trigger.icon className={`w-5 h-5 ${
                          automation.status === 'active' ? 'text-green-600' : 'text-muted-foreground'
                        }`} /> : <Zap className="w-5 h-5" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{automation.name}</h3>
                          <Badge variant="secondary" className={
                            automation.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'
                          }>
                            {automation.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {trigger?.name || automation.trigger_type}
                          {automation.actions?.length > 0 && ` • ${automation.actions.length} actions`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right mr-4">
                        <p className="text-sm font-medium">{automation.total_triggered || 0}</p>
                        <p className="text-xs text-muted-foreground">triggered</p>
                      </div>
                      <Switch
                        checked={automation.status === 'active'}
                        onCheckedChange={() => toggleAutomation(automation)}
                      />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => editAutomation(automation)}>
                            <Edit className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => deleteAutomation(automation.id)} className="text-red-600">
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showCreateDialog || showEditDialog} onOpenChange={(open) => {
        if (!open) {
          setShowCreateDialog(false);
          setShowEditDialog(false);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedAutomation ? 'Edit Automation' : 'Create Automation'}</DialogTitle>
            <DialogDescription>
              {selectedTemplate ? `Based on: ${selectedTemplate.name}` : 'Set up automated messages'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Name */}
            <div>
              <Label>Automation Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g., Event Reminder Sequence"
                className="mt-1"
              />
            </div>

            {/* Trigger */}
            <div>
              <Label>Trigger</Label>
              <Select value={form.triggerType || undefined} onValueChange={(v) => setForm(f => ({ ...f, triggerType: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="When should this run?" />
                </SelectTrigger>
                <SelectContent>
                  {TRIGGER_TYPES.map((trigger) => (
                    <SelectItem key={trigger.id} value={trigger.id}>
                      <div className="flex items-center gap-2">
                        <trigger.icon className="w-4 h-4" />
                        <span>{trigger.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Event Selection (for reminder triggers) */}
            {form.triggerType && form.triggerType.includes('event') && (
              <div>
                <Label>Apply to Event (optional)</Label>
                <Select value={form.eventId || 'all'} onValueChange={(v) => setForm(f => ({ ...f, eventId: v === 'all' ? '' : v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="All upcoming events" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All upcoming events</SelectItem>
                    {events.map((event) => (
                      <SelectItem key={event.id} value={event.id}>
                        {event.title} ({format(new Date(event.start_date), 'MMM d')})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Actions */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label>Actions</Label>
                <Button variant="outline" size="sm" onClick={addAction}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add Action
                </Button>
              </div>

              <div className="space-y-4">
                {form.actions.map((action, index) => (
                  <Card key={action.id} className="border-border/10 rounded-xl">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{index + 1}</Badge>
                          <span className="text-sm font-medium">Action</span>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => removeAction(action.id)}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <Label className="text-xs">Channel</Label>
                          <Select
                            value={action.channel}
                            onValueChange={(v) => updateAction(action.id, 'channel', v)}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="email">
                                <div className="flex items-center gap-2">
                                  <Mail className="w-4 h-4" /> Email
                                </div>
                              </SelectItem>
                              <SelectItem value="sms">
                                <div className="flex items-center gap-2">
                                  <Phone className="w-4 h-4" /> SMS
                                </div>
                              </SelectItem>
                              <SelectItem value="whatsapp">
                                <div className="flex items-center gap-2">
                                  <MessageSquare className="w-4 h-4" /> WhatsApp
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label className="text-xs">Delay (minutes)</Label>
                          <Input
                            type="number"
                            value={action.delayMinutes}
                            onChange={(e) => updateAction(action.id, 'delayMinutes', e.target.value === '' ? '' : parseInt(e.target.value))}
                            className="mt-1"
                            min={0}
                          />
                        </div>
                      </div>

                      {action.channel === 'email' && (
                        <div className="space-y-2">
                          <div>
                            <Label className="text-xs">Subject</Label>
                            <Input
                              value={action.content?.subject || ''}
                              onChange={(e) => updateAction(action.id, 'content', { ...action.content, subject: e.target.value })}
                              className="mt-1"
                              placeholder="Email subject..."
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Body</Label>
                            <Textarea
                              value={action.content?.body?.replace(/<[^>]*>/g, '') || ''}
                              onChange={(e) => updateAction(action.id, 'content', { ...action.content, body: e.target.value })}
                              className="mt-1 min-h-[80px]"
                              placeholder="Email body..."
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                              Variables: {'{{attendee_name}}'}, {'{{event_name}}'}, {'{{event_date}}'}, {'{{event_venue}}'}, {'{{organizer_name}}'}
                            </p>
                          </div>
                        </div>
                      )}

                      {(action.channel === 'sms' || action.channel === 'whatsapp') && (
                        <div>
                          <Label className="text-xs">Message</Label>
                          <Textarea
                            value={action.content?.message || ''}
                            onChange={(e) => updateAction(action.id, 'content', { ...action.content, message: e.target.value })}
                            className="mt-1 min-h-[80px]"
                            placeholder="Message content..."
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Variables: {'{{attendee_name}}'}, {'{{event_name}}'}, {'{{event_date}}'}, {'{{event_venue}}'}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}

                {form.actions.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Zap className="w-8 h-8 mx-auto mb-2" />
                    <p>No actions yet. Add an action to get started.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Active Toggle */}
            <div className="flex items-center justify-between p-4 bg-muted rounded-xl">
              <div>
                <p className="font-medium">Active</p>
                <p className="text-sm text-muted-foreground">Enable this automation immediately</p>
              </div>
              <Switch
                checked={form.isActive}
                onCheckedChange={(checked) => setForm(f => ({ ...f, isActive: checked }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowCreateDialog(false);
              setShowEditDialog(false);
              resetForm();
            }}>
              Cancel
            </Button>
            <Button
              onClick={saveAutomation}
              disabled={saving || !form.name || !form.triggerType || form.actions.length === 0}
              className="bg-[#2969FF] text-white"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              {selectedAutomation ? 'Save Changes' : 'Create Automation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default CommunicationAutomations;
