import { useState, useEffect } from 'react';
import {
  Users, Search, Mail, Phone, MessageSquare, Loader2, Download,
  Building, Calendar, RefreshCw, Filter, ChevronLeft, ChevronRight,
  Ticket, Heart, Upload, UserPlus, ExternalLink
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';

// Source type configuration
const SOURCE_CONFIG = {
  ticket: { label: 'Ticket', icon: Ticket, color: 'text-blue-600', bgColor: 'bg-blue-100' },
  follower: { label: 'Follower', icon: Heart, color: 'text-pink-600', bgColor: 'bg-pink-100' },
  team: { label: 'Team', icon: Users, color: 'text-purple-600', bgColor: 'bg-purple-100' },
  imported: { label: 'Imported', icon: Upload, color: 'text-green-600', bgColor: 'bg-green-100' },
  manual: { label: 'Manual', icon: UserPlus, color: 'text-orange-600', bgColor: 'bg-orange-100' },
  external: { label: 'External', icon: ExternalLink, color: 'text-gray-600', bgColor: 'bg-gray-100' },
};

export function AdminContacts() {
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState([]);
  const [organizers, setOrganizers] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    withEmail: 0,
    withPhone: 0,
    emailOptIn: 0,
  });

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [organizerFilter, setOrganizerFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 50;

  useEffect(() => {
    loadOrganizers();
    loadStats();
  }, []);

  useEffect(() => {
    loadContacts();
  }, [page, organizerFilter, sourceFilter, searchQuery]);

  const loadOrganizers = async () => {
    const { data } = await supabase
      .from('organizers')
      .select('id, business_name')
      .order('business_name');
    setOrganizers(data || []);
  };

  const loadStats = async () => {
    // Total contacts
    const { count: total } = await supabase
      .from('contacts')
      .select('id', { count: 'exact', head: true });

    // With email
    const { count: withEmail } = await supabase
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .not('email', 'is', null);

    // With phone
    const { count: withPhone } = await supabase
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .not('phone', 'is', null);

    // Email opt-in
    const { count: emailOptIn } = await supabase
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .eq('email_opt_in', true);

    setStats({
      total: total || 0,
      withEmail: withEmail || 0,
      withPhone: withPhone || 0,
      emailOptIn: emailOptIn || 0,
    });
  };

  const loadContacts = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('contacts')
        .select(`
          *,
          organizer:organizers(id, business_name)
        `, { count: 'exact' });

      // Apply filters
      if (organizerFilter !== 'all') {
        query = query.eq('organizer_id', organizerFilter);
      }
      if (sourceFilter !== 'all') {
        query = query.eq('source', sourceFilter);
      }
      if (searchQuery.trim()) {
        query = query.or(`full_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`);
      }

      // Pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, count, error } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      setContacts(data || []);
      setTotalPages(Math.ceil((count || 0) / pageSize));
    } catch (err) {
      console.error('Error loading contacts:', err);
    } finally {
      setLoading(false);
    }
  };

  const exportContacts = async () => {
    try {
      let query = supabase
        .from('contacts')
        .select(`
          full_name, email, phone, source, email_opt_in, sms_opt_in, whatsapp_opt_in,
          total_tickets, total_spent, created_at,
          organizer:organizers(business_name)
        `);

      if (organizerFilter !== 'all') {
        query = query.eq('organizer_id', organizerFilter);
      }
      if (sourceFilter !== 'all') {
        query = query.eq('source', sourceFilter);
      }

      const { data } = await query.order('created_at', { ascending: false });

      if (!data || data.length === 0) {
        alert('No contacts to export');
        return;
      }

      // Create CSV
      const headers = ['Name', 'Email', 'Phone', 'Source', 'Organizer', 'Email Opt-In', 'SMS Opt-In', 'WhatsApp Opt-In', 'Total Tickets', 'Total Spent', 'Created'];
      const rows = data.map(c => [
        c.full_name || '',
        c.email || '',
        c.phone || '',
        c.source || '',
        c.organizer?.business_name || '',
        c.email_opt_in ? 'Yes' : 'No',
        c.sms_opt_in ? 'Yes' : 'No',
        c.whatsapp_opt_in ? 'Yes' : 'No',
        c.total_tickets || 0,
        c.total_spent || 0,
        c.created_at ? format(new Date(c.created_at), 'yyyy-MM-dd') : '',
      ]);

      const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contacts-export-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
      alert('Failed to export');
    }
  };

  const getSourceBadge = (source) => {
    const config = SOURCE_CONFIG[source] || SOURCE_CONFIG.manual;
    const Icon = config.icon;
    return (
      <Badge variant="secondary" className={`${config.bgColor} ${config.color} text-xs`}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#0F0F0F]">All Contacts</h1>
          <p className="text-[#0F0F0F]/60">View all contacts across all organizers</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={loadContacts} className="rounded-xl">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={exportContacts} className="bg-[#2969FF] text-white rounded-xl">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="rounded-2xl border-[#0F0F0F]/10">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{stats.total.toLocaleString()}</p>
              <p className="text-xs text-[#0F0F0F]/60">Total Contacts</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-[#0F0F0F]/10">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
              <Mail className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{stats.withEmail.toLocaleString()}</p>
              <p className="text-xs text-[#0F0F0F]/60">With Email</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-[#0F0F0F]/10">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
              <Phone className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{stats.withPhone.toLocaleString()}</p>
              <p className="text-xs text-[#0F0F0F]/60">With Phone</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-[#0F0F0F]/10">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{stats.emailOptIn.toLocaleString()}</p>
              <p className="text-xs text-[#0F0F0F]/60">Email Opt-In</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="rounded-2xl border-[#0F0F0F]/10">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0F0F0F]/40" />
              <Input
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                placeholder="Search by name, email, or phone..."
                className="pl-10 rounded-xl"
              />
            </div>
            <Select value={organizerFilter} onValueChange={(v) => { setOrganizerFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[200px] rounded-xl">
                <Building className="w-4 h-4 mr-2 text-[#0F0F0F]/40" />
                <SelectValue placeholder="All Organizers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Organizers</SelectItem>
                {organizers.map(org => (
                  <SelectItem key={org.id} value={org.id}>{org.business_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sourceFilter} onValueChange={(v) => { setSourceFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[150px] rounded-xl">
                <Filter className="w-4 h-4 mr-2 text-[#0F0F0F]/40" />
                <SelectValue placeholder="All Sources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                {Object.entries(SOURCE_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>{config.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Contacts Table */}
      <Card className="rounded-2xl border-[#0F0F0F]/10">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" />
            </div>
          ) : contacts.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-[#0F0F0F]/20 mx-auto mb-3" />
              <p className="text-[#0F0F0F]/60">No contacts found</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#0F0F0F]/10 bg-[#F4F6FA]">
                      <th className="text-left py-3 px-4 text-sm font-medium text-[#0F0F0F]/60">Contact</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-[#0F0F0F]/60">Organizer</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-[#0F0F0F]/60">Source</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-[#0F0F0F]/60">Opt-In</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-[#0F0F0F]/60">Activity</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-[#0F0F0F]/60">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.map(contact => (
                      <tr key={contact.id} className="border-b border-[#0F0F0F]/5 hover:bg-[#F4F6FA]/50">
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium text-[#0F0F0F]">{contact.full_name || '—'}</p>
                            <div className="flex items-center gap-3 text-sm text-[#0F0F0F]/60">
                              {contact.email && (
                                <span className="flex items-center gap-1">
                                  <Mail className="w-3 h-3" />
                                  {contact.email}
                                </span>
                              )}
                              {contact.phone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="w-3 h-3" />
                                  {contact.phone}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-sm">{contact.organizer?.business_name || '—'}</span>
                        </td>
                        <td className="py-3 px-4">
                          {getSourceBadge(contact.source)}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {contact.email_opt_in && (
                              <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">
                                <Mail className="w-3 h-3 mr-1" />
                                Email
                              </Badge>
                            )}
                            {contact.sms_opt_in && (
                              <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-xs">
                                <Phone className="w-3 h-3 mr-1" />
                                SMS
                              </Badge>
                            )}
                            {contact.whatsapp_opt_in && (
                              <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 text-xs">
                                <MessageSquare className="w-3 h-3 mr-1" />
                                WA
                              </Badge>
                            )}
                            {!contact.email_opt_in && !contact.sms_opt_in && !contact.whatsapp_opt_in && (
                              <span className="text-xs text-[#0F0F0F]/40">None</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-sm">
                            <span className="text-[#0F0F0F]/60">{contact.total_tickets || 0} tickets</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-sm text-[#0F0F0F]/60">
                            {contact.created_at ? format(new Date(contact.created_at), 'MMM d, yyyy') : '—'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-[#0F0F0F]/10">
                  <p className="text-sm text-[#0F0F0F]/60">
                    Page {page} of {totalPages}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="rounded-lg"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="rounded-lg"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default AdminContacts;
