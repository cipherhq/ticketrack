import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { usePromoter } from '@/contexts/PromoterContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Loader2, Send, MessageSquare, Plus, ArrowLeft, Clock, CheckCircle, AlertCircle } from 'lucide-react'

export default function PromoterSupport() {
  const { user } = useAuth()
  const { promoter } = usePromoter()
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [view, setView] = useState('list') // 'list', 'new', 'detail'
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [replies, setReplies] = useState([])
  const [replyMessage, setReplyMessage] = useState('')

  // New ticket form
  const [category, setCategory] = useState('')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')

  const categories = [
    { value: 'payment', label: 'Payment & Commissions' },
    { value: 'technical', label: 'Technical Issue' },
    { value: 'account', label: 'Account & Profile' },
    { value: 'promotion', label: 'Promotion & Marketing' },
    { value: 'other', label: 'Other' },
  ]

  useEffect(() => {
    if (user) loadTickets()
  }, [user])

  const loadTickets = async () => {
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('user_id', user.id)
        .eq('user_type', 'promoter')
        .order('created_at', { ascending: false })

      if (error) throw error
      setTickets(data || [])
    } catch (err) {
      console.error('Error loading tickets:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadReplies = async (ticketId) => {
    try {
      const { data, error } = await supabase
        .from('support_ticket_replies')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true })

      if (error) throw error
      setReplies(data || [])
    } catch (err) {
      console.error('Error loading replies:', err)
    }
  }

  const handleSubmitTicket = async (e) => {
    e.preventDefault()
    if (!category || !subject || !description) {
      toast.error('Please fill in all fields')
      return
    }

    setSubmitting(true)
    console.log("Creating ticket with user:", user?.id, "promoter:", promoter)
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .insert({
          user_id: user.id,
          user_type: 'promoter',
          user_email: promoter?.email || user.email,
          user_name: promoter?.full_name || 'Promoter',
          category,
          subject,
          description,
        })
        .select()
        .single()

      if (error) throw error

      toast.success('Support ticket created successfully!')
      setCategory('')
      setSubject('')
      setDescription('')
      setView('list')
      loadTickets()
    } catch (err) {
      console.error('Error creating ticket:', err.message, err.code, err.details)
      toast.error('Failed to create ticket. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSendReply = async () => {
    if (!replyMessage.trim() || !selectedTicket) return

    setSubmitting(true)
    console.log("Creating ticket with user:", user?.id, "promoter:", promoter)
    try {
      const { error } = await supabase
        .from('support_ticket_replies')
        .insert({
          ticket_id: selectedTicket.id,
          user_id: user.id,
          user_type: 'promoter',
          user_name: promoter?.full_name || 'Promoter',
          message: replyMessage,
        })

      if (error) throw error

      // Update ticket status if it was resolved
      if (selectedTicket.status === 'resolved') {
        await supabase
          .from('support_tickets')
          .update({ status: 'open' })
          .eq('id', selectedTicket.id)
      }

      setReplyMessage('')
      loadReplies(selectedTicket.id)
      loadTickets()
    } catch (err) {
      console.error('Error sending reply:', err)
      toast.error('Failed to send reply')
    } finally {
      setSubmitting(false)
    }
  }

  const viewTicketDetail = (ticket) => {
    setSelectedTicket(ticket)
    setView('detail')
    loadReplies(ticket.id)
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'open':
        return <Badge className="bg-blue-100 text-blue-800"><Clock className="w-3 h-3 mr-1" />Open</Badge>
      case 'in_progress':
        return <Badge className="bg-yellow-100 text-yellow-800"><AlertCircle className="w-3 h-3 mr-1" />In Progress</Badge>
      case 'resolved':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Resolved</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" />
      </div>
    )
  }

  // New Ticket Form
  if (view === 'new') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => setView('list')}>
            <ArrowLeft className="w-4 h-4 mr-2" />Back
          </Button>
          <h1 className="text-2xl font-bold">New Support Ticket</h1>
        </div>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmitTicket} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full p-3 border rounded-lg"
                  required
                >
                  <option value="">Select a category</option>
                  {categories.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Subject</label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Brief description of your issue"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Please provide as much detail as possible..."
                  rows={6}
                  required
                />
              </div>

              <Button type="submit" disabled={submitting} className="w-full bg-[#2969FF]">
                {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                Submit Ticket
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Ticket Detail View
  if (view === 'detail' && selectedTicket) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => setView('list')}>
            <ArrowLeft className="w-4 h-4 mr-2" />Back
          </Button>
          <h1 className="text-2xl font-bold">{selectedTicket.subject}</h1>
          {getStatusBadge(selectedTicket.status)}
        </div>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-muted-foreground">
                  {categories.find(c => c.value === selectedTicket.category)?.label || selectedTicket.category}
                </p>
                <p className="text-sm text-muted-foreground">
                  Created: {new Date(selectedTicket.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="bg-background p-4 rounded-lg mb-6">
              <p className="whitespace-pre-wrap">{selectedTicket.description}</p>
            </div>

            {/* Replies */}
            <div className="space-y-4 mb-6">
              <h3 className="font-semibold">Conversation</h3>
              {replies.length === 0 ? (
                <p className="text-muted-foreground text-sm">No replies yet. Our team will respond soon.</p>
              ) : (
                replies.map(reply => (
                  <div
                    key={reply.id}
                    className={`p-4 rounded-lg ${
                      reply.user_type === 'admin' ? 'bg-blue-50 ml-4' : 'bg-background mr-4'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-medium text-sm">
                        {reply.user_type === 'admin' ? '🎧 Support Team' : '👤 You'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(reply.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{reply.message}</p>
                  </div>
                ))
              )}
            </div>

            {/* Reply Input */}
            {selectedTicket.status !== 'resolved' && (
              <div className="flex gap-2">
                <Textarea
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  placeholder="Type your reply..."
                  rows={3}
                  className="flex-1"
                />
                <Button
                  onClick={handleSendReply}
                  disabled={submitting || !replyMessage.trim()}
                  className="bg-[#2969FF]"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // Ticket List View
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Support</h1>
          <p className="text-muted-foreground">Get help from our team</p>
        </div>
        <Button onClick={() => setView('new')} className="bg-[#2969FF]">
          <Plus className="w-4 h-4 mr-2" />New Ticket
        </Button>
      </div>

      {tickets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No support tickets yet</h3>
            <p className="text-muted-foreground mb-4">Need help? Create a support ticket and our team will assist you.</p>
            <Button onClick={() => setView('new')} className="bg-[#2969FF]">
              <Plus className="w-4 h-4 mr-2" />Create Ticket
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {tickets.map(ticket => (
            <Card
              key={ticket.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => viewTicketDetail(ticket)}
            >
              <CardContent className="py-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium">{ticket.subject}</h3>
                      {getStatusBadge(ticket.status)}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-1">{ticket.description}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {categories.find(c => c.value === ticket.category)?.label} • {new Date(ticket.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
