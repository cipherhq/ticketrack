import { useState, useEffect } from 'react';
import {
  Loader2, UserPlus, CheckCircle, HelpCircle, X, Mail, MessageCircle,
  Bell, Megaphone, MessageSquare, Palette, Settings, PartyPopper,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getActivityLog } from '@/services/partyInvites';
import { formatDistanceToNow } from 'date-fns';

const ACTION_CONFIG = {
  guest_added: { icon: UserPlus, color: 'text-blue-500', bg: 'bg-blue-50', label: 'added a guest' },
  rsvp_updated: { icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-50', label: 'updated RSVP' },
  email_sent: { icon: Mail, color: 'text-indigo-500', bg: 'bg-indigo-50', label: 'sent email invites' },
  sms_sent: { icon: MessageCircle, color: 'text-green-500', bg: 'bg-green-50', label: 'sent SMS invites' },
  reminder_sent: { icon: Bell, color: 'text-amber-500', bg: 'bg-amber-50', label: 'sent reminders' },
  announcement_posted: { icon: Megaphone, color: 'text-purple-500', bg: 'bg-purple-50', label: 'posted an announcement' },
  wall_post: { icon: MessageSquare, color: 'text-cyan-500', bg: 'bg-cyan-50', label: 'posted on the wall' },
  wall_post_deleted: { icon: MessageSquare, color: 'text-gray-400', bg: 'bg-gray-50', label: 'deleted a wall post' },
  design_updated: { icon: Palette, color: 'text-pink-500', bg: 'bg-pink-50', label: 'updated the design' },
  settings_updated: { icon: Settings, color: 'text-gray-500', bg: 'bg-gray-100', label: 'updated settings' },
  party_created: { icon: PartyPopper, color: 'text-violet-500', bg: 'bg-violet-50', label: 'created the party' },
  title_changed: { icon: Settings, color: 'text-orange-500', bg: 'bg-orange-50', label: 'changed the title' },
};

function getActionIcon(action, metadata) {
  if (action === 'rsvp_updated') {
    const status = metadata?.status;
    if (status === 'going') return { icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-50' };
    if (status === 'maybe') return { icon: HelpCircle, color: 'text-amber-500', bg: 'bg-amber-50' };
    if (status === 'declined') return { icon: X, color: 'text-gray-500', bg: 'bg-gray-100' };
  }
  return ACTION_CONFIG[action] || { icon: CheckCircle, color: 'text-gray-400', bg: 'bg-gray-50' };
}

export function ActivityTab({ invite }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(50);

  useEffect(() => {
    loadActivity();
  }, [invite.id]);

  async function loadActivity() {
    setLoading(true);
    try {
      const data = await getActivityLog(invite.id);
      setActivities(data);
    } catch (err) {
      console.error('Error loading activity:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-12">
        <PartyPopper className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-400">No activity logged yet.</p>
      </div>
    );
  }

  const visible = activities.slice(0, visibleCount);

  return (
    <div className="space-y-1">
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

        {visible.map((entry, i) => {
          const config = getActionIcon(entry.action, entry.metadata);
          const IconComponent = config.icon;
          const label = ACTION_CONFIG[entry.action]?.label || entry.action;
          const detail = entry.metadata?.detail || entry.metadata?.title || '';

          return (
            <div key={entry.id} className="relative flex items-start gap-3 py-2.5 pl-1">
              <div className={`relative z-10 w-8 h-8 rounded-full ${config.bg} flex items-center justify-center shrink-0`}>
                <IconComponent className={`w-4 h-4 ${config.color}`} />
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <p className="text-sm text-gray-700">
                  <span className="font-medium text-gray-900">{entry.actor_name || 'System'}</span>
                  {' '}{label}
                  {detail && <span className="text-gray-500"> &mdash; {detail}</span>}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {activities.length > visibleCount && (
        <div className="text-center pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setVisibleCount(prev => prev + 50)}
            className="rounded-xl"
          >
            Load More ({activities.length - visibleCount} remaining)
          </Button>
        </div>
      )}
    </div>
  );
}
