import { useState, useEffect } from 'react'
import { 
  MessageSquare, Clock, CheckCircle, AlertCircle, Search,
  Loader2, Send, ChevronRight, XCircle, User,
  Building, Mail, Volume2, Users2, Shield, RefreshCw
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { useAdmin } from '@/contexts/AdminContext'

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

const priorityConfig = {
  low: { label: 'Low', color: 'bg-muted text-foreground/80' },
  medium: { label: 'Medium', color: 'bg-blue-100 text-blue-700' },
  high: { label: 'High', color: 'bg-orange-100 text-orange-700' },
  urgent: { label: 'Urgent', color: 'bg-red-100 text-red-700' },
}

// User type configuration for badges and display
const userTypeConfig = {
  attendee: { 
    label: 'Attendee', 
    icon: '👤', 
    color: 'bg-muted text-foreground/80',
    Icon: User 
  },
  organizer: { 
    label: 'Organizer', 
    icon: '🏢', 
    color: 'bg-blue-100 text-blue-700',
    Icon: Building 
  },
  promoter: { 
    label: 'Promoter', 
    icon: '📣', 
    color: 'bg-green-100 text-green-700',
    Icon: Volume2 
  },
  affiliate: { 
    label: 'Affiliate', 
    icon: '🤝', 
    color: 'bg-purple-100 text-purple-700',
    Icon: Users2 
  },
  admin: { 
    label: 'Admin', 
    icon: '🛡️', 
    color: 'bg-slate-100 text-slate-700',
    Icon: Shield 
  },
}

// Helper function to get user type display info
const getUserTypeInfo = (userType) => {
  return userTypeConfig[userType] || userTypeConfig.attendee
}

export function AdminSupport() {
  const { admin, logAdminAction } = useAdmin()
  
  const [view, setView] = useState('list') // 'list', 'detail'
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [tickets, setTickets] = useState([])
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [replies, setReplies] = useState([])
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [userTypeFilter, setUserTypeFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  
  // Reply form
  const [replyMessage, setReplyMessage] = useState('')
  const [isInternal, setIsInternal] = useState(false)

  useEffect(() => {
    loadTickets()
  }, [statusFilter, priorityFilter, categoryFilter, userTypeFilter])

  const loadTickets = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('support_tickets')
        .select('*, event:events(title)')
        .order('created_at', { ascending: false })

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }
      if (priorityFilter !== 'all') {
        query = query.eq('priority', priorityFilter)
      }
      if (categoryFilter !== 'all') {
        query = query.eq('category', categoryFilter)
      }
      if (userTypeFilter !== 'all') {
        query = query.eq('user_type', userTypeFilter)
      }

      const { data, error } = await query

      if (error) throw error
      setTickets(data || [])
    } catch (err) {
      console.error('Error loading tickets:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadTicketDetails = async (ticket) => {
    setSelectedTicket(ticket)
    setView('detail')
    
    const { data } = await supabase
      .from('support_ticket_replies')
      .select('*')
      .eq('ticket_id', ticket.id)
      .order('created_at', { ascending: true })
    
    setReplies(data || [])
  }

  const updateTicketStatus = async (newStatus) => {
    try {
      const updates = { 
        status: newStatus,
        updated_at: new Date().toISOString()
      }
      if (newStatus === 'resolved' || newStatus === 'closed') {
        updates.resolved_at = new Date().toISOString()
        updates.resolved_by = admin?.id
      }

      const { error } = await supabase
        .from('support_tickets')
        .update(updates)
        .eq('id', selectedTicket.id)

      if (error) throw error

      // Log admin action for audit trail
      await logAdminAction('ticket_status_updated', 'support_ticket', selectedTicket.id, { 
        old_status: selectedTicket.status,
        new_status: newStatus 
      })

      // Notify user via email
      if (newStatus === 'resolved') {
        try {
          await supabase.functions.invoke('send-email', {
            body: {
              to: selectedTicket.user_email,
              subject: `Your support ticket has been resolved - ${selectedTicket.ticket_number}`,
              type: 'support_ticket_resolved',
              data: {
                ticketId: selectedTicket.ticket_number, userName: selectedTicket.user_name || 'Customer',
                subject: selectedTicket.subject,
              }
            }
          })
        } catch (emailErr) {
          console.log('Email notification failed:', emailErr)
        }
      }

      setSelectedTicket({ ...selectedTicket, status: newStatus })
      loadTickets()
    } catch (err) {
      console.error('Error updating status:', err)
      alert('Failed to update status')
    }
  }

  const updateTicketPriority = async (newPriority) => {
    try {
      const { error } = await supabase
        .from('support_tickets')
        .update({ 
          priority: newPriority,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedTicket.id)

      if (error) throw error

      // Log admin action for audit trail
      await logAdminAction('ticket_priority_updated', 'support_ticket', selectedTicket.id, { 
        old_priority: selectedTicket.priority,
        new_priority: newPriority 
      })

      setSelectedTicket({ ...selectedTicket, priority: newPriority })
      loadTickets()
    } catch (err) {
      console.error('Error updating priority:', err)
      alert('Failed to update priority')
    }
  }

  const assignToMe = async () => {
    try {
      const { error } = await supabase
        .from('support_tickets')
        .update({ 
          assigned_to: admin?.id,
          status: 'in_progress',
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedTicket.id)

      if (error) throw error

      await logAdminAction('ticket_assigned', 'support_ticket', selectedTicket.id)

      setSelectedTicket({ ...selectedTicket, assigned_to: admin?.id, status: 'in_progress' })
      loadTickets()
    } catch (err) {
      console.error('Error assigning ticket:', err)
      alert('Failed to assign ticket')
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
          user_id: admin?.id,
          user_type: 'admin',
          user_name: admin?.full_name || 'Support Team',
          message: replyMessage,
          is_internal: isInternal,
        })

      if (error) throw error

      // Log admin action
      await logAdminAction('ticket_reply_sent', 'support_ticket', selectedTicket.id, { 
        is_internal: isInternal 
      })

      // Auto-update status to in_progress if it was open
      if (selectedTicket.status === 'open' && !isInternal) {
        await supabase
          .from('support_tickets')
          .update({ 
            status: 'in_progress',
            updated_at: new Date().toISOString()
          })
          .eq('id', selectedTicket.id)
        setSelectedTicket({ ...selectedTicket, status: 'in_progress' })
      }

      // Send email notification to user (only if not internal)
      if (!isInternal) {
        try {
          await supabase.functions.invoke('send-email', {
            body: {
              to: selectedTicket.user_email,
              subject: `New reply on your support ticket - ${selectedTicket.ticket_number}`,
              type: 'support_ticket_reply',
              data: {
                ticketId: selectedTicket.ticket_number, userName: selectedTicket.user_name || 'Customer',
                subject: selectedTicket.subject,
                reply: replyMessage,
              }
            }
          })
        } catch (emailErr) {
          console.log('Email notification failed:', emailErr)
        }
      }

      setReplyMessage('')
      setIsInternal(false)
      loadTicketDetails(selectedTicket)
      loadTickets()
    } catch (err) {
      console.error('Error sending reply:', err)
      alert('Failed to send reply')
    } finally {
      setSubmitting(false)
    }
  }

  const filteredTickets = tickets.filter(t => 
    searchQuery === '' || 
    t.ticket_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.user_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.user_name?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Stats
  const stats = {
    total: tickets.length,
    open: tickets.filter(t => t.status === 'open').length,
    inProgress: tickets.filter(t => t.status === 'in_progress').length,
    resolved: tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length,
    urgent: tickets.filter(t => t.priority === 'urgent' && t.status !== 'resolved' && t.status !== 'closed').length,
  }

  if (loading && tickets.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" />
      </div>
    )
  }

  // Ticket Detail View
  if (view === 'detail' && selectedTicket) {
    const status = statusConfig[selectedTicket.status] || statusConfig.open
    const priority = priorityConfig[selectedTicket.priority] || priorityConfig.medium
    const StatusIcon = status.icon
    const cat = categories.find(c => c.value === selectedTicket.category)
    const userTypeInfo = getUserTypeInfo(selectedTicket.user_type)
    const UserTypeIcon = userTypeInfo.Icon

    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => setView('list')}>
          <ChevronRight className="w-4 h-4 mr-2 rotate-180" /> Back to Tickets
        </Button>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="md:col-span-2 space-y-6">
            <Card className="rounded-2xl border-border/10">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">{selectedTicket.ticket_number}</p>
                    <CardTitle className="text-xl">{selectedTicket.subject}</CardTitle>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Badge className={priority.color}>{priority.label}</Badge>
                    <Badge className={status.color}>
                      <StatusIcon className="w-3 h-3 mr-1" />
                      {status.label}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="bg-muted rounded-xl p-4 mb-4">
                  <p className="whitespace-pre-wrap">{selectedTicket.description}</p>
                </div>
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <span>{cat?.icon} {cat?.label}</span>
                  <span>•</span>
                  <span>{new Date(selectedTicket.created_at).toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>

            {/* Replies */}
            <div className="space-y-4">
              <h3 className="font-semibold">Conversation</h3>
              {replies.length === 0 ? (
                <p className="text-muted-foreground text-sm">No replies yet</p>
              ) : (
                replies.map(reply => {
                  const replyUserType = getUserTypeInfo(reply.user_type)
                  return (
                    <Card 
                      key={reply.id} 
                      className={`rounded-2xl ${
                        reply.is_internal 
                          ? 'bg-yellow-50 border-yellow-200' 
                          : reply.user_type === 'admin' 
                            ? 'bg-blue-50 border-blue-200' 
                            : 'bg-card border-border/10'
                      }`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-medium">
                            {replyUserType.icon} {reply.user_name}
                          </span>
                          <Badge className={`${replyUserType.color} text-xs`}>
                            {replyUserType.label}
                          </Badge>
                          {reply.is_internal && (
                            <Badge className="bg-yellow-200 text-yellow-800 text-xs">Internal Note</Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {new Date(reply.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap">{reply.message}</p>
                      </CardContent>
                    </Card>
                  )
                })
              )}
            </div>

            {/* Reply Form */}
            <Card className="rounded-2xl border-border/10">
              <CardContent className="p-4 space-y-3">
                <Textarea
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  placeholder="Type your reply..."
                  className="min-h-[100px] rounded-xl bg-muted border-0"
                />
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={isInternal}
                      onChange={(e) => setIsInternal(e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-muted-foreground">Internal note (not visible to user)</span>
                  </label>
                  <Button 
                    onClick={sendReply} 
                    disabled={submitting || !replyMessage.trim()}
                    className="bg-[#2969FF] hover:bg-[#1a4fd8] rounded-xl"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                    {isInternal ? 'Add Note' : 'Send Reply'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* User Info */}
            <Card className="rounded-2xl border-border/10">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <UserTypeIcon className="w-5 h-5" />
                  <span>{userTypeInfo.label}</span>
                  <Badge className={`${userTypeInfo.color} text-xs ml-auto`}>
                    {userTypeInfo.icon}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-medium">{selectedTicket.user_name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <a href={`mailto:${selectedTicket.user_email}`} className="font-medium text-[#2969FF] hover:underline break-all">
                    {selectedTicket.user_email}
                  </a>
                </div>
                {selectedTicket.event && (
                  <div>
                    <p className="text-sm text-muted-foreground">Related Event</p>
                    <p className="font-medium">{selectedTicket.event.title}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Actions */}
            <Card className="rounded-2xl border-border/10">
              <CardHeader>
                <CardTitle className="text-lg">Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <select
                    value={selectedTicket.status}
                    onChange={(e) => updateTicketStatus(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-muted border-0"
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <select
                    value={selectedTicket.priority}
                    onChange={(e) => updateTicketPriority(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-muted border-0"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="rounded-2xl border-border/10">
              <CardContent className="p-4 space-y-2">
                {!selectedTicket.assigned_to && (
                  <Button 
                    variant="outline" 
                    className="w-full rounded-xl justify-start"
                    onClick={assignToMe}
                  >
                    <User className="w-4 h-4 mr-2" />
                    Assign to Me
                  </Button>
                )}
                <Button 
                  variant="outline" 
                  className="w-full rounded-xl justify-start"
                  onClick={() => window.open(`mailto:${selectedTicket.user_email}`, '_blank')}
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Email User
                </Button>
                {selectedTicket.status !== 'resolved' && (
                  <Button 
                    className="w-full rounded-xl justify-start bg-green-600 hover:bg-green-700"
                    onClick={() => updateTicketStatus('resolved')}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Mark Resolved
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  // Ticket List View
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Support Tickets</h1>
          <p className="text-muted-foreground">Manage customer support requests</p>
        </div>
        <Button variant="outline" size="icon" onClick={loadTickets} className="rounded-xl">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="rounded-2xl border-border/10">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{stats.total}</p>
            <p className="text-sm text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/10">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{stats.open}</p>
            <p className="text-sm text-muted-foreground">Open</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/10">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-yellow-600">{stats.inProgress}</p>
            <p className="text-sm text-muted-foreground">In Progress</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/10">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{stats.resolved}</p>
            <p className="text-sm text-muted-foreground">Resolved</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/10">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{stats.urgent}</p>
            <p className="text-sm text-muted-foreground">Urgent</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="rounded-2xl border-border/10">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search tickets..."
                  className="pl-10 h-10 rounded-xl bg-muted border-0"
                />
              </div>
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 px-3 rounded-xl bg-muted border-0"
            >
              <option value="all">All Status</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="h-10 px-3 rounded-xl bg-muted border-0"
            >
              <option value="all">All Priority</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-10 px-3 rounded-xl bg-muted border-0"
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
            <select
              value={userTypeFilter}
              onChange={(e) => setUserTypeFilter(e.target.value)}
              className="h-10 px-3 rounded-xl bg-muted border-0"
            >
              <option value="all">All User Types</option>
              <option value="attendee">👤 Attendee</option>
              <option value="organizer">🏢 Organizer</option>
              <option value="promoter">📣 Promoter</option>
              <option value="affiliate">🤝 Affiliate</option>
              <option value="admin">🛡️ Admin</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Ticket List */}
      {filteredTickets.length === 0 ? (
        <Card className="rounded-2xl border-border/10">
          <CardContent className="p-12 text-center">
            <MessageSquare className="w-12 h-12 text-foreground/20 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Tickets Found</h3>
            <p className="text-muted-foreground">No support tickets match your filters.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredTickets.map(ticket => {
            const status = statusConfig[ticket.status] || statusConfig.open
            const priority = priorityConfig[ticket.priority] || priorityConfig.medium
            const StatusIcon = status.icon
            const cat = categories.find(c => c.value === ticket.category)
            const userTypeInfo = getUserTypeInfo(ticket.user_type)

            return (
              <Card 
                key={ticket.id} 
                className={`rounded-2xl border-border/10 hover:border-[#2969FF]/30 cursor-pointer transition-all ${
                  ticket.priority === 'urgent' ? 'border-l-4 border-l-red-500' : ''
                }`}
                onClick={() => loadTicketDetails(ticket)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-sm text-muted-foreground">{ticket.ticket_number}</span>
                        <Badge className={status.color}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {status.label}
                        </Badge>
                        <Badge className={priority.color}>{priority.label}</Badge>
                        <Badge className={`${userTypeInfo.color} text-xs`}>
                          {userTypeInfo.icon} {userTypeInfo.label}
                        </Badge>
                      </div>
                      <h3 className="font-medium text-foreground mb-1">{ticket.subject}</h3>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                        <span>{cat?.icon} {cat?.label}</span>
                        <span>•</span>
                        <span>{ticket.user_name || ticket.user_email}</span>
                        <span>•</span>
                        <span>{new Date(ticket.created_at).toLocaleDateString()}</span>
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
