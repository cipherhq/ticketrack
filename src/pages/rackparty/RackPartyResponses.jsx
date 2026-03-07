import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  PartyPopper, Users, CheckCircle, BarChart3, Loader2, Download,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useOrganizer } from '@/contexts/OrganizerContext';
import { getOrganizerPartyAnalytics } from '@/services/partyInvites';
import { formatDateShort } from '@/components/rackparty/shared';

export function RackPartyResponses() {
  const { organizer } = useOrganizer();
  const navigate = useNavigate();
  const location = useLocation();
  const basePath = location.pathname.startsWith('/rackparty') ? '/rackparty' : '/organizer/rackparty';

  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!organizer?.id) return;
    loadAnalytics();
  }, [organizer?.id]);

  async function loadAnalytics() {
    setLoading(true);
    try {
      const data = await getOrganizerPartyAnalytics(organizer.id);
      setAnalytics(data);
    } catch (err) {
      console.error('Error loading analytics:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleExport() {
    if (!analytics) return;
    const blob = new Blob([JSON.stringify(analytics, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rackparty-analytics.json';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Analytics exported');
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const totals = analytics?.totals || { totalParties: 0, totalGuests: 0, going: 0, maybe: 0, pending: 0, declined: 0, responded: 0 };
  const responseRate = totals.totalGuests > 0 ? Math.round((totals.responded / totals.totalGuests) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" />
            Responses
          </h1>
          <p className="text-sm text-gray-500 mt-1">RSVP analytics across all your parties</p>
        </div>
        <Button variant="outline" onClick={handleExport} className="rounded-xl gap-2">
          <Download className="w-4 h-4" /> Export
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="rounded-2xl">
          <CardContent className="p-4 text-center">
            <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center mx-auto mb-2">
              <PartyPopper className="w-5 h-5 text-purple-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{totals.totalParties}</p>
            <p className="text-xs text-gray-500">Total Parties</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-4 text-center">
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-2">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{totals.totalGuests}</p>
            <p className="text-xs text-gray-500">Total Guests</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-4 text-center">
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-2">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{totals.going}</p>
            <p className="text-xs text-gray-500">Going</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-4 text-center">
            <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-2">
              <BarChart3 className="w-5 h-5 text-amber-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{responseRate}%</p>
            <p className="text-xs text-gray-500">Response Rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Status Breakdown */}
      <Card className="rounded-2xl">
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Status Breakdown</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Going', count: totals.going, color: 'bg-emerald-500', textColor: 'text-emerald-700' },
              { label: 'Maybe', count: totals.maybe, color: 'bg-amber-500', textColor: 'text-amber-700' },
              { label: 'Pending', count: totals.pending, color: 'bg-blue-500', textColor: 'text-blue-700' },
              { label: 'Declined', count: totals.declined, color: 'bg-gray-400', textColor: 'text-gray-500' },
            ].map(s => {
              const width = totals.totalGuests > 0 ? Math.max(4, (s.count / totals.totalGuests) * 100) : 0;
              return (
                <div key={s.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-sm font-medium ${s.textColor}`}>{s.label}</span>
                    <span className="text-sm font-bold text-gray-900">{s.count}</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${s.color}`} style={{ width: `${width}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Per-party Table */}
      <Card className="rounded-2xl">
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Per-Party Breakdown</h3>
          {(analytics?.perParty || []).length === 0 ? (
            <div className="text-center py-8">
              <PartyPopper className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400">No parties yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="pb-2 font-medium">Party Name</th>
                    <th className="pb-2 font-medium hidden sm:table-cell">Date</th>
                    <th className="pb-2 font-medium text-right">Total</th>
                    <th className="pb-2 font-medium text-right">Going</th>
                    <th className="pb-2 font-medium text-right hidden sm:table-cell">Maybe</th>
                    <th className="pb-2 font-medium text-right hidden md:table-cell">Pending</th>
                    <th className="pb-2 font-medium text-right hidden md:table-cell">Declined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {analytics.perParty.map(party => (
                    <tr
                      key={party.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => navigate(basePath + '/' + party.id)}
                    >
                      <td className="py-3 font-medium text-gray-900">{party.title || 'Untitled'}</td>
                      <td className="py-3 hidden sm:table-cell text-gray-500">{formatDateShort(party.start_date)}</td>
                      <td className="py-3 text-right font-bold">{party.total}</td>
                      <td className="py-3 text-right text-emerald-600 font-medium">{party.going}</td>
                      <td className="py-3 text-right text-amber-600 hidden sm:table-cell">{party.maybe}</td>
                      <td className="py-3 text-right text-blue-600 hidden md:table-cell">{party.pending}</td>
                      <td className="py-3 text-right text-gray-500 hidden md:table-cell">{party.declined}</td>
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
