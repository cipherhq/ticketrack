import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Loader2, Calendar, MapPin, Clock, ChevronUp, ChevronDown, Check, HelpCircle, X, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  getInviteByToken,
  getGuestByRsvpToken,
  submitGuestRSVP,
  registerAndRSVP,
  getPublicGuestList,
} from '@/services/partyInvites';

function formatDate(dateStr) {
  if (!dateStr) return 'TBA';
  return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}
function formatTime(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export function WebInviteRSVP() {
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const guestRsvpToken = searchParams.get('rsvp');

  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState(null);
  const [guest, setGuest] = useState(null);
  const [organizer, setOrganizer] = useState(null);
  const [error, setError] = useState('');

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [plusOnes, setPlusOnes] = useState(0);
  const [plusOneNames, setPlusOneNames] = useState([]);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [changingResponse, setChangingResponse] = useState(false);
  const [guestList, setGuestList] = useState([]);

  const isShareLink = !guestRsvpToken;
  const isExpired = invite?.rsvp_deadline && new Date(invite.rsvp_deadline) < new Date();
  const hasResponded = guest?.rsvp_responded_at && !changingResponse;

  useEffect(() => {
    loadData();
  }, [token, guestRsvpToken]);

  async function loadData() {
    setLoading(true);
    try {
      if (guestRsvpToken) {
        const guestData = await getGuestByRsvpToken(guestRsvpToken);
        if (!guestData) { setError('Invite not found'); return; }
        setGuest(guestData);
        setInvite(guestData.invite);
        setOrganizer(guestData.invite?.organizer);
        setName(guestData.name);
        setEmail(guestData.email || '');
        if (guestData.rsvp_responded_at) {
          setSelectedStatus(guestData.rsvp_status);
          setPlusOnes(guestData.plus_ones || 0);
          setPlusOneNames(guestData.plus_one_names || []);
          setNote(guestData.note || '');
        }
        // Load guest list
        try {
          const list = await getPublicGuestList(guestData.invite_id);
          setGuestList(list);
        } catch {}
      } else {
        const inviteData = await getInviteByToken(token);
        if (!inviteData) { setError('Invite not found'); return; }
        setInvite(inviteData);
        setOrganizer(inviteData.organizer);
        try {
          const list = await getPublicGuestList(inviteData.id);
          setGuestList(list);
        } catch {}
      }
    } catch (err) {
      console.error('Error loading invite:', err);
      setError('This invite link is invalid or has expired.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    if (!selectedStatus) return;
    if (isShareLink && !name.trim()) return;

    setSubmitting(true);
    try {
      if (isShareLink) {
        await registerAndRSVP(invite.id, invite.organizer_id, {
          name: name.trim(),
          email: email.trim() || null,
          status: selectedStatus,
          plusOnes,
          plusOneNames: plusOneNames.filter(n => n.trim()),
          note: note.trim(),
        });
      } else {
        await submitGuestRSVP(guestRsvpToken, {
          status: selectedStatus,
          plusOnes,
          plusOneNames: plusOneNames.filter(n => n.trim()),
          note: note.trim(),
        });
      }
      setSubmitted(true);
      setChangingResponse(false);
      if (selectedStatus === 'going') { fireConfetti(); }
    } catch (err) {
      console.error('RSVP error:', err);
      setError('Failed to submit RSVP. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    );
  }

  // Error
  if (error && !invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 p-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
            <X className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Invite Not Found</h1>
          <p className="text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  const coverImage = invite?.cover_image_url;
  const statusLabels = { going: 'Going', maybe: 'Maybe', declined: "Can't Make It" };
  const statusColors = { going: 'bg-emerald-500', maybe: 'bg-amber-500', declined: 'bg-gray-500' };

  const goingCount = guestList.filter(g => g.status === 'going').length;
  const maybeCount = guestList.filter(g => g.status === 'maybe').length;

  async function fireConfetti() {
    try {
      const confetti = (await import('canvas-confetti')).default;
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      setTimeout(() => confetti({ particleCount: 50, angle: 60, spread: 55, origin: { x: 0, y: 0.6 } }), 200);
      setTimeout(() => confetti({ particleCount: 50, angle: 120, spread: 55, origin: { x: 1, y: 0.6 } }), 400);
    } catch {}
  }

  return (
    <div className="min-h-screen relative">
      {/* Blurred backdrop */}
      {coverImage && (
        <div
          className="fixed inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${coverImage})`, filter: 'blur(30px) brightness(0.3)', transform: 'scale(1.2)' }}
        />
      )}
      <div className="fixed inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/80" />

      {/* Content */}
      <div className="relative z-10 min-h-screen flex items-start justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-md">
          {/* Card */}
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden rsvp-animate-card">
            {/* Event Image Hero */}
            {coverImage && (
              <div className="relative h-52 sm:h-60">
                <img src={coverImage} alt={invite?.title} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
              </div>
            )}

            <div className="p-6 sm:p-8">
              {/* Live Guest Count Banner */}
              <div className="rsvp-animate-title mb-4">
                <div className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-blue-50 border border-blue-100">
                  <Users className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-semibold text-blue-700">
                    {goingCount > 0
                      ? `Join ${goingCount} other${goingCount > 1 ? 's' : ''}!${maybeCount > 0 ? ` (${maybeCount} maybe)` : ''}`
                      : 'Be the first to RSVP!'
                    }
                  </span>
                </div>
              </div>

              {/* Event Title */}
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight rsvp-animate-title">
                {invite?.title}
              </h1>

              {/* Hosted by */}
              <div className="flex items-center gap-2 mt-3 rsvp-animate-host">
                {organizer?.logo_url ? (
                  <img src={organizer.logo_url} alt="" className="w-6 h-6 rounded-full object-cover" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                    <span className="text-xs font-bold text-blue-600">
                      {(organizer?.business_name || 'O')[0]}
                    </span>
                  </div>
                )}
                <span className="text-sm text-gray-500">
                  Hosted by <span className="font-medium text-gray-700">{organizer?.business_name || 'Organizer'}</span>
                </span>
              </div>

              {/* Date, Time, Venue */}
              <div className="mt-5 space-y-3">
                <div className="flex items-start gap-3 rsvp-animate-detail-1">
                  <Calendar className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-gray-900">{formatDate(invite?.start_date)}</p>
                    <p className="text-sm text-gray-500">{formatTime(invite?.start_date)}{invite?.end_date ? ` - ${formatTime(invite.end_date)}` : ''}</p>
                  </div>
                </div>
                {(invite?.venue_name || invite?.city) && (
                  <div className="flex items-start gap-3 rsvp-animate-detail-2">
                    <MapPin className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-gray-900">{invite?.venue_name || 'Venue TBA'}</p>
                      {invite?.city && <p className="text-sm text-gray-500">{invite.address || invite.city}</p>}
                    </div>
                  </div>
                )}
              </div>

              {/* Invite Message */}
              {invite?.message && (
                <div className="mt-5 p-4 bg-purple-50 rounded-xl border-l-4 border-purple-400 rsvp-animate-message">
                  <p className="text-sm text-purple-800 italic">"{invite.message}"</p>
                </div>
              )}

              {/* Expired State */}
              {isExpired && (
                <div className="mt-6 p-4 bg-gray-100 rounded-xl text-center">
                  <Clock className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                  <p className="font-medium text-gray-600">RSVP deadline has passed</p>
                  <p className="text-sm text-gray-400 mt-1">This invite is no longer accepting responses.</p>
                </div>
              )}

              {/* Success / Already Responded State */}
              {(submitted || hasResponded) && !isExpired && (
                <div className="mt-6">
                  <div className={`p-5 rounded-xl text-center ${selectedStatus === 'going' ? 'bg-emerald-50' : selectedStatus === 'maybe' ? 'bg-amber-50' : 'bg-gray-100'}`}>
                    {selectedStatus === 'going' && (
                      <div className="w-14 h-14 rounded-full bg-emerald-500 flex items-center justify-center mx-auto mb-3 animate-bounce">
                        <Check className="w-7 h-7 text-white" />
                      </div>
                    )}
                    {selectedStatus === 'maybe' && (
                      <div className="w-14 h-14 rounded-full bg-amber-500 flex items-center justify-center mx-auto mb-3">
                        <HelpCircle className="w-7 h-7 text-white" />
                      </div>
                    )}
                    {selectedStatus === 'declined' && (
                      <div className="w-14 h-14 rounded-full bg-gray-400 flex items-center justify-center mx-auto mb-3">
                        <X className="w-7 h-7 text-white" />
                      </div>
                    )}
                    <h3 className="text-lg font-bold text-gray-900">
                      {submitted ? 'Response Recorded!' : `You responded: ${statusLabels[selectedStatus]}`}
                    </h3>
                    {plusOnes > 0 && (
                      <p className="text-sm text-gray-500 mt-1">+{plusOnes} guest{plusOnes > 1 ? 's' : ''}</p>
                    )}
                  </div>
                  {!isShareLink && (
                    <button
                      onClick={() => setChangingResponse(true)}
                      className="w-full mt-3 text-center text-sm text-blue-600 hover:text-blue-800 font-medium py-2"
                    >
                      Change my response
                    </button>
                  )}
                </div>
              )}

              {/* RSVP Form */}
              {!isExpired && !submitted && !hasResponded && (
                <div className="mt-6 space-y-5 rsvp-animate-buttons">
                  {/* Share link: name/email form first */}
                  {isShareLink && (
                    <div className="space-y-3">
                      <Input
                        placeholder="Your name *"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className="rounded-xl h-12"
                      />
                      <Input
                        type="email"
                        placeholder="Email (optional)"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        className="rounded-xl h-12"
                      />
                    </div>
                  )}

                  {/* RSVP Buttons */}
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-3 text-center">Will you be there?</p>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { key: 'going', label: 'Going', color: 'emerald', emoji: '🎉' },
                        { key: 'maybe', label: 'Maybe', color: 'amber', emoji: '🤔' },
                        { key: 'declined', label: "Can't Go", color: 'gray', emoji: '😢' },
                      ].map(opt => (
                        <button
                          key={opt.key}
                          onClick={() => setSelectedStatus(opt.key)}
                          className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                            selectedStatus === opt.key
                              ? opt.key === 'going'
                                ? 'border-emerald-500 bg-emerald-50 shadow-md'
                                : opt.key === 'maybe'
                                ? 'border-amber-500 bg-amber-50 shadow-md'
                                : 'border-gray-400 bg-gray-100 shadow-md'
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <span className="text-2xl">{opt.emoji}</span>
                          <span className={`text-sm font-semibold ${
                            selectedStatus === opt.key ? 'text-gray-900' : 'text-gray-600'
                          }`}>{opt.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Plus Ones */}
                  {invite?.allow_plus_ones && selectedStatus && selectedStatus !== 'declined' && (
                    <div className="p-4 bg-gray-50 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-700">Bringing guests?</p>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => setPlusOnes(Math.max(0, plusOnes - 1))}
                            disabled={plusOnes === 0}
                            className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center disabled:opacity-30"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>
                          <span className="text-lg font-bold w-4 text-center">{plusOnes}</span>
                          <button
                            onClick={() => setPlusOnes(Math.min(invite.max_plus_ones || 5, plusOnes + 1))}
                            disabled={plusOnes >= (invite.max_plus_ones || 5)}
                            className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center disabled:opacity-30"
                          >
                            <ChevronUp className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      {plusOnes > 0 && (
                        <div className="space-y-2">
                          {Array.from({ length: plusOnes }).map((_, i) => (
                            <Input
                              key={i}
                              placeholder={`Guest ${i + 1} name`}
                              value={plusOneNames[i] || ''}
                              onChange={e => {
                                const copy = [...plusOneNames];
                                copy[i] = e.target.value;
                                setPlusOneNames(copy);
                              }}
                              className="rounded-lg h-10 text-sm"
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Note */}
                  {selectedStatus && (
                    <textarea
                      placeholder="Add a note (optional)"
                      value={note}
                      onChange={e => setNote(e.target.value)}
                      rows={2}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  )}

                  {/* Submit */}
                  {selectedStatus && (
                    <Button
                      onClick={handleSubmit}
                      disabled={submitting || (isShareLink && !name.trim())}
                      className={`w-full h-14 rounded-xl text-lg font-bold transition-all ${
                        selectedStatus === 'going'
                          ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                          : selectedStatus === 'maybe'
                          ? 'bg-amber-500 hover:bg-amber-600 text-white'
                          : 'bg-gray-600 hover:bg-gray-700 text-white'
                      }`}
                    >
                      {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : `Confirm: ${statusLabels[selectedStatus]}`}
                    </Button>
                  )}

                  {error && (
                    <p className="text-sm text-red-500 text-center">{error}</p>
                  )}
                </div>
              )}

              {/* Guest List Preview */}
              {guestList.length > 0 && (
                <div className="mt-6 pt-5 border-t border-gray-100 rsvp-animate-guest-list">
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="w-4 h-4 text-gray-400" />
                    <p className="text-sm font-medium text-gray-500">
                      {guestList.filter(g => g.status === 'going').length} going
                      {guestList.filter(g => g.status === 'maybe').length > 0 &&
                        ` · ${guestList.filter(g => g.status === 'maybe').length} maybe`
                      }
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {guestList.slice(0, 12).map((g, i) => (
                      <div
                        key={i}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                          g.status === 'going' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        <span className="w-5 h-5 rounded-full bg-current/10 flex items-center justify-center text-[10px] font-bold">
                          {g.firstName[0]}
                        </span>
                        {g.firstName}
                        {g.plusOnes > 0 && <span className="text-gray-400">+{g.plusOnes}</span>}
                      </div>
                    ))}
                    {guestList.length > 12 && (
                      <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs text-gray-400 bg-gray-50">
                        +{guestList.length - 12} more
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Powered by */}
          <p className="text-center text-xs text-white/40 mt-6">
            Powered by Ticketrack
          </p>
        </div>
      </div>
    </div>
  );
}
