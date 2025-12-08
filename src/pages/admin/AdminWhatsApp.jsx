import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  MessageSquare,
  Send,
  Users,
  Loader2,
  CheckCircle,
  History,
  RefreshCw,
  Eye,
  ExternalLink,
  Settings,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase';
import { useAdmin } from '@/contexts/AdminContext';

export function AdminWhatsApp() {
  const { admin, logAdminAction } = useAdmin();
  const [activeTab, setActiveTab] = useState('compose');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [events, setEvents] = useState([]);
  const [whatsappHistory, setWhatsappHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [recipients, setRecipients] = useState([]);
  
  const [form, setForm] = useState({
    eventId: '',
    message: '',
  });
  const [sent, setSent] = useState(false);

  useEffect(() => {
    loadEvents();
    loadWhatsappHistory();
  }, []);

  const loadEvents = async () => {
    const { data } = await supabase
      .from('events')
      .select('id, title')
      .eq('status', 'published')
      .order('start_date', { ascending: false });
    setEvents(data || []);
  };

  const loadWhatsappHistory = async () => {
    setHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from('whatsapp_audit')
        .select(`
          *,
          events (title),
          organizers (business_name)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setWhatsappHistory(data || []);
    } catch (error) {
      console.error('Error loading WhatsApp history:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadRecipients = async (eventId) => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('tickets')
        .select('id, customer_name, customer_phone')
        .eq('event_id', eventId)
        .eq('payment_status', 'completed')
        .not('customer_phone', 'is', null);

      setRecipients(data || []);
    } catch (error) {
      console.error('Error loading recipients:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (form.eventId) {
      loadRecipients(form.eventId);
    } else {
      setRecipients([]);
    }
  }, [form.eventId]);

  const handleSend = async () => {
    if (!form.message || !form.eventId) {
      alert('Please select an event and enter a message');
      return;
    }

    setSending(true);
    try {
      // Log to whatsapp_audit table
      const { error } = await supabase
        .from('whatsapp_audit')
        .insert({
          sender_id: admin.id,
          sender_type: 'admin',
          recipient_type: 'event_attendees',
          recipient_count: recipients.length,
          message: form.message,
          event_id: form.eventId,
          status: 'sent',
        });

      if (error) throw error;

      await logAdminAction('whatsapp_broadcast_sent', 'whatsapp', null, {
        eventId: form.eventId,
        recipientCount: recipients.length,
      });

      setSent(true);
      loadWhatsappHistory();
    } catch (error) {
      console.error('Error logging WhatsApp broadcast:', error);
      alert('Failed to log broadcast');
    } finally {
      setSending(false);
    }
  };

  const resetForm = () => {
    setForm({ eventId: '', message: '' });
    setRecipients([]);
    setSent(false);
  };

  const openWhatsApp = (phone, message) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/${cleanPhone}?text=${encodedMessage}`, '_blank');
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'sent':
        return <Badge className="bg-green-100 text-green-700">Sent</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-700">Failed</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-700">{status}</Badge>;
    }
  };

  const quickTemplates = [
    { name: 'Event Reminder', message: 'Hi! Just a reminder about the upcoming event you registered for. We look forward to seeing you there! 🎉' },
    { name: 'Thank You', message: 'Thank you for attending! We hope you had a great time. See you at the next event! 🙏' },
    { name: 'Important Update', message: 'Important update regarding your registered event. Please check your email for more details.' },
  ];

  if (sent) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-semibold text-[#0F0F0F] mb-2">Broadcast Ready!</h2>
            <p className="text-[#0F0F0F]/60 mb-6">
              Click on each recipient below to open WhatsApp and send the message.
            </p>
            <div className="max-h-64 overflow-y-auto mb-6 space-y-2">
              {recipients.map((r) => (
                <div key={r.id} className="flex items-center justify-between p-3 bg-[#F4F6FA] rounded-xl">
                  <div>
                    <p className="text-[#0F0F0F] font-medium">{r.customer_name}</p>
                    <p className="text-sm text-[#0F0F0F]/60">{r.customer_phone}</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => openWhatsApp(r.customer_phone, form.message)}
                    className="bg-green-500 hover:bg-green-600 text-white rounded-lg"
                  >
                    <ExternalLink className="w-4 h-4 mr-1" />
                    Open
                  </Button>
                </div>
              ))}
            </div>
            <Button onClick={resetForm} variant="outline" className="rounded-xl">
              Send Another Broadcast
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-[#0F0F0F]">WhatsApp Broadcasts</h2>
          <p className="text-[#0F0F0F]/60 mt-1">Send WhatsApp messages and view history</p>
        </div>
        <Button variant="outline" size="icon" onClick={loadWhatsappHistory} className="rounded-xl">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-[#F4F6FA] rounded-xl">
          <TabsTrigger value="compose" className="rounded-lg">
            <Send className="w-4 h-4 mr-2" />
            Compose
          </TabsTrigger>
          <TabsTrigger value="history" className="rounded-lg">
            <History className="w-4 h-4 mr-2" />
            History ({whatsappHistory.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="compose" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card className="border-[#0F0F0F]/10 rounded-2xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-green-500" />
                    Compose WhatsApp Message
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Select Event</Label>
                    <Select value={form.eventId} onValueChange={(v) => setForm({ ...form, eventId: v })}>
                      <SelectTrigger className="rounded-xl mt-1">
                        <SelectValue placeholder="Select an event" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl max-h-64">
                        {events.map((event) => (
                          <SelectItem key={event.id} value={event.id}>{event.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {form.eventId && (
                    <div className="p-3 bg-[#F4F6FA] rounded-xl flex items-center gap-2">
                      <Users className="w-4 h-4 text-green-500" />
                      <span className="text-sm text-[#0F0F0F]/60">
                        {loading ? 'Loading...' : `${recipients.length} recipient(s) with phone numbers`}
                      </span>
                    </div>
                  )}

                  <div>
                    <Label>Message ({form.message.length}/1000)</Label>
                    <Textarea
                      value={form.message}
                      onChange={(e) => setForm({ ...form, message: e.target.value.slice(0, 1000) })}
                      placeholder="Enter your WhatsApp message..."
                      className="rounded-xl mt-1 min-h-[150px]"
                    />
                  </div>

                  <Button
                    onClick={handleSend}
                    disabled={sending || !form.message || recipients.length === 0}
                    className="w-full bg-green-500 hover:bg-green-600 text-white rounded-xl"
                  >
                    {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                    Prepare Broadcast
                  </Button>
                </CardContent>
              </Card>
            </div>

            <div>
              <Card className="border-[#0F0F0F]/10 rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-base">Quick Templates</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {quickTemplates.map((template) => (
                    <Button
                      key={template.name}
                      variant="outline"
                      className="w-full justify-start rounded-xl text-left h-auto py-3"
                      onClick={() => setForm({ ...form, message: template.message })}
                    >
                      <div>
                        <p className="font-medium">{template.name}</p>
                        <p className="text-xs text-[#0F0F0F]/60 truncate">{template.message.slice(0, 40)}...</p>
                      </div>
                    </Button>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <Card className="border-[#0F0F0F]/10 rounded-2xl">
            <CardHeader>
              <CardTitle>WhatsApp History</CardTitle>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-green-500" />
                </div>
              ) : whatsappHistory.length === 0 ? (
                <p className="text-center text-[#0F0F0F]/60 py-8">No WhatsApp broadcasts sent yet</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#0F0F0F]/10">
                        <th className="text-left py-3 px-4 text-[#0F0F0F]/60 font-medium">Event</th>
                        <th className="text-left py-3 px-4 text-[#0F0F0F]/60 font-medium">Message</th>
                        <th className="text-left py-3 px-4 text-[#0F0F0F]/60 font-medium">Recipients</th>
                        <th className="text-left py-3 px-4 text-[#0F0F0F]/60 font-medium">Status</th>
                        <th className="text-left py-3 px-4 text-[#0F0F0F]/60 font-medium">Date</th>
                        <th className="text-right py-3 px-4 text-[#0F0F0F]/60 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {whatsappHistory.map((msg) => (
                        <tr key={msg.id} className="border-b border-[#0F0F0F]/5 hover:bg-[#F4F6FA]/50">
                          <td className="py-3 px-4">
                            <p className="text-[#0F0F0F]">{msg.events?.title || 'N/A'}</p>
                          </td>
                          <td className="py-3 px-4">
                            <p className="text-[#0F0F0F] truncate max-w-[200px]">{msg.message}</p>
                          </td>
                          <td className="py-3 px-4">
                            <p className="text-[#0F0F0F]">{msg.recipient_count}</p>
                          </td>
                          <td className="py-3 px-4">{getStatusBadge(msg.status)}</td>
                          <td className="py-3 px-4">
                            <p className="text-[#0F0F0F]/60 text-sm">
                              {new Date(msg.created_at).toLocaleDateString()}
                            </p>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedMessage(msg);
                                setDetailsOpen(true);
                              }}
                              className="rounded-lg"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Message Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle>WhatsApp Message Details</DialogTitle>
          </DialogHeader>
          {selectedMessage && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-[#F4F6FA] rounded-xl">
                  <p className="text-sm text-[#0F0F0F]/60">Event</p>
                  <p className="text-[#0F0F0F] font-medium">{selectedMessage.events?.title || 'N/A'}</p>
                </div>
                <div className="p-3 bg-[#F4F6FA] rounded-xl">
                  <p className="text-sm text-[#0F0F0F]/60">Recipients</p>
                  <p className="text-[#0F0F0F] font-medium">{selectedMessage.recipient_count}</p>
                </div>
                <div className="p-3 bg-[#F4F6FA] rounded-xl">
                  <p className="text-sm text-[#0F0F0F]/60">Status</p>
                  {getStatusBadge(selectedMessage.status)}
                </div>
                <div className="p-3 bg-[#F4F6FA] rounded-xl">
                  <p className="text-sm text-[#0F0F0F]/60">Date</p>
                  <p className="text-[#0F0F0F]">{new Date(selectedMessage.created_at).toLocaleString()}</p>
                </div>
              </div>
              <div className="p-4 bg-[#F4F6FA] rounded-xl">
                <p className="text-sm text-[#0F0F0F]/60 mb-1">Message</p>
                <p className="text-[#0F0F0F] whitespace-pre-wrap">{selectedMessage.message}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
