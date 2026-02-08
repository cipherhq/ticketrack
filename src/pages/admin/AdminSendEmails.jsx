import { useState, useEffect } from 'react';
import {
  Send,
  Mail,
  Users,
  Calendar,
  Loader2,
  CheckCircle,
  Clock,
  AlertCircle,
  History,
  RefreshCw,
  Eye,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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

export function AdminSendEmails() {
  const { admin, logAdminAction } = useAdmin();
  const [activeTab, setActiveTab] = useState('compose');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [events, setEvents] = useState([]);
  const [emailHistory, setEmailHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  
  const [form, setForm] = useState({
    recipientType: '',
    eventId: '',
    subject: '',
    message: '',
  });
  const [recipientCount, setRecipientCount] = useState(0);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    loadEvents();
    loadEmailHistory();
  }, []);

  useEffect(() => {
    if (form.recipientType) {
      calculateRecipients();
    }
  }, [form.recipientType, form.eventId]);

  const loadEvents = async () => {
    const { data } = await supabase
      .from('events')
      .select('id, title, organizer_id')
      .eq('status', 'published')
      .order('start_date', { ascending: false });
    setEvents(data || []);
  };

  const loadEmailHistory = async () => {
    setHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from('email_audit')
        .select(`
          *,
          events (title),
          organizers (business_name)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setEmailHistory(data || []);
    } catch (error) {
      console.error('Error loading email history:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const calculateRecipients = async () => {
    setLoading(true);
    try {
      let count = 0;
      
      if (form.recipientType === 'event_attendees' && form.eventId) {
        const { count: ticketCount } = await supabase
          .from('tickets')
          .select('*', { count: 'exact', head: true })
          .eq('event_id', form.eventId)
          .eq('payment_status', 'completed');
        count = ticketCount || 0;
      } else if (form.recipientType === 'all_attendees') {
        const { count: ticketCount } = await supabase
          .from('tickets')
          .select('*', { count: 'exact', head: true })
          .eq('payment_status', 'completed');
        count = ticketCount || 0;
      } else if (form.recipientType === 'all_organizers') {
        const { count: orgCount } = await supabase
          .from('organizers')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true);
        count = orgCount || 0;
      }
      
      setRecipientCount(count);
    } catch (error) {
      console.error('Error calculating recipients:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!form.subject || !form.message || !form.recipientType) {
      alert('Please fill in all fields');
      return;
    }

    setSending(true);
    try {
      // Log to email_audit table
      const { error } = await supabase
        .from('email_audit')
        .insert({
          sender_id: admin.id,
          sender_type: 'admin',
          recipient_type: form.recipientType,
          recipient_count: recipientCount,
          subject: form.subject,
          message: form.message,
          event_id: form.eventId || null,
          status: 'sent',
        });

      if (error) throw error;

      await logAdminAction('bulk_email_sent', 'email', null, {
        recipientType: form.recipientType,
        recipientCount,
        subject: form.subject,
      });

      setSent(true);
      loadEmailHistory();
    } catch (error) {
      console.error('Error sending email:', error);
      alert('Failed to send email');
    } finally {
      setSending(false);
    }
  };

  const resetForm = () => {
    setForm({ recipientType: '', eventId: '', subject: '', message: '' });
    setRecipientCount(0);
    setSent(false);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'sent':
        return <Badge className="bg-green-100 text-green-700">Sent</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-700">Failed</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-700">Pending</Badge>;
      default:
        return <Badge className="bg-muted text-foreground/80">{status}</Badge>;
    }
  };

  const quickTemplates = [
    { name: 'Platform Update', subject: 'Important Platform Update', message: 'Dear User,\n\nWe have an important update to share with you about Ticketrack...\n\nBest regards,\nTicketrack Team' },
    { name: 'Safety Guidelines', subject: 'Event Safety Guidelines', message: 'Dear Attendee,\n\nAs you prepare for your upcoming event, please review these safety guidelines...\n\nStay safe,\nTicketrack Team' },
    { name: 'Feedback Request', subject: 'We Value Your Feedback', message: 'Dear User,\n\nWe would love to hear about your experience with Ticketrack...\n\nThank you,\nTicketrack Team' },
  ];

  if (sent) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-semibold text-foreground mb-2">Email Sent Successfully!</h2>
            <p className="text-muted-foreground mb-6">
              Your email has been queued for delivery to {recipientCount} recipient(s).
            </p>
            <Button onClick={resetForm} className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl">
              Send Another Email
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
          <h2 className="text-2xl font-semibold text-foreground">Email Communications</h2>
          <p className="text-muted-foreground mt-1">Send emails and view communication history</p>
        </div>
        <Button variant="outline" size="icon" onClick={loadEmailHistory} className="rounded-xl">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted rounded-xl">
          <TabsTrigger value="compose" className="rounded-lg">
            <Send className="w-4 h-4 mr-2" />
            Compose
          </TabsTrigger>
          <TabsTrigger value="history" className="rounded-lg">
            <History className="w-4 h-4 mr-2" />
            History ({emailHistory.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="compose" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card className="border-border/10 rounded-2xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="w-5 h-5 text-[#2969FF]" />
                    Compose Email
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Recipient Type</Label>
                    <Select
                      value={form.recipientType}
                      onValueChange={(v) => setForm({ ...form, recipientType: v, eventId: '' })}
                    >
                      <SelectTrigger className="rounded-xl mt-1">
                        <SelectValue placeholder="Select recipients" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="event_attendees">Event Attendees</SelectItem>
                        <SelectItem value="all_attendees">All Platform Attendees</SelectItem>
                        <SelectItem value="all_organizers">All Organizers</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {form.recipientType === 'event_attendees' && (
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
                  )}

                  {form.recipientType && (
                    <div className="p-3 bg-muted rounded-xl flex items-center gap-2">
                      <Users className="w-4 h-4 text-[#2969FF]" />
                      <span className="text-sm text-muted-foreground">
                        {loading ? 'Calculating...' : `${recipientCount} recipient(s) selected`}
                      </span>
                    </div>
                  )}

                  <div>
                    <Label>Subject</Label>
                    <Input
                      value={form.subject}
                      onChange={(e) => setForm({ ...form, subject: e.target.value })}
                      placeholder="Enter email subject"
                      className="rounded-xl mt-1"
                    />
                  </div>

                  <div>
                    <Label>Message</Label>
                    <Textarea
                      value={form.message}
                      onChange={(e) => setForm({ ...form, message: e.target.value })}
                      placeholder="Enter your message..."
                      className="rounded-xl mt-1 min-h-[200px]"
                    />
                  </div>

                  <Button
                    onClick={handleSend}
                    disabled={sending || !form.subject || !form.message || recipientCount === 0}
                    className="w-full bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl"
                  >
                    {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                    Send Email
                  </Button>
                </CardContent>
              </Card>
            </div>

            <div>
              <Card className="border-border/10 rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-base">Quick Templates</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {quickTemplates.map((template) => (
                    <Button
                      key={template.name}
                      variant="outline"
                      className="w-full justify-start rounded-xl text-left h-auto py-3"
                      onClick={() => setForm({ ...form, subject: template.subject, message: template.message })}
                    >
                      <div>
                        <p className="font-medium">{template.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{template.subject}</p>
                      </div>
                    </Button>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <Card className="border-border/10 rounded-2xl">
            <CardHeader>
              <CardTitle>Email History</CardTitle>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-[#2969FF]" />
                </div>
              ) : emailHistory.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No emails sent yet</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border/10">
                        <th className="text-left py-3 px-4 text-muted-foreground font-medium">Subject</th>
                        <th className="text-left py-3 px-4 text-muted-foreground font-medium">Recipients</th>
                        <th className="text-left py-3 px-4 text-muted-foreground font-medium">Type</th>
                        <th className="text-left py-3 px-4 text-muted-foreground font-medium">Status</th>
                        <th className="text-left py-3 px-4 text-muted-foreground font-medium">Date</th>
                        <th className="text-right py-3 px-4 text-muted-foreground font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {emailHistory.map((email) => (
                        <tr key={email.id} className="border-b border-border/5 hover:bg-muted/50">
                          <td className="py-3 px-4">
                            <p className="text-foreground font-medium truncate max-w-[200px]">{email.subject}</p>
                          </td>
                          <td className="py-3 px-4">
                            <p className="text-foreground">{email.recipient_count}</p>
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant="outline" className="capitalize">
                              {email.recipient_type?.replace('_', ' ')}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">{getStatusBadge(email.status)}</td>
                          <td className="py-3 px-4">
                            <p className="text-muted-foreground text-sm">
                              {new Date(email.created_at).toLocaleDateString()}
                            </p>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedEmail(email);
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

      {/* Email Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle>Email Details</DialogTitle>
          </DialogHeader>
          {selectedEmail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-muted rounded-xl">
                  <p className="text-sm text-muted-foreground">Recipients</p>
                  <p className="text-foreground font-medium">{selectedEmail.recipient_count}</p>
                </div>
                <div className="p-3 bg-muted rounded-xl">
                  <p className="text-sm text-muted-foreground">Status</p>
                  {getStatusBadge(selectedEmail.status)}
                </div>
                <div className="p-3 bg-muted rounded-xl">
                  <p className="text-sm text-muted-foreground">Sent By</p>
                  <p className="text-foreground">{selectedEmail.sender_type}</p>
                </div>
                <div className="p-3 bg-muted rounded-xl">
                  <p className="text-sm text-muted-foreground">Date</p>
                  <p className="text-foreground">{new Date(selectedEmail.created_at).toLocaleString()}</p>
                </div>
              </div>
              <div className="p-4 bg-muted rounded-xl">
                <p className="text-sm text-muted-foreground mb-1">Subject</p>
                <p className="text-foreground font-medium">{selectedEmail.subject}</p>
              </div>
              <div className="p-4 bg-muted rounded-xl">
                <p className="text-sm text-muted-foreground mb-1">Message</p>
                <p className="text-foreground whitespace-pre-wrap">{selectedEmail.message}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
