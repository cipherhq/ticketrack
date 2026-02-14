import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Plus, MessageSquare, Clock, CheckCircle, AlertCircle,
  Loader2, Send, ChevronRight, XCircle
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useOrganizer } from '@/contexts/OrganizerContext'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner';

const categories = [
  { value: 'payment', label: 'Payment Issues', icon: '💳' },
  { value: 'refund', label: 'Refund Help', icon: '↩️' },
  { value: 'technical', label: 'Technical Problems', icon: '🔧' },
  { value: 'account', label: 'Account Issues', icon: '👤' },
  { value: 'event', label: 'Event Questions', icon: '🎫' },
  { value: 'other', label: 'Other', icon: '❓' },
]

const statusConfig = {
  open: { label: 'Open', color: 'bg-blue-100 text-blue-700', icon: AlertCircle },
  in_progress: { label: 'In Progress', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  resolved: { label: 'Resolved', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  closed: { label: 'Closed', color: 'bg-muted text-foreground/80', icon: XCircle },
}

export function OrganizerSupport() {
  const navigate = useNavigate()
  const { organizer } = useOrganizer()
  const { user, profile } = useAuth()
  
  const [view, setView] = useState('list') // 'list', 'create', 'detail'
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [tickets, setTickets] = useState([])
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [replies, setReplies] = useState([])
  const [events, setEvents] = useState([])
  
  // Form state
  const [category, setCategory] = useState('')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [eventId, setEventId] = useState('')
  const [replyMessage, setReplyMessage] = useState('')

  useEffect(() => {
    if (user && organizer) {
      loadTickets()
      loadEvents()
    }
  }, [user, organizer])

  const loadTickets = async () => {
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*, event:events(title)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setTickets(data || [])
    } catch (err) {
      console.error('Error loading tickets:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadEvents = async () => {
    if (!organizer?.id) return
    
    const { data } = await supabase
      .from('events')
      .select('id, title')
      .eq('organizer_id', organizer.id)
      .order('created_at', { ascending: false })
      .limit(50)
    
    setEvents(data || [])
  }

  const loadTicketDetails = async (ticket) => {
    setSelectedTicket(ticket)
    setView('detail')
    
    const { data } = await supabase
      .from('support_ticket_replies')
      .select('*')
      .eq('ticket_id', ticket.id)
      .eq('is_internal', false)
      .order('created_at', { ascending: true })
    
    setReplies(data || [])
  }

  const createTicket = async (e) => {
    e.preventDefault()
    if (!category || !subject || !description) {
      toast.error('Please fill in all required fields')
      return
    }

    setSubmitting(true)
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .insert({
          user_id: user.id,
          user_type: 'organizer',
          user_email: profile?.email || user.email,
          user_name: organizer?.business_name || profile?.full_name || 'Organizer',
          category,
          subject,
          description,
          event_id: eventId || null,
        })
        .select()
        .single()

      if (error) throw error

      // Send notification email to admin
      try {
        await supabase.functions.invoke('send-email', {
          body: {
            to: 'support@ticketrack.com',
            subject: `New Organizer Support Ticket: ${subject}`,
            template: 'new_support_ticket',
            data: {
              ticketNumber: data.ticket_number,
              category,
              subject,
              description,
              userName: organizer?.business_name || 'Organizer',
              userEmail: profile?.email || user.email,
              userType: 'Organizer',
            }
          }
        })
      } catch (emailErr) {
        console.log('Email notification failed:', emailErr)
      }

      toast.success('Support ticket created successfully!')
      setCategory('')
      setSubject('')
      setDescription('')
      setEventId('')
      setView('list')
      loadTickets()
    } catch (err) {
      console.error('Error creating ticket:', err)
      toast.error('Failed to create ticket. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const sendReply = async () => {
    if (!replyMessage.trim()) return

    setSubmitting(true)
    try {
      const { error } = await supabase
        .from('support_ticket_replies')
        .insert({
          ticket_id: selectedTicket.id,
          user_id: user.id,
          user_type: 'organizer',
          user_name: organizer?.business_name || profile?.full_name || 'Organizer',
          message: replyMessage,
        })

      if (error) throw error

      setReplyMessage('')
      loadTicketDetails(selectedTicket)
    } catch (err) {
      console.error('Error sending reply:', err)
      toast.error('Failed to send reply')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" />
      </div>
    )
  }

  // Ticket Detail View
  if (view === 'detail' && selectedTicket) {
    const status = statusConfig[selectedTicket.status]
    const StatusIcon = status.icon

    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => setView('list')}>
          <ChevronRight className="w-4 h-4 mr-2 rotate-180" /> Back to Tickets
        </Button>

        <Card className="rounded-2xl border-border/10">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">{selectedTicket.ticket_number}</p>
                <CardTitle className="text-xl">{selectedTicket.subject}</CardTitle>
              </div>
              <Badge className={status.color}>
                <StatusIcon className="w-3 h-3 mr-1" />
                {status.label}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 text-sm text-muted-foreground mb-4">
              <span>{categories.find(c => c.value === selectedTicket.category)?.label}</span>
              <span>•</span>
              <span>{new Date(selectedTicket.created_at).toLocaleDateString()}</span>
              {selectedTicket.event && (
                <>
                  <span>•</span>
                  <span>Event: {selectedTicket.event.title}</span>
                </>
              )}
            </div>
            <div className="bg-muted rounded-xl p-4">
              <p className="whitespace-pre-wrap">{selectedTicket.description}</p>
            </div>
          </CardContent>
        </Card>

        {/* Replies */}
        <div className="space-y-4">
          {replies.map(reply => (
            <Card key={reply.id} className={`rounded-2xl ${reply.user_type === 'admin' ? 'bg-blue-50 border-blue-200' : 'bg-card border-border/10'}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-medium">
                    {reply.user_type === 'admin' ? '🎧 Support Team' : reply.user_name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(reply.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="whitespace-pre-wrap">{reply.message}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Reply Form */}
        {selectedTicket.status !== 'closed' && selectedTicket.status !== 'resolved' && (
          <Card className="rounded-2xl border-border/10">
            <CardContent className="p-4">
              <Textarea
                value={replyMessage}
                onChange={(e) => setReplyMessage(e.target.value)}
                placeholder="Type your reply..."
                className="min-h-[100px] rounded-xl bg-muted border-0 mb-3"
              />
              <Button 
                onClick={sendReply} 
                disabled={submitting || !replyMessage.trim()}
                className="bg-[#2969FF] hover:bg-[#1a4fd8] rounded-xl"
              >
                {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                Send Reply
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  // Create Ticket View
  if (view === 'create') {
    return (
      <div className="max-w-2xl">
        <Button variant="ghost" onClick={() => setView('list')} className="mb-6">
          <ChevronRight className="w-4 h-4 mr-2 rotate-180" /> Back
        </Button>

        <h1 className="text-2xl font-bold mb-6">Create Support Ticket</h1>

        <form onSubmit={createTicket} className="space-y-6">
          {/* Category */}
          <div className="space-y-2">
            <Label>Category *</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {categories.map(cat => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setCategory(cat.value)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    category === cat.value 
                      ? 'border-[#2969FF] bg-[#2969FF]/5' 
                      : 'border-border/10 hover:border-border/20'
                  }`}
                >
                  <span className="text-2xl mb-2 block">{cat.icon}</span>
                  <span className="text-sm font-medium">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <Label>Subject *</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief summary of your issue"
              className="h-12 rounded-xl bg-card border border-border/20 focus:border-[#2969FF] focus:ring-1 focus:ring-primary"
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Description *</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Please describe your issue in detail..."
              className="min-h-[150px] rounded-xl bg-card border border-border/20 focus:border-[#2969FF] focus:ring-1 focus:ring-primary"
              required
            />
          </div>

          {/* Related Event (optional) */}
          {events.length > 0 && (
            <div className="space-y-2">
              <Label>Related Event (optional)</Label>
              <select
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                className="w-full h-12 px-4 rounded-xl bg-muted border-0"
              >
                <option value="">Select an event...</option>
                {events.map(e => (
                  <option key={e.id} value={e.id}>{e.title}</option>
                ))}
              </select>
            </div>
          )}

          <Button 
            type="submit" 
            disabled={submitting}
            className="w-full h-12 bg-[#2969FF] hover:bg-[#1a4fd8] rounded-xl"
          >
            {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Submit Ticket
          </Button>
        </form>
      </div>
    )
  }

  // Ticket List View
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Support</h1>
          <p className="text-muted-foreground">Get help from our support team</p>
        </div>
        <Button onClick={() => setView('create')} className="bg-[#2969FF] hover:bg-[#1a4fd8] rounded-xl">
          <Plus className="w-4 h-4 mr-2" /> New Ticket
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-border/10">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{tickets.length}</p>
            <p className="text-sm text-muted-foreground">Total Tickets</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/10">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{tickets.filter(t => t.status === 'open').length}</p>
            <p className="text-sm text-muted-foreground">Open</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/10">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-yellow-600">{tickets.filter(t => t.status === 'in_progress').length}</p>
            <p className="text-sm text-muted-foreground">In Progress</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/10">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length}</p>
            <p className="text-sm text-muted-foreground">Resolved</p>
          </CardContent>
        </Card>
      </div>

      {tickets.length === 0 ? (
        <Card className="rounded-2xl border-border/10">
          <CardContent className="p-12 text-center">
            <MessageSquare className="w-12 h-12 text-foreground/20 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Support Tickets</h3>
            <p className="text-muted-foreground mb-6">Need help? Create a support ticket and we'll assist you.</p>
            <Button onClick={() => setView('create')} className="bg-[#2969FF] hover:bg-[#1a4fd8] rounded-xl">
              <Plus className="w-4 h-4 mr-2" /> Create Ticket
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tickets.map(ticket => {
            const status = statusConfig[ticket.status]
            const StatusIcon = status.icon
            const cat = categories.find(c => c.value === ticket.category)

            return (
              <Card 
                key={ticket.id} 
                className="rounded-2xl border-border/10 hover:border-[#2969FF]/30 cursor-pointer transition-all"
                onClick={() => loadTicketDetails(ticket)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm text-muted-foreground">{ticket.ticket_number}</span>
                        <Badge className={status.color}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {status.label}
                        </Badge>
                      </div>
                      <h3 className="font-medium text-foreground mb-1">{ticket.subject}</h3>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{cat?.icon} {cat?.label}</span>
                        <span>•</span>
                        <span>{new Date(ticket.created_at).toLocaleDateString()}</span>
                        {ticket.event && (
                          <>
                            <span>•</span>
                            <span>{ticket.event.title}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
