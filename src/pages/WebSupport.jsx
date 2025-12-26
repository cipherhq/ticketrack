import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  ArrowLeft, Plus, MessageSquare, Clock, CheckCircle, AlertCircle,
  Loader2, Send, ChevronRight, HelpCircle, XCircle
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

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
  closed: { label: 'Closed', color: 'bg-gray-100 text-gray-700', icon: XCircle },
}

export function WebSupport() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  
  const [view, setView] = useState('list') // 'list', 'create', 'detail'
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [tickets, setTickets] = useState([])
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [replies, setReplies] = useState([])
  const [events, setEvents] = useState([])
  const [orders, setOrders] = useState([])
  
  // Form state
  const [category, setCategory] = useState('')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [eventId, setEventId] = useState('')
  const [orderId, setOrderId] = useState('')
  const [replyMessage, setReplyMessage] = useState('')

  useEffect(() => {
    if (user) {
      loadTickets()
      loadUserContext()
    } else {
      setLoading(false)
    }
  }, [user])

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

  const loadUserContext = async () => {
    // Load user's events (tickets they bought)
    const { data: ticketData } = await supabase
      .from('tickets')
      .select('event_id, event:events(id, title)')
      .eq('user_id', user.id)
      .eq('payment_status', 'completed')
    
    const uniqueEvents = []
    const seenIds = new Set()
    ticketData?.forEach(t => {
      if (t.event && !seenIds.has(t.event.id)) {
        seenIds.add(t.event.id)
        uniqueEvents.push(t.event)
      }
    })
    setEvents(uniqueEvents)

    // Load user's orders
    const { data: orderData } = await supabase
      .from('orders')
      .select('id, event:events(title), created_at, total_amount, currency')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(20)
    
    setOrders(orderData || [])
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
      alert('Please fill in all required fields')
      return
    }

    setSubmitting(true)
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .insert({
          user_id: user.id,
          user_type: 'attendee',
          user_email: profile?.email || user.email,
          user_name: profile?.full_name || 'Attendee',
          category,
          subject,
          description,
          event_id: eventId || null,
          order_id: orderId || null,
        })
        .select()
        .single()

      if (error) throw error

      // Send notification email to admin (via edge function)
      try {
        await supabase.functions.invoke('send-email', {
          body: {
            to: 'support@ticketrack.com', // Admin email
            subject: `New Support Ticket: ${subject}`,
            template: 'new_support_ticket',
            data: {
              ticketNumber: data.ticket_number,
              category,
              subject,
              description,
              userName: profile?.full_name || 'Attendee',
              userEmail: profile?.email || user.email,
            }
          }
        })
      } catch (emailErr) {
        console.log('Email notification failed:', emailErr)
      }

      alert('Support ticket created successfully!')
      setCategory('')
      setSubject('')
      setDescription('')
      setEventId('')
      setOrderId('')
      setView('list')
      loadTickets()
    } catch (err) {
      console.error('Error creating ticket:', err)
      alert('Failed to create ticket. Please try again.')
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
          user_type: 'attendee',
          user_name: profile?.full_name || 'Attendee',
          message: replyMessage,
        })

      if (error) throw error

      // Reload replies
      setReplyMessage('')
      loadTicketDetails(selectedTicket)
    } catch (err) {
      console.error('Error sending reply:', err)
      alert('Failed to send reply')
    } finally {
      setSubmitting(false)
    }
  }

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <HelpCircle className="w-16 h-16 text-[#2969FF] mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-4">Support Center</h1>
        <p className="text-[#0F0F0F]/60 mb-6">Please log in to create and view support tickets</p>
        <Button onClick={() => navigate('/auth')} className="bg-[#2969FF] hover:bg-[#1a4fd8] rounded-xl">
          Log In
        </Button>
      </div>
    )
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
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Button variant="ghost" onClick={() => setView('list')} className="mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Tickets
        </Button>

        <Card className="rounded-2xl border-[#0F0F0F]/10 mb-6">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-[#0F0F0F]/60 mb-1">{selectedTicket.ticket_number}</p>
                <CardTitle className="text-xl">{selectedTicket.subject}</CardTitle>
              </div>
              <Badge className={status.color}>
                <StatusIcon className="w-3 h-3 mr-1" />
                {status.label}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 text-sm text-[#0F0F0F]/60 mb-4">
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
            <div className="bg-[#F4F6FA] rounded-xl p-4">
              <p className="whitespace-pre-wrap">{selectedTicket.description}</p>
            </div>
          </CardContent>
        </Card>

        {/* Replies */}
        <div className="space-y-4 mb-6">
          {replies.map(reply => (
            <Card key={reply.id} className={`rounded-2xl ${reply.user_type === 'admin' ? 'bg-blue-50 border-blue-200' : 'bg-white border-[#0F0F0F]/10'}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-medium">
                    {reply.user_type === 'admin' ? '🎧 Support Team' : reply.user_name}
                  </span>
                  <span className="text-xs text-[#0F0F0F]/40">
                    {new Date(reply.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="whitespace-pre-wrap">{reply.message}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Reply Form - only if ticket is not closed */}
        {selectedTicket.status !== 'closed' && selectedTicket.status !== 'resolved' && (
          <Card className="rounded-2xl border-[#0F0F0F]/10">
            <CardContent className="p-4">
              <Textarea
                value={replyMessage}
                onChange={(e) => setReplyMessage(e.target.value)}
                placeholder="Type your reply..."
                className="min-h-[100px] rounded-xl bg-[#F4F6FA] border-0 mb-3"
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
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Button variant="ghost" onClick={() => setView('list')} className="mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
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
                      : 'border-[#0F0F0F]/10 hover:border-[#0F0F0F]/20'
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
              className="h-12 rounded-xl bg-[#F4F6FA] border-0"
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
              className="min-h-[150px] rounded-xl bg-[#F4F6FA] border-0"
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
                className="w-full h-12 px-4 rounded-xl bg-[#F4F6FA] border-0"
              >
                <option value="">Select an event...</option>
                {events.map(e => (
                  <option key={e.id} value={e.id}>{e.title}</option>
                ))}
              </select>
            </div>
          )}

          {/* Related Order (optional) */}
          {orders.length > 0 && (
            <div className="space-y-2">
              <Label>Related Order (optional)</Label>
              <select
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                className="w-full h-12 px-4 rounded-xl bg-[#F4F6FA] border-0"
              >
                <option value="">Select an order...</option>
                {orders.map(o => (
                  <option key={o.id} value={o.id}>
                    {o.event?.title} - {new Date(o.created_at).toLocaleDateString()} - {o.currency} {o.total_amount}
                  </option>
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
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#0F0F0F]">Support Tickets</h1>
          <p className="text-[#0F0F0F]/60">Get help with your orders and account</p>
        </div>
        <Button onClick={() => setView('create')} className="bg-[#2969FF] hover:bg-[#1a4fd8] rounded-xl">
          <Plus className="w-4 h-4 mr-2" /> New Ticket
        </Button>
      </div>

      {tickets.length === 0 ? (
        <Card className="rounded-2xl border-[#0F0F0F]/10">
          <CardContent className="p-12 text-center">
            <MessageSquare className="w-12 h-12 text-[#0F0F0F]/20 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Support Tickets</h3>
            <p className="text-[#0F0F0F]/60 mb-6">Need help? Create a support ticket and we'll get back to you.</p>
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
                className="rounded-2xl border-[#0F0F0F]/10 hover:border-[#2969FF]/30 cursor-pointer transition-all"
                onClick={() => loadTicketDetails(ticket)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm text-[#0F0F0F]/60">{ticket.ticket_number}</span>
                        <Badge className={status.color}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {status.label}
                        </Badge>
                      </div>
                      <h3 className="font-medium text-[#0F0F0F] mb-1">{ticket.subject}</h3>
                      <div className="flex items-center gap-2 text-sm text-[#0F0F0F]/60">
                        <span>{cat?.icon} {cat?.label}</span>
                        <span>•</span>
                        <span>{new Date(ticket.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-[#0F0F0F]/40" />
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Help Link */}
      <div className="mt-8 text-center">
        <p className="text-[#0F0F0F]/60">
          Looking for quick answers? Check our{' '}
          <button onClick={() => navigate('/help')} className="text-[#2969FF] hover:underline">
            Help Center & FAQs
          </button>
        </p>
      </div>
    </div>
  )
}
