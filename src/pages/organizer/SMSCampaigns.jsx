import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Send, Users, Plus, CreditCard, AlertCircle, Loader2, CheckCircle, XCircle, RefreshCw, History, Eye, Shield, Phone } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { useOrganizer } from '../../contexts/OrganizerContext';
import { supabase } from '@/lib/supabase';
import { getWalletBalance } from '@/lib/smsWallet';

export function SMSCampaigns() {
  const navigate = useNavigate();
  const { organizer } = useOrganizer();
  
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  
  const [campaignName, setCampaignName] = useState('');
  const [message, setMessage] = useState('');
  const [audience, setAudience] = useState('all_contacts');
  const [selectedEvent, setSelectedEvent] = useState('');
  
  const [smsCredits, setSmsCredits] = useState(0);
  const [events, setEvents] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [audienceCounts, setAudienceCounts] = useState({
    all_contacts: 0,
    event_attendees: 0,
    followers: 0,
  });
  const [stats, setStats] = useState({
    totalSent: 0,
    deliveryRate: 0,
    totalCampaigns: 0,
  });
  const [showLogs, setShowLogs] = useState(false);
  const [smsLogs, setSmsLogs] = useState([]);

  useEffect(() => {
    if (organizer?.id) {
      loadData();
    }
  }, [organizer?.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadCredits(),
        loadEvents(),
        loadCampaigns(),
        loadAudienceCounts(),
        loadSmsLogs(),
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCredits = async () => {
    const balance = await getWalletBalance(organizer.id);
    setSmsCredits(balance);
  };

  const loadEvents = async () => {
    const { data, error } = await supabase
      .from('events')
      .select('id, title')
      .eq('organizer_id', organizer.id)
      .eq('status', 'published')
      .order('start_date', { ascending: false });

    if (!error) setEvents(data || []);
  };

  const loadCampaigns = async () => {
    const { data, error } = await supabase
      .from('sms_campaigns')
      .select('*')
      .eq('organizer_id', organizer.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (!error && data) {
      setCampaigns(data);
      
      const totalSent = data.reduce((sum, c) => sum + (c.sent_count || 0), 0);
      const totalRecipients = data.reduce((sum, c) => sum + (c.recipient_count || 0), 0);
      const deliveryRate = totalRecipients > 0 ? Math.round((totalSent / totalRecipients) * 100) : 0;
      
      setStats({
        totalSent,
        deliveryRate,
        totalCampaigns: data.length,
      });
    }
  };

  const loadAudienceCounts = async () => {
    try {
      const { data: orgEvents } = await supabase
        .from('events')
        .select('id')
        .eq('organizer_id', organizer.id);

      const eventIds = (orgEvents || []).map(e => e.id);

      let attendeesCount = 0;
      if (eventIds.length > 0) {
        const { count } = await supabase
          .from('tickets')
          .select('id', { count: 'exact', head: true })
          .in('event_id', eventIds)
          .eq('payment_status', 'completed')
          .not('attendee_phone', 'is', null);
        
        attendeesCount = count || 0;
      }

      const { data: followers } = await supabase
        .from('followers')
        .select('profiles:user_id (phone)')
        .eq('organizer_id', organizer.id);

      const followersWithPhone = (followers || []).filter(f => f.profiles?.phone).length;

      setAudienceCounts({
        all_contacts: attendeesCount + followersWithPhone,
        event_attendees: attendeesCount,
        followers: followersWithPhone,
      });
    } catch (error) {
      console.error('Error loading audience counts:', error);
    }
  };

  const loadSmsLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('sms_logs')
        .select('*')
        .eq('organizer_id', organizer.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && data) {
        setSmsLogs(data);
      }
    } catch (error) {
      console.error('Error loading SMS logs:', error);
    }
  };

  const messageLength = message.length;
  const smsSegments = Math.ceil(messageLength / 160) || 1;
  
  const getRecipientCount = () => {
    return audienceCounts[audience] || 0;
  };

  const recipientCount = getRecipientCount();
  const creditsNeeded = recipientCount * smsSegments;
  const hasEnoughCredits = smsCredits >= creditsNeeded;

  const handleSendCampaign = async () => {
    if (!message.trim() || !hasEnoughCredits) return;
    
    setShowConfirm(false);
    setSending(true);

    try {
      const payload = {
        organizer_id: organizer.id,
        audience_type: audience,
        event_id: audience === 'event_attendees' ? selectedEvent : null,
        message: message.trim(),
        campaign_name: campaignName.trim() || `SMS Campaign ${new Date().toLocaleDateString()}`,
      };

      const { data, error } = await supabase.functions.invoke('send-sms', {
        body: payload,
      });

      if (error) throw error;

      if (data.success) {
        alert(`SMS Campaign sent!\n\nRecipients: ${data.recipients}\nDelivered: ${data.sent}\nFailed: ${data.failed}\nCredits used: ${data.credits_used}`);
        
        setShowCompose(false);
        setCampaignName('');
        setMessage('');
        setAudience('all_contacts');
        setSelectedEvent('');
        
        await loadData();
      } else {
        throw new Error(data.error || 'Failed to send SMS');
      }
    } catch (error) {
      console.error('SMS send error:', error);
      alert(`Failed to send SMS: ${error.message}`);
    } finally {
      setSending(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-NG', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-700">Completed</Badge>;
      case 'partial':
        return <Badge className="bg-yellow-100 text-yellow-700">Partial</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-700">Failed</Badge>;
      case 'sending':
        return <Badge className="bg-blue-100 text-blue-700">Sending</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-700">{status}</Badge>;
    }
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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-[#0F0F0F] mb-2">SMS Campaigns</h2>
          <p className="text-[#0F0F0F]/60">Send SMS messages to your attendees and followers</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={loadData} className="rounded-xl border-[#0F0F0F]/10">
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button variant="outline" className="rounded-xl" onClick={() => navigate('/organizer/sms/credits')}>
            <CreditCard className="w-4 h-4 mr-2" />
            Buy Credits
          </Button>
          <Button variant="outline" className="rounded-xl" onClick={() => setShowLogs(!showLogs)}>
            <Eye className="w-4 h-4 mr-2" />
            {showLogs ? 'Hide' : 'View'} Logs
          </Button>
          <Button onClick={() => setShowCompose(!showCompose)} className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl">
            <Plus className="w-4 h-4 mr-2" />
            New SMS Campaign
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#0F0F0F]/60 mb-1">SMS Credits</p>
                <p className="text-2xl font-semibold text-[#0F0F0F]">{smsCredits.toLocaleString()}</p>
              </div>
              <CreditCard className="w-8 h-8 text-[#2969FF]" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#0F0F0F]/60 mb-1">Messages Sent</p>
                <p className="text-2xl font-semibold text-[#0F0F0F]">{stats.totalSent.toLocaleString()}</p>
              </div>
              <Send className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#0F0F0F]/60 mb-1">Delivery Rate</p>
                <p className="text-2xl font-semibold text-[#0F0F0F]">{stats.deliveryRate}%</p>
              </div>
              <Bell className="w-8 h-8 text-[#2969FF]" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#0F0F0F]/60 mb-1">Campaigns</p>
                <p className="text-2xl font-semibold text-[#0F0F0F]">{stats.totalCampaigns}</p>
              </div>
              <Users className="w-8 h-8 text-[#2969FF]" />
            </div>
          </CardContent>
        </Card>
      </div>

      {smsCredits < 100 && (
        <Card className="border-yellow-300 bg-yellow-50 rounded-2xl">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600" />
            <div className="flex-1">
              <p className="font-medium text-yellow-800">Low SMS Credits</p>
              <p className="text-sm text-yellow-700">You have less than 100 credits remaining.</p>
            </div>
            <Button className="bg-yellow-600 hover:bg-yellow-700 text-white rounded-xl" onClick={() => navigate('/organizer/sms/credits')}>
              Buy Credits
            </Button>
          </CardContent>
        </Card>
      )}

      {showCompose && (
        <Card className="border-[#2969FF] border-2 rounded-2xl">
          <CardHeader>
            <CardTitle className="text-[#0F0F0F] flex items-center gap-2">
              <Bell className="w-5 h-5 text-[#2969FF]" />
              Compose SMS Campaign
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Campaign Name</Label>
              <Input placeholder="e.g., Event Reminder" value={campaignName} onChange={(e) => setCampaignName(e.target.value)} className="rounded-xl" />
            </div>

            <div className="space-y-2">
              <Label>Target Audience</Label>
              <Select value={audience} onValueChange={setAudience}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all_contacts">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      All Contacts ({audienceCounts.all_contacts.toLocaleString()})
                    </div>
                  </SelectItem>
                  <SelectItem value="event_attendees">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4" />
                      Event Attendees ({audienceCounts.event_attendees.toLocaleString()})
                    </div>
                  </SelectItem>
                  <SelectItem value="followers">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Followers Only ({audienceCounts.followers.toLocaleString()})
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-[#0F0F0F]/50">
                📱 Phone numbers are protected - only delivery counts are visible
              </p>
            </div>

            {audience === 'event_attendees' && (
              <div className="space-y-2">
                <Label>Select Event</Label>
                <Select value={selectedEvent} onValueChange={setSelectedEvent}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Choose an event" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {events.map((event) => (
                      <SelectItem key={event.id} value={event.id}>{event.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Message Content</Label>
              <Textarea 
                placeholder="Type your SMS message here... 
Example: Hi {name}, your event ticket for {event} is confirmed! Show this SMS at the venue. See you there! - Ticketrack" 
                value={message} 
                onChange={(e) => setMessage(e.target.value)} 
                className="rounded-xl min-h-[120px]" 
                maxLength={480} 
              />
              <div className="flex justify-between text-sm text-[#0F0F0F]/60">
                <span>{messageLength}/480 characters</span>
                <span className={smsSegments > 1 ? 'text-orange-600 font-medium' : ''}>
                  {smsSegments} SMS {smsSegments > 1 ? '(Long message - costs more)' : '(Standard)'}
                </span>
              </div>
              <div className="text-xs text-[#0F0F0F]/50 space-y-1">
                <p>💡 <strong>Tips for Nigerian SMS:</strong></p>
                <p>• Keep messages under 160 characters to save costs</p>
                <p>• Include your business name for trust</p>
                <p>• Add "Reply STOP to opt out" for compliance</p>
              </div>
            </div>

            <div className="p-4 bg-[#F4F6FA] rounded-xl">
              <div className="flex justify-between items-center mb-3">
                <div>
                  <p className="font-medium text-[#0F0F0F]">Campaign Cost</p>
                  <p className="text-sm text-[#0F0F0F]/60">Nigerian SMS via Termii</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-semibold text-[#0F0F0F]">{creditsNeeded.toLocaleString()} credits</p>
                  <p className="text-sm text-[#0F0F0F]/60">{recipientCount.toLocaleString()} recipients × {smsSegments} SMS</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="p-2 bg-white rounded-lg">
                  <p className="text-[#0F0F0F]/60">Recipients</p>
                  <p className="font-semibold">{recipientCount.toLocaleString()}</p>
                </div>
                <div className="p-2 bg-white rounded-lg">
                  <p className="text-[#0F0F0F]/60">SMS Segments</p>
                  <p className="font-semibold">{smsSegments}</p>
                </div>
                <div className="p-2 bg-white rounded-lg">
                  <p className="text-[#0F0F0F]/60">Current Balance</p>
                  <p className="font-semibold text-blue-600">{smsCredits.toLocaleString()}</p>
                </div>
                <div className="p-2 bg-white rounded-lg">
                  <p className="text-[#0F0F0F]/60">After Campaign</p>
                  <p className={`font-semibold ${hasEnoughCredits ? 'text-green-600' : 'text-red-600'}`}>
                    {hasEnoughCredits ? (smsCredits - creditsNeeded).toLocaleString() : 'Insufficient'}
                  </p>
                </div>
              </div>
              
              {!hasEnoughCredits && creditsNeeded > 0 && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2 text-red-700 text-sm font-medium mb-1">
                    <XCircle className="w-4 h-4" />
                    Insufficient Credits
                  </div>
                  <p className="text-red-600 text-sm">
                    You need {(creditsNeeded - smsCredits).toLocaleString()} more credits. 
                    <button 
                      onClick={() => navigate('/organizer/sms/credits')} 
                      className="underline ml-1 hover:text-red-800"
                    >
                      Buy credits now
                    </button>
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowCompose(false)} className="rounded-xl flex-1">
                Cancel
              </Button>
              <Button
                disabled={!message.trim() || !hasEnoughCredits || recipientCount === 0 || (audience === 'event_attendees' && !selectedEvent)}
                onClick={() => setShowConfirm(true)}
                className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl flex-1"
              >
                <Send className="w-4 h-4 mr-2" />
                Send Campaign
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardHeader>
          <CardTitle className="text-[#0F0F0F] flex items-center gap-2">
            <History className="w-5 h-5" />
            Recent Campaigns
          </CardTitle>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 ? (
            <div className="text-center py-8">
              <Send className="w-12 h-12 text-[#0F0F0F]/20 mx-auto mb-4" />
              <p className="text-[#0F0F0F]/60">No campaigns sent yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {campaigns.map((campaign) => (
                <div key={campaign.id} className="p-4 rounded-xl bg-[#F4F6FA]">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-medium text-[#0F0F0F]">{campaign.campaign_name}</h4>
                      <p className="text-sm text-[#0F0F0F]/60 line-clamp-1">{campaign.message}</p>
                    </div>
                    {getStatusBadge(campaign.status)}
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm text-[#0F0F0F]/60">
                    <span>{campaign.recipient_count} recipients</span>
                    <span className="flex items-center gap-1">
                      <CheckCircle className="w-3 h-3 text-green-600" />
                      {campaign.sent_count || 0} delivered
                    </span>
                    {campaign.failed_count > 0 && (
                      <span className="flex items-center gap-1 text-red-600">
                        <XCircle className="w-3 h-3" />
                        {campaign.failed_count} failed
                      </span>
                    )}
                    <span>{campaign.credits_used} credits</span>
                    <span>{formatDate(campaign.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* SMS Delivery Logs */}
      {showLogs && (
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardHeader>
            <CardTitle className="text-[#0F0F0F] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-green-600" />
                SMS Delivery Logs
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowLogs(false)} className="rounded-xl">
                <XCircle className="w-4 h-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl">
              <div className="flex items-center gap-2 text-green-800">
                <Shield className="w-4 h-4" />
                <span className="text-sm font-medium">Privacy Protected</span>
              </div>
              <p className="text-xs text-green-700 mt-1">
                Phone numbers are masked for privacy. Only the last 4 digits are visible.
              </p>
            </div>
            
            {smsLogs.length === 0 ? (
              <div className="text-center py-8">
                <Phone className="w-12 h-12 text-[#0F0F0F]/20 mx-auto mb-4" />
                <p className="text-[#0F0F0F]/60">No SMS logs yet</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {smsLogs.map((log, index) => (
                  <div key={index} className="p-3 rounded-xl bg-[#F4F6FA] border border-[#0F0F0F]/5">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-[#0F0F0F]/80">
                          {log.masked_phone || '+234•••••••••'}
                        </span>
                        <span className="text-sm text-[#0F0F0F]/60">{log.recipient_name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {log.status === 'delivered' ? (
                          <Badge className="bg-green-100 text-green-700 text-xs">Delivered</Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-700 text-xs">Failed</Badge>
                        )}
                        <span className="text-xs text-[#0F0F0F]/40 capitalize">{log.provider}</span>
                      </div>
                    </div>
                    {log.error_message && (
                      <p className="text-xs text-red-600 mt-1">{log.error_message}</p>
                    )}
                    <p className="text-xs text-[#0F0F0F]/40 mt-1">
                      {new Date(log.created_at).toLocaleString('en-NG')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Confirm SMS Campaign</DialogTitle>
            <DialogDescription>This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="flex justify-between text-sm">
              <span className="text-[#0F0F0F]/60">Recipients:</span>
              <span className="font-medium">{recipientCount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#0F0F0F]/60">Credits to use:</span>
              <span className="font-medium">{creditsNeeded.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#0F0F0F]/60">Balance after:</span>
              <span className="font-medium">{(smsCredits - creditsNeeded).toLocaleString()}</span>
            </div>
            <div className="p-3 bg-[#F4F6FA] rounded-xl">
              <p className="text-xs text-[#0F0F0F]/60 mb-1">Message:</p>
              <p className="text-sm">{message}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={handleSendCampaign} disabled={sending} className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl">
              {sending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending...</> : <><Send className="w-4 h-4 mr-2" />Confirm & Send</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
