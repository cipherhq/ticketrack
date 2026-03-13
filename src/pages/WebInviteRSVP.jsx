import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  Loader2, Calendar, MapPin, Clock, ChevronUp, ChevronDown, Check, HelpCircle, X,
  Users, Megaphone, MessageSquare, Send, CalendarPlus, Camera, Upload,
  UtensilsCrossed, Heart, Wallet, BarChart3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  getInviteByToken,
  getGuestByRsvpToken,
  submitGuestRSVP,
  registerAndRSVP,
  getPublicGuestList,
  getPublicAnnouncements,
  getPublicWallPosts,
  createWallPost,
  markLinkViewed,
  getReactionsForInvite,
  addReaction,
  getInviteItems,
  claimItem,
  unclaimItem,
  getInvitePhotos,
  uploadPartyPhoto,
  likePhoto,
  unlikePhoto,
  getInviteQuestions,
  submitAnswers,
  getDatePollOptions,
  voteOnDateOption,
  getPublicFundInfo,
  createFundContribution,
  verifyFundContribution,
} from '@/services/partyInvites';
import { generateGoogleCalendarUrl, downloadICSFile } from '@/components/rackparty/shared';
import { supabase } from '@/lib/supabase';
import { validateImageUpload, safeImageExt } from '@/lib/utils';
import { compressImage } from '@/lib/imageCompression';

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
  const [phone, setPhone] = useState('');
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [plusOnes, setPlusOnes] = useState(0);
  const [plusOneNames, setPlusOneNames] = useState([]);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [changingResponse, setChangingResponse] = useState(false);
  const [guestList, setGuestList] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [wallPosts, setWallPosts] = useState([]);
  const [wallPostContent, setWallPostContent] = useState('');
  const [postingWall, setPostingWall] = useState(false);
  const [wallImageFile, setWallImageFile] = useState(null);
  const [wallImagePreview, setWallImagePreview] = useState(null);

  // Reactions
  const [reactions, setReactions] = useState([]);
  const REACTION_EMOJIS = ['🎉', '🔥', '❤️', '⭐', '👏', '💯'];

  // Potluck
  const [potluckItems, setPotluckItems] = useState([]);

  // Photos
  const [photos, setPhotos] = useState([]);
  const [photoCaption, setPhotoCaption] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Custom Questions
  const [questions, setQuestions] = useState([]);
  const [questionAnswers, setQuestionAnswers] = useState({});

  // Date Polling
  const [datePollOptions, setDatePollOptions] = useState([]);
  const [dateVotes, setDateVotes] = useState({});

  // Fund
  const [fundInfo, setFundInfo] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showContributeForm, setShowContributeForm] = useState(false);
  const [contributionAmount, setContributionAmount] = useState('');
  const [contributionMessage, setContributionMessage] = useState('');
  const [contributionEmail, setContributionEmail] = useState('');
  const [processingPayment, setProcessingPayment] = useState(false);

  const isShareLink = !guestRsvpToken;
  const isExpired = invite?.rsvp_deadline && new Date(invite.rsvp_deadline) < new Date();
  const hasResponded = guest?.rsvp_responded_at && !changingResponse;

  useEffect(() => {
    loadData();
  }, [token, guestRsvpToken]);

  // Detect payment return from fund contribution
  useEffect(() => {
    const ref = searchParams.get('trxref') || searchParams.get('reference');
    if (!ref) return;
    setShowDetails(true);

    async function verifyPayment() {
      try {
        const result = await verifyFundContribution(ref, 'paystack');
        if (result?.success) {
          toast.success('Contribution received! Thank you for your generosity.');
          // Reload fund data
          if (invite?.id) {
            const fi = await getPublicFundInfo(invite.id);
            setFundInfo(fi);
          }
        }
      } catch {
        // Silently handle — webhook may have already processed it
      }
    }
    verifyPayment();
  }, [searchParams, invite?.id]);

  // Auto-show details for already-responded guests
  useEffect(() => {
    if (guest?.rsvp_responded_at && !changingResponse) {
      setShowDetails(true);
    }
  }, [guest?.rsvp_responded_at, changingResponse]);

  async function loadData() {
    setLoading(true);
    try {
      if (guestRsvpToken) {
        const guestData = await getGuestByRsvpToken(guestRsvpToken);
        if (!guestData) { setError('Invite not found'); return; }
        markLinkViewed(guestRsvpToken); // fire-and-forget link view tracking
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
        // Load guest list, announcements, wall posts, and extras
        try {
          const invId = guestData.invite_id;
          const [list, anns, posts, rxns, items, pics, qs, pollOpts, fi] = await Promise.all([
            getPublicGuestList(invId),
            getPublicAnnouncements(invId).catch(() => []),
            getPublicWallPosts(invId).catch(() => []),
            getReactionsForInvite(invId).catch(() => []),
            getInviteItems(invId).catch(() => []),
            getInvitePhotos(invId).catch(() => []),
            getInviteQuestions(invId).catch(() => []),
            getDatePollOptions(invId).catch(() => []),
            getPublicFundInfo(invId).catch(() => null),
          ]);
          setGuestList(list);
          setAnnouncements(anns);
          setWallPosts(posts);
          setReactions(rxns);
          setPotluckItems(items);
          setPhotos(pics);
          setQuestions(qs);
          setDatePollOptions(pollOpts);
          setFundInfo(fi);
        } catch {}
      } else {
        const inviteData = await getInviteByToken(token);
        if (!inviteData) { setError('Invite not found'); return; }
        setInvite(inviteData);
        setOrganizer(inviteData.organizer);
        try {
          const invId = inviteData.id;
          const [list, anns, posts, rxns, items, pics, qs, pollOpts, fi] = await Promise.all([
            getPublicGuestList(invId),
            getPublicAnnouncements(invId).catch(() => []),
            getPublicWallPosts(invId).catch(() => []),
            getReactionsForInvite(invId).catch(() => []),
            getInviteItems(invId).catch(() => []),
            getInvitePhotos(invId).catch(() => []),
            getInviteQuestions(invId).catch(() => []),
            getDatePollOptions(invId).catch(() => []),
            getPublicFundInfo(invId).catch(() => null),
          ]);
          setGuestList(list);
          setAnnouncements(anns);
          setWallPosts(posts);
          setReactions(rxns);
          setPotluckItems(items);
          setPhotos(pics);
          setQuestions(qs);
          setDatePollOptions(pollOpts);
          setFundInfo(fi);
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
          phone: phone.trim() || null,
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
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
        });
      }
      setSubmitted(true);
      setChangingResponse(false);
      if (selectedStatus === 'going') { fireConfetti(); }

      // Submit custom question answers if any
      if (Object.keys(questionAnswers).length > 0 && guest?.id) {
        try {
          const answers = Object.entries(questionAnswers).map(([questionId, value]) => ({
            questionId,
            answerText: typeof value === 'string' ? value : null,
            answerChoices: Array.isArray(value) ? value : null,
          }));
          await submitAnswers(guest.id, answers);
        } catch {}
      }
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
      <div className="min-h-screen flex items-center justify-center bg-[#f5f5f7]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  // Error
  if (error && !invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f5f7] p-4">
        <div className="text-center max-w-sm bg-white rounded-2xl shadow-lg p-8">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <X className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Invite Not Found</h1>
          <p className="text-gray-500">{error}</p>
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

  function relativeTime(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  async function handleWallPost() {
    if (!wallPostContent.trim() && !wallImageFile) return;
    const authorName = name || guest?.name || 'Guest';
    setPostingWall(true);
    try {
      let imageUrl = null;
      if (wallImageFile) {
        const vErr = validateImageUpload(wallImageFile);
        if (vErr) { toast.error(vErr); setPostingWall(false); return; }
        const compressed = await compressImage(wallImageFile);
        const ext = safeImageExt(compressed);
        const path = `party-wall/${invite.id}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from('event-images').upload(path, compressed);
        if (!uploadErr) {
          const { data: { publicUrl } } = supabase.storage.from('event-images').getPublicUrl(path);
          imageUrl = publicUrl;
        }
      }
      await createWallPost(invite.id, {
        authorName,
        authorEmail: email || guest?.email || null,
        authorGuestId: guest?.id || null,
        isHost: false,
        content: wallPostContent.trim(),
        imageUrl,
      });
      setWallPostContent('');
      setWallImageFile(null);
      if (wallImagePreview) { URL.revokeObjectURL(wallImagePreview); setWallImagePreview(null); }
      const posts = await getPublicWallPosts(invite.id);
      setWallPosts(posts);
    } catch {
      // silently fail
    } finally {
      setPostingWall(false);
    }
  }

  async function handleReaction(targetGuestId, emoji) {
    const reactorName = name || guest?.name || 'Guest';
    try {
      await addReaction(invite.id, {
        targetGuestId,
        reactorName,
        reactorGuestId: guest?.id || null,
        emoji,
      });
      const rxns = await getReactionsForInvite(invite.id);
      setReactions(rxns);
    } catch {}
  }

  async function handleClaimItem(itemId) {
    const guestName = name || guest?.name || 'Guest';
    try {
      await claimItem(itemId, { guestId: guest?.id || null, guestName });
      const items = await getInviteItems(invite.id);
      setPotluckItems(items);
    } catch {}
  }

  async function handleUnclaimItem(itemId) {
    try {
      await unclaimItem(itemId);
      const items = await getInviteItems(invite.id);
      setPotluckItems(items);
    } catch {}
  }

  async function handlePhotoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const photoErr = validateImageUpload(file);
    if (photoErr) { toast.error(photoErr); return; }
    setUploadingPhoto(true);
    try {
      const compressed = await compressImage(file);
      const ext = safeImageExt(compressed);
      const path = `party-photos/${invite.id}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('event-images').upload(path, compressed);
      if (uploadErr) throw uploadErr;
      const { data: { publicUrl } } = supabase.storage.from('event-images').getPublicUrl(path);
      await uploadPartyPhoto(invite.id, {
        uploadedByName: name || guest?.name || 'Guest',
        uploadedByGuestId: guest?.id || null,
        isHost: false,
        imageUrl: publicUrl,
        caption: photoCaption.trim() || null,
      });
      setPhotoCaption('');
      const pics = await getInvitePhotos(invite.id);
      setPhotos(pics);
    } catch {}
    finally { setUploadingPhoto(false); }
  }

  async function handleDateVote(optionId, vote) {
    const voterName = name || guest?.name || 'Guest';
    try {
      await voteOnDateOption(optionId, { voterName, voterGuestId: guest?.id || null, vote });
      setDateVotes(prev => ({ ...prev, [optionId]: vote }));
      const opts = await getDatePollOptions(invite.id);
      setDatePollOptions(opts);
    } catch {}
  }

  const designMeta = invite?.design_metadata;
  const fallbackGradient = designMeta?.gradient || 'from-gray-900 via-gray-800 to-gray-900';

  function handleViewInvitation() {
    setShowDetails(true);
    setTimeout(() => {
      document.getElementById('invite-details')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      {/* HERO SECTION */}
      <div className="px-4 pt-8 sm:pt-12 pb-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col lg:flex-row lg:items-stretch lg:gap-5">
            {/* LEFT CARD — Cover Image */}
            <div className="lg:w-[55%] rounded-2xl overflow-hidden shadow-xl icloud-hero-enter relative">
              {coverImage ? (
                <div className="relative aspect-[3/4] lg:aspect-auto lg:h-[520px]">
                  <img src={coverImage} alt={invite?.title} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-7">
                    <div className="flex items-center gap-2 mb-3">
                      {organizer?.logo_url ? (
                        <img src={organizer.logo_url} alt="" className="w-6 h-6 rounded-full object-cover ring-2 ring-white/30" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center ring-2 ring-white/30">
                          <span className="text-[10px] font-bold text-white">
                            {(organizer?.business_name || 'O')[0]}
                          </span>
                        </div>
                      )}
                      <span className="text-sm text-white/80">Sent you an invitation</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
                      {invite?.title}
                    </h1>
                    <p className="text-sm text-white/80 mt-2">
                      {formatDate(invite?.start_date)} {formatTime(invite?.start_date) && `· ${formatTime(invite?.start_date)}`}
                    </p>
                  </div>
                </div>
              ) : (
                <div className={`relative aspect-[3/4] lg:aspect-auto lg:h-[520px] bg-gradient-to-br ${fallbackGradient} flex flex-col items-center justify-center p-8`}>
                  <span className="text-6xl mb-4">🎉</span>
                  <h1 className="text-2xl sm:text-3xl font-bold text-white text-center leading-tight">
                    {invite?.title}
                  </h1>
                  <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-7">
                    <div className="flex items-center gap-2 mb-2">
                      {organizer?.logo_url ? (
                        <img src={organizer.logo_url} alt="" className="w-6 h-6 rounded-full object-cover ring-2 ring-white/30" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center ring-2 ring-white/30">
                          <span className="text-[10px] font-bold text-white">
                            {(organizer?.business_name || 'O')[0]}
                          </span>
                        </div>
                      )}
                      <span className="text-sm text-white/80">Sent you an invitation</span>
                    </div>
                    <p className="text-sm text-white/80">
                      {formatDate(invite?.start_date)} {formatTime(invite?.start_date) && `· ${formatTime(invite?.start_date)}`}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT CARD — CTA (desktop only) */}
            <div className="hidden lg:flex lg:w-[45%] rounded-2xl overflow-hidden shadow-xl icloud-cta-enter relative">
              {/* Blurred cover background */}
              {coverImage && (
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{ backgroundImage: `url(${coverImage})`, filter: 'blur(20px) brightness(0.4)', transform: 'scale(1.3)' }}
                />
              )}
              <div className="absolute inset-0 icloud-glass" />
              <div className="relative z-10 flex flex-col items-center justify-center w-full p-8 text-center">
                <p className="text-xl font-semibold text-white mb-6 leading-snug">
                  View Event Details<br />and Reply
                </p>
                <button
                  onClick={handleViewInvitation}
                  className="bg-white text-gray-900 rounded-xl px-8 py-3 font-semibold text-base hover:bg-gray-100 transition-colors shadow-lg"
                >
                  View Invitation
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MOBILE CTA (below cover card) */}
      {!showDetails && (
        <div className="lg:hidden px-4 pb-6">
          <div className="max-w-md mx-auto">
            <button
              onClick={handleViewInvitation}
              className="w-full bg-white text-gray-900 rounded-xl px-8 py-3.5 font-semibold text-base shadow-lg hover:bg-gray-50 transition-colors icloud-cta-enter"
            >
              View Invitation
            </button>
          </div>
        </div>
      )}

      {/* DETAILS SECTION */}
      {showDetails && (
        <div id="invite-details" className="icloud-details-reveal px-4 pb-12">
          <div className="w-full max-w-md mx-auto mt-6">
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden p-6 sm:p-8">
              {/* Live Guest Count Banner */}
              <div className="mb-5">
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

              {/* Full Event Details */}
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-blue-500 mt-1 shrink-0" />
                  <div>
                    <p className="text-lg font-bold text-gray-900">{formatDate(invite?.start_date)}</p>
                    <p className="text-base text-gray-500 font-medium">{formatTime(invite?.start_date)}{invite?.end_date ? ` — ${formatTime(invite.end_date)}` : ''}</p>
                  </div>
                </div>
                {(invite?.venue_name || invite?.city) && (
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-blue-500 mt-1 shrink-0" />
                    <div>
                      <p className="text-lg font-bold text-gray-900">{invite?.venue_name || 'Venue TBA'}</p>
                      {invite?.city && <p className="text-base text-gray-500">{invite.address || invite.city}</p>}
                    </div>
                  </div>
                )}
              </div>

              {/* Description */}
              {invite?.description && (
                <div className="mt-5">
                  <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{invite.description}</p>
                </div>
              )}

              {/* Invite Message */}
              {invite?.message && (
                <div className="mt-5 p-4 bg-purple-50 rounded-xl border-l-4 border-purple-400">
                  <p className="text-base text-purple-800 italic leading-relaxed">"{invite.message}"</p>
                </div>
              )}

              {/* Announcements */}
              {announcements.length > 0 && (
                <div className="mt-5 space-y-2">
                  {announcements.map(a => (
                    <div key={a.id} className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                      <div className="flex items-start gap-2">
                        <Megaphone className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-blue-900">{a.title}</p>
                          <p className="text-sm text-blue-800 mt-0.5">{a.content}</p>
                          <p className="text-xs text-blue-400 mt-1">{relativeTime(a.created_at)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
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
                    <h3 className="text-xl font-bold text-gray-900">
                      {selectedStatus === 'going'
                        ? "You're on the list! Let's gooo"
                        : selectedStatus === 'maybe'
                        ? "We'll keep a spot warm for you"
                        : "We'll miss you!"}
                    </h3>
                    <p className="text-base text-gray-500 mt-1">
                      {selectedStatus === 'going'
                        ? 'Get ready for a good time'
                        : selectedStatus === 'maybe'
                        ? 'No pressure — decide whenever you want'
                        : 'Maybe next time!'}
                    </p>
                    {plusOnes > 0 && (
                      <p className="text-sm text-gray-500 mt-1">+{plusOnes} guest{plusOnes > 1 ? 's' : ''} rolling with you</p>
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

                  {/* Calendar Sync */}
                  {selectedStatus === 'going' && invite?.start_date && (
                    <div className="mt-4 flex gap-2 justify-center">
                      <a
                        href={generateGoogleCalendarUrl(invite)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <CalendarPlus className="w-4 h-4" />
                        Google Calendar
                      </a>
                      <button
                        onClick={() => downloadICSFile(invite)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <CalendarPlus className="w-4 h-4" />
                        Download .ics
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* RSVP Form */}
              {!isExpired && !submitted && !hasResponded && (
                <div className="mt-6 space-y-5">
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
                        placeholder="Email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        className="rounded-xl h-12"
                      />
                      <Input
                        type="tel"
                        placeholder="Phone number"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        className="rounded-xl h-12"
                      />
                      <p className="text-[11px] text-gray-400 text-center leading-tight">
                        So the host can keep you in the loop — no spam, just party updates
                      </p>
                    </div>
                  )}

                  {/* RSVP Buttons */}
                  <div>
                    <p className="text-base font-semibold text-gray-600 mb-4 text-center">Will you be there?</p>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { key: 'going', label: 'Going', color: 'emerald', emoji: '🎉' },
                        { key: 'maybe', label: 'Maybe', color: 'amber', emoji: '🤔' },
                        { key: 'declined', label: "Can't Go", color: 'gray', emoji: '😢' },
                      ].map(opt => (
                        <button
                          key={opt.key}
                          onClick={() => setSelectedStatus(opt.key)}
                          className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                            selectedStatus === opt.key
                              ? opt.key === 'going'
                                ? 'border-emerald-500 bg-emerald-50 shadow-lg scale-[1.03]'
                                : opt.key === 'maybe'
                                ? 'border-amber-500 bg-amber-50 shadow-lg scale-[1.03]'
                                : 'border-gray-400 bg-gray-100 shadow-lg scale-[1.03]'
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <span className="text-3xl">{opt.emoji}</span>
                          <span className={`text-base font-bold ${
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
                        <p className="text-base font-semibold text-gray-700">Bringing guests?</p>
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

                  {/* Contact info for direct RSVP guests missing email/phone */}
                  {!isShareLink && selectedStatus && (!guest?.email || !guest?.phone) && (
                    <div className="space-y-3 p-4 bg-gray-50 rounded-xl">
                      <p className="text-xs font-medium text-gray-500 text-center">Stay in the loop — drop your details so the host can reach you</p>
                      {!guest?.email && (
                        <Input
                          type="email"
                          placeholder="Email"
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          className="rounded-xl h-11"
                        />
                      )}
                      {!guest?.phone && (
                        <Input
                          type="tel"
                          placeholder="Phone number"
                          value={phone}
                          onChange={e => setPhone(e.target.value)}
                          className="rounded-xl h-11"
                        />
                      )}
                      <p className="text-[11px] text-gray-400 text-center leading-tight">
                        Only the host sees this — just for party updates, nothing else
                      </p>
                    </div>
                  )}

                  {/* Custom RSVP Questions */}
                  {selectedStatus && selectedStatus !== 'declined' && questions.length > 0 && (
                    <div className="space-y-3 p-4 bg-gray-50 rounded-xl">
                      <p className="text-sm font-semibold text-gray-700">A few questions from the host</p>
                      {questions.map(q => (
                        <div key={q.id}>
                          <label className="text-sm font-medium text-gray-700">
                            {q.question_text}{q.is_required && <span className="text-red-400 ml-0.5">*</span>}
                          </label>
                          {q.question_type === 'text' && (
                            <textarea
                              value={questionAnswers[q.id] || ''}
                              onChange={e => setQuestionAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                              placeholder="Your answer..."
                              rows={2}
                              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                            />
                          )}
                          {q.question_type === 'single_choice' && q.options?.map(opt => (
                            <label key={opt} className="flex items-center gap-2 mt-1.5 cursor-pointer">
                              <input
                                type="radio"
                                name={`q_${q.id}`}
                                checked={questionAnswers[q.id] === opt}
                                onChange={() => setQuestionAnswers(prev => ({ ...prev, [q.id]: opt }))}
                                className="w-4 h-4 text-blue-500"
                              />
                              <span className="text-sm text-gray-700">{opt}</span>
                            </label>
                          ))}
                          {q.question_type === 'multi_choice' && q.options?.map(opt => {
                            const selected = (questionAnswers[q.id] || []);
                            const isChecked = Array.isArray(selected) && selected.includes(opt);
                            return (
                              <label key={opt} className="flex items-center gap-2 mt-1.5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    setQuestionAnswers(prev => {
                                      const curr = Array.isArray(prev[q.id]) ? prev[q.id] : [];
                                      return { ...prev, [q.id]: isChecked ? curr.filter(x => x !== opt) : [...curr, opt] };
                                    });
                                  }}
                                  className="w-4 h-4 text-blue-500 rounded"
                                />
                                <span className="text-sm text-gray-700">{opt}</span>
                              </label>
                            );
                          })}
                        </div>
                      ))}
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
                <div className="mt-6 pt-5 border-t border-gray-100">
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="w-4 h-4 text-gray-400" />
                    <p className="text-base font-semibold text-gray-500">
                      {guestList.filter(g => g.status === 'going').length} going
                      {guestList.filter(g => g.status === 'maybe').length > 0 &&
                        ` · ${guestList.filter(g => g.status === 'maybe').length} maybe`
                      }
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {guestList.slice(0, 12).map((g, i) => {
                      const guestReactions = reactions.filter(r => r.target_guest_id === g.id);
                      const reactionCounts = guestReactions.reduce((acc, r) => { acc[r.emoji] = (acc[r.emoji] || 0) + 1; return acc; }, {});
                      return (
                        <div key={i} className="group relative">
                          <div
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                              g.status === 'going' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                            }`}
                          >
                            <span className="w-5 h-5 rounded-full bg-current/10 flex items-center justify-center text-[10px] font-bold">
                              {g.firstName[0]}
                            </span>
                            {g.firstName}
                            {g.plusOnes > 0 && <span className="text-gray-400">+{g.plusOnes}</span>}
                            {Object.keys(reactionCounts).length > 0 && (
                              <span className="ml-0.5 text-[10px]">
                                {Object.entries(reactionCounts).map(([emoji, count]) => `${emoji}${count > 1 ? count : ''}`).join('')}
                              </span>
                            )}
                          </div>
                          {/* Emoji picker on hover */}
                          {(submitted || hasResponded) && g.id && (
                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:flex items-center gap-0.5 px-1.5 py-1 rounded-full bg-white shadow-lg border border-gray-100 z-10">
                              {REACTION_EMOJIS.map(emoji => (
                                <button
                                  key={emoji}
                                  onClick={() => handleReaction(g.id, emoji)}
                                  className="w-6 h-6 text-sm hover:scale-125 transition-transform"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {guestList.length > 12 && (
                      <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs text-gray-400 bg-gray-50">
                        +{guestList.length - 12} more
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Date Poll */}
              {invite?.date_poll_active && datePollOptions.length > 0 && (
                <div className="mt-6 pt-5 border-t border-gray-100">
                  <div className="flex items-center gap-2 mb-3">
                    <BarChart3 className="w-4 h-4 text-gray-400" />
                    <p className="text-base font-semibold text-gray-500">Vote on a Date</p>
                  </div>
                  <p className="text-xs text-gray-400 mb-3">Help the host pick the best date</p>
                  <div className="space-y-2">
                    {datePollOptions.map(opt => {
                      const votes = opt.votes || [];
                      const yesCount = votes.filter(v => v.vote === 'yes').length;
                      const maybeVoteCount = votes.filter(v => v.vote === 'maybe').length;
                      const myVote = dateVotes[opt.id] || votes.find(v => v.voter_guest_id === guest?.id)?.vote;
                      return (
                        <div key={opt.id} className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <p className="text-sm font-semibold text-gray-900">
                                {new Date(opt.date_option).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                              </p>
                              {opt.label && <p className="text-xs text-gray-500">{opt.label}</p>}
                            </div>
                            <div className="flex items-center gap-1 text-xs text-gray-500">
                              <span className="text-emerald-600 font-medium">{yesCount} yes</span>
                              {maybeVoteCount > 0 && <span className="text-amber-600">· {maybeVoteCount} maybe</span>}
                            </div>
                          </div>
                          {(submitted || hasResponded) && (
                            <div className="flex gap-1.5">
                              {['yes', 'maybe', 'no'].map(v => (
                                <button
                                  key={v}
                                  onClick={() => handleDateVote(opt.id, v)}
                                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                    myVote === v
                                      ? v === 'yes' ? 'bg-emerald-500 text-white' : v === 'maybe' ? 'bg-amber-500 text-white' : 'bg-gray-500 text-white'
                                      : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
                                  }`}
                                >
                                  {v === 'yes' ? '👍 Yes' : v === 'maybe' ? '🤷 Maybe' : '👎 No'}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Potluck / What to Bring */}
              {potluckItems.length > 0 && (
                <div className="mt-6 pt-5 border-t border-gray-100">
                  <div className="flex items-center gap-2 mb-3">
                    <UtensilsCrossed className="w-4 h-4 text-gray-400" />
                    <p className="text-base font-semibold text-gray-500">What to Bring</p>
                  </div>
                  <div className="space-y-1.5">
                    {potluckItems.map(item => {
                      const isClaimed = !!item.claimed_by_name;
                      const isClaimedByMe = item.claimed_by_guest_id === guest?.id || item.claimed_by_name === (name || guest?.name);
                      return (
                        <div key={item.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                            isClaimed ? 'bg-emerald-100' : 'bg-gray-200'
                          }`}>
                            {isClaimed ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <span className="text-[10px] font-bold text-gray-400">{item.quantity}</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${isClaimed ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                              {item.name}
                              {item.quantity > 1 && !isClaimed && (
                                <span className="text-xs text-gray-400 ml-1">x{item.quantity}</span>
                              )}
                            </p>
                            {isClaimed && (
                              <p className="text-xs text-emerald-600">
                                {isClaimedByMe ? "You're bringing this!" : `${item.claimed_by_name} is bringing this`}
                              </p>
                            )}
                            <p className="text-[10px] text-gray-400">{item.category}</p>
                          </div>
                          {(submitted || hasResponded) && (
                            <>
                              {!isClaimed && (
                                <button
                                  onClick={() => handleClaimItem(item.id)}
                                  className="px-3 py-1 rounded-lg bg-emerald-500 text-white text-xs font-medium hover:bg-emerald-600 transition-colors"
                                >
                                  I'll bring it
                                </button>
                              )}
                              {isClaimedByMe && (
                                <button
                                  onClick={() => handleUnclaimItem(item.id)}
                                  className="px-3 py-1 rounded-lg bg-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-300 transition-colors"
                                >
                                  Undo
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Photo Gallery */}
              {(photos.length > 0 || submitted || hasResponded) && (
                <div className="mt-6 pt-5 border-t border-gray-100">
                  <div className="flex items-center gap-2 mb-3">
                    <Camera className="w-4 h-4 text-gray-400" />
                    <p className="text-base font-semibold text-gray-500">Photos</p>
                  </div>

                  {/* Upload area */}
                  {(submitted || hasResponded) && (
                    <div className="flex items-end gap-2 mb-3">
                      <Input
                        value={photoCaption}
                        onChange={e => setPhotoCaption(e.target.value)}
                        placeholder="Caption (optional)"
                        className="rounded-lg text-sm flex-1"
                      />
                      <label className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                        uploadingPhoto ? 'bg-gray-100 text-gray-400' : 'bg-blue-500 text-white hover:bg-blue-600'
                      }`}>
                        {uploadingPhoto ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                        Upload
                        <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={uploadingPhoto} />
                      </label>
                    </div>
                  )}

                  {/* Photo grid */}
                  {photos.length > 0 ? (
                    <div className="grid grid-cols-3 gap-1.5">
                      {photos.map(photo => (
                        <div key={photo.id} className="relative group aspect-square rounded-lg overflow-hidden">
                          <img src={photo.image_url} alt={photo.caption || ''} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />
                          <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                            <p className="text-white text-[10px] truncate">{photo.uploaded_by_name}</p>
                            {photo.caption && <p className="text-white/70 text-[9px] truncate">{photo.caption}</p>}
                          </div>
                          {photo.likes && photo.likes.length > 0 && (
                            <span className="absolute top-1 right-1 flex items-center gap-0.5 px-1 py-0.5 rounded-full bg-black/40 text-white text-[9px]">
                              <Heart className="w-2 h-2 fill-red-400 text-red-400" /> {photo.likes.length}
                            </span>
                          )}
                          {/* Like button on hover */}
                          {(submitted || hasResponded) && (
                            <button
                              onClick={() => likePhoto(photo.id, { likerName: name || guest?.name || 'Guest', likerGuestId: guest?.id || null })}
                              className="absolute top-1 left-1 p-1 rounded-full bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                            >
                              <Heart className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 text-center py-4">No photos yet. Be the first to share!</p>
                  )}
                </div>
              )}

              {/* Cash Fund */}
              {fundInfo && (
                <div className="mt-6 pt-5 border-t border-gray-100">
                  <div className="flex items-center gap-2 mb-3">
                    <Wallet className="w-4 h-4 text-gray-400" />
                    <p className="text-base font-semibold text-gray-500">Cash Fund</p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-100">
                    <h4 className="text-base font-bold text-gray-900">{fundInfo.title}</h4>
                    {fundInfo.description && <p className="text-sm text-gray-500 mt-0.5">{fundInfo.description}</p>}
                    <div className="mt-3">
                      <div className="flex items-end justify-between">
                        <span className="text-2xl font-bold text-emerald-700">
                          {fundInfo.currency === 'NGN' ? '₦' : fundInfo.currency === 'USD' ? '$' : fundInfo.currency === 'GBP' ? '£' : fundInfo.currency === 'EUR' ? '€' : fundInfo.currency}
                          {Number(fundInfo.total_raised || 0).toLocaleString()}
                        </span>
                        {fundInfo.goal_amount && (
                          <span className="text-xs text-gray-500">
                            of {fundInfo.currency === 'NGN' ? '₦' : fundInfo.currency === 'USD' ? '$' : fundInfo.currency}{Number(fundInfo.goal_amount).toLocaleString()} goal
                          </span>
                        )}
                      </div>
                      {fundInfo.goal_amount && (
                        <div className="w-full h-2.5 bg-white/60 rounded-full overflow-hidden mt-2">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all"
                            style={{ width: `${Math.min(100, ((fundInfo.total_raised || 0) / Number(fundInfo.goal_amount)) * 100)}%` }}
                          />
                        </div>
                      )}
                      <p className="text-xs text-gray-500 mt-2">{fundInfo.contribution_count || 0} contribution{fundInfo.contribution_count !== 1 ? 's' : ''}</p>
                    </div>

                    {/* Contribute button / form */}
                    {!showContributeForm ? (
                      <button
                        onClick={() => setShowContributeForm(true)}
                        className="w-full mt-4 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2"
                      >
                        <Wallet className="w-4 h-4" />
                        Contribute
                      </button>
                    ) : (
                      <div className="mt-4 space-y-3">
                        <div>
                          <label className="text-xs font-medium text-gray-600">Amount ({fundInfo.currency})</label>
                          <Input
                            type="number"
                            placeholder="Enter amount"
                            value={contributionAmount}
                            onChange={e => setContributionAmount(e.target.value)}
                            className="rounded-lg h-11 mt-1"
                            min="1"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-600">Your email *</label>
                          <Input
                            type="email"
                            placeholder="you@example.com"
                            value={contributionEmail || email || ''}
                            onChange={e => setContributionEmail(e.target.value)}
                            className="rounded-lg h-11 mt-1"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-600">Message (optional)</label>
                          <Input
                            placeholder="Leave a message..."
                            value={contributionMessage}
                            onChange={e => setContributionMessage(e.target.value)}
                            className="rounded-lg h-11 mt-1"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setShowContributeForm(false)}
                            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={async () => {
                              const amt = parseFloat(contributionAmount);
                              const contribEmail = contributionEmail || email || '';
                              if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return; }
                              if (!contribEmail) { toast.error('Email is required for payment'); return; }
                              setProcessingPayment(true);
                              try {
                                const result = await createFundContribution(fundInfo.id, {
                                  guestName: name || guest?.name || 'Guest',
                                  guestEmail: contribEmail,
                                  amount: amt,
                                  message: contributionMessage.trim() || null,
                                  callbackUrl: window.location.href.split('?')[0] + `?${guestRsvpToken ? `rsvp=${guestRsvpToken}&` : ''}`,
                                });
                                if (result?.success && result.authorization_url) {
                                  window.location.href = result.authorization_url;
                                } else {
                                  toast.error(result?.error || 'Failed to start payment');
                                }
                              } catch (err) {
                                toast.error('Failed to start payment. Please try again.');
                              } finally {
                                setProcessingPayment(false);
                              }
                            }}
                            disabled={processingPayment}
                            className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                          >
                            {processingPayment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
                            {processingPayment ? 'Processing...' : 'Pay Now'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Guest Wall */}
              {(submitted || hasResponded || !isShareLink) && (
                <div className="mt-6 pt-5 border-t border-gray-100">
                  <div className="flex items-center gap-2 mb-3">
                    <MessageSquare className="w-4 h-4 text-gray-400" />
                    <p className="text-base font-semibold text-gray-500">Guest Wall</p>
                  </div>

                  {/* Post form */}
                  <div className="mb-4">
                    <div className="flex gap-2">
                      <textarea
                        value={wallPostContent}
                        onChange={e => setWallPostContent(e.target.value)}
                        placeholder="Leave a message..."
                        rows={2}
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleWallPost(); } }}
                      />
                      <div className="flex flex-col gap-1 self-end">
                        <label className="p-2 text-gray-400 hover:text-blue-500 cursor-pointer transition-colors">
                          <Camera className="w-4 h-4" />
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={e => {
                              const file = e.target.files?.[0];
                              if (file && file.size <= 5 * 1024 * 1024) {
                                setWallImageFile(file);
                                setWallImagePreview(URL.createObjectURL(file));
                              }
                            }}
                          />
                        </label>
                        <button
                          onClick={handleWallPost}
                          disabled={(!wallPostContent.trim() && !wallImageFile) || postingWall}
                          className="px-3 py-2 bg-blue-500 text-white rounded-xl text-sm font-medium disabled:opacity-50 hover:bg-blue-600 transition-colors"
                        >
                          {postingWall ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    {/* Image preview */}
                    {wallImagePreview && (
                      <div className="relative mt-2 inline-block">
                        <img src={wallImagePreview} alt="Preview" className="w-20 h-20 object-cover rounded-lg" />
                        <button
                          onClick={() => { setWallImageFile(null); URL.revokeObjectURL(wallImagePreview); setWallImagePreview(null); }}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Posts */}
                  {wallPosts.length > 0 && (
                    <div className="space-y-2.5 max-h-80 overflow-y-auto">
                      {wallPosts.slice(0, 50).map(post => (
                        <div key={post.id} className="flex gap-2.5 p-2.5 rounded-lg bg-gray-50">
                          <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-gray-600">
                              {(post.author_name || '?')[0].toUpperCase()}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-semibold text-gray-900">{post.author_name}</span>
                              {post.is_host && (
                                <span className="px-1 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-700">Host</span>
                              )}
                              <span className="text-[10px] text-gray-400">{relativeTime(post.created_at)}</span>
                            </div>
                            {post.content && <p className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap break-words">{post.content}</p>}
                            {post.image_url && (
                              <img src={post.image_url} alt="" className="mt-1.5 rounded-lg max-h-48 object-cover" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Powered by */}
            <p className="text-center text-xs text-gray-400 mt-6">
              Powered by ticketRack
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
