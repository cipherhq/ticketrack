import { useState, useEffect } from 'react';
import {
  MessageCircle,
  Plus,
  Search,
  Send,
  Users,
  Calendar,
  Loader2,
  RefreshCw,
  Copy,
  ExternalLink,
  Download,
  Phone,
  CheckCircle,
  Info,
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
import { useOrganizer } from '../../contexts/OrganizerContext';
import { supabase } from '@/lib/supabase';

// Message templates
const messageTemplates = [
  {
    id: 'reminder',
    name: 'Event Reminder',
    message: `Hi! 👋

This is a friendly reminder that *{{event_name}}* is happening on *{{event_date}}* at *{{event_venue}}*.

Don't forget to bring your ticket or show your QR code at the entrance.

See you there! 🎉`
  },
  {
    id: 'thankyou',
    name: 'Thank You',
    message: `Hi! 🙏

Thank you for attending *{{event_name}}*! We hope you had an amazing time.

We'd love to hear your feedback. Stay tuned for more exciting events!

Best regards,
{{organizer_name}}`
  },
  {
    id: 'announcement',
    name: 'New Event',
    message: `🎉 *New Event Alert!* 🎉

You're invited to *{{event_name}}*!

📅 Date: {{event_date}}
📍 Venue: {{event_venue}}

Get your tickets now before they sell out!

{{event_link}}`
  },
  {
    id: 'custom',
    name: 'Custom Message',
    message: ''
  }
];

export function WhatsAppBroadcast() {
  const { organizer } = useOrganizer();
  const [loading, setLoading] = useState(true);
  const [broadcasts, setBroadcasts] = useState([]);
  const [events, setEvents] = useState([]);
  const [recipients, setRecipients] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isRecipientsDialogOpen, setIsRecipientsDialogOpen] = useState(false);
  const [selectedBroadcast, setSelectedBroadcast] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    message: '',
    recipientType: 'event_attendees',
    eventId: '',
    selectedTemplate: 'custom',
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
      await Promise.all([loadBroadcasts(), loadEvents()]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadBroadcasts = async () => {
    const { data, error } = await supabase
      .from('whatsapp_broadcasts')
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
      console.error('Error loading broadcasts:', error);
      return;
    }

    setBroadcasts(data || []);
  };

  const loadEvents = async () => {
    const { data, error } = await supabase
      .from('events')
      .select('id, title, start_date, venue_name')
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

    if (formData.recipientType === 'followers') {
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
        .eq('payment_status', 'completed')
        .not('attendee_phone', 'is', null);
      count = attendeeCount || 0;
    }

    setRecipientCount(count);
  };

  const loadRecipientsList = async (broadcast) => {
    let recipientsList = [];

    if (broadcast.event_id) {
      const { data } = await supabase
        .from('tickets')
        .select('attendee_name, attendee_phone')
        .eq('event_id', broadcast.event_id)
        .eq('payment_status', 'completed')
        .not('attendee_phone', 'is', null);
      
      recipientsList = data?.map(r => ({
        name: r.attendee_name,
        phone: r.attendee_phone,
      })) || [];
    } else {
      // Get followers with phone numbers
      const { data } = await supabase
        .from('followers')
        .select(`
          profiles:user_id (
            full_name,
            phone
          )
        `)
        .eq('organizer_id', organizer.id);

      recipientsList = data?.filter(f => f.profiles?.phone).map(f => ({
        name: f.profiles.full_name,
        phone: f.profiles.phone,
      })) || [];
    }

    setRecipients(recipientsList);
    setSelectedBroadcast(broadcast);
    setIsRecipientsDialogOpen(true);
  };

  const applyTemplate = (templateId) => {
    const template = messageTemplates.find(t => t.id === templateId);
    if (template) {
      setFormData({
        ...formData,
        selectedTemplate: templateId,
        message: template.message,
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      message: '',
      recipientType: 'event_attendees',
      eventId: '',
      selectedTemplate: 'custom',
    });
    setError('');
  };

  const saveBroadcast = async () => {
    if (!formData.name.trim()) {
      setError('Broadcast name is required');
      return;
    }
    if (!formData.message.trim()) {
      setError('Message is required');
      return;
    }
    if (recipientCount === 0) {
      setError('No recipients with phone numbers found');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const { error: insertError } = await supabase
        .from('whatsapp_broadcasts')
        .insert({
          organizer_id: organizer.id,
          name: formData.name.trim(),
          message: formData.message.trim(),
          recipient_type: formData.recipientType,
          event_id: formData.eventId || null,
          total_recipients: recipientCount,
        });

      if (insertError) throw insertError;

      await loadBroadcasts();
      setIsCreateDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error saving broadcast:', error);
      setError('Failed to save broadcast. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const generateWhatsAppLink = (phone, message) => {
    // Clean phone number
    let cleanPhone = phone.replace(/\D/g, '');
    
    // Add country code if not present (assuming Nigeria)
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '234' + cleanPhone.substring(1);
    } else if (!cleanPhone.startsWith('234')) {
      cleanPhone = '234' + cleanPhone;
    }

    // Encode message
    const encodedMessage = encodeURIComponent(message);
    
    return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
  };

  const openWhatsAppWeb = (phone, message) => {
    const link = generateWhatsAppLink(phone, message);
    window.open(link, '_blank');
  };

  const exportRecipients = () => {
    if (!selectedBroadcast || recipients.length === 0) return;

    const csvContent = [
      ['Name', 'Phone', 'WhatsApp Link'],
      ...recipients.map(r => [
        r.name,
        r.phone,
        generateWhatsAppLink(r.phone, selectedBroadcast.message)
      ])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `whatsapp-broadcast-${selectedBroadcast.name.replace(/\s+/g, '-')}.csv`;
    link.click();
  };

  const copyMessage = (message) => {
    navigator.clipboard.writeText(message);
  };

  const filteredBroadcasts = broadcasts.filter((b) =>
    b.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-NG', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
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
          <h2 className="text-2xl font-semibold text-[#0F0F0F]">WhatsApp Broadcast</h2>
          <p className="text-[#0F0F0F]/60 mt-1">Send messages to your attendees via WhatsApp</p>
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
            className="bg-[#25D366] hover:bg-[#25D366]/90 text-white rounded-xl"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Broadcast
          </Button>
        </div>
      </div>

      {/* Info Card */}
      <Card className="border-[#25D366]/20 bg-[#25D366]/5 rounded-2xl">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-[#25D366] mt-0.5" />
            <div>
              <p className="font-medium text-[#0F0F0F]">How WhatsApp Broadcast Works</p>
              <p className="text-sm text-[#0F0F0F]/60 mt-1">
                Create a broadcast message, then click on each recipient to open WhatsApp Web and send the message. 
                You can also export the list with pre-generated WhatsApp links to send from your phone.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#0F0F0F]/60 mb-1">Total Broadcasts</p>
                <p className="text-2xl font-semibold text-[#0F0F0F]">{broadcasts.length}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#25D366]/10 flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-[#25D366]" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#0F0F0F]/60 mb-1">Total Recipients</p>
                <p className="text-2xl font-semibold text-[#0F0F0F]">
                  {broadcasts.reduce((sum, b) => sum + (b.total_recipients || 0), 0)}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#2969FF]/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-[#2969FF]" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#0F0F0F]/60 mb-1">Events</p>
                <p className="text-2xl font-semibold text-[#0F0F0F]">{events.length}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#0F0F0F]/40" />
            <Input
              placeholder="Search broadcasts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12 bg-[#F4F6FA] border-0 rounded-xl"
            />
          </div>
        </CardContent>
      </Card>

      {/* Broadcasts List */}
      {filteredBroadcasts.length === 0 ? (
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-12 text-center">
            <MessageCircle className="w-12 h-12 text-[#0F0F0F]/20 mx-auto mb-4" />
            <p className="text-[#0F0F0F]/60 mb-4">
              {broadcasts.length === 0 ? 'No broadcasts yet' : 'No broadcasts match your search'}
            </p>
            {broadcasts.length === 0 && (
              <Button 
                onClick={() => {
                  resetForm();
                  setIsCreateDialogOpen(true);
                }} 
                className="bg-[#25D366] text-white rounded-xl"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Broadcast
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredBroadcasts.map((broadcast) => (
            <Card key={broadcast.id} className="border-[#0F0F0F]/10 rounded-2xl hover:shadow-md transition-shadow">
              <CardContent className="p-4 md:p-6">
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-medium text-[#0F0F0F]">{broadcast.name}</h3>
                      {broadcast.events && (
                        <Badge variant="outline" className="text-xs">
                          {broadcast.events.title}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-[#0F0F0F]/60 mb-2 line-clamp-2">{broadcast.message}</p>
                    <div className="flex items-center gap-4 text-sm text-[#0F0F0F]/60">
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {broadcast.total_recipients} recipients
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {formatDate(broadcast.created_at)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button 
                      variant="outline"
                      size="sm"
                      onClick={() => copyMessage(broadcast.message)}
                      className="rounded-xl border-[#0F0F0F]/10"
                    >
                      <Copy className="w-4 h-4 mr-1" />
                      Copy
                    </Button>
                    <Button 
                      size="sm"
                      onClick={() => loadRecipientsList(broadcast)}
                      className="bg-[#25D366] hover:bg-[#25D366]/90 text-white rounded-xl"
                    >
                      <Send className="w-4 h-4 mr-1" />
                      Send
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Broadcast Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
        if (!open) resetForm();
        setIsCreateDialogOpen(open);
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-[#25D366]" />
              Create WhatsApp Broadcast
            </DialogTitle>
            <DialogDescription>
              Compose a message to send to your attendees via WhatsApp
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                {error}
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Broadcast Name *</Label>
                <Input
                  placeholder="e.g., Event Reminder"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="rounded-xl h-12"
                />
              </div>
              <div className="space-y-2">
                <Label>Message Template</Label>
                <Select
                  value={formData.selectedTemplate}
                  onValueChange={applyTemplate}
                >
                  <SelectTrigger className="rounded-xl h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {messageTemplates.map(template => (
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
                    <SelectItem value="event_attendees">Event Attendees</SelectItem>
                    <SelectItem value="followers">All Followers</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.recipientType === 'event_attendees' && (
                <div className="space-y-2">
                  <Label>Select Event *</Label>
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
              <div className="p-3 bg-[#25D366]/5 rounded-xl flex items-center gap-2">
                <Phone className="w-4 h-4 text-[#25D366]" />
                <span className="text-sm text-[#0F0F0F]">
                  <strong>{recipientCount}</strong> recipients with phone numbers
                </span>
              </div>
            )}

            <div className="space-y-2">
              <Label>Message *</Label>
              <Textarea
                placeholder="Write your WhatsApp message here..."
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                className="rounded-xl min-h-[150px]"
              />
              <p className="text-xs text-[#0F0F0F]/40">
                Use *text* for bold. Variables: {'{{event_name}}'}, {'{{event_date}}'}, {'{{event_venue}}'}
              </p>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setIsCreateDialogOpen(false);
                  resetForm();
                }}
                className="flex-1 rounded-xl h-12"
              >
                Cancel
              </Button>
              <Button
                onClick={saveBroadcast}
                disabled={saving || recipientCount === 0}
                className="flex-1 bg-[#25D366] hover:bg-[#25D366]/90 text-white rounded-xl h-12"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Save Broadcast
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Recipients Dialog */}
      <Dialog open={isRecipientsDialogOpen} onOpenChange={setIsRecipientsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>Send to Recipients</DialogTitle>
            <DialogDescription>
              Click on a recipient to open WhatsApp and send the message
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#0F0F0F]/60">
                {recipients.length} recipients
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={exportRecipients}
                className="rounded-xl"
              >
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>

            {selectedBroadcast && (
              <div className="p-3 bg-[#F4F6FA] rounded-xl">
                <p className="text-xs text-[#0F0F0F]/60 mb-1">Message:</p>
                <p className="text-sm text-[#0F0F0F] whitespace-pre-wrap">{selectedBroadcast.message}</p>
              </div>
            )}

            <div className="max-h-[300px] overflow-y-auto space-y-2">
              {recipients.map((recipient, index) => (
                <div
                  key={index}
                  className="p-3 bg-[#F4F6FA] rounded-xl flex items-center justify-between hover:bg-[#F4F6FA]/80 transition-colors"
                >
                  <div>
                    <p className="font-medium text-[#0F0F0F]">{recipient.name}</p>
                    <p className="text-sm text-[#0F0F0F]/60">{recipient.phone}</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => openWhatsAppWeb(recipient.phone, selectedBroadcast?.message || '')}
                    className="bg-[#25D366] hover:bg-[#25D366]/90 text-white rounded-xl"
                  >
                    <ExternalLink className="w-4 h-4 mr-1" />
                    Open WhatsApp
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <Button
                variant="outline"
                onClick={() => setIsRecipientsDialogOpen(false)}
                className="rounded-xl"
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
