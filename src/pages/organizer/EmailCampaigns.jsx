import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Mail,
  Plus,
  Search,
  Send,
  Clock,
  CheckCircle,
  Eye,
  Edit2,
  Trash2,
  Users,
  Calendar,
  BarChart3,
  Loader2,
  RefreshCw,
  Copy,
  MoreVertical,
  AlertCircle,
  FileText,
  XCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { useOrganizer } from '../../contexts/OrganizerContext';
import { supabase } from '@/lib/supabase';

// Email templates
const emailTemplates = [
  {
    id: 'reminder',
    name: 'Event Reminder',
    subject: 'Reminder: {{event_name}} is coming up!',
    body: `Hi {{attendee_name}},

This is a friendly reminder that {{event_name}} is happening on {{event_date}} at {{event_venue}}.

Don't forget to bring your ticket (attached to your confirmation email) or show your QR code at the entrance.

We can't wait to see you there!

Best regards,
{{organizer_name}}`
  },
  {
    id: 'thankyou',
    name: 'Thank You',
    subject: 'Thank you for attending {{event_name}}!',
    body: `Hi {{attendee_name}},

Thank you for attending {{event_name}}! We hope you had an amazing time.

We'd love to hear your feedback. Your opinion helps us improve future events.

Stay tuned for more exciting events coming soon!

Best regards,
{{organizer_name}}`
  },
  {
    id: 'announcement',
    name: 'New Event Announcement',
    subject: 'You\'re Invited: {{event_name}}',
    body: `Hi {{attendee_name}},

We're excited to announce our upcoming event: {{event_name}}!

📅 Date: {{event_date}}
📍 Venue: {{event_venue}}

Early bird tickets are available now. Don't miss out!

Get your tickets: {{event_link}}

Best regards,
{{organizer_name}}`
  },
  {
    id: 'custom',
    name: 'Custom Message',
    subject: '',
    body: ''
  }
];

