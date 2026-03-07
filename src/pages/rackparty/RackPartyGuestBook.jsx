import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Users, Search, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useOrganizer } from '@/contexts/OrganizerContext';
import { getOrganizerInvites, getAllOrganizerGuests } from '@/services/partyInvites';
import { statusBadge, formatDateShort } from '@/components/rackparty/shared';

export function RackPartyGuestBook() {
  const { organizer } = useOrganizer();
  const navigate = useNavigate();
  const location = useLocation();
  const basePath = location.pathname.startsWith('/rackparty') ? '/rackparty' : '/organizer/rackparty';

  const [guests, setGuests] = useState([]);
  const [parties, setParties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [partyFilter, setPartyFilter] = useState('all');

  useEffect(() => {
    if (!organizer?.id) return;
    loadData();
  }, [organizer?.id]);

  useEffect(() => {
    if (!organizer?.id) return;
    loadGuests();
  }, [organizer?.id, search, statusFilter, partyFilter]);

  async function loadData() {
    setLoading(true);
    try {
      const [partiesData] = await Promise.all([
        getOrganizerInvites(organizer.id),
      ]);
      setParties(partiesData);
      await loadGuests();
    } catch (err) {
      console.error('Error loading guest book:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadGuests() {
    try {
      const data = await getAllOrganizerGuests(organizer.id, {
        search: search || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        partyId: partyFilter !== 'all' ? partyFilter : undefined,
      });
      setGuests(data);
    } catch (err) {
      console.error('Error loading guests:', err);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Users className="w-6 h-6 text-primary" />
          Guest Book
        </h1>
        <p className="text-sm text-gray-500 mt-1">All guests across all your parties</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="pl-10 rounded-xl"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] rounded-lg h-10 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="going">Going</SelectItem>
            <SelectItem value="maybe">Maybe</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="declined">Declined</SelectItem>
          </SelectContent>
        </Select>
        <Select value={partyFilter} onValueChange={setPartyFilter}>
          <SelectTrigger className="w-[180px] rounded-lg h-10 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Parties</SelectItem>
            {parties.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.title || 'Untitled'}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="rounded-2xl">
        <CardContent className="p-4">
          {guests.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400">No guests found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="pb-2 font-medium">Name</th>
                    <th className="pb-2 font-medium hidden sm:table-cell">Email</th>
                    <th className="pb-2 font-medium hidden md:table-cell">Phone</th>
                    <th className="pb-2 font-medium">Party</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium hidden md:table-cell">Responded</th>
                    <th className="pb-2 font-medium hidden lg:table-cell">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {guests.map(g => (
                    <tr key={g.id} className="hover:bg-gray-50">
                      <td className="py-3">
                        <p className="font-medium text-gray-900">{g.name}</p>
                        <p className="text-xs text-gray-400 sm:hidden">{g.email || '\u2014'}</p>
                      </td>
                      <td className="py-3 hidden sm:table-cell text-gray-600">{g.email || '\u2014'}</td>
                      <td className="py-3 hidden md:table-cell text-gray-600">{g.phone || '\u2014'}</td>
                      <td className="py-3">
                        <button
                          onClick={() => navigate(basePath + '/' + g.invite?.id)}
                          className="text-primary hover:underline text-sm truncate max-w-[120px] block"
                        >
                          {g.invite?.title || 'Unknown'}
                        </button>
                      </td>
                      <td className="py-3">{statusBadge(g.rsvp_status)}</td>
                      <td className="py-3 hidden md:table-cell text-gray-500 text-xs">
                        {g.rsvp_responded_at ? formatDateShort(g.rsvp_responded_at) : '\u2014'}
                      </td>
                      <td className="py-3 hidden lg:table-cell text-gray-500 text-xs capitalize">
                        {g.source || '\u2014'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
