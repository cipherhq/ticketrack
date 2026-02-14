import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Smartphone,
  Send,
  Users,
  Loader2,
  CheckCircle,
  History,
  RefreshCw,
  Eye,
  AlertCircle,
  Settings,
  XCircle,
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
import { sendBulkSMS } from '@/lib/termii';
import { toast } from 'sonner';

export function AdminSMS() {
  const { admin, logAdminAction } = useAdmin();
  const [activeTab, setActiveTab] = useState('compose');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [events, setEvents] = useState([]);
  const [smsHistory, setSmsHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedSms, setSelectedSms] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [termiiConfig, setTermiiConfig] = useState(null);
  const [sendResults, setSendResults] = useState(null);
  
  const [form, setForm] = useState({
    recipientType: '',
    eventId: '',
    message: '',
  });
  const [recipients, setRecipients] = useState([]);

  useEffect(() => {
    loadEvents();
    loadSmsHistory();
    loadTermiiConfig();
  }, []);

  useEffect(() => {
    if (form.recipientType) {
      loadRecipients();
    }
  }, [form.recipientType, form.eventId]);

  const loadTermiiConfig = async () => {
    const { data } = await supabase
      .from('platform_sms_config')
      .select('*')
      .single();
    setTermiiConfig(data);
  };

  const loadEvents = async () => {
    const { data } = await supabase
      .from('events')
      .select('id, title')
      .eq('status', 'published')
      .order('start_date', { ascending: false });
    setEvents(data || []);
  };

  const loadRecipients = async () => {
    setLoading(true);
    try {
      let data = [];
      
      if (form.recipientType === 'event_attendees' && form.eventId) {
        const { data: tickets } = await supabase
          .from('tickets')
          .select('id, attendee_name, attendee_phone')
          .eq('event_id', form.eventId)
          .eq('payment_status', 'completed')
          .not('attendee_phone', 'is', null);
        data = tickets || [];
      } else if (form.recipientType === 'all_attendees') {
        const { data: tickets } = await supabase
          .from('tickets')
          .select('id, attendee_name, attendee_phone')
          .eq('payment_status', 'completed')
          .not('attendee_phone', 'is', null)
          .limit(500);
        data = tickets || [];
      } else if (form.recipientType === 'all_organizers') {
        const { data: orgs } = await supabase
          .from('organizers')
          .select('id, business_name, phone')
          .eq('is_active', true)
          .not('phone', 'is', null);
        data = (orgs || []).map(o => ({ id: o.id, attendee_name: o.business_name, attendee_phone: o.phone }));
      }
      
      setRecipients(data);
    } catch (error) {
      console.error('Error loading recipients:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSmsHistory = async () => {
    setHistoryLoading(true);
    try {
      const { data } = await supabase
        .from('sms_audit')
        .select('*, events (title)')
        .order('created_at', { ascending: false })
        .limit(100);
      setSmsHistory(data || []);
    } catch (error) {
      console.error('Error loading SMS history:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSend = async () => {
    if (!form.message || !form.recipientType || recipients.length === 0) {
      toast.error('Please fill in all fields and ensure there are recipients');
      return;
    }

    if (!termiiConfig?.api_key) {
      toast.error('Termii is not configured. Please go to SMS Settings first.');
      return;
    }

    setSending(true);
    setSendResults(null);

    try {
      // Send via Termii
      const results = await sendBulkSMS({
        recipients,
        message: form.message,
        apiKey: termiiConfig.api_key,
        senderId: termiiConfig.sender_id || 'Ticketrack',
      });

      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

      // Log to sms_audit table
      const smsCount = Math.ceil(form.message.length / 160);
      await supabase
        .from('sms_audit')
        .insert({
          sender_id: admin.id,
          sender_type: 'admin',
          recipient_type: form.recipientType,
          recipient_count: recipients.length,
          message: form.message,
          sms_count: smsCount,
          event_id: form.eventId || null,
          status: failCount === 0 ? 'sent' : failCount === recipients.length ? 'failed' : 'partial',
          cost: successCount * smsCount * 4,
        });

      await logAdminAction('sms_campaign_sent', 'sms', null, {
        recipientType: form.recipientType,
        recipientCount: recipients.length,
        successCount,
        failCount,
      });

      setSendResults({ results, successCount, failCount });
      loadSmsHistory();
    } catch (error) {
      console.error('Error sending SMS:', error);
      toast.error('Failed to send SMS: ' + error.message);
    } finally {
      setSending(false);
    }
  };

  const resetForm = () => {
    setForm({ recipientType: '', eventId: '', message: '' });
    setRecipients([]);
    setSendResults(null);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'sent':
        return <Badge className="bg-green-100 text-green-700">Sent</Badge>;
      case 'partial':
        return <Badge className="bg-yellow-100 text-yellow-700">Partial</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-700">Failed</Badge>;
      default:
        return <Badge className="bg-muted text-foreground/80">{status}</Badge>;
    }
  };

  const formatCurrency = (amount, currency = 'NGN') => {
    const symbols = { NGN: '₦', USD: '$', GBP: '£', EUR: '€', GHS: 'GH₵', KES: 'KSh', ZAR: 'R', CAD: 'C$', AUD: 'A$' };
    const symbol = symbols[currency] || currency + ' ';
    return symbol + new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount || 0);
  };

  const smsCount = Math.ceil(form.message.length / 160);
  const totalSms = smsCount * recipients.length;
  const estimatedCost = totalSms * 4;

  // Results screen
  if (sendResults) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-8">
            <div className="text-center mb-6">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                sendResults.failCount === 0 ? 'bg-green-100' : 'bg-yellow-100'
              }`}>
                {sendResults.failCount === 0 ? (
                  <CheckCircle className="w-8 h-8 text-green-600" />
                ) : (
                  <AlertCircle className="w-8 h-8 text-yellow-600" />
                )}
              </div>
              <h2 className="text-2xl font-semibold text-foreground">SMS Campaign Complete</h2>
              <p className="text-muted-foreground mt-2">
                {sendResults.successCount} sent successfully, {sendResults.failCount} failed
              </p>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-2 mb-6">
              {sendResults.results.map((result, idx) => (
                <div key={idx} className={`flex items-center justify-between p-3 rounded-xl ${
                  result.success ? 'bg-green-50' : 'bg-red-50'
                }`}>
                  <div>
                    <p className="text-foreground font-medium">{result.name || 'Unknown'}</p>
                    <p className="text-sm text-muted-foreground">{result.phone}</p>
                  </div>
                  {result.success ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600" />
                  )}
                </div>
              ))}
            </div>

            <Button onClick={resetForm} className="w-full bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl">
              Send Another Campaign
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
          <h2 className="text-2xl font-semibold text-foreground">SMS Campaigns</h2>
          <p className="text-muted-foreground mt-1">Send SMS messages via Termii</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={loadSmsHistory} className="rounded-xl">
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Link to="/admin/sms-settings">
            <Button variant="outline" className="rounded-xl">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </Button>
          </Link>
        </div>
      </div>

      {!termiiConfig?.api_key && (
        <div className="p-4 bg-yellow-50 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600" />
          <p className="text-yellow-700">Termii is not configured. <Link to="/admin/sms-settings" className="underline font-medium">Configure now</Link></p>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted rounded-xl">
          <TabsTrigger value="compose" className="rounded-lg">
            <Send className="w-4 h-4 mr-2" />
            Compose
          </TabsTrigger>
          <TabsTrigger value="history" className="rounded-lg">
            <History className="w-4 h-4 mr-2" />
            History ({smsHistory.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="compose" className="mt-6">
          <Card className="border-border/10 rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-[#2969FF]" />
                Compose SMS
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Recipient Type</Label>
                <Select value={form.recipientType} onValueChange={(v) => setForm({ ...form, recipientType: v, eventId: '' })}>
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
                    {loading ? 'Loading...' : `${recipients.length} recipient(s) with phone numbers`}
                  </span>
                </div>
              )}

              <div>
                <Label>Message ({form.message.length}/480 characters)</Label>
                <Textarea
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value.slice(0, 480) })}
                  placeholder="Enter your SMS message..."
                  className="rounded-xl mt-1 min-h-[120px]"
                />
                <div className="flex items-center justify-between mt-2 text-sm text-muted-foreground">
                  <span>{smsCount} SMS per recipient (160 chars each)</span>
                  <span>Total: {totalSms} SMS</span>
                </div>
              </div>

              {recipients.length > 0 && form.message && (
                <div className="p-3 bg-yellow-50 rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-yellow-600" />
                  <span className="text-sm text-yellow-700">
                    Estimated cost: {formatCurrency(estimatedCost)} ({totalSms} SMS × {formatCurrency(4)})
                  </span>
                </div>
              )}

              <Button
                onClick={handleSend}
                disabled={sending || !form.message || recipients.length === 0 || !termiiConfig?.api_key}
                className="w-full bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl"
              >
                {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                Send SMS Campaign
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <Card className="border-border/10 rounded-2xl">
            <CardHeader>
              <CardTitle>SMS History</CardTitle>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-[#2969FF]" />
                </div>
              ) : smsHistory.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No SMS campaigns sent yet</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border/10">
                        <th className="text-left py-3 px-4 text-muted-foreground font-medium">Message</th>
                        <th className="text-left py-3 px-4 text-muted-foreground font-medium">Recipients</th>
                        <th className="text-left py-3 px-4 text-muted-foreground font-medium">Cost</th>
                        <th className="text-left py-3 px-4 text-muted-foreground font-medium">Status</th>
                        <th className="text-left py-3 px-4 text-muted-foreground font-medium">Date</th>
                        <th className="text-right py-3 px-4 text-muted-foreground font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {smsHistory.map((sms) => (
                        <tr key={sms.id} className="border-b border-border/5 hover:bg-muted/50">
                          <td className="py-3 px-4">
                            <p className="text-foreground truncate max-w-[200px]">{sms.message}</p>
                          </td>
                          <td className="py-3 px-4">{sms.recipient_count}</td>
                          <td className="py-3 px-4">{formatCurrency(sms.cost, sms.currency || 'NGN')}</td>
                          <td className="py-3 px-4">{getStatusBadge(sms.status)}</td>
                          <td className="py-3 px-4">
                            <p className="text-muted-foreground text-sm">
                              {new Date(sms.created_at).toLocaleDateString()}
                            </p>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { setSelectedSms(sms); setDetailsOpen(true); }}
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

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle>SMS Details</DialogTitle>
          </DialogHeader>
          {selectedSms && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-muted rounded-xl">
                  <p className="text-sm text-muted-foreground">Recipients</p>
                  <p className="text-foreground font-medium">{selectedSms.recipient_count}</p>
                </div>
                <div className="p-3 bg-muted rounded-xl">
                  <p className="text-sm text-muted-foreground">Cost</p>
                  <p className="text-foreground font-medium">{formatCurrency(selectedSms.cost, selectedSms.currency || 'NGN')}</p>
                </div>
                <div className="p-3 bg-muted rounded-xl">
                  <p className="text-sm text-muted-foreground">Status</p>
                  {getStatusBadge(selectedSms.status)}
                </div>
                <div className="p-3 bg-muted rounded-xl">
                  <p className="text-sm text-muted-foreground">Date</p>
                  <p className="text-foreground">{new Date(selectedSms.created_at).toLocaleString()}</p>
                </div>
              </div>
              <div className="p-4 bg-muted rounded-xl">
                <p className="text-sm text-muted-foreground mb-1">Message</p>
                <p className="text-foreground whitespace-pre-wrap">{selectedSms.message}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
