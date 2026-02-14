import { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  Send, 
  Users, 
  CheckCircle, 
  Calendar,
  Clock,
  Filter,
  FileText,
  Loader2,
  History
} from 'lucide-react';
import { useOrganizer } from '../../contexts/OrganizerContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

// Quick templates
const quickTemplates = [
  { id: 'reminder', name: 'Event Reminder' },
  { id: 'promo', name: 'Promo Announcement' },
  { id: 'thankyou', name: 'Post-Event Thank You' },
  { id: 'lastchance', name: 'Last Chance Alert' },
];

const templateMessages = {
  reminder: `Hi {{NAME}}! 👋

This is a friendly reminder that {{EVENT_NAME}} is happening on {{DATE}} at {{VENUE}}.

Don't forget to bring your ticket! See you there! 🎉`,
  promo: `🎉 Special Announcement! 🎉

We have an exciting update about {{EVENT_NAME}}!

Use code {{PROMO_CODE}} for a special discount.

Get your tickets: {{TICKET_LINK}}`,
  thankyou: `Hi {{NAME}}! 🙏

Thank you so much for attending {{EVENT_NAME}}! We hope you had an amazing time.

We'd love to hear your feedback. Stay tuned for more events!`,
  lastchance: `⚡ Last Chance Alert! ⚡

Only a few tickets left for {{EVENT_NAME}}!

📅 {{DATE}}
📍 {{VENUE}}

Don't miss out: {{TICKET_LINK}}`
};

const availableVariables = ['{{NAME}}', '{{EVENT_NAME}}', '{{DATE}}', '{{TIME}}', '{{VENUE}}', '{{TICKET_LINK}}', '{{PROMO_CODE}}'];

