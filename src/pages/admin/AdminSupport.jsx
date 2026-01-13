import { useState, useEffect } from 'react';
import {
  Search,
  MoreVertical,
  Loader2,
  RefreshCw,
  MessageSquare,
  CheckCircle,
  Clock,
  AlertCircle,
  User,
  Building,
  Send,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { useAdmin } from '@/contexts/AdminContext';

export function AdminSupport() {
  const { admin, logAdminAction } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [responseText, setResponseText] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadTickets();
  }, []);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTickets(data || []);
    } catch (error) {
      console.error('Error loading tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateTicketStatus = async (ticketId, status) => {
    setProcessing(true);
    try {
      const updates = { status, updated_at: new Date().toISOString() };
      if (status === 'resolved') {
        updates.resolved_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('support_tickets')
        .update(updates)
        .eq('id', ticketId);

      if (error) throw error;
      await logAdminAction('ticket_status_updated', 'support_ticket', ticketId, { status });
      loadTickets();
    } catch (error) {
      console.error('Error updating ticket:', error);
      alert('Failed to update ticket');
    } finally {
      setProcessing(false);
    }
  };

  const assignToMe = async (ticketId) => {
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('support_tickets')
        .update({ 
          assigned_to: admin.id,
          status: 'in_progress',
          updated_at: new Date().toISOString()
        })
        .eq('id', ticketId);

      if (error) throw error;
      await logAdminAction('ticket_assigned', 'support_ticket', ticketId);
      loadTickets();
    } catch (error) {
      console.error('Error assigning ticket:', error);
      alert('Failed to assign ticket');
    } finally {
      setProcessing(false);
    }
  };

  const openDetailsDialog = (ticket) => {
    setSelectedTicket(ticket);
    setResponseText('');
    setDetailsDialogOpen(true);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount || 0);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'resolved':
        return <Badge className="bg-green-500 text-white rounded-lg">Resolved</Badge>;
      case 'open':
        return <Badge className="bg-yellow-500 text-white rounded-lg">Open</Badge>;
      case 'in_progress':
        return <Badge className="bg-blue-500 text-white rounded-lg">In Progress</Badge>;
      case 'closed':
        return <Badge className="bg-gray-500 text-white rounded-lg">Closed</Badge>;
      default:
        return <Badge className="bg-gray-500 text-white rounded-lg">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 'high':
        return <Badge className="bg-red-100 text-red-700">High</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-100 text-yellow-700">Medium</Badge>;
      case 'low':
        return <Badge className="bg-green-100 text-green-700">Low</Badge>;
      default:
        return <Badge variant="outline">{priority}</Badge>;
    }
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'payment':
        return '💳';
      case 'refund':
        return '💰';
      case 'technical':
        return '🔧';
      case 'account':
        return '👤';
      default:
        return '📩';
    }
  };

  const filteredTickets = tickets.filter((ticket) => {
    const matchesSearch =
      ticket.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.profiles?.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || ticket.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const stats = {
    open: tickets.filter((t) => t.status === 'open').length,
    inProgress: tickets.filter((t) => t.status === 'in_progress').length,
    resolved: tickets.filter((t) => t.status === 'resolved').length,
    highPriority: tickets.filter((t) => t.priority === 'high' && t.status !== 'resolved').length,
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
          <h2 className="text-2xl font-semibold text-[#0F0F0F]">Support Tickets</h2>
          <p className="text-[#0F0F0F]/60 mt-1">Manage customer support requests</p>
        </div>
        <Button variant="outline" size="icon" onClick={loadTickets} className="rounded-xl">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Open Tickets</p>
                <p className="text-2xl font-semibold text-yellow-600">{stats.open}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-200" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#0F0F0F]/60">In Progress</p>
                <p className="text-2xl font-semibold text-blue-600">{stats.inProgress}</p>
              </div>
              <MessageSquare className="w-8 h-8 text-blue-200" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Resolved</p>
                <p className="text-2xl font-semibold text-green-600">{stats.resolved}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-200" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#0F0F0F]/60">High Priority</p>
                <p className="text-2xl font-semibold text-red-600">{stats.highPriority}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-red-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filters */}
      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#0F0F0F]/40" />
              <Input
                placeholder="Search tickets..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white border-[#0F0F0F]/10 rounded-xl"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40 rounded-xl">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-40 rounded-xl">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tickets List */}
      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardHeader>
          <CardTitle className="text-[#0F0F0F]">Tickets ({filteredTickets.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredTickets.length === 0 ? (
            <p className="text-center text-[#0F0F0F]/60 py-8">No tickets found</p>
          ) : (
            <div className="space-y-3">
              {filteredTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="p-4 rounded-xl bg-[#F4F6FA] hover:bg-[#F4F6FA]/80 cursor-pointer"
                  onClick={() => openDetailsDialog(ticket)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{getCategoryIcon(ticket.category)}</span>
                      <div>
                        <h4 className="text-[#0F0F0F] font-medium">{ticket.subject}</h4>
                        <p className="text-sm text-[#0F0F0F]/60">
                          {ticket.profiles?.full_name || ticket.organizers?.business_name || 'Unknown'} • {ticket.profiles?.email || ticket.organizers?.email || 'N/A'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getPriorityBadge(ticket.priority)}
                      {getStatusBadge(ticket.status)}
                    </div>
                  </div>
                  <p className="text-sm text-[#0F0F0F]/70 line-clamp-2 mb-2">{ticket.description}</p>
                  <div className="flex items-center justify-between text-sm text-[#0F0F0F]/60">
                    <span>{new Date(ticket.created_at).toLocaleString()}</span>
                    <div className="flex items-center gap-2">
                      {ticket.status === 'open' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            assignToMe(ticket.id);
                          }}
                          disabled={processing}
                          className="rounded-lg text-xs"
                        >
                          Assign to me
                        </Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="rounded-lg h-8 w-8">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl">
                          {ticket.status !== 'resolved' && (
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              updateTicketStatus(ticket.id, 'resolved');
                            }}>
                              <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                              Mark Resolved
                            </DropdownMenuItem>
                          )}
                          {ticket.status !== 'in_progress' && ticket.status !== 'resolved' && (
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              updateTicketStatus(ticket.id, 'in_progress');
                            }}>
                              <MessageSquare className="w-4 h-4 mr-2 text-blue-500" />
                              Mark In Progress
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            updateTicketStatus(ticket.id, 'closed');
                          }}>
                            Close Ticket
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-2xl">{getCategoryIcon(selectedTicket?.category)}</span>
              {selectedTicket?.subject}
            </DialogTitle>
          </DialogHeader>
          {selectedTicket && (
            <div className="space-y-4 py-4">
              {/* Ticket Info */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getPriorityBadge(selectedTicket.priority)}
                  {getStatusBadge(selectedTicket.status)}
                  <Badge variant="outline">{selectedTicket.category}</Badge>
                </div>
                <span className="text-sm text-[#0F0F0F]/60">
                  {new Date(selectedTicket.created_at).toLocaleString()}
                </span>
              </div>

              {/* Customer Info */}
              <div className="p-4 bg-[#F4F6FA] rounded-xl">
                <div className="flex items-center gap-3 mb-2">
                  {selectedTicket.organizer_id ? (
                    <Building className="w-5 h-5 text-[#0F0F0F]/60" />
                  ) : (
                    <User className="w-5 h-5 text-[#0F0F0F]/60" />
                  )}
                  <div>
                    <p className="text-[#0F0F0F] font-medium">
                      {selectedTicket.profiles?.full_name || selectedTicket.organizers?.business_name || 'Unknown'}
                    </p>
                    <p className="text-sm text-[#0F0F0F]/60">
                      {selectedTicket.profiles?.email || selectedTicket.organizers?.email || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <Label className="text-[#0F0F0F]/60">Description</Label>
                <div className="p-4 bg-white border border-[#0F0F0F]/10 rounded-xl mt-2">
                  <p className="text-[#0F0F0F] whitespace-pre-wrap">{selectedTicket.description}</p>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex flex-wrap gap-2">
                {selectedTicket.status === 'open' && (
                  <Button
                    onClick={() => assignToMe(selectedTicket.id)}
                    disabled={processing}
                    className="rounded-xl bg-[#2969FF] hover:bg-[#2969FF]/90"
                  >
                    Assign to me
                  </Button>
                )}
                {selectedTicket.status !== 'resolved' && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      updateTicketStatus(selectedTicket.id, 'resolved');
                      setDetailsDialogOpen(false);
                    }}
                    disabled={processing}
                    className="rounded-xl"
                  >
                    <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                    Mark Resolved
                  </Button>
                )}
              </div>

              {/* Response Section */}
              <div className="space-y-2">
                <Label>Quick Response</Label>
                <Textarea
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  placeholder="Type your response to send via email..."
                  className="rounded-xl min-h-[100px]"
                />
                <Button
                  disabled={!responseText.trim()}
                  className="rounded-xl bg-[#2969FF] hover:bg-[#2969FF]/90"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Send Response
                </Button>
                <p className="text-xs text-[#0F0F0F]/60">
                  Note: Email sending requires edge function setup
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
