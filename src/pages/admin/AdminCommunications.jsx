import { useState, useEffect } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import DOMPurify from 'dompurify';
import {
  Mail, Send, Clock, CheckCircle, Users, Loader2,
  Sparkles, Eye, Trash2, Building, UserCheck, Globe
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useAdmin } from '@/contexts/AdminContext';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { toast } from 'sonner';

// ============================================================================
// CONSTANTS
// ============================================================================

const RECIPIENT_TYPES = [
  { id: 'all_users', label: 'All Users', icon: Globe, description: 'Everyone with an account' },
  { id: 'all_organizers', label: 'All Organizers', icon: Building, description: 'All registered organizers' },
  { id: 'all_attendees', label: 'All Attendees', icon: UserCheck, description: 'Everyone who purchased tickets' },
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

export function AdminCommunications() {
  const { logAdminAction } = useAdmin();
  
  const [view, setView] = useState('list');
  const [broadcasts, setBroadcasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [recipientCount, setRecipientCount] = useState(0);
  
  const [form, setForm] = useState({
    recipientType: '',
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
    loadBroadcasts();
  }, []);

  useEffect(() => {
    if (form.recipientType) calculateRecipients();
  }, [form.recipientType]);

  const loadBroadcasts = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('admin_broadcasts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      
      setBroadcasts(data || []);
    } catch (err) {
      console.error('Error loading broadcasts:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateRecipients = async () => {
    let count = 0;
    
    if (form.recipientType === 'all_users') {
      const { count: c } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true });
      count = c || 0;
    } else if (form.recipientType === 'all_organizers') {
      const { count: c } = await supabase
        .from('organizers')
        .select('id', { count: 'exact', head: true });
      count = c || 0;
    } else if (form.recipientType === 'all_attendees') {
      const { count: c } = await supabase
        .from('tickets')
        .select('attendee_email', { count: 'exact', head: true })
        .eq('payment_status', 'completed');
      count = c || 0;
    }
    
    setRecipientCount(count);
  };

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const generateWithAI = async () => {
    if (!aiPrompt.trim()) return;
    
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-compose', {
        body: {
          prompt: aiPrompt,
          context: { organizerName: 'Ticketrack' }
        }
      });
      
      if (error) throw error;
      
      if (data?.subject) setForm(f => ({ ...f, subject: data.subject }));
      if (data?.body) setForm(f => ({ ...f, body: data.body }));
      setAiPrompt('');
    } catch (err) {
      console.error('AI compose error:', err);
      toast.error('Failed to generate content');
    } finally {
      setAiLoading(false);
    }
  };

  const sendBroadcast = async () => {
    if (!form.subject.trim() || !form.body.trim()) {
      toast.error('Please fill in subject and message');
      return;
    }
    if (recipientCount === 0) {
      toast.info('No recipients selected');
      return;
    }

    if (!confirm(`Send this broadcast to ${recipientCount} recipients?`)) return;

    setSending(true);
    try {
      // Fetch recipients
      const recipients = await fetchRecipients();

      // Create broadcast record
      const { data: broadcast, error: broadcastError } = await supabase
        .from('admin_broadcasts')
        .insert({
          subject: form.subject,
          body: form.body,
          recipient_type: form.recipientType,
          total_recipients: recipients.length,
          status: 'sending',
        })
        .select()
        .single();

      if (broadcastError) throw broadcastError;

      // Send emails via edge function
      const { error: sendError } = await supabase.functions.invoke('send-bulk-email', {
        body: {
          campaignId: broadcast.id,
          recipients: recipients.map(r => ({ email: r.email, name: r.name || 'there' })),
          subject: form.subject,
          body: form.body,
          variables: {
            organizer_name: 'Ticketrack',
            organizer_email: 'support@ticketrack.com',
          },
        }
      });

      if (sendError) throw sendError;

      // Update status
      await supabase
        .from('admin_broadcasts')
        .update({ status: 'sent', sent_at: new Date().toISOString(), total_sent: recipients.length })
        .eq('id', broadcast.id);

      // Log admin action
      logAdminAction?.('broadcast_sent', { 
        broadcastId: broadcast.id, 
        recipientType: form.recipientType,
        recipientCount: recipients.length 
      });

      await loadBroadcasts();
      resetForm();
      setView('list');
      toast.success(`Broadcast sent to ${recipients.length} recipients!`);
    } catch (err) {
      console.error('Send error:', err);
      toast.error('Failed to send broadcast: ' + err.message);
    } finally {
      setSending(false);
    }
  };

  const fetchRecipients = async () => {
    let recipients = [];

    if (form.recipientType === 'all_users') {
      const { data } = await supabase
        .from('profiles')
        .select('email, full_name')
        .not('email', 'is', null);
      recipients = (data || []).map(u => ({ email: u.email, name: u.full_name }));
    } else if (form.recipientType === 'all_organizers') {
      const { data } = await supabase
        .from('organizers')
        .select('email, business_name');
      recipients = (data || []).map(o => ({ email: o.email, name: o.business_name }));
    } else if (form.recipientType === 'all_attendees') {
      const { data } = await supabase
        .from('tickets')
        .select('attendee_email, attendee_name')
        .eq('payment_status', 'completed');
      
      // Deduplicate by email
      const seen = new Set();
      recipients = (data || [])
        .filter(t => {
          if (seen.has(t.attendee_email)) return false;
          seen.add(t.attendee_email);
          return true;
        })
        .map(t => ({ email: t.attendee_email, name: t.attendee_name }));
    }

    return recipients.filter(r => r.email);
  };

  const deleteBroadcast = async (id) => {
    if (!confirm('Delete this broadcast record?')) return;
    await supabase.from('admin_broadcasts').delete().eq('id', id);
    loadBroadcasts();
  };

  const resetForm = () => {
    setForm({ recipientType: '', subject: '', body: '', scheduleFor: '' });
    setRecipientCount(0);
  };

  // ============================================================================
  // RENDER: LIST VIEW
  // ============================================================================

  if (view === 'list') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Admin Broadcasts</h1>
            <p className="text-muted-foreground">Send platform-wide announcements</p>
          </div>
          <Button onClick={() => setView('create')} className="bg-[#2969FF] text-white rounded-xl">
            <Mail className="w-4 h-4 mr-2" />
            New Broadcast
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
                <p className="text-2xl font-semibold">{broadcasts.length}</p>
                <p className="text-xs text-muted-foreground">Total Broadcasts</p>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-border/10">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                <Send className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{broadcasts.reduce((sum, b) => sum + (b.total_sent || 0), 0)}</p>
                <p className="text-xs text-muted-foreground">Emails Sent</p>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-border/10">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{broadcasts.filter(b => b.status === 'sent').length}</p>
                <p className="text-xs text-muted-foreground">Sent</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Broadcast List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" />
          </div>
        ) : broadcasts.length === 0 ? (
          <Card className="rounded-2xl border-border/10">
            <CardContent className="py-12 text-center">
              <Mail className="w-12 h-12 text-foreground/20 mx-auto mb-3" />
              <p className="text-muted-foreground mb-4">No broadcasts yet</p>
              <Button onClick={() => setView('create')} className="bg-[#2969FF] text-white rounded-xl">
                Send First Broadcast
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {broadcasts.map(broadcast => (
              <Card key={broadcast.id} className="rounded-2xl border-border/10 hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium truncate">{broadcast.subject}</h3>
                        <Badge variant="secondary" className={
                          broadcast.status === 'sent' ? 'bg-green-100 text-green-700' :
                          'bg-muted text-foreground/80'
                        }>
                          {broadcast.status === 'sent' && <CheckCircle className="w-3 h-3 mr-1" />}
                          {broadcast.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          {broadcast.total_sent || broadcast.total_recipients || 0} recipients
                        </span>
                        <span>{format(new Date(broadcast.created_at), 'MMM d, yyyy')}</span>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => deleteBroadcast(broadcast.id)} className="text-red-500 hover:text-red-600 hover:bg-red-50">
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
  // RENDER: CREATE VIEW
  // ============================================================================

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">New Broadcast</h1>
          <p className="text-muted-foreground">Send a platform-wide announcement</p>
        </div>
        <Button variant="outline" onClick={() => { resetForm(); setView('list'); }} className="rounded-xl">
          Cancel
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <Card className="rounded-2xl border-border/10">
          <CardContent className="p-6 space-y-5">
            {/* Recipients */}
            <div>
              <Label className="mb-3 block">Send to</Label>
              <div className="space-y-2">
                {RECIPIENT_TYPES.map(type => (
                  <button
                    key={type.id}
                    onClick={() => setForm(f => ({ ...f, recipientType: type.id }))}
                    className={`w-full p-3 rounded-xl border-2 text-left transition-all ${
                      form.recipientType === type.id 
                        ? 'border-[#2969FF] bg-[#2969FF]/5' 
                        : 'border-border/10 hover:border-border/20'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <type.icon className={`w-5 h-5 ${form.recipientType === type.id ? 'text-[#2969FF]' : 'text-muted-foreground'}`} />
                      <div>
                        <p className="font-medium text-sm">{type.label}</p>
                        <p className="text-xs text-muted-foreground">{type.description}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {recipientCount > 0 && (
              <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-xl text-blue-700">
                <Users className="w-5 h-5" />
                <span>Will be sent to <strong>{recipientCount.toLocaleString()}</strong> recipients</span>
              </div>
            )}

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
                  placeholder="Describe your announcement..."
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
                placeholder="Enter subject..."
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

            <Button 
              onClick={sendBroadcast} 
              disabled={sending || !form.recipientType || !form.subject.trim() || !form.body.trim() || recipientCount === 0}
              className="w-full bg-[#2969FF] text-white rounded-xl h-12"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              Send Broadcast
            </Button>
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
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(form.body || '<p class="text-muted-foreground">Your message will appear here...</p>', { ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'b', 'i', 'u', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'blockquote', 'span'], ALLOWED_ATTR: ['href', 'target', 'rel', 'class'] }) }}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default AdminCommunications;