export function EmailCampaigns() {
  const navigate = useNavigate();
  const location = useLocation();
  const { organizer } = useOrganizer();
  
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState([]);
  const [events, setEvents] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState(null);
  const [previewCampaign, setPreviewCampaign] = useState(null);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  
  // Pre-selected attendees from ManageAttendees page
  const preSelectedAttendeeIds = location.state?.attendeeIds || [];
  
  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    body: '',
    recipientType: preSelectedAttendeeIds.length > 0 ? 'selected' : 'followers',
    eventId: '',
    selectedTemplate: 'custom',
    scheduledFor: '',
  });

  const [recipientCount, setRecipientCount] = useState(0);

  useEffect(() => {
    if (organizer?.id) {
      loadData();
    }
  }, [organizer?.id]);

  useEffect(() => {
    if (organizer?.id && formData.recipientType) {
      calculateRecipients();
    }
  }, [formData.recipientType, formData.eventId, organizer?.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadCampaigns(), loadEvents()]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCampaigns = async () => {
    const { data, error } = await supabase
      .from('email_campaigns')
      .select(`
        *,
        events (
          id,
          title
        )
      `)
      .eq('organizer_id', organizer.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading campaigns:', error);
      return;
    }

    setCampaigns(data || []);
  };

  const loadEvents = async () => {
    const { data, error } = await supabase
      .from('events')
      .select('id, title, start_date')
      .eq('organizer_id', organizer.id)
      .order('start_date', { ascending: false });

    if (error) {
      console.error('Error loading events:', error);
      return;
    }

    setEvents(data || []);
  };

  const calculateRecipients = async () => {
    let count = 0;

    if (formData.recipientType === 'selected' && preSelectedAttendeeIds.length > 0) {
      count = preSelectedAttendeeIds.length;
    } else if (formData.recipientType === 'followers') {
      const { count: followerCount } = await supabase
        .from('followers')
        .select('id', { count: 'exact', head: true })
        .eq('organizer_id', organizer.id);
      count = followerCount || 0;
    } else if (formData.recipientType === 'event_attendees' && formData.eventId) {
      const { count: attendeeCount } = await supabase
        .from('tickets')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', formData.eventId)
        .eq('payment_status', 'completed');
      count = attendeeCount || 0;
    } else if (formData.recipientType === 'all_attendees') {
      // Get all events for this organizer
      const { data: orgEvents } = await supabase
        .from('events')
        .select('id')
        .eq('organizer_id', organizer.id);

      if (orgEvents?.length > 0) {
        const eventIds = orgEvents.map(e => e.id);
        const { count: attendeeCount } = await supabase
          .from('tickets')
          .select('id', { count: 'exact', head: true })
          .in('event_id', eventIds)
          .eq('payment_status', 'completed');
        count = attendeeCount || 0;
      }
    }

    setRecipientCount(count);
  };

  const applyTemplate = (templateId) => {
    const template = emailTemplates.find(t => t.id === templateId);
    if (template) {
      setFormData({
        ...formData,
        selectedTemplate: templateId,
        subject: template.subject,
        body: template.body,
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      subject: '',
      body: '',
      recipientType: 'followers',
      eventId: '',
      selectedTemplate: 'custom',
      scheduledFor: '',
    });
    setEditingCampaign(null);
    setError('');
  };

  const openEditDialog = (campaign) => {
    setEditingCampaign(campaign);
    setFormData({
      name: campaign.name,
      subject: campaign.subject,
      body: campaign.body,
      recipientType: campaign.recipient_type,
      eventId: campaign.event_id || '',
      selectedTemplate: 'custom',
      scheduledFor: campaign.scheduled_for?.slice(0, 16) || '',
    });
    setIsCreateDialogOpen(true);
  };

  const saveCampaign = async (sendNow = false) => {
    if (!formData.name.trim()) {
      setError('Campaign name is required');
      return;
    }
    if (!formData.subject.trim()) {
      setError('Email subject is required');
      return;
    }
    if (!formData.body.trim()) {
      setError('Email body is required');
      return;
    }
    if (recipientCount === 0) {
      setError('No recipients found for this campaign');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const campaignData = {
        organizer_id: organizer.id,
        name: formData.name.trim(),
        subject: formData.subject.trim(),
        body: formData.body.trim(),
        recipient_type: formData.recipientType,
        event_id: formData.eventId || null,
        status: sendNow ? 'sending' : (formData.scheduledFor ? 'scheduled' : 'draft'),
        scheduled_for: formData.scheduledFor || null,
        total_recipients: recipientCount,
      };

      let campaignId;

      if (editingCampaign) {
        const { error: updateError } = await supabase
          .from('email_campaigns')
          .update(campaignData)
          .eq('id', editingCampaign.id);

        if (updateError) throw updateError;
        campaignId = editingCampaign.id;
      } else {
        const { data: newCampaign, error: insertError } = await supabase
          .from('email_campaigns')
          .insert(campaignData)
          .select()
          .single();

        if (insertError) throw insertError;
        campaignId = newCampaign.id;
      }

      if (sendNow) {
        // Send emails via Resend Edge Function
        await sendCampaignEmails(campaignId);
      }

      await loadCampaigns();
      setIsCreateDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error saving campaign:', error);
      setError('Failed to save campaign. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const sendCampaignEmails = async (campaignId) => {
    // Fetch recipients based on recipient_type
    let recipients = [];
    
    if (formData.recipientType === 'selected' && preSelectedAttendeeIds.length > 0) {
      // Get selected attendees
      const { data: attendees } = await supabase
        .from('tickets')
        .select('attendee_email, attendee_name, ticket_types(name)')
        .in('id', preSelectedAttendeeIds);
      recipients = attendees?.map(a => ({
        email: a.attendee_email,
        name: a.attendee_name,
        ticket_type: a.ticket_types?.name
      })) || [];
    } else if (formData.recipientType === 'followers') {
      const { data: followers } = await supabase
        .from('followers')
        .select('profiles(email, first_name, last_name)')
        .eq('organizer_id', organizer.id);
      recipients = followers?.map(f => ({
        email: f.profiles?.email,
        name: `${f.profiles?.first_name || ''} ${f.profiles?.last_name || ''}`.trim() || 'there'
      })).filter(r => r.email) || [];
    } else if (formData.recipientType === 'event_attendees' && formData.eventId) {
      const { data: attendees } = await supabase
        .from('tickets')
        .select('attendee_email, attendee_name, ticket_types(name)')
        .eq('event_id', formData.eventId)
        .eq('payment_status', 'completed');
      recipients = attendees?.map(a => ({
        email: a.attendee_email,
        name: a.attendee_name,
        ticket_type: a.ticket_types?.name
      })) || [];
    } else if (formData.recipientType === 'all_attendees') {
      const { data: orgEvents } = await supabase
        .from('events')
        .select('id')
        .eq('organizer_id', organizer.id);
      
      if (orgEvents?.length > 0) {
        const eventIds = orgEvents.map(e => e.id);
        const { data: attendees } = await supabase
          .from('tickets')
          .select('attendee_email, attendee_name, ticket_types(name)')
          .in('event_id', eventIds)
          .eq('payment_status', 'completed');
        recipients = attendees?.map(a => ({
          email: a.attendee_email,
          name: a.attendee_name,
          ticket_type: a.ticket_types?.name
        })) || [];
      }
    }

    // Remove duplicates by email
    const uniqueRecipients = Array.from(
      new Map(recipients.map(r => [r.email, r])).values()
    );

    if (uniqueRecipients.length === 0) {
      throw new Error('No valid recipients found');
    }

    // Get event data for variable replacement
    let eventData = {};
    if (formData.eventId) {
      const { data: event } = await supabase
        .from('events')
        .select('title, start_date, venue_name, city')
        .eq('id', formData.eventId)
        .single();
      
      if (event) {
        eventData = {
          event_name: event.title,
          event_date: new Date(event.start_date).toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
          }),
          event_venue: event.venue_name || event.city || 'TBA',
          event_link: `${window.location.origin}/e/${formData.eventId}`
        };
      }
    }

    // Add organizer name to variables
    eventData.organizer_name = organizer.business_name || 'The Organizer';

    // Call the send-bulk-email Edge Function
    const { data, error } = await supabase.functions.invoke('send-bulk-email', {
      body: {
        campaignId,
        recipients: uniqueRecipients,
        subject: formData.subject,
        body: formData.body,
        variables: eventData,
        organizerId: organizer.id
      }
    });

    if (error) throw error;

    // Show success message
    const sent = data?.sent || 0;
    const failed = data?.failed || 0;
    
    if (failed > 0) {
      alert(`Campaign sent!\n\n✅ Delivered: ${sent}\n❌ Failed: ${failed}`);
    } else {
      alert(`✅ Campaign sent successfully to ${sent} recipients!`);
    }

    return data;
  };

  const sendCampaign = async (campaignId) => {
    if (!confirm('Are you sure you want to send this campaign now?')) return;

    setSending(true);
    try {
      // Fetch campaign data first
      const { data: campaign } = await supabase
        .from('email_campaigns')
        .select('*')
        .eq('id', campaignId)
        .single();
      
      if (!campaign) throw new Error('Campaign not found');

      // Set form data from campaign for sending
      setFormData({
        name: campaign.name,
        subject: campaign.subject,
        body: campaign.body,
        recipientType: campaign.recipient_type,
        eventId: campaign.event_id || '',
        selectedTemplate: 'custom',
        scheduledFor: '',
      });

      // Update status to sending
      await supabase
        .from('email_campaigns')
        .update({ status: 'sending' })
        .eq('id', campaignId);

      // Send emails via Resend
      await sendCampaignEmails(campaignId);
      await loadCampaigns();
    } catch (error) {
      console.error('Error sending campaign:', error);
      alert('Failed to send campaign: ' + error.message);
      
      // Revert status on failure
      await supabase
        .from('email_campaigns')
        .update({ status: 'draft' })
        .eq('id', campaignId);
    } finally {
      setSending(false);
    }
  };

  const deleteCampaign = async (campaignId) => {
    if (!confirm('Are you sure you want to delete this campaign?')) return;

    try {
      const { error } = await supabase
        .from('email_campaigns')
        .delete()
        .eq('id', campaignId);

      if (error) throw error;
      await loadCampaigns();
    } catch (error) {
      console.error('Error deleting campaign:', error);
      alert('Failed to delete campaign');
    }
  };

  const duplicateCampaign = async (campaign) => {
    try {
      const { error } = await supabase
        .from('email_campaigns')
        .insert({
          organizer_id: organizer.id,
          name: `${campaign.name} (Copy)`,
          subject: campaign.subject,
          body: campaign.body,
          recipient_type: campaign.recipient_type,
          event_id: campaign.event_id,
          status: 'draft',
          total_recipients: 0,
        });

      if (error) throw error;
      await loadCampaigns();
    } catch (error) {
      console.error('Error duplicating campaign:', error);
      alert('Failed to duplicate campaign');
    }
  };

  const filteredCampaigns = campaigns.filter((c) => {
    const matchesSearch = 
      c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.subject?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Calculate stats
  const stats = {
    total: campaigns.length,
    sent: campaigns.filter(c => c.status === 'sent').length,
    totalSent: campaigns.reduce((sum, c) => sum + (c.total_sent || 0), 0),
    totalOpened: campaigns.reduce((sum, c) => sum + (c.total_opened || 0), 0),
    totalClicked: campaigns.reduce((sum, c) => sum + (c.total_clicked || 0), 0),
  };

  const avgOpenRate = stats.totalSent > 0 ? (stats.totalOpened / stats.totalSent) * 100 : 0;
  const avgClickRate = stats.totalSent > 0 ? (stats.totalClicked / stats.totalSent) * 100 : 0;

  const getStatusBadge = (status) => {
    switch (status) {
      case 'sent':
        return <Badge className="bg-green-100 text-green-700"><CheckCircle className="w-3 h-3 mr-1" />Sent</Badge>;
      case 'sending':
        return <Badge className="bg-blue-100 text-blue-700"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Sending</Badge>;
      case 'scheduled':
        return <Badge className="bg-purple-100 text-purple-700"><Clock className="w-3 h-3 mr-1" />Scheduled</Badge>;
      case 'draft':
        return <Badge className="bg-gray-100 text-gray-700"><FileText className="w-3 h-3 mr-1" />Draft</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-700"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      default:
        return null;
    }
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleString('en-NG', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-[#0F0F0F]">Email Campaigns</h2>
          <p className="text-[#0F0F0F]/60 mt-1">Create and manage email campaigns for your audience</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={loadData}
            className="rounded-xl border-[#0F0F0F]/10"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button
            onClick={() => {
              resetForm();
              setIsCreateDialogOpen(true);
            }}
            className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Campaign
          </Button>
        </div>
      </div>

      {/* Pre-selected attendees notice */}
      {preSelectedAttendeeIds.length > 0 && (
        <Card className="border-[#2969FF]/20 bg-[#2969FF]/5 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-[#2969FF]" />
              <p className="text-[#0F0F0F]">
                <span className="font-medium">{preSelectedAttendeeIds.length} attendees</span> selected from Manage Attendees page
              </p>
              <Button
                size="sm"
                onClick={() => {
                  resetForm();
                  setFormData(prev => ({ ...prev, recipientType: 'selected' }));
                  setIsCreateDialogOpen(true);
                }}
                className="ml-auto bg-[#2969FF] text-white rounded-xl"
              >
                Create Email for Selected
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#0F0F0F]/60 mb-1">Total Campaigns</p>
                <p className="text-2xl font-semibold text-[#0F0F0F]">{stats.total}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#2969FF]/10 flex items-center justify-center">
                <Mail className="w-5 h-5 text-[#2969FF]" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#0F0F0F]/60 mb-1">Emails Sent</p>
                <p className="text-2xl font-semibold text-[#0F0F0F]">{stats.totalSent.toLocaleString()}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                <Send className="w-5 h-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#0F0F0F]/60 mb-1">Avg. Open Rate</p>
                <p className="text-2xl font-semibold text-[#0F0F0F]">{avgOpenRate.toFixed(1)}%</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                <Eye className="w-5 h-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#0F0F0F]/60 mb-1">Avg. Click Rate</p>
                <p className="text-2xl font-semibold text-[#0F0F0F]">{avgClickRate.toFixed(1)}%</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filter */}
      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#0F0F0F]/40" />
              <Input
                placeholder="Search campaigns..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-12 bg-[#F4F6FA] border-0 rounded-xl"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="md:w-40 h-12 rounded-xl border-[#0F0F0F]/10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Campaigns List */}
      {filteredCampaigns.length === 0 ? (
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-12 text-center">
            <Mail className="w-12 h-12 text-[#0F0F0F]/20 mx-auto mb-4" />
            <p className="text-[#0F0F0F]/60 mb-4">
              {campaigns.length === 0 ? 'No campaigns yet' : 'No campaigns match your filters'}
            </p>
            {campaigns.length === 0 && (
              <Button 
                onClick={() => {
                  resetForm();
                  setIsCreateDialogOpen(true);
                }} 
                className="bg-[#2969FF] text-white rounded-xl"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Campaign
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredCampaigns.map((campaign) => (
            <Card key={campaign.id} className="border-[#0F0F0F]/10 rounded-2xl hover:shadow-md transition-shadow">
              <CardContent className="p-4 md:p-6">
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <h3 className="font-medium text-[#0F0F0F] truncate">{campaign.name}</h3>
                      {getStatusBadge(campaign.status)}
                      {campaign.events && (
                        <Badge variant="outline" className="text-xs">
                          {campaign.events.title}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-[#0F0F0F]/60 mb-2 truncate">{campaign.subject}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-[#0F0F0F]/60">
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {campaign.total_recipients > 0 ? `${campaign.total_recipients} recipients` : 'No recipients'}
                      </span>
                      {campaign.status === 'sent' && (
                        <>
                          <span className="flex items-center gap-1">
                            <Eye className="w-4 h-4" />
                            {campaign.total_recipients > 0 
                              ? `${Math.round((campaign.total_opened / campaign.total_recipients) * 100)}% opened`
                              : '0% opened'}
                          </span>
                          <span className="flex items-center gap-1">
                            <BarChart3 className="w-4 h-4" />
                            {campaign.total_recipients > 0 
                              ? `${Math.round((campaign.total_clicked / campaign.total_recipients) * 100)}% clicked`
                              : '0% clicked'}
                          </span>
                        </>
                      )}
                      {campaign.status === 'scheduled' && campaign.scheduled_for && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {formatDateTime(campaign.scheduled_for)}
                        </span>
                      )}
                      {campaign.status === 'sent' && campaign.sent_at && (
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircle className="w-4 h-4" />
                          Sent {formatDateTime(campaign.sent_at)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setPreviewCampaign(campaign);
                        setIsPreviewOpen(true);
                      }}
                      className="rounded-xl border-[#0F0F0F]/10"
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      Preview
                    </Button>
                    {campaign.status === 'draft' && (
                      <Button 
                        size="sm" 
                        onClick={() => sendCampaign(campaign.id)}
                        disabled={sending}
                        className="bg-[#2969FF] text-white rounded-xl"
                      >
                        <Send className="w-4 h-4 mr-1" />
                        Send
                      </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="rounded-xl">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-xl">
                        {campaign.status === 'draft' && (
                          <DropdownMenuItem onClick={() => openEditDialog(campaign)}>
                            <Edit2 className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => duplicateCampaign(campaign)}>
                          <Copy className="w-4 h-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => deleteCampaign(campaign.id)}
                          className="text-red-600"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Campaign Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
        if (!open) resetForm();
        setIsCreateDialogOpen(open);
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editingCampaign ? 'Edit Campaign' : 'Create Email Campaign'}</DialogTitle>
            <DialogDescription>
              Compose and send emails to your followers and attendees
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 text-sm">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Campaign Name *</Label>
                <Input
                  placeholder="e.g., Event Reminder"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="rounded-xl h-12"
                />
              </div>
              <div className="space-y-2">
                <Label>Email Template</Label>
                <Select
                  value={formData.selectedTemplate}
                  onValueChange={applyTemplate}
                >
                  <SelectTrigger className="rounded-xl h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {emailTemplates.map(template => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Recipients *</Label>
                <Select
                  value={formData.recipientType}
                  onValueChange={(value) => setFormData({ ...formData, recipientType: value, eventId: '' })}
                >
                  <SelectTrigger className="rounded-xl h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {preSelectedAttendeeIds.length > 0 && (
                      <SelectItem value="selected">Selected Attendees ({preSelectedAttendeeIds.length})</SelectItem>
                    )}
                    <SelectItem value="followers">All Followers</SelectItem>
                    <SelectItem value="all_attendees">All Past Attendees</SelectItem>
                    <SelectItem value="event_attendees">Specific Event Attendees</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.recipientType === 'event_attendees' && (
                <div className="space-y-2">
                  <Label>Select Event</Label>
                  <Select
                    value={formData.eventId}
                    onValueChange={(value) => setFormData({ ...formData, eventId: value })}
                  >
                    <SelectTrigger className="rounded-xl h-12">
                      <SelectValue placeholder="Choose an event" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {events.map((event) => (
                        <SelectItem key={event.id} value={event.id}>
                          {event.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {recipientCount > 0 && (
              <div className="p-3 bg-[#2969FF]/5 rounded-xl flex items-center gap-2">
                <Users className="w-4 h-4 text-[#2969FF]" />
                <span className="text-sm text-[#0F0F0F]">
                  This campaign will be sent to <strong>{recipientCount}</strong> recipients
                </span>
              </div>
            )}

            <div className="space-y-2">
              <Label>Email Subject *</Label>
              <Input
                placeholder="Enter email subject line"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                className="rounded-xl h-12"
              />
              <p className="text-xs text-[#0F0F0F]/40">
                Variables: {'{{attendee_name}}'}, {'{{event_name}}'}, {'{{event_date}}'}, {'{{event_venue}}'}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Message *</Label>
              <Textarea
                placeholder="Write your email message here..."
                value={formData.body}
                onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                className="rounded-xl min-h-[200px]"
              />
            </div>

            <div className="space-y-2">
              <Label>Schedule (Optional)</Label>
              <Input
                type="datetime-local"
                value={formData.scheduledFor}
                onChange={(e) => setFormData({ ...formData, scheduledFor: e.target.value })}
                className="rounded-xl h-12"
              />
              <p className="text-xs text-[#0F0F0F]/40">
                Leave empty to save as draft or send immediately
              </p>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setIsCreateDialogOpen(false);
                  resetForm();
                }}
                className="rounded-xl h-12"
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                onClick={() => saveCampaign(false)}
                disabled={saving}
                className="flex-1 rounded-xl h-12"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save as Draft'}
              </Button>
              <Button
                onClick={() => saveCampaign(true)}
                disabled={saving || recipientCount === 0}
                className="flex-1 bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl h-12"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Send Now
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle>Email Preview</DialogTitle>
          </DialogHeader>
          {previewCampaign && (
            <div className="space-y-4">
              <div className="p-4 bg-[#F4F6FA] rounded-xl">
                <p className="text-sm text-[#0F0F0F]/60 mb-1">Subject:</p>
                <p className="font-medium text-[#0F0F0F]">{previewCampaign.subject}</p>
              </div>
              <div className="p-4 bg-white border border-[#0F0F0F]/10 rounded-xl">
                <pre className="whitespace-pre-wrap font-sans text-[#0F0F0F]">
                  {previewCampaign.body}
                </pre>
              </div>
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => setIsPreviewOpen(false)}
                  className="rounded-xl"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
