import { useState, useEffect } from 'react';
import { 
  Search, Users, Clock, CheckCircle, XCircle, Mail, 
  Loader2, RefreshCw, Bell, ChevronDown, Calendar
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { notifyNextInWaitlist } from '@/services/waitlist';
import { toast } from 'sonner';

export function AdminWaitlist() {
  const [loading, setLoading] = useState(true);
  const [waitlist, setWaitlist] = useState([]);
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState({ total: 0, waiting: 0, notified: 0, purchased: 0, expired: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEvent, setFilterEvent] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [notifyDialog, setNotifyDialog] = useState({ open: false, eventId: null, eventTitle: '' });
  const [notifying, setNotifying] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load waitlist entries with event details
      const { data: waitlistData, error: waitlistError } = await supabase
        .from('waitlist')
        .select(`
          *,
          event:events(id, title, slug, start_date)
        `)
        .order('created_at', { ascending: false });

      if (waitlistError) throw waitlistError;
      setWaitlist(waitlistData || []);

      // Calculate stats
      const total = waitlistData?.length || 0;
      const waiting = waitlistData?.filter(w => w.status === 'waiting').length || 0;
      const notified = waitlistData?.filter(w => w.status === 'notified').length || 0;
      const purchased = waitlistData?.filter(w => w.status === 'purchased').length || 0;
      const expired = waitlistData?.filter(w => w.status === 'expired').length || 0;
      setStats({ total, waiting, notified, purchased, expired });

      // Get unique events with waitlist entries
      const uniqueEvents = [...new Map(waitlistData?.map(w => [w.event?.id, w.event]).filter(([id]) => id)).values()];
      setEvents(uniqueEvents);

    } catch (err) {
      console.error('Error loading waitlist:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleNotifyNext = async () => {
    if (!notifyDialog.eventId) return;
    
    setNotifying(true);
    try {
      const result = await notifyNextInWaitlist(notifyDialog.eventId);
      if (result.success) {
        toast.success(`Notified ${result.name} (${result.email})`);
        loadData();
      } else {
        toast.info(result.error || 'No one on waitlist');
      }
    } catch (err) {
      toast.error('Error: ' + err.message);
    } finally {
      setNotifying(false);
      setNotifyDialog({ open: false, eventId: null, eventTitle: '' });
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      waiting: 'bg-blue-100 text-blue-700',
      notified: 'bg-yellow-100 text-yellow-700',
      purchased: 'bg-green-100 text-green-700',
      expired: 'bg-muted text-muted-foreground',
      cancelled: 'bg-red-100 text-red-600',
    };
    return <Badge className={`${styles[status] || 'bg-muted'} rounded-lg`}>{status}</Badge>;
  };

  const filteredWaitlist = waitlist.filter(entry => {
    const matchesSearch = 
      entry.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.event?.title?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesEvent = filterEvent === 'all' || entry.event?.id === filterEvent;
    const matchesStatus = filterStatus === 'all' || entry.status === filterStatus;
    return matchesSearch && matchesEvent && matchesStatus;
  });

  // Group by event for summary
  const eventSummary = events.map(event => {
    const entries = waitlist.filter(w => w.event?.id === event.id);
    return {
      ...event,
      total: entries.length,
      waiting: entries.filter(w => w.status === 'waiting').length,
      notified: entries.filter(w => w.status === 'notified').length,
    };
  }).filter(e => e.waiting > 0 || e.notified > 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Waitlist Management</h1>
          <p className="text-muted-foreground">View and manage waitlists across all events</p>
        </div>
        <Button onClick={loadData} variant="outline" className="rounded-xl">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="rounded-2xl border-border/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-xl">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Entries</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-xl">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600">{stats.waiting}</p>
                <p className="text-xs text-muted-foreground">Waiting</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-xl">
                <Bell className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-600">{stats.notified}</p>
                <p className="text-xs text-muted-foreground">Notified</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-xl">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{stats.purchased}</p>
                <p className="text-xs text-muted-foreground">Purchased</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted rounded-xl">
                <XCircle className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold text-muted-foreground">{stats.expired}</p>
                <p className="text-xs text-muted-foreground">Expired</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Events with Active Waitlists */}
      {eventSummary.length > 0 && (
        <Card className="rounded-2xl border-border/10">
          <CardHeader>
            <CardTitle className="text-lg">Events with Active Waitlists</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {eventSummary.map(event => (
                <div key={event.id} className="p-4 bg-muted rounded-xl">
                  <h4 className="font-semibold text-foreground mb-2">{event.title}</h4>
                  <div className="flex items-center gap-4 text-sm mb-3">
                    <span className="text-blue-600">{event.waiting} waiting</span>
                    <span className="text-yellow-600">{event.notified} notified</span>
                  </div>
                  <Button 
                    size="sm" 
                    className="w-full rounded-xl bg-[#2969FF]"
                    onClick={() => setNotifyDialog({ open: true, eventId: event.id, eventTitle: event.title })}
                    disabled={event.waiting === 0}
                  >
                    <Mail className="w-4 h-4 mr-2" />
                    Notify Next Person
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card className="rounded-2xl border-border/10">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or event..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 rounded-xl bg-muted border-0"
              />
            </div>
            <Select value={filterEvent} onValueChange={setFilterEvent}>
              <SelectTrigger className="w-full md:w-[200px] rounded-xl">
                <SelectValue placeholder="Filter by event" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Events</SelectItem>
                {events.map(event => (
                  <SelectItem key={event.id} value={event.id}>{event.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full md:w-[150px] rounded-xl">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="waiting">Waiting</SelectItem>
                <SelectItem value="notified">Notified</SelectItem>
                <SelectItem value="purchased">Purchased</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Waitlist Table */}
      <Card className="rounded-2xl border-border/10">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Position</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Expires</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredWaitlist.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No waitlist entries found
                  </TableCell>
                </TableRow>
              ) : (
                filteredWaitlist.map(entry => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <span className="font-bold text-[#2969FF]">#{entry.position}</span>
                    </TableCell>
                    <TableCell className="font-medium">{entry.name}</TableCell>
                    <TableCell className="text-muted-foreground">{entry.email}</TableCell>
                    <TableCell>
                      <span className="text-sm">{entry.event?.title}</span>
                    </TableCell>
                    <TableCell>{entry.quantity_wanted}</TableCell>
                    <TableCell>{getStatusBadge(entry.status)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(entry.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {entry.expires_at 
                        ? new Date(entry.expires_at).toLocaleString() 
                        : '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Notify Dialog */}
      <Dialog open={notifyDialog.open} onOpenChange={(open) => !open && setNotifyDialog({ open: false, eventId: null, eventTitle: '' })}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Notify Next Person</DialogTitle>
            <DialogDescription>
              This will email the next person in queue for "{notifyDialog.eventTitle}" that tickets are available. They'll have 24 hours to purchase.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotifyDialog({ open: false, eventId: null, eventTitle: '' })} className="rounded-xl">
              Cancel
            </Button>
            <Button onClick={handleNotifyNext} disabled={notifying} className="rounded-xl bg-[#2969FF]">
              {notifying ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Mail className="w-4 h-4 mr-2" />}
              Send Notification
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
