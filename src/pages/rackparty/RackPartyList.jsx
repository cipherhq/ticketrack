import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { PartyPopper, Users, Plus, Calendar, MapPin, Loader2, Repeat, UserCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useOrganizer } from '@/contexts/OrganizerContext';
import { getOrganizerInvites, getInviteStats } from '@/services/partyInvites';
import { formatDateShort } from '@/components/rackparty/shared';

export function RackPartyList() {
  const { organizer } = useOrganizer();
  const navigate = useNavigate();
  const location = useLocation();
  const basePath = location.pathname.startsWith('/rackparty') ? '/rackparty' : '/organizer/rackparty';

  const [campaigns, setCampaigns] = useState([]);
  const [campaignStats, setCampaignStats] = useState({});
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);

  useEffect(() => {
    if (!organizer?.id) return;
    loadCampaigns();
  }, [organizer?.id]);

  async function loadCampaigns() {
    setLoadingCampaigns(true);
    try {
      const data = await getOrganizerInvites(organizer.id);
      setCampaigns(data);
      const statsMap = {};
      await Promise.all(data.map(async (inv) => {
        try {
          const s = await getInviteStats(inv.id);
          statsMap[inv.id] = s;
        } catch {}
      }));
      setCampaignStats(statsMap);
    } catch (err) {
      console.error('Error loading campaigns:', err);
    } finally {
      setLoadingCampaigns(false);
    }
  }

  if (loadingCampaigns) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <PartyPopper className="w-6 h-6 text-primary" />
            RackParty
          </h1>
          <p className="text-sm text-gray-500 mt-1">Create beautiful party invites and track RSVPs</p>
        </div>
        <Button onClick={() => navigate(basePath + '/create')} className="rounded-xl gap-2">
          <Plus className="w-4 h-4" /> Create a Party
        </Button>
      </div>

      {campaigns.length === 0 ? (
        <div className="text-center py-20">
          <PartyPopper className="w-14 h-14 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-700 mb-1">No parties yet</h2>
          <p className="text-gray-400 mb-6">Create your first party to get started</p>
          <Button onClick={() => navigate(basePath + '/create')} className="rounded-xl gap-2">
            <Plus className="w-4 h-4" /> Create a Party
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {campaigns.map(c => {
            const s = campaignStats[c.id] || { total: 0, going: 0, maybe: 0, pending: 0, declined: 0 };
            return (
              <Card
                key={c.id}
                className="rounded-2xl cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(basePath + '/' + c.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {c.cover_image_url ? (
                      <img src={c.cover_image_url} alt="" className="w-16 h-16 rounded-xl object-cover shrink-0" />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center shrink-0">
                        <PartyPopper className="w-7 h-7 text-purple-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-semibold text-gray-900 truncate">{c.title || 'Untitled Invite'}</h3>
                        {c.recurrence_rule && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700" title="Recurring">
                            <Repeat className="w-2.5 h-2.5" />
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                        {c.start_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {formatDateShort(c.start_date)}
                          </span>
                        )}
                        {c.venue_name && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" />
                            {c.venue_name}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <Users className="w-3.5 h-3.5" /> {s.total} guest{s.total !== 1 ? 's' : ''}
                        </span>
                        {s.going > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                            {s.going} going
                          </span>
                        )}
                        {s.maybe > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                            {s.maybe} maybe
                          </span>
                        )}
                        {s.pending > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                            {s.pending} pending
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
