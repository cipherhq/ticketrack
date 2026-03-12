import { useState, useEffect } from 'react';
import { Loader2, Trash2, Megaphone, Mail, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  getAnnouncements, createAnnouncement, deleteAnnouncement,
  getInviteGuests, logActivity,
} from '@/services/partyInvites';
import { sendPartyAnnouncementEmail } from '@/lib/emailService';
import { APP_URL } from './shared';
import { formatDistanceToNow } from 'date-fns';

export function AnnouncementsTab({ invite, organizer }) {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [sendEmail, setSendEmail] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadAnnouncements();
  }, [invite.id]);

  async function loadAnnouncements() {
    setLoading(true);
    try {
      const data = await getAnnouncements(invite.id);
      setAnnouncements(data);
    } catch (err) {
      console.error('Error loading announcements:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!title.trim() || !content.trim()) return;
    setCreating(true);
    try {
      await createAnnouncement(invite.id, organizer.id, {
        title: title.trim(),
        content: content.trim(),
        sendEmail,
      });

      // Send emails to all guests with email addresses
      if (sendEmail) {
        try {
          const guests = await getInviteGuests(invite.id);
          const emailGuests = guests.filter(g => g.email && g.rsvp_token);
          let sent = 0, failed = 0;
          for (const g of emailGuests) {
            try {
              const rsvpUrl = `${APP_URL}/invite/${invite.share_token}?rsvp=${g.rsvp_token}`;
              const result = await sendPartyAnnouncementEmail(g.email, {
                eventTitle: invite.title,
                announcementTitle: title.trim(),
                announcementContent: content.trim(),
                organizerName: organizer?.business_name || 'Host',
                rsvpUrl,
              }, organizer.id);
              if (result?.success === false) { failed++; } else { sent++; }
            } catch (err) {
              console.error(`Announcement email failed for ${g.email}:`, err);
              failed++;
            }
          }
          if (sent > 0 && failed === 0) {
            toast.success(`Announcement emailed to ${sent} guest${sent > 1 ? 's' : ''}`);
          } else if (sent > 0 && failed > 0) {
            toast.warning(`Sent to ${sent} guest${sent > 1 ? 's' : ''}, ${failed} failed`);
          } else if (failed > 0) {
            toast.error('Announcement saved but all emails failed');
          }
        } catch (emailErr) {
          console.error('Error sending announcement emails:', emailErr);
          toast.error('Announcement saved but emails failed');
        }
      }

      await logActivity(invite.id, 'announcement_posted', organizer?.business_name || 'Host', { title: title.trim() });
      setTitle('');
      setContent('');
      setSendEmail(false);
      await loadAnnouncements();
      toast.success('Announcement posted');
    } catch (err) {
      console.error('Error creating announcement:', err);
      toast.error('Failed to post announcement');
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(announcementId) {
    try {
      await deleteAnnouncement(announcementId);
      setAnnouncements(prev => prev.filter(a => a.id !== announcementId));
      toast.success('Announcement deleted');
    } catch (err) {
      console.error('Error deleting announcement:', err);
      toast.error('Failed to delete announcement');
    }
  }

  return (
    <div className="space-y-6">
      {/* Create form */}
      <div className="space-y-3 p-4 border border-gray-200 rounded-2xl bg-white">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <Megaphone className="w-4 h-4" /> New Announcement
        </h3>
        <div>
          <Label className="text-xs">Title *</Label>
          <Input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Announcement title..."
            className="rounded-lg mt-1"
          />
        </div>
        <div>
          <Label className="text-xs">Content *</Label>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Write your announcement..."
            rows={3}
            className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSendEmail(!sendEmail)}
            className={`relative w-10 h-5 rounded-full transition-colors ${sendEmail ? 'bg-primary' : 'bg-gray-300'}`}
          >
            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${sendEmail ? 'left-[20px]' : 'left-0.5'}`} />
          </button>
          <span className="text-sm text-gray-600 flex items-center gap-1">
            <Mail className="w-3.5 h-3.5" /> Email notification to all guests
          </span>
        </div>
        <Button
          onClick={handleCreate}
          disabled={!title.trim() || !content.trim() || creating}
          className="rounded-xl gap-2"
          size="sm"
        >
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Post Announcement
        </Button>
      </div>

      {/* Announcements list */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      ) : announcements.length === 0 ? (
        <div className="text-center py-12">
          <Megaphone className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400">No announcements yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map(a => (
            <div key={a.id} className="p-4 rounded-2xl border border-gray-200 bg-white">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-bold text-gray-900">{a.title}</h4>
                    {a.send_email && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700 flex items-center gap-0.5">
                        <Mail className="w-2.5 h-2.5" /> Emailed
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{a.content}</p>
                  <p className="text-xs text-gray-400 mt-2">
                    {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(a.id)}
                  className="p-1 text-gray-400 hover:text-red-500 transition-colors shrink-0"
                  title="Delete announcement"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
