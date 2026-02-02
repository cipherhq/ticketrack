import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Search, Filter, Plus, Upload, Download, Mail, Phone, 
  MessageSquare, Tag, Trash2, Edit, MoreVertical, CheckCircle,
  XCircle, Calendar, TrendingUp, Loader2, Eye, RefreshCw,
  UserPlus, Heart, Ticket, ExternalLink, Clock
} from 'lucide-react';
import { ContactImportDialog } from '@/components/ContactImportDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useOrganizer } from '@/contexts/OrganizerContext';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { Pagination } from '@/components/ui/pagination';

// Source type configuration
const SOURCE_CONFIG = {
  ticket: { label: 'Ticket Purchase', icon: Ticket, color: 'text-blue-600', bgColor: 'bg-blue-100' },
  follower: { label: 'Follower', icon: Heart, color: 'text-pink-600', bgColor: 'bg-pink-100' },
  team: { label: 'Team Member', icon: Users, color: 'text-purple-600', bgColor: 'bg-purple-100' },
  imported: { label: 'Imported', icon: Upload, color: 'text-green-600', bgColor: 'bg-green-100' },
  manual: { label: 'Manual', icon: UserPlus, color: 'text-orange-600', bgColor: 'bg-orange-100' },
  external: { label: 'External', icon: ExternalLink, color: 'text-gray-600', bgColor: 'bg-gray-100' },
};