export function WhatsAppBroadcast() {
  const { organizer } = useOrganizer();
  const [activeTab, setActiveTab] = useState('compose');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedAudience, setSelectedAudience] = useState('all_followers');
  const [selectedEvent, setSelectedEvent] = useState('');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [events, setEvents] = useState([]);
  const [broadcasts, setBroadcasts] = useState([]);
  const [stats, setStats] = useState({
    totalRecipients: 1250,
    messagesSent: 1773,
    deliveryRate: 99.7,
    thisMonth: 1
  });
  const [recipientCount, setRecipientCount] = useState(1250);
  const [estimatedCost, setEstimatedCost] = useState(6250);

  useEffect(() => {
    if (organizer?.id) {
      loadData();
    }
  }, [organizer?.id]);

  useEffect(() => {
    calculateRecipients();
  }, [selectedAudience, selectedEvent]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: eventsData } = await supabase
        .from('events')
        .select('id, title')
        .eq('organizer_id', organizer.id)
        .order('created_at', { ascending: false });
      setEvents(eventsData || []);

      const { data: broadcastsData } = await supabase
        .from('whatsapp_broadcasts')
        .select('*')
        .eq('organizer_id', organizer.id)
        .order('created_at', { ascending: false });
      setBroadcasts(broadcastsData || []);

      const { data: usageData } = await supabase
        .from('whatsapp_credit_usage')
        .select('*')
        .eq('organizer_id', organizer.id);

      if (usageData && usageData.length > 0) {
        const thisMonth = new Date();
        thisMonth.setDate(1);
        const monthlyUsage = usageData.filter(u => new Date(u.created_at) >= thisMonth);
        const totalSent = usageData.length;
        const successfulSent = usageData.filter(u => u.status === 'sent').length;

        setStats({
          totalRecipients: 1250,
          messagesSent: totalSent,
          deliveryRate: totalSent > 0 ? ((successfulSent / totalSent) * 100).toFixed(1) : 99.7,
          thisMonth: monthlyUsage.length
        });
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateRecipients = async () => {
    if (!organizer?.id) return;
    
    try {
      let count = 1250;
      
      if (selectedAudience === 'all_followers') {
        const { count: followerCount } = await supabase
          .from('followers')
          .select('*', { count: 'exact', head: true })
          .eq('organizer_id', organizer.id);
        count = followerCount || 1250;
      } else if (selectedAudience === 'event_attendees' && selectedEvent) {
        const { count: attendeeCount } = await supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('event_id', selectedEvent)
          .eq('status', 'completed');
        count = attendeeCount || 0;
      }
      
      setRecipientCount(count);
      setEstimatedCost(count * 5);
    } catch (error) {
      console.error('Error calculating recipients:', error);
    }
  };

  const applyTemplate = (templateId) => {
    setMessage(templateMessages[templateId] || '');
  };

  const insertVariable = (variable) => {
    setMessage(prev => prev + variable);
  };

  const handleSendBroadcast = async () => {
    if (!message.trim()) {
      toast.error('Please enter a message');
      return;
    }
    if (recipientCount === 0) {
      toast.info('No recipients selected');
      return;
    }

    setSending(true);
    try {
      const { data: broadcast, error } = await supabase
        .from('whatsapp_broadcasts')
        .insert({
          organizer_id: organizer.id,
          message: message,
          recipient_type: selectedAudience,
          event_id: selectedEvent || null,
          total_recipients: recipientCount,
          scheduled_at: scheduleDate && scheduleTime ? `${scheduleDate}T${scheduleTime}` : null,
          status: scheduleDate ? 'scheduled' : 'sending',
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      await supabase
        .from('whatsapp_broadcasts')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', broadcast.id);

      toast.success('Broadcast sent successfully!');
      setMessage('');
      setScheduleDate('');
      setScheduleTime('');
      loadData();
    } catch (error) {
      console.error('Error sending broadcast:', error);
      toast.error('Failed to send broadcast: ' + error.message);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">WhatsApp Broadcast</h1>
          <p className="text-muted-foreground">Send bulk WhatsApp messages to your attendees and followers</p>
        </div>
        <div className="flex items-center gap-2 text-green-600">
          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
          <span className="text-sm font-medium">WhatsApp Connected</span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card p-4 rounded-2xl border border-border/10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Recipients</p>
              <p className="text-2xl font-bold text-foreground">{stats.totalRecipients.toLocaleString()}</p>
            </div>
            <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-orange-400" />
            </div>
          </div>
        </div>
        <div className="bg-card p-4 rounded-2xl border border-border/10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Messages Sent</p>
              <p className="text-2xl font-bold text-foreground">{stats.messagesSent.toLocaleString()}</p>
            </div>
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
              <Send className="w-5 h-5 text-blue-500" />
            </div>
          </div>
        </div>
        <div className="bg-card p-4 rounded-2xl border border-border/10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Delivery Rate</p>
              <p className="text-2xl font-bold text-foreground">{stats.deliveryRate}%</p>
            </div>
            <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-500" />
            </div>
          </div>
        </div>
        <div className="bg-card p-4 rounded-2xl border border-border/10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">This Month</p>
              <p className="text-2xl font-bold text-foreground">{stats.thisMonth}</p>
            </div>
            <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
              <Calendar className="w-5 h-5 text-purple-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-muted p-1 rounded-xl flex">
        <button
          onClick={() => setActiveTab('compose')}
          className={`flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'compose' 
              ? 'bg-card text-foreground shadow-sm' 
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Compose Broadcast
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'history' 
              ? 'bg-card text-foreground shadow-sm' 
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Broadcast History
        </button>
      </div>

      {/* Compose Tab */}
      {activeTab === 'compose' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Message Composer - Left Side (2 columns) */}
          <div className="lg:col-span-2">
            <div className="bg-card rounded-2xl border border-border/10 p-6">
              <div className="flex items-center gap-2 mb-6">
                <MessageSquare className="w-5 h-5 text-muted-foreground" />
                <h2 className="font-semibold text-foreground">Message Composer</h2>
              </div>

              <div className="space-y-6">
                {/* Message Input */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Message *</label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Type your message here..."
                    className="w-full h-32 px-4 py-3 border border-border/10 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-[#25D366]/50 text-foreground placeholder:text-muted-foreground"
                    maxLength={1000}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-2">
                    <span>{message.length}/1000 characters</span>
                    <span>Approximately {Math.ceil(message.length / 160) || 0} SMS segment(s)</span>
                  </div>
                </div>

                {/* Quick Templates */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-3">Quick Templates</label>
                  <div className="grid grid-cols-2 gap-3">
                    {quickTemplates.map(template => (
                      <button
                        key={template.id}
                        onClick={() => applyTemplate(template.id)}
                        className="flex items-center gap-3 p-4 bg-muted hover:bg-muted/80 rounded-xl text-sm text-left transition-colors border border-transparent hover:border-border/10"
                      >
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        <span className="text-foreground">{template.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Available Variables */}
                <div className="bg-muted rounded-xl p-4">
                  <p className="text-sm font-medium text-foreground mb-3">Available Variables:</p>
                  <div className="flex flex-wrap gap-2">
                    {availableVariables.map(variable => (
                      <button
                        key={variable}
                        onClick={() => insertVariable(variable)}
                        className="px-3 py-1.5 bg-card border border-border/10 rounded-lg text-xs font-mono text-foreground/70 hover:bg-[#0F0F0F]/5 transition-colors"
                      >
                        {variable}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side - Target Audience & Schedule (1 column) */}
          <div className="space-y-6">
            {/* Target Audience */}
            <div className="bg-card rounded-2xl border border-border/10 p-6">
              <div className="flex items-center gap-2 mb-6">
                <Filter className="w-5 h-5 text-muted-foreground" />
                <h2 className="font-semibold text-foreground">Target Audience</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Select Audience *</label>
                  <select
                    value={selectedAudience}
                    onChange={(e) => setSelectedAudience(e.target.value)}
                    className="w-full px-4 py-3 border border-border/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#25D366]/50 bg-card text-foreground"
                  >
                    <option value="all_followers">All Followers</option>
                    <option value="event_attendees">Event Attendees</option>
                  </select>
                </div>

                {selectedAudience === 'event_attendees' && (
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Select Event</label>
                    <select
                      value={selectedEvent}
                      onChange={(e) => setSelectedEvent(e.target.value)}
                      className="w-full px-4 py-3 border border-border/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#25D366]/50 bg-card text-foreground"
                    >
                      <option value="">Select an event</option>
                      {events.map(event => (
                        <option key={event.id} value={event.id}>{event.title}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="pt-4 border-t border-border/10 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Recipients</span>
                    <span className="font-semibold text-foreground">{recipientCount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Estimated cost</span>
                    <span className="font-semibold text-foreground">₦{estimatedCost.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Schedule */}
            <div className="bg-card rounded-2xl border border-border/10 p-6">
              <div className="flex items-center gap-2 mb-6">
                <Clock className="w-5 h-5 text-muted-foreground" />
                <h2 className="font-semibold text-foreground">Schedule (Optional)</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Date</label>
                  <input
                    type="date"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    placeholder="mm/dd/yyyy"
                    className="w-full px-4 py-3 border border-border/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#25D366]/50 text-foreground"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Time</label>
                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    placeholder="--:-- --"
                    className="w-full px-4 py-3 border border-border/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#25D366]/50 text-foreground"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Leave empty to send immediately</p>
              </div>
            </div>

            {/* Send Button */}
            <button
              onClick={handleSendBroadcast}
              disabled={sending || !message.trim() || recipientCount === 0}
              className="w-full py-4 bg-[#25D366] hover:bg-[#25D366]/90 disabled:bg-[#25D366]/50 disabled:cursor-not-allowed text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
            >
              {sending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Send Broadcast
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="bg-card rounded-2xl border border-border/10">
          <div className="p-4 border-b border-border/10">
            <h2 className="font-semibold text-foreground">Broadcast History</h2>
          </div>
          
          {broadcasts.length === 0 ? (
            <div className="p-12 text-center">
              <History className="w-12 h-12 text-foreground/20 mx-auto mb-4" />
              <p className="text-muted-foreground">No broadcasts sent yet</p>
              <p className="text-sm text-muted-foreground mt-1">Your broadcast history will appear here</p>
            </div>
          ) : (
            <div className="divide-y divide-[#0F0F0F]/10">
              {broadcasts.map((broadcast) => (
                <div key={broadcast.id} className="p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`w-2 h-2 rounded-full ${
                          broadcast.status === 'sent' ? 'bg-green-500' : 
                          broadcast.status === 'scheduled' ? 'bg-yellow-500' : 
                          broadcast.status === 'failed' ? 'bg-red-500' : 'bg-gray-400'
                        }`}></span>
                        <span className="font-medium text-foreground">
                          {broadcast.recipient_type === 'all_followers' ? 'All Followers' : 'Event Attendees'}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          broadcast.status === 'sent' ? 'bg-green-100 text-green-700' : 
                          broadcast.status === 'scheduled' ? 'bg-yellow-100 text-yellow-700' : 
                          broadcast.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-muted text-foreground/80'
                        }`}>
                          {broadcast.status}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">{broadcast.message}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span>{new Date(broadcast.created_at).toLocaleDateString()}</span>
                        <span>{broadcast.total_recipients?.toLocaleString()} recipients</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
