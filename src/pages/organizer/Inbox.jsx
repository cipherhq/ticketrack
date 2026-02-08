import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import {
  Inbox as InboxIcon, Mail, Phone, MessageSquare, Send, Search,
  Filter, Archive, Trash2, MoreVertical, User, Clock, CheckCircle,
  Circle, ChevronLeft, Settings, Bot, Plus, RefreshCw, Loader2,
  Tag, X, ArrowLeft
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useOrganizer } from '@/contexts/OrganizerContext';
import { supabase } from '@/lib/supabase';

// ============================================================================
// CONSTANTS
// ============================================================================

const CHANNELS = {
  sms: { name: 'SMS', icon: Phone, color: 'text-green-600', bgColor: 'bg-green-100' },
  whatsapp: { name: 'WhatsApp', icon: MessageSquare, color: 'text-emerald-600', bgColor: 'bg-emerald-100' },
  email: { name: 'Email', icon: Mail, color: 'text-blue-600', bgColor: 'bg-blue-100' },
  telegram: { name: 'Telegram', icon: Send, color: 'text-sky-600', bgColor: 'bg-sky-100' },
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function Inbox() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { organizer } = useOrganizer();
  const messagesEndRef = useRef(null);

  // State
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Filters
  const [channelFilter, setChannelFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('open');
  const [searchQuery, setSearchQuery] = useState('');

  // Compose
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    unread: 0,
    byChannel: { sms: 0, whatsapp: 0, email: 0, telegram: 0 },
  });

  // Auto-response settings
  const [showAutoResponse, setShowAutoResponse] = useState(false);
  const [autoResponses, setAutoResponses] = useState([]);

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  useEffect(() => {
    if (organizer?.id) {
      loadData();
      
      // Check for conversation ID in URL
      const conversationId = searchParams.get('conversation');
      if (conversationId) {
        loadConversation(conversationId);
      }
    }
  }, [organizer?.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadConversations(),
        loadStats(),
      ]);
    } catch (error) {
      console.error('Error loading inbox:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadConversations = async () => {
    let query = supabase
      .from('conversations')
      .select('*')
      .eq('organizer_id', organizer.id)
      .order('last_message_at', { ascending: false, nullsFirst: false });

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    if (channelFilter !== 'all') {
      query = query.eq('channel', channelFilter);
    }

    const { data, error } = await query.limit(100);

    if (error) {
      console.error('Error loading conversations:', error);
      return;
    }

    // Apply search filter client-side
    let filtered = data || [];
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c => 
        c.contact_name?.toLowerCase().includes(query) ||
        c.contact_phone?.includes(query) ||
        c.contact_email?.toLowerCase().includes(query) ||
        c.last_message_preview?.toLowerCase().includes(query)
      );
    }

    setConversations(filtered);
  };

  const loadStats = async () => {
    const { data } = await supabase
      .from('conversations')
      .select('channel, unread_count, status')
      .eq('organizer_id', organizer.id);

    if (data) {
      const byChannel = { sms: 0, whatsapp: 0, email: 0, telegram: 0 };
      let unread = 0;

      data.forEach(c => {
        if (c.status === 'open') {
          byChannel[c.channel] = (byChannel[c.channel] || 0) + 1;
        }
        unread += c.unread_count || 0;
      });

      setStats({
        total: data.length,
        unread,
        byChannel,
      });
    }
  };

  const loadConversation = async (conversationId) => {
    setLoadingMessages(true);
    
    // Get conversation details
    const { data: conversation } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .single();

    if (conversation) {
      setSelectedConversation(conversation);
      
      // Mark as read
      if (conversation.unread_count > 0) {
        await supabase.rpc('mark_conversation_read', { p_conversation_id: conversationId });
        loadStats();
        loadConversations();
      }
    }

    // Get messages
    const { data: messages } = await supabase
      .from('conversation_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    setMessages(messages || []);
    setLoadingMessages(false);

    // Scroll to bottom
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const sendReply = async () => {
    if (!replyText.trim() || !selectedConversation) return;

    setSending(true);
    try {
      const channel = selectedConversation.channel;
      const recipient = selectedConversation.contact_phone || selectedConversation.contact_email;

      // Call the appropriate send function
      let sendResult;
      
      if (channel === 'sms') {
        sendResult = await supabase.functions.invoke('send-sms', {
          body: {
            to: recipient,
            message: replyText,
            organizer_id: organizer.id,
          }
        });
      } else if (channel === 'whatsapp') {
        sendResult = await supabase.functions.invoke('send-whatsapp', {
          body: {
            to: recipient,
            message: replyText,
            type: 'text',
            organizer_id: organizer.id,
          }
        });
      } else if (channel === 'email') {
        sendResult = await supabase.functions.invoke('send-email', {
          body: {
            to: recipient,
            subject: `Re: ${selectedConversation.subject || 'Your message'}`,
            body: replyText,
            type: 'reply',
            organizer_id: organizer.id,
          }
        });
      }

      if (sendResult.error) {
        throw new Error(sendResult.error.message);
      }

      // Save message to conversation
      await supabase
        .from('conversation_messages')
        .insert({
          conversation_id: selectedConversation.id,
          organizer_id: organizer.id,
          direction: 'outbound',
          sender_type: 'organizer',
          channel,
          content: replyText,
        });

      // Reload messages
      await loadConversation(selectedConversation.id);
      setReplyText('');
    } catch (error) {
      console.error('Failed to send reply:', error);
      alert('Failed to send message: ' + error.message);
    } finally {
      setSending(false);
    }
  };

  const archiveConversation = async (id) => {
    await supabase
      .from('conversations')
      .update({ status: 'archived' })
      .eq('id', id);

    if (selectedConversation?.id === id) {
      setSelectedConversation(null);
      setMessages([]);
    }
    loadConversations();
  };

  const closeConversation = async (id) => {
    await supabase
      .from('conversations')
      .update({ status: 'closed' })
      .eq('id', id);

    loadConversations();
  };

  const reopenConversation = async (id) => {
    await supabase
      .from('conversations')
      .update({ status: 'open' })
      .eq('id', id);

    loadConversations();
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
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Inbox</h1>
          <p className="text-muted-foreground">
            {stats.unread > 0 ? `${stats.unread} unread messages` : 'All caught up!'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={loadData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={() => setShowAutoResponse(true)}>
            <Bot className="w-4 h-4 mr-2" />
            Auto-Responses
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-5 gap-4 mb-4">
        <Card className="border-border/10 rounded-xl">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                <InboxIcon className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <p className="text-lg font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {Object.entries(CHANNELS).map(([key, channel]) => (
          <Card key={key} className="border-border/10 rounded-xl">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg ${channel.bgColor} flex items-center justify-center`}>
                  <channel.icon className={`w-4 h-4 ${channel.color}`} />
                </div>
                <div>
                  <p className="text-lg font-bold">{stats.byChannel[key] || 0}</p>
                  <p className="text-xs text-muted-foreground">{channel.name}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Conversation List */}
        <Card className="w-[350px] flex-shrink-0 border-border/10 rounded-xl overflow-hidden flex flex-col">
          {/* Filters */}
          <div className="p-3 border-b border-border/10 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  loadConversations();
                }}
                placeholder="Search conversations..."
                className="pl-9 h-9"
              />
            </div>
            <div className="flex gap-2">
              <Select value={channelFilter} onValueChange={(v) => { setChannelFilter(v); loadConversations(); }}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Channel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Channels</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); loadConversations(); }}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <div className="p-8 text-center">
                <InboxIcon className="w-12 h-12 text-foreground/20 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">No conversations</p>
              </div>
            ) : (
              conversations.map((conv) => {
                const channel = CHANNELS[conv.channel];
                const isSelected = selectedConversation?.id === conv.id;
                
                return (
                  <button
                    key={conv.id}
                    onClick={() => loadConversation(conv.id)}
                    className={`w-full p-3 text-left border-b border-border/5 hover:bg-muted/50 transition-colors ${
                      isSelected ? 'bg-[#2969FF]/5 border-l-2 border-l-[#2969FF]' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg ${channel?.bgColor || 'bg-muted'} flex items-center justify-center flex-shrink-0`}>
                        {channel?.icon && <channel.icon className={`w-4 h-4 ${channel?.color || 'text-muted-foreground'}`} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className={`font-medium text-sm truncate ${conv.unread_count > 0 ? 'text-foreground' : 'text-foreground/80'}`}>
                            {conv.contact_name || conv.contact_phone || conv.contact_email || 'Unknown'}
                          </p>
                          {conv.unread_count > 0 && (
                            <Badge className="bg-[#2969FF] text-white text-xs px-1.5 min-w-[20px] h-5 flex items-center justify-center">
                              {conv.unread_count}
                            </Badge>
                          )}
                        </div>
                        <p className={`text-xs truncate mt-0.5 ${conv.unread_count > 0 ? 'text-foreground/70' : 'text-muted-foreground'}`}>
                          {conv.last_message_preview || 'No messages'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {conv.last_message_at ? formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: true }) : ''}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </Card>

        {/* Conversation View */}
        <Card className="flex-1 border-border/10 rounded-xl overflow-hidden flex flex-col">
          {selectedConversation ? (
            <>
              {/* Conversation Header */}
              <div className="p-4 border-b border-border/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="md:hidden"
                    onClick={() => setSelectedConversation(null)}
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                  <div className={`w-10 h-10 rounded-lg ${CHANNELS[selectedConversation.channel]?.bgColor} flex items-center justify-center`}>
                    {(() => {
                      const IconComponent = CHANNELS[selectedConversation.channel]?.icon;
                      return IconComponent ? <IconComponent className={`w-5 h-5 ${CHANNELS[selectedConversation.channel]?.color}`} /> : null;
                    })()}
                  </div>
                  <div>
                    <h3 className="font-semibold">
                      {selectedConversation.contact_name || selectedConversation.contact_phone || selectedConversation.contact_email}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {selectedConversation.contact_phone || selectedConversation.contact_email}
                      {selectedConversation.subject && ` • ${selectedConversation.subject}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="capitalize">
                    {selectedConversation.status}
                  </Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {selectedConversation.status === 'open' ? (
                        <>
                          <DropdownMenuItem onClick={() => closeConversation(selectedConversation.id)}>
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Close Conversation
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => archiveConversation(selectedConversation.id)}>
                            <Archive className="w-4 h-4 mr-2" />
                            Archive
                          </DropdownMenuItem>
                        </>
                      ) : (
                        <DropdownMenuItem onClick={() => reopenConversation(selectedConversation.id)}>
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Reopen
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => navigate(`/organizer/contacts?search=${selectedConversation.contact_phone || selectedConversation.contact_email}`)}>
                        <User className="w-4 h-4 mr-2" />
                        View Contact
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {loadingMessages ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-6 h-6 animate-spin text-[#2969FF]" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    No messages yet
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                          msg.direction === 'outbound'
                            ? 'bg-[#2969FF] text-white rounded-br-md'
                            : 'bg-muted text-foreground rounded-bl-md'
                        }`}
                      >
                        {msg.subject && (
                          <p className={`text-xs font-medium mb-1 ${msg.direction === 'outbound' ? 'text-white/80' : 'text-muted-foreground'}`}>
                            {msg.subject}
                          </p>
                        )}
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        <p className={`text-xs mt-1 ${msg.direction === 'outbound' ? 'text-white/60' : 'text-muted-foreground'}`}>
                          {format(new Date(msg.created_at), 'MMM d, h:mm a')}
                          {msg.direction === 'outbound' && msg.external_status && (
                            <span className="ml-2">• {msg.external_status}</span>
                          )}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply Box */}
              {selectedConversation.status === 'open' && (
                <div className="p-4 border-t border-border/10">
                  <div className="flex gap-2">
                    <Textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder={`Reply via ${CHANNELS[selectedConversation.channel]?.name || 'message'}...`}
                      className="flex-1 min-h-[60px] max-h-[150px]"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendReply();
                        }
                      }}
                    />
                    <Button
                      onClick={sendReply}
                      disabled={!replyText.trim() || sending}
                      className="bg-[#2969FF] text-white px-6"
                    >
                      {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Press Enter to send, Shift+Enter for new line
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <InboxIcon className="w-16 h-16 mx-auto mb-4 text-foreground/20" />
                <p>Select a conversation to view messages</p>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Auto-Response Settings Dialog */}
      <Dialog open={showAutoResponse} onOpenChange={setShowAutoResponse}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="w-5 h-5" />
              Auto-Responses
            </DialogTitle>
            <DialogDescription>
              Set up automatic replies for incoming messages
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <AutoResponseSettings organizerId={organizer?.id} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// AUTO-RESPONSE SETTINGS COMPONENT
// ============================================================================

function AutoResponseSettings({ organizerId }) {
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    name: '',
    channel: '',
    trigger_type: 'after_hours',
    trigger_keywords: '',
    response_message: '',
    active_hours_start: '09:00',
    active_hours_end: '18:00',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadResponses();
  }, [organizerId]);

  const loadResponses = async () => {
    if (!organizerId) return;
    
    const { data } = await supabase
      .from('auto_responses')
      .select('*')
      .eq('organizer_id', organizerId)
      .order('created_at', { ascending: false });

    setResponses(data || []);
    setLoading(false);
  };

  const saveResponse = async () => {
    if (!form.name || !form.response_message) {
      alert('Please fill in all required fields');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('auto_responses')
        .insert({
          organizer_id: organizerId,
          name: form.name,
          channel: form.channel || null,
          trigger_type: form.trigger_type,
          trigger_keywords: form.trigger_keywords ? form.trigger_keywords.split(',').map(k => k.trim()) : null,
          response_message: form.response_message,
          active_hours_start: form.trigger_type === 'after_hours' ? form.active_hours_start : null,
          active_hours_end: form.trigger_type === 'after_hours' ? form.active_hours_end : null,
        });

      if (error) throw error;

      setShowAdd(false);
      setForm({
        name: '',
        channel: '',
        trigger_type: 'after_hours',
        trigger_keywords: '',
        response_message: '',
        active_hours_start: '09:00',
        active_hours_end: '18:00',
      });
      loadResponses();
    } catch (error) {
      alert('Failed to save: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (id, currentStatus) => {
    await supabase
      .from('auto_responses')
      .update({ is_active: !currentStatus })
      .eq('id', id);
    loadResponses();
  };

  const deleteResponse = async (id) => {
    if (!confirm('Delete this auto-response?')) return;
    await supabase.from('auto_responses').delete().eq('id', id);
    loadResponses();
  };

  if (loading) {
    return <div className="text-center py-4"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>;
  }

  return (
    <div className="space-y-4">
      {!showAdd ? (
        <>
          <Button onClick={() => setShowAdd(true)} className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            Add Auto-Response
          </Button>

          {responses.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              No auto-responses configured
            </p>
          ) : (
            <div className="space-y-2">
              {responses.map((resp) => (
                <div key={resp.id} className="p-3 border rounded-lg flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{resp.name}</h4>
                      <Badge variant={resp.is_active ? 'default' : 'secondary'}>
                        {resp.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                      {resp.channel && (
                        <Badge variant="outline">{resp.channel}</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Trigger: {resp.trigger_type.replace('_', ' ')}
                      {resp.trigger_keywords?.length > 0 && ` (${resp.trigger_keywords.join(', ')})`}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                      {resp.response_message}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => toggleActive(resp.id, resp.is_active)}>
                      {resp.is_active ? 'Disable' : 'Enable'}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => deleteResponse(resp.id)} className="text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">New Auto-Response</h4>
            <Button variant="ghost" size="sm" onClick={() => setShowAdd(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div>
            <label className="text-sm font-medium">Name *</label>
            <Input
              value={form.name}
              onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g., After Hours Reply"
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Channel</label>
              <Select value={form.channel} onValueChange={(v) => setForm(f => ({ ...f, channel: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="All channels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Channels</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Trigger Type *</label>
              <Select value={form.trigger_type} onValueChange={(v) => setForm(f => ({ ...f, trigger_type: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="after_hours">After Business Hours</SelectItem>
                  <SelectItem value="first_message">First Message</SelectItem>
                  <SelectItem value="keyword">Keyword Match</SelectItem>
                  <SelectItem value="always">Always</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {form.trigger_type === 'after_hours' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Business Hours Start</label>
                <Input
                  type="time"
                  value={form.active_hours_start}
                  onChange={(e) => setForm(f => ({ ...f, active_hours_start: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Business Hours End</label>
                <Input
                  type="time"
                  value={form.active_hours_end}
                  onChange={(e) => setForm(f => ({ ...f, active_hours_end: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>
          )}

          {form.trigger_type === 'keyword' && (
            <div>
              <label className="text-sm font-medium">Keywords (comma-separated)</label>
              <Input
                value={form.trigger_keywords}
                onChange={(e) => setForm(f => ({ ...f, trigger_keywords: e.target.value }))}
                placeholder="help, support, refund"
                className="mt-1"
              />
            </div>
          )}

          <div>
            <label className="text-sm font-medium">Response Message *</label>
            <Textarea
              value={form.response_message}
              onChange={(e) => setForm(f => ({ ...f, response_message: e.target.value }))}
              placeholder="Thank you for your message! We'll get back to you shortly..."
              className="mt-1"
              rows={4}
            />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowAdd(false)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={saveResponse} disabled={saving} className="flex-1 bg-[#2969FF] text-white">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save Auto-Response
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Inbox;