export function ContactManagement() {
  const navigate = useNavigate();
  const { organizer } = useOrganizer();

  // State
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState([]);
  const [segments, setSegments] = useState([]);
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState('all');
  const [allTags, setAllTags] = useState([]);

  // Dialogs
  const [showAddContact, setShowAddContact] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showContactDetails, setShowContactDetails] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);
  const [showAddTag, setShowAddTag] = useState(false);
  const [newTag, setNewTag] = useState('');

  // Form
  const [addForm, setAddForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    tags: [],
  });

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    withEmail: 0,
    withPhone: 0,
    emailOptIn: 0,
    smsOptIn: 0,
    whatsappOptIn: 0,
  });

  // Pagination
  const [pagination, setPagination] = useState({ page: 1, pageSize: 25 });

  // Saving states
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  useEffect(() => {
    if (organizer?.id) {
      loadData();
    }
  }, [organizer?.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadContacts(),
        loadSegments(),
        loadStats(),
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadContacts = async () => {
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('organizer_id', organizer.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading contacts:', error);
      return;
    }

    setContacts(data || []);

    // Extract all unique tags
    const tags = new Set();
    (data || []).forEach(c => {
      (c.tags || []).forEach(t => tags.add(t));
    });
    setAllTags(Array.from(tags));
  };

  const loadSegments = async () => {
    const { data } = await supabase
      .from('contact_segments')
      .select('*')
      .eq('organizer_id', organizer.id)
      .order('name');

    setSegments(data || []);
  };

  const loadStats = async () => {
    const { data } = await supabase
      .from('contacts')
      .select('email, phone, email_opt_in, sms_opt_in, whatsapp_opt_in')
      .eq('organizer_id', organizer.id)
      .eq('is_active', true);

    const contacts = data || [];
    setStats({
      total: contacts.length,
      withEmail: contacts.filter(c => c.email).length,
      withPhone: contacts.filter(c => c.phone).length,
      emailOptIn: contacts.filter(c => c.email && c.email_opt_in !== false).length,
      smsOptIn: contacts.filter(c => c.phone && c.sms_opt_in !== false).length,
      whatsappOptIn: contacts.filter(c => c.phone && c.whatsapp_opt_in !== false).length,
    });
  };

  // ============================================================================
  // FILTERING
  // ============================================================================

  const filteredContacts = contacts.filter(contact => {
    // Search filter
    const matchesSearch = !searchQuery ||
      contact.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.phone?.includes(searchQuery);

    // Source filter
    const matchesSource = sourceFilter === 'all' || contact.source_type === sourceFilter;

    // Tag filter
    const matchesTag = tagFilter === 'all' || (contact.tags || []).includes(tagFilter);

    return matchesSearch && matchesSource && matchesTag;
  });

  // Paginate
  const paginatedContacts = filteredContacts.slice(
    (pagination.page - 1) * pagination.pageSize,
    pagination.page * pagination.pageSize
  );

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const addContact = async () => {
    if (!addForm.email && !addForm.phone) {
      alert('Please provide either email or phone');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('contacts')
        .insert({
          organizer_id: organizer.id,
          full_name: addForm.fullName,
          email: addForm.email || null,
          phone: addForm.phone || null,
          source_type: 'manual',
          tags: addForm.tags,
          email_opt_in: true,
          sms_opt_in: true,
          whatsapp_opt_in: true,
          first_contact_at: new Date().toISOString(),
          last_contact_at: new Date().toISOString(),
        });

      if (error) throw error;

      setShowAddContact(false);
      setAddForm({ fullName: '', email: '', phone: '', tags: [] });
      loadData();
    } catch (error) {
      console.error('Error adding contact:', error);
      alert('Failed to add contact: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteContact = async (id) => {
    if (!confirm('Delete this contact?')) return;

    try {
      await supabase
        .from('contacts')
        .update({ is_active: false })
        .eq('id', id);

      loadData();
    } catch (error) {
      console.error('Error deleting contact:', error);
    }
  };

  const deleteSelected = async () => {
    if (selectedContacts.length === 0) return;
    if (!confirm(`Delete ${selectedContacts.length} contacts?`)) return;

    try {
      await supabase
        .from('contacts')
        .update({ is_active: false })
        .in('id', selectedContacts);

      setSelectedContacts([]);
      loadData();
    } catch (error) {
      console.error('Error deleting contacts:', error);
    }
  };

  const addTagToSelected = async () => {
    if (!newTag.trim() || selectedContacts.length === 0) return;

    setSaving(true);
    try {
      for (const contactId of selectedContacts) {
        const contact = contacts.find(c => c.id === contactId);
        const currentTags = contact?.tags || [];
        if (!currentTags.includes(newTag)) {
          await supabase
            .from('contacts')
            .update({ tags: [...currentTags, newTag] })
            .eq('id', contactId);
        }
      }

      setShowAddTag(false);
      setNewTag('');
      setSelectedContacts([]);
      loadData();
    } catch (error) {
      console.error('Error adding tag:', error);
    } finally {
      setSaving(false);
    }
  };

  const toggleContactSelection = (id) => {
    setSelectedContacts(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedContacts.length === paginatedContacts.length) {
      setSelectedContacts([]);
    } else {
      setSelectedContacts(paginatedContacts.map(c => c.id));
    }
  };

  const toggleOptIn = async (contactId, channel) => {
    try {
      const contact = contacts.find(c => c.id === contactId);
      if (!contact) return;
      
      const fieldName = `${channel}_opt_in`;
      const currentValue = contact[fieldName];
      const newValue = currentValue === false ? true : false; // Toggle: false -> true, null/true -> false
      
      const { error } = await supabase
        .from('contacts')
        .update({ [fieldName]: newValue })
        .eq('id', contactId);
        
      if (error) throw error;
      
      // Update local state
      setContacts(prev => prev.map(c => 
        c.id === contactId ? { ...c, [fieldName]: newValue } : c
      ));
      
      // Update selected contact if viewing
      if (selectedContact?.id === contactId) {
        setSelectedContact(prev => ({ ...prev, [fieldName]: newValue }));
      }
      
      loadStats();
    } catch (error) {
      console.error('Error toggling opt-in:', error);
      alert('Failed to update preference');
    }
  };

  const syncContacts = async () => {
    setSyncing(true);
    try {
      // 1. Get all events for this organizer (including past events)
      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select('id')
        .eq('organizer_id', organizer.id);

      if (eventsError) throw eventsError;

      if (!events || events.length === 0) {
        alert('No events found to sync contacts from');
        setSyncing(false);
        return;
      }

      const eventIds = events.map(e => e.id);

      // 2. Get all tickets for these events (from tickets table where attendee data lives)
      const { data: tickets, error: ticketsError } = await supabase
        .from('tickets')
        .select('id, attendee_name, attendee_email, attendee_phone, created_at')
        .in('event_id', eventIds)
        .not('attendee_email', 'is', null);

      if (ticketsError) {
        console.error('Tickets error:', ticketsError);
        throw ticketsError;
      }

      // Also try orders table as fallback (some systems use orders)
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('id, attendee_name, attendee_email, attendee_phone, created_at')
        .in('event_id', eventIds)
        .in('status', ['completed', 'confirmed'])
        .not('attendee_email', 'is', null);

      // Combine both sources
      const allAttendees = [...(tickets || []), ...(orders || [])];

      if (allAttendees.length === 0) {
        alert('No attendees found to sync');
        setSyncing(false);
        return;
      }

      // 3. Get existing contacts to avoid duplicates
      const { data: existingContacts } = await supabase
        .from('contacts')
        .select('email')
        .eq('organizer_id', organizer.id);

      const existingEmails = new Set((existingContacts || []).map(c => c.email?.toLowerCase()));

      // 4. Create unique contacts (dedup by email)
      const uniqueContacts = new Map();
      allAttendees.forEach(attendee => {
        const email = attendee.attendee_email?.toLowerCase();
        if (email && !existingEmails.has(email) && !uniqueContacts.has(email)) {
          uniqueContacts.set(email, {
            organizer_id: organizer.id,
            full_name: attendee.attendee_name || null,
            email: attendee.attendee_email,
            phone: attendee.attendee_phone || null,
            source_type: 'ticket',
            email_opt_in: true,
            sms_opt_in: true,
            whatsapp_opt_in: true,
            is_active: true,
            first_contact_at: attendee.created_at,
            last_contact_at: attendee.created_at,
            tags: ['Ticket Buyer'],
          });
        }
      });

      // 5. Insert new contacts
      const newContacts = Array.from(uniqueContacts.values());

      if (newContacts.length === 0) {
        alert('All attendees are already in your contacts!');
        await loadData();
        setSyncing(false);
        return;
      }

      const { error: insertError } = await supabase
        .from('contacts')
        .insert(newContacts);

      if (insertError) {
        console.error('Insert error:', insertError);
        throw insertError;
      }

      alert(`Successfully synced ${newContacts.length} new contacts from ticket purchases!`);
      await loadData();
    } catch (error) {
      console.error('Error syncing contacts:', error);
      alert('Failed to sync contacts: ' + error.message);
    } finally {
      setSyncing(false);
    }
  };

  const exportContacts = () => {
    const headers = ['Name', 'Email', 'Phone', 'Source', 'Tags', 'Created'];
    const rows = filteredContacts.map(c => [
      c.full_name || '',
      c.email || '',
      c.phone || '',
      c.source_type || '',
      (c.tags || []).join('; '),
      format(new Date(c.created_at), 'yyyy-MM-dd'),
    ]);

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contacts-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  const viewContactDetails = (contact) => {
    setSelectedContact(contact);
    setShowContactDetails(true);
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0F0F0F]">Contacts</h1>
          <p className="text-[#0F0F0F]/60">Manage your audience contacts</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={syncContacts} disabled={syncing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            Sync
          </Button>
          <Button variant="outline" onClick={() => setShowImport(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Import
          </Button>
          <Button variant="outline" onClick={exportContacts}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button onClick={() => setShowAddContact(true)} className="bg-[#2969FF] text-white">
            <Plus className="w-4 h-4 mr-2" />
            Add Contact
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card className="border-[#0F0F0F]/10 rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total.toLocaleString()}</p>
                <p className="text-xs text-[#0F0F0F]/60">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#0F0F0F]/10 rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <Mail className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.withEmail.toLocaleString()}</p>
                <p className="text-xs text-[#0F0F0F]/60">With Email</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#0F0F0F]/10 rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <Phone className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.withPhone.toLocaleString()}</p>
                <p className="text-xs text-[#0F0F0F]/60">With Phone</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#0F0F0F]/10 rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.emailOptIn.toLocaleString()}</p>
                <p className="text-xs text-[#0F0F0F]/60">Email Opt-in</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#0F0F0F]/10 rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.smsOptIn.toLocaleString()}</p>
                <p className="text-xs text-[#0F0F0F]/60">SMS Opt-in</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#0F0F0F]/10 rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.whatsappOptIn.toLocaleString()}</p>
                <p className="text-xs text-[#0F0F0F]/60">WhatsApp</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Search */}
      <Card className="border-[#0F0F0F]/10 rounded-xl">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0F0F0F]/40" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, email, or phone..."
                  className="pl-10"
                />
              </div>
            </div>

            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                {Object.entries(SOURCE_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>{config.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={tagFilter} onValueChange={setTagFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Tag" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tags</SelectItem>
                {allTags.map(tag => (
                  <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedContacts.length > 0 && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{selectedContacts.length} selected</Badge>
                <Button variant="outline" size="sm" onClick={() => setShowAddTag(true)}>
                  <Tag className="w-4 h-4 mr-1" />
                  Add Tag
                </Button>
                <Button variant="outline" size="sm" onClick={deleteSelected} className="text-red-600 hover:bg-red-50">
                  <Trash2 className="w-4 h-4 mr-1" />
                  Delete
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Contacts Table */}
      <Card className="border-[#0F0F0F]/10 rounded-xl">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#F4F6FA] border-b border-[#0F0F0F]/10">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <Checkbox
                      checked={selectedContacts.length === paginatedContacts.length && paginatedContacts.length > 0}
                      onCheckedChange={selectAll}
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#0F0F0F]/60 uppercase">Contact</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#0F0F0F]/60 uppercase">Source</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#0F0F0F]/60 uppercase">Channels</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#0F0F0F]/60 uppercase">Tags</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#0F0F0F]/60 uppercase">Added</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-[#0F0F0F]/60 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#0F0F0F]/5">
                {paginatedContacts.map((contact) => {
                  const source = SOURCE_CONFIG[contact.source_type] || SOURCE_CONFIG.manual;
                  return (
                    <tr key={contact.id} className="hover:bg-[#F4F6FA]/50">
                      <td className="px-4 py-3">
                        <Checkbox
                          checked={selectedContacts.includes(contact.id)}
                          onCheckedChange={() => toggleContactSelection(contact.id)}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-[#0F0F0F]">{contact.full_name || 'Unknown'}</p>
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
                      <td className="px-4 py-3">
                        <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg ${source.bgColor}`}>
                          <source.icon className={`w-3.5 h-3.5 ${source.color}`} />
                          <span className={`text-xs font-medium ${source.color}`}>{source.label}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {contact.email_opt_in !== false && contact.email && (
                            <div className="w-6 h-6 rounded bg-blue-100 flex items-center justify-center" title="Email subscribed">
                              <Mail className="w-3 h-3 text-blue-600" />
                            </div>
                          )}
                          {contact.email_opt_in === false && contact.email && (
                            <div className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center" title="Email unsubscribed">
                              <Mail className="w-3 h-3 text-gray-400" />
                            </div>
                          )}
                          {contact.sms_opt_in !== false && contact.phone && (
                            <div className="w-6 h-6 rounded bg-green-100 flex items-center justify-center" title="SMS subscribed">
                              <Phone className="w-3 h-3 text-green-600" />
                            </div>
                          )}
                          {contact.sms_opt_in === false && contact.phone && (
                            <div className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center" title="SMS unsubscribed">
                              <Phone className="w-3 h-3 text-gray-400" />
                            </div>
                          )}
                          {contact.whatsapp_opt_in !== false && contact.phone && (
                            <div className="w-6 h-6 rounded bg-emerald-100 flex items-center justify-center" title="WhatsApp subscribed">
                              <MessageSquare className="w-3 h-3 text-emerald-600" />
                            </div>
                          )}
                          {contact.whatsapp_opt_in === false && contact.phone && (
                            <div className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center" title="WhatsApp unsubscribed">
                              <MessageSquare className="w-3 h-3 text-gray-400" />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(contact.tags || []).slice(0, 3).map(tag => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          {(contact.tags || []).length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{contact.tags.length - 3}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-[#0F0F0F]/60">
                        {format(new Date(contact.created_at), 'MMM d, yyyy')}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => viewContactDetails(contact)}>
                              <Eye className="w-4 h-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => navigate(`/organizer/communications?create=true`)}>
                              <Mail className="w-4 h-4 mr-2" />
                              Send Message
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => deleteContact(contact.id)} className="text-red-600">
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredContacts.length === 0 && (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-[#0F0F0F]/20 mx-auto mb-4" />
              <p className="text-[#0F0F0F]/60 mb-4">
                {searchQuery || sourceFilter !== 'all' || tagFilter !== 'all'
                  ? 'No contacts match your filters'
                  : 'No contacts yet'}
              </p>
              <Button onClick={() => setShowAddContact(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Contact
              </Button>
            </div>
          )}

          {filteredContacts.length > pagination.pageSize && (
            <div className="p-4 border-t border-[#0F0F0F]/10">
              <Pagination 
                currentPage={pagination.page}
                totalPages={Math.ceil(filteredContacts.length / pagination.pageSize)}
                totalItems={filteredContacts.length}
                itemsPerPage={pagination.pageSize}
                onPageChange={(page) => setPagination(p => ({ ...p, page }))}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Contact Dialog */}
      <Dialog open={showAddContact} onOpenChange={setShowAddContact}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Contact</DialogTitle>
            <DialogDescription>Add a new contact to your audience</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label>Full Name</Label>
              <Input
                value={addForm.fullName}
                onChange={e => setAddForm(f => ({ ...f, fullName: e.target.value }))}
                placeholder="John Doe"
                className="mt-1"
              />
            </div>

            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={addForm.email}
                onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))}
                placeholder="john@example.com"
                className="mt-1"
              />
            </div>

            <div>
              <Label>Phone</Label>
              <Input
                value={addForm.phone}
                onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="+234..."
                className="mt-1"
              />
            </div>

            <div>
              <Label>Tags (optional)</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {allTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => setAddForm(f => ({
                      ...f,
                      tags: f.tags.includes(tag)
                        ? f.tags.filter(t => t !== tag)
                        : [...f.tags, tag]
                    }))}
                    className={`px-2 py-1 rounded text-xs ${
                      addForm.tags.includes(tag)
                        ? 'bg-[#2969FF] text-white'
                        : 'bg-[#F4F6FA] hover:bg-[#E8EBF0]'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddContact(false)}>Cancel</Button>
            <Button
              onClick={addContact}
              disabled={saving || (!addForm.email && !addForm.phone)}
              className="bg-[#2969FF] text-white"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Add Contact
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Tag Dialog */}
      <Dialog open={showAddTag} onOpenChange={setShowAddTag}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Tag</DialogTitle>
            <DialogDescription>Add a tag to {selectedContacts.length} selected contacts</DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Label>Tag Name</Label>
            <Input
              value={newTag}
              onChange={e => setNewTag(e.target.value)}
              placeholder="VIP, Newsletter, etc."
              className="mt-1"
            />
            {allTags.length > 0 && (
              <div className="mt-3">
                <p className="text-sm text-[#0F0F0F]/60 mb-2">Or select existing:</p>
                <div className="flex flex-wrap gap-2">
                  {allTags.map(tag => (
                    <button
                      key={tag}
                      onClick={() => setNewTag(tag)}
                      className={`px-2 py-1 rounded text-xs ${
                        newTag === tag ? 'bg-[#2969FF] text-white' : 'bg-[#F4F6FA] hover:bg-[#E8EBF0]'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddTag(false)}>Cancel</Button>
            <Button
              onClick={addTagToSelected}
              disabled={saving || !newTag.trim()}
              className="bg-[#2969FF] text-white"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Tag className="w-4 h-4 mr-2" />}
              Add Tag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contact Details Dialog */}
      <Dialog open={showContactDetails} onOpenChange={setShowContactDetails}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Contact Details</DialogTitle>
          </DialogHeader>

          {selectedContact && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-[#2969FF]/10 flex items-center justify-center">
                  <span className="text-2xl font-semibold text-[#2969FF]">
                    {(selectedContact.full_name || 'U')[0].toUpperCase()}
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold">{selectedContact.full_name || 'Unknown'}</h3>
                  <div className="flex items-center gap-1 text-sm text-[#0F0F0F]/60">
                    {(() => {
                      const source = SOURCE_CONFIG[selectedContact.source_type] || SOURCE_CONFIG.manual;
                      return (
                        <>
                          <source.icon className={`w-3.5 h-3.5 ${source.color}`} />
                          <span>{source.label}</span>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-[#F4F6FA] rounded-lg">
                  <p className="text-xs text-[#0F0F0F]/60">Email</p>
                  <p className="font-medium">{selectedContact.email || 'N/A'}</p>
                </div>
                <div className="p-3 bg-[#F4F6FA] rounded-lg">
                  <p className="text-xs text-[#0F0F0F]/60">Phone</p>
                  <p className="font-medium">{selectedContact.phone || 'N/A'}</p>
                </div>
                <div className="p-3 bg-[#F4F6FA] rounded-lg">
                  <p className="text-xs text-[#0F0F0F]/60">Events Attended</p>
                  <p className="font-medium">{selectedContact.total_events_attended || 0}</p>
                </div>
                <div className="p-3 bg-[#F4F6FA] rounded-lg">
                  <p className="text-xs text-[#0F0F0F]/60">Total Spent</p>
                  <p className="font-medium">₦{(selectedContact.total_spent || 0).toLocaleString()}</p>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Communication Preferences <span className="text-xs font-normal text-[#0F0F0F]/50">(click to toggle)</span></p>
                <div className="flex items-center gap-3">
                  <Badge 
                    className={`cursor-pointer hover:opacity-80 transition-opacity ${selectedContact.email_opt_in !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                    onClick={() => toggleOptIn(selectedContact.id, 'email')}
                  >
                    {selectedContact.email_opt_in !== false ? <CheckCircle className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                    Email
                  </Badge>
                  <Badge 
                    className={`cursor-pointer hover:opacity-80 transition-opacity ${selectedContact.sms_opt_in !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                    onClick={() => toggleOptIn(selectedContact.id, 'sms')}
                  >
                    {selectedContact.sms_opt_in !== false ? <CheckCircle className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                    SMS
                  </Badge>
                  <Badge 
                    className={`cursor-pointer hover:opacity-80 transition-opacity ${selectedContact.whatsapp_opt_in !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                    onClick={() => toggleOptIn(selectedContact.id, 'whatsapp')}
                  >
                    {selectedContact.whatsapp_opt_in !== false ? <CheckCircle className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                    WhatsApp
                  </Badge>
                </div>
              </div>

              {(selectedContact.tags || []).length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Tags</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedContact.tags.map(tag => (
                      <Badge key={tag} variant="secondary">{tag}</Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-[#0F0F0F]/60">First Contact</p>
                  <p>{selectedContact.first_contact_at ? format(new Date(selectedContact.first_contact_at), 'MMM d, yyyy') : 'N/A'}</p>
                </div>
                <div>
                  <p className="text-[#0F0F0F]/60">Last Contact</p>
                  <p>{selectedContact.last_contact_at ? format(new Date(selectedContact.last_contact_at), 'MMM d, yyyy') : 'N/A'}</p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowContactDetails(false)}>Close</Button>
            <Button onClick={() => navigate(`/organizer/communications?create=true`)} className="bg-[#2969FF] text-white">
              <Mail className="w-4 h-4 mr-2" />
              Send Message
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <ContactImportDialog
        open={showImport}
        onOpenChange={setShowImport}
        organizerId={organizer?.id}
        onImportComplete={loadData}
      />
    </div>
  );
}

export default ContactManagement;
