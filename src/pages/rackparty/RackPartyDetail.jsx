import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import {
  Users, Calendar, MapPin, Loader2, ChevronLeft, Copy, Download,
  CheckCircle, HelpCircle, X, Clock, Mail, Bell, Phone, MessageCircle,
  CreditCard, AlertCircle, Trash2, Plus, UserPlus, ClipboardList, Settings2,
  RefreshCw, Image, Palette, MessageSquare, Megaphone, Activity, Pencil,
  Upload, Eye, PartyPopper,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { useOrganizer } from '@/contexts/OrganizerContext';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import {
  getInviteById,
  getInviteGuests,
  getInviteStats,
  addGuestsToInvite,
  updateInviteSettings,
  removeGuest,
  markEmailsSent,
  markReminded,
  markSmsSent,
  getFreeEmailUsage,
  incrementFreeEmailUsage,
  logActivity,
  duplicatePartyInvite,
} from '@/services/partyInvites';
import { sendPartyInviteEmail, sendPartyInviteReminderEmail } from '@/lib/emailService';
import { APP_URL, formatDateShort, statusBadge, DateTimePicker } from '@/components/rackparty/shared';
import { DesignTab } from '@/components/rackparty/DesignTab';
import { WallTab } from '@/components/rackparty/WallTab';
import { AnnouncementsTab } from '@/components/rackparty/AnnouncementsTab';
import { ActivityTab } from '@/components/rackparty/ActivityTab';

export function RackPartyDetail() {
  const { id } = useParams();
  const { organizer } = useOrganizer();
  const navigate = useNavigate();
  const location = useLocation();
  const basePath = location.pathname.startsWith('/rackparty') ? '/rackparty' : '/organizer/rackparty';

  const [invite, setInvite] = useState(null);
  const [guests, setGuests] = useState([]);
  const [stats, setStats] = useState({ total: 0, going: 0, maybe: 0, pending: 0, declined: 0 });
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState(location.state?.freshlyCreated ? 'add' : 'guests');
  const [isNewParty, setIsNewParty] = useState(location.state?.freshlyCreated === true);
  const [statusFilter, setStatusFilter] = useState('all');

  // Add guest form
  const [addMode, setAddMode] = useState('manual');
  const [manualName, setManualName] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [contactSearch, setContactSearch] = useState('');
  const [contacts, setContacts] = useState([]);
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [addingGuests, setAddingGuests] = useState(false);
  const [csvParsed, setCsvParsed] = useState([]);

  // Settings
  const [settingsTitle, setSettingsTitle] = useState('');
  const [settingsDescription, setSettingsDescription] = useState('');
  const [settingsStartDate, setSettingsStartDate] = useState('');
  const [settingsEndDate, setSettingsEndDate] = useState('');
  const [settingsVenueName, setSettingsVenueName] = useState('');
  const [settingsCity, setSettingsCity] = useState('');
  const [settingsAddress, setSettingsAddress] = useState('');
  const [settingsCoverImage, setSettingsCoverImage] = useState(null);
  const [inviteMessage, setInviteMessage] = useState('');
  const [allowPlusOnes, setAllowPlusOnes] = useState(false);
  const [maxPlusOnes, setMaxPlusOnes] = useState(1);
  const [rsvpDeadline, setRsvpDeadline] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  // Sending
  const [sendingInvites, setSendingInvites] = useState(false);
  const [sendingReminders, setSendingReminders] = useState(false);
  const [sendingSms, setSendingSms] = useState(false);

  // Inline title edit
  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState('');
  const [duplicating, setDuplicating] = useState(false);

  // Credits
  const [creditBalance, setCreditBalance] = useState(0);
  const [freeEmailsUsed, setFreeEmailsUsed] = useState(0);
  const FREE_EMAIL_LIMIT = 10;

  useEffect(() => {
    if (!organizer?.id || !id) return;
    loadInvite();
    loadCreditAndFreeEmailData();
  }, [organizer?.id, id]);

  async function loadInvite() {
    setLoading(true);
    try {
      const inv = await getInviteById(id);
      setInvite(inv);
      populateSettings(inv);
      await loadGuestsAndStats(inv.id);
    } catch (err) {
      console.error('Error loading invite:', err);
      toast.error('Party not found');
      navigate(basePath);
    } finally {
      setLoading(false);
    }
  }

  function populateSettings(inv) {
    setSettingsTitle(inv.title || '');
    setSettingsDescription(inv.description || '');
    setSettingsStartDate(inv.start_date ? inv.start_date.slice(0, 16) : '');
    setSettingsEndDate(inv.end_date ? inv.end_date.slice(0, 16) : '');
    setSettingsVenueName(inv.venue_name || '');
    setSettingsCity(inv.city || '');
    setSettingsAddress(inv.address || '');
    setSettingsCoverImage(null);
    setInviteMessage(inv.message || '');
    setAllowPlusOnes(inv.allow_plus_ones);
    setMaxPlusOnes(inv.max_plus_ones);
    setRsvpDeadline(inv.rsvp_deadline ? inv.rsvp_deadline.slice(0, 16) : '');
  }

  async function loadGuestsAndStats(inviteId) {
    try {
      const [guestList, invStats] = await Promise.all([
        getInviteGuests(inviteId),
        getInviteStats(inviteId),
      ]);
      setGuests(guestList);
      setStats(invStats);
    } catch (err) {
      console.error('Error loading guests:', err);
    }
  }

  async function loadCreditAndFreeEmailData() {
    if (!organizer?.id) return;
    try {
      const { data: bal } = await supabase
        .from('communication_credit_balances')
        .select('balance, bonus_balance')
        .eq('organizer_id', organizer.id)
        .maybeSingle();
      setCreditBalance((bal?.balance || 0) + (bal?.bonus_balance || 0));
    } catch {}
    try {
      const usage = await getFreeEmailUsage(organizer.id);
      setFreeEmailsUsed(usage);
    } catch {}
  }

  // Add guests
  async function handleAddManual() {
    if (!manualName.trim()) return;
    setAddingGuests(true);
    try {
      await addGuestsToInvite(invite.id, organizer.id, [{
        name: manualName.trim(),
        email: manualEmail.trim() || null,
        phone: manualPhone.trim() || null,
        source: 'manual',
      }]);
      setManualName(''); setManualEmail(''); setManualPhone('');
      await loadGuestsAndStats(invite.id);
      logActivity(invite.id, 'guest_added', organizer?.business_name, { count: 1 });
      toast.success('Guest added');
    } catch { toast.error('Failed to add guest'); }
    finally { setAddingGuests(false); }
  }

  function isPhoneValue(val) {
    const stripped = val.replace(/[\s\-().+]/g, '');
    return stripped.length >= 7 && /^\d+$/.test(stripped);
  }

  async function handleAddPaste() {
    if (!pasteText.trim()) return;
    setAddingGuests(true);
    try {
      const lines = pasteText.split('\n').filter(l => l.trim());
      const parsed = lines.map(line => {
        // "Name <email>"
        const angleMatch = line.match(/^(.+?)\s*<(.+?)>$/);
        if (angleMatch) return { name: angleMatch[1].trim(), email: angleMatch[2].trim(), source: 'paste' };

        // Comma-separated: split into parts
        const parts = line.split(',').map(p => p.trim()).filter(Boolean);
        if (parts.length >= 2) {
          let name = null, email = null, phone = null;
          // First part that doesn't look like email/phone is the name
          for (const part of parts) {
            if (part.includes('@')) {
              email = part;
            } else if (isPhoneValue(part)) {
              phone = part;
            } else if (!name) {
              name = part;
            }
          }
          if (name && (email || phone)) return { name, email, phone, source: 'paste' };
          // If no name detected but we have contact info, use email prefix or phone as name
          if (!name && email) return { name: email.split('@')[0], email, phone, source: 'paste' };
          if (!name && phone) return { name: phone, email: null, phone, source: 'paste' };
        }

        // Single value: email, phone, or name
        const val = line.trim();
        if (val.includes('@')) return { name: val.split('@')[0], email: val, source: 'paste' };
        if (isPhoneValue(val)) return { name: val, email: null, phone: val, source: 'paste' };
        return { name: val, email: null, source: 'paste' };
      }).filter(g => g.name);
      if (parsed.length === 0) { toast.error('No valid entries found'); return; }
      await addGuestsToInvite(invite.id, organizer.id, parsed);
      setPasteText('');
      await loadGuestsAndStats(invite.id);
      logActivity(invite.id, 'guest_added', organizer?.business_name, { count: parsed.length });
      toast.success(`${parsed.length} guest${parsed.length > 1 ? 's' : ''} added`);
    } catch { toast.error('Failed to add guests'); }
    finally { setAddingGuests(false); }
  }

  async function loadContacts() {
    try {
      let query = supabase.from('contacts').select('id, full_name, email, phone')
        .eq('organizer_id', organizer.id)
        .eq('is_active', true)
        .order('full_name')
        .limit(500);
      if (contactSearch) query = query.or(`full_name.ilike.%${contactSearch}%,email.ilike.%${contactSearch}%,phone.ilike.%${contactSearch}%`);
      const { data } = await query;
      setContacts(data || []);
    } catch {}
  }

  useEffect(() => {
    if (addMode === 'contacts' && organizer?.id) loadContacts();
  }, [addMode, contactSearch, organizer?.id]);

  async function handleAddContacts() {
    if (selectedContacts.length === 0) return;
    setAddingGuests(true);
    try {
      const toAdd = selectedContacts.map(c => ({ name: c.full_name || c.email || 'Guest', email: c.email, phone: c.phone, source: 'contacts' }));
      await addGuestsToInvite(invite.id, organizer.id, toAdd);
      setSelectedContacts([]);
      await loadGuestsAndStats(invite.id);
      logActivity(invite.id, 'guest_added', organizer?.business_name, { count: toAdd.length });
      toast.success(`${toAdd.length} guest${toAdd.length > 1 ? 's' : ''} added`);
    } catch { toast.error('Failed to add guests'); }
    finally { setAddingGuests(false); }
  }

  function handleCsvFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length === 0) { toast.error('CSV file is empty'); return; }

      // Try to detect header row
      const firstLine = lines[0].toLowerCase();
      const hasHeader = firstLine.includes('name') || firstLine.includes('email') || firstLine.includes('phone');
      const dataLines = hasHeader ? lines.slice(1) : lines;

      // Detect delimiter (comma or tab)
      const delimiter = lines[0].includes('\t') ? '\t' : ',';

      // Parse header columns if present
      let nameIdx = 0, emailIdx = -1, phoneIdx = -1;
      if (hasHeader) {
        const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
        nameIdx = headers.findIndex(h => h.includes('name'));
        emailIdx = headers.findIndex(h => h.includes('email') || h.includes('mail'));
        phoneIdx = headers.findIndex(h => h.includes('phone') || h.includes('mobile') || h.includes('tel'));
        if (nameIdx === -1) nameIdx = 0;
      } else {
        // Auto-detect by content: first col = name, look for @ = email, digits = phone
        const sampleCols = dataLines[0].split(delimiter).map(c => c.trim().replace(/['"]/g, ''));
        sampleCols.forEach((col, i) => {
          if (i === 0) return; // assume first is name
          if (col.includes('@')) emailIdx = i;
          else if (isPhoneValue(col)) phoneIdx = i;
        });
      }

      const parsed = dataLines.map(line => {
        const cols = line.split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''));
        const name = cols[nameIdx] || '';
        const email = emailIdx >= 0 ? cols[emailIdx] || null : null;
        const phone = phoneIdx >= 0 ? cols[phoneIdx] || null : null;
        // If no explicit column detection, check remaining columns
        let detectedEmail = email, detectedPhone = phone;
        if (emailIdx === -1 || phoneIdx === -1) {
          cols.forEach((col, i) => {
            if (i === nameIdx) return;
            if (!detectedEmail && col.includes('@')) detectedEmail = col;
            else if (!detectedPhone && isPhoneValue(col)) detectedPhone = col;
          });
        }
        return { name: name.trim(), email: detectedEmail || null, phone: detectedPhone || null, source: 'csv' };
      }).filter(g => g.name);

      setCsvParsed(parsed);
    };
    reader.readAsText(file);
  }

  async function handleAddCsv() {
    if (csvParsed.length === 0) return;
    setAddingGuests(true);
    try {
      await addGuestsToInvite(invite.id, organizer.id, csvParsed);
      setCsvParsed([]);
      await loadGuestsAndStats(invite.id);
      logActivity(invite.id, 'guest_added', organizer?.business_name, { count: csvParsed.length, source: 'csv' });
      toast.success(`${csvParsed.length} guest${csvParsed.length > 1 ? 's' : ''} added from CSV`);
    } catch { toast.error('Failed to add guests'); }
    finally { setAddingGuests(false); }
  }

  async function handleRemoveGuest(guestId) {
    try { await removeGuest(guestId); await loadGuestsAndStats(invite.id); toast.success('Guest removed'); }
    catch { toast.error('Failed to remove guest'); }
  }

  // Settings
  async function handleUploadCoverImage(file) {
    if (!file) return null;
    const ext = file.name.split('.').pop();
    const path = `party-invites/${organizer.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('event-images').upload(path, file);
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from('event-images').getPublicUrl(path);
    return publicUrl;
  }

  async function handleSaveSettings() {
    setSavingSettings(true);
    try {
      let coverImageUrl = invite.cover_image_url;
      if (settingsCoverImage) coverImageUrl = await handleUploadCoverImage(settingsCoverImage);
      const updated = await updateInviteSettings(invite.id, {
        title: settingsTitle, description: settingsDescription,
        startDate: settingsStartDate ? new Date(settingsStartDate).toISOString() : null,
        endDate: settingsEndDate ? new Date(settingsEndDate).toISOString() : null,
        venueName: settingsVenueName, city: settingsCity, address: settingsAddress,
        coverImageUrl, message: inviteMessage, allowPlusOnes, maxPlusOnes,
        rsvpDeadline: rsvpDeadline ? new Date(rsvpDeadline).toISOString() : null,
      });
      setInvite(updated); setSettingsCoverImage(null);
      logActivity(invite.id, 'settings_updated', organizer?.business_name);
      toast.success('Settings saved');
    } catch { toast.error('Failed to save settings'); }
    finally { setSavingSettings(false); }
  }

  // Sending
  const freeEmailsRemaining = Math.max(0, FREE_EMAIL_LIMIT - freeEmailsUsed);
  const unsentEmailGuests = guests.filter(g => g.email && !g.email_sent_at);
  const unsentSmsGuests = guests.filter(g => g.phone && !g.sms_sent_at);
  const freeEmailsToUse = Math.min(freeEmailsRemaining, unsentEmailGuests.length);
  const paidEmailCount = Math.max(0, unsentEmailGuests.length - freeEmailsToUse);
  const emailCreditsNeeded = paidEmailCount;
  const smsCreditsNeeded = unsentSmsGuests.length * 5;

  async function handleSendInvites() {
    if (unsentEmailGuests.length === 0) { toast.info('No unsent guests with email addresses'); return; }
    if (paidEmailCount > 0 && creditBalance < emailCreditsNeeded) {
      toast.error(`Insufficient credits. You need ${emailCreditsNeeded} credits for ${paidEmailCount} paid email${paidEmailCount > 1 ? 's' : ''}. Buy credits from the credit banner above.`);
      return;
    }
    setSendingInvites(true);
    try {
      let sent = 0, freeUsed = 0;
      const sentIds = [];
      for (const g of unsentEmailGuests) {
        const isFree = freeUsed < freeEmailsToUse;
        if (!isFree) {
          const { error: deductError } = await supabase.rpc('deduct_communication_credits', {
            p_organizer_id: organizer.id, p_amount: 1,
            p_description: `Party invite email to ${g.email}`,
          });
          if (deductError) {
            if (sent > 0) toast.warning(`Sent ${sent} invites but ran out of credits.`);
            else toast.error('Failed to deduct credits');
            break;
          }
        }
        const rsvpUrl = `${APP_URL}/invite/${invite.share_token}?rsvp=${g.rsvp_token}`;
        const result = await sendPartyInviteEmail(g.email, {
          eventTitle: invite.title, eventDate: invite.start_date,
          venueName: invite.venue_name, city: invite.city,
          eventImage: invite.cover_image_url, organizerName: organizer?.business_name,
          message: invite.message, rsvpUrl,
        }, organizer.id);
        if (result?.success === false) {
          console.error(`Email failed for ${g.email}:`, result.error);
          if (sent === 0) { toast.error(`Email failed: ${result.error || 'Unknown error'}`); break; }
          toast.warning(`Sent ${sent} but failed on ${g.email}: ${result.error}`);
          break;
        }
        sentIds.push(g.id); sent++;
        if (isFree) freeUsed++;
      }
      if (sentIds.length > 0) {
        await markEmailsSent(sentIds);
        if (freeUsed > 0) await incrementFreeEmailUsage(organizer.id, freeUsed);
        await loadGuestsAndStats(invite.id);
        await loadCreditAndFreeEmailData();
        logActivity(invite.id, 'email_sent', organizer?.business_name, { count: sent });
        const freeNote = freeUsed > 0 ? ` (${freeUsed} free)` : '';
        toast.success(`${sent} invite${sent > 1 ? 's' : ''} sent!${freeNote}`);
      }
    } catch (err) { console.error('Send error:', err); toast.error('Error sending invites'); }
    finally { setSendingInvites(false); }
  }

  async function handleSendReminders() {
    const pending = guests.filter(g => g.email && g.rsvp_status === 'pending' && g.email_sent_at);
    if (pending.length === 0) { toast.info('No pending guests to remind'); return; }
    setSendingReminders(true);
    try {
      let sent = 0;
      const sentIds = [];
      for (const g of pending) {
        const rsvpUrl = `${APP_URL}/invite/${invite.share_token}?rsvp=${g.rsvp_token}`;
        const result = await sendPartyInviteReminderEmail(g.email, {
          eventTitle: invite.title, eventDate: invite.start_date,
          venueName: invite.venue_name, city: invite.city,
          rsvpUrl, goingCount: stats.going,
        }, organizer.id);
        if (result?.success === false) {
          console.error(`Reminder failed for ${g.email}:`, result.error);
          if (sent === 0) { toast.error(`Reminder failed: ${result.error || 'Unknown error'}`); break; }
          toast.warning(`Sent ${sent} reminders but failed on ${g.email}`);
          break;
        }
        sentIds.push(g.id); sent++;
      }
      if (sentIds.length > 0) {
        await markReminded(sentIds);
        await loadGuestsAndStats(invite.id);
        logActivity(invite.id, 'reminder_sent', organizer?.business_name, { count: sent });
        toast.success(`${sent} reminder${sent > 1 ? 's' : ''} sent!`);
      }
    } catch (err) { console.error('Reminder error:', err); toast.error('Error sending reminders'); }
    finally { setSendingReminders(false); }
  }

  async function handleSendSmsInvites() {
    if (unsentSmsGuests.length === 0) { toast.info('No unsent guests with phone numbers'); return; }
    if (creditBalance < smsCreditsNeeded) {
      toast.error(`Insufficient credits. You need ${smsCreditsNeeded} credits for ${unsentSmsGuests.length} SMS (5 credits each). Buy credits from the credit banner above.`);
      return;
    }
    setSendingSms(true);
    try {
      let sent = 0;
      const sentIds = [];
      for (const g of unsentSmsGuests) {
        const rsvpUrl = `${APP_URL}/invite/${invite.share_token}?rsvp=${g.rsvp_token}`;
        const message = `You're invited to ${invite.title}! RSVP here: ${rsvpUrl}${invite.message ? `\n\n${invite.message}` : ''}\n\n- ${organizer?.business_name}`;
        const { error: smsError } = await supabase.functions.invoke('send-sms', {
          body: { organizer_id: organizer.id, phone: g.phone, message },
        });
        if (smsError) {
          if (sent > 0) toast.warning(`Sent ${sent} SMS but encountered an error.`);
          else toast.error('Failed to send SMS');
          break;
        }
        sentIds.push(g.id); sent++;
      }
      if (sentIds.length > 0) {
        await markSmsSent(sentIds);
        await loadGuestsAndStats(invite.id);
        await loadCreditAndFreeEmailData();
        logActivity(invite.id, 'sms_sent', organizer?.business_name, { count: sent });
        toast.success(`${sent} SMS invite${sent > 1 ? 's' : ''} sent!`);
      }
    } catch (err) { console.error('SMS error:', err); toast.error('Error sending SMS invites'); }
    finally { setSendingSms(false); }
  }

  function copyShareLink() {
    const url = `${APP_URL}/invite/${invite.share_token}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copied!');
  }

  const flyerRef = useRef(null);
  async function handleDownloadFlyerWithQR() {
    if (!flyerRef.current) return;
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(flyerRef.current, {
        scale: 2, useCORS: true, backgroundColor: '#ffffff', width: 600, height: 900,
      });
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(invite.title || 'party').replace(/\s+/g, '-')}-flyer.png`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Flyer downloaded!');
    } catch (err) { console.error('Flyer error:', err); toast.error('Failed to generate flyer'); }
  }

  // Inline title edit
  async function handleSaveTitle() {
    if (!editTitleValue.trim() || editTitleValue.trim() === invite.title) {
      setEditingTitle(false);
      return;
    }
    try {
      const updated = await updateInviteSettings(invite.id, { title: editTitleValue.trim() });
      setInvite(updated);
      setSettingsTitle(updated.title);
      logActivity(invite.id, 'title_changed', organizer?.business_name, { title: editTitleValue.trim() });
      toast.success('Title updated');
    } catch {
      toast.error('Failed to update title');
    }
    setEditingTitle(false);
  }

  // Duplicate party
  async function handleDuplicate() {
    setDuplicating(true);
    try {
      const copy = await duplicatePartyInvite(invite.id, organizer.id);
      toast.success('Party duplicated!');
      navigate(`${basePath}/${copy.id}`);
    } catch (err) {
      console.error('Duplicate error:', err);
      toast.error('Failed to duplicate party');
    } finally {
      setDuplicating(false);
    }
  }

  // Enhanced stats: total expected = going + sum of plus_ones from going guests
  const totalExpected = guests
    .filter(g => g.rsvp_status === 'going')
    .reduce((sum, g) => sum + 1 + (g.plus_ones || 0), 0);

  const filteredGuests = statusFilter === 'all' ? guests : guests.filter(g => g.rsvp_status === statusFilter);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!invite) return null;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Button variant="ghost" size="sm" onClick={() => navigate(basePath)} className="gap-1 px-2 sm:px-3 shrink-0">
            <ChevronLeft className="w-4 h-4" /> <span className="hidden sm:inline">Back</span>
          </Button>
          <div className="min-w-0">
            {editingTitle ? (
              <input
                autoFocus
                value={editTitleValue}
                onChange={e => setEditTitleValue(e.target.value)}
                onBlur={handleSaveTitle}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveTitle(); if (e.key === 'Escape') setEditingTitle(false); }}
                className="text-lg sm:text-2xl font-bold text-gray-900 border-b-2 border-primary bg-transparent outline-none w-full"
              />
            ) : (
              <h1
                className="text-lg sm:text-2xl font-bold text-gray-900 cursor-pointer hover:text-primary/80 transition-colors group flex items-center gap-2 truncate"
                onClick={() => { setEditTitleValue(invite.title || ''); setEditingTitle(true); }}
                title="Click to edit title"
              >
                {invite.title || 'Untitled Invite'}
                <Pencil className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </h1>
            )}
            {invite.start_date && (
              <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                <Calendar className="w-3.5 h-3.5" />
                {formatDateShort(invite.start_date)}
                {invite.venue_name && <><span className="mx-1">·</span><MapPin className="w-3.5 h-3.5" />{invite.venue_name}</>}
              </p>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDuplicate}
          disabled={duplicating}
          className="rounded-xl gap-1.5"
        >
          {duplicating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
          Duplicate
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-3">
        {[
          { label: 'Going', count: stats.going, color: 'text-emerald-600', bg: 'bg-emerald-50', icon: CheckCircle },
          { label: 'Maybe', count: stats.maybe, color: 'text-amber-600', bg: 'bg-amber-50', icon: HelpCircle },
          { label: 'Pending', count: stats.pending, color: 'text-blue-600', bg: 'bg-blue-50', icon: Clock },
          { label: 'Declined', count: stats.declined, color: 'text-gray-500', bg: 'bg-gray-50', icon: X },
          { label: 'Expected', count: totalExpected, color: 'text-violet-600', bg: 'bg-violet-50', icon: Users },
        ].map(s => (
          <Card key={s.label} className="rounded-2xl">
            <CardContent className="p-2.5 sm:p-4 text-center">
              <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full ${s.bg} flex items-center justify-center mx-auto mb-1.5 sm:mb-2`}>
                <s.icon className={`w-4 h-4 sm:w-5 sm:h-5 ${s.color}`} />
              </div>
              <p className="text-xl sm:text-2xl font-bold text-gray-900">{s.count}</p>
              <p className="text-[10px] sm:text-xs text-gray-500">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Credit Info Banner */}
      {guests.length > 0 && (
        <Card className="rounded-2xl border-blue-200 bg-blue-50/50">
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Mail className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600" />
                <span className="text-xs sm:text-sm font-medium text-blue-900">
                  Free: <span className="font-bold">{freeEmailsRemaining}/{FREE_EMAIL_LIMIT}</span>
                </span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <CreditCard className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600" />
                <span className="text-xs sm:text-sm font-medium text-blue-900">
                  Credits: <span className="font-bold">{creditBalance}</span>
                </span>
              </div>
              <a
                href="/organizer/credits"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto text-xs sm:text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
              >
                Buy Credits
              </a>
            </div>
            {paidEmailCount > 0 && (
              <p className="text-xs text-amber-700 mt-2 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {paidEmailCount} email{paidEmailCount > 1 ? 's' : ''} will use {emailCreditsNeeded} credit{emailCreditsNeeded > 1 ? 's' : ''} (1 per email)
              </p>
            )}
            {unsentSmsGuests.length > 0 && (
              <p className="text-xs text-emerald-700 mt-1 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5" />
                SMS sending costs 5 credits each ({smsCreditsNeeded} credits for {unsentSmsGuests.length} SMS)
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      {guests.length > 0 && (
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
          <Button
            onClick={handleSendInvites}
            disabled={sendingInvites || unsentEmailGuests.length === 0 || (paidEmailCount > 0 && creditBalance < emailCreditsNeeded)}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl gap-1.5 text-xs sm:text-sm"
          >
            {sendingInvites ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4 shrink-0" />}
            <span className="truncate">Email ({unsentEmailGuests.length})</span>
          </Button>
          <Button
            onClick={handleSendSmsInvites}
            disabled={sendingSms || unsentSmsGuests.length === 0 || creditBalance < smsCreditsNeeded}
            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl gap-1.5 text-xs sm:text-sm"
          >
            {sendingSms ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4 shrink-0" />}
            <span className="truncate">SMS ({unsentSmsGuests.length})</span>
          </Button>
          <Button
            onClick={handleSendReminders}
            disabled={sendingReminders || guests.filter(g => g.email && g.rsvp_status === 'pending' && g.email_sent_at).length === 0}
            variant="outline" className="rounded-xl gap-1.5 text-xs sm:text-sm"
          >
            {sendingReminders ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4 shrink-0" />}
            <span className="truncate">Remind ({guests.filter(g => g.email && g.rsvp_status === 'pending' && g.email_sent_at).length})</span>
          </Button>
          <Button variant="outline" onClick={copyShareLink} className="rounded-xl gap-1.5 text-xs sm:text-sm">
            <Copy className="w-4 h-4 shrink-0" /> <span className="truncate">Share Link</span>
          </Button>
          <Button variant="outline" onClick={handleDownloadFlyerWithQR} className="rounded-xl gap-1.5 text-xs sm:text-sm col-span-2 sm:col-span-1">
            <Download className="w-4 h-4 shrink-0" /> <span className="truncate">Flyer with QR</span>
          </Button>
        </div>
      )}

      {/* Hidden QR flyer for capture */}
      <div style={{ position: 'absolute', left: -9999, top: -9999 }}>
        <div ref={flyerRef} style={{ width: 600, height: 900, background: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', position: 'relative', overflow: 'hidden' }}>
          <div style={{ height: 400, position: 'relative', overflow: 'hidden' }}>
            {invite.cover_image_url ? (
              <img src={invite.cover_image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} crossOrigin="anonymous" />
            ) : (
              <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #8b5cf6, #ec4899)' }} />
            )}
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.6))' }} />
            <div style={{ position: 'absolute', bottom: 24, left: 32, right: 32, color: '#fff' }}>
              <div style={{ fontSize: 36, fontWeight: 900, lineHeight: 1.2, textShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
                {invite.title}
              </div>
            </div>
          </div>
          <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {invite.start_date && (
              <div style={{ fontSize: 18, color: '#374151', fontWeight: 600 }}>
                {format(new Date(invite.start_date), 'EEE, MMM d, yyyy · h:mm a')}
              </div>
            )}
            {invite.venue_name && (
              <div style={{ fontSize: 16, color: '#6b7280' }}>
                📍 {invite.venue_name}{invite.city ? `, ${invite.city}` : ''}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, color: '#9ca3af', marginBottom: 4 }}>Scan to RSVP</div>
                <div style={{ fontSize: 12, color: '#d1d5db', wordBreak: 'break-all' }}>
                  {`${APP_URL}/invite/${invite.share_token}`}
                </div>
              </div>
              <QRCodeSVG value={`${APP_URL}/invite/${invite.share_token}`} size={120} level="M" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 gap-0.5 sm:gap-1 overflow-x-auto scrollbar-hide -mx-1 px-1">
        {[
          { id: 'guests', label: 'Guests', icon: Users },
          { id: 'add', label: 'Add', icon: UserPlus },
          { id: 'design', label: 'Design', icon: Palette },
          { id: 'wall', label: 'Wall', icon: MessageSquare },
          { id: 'announcements', label: 'Announce', icon: Megaphone },
          { id: 'activity', label: 'Activity', icon: Activity },
          { id: 'settings', label: 'Settings', icon: Settings2 },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Guest List */}
      {activeTab === 'guests' && (
        <Card className="rounded-2xl">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-4">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px] rounded-lg h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All ({stats.total})</SelectItem>
                  <SelectItem value="going">Going ({stats.going})</SelectItem>
                  <SelectItem value="maybe">Maybe ({stats.maybe})</SelectItem>
                  <SelectItem value="pending">Pending ({stats.pending})</SelectItem>
                  <SelectItem value="declined">Declined ({stats.declined})</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" size="sm" onClick={() => loadGuestsAndStats(invite.id)} className="gap-1">
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </Button>
            </div>
            {filteredGuests.length === 0 ? (
              <div className="text-center py-12">
                <UserPlus className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 mb-3">No guests yet</p>
                <Button onClick={() => setActiveTab('add')} className="rounded-xl gap-2">
                  <UserPlus className="w-4 h-4" /> Add Guests
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b">
                      <th className="pb-2 font-medium">Name</th>
                      <th className="pb-2 font-medium hidden sm:table-cell">Email</th>
                      <th className="pb-2 font-medium hidden md:table-cell">Phone</th>
                      <th className="pb-2 font-medium">RSVP</th>
                      <th className="pb-2 font-medium hidden md:table-cell">Sent</th>
                      <th className="pb-2 font-medium w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredGuests.map(g => (
                      <tr key={g.id} className="hover:bg-gray-50">
                        <td className="py-3">
                          <div>
                            <p className="font-medium text-gray-900">{g.name}</p>
                            <p className="text-xs text-gray-400 sm:hidden">{g.email || '\u2014'}</p>
                          </div>
                        </td>
                        <td className="py-3 hidden sm:table-cell text-gray-600">{g.email || '\u2014'}</td>
                        <td className="py-3 hidden md:table-cell text-gray-600">{g.phone || '\u2014'}</td>
                        <td className="py-3">
                          {statusBadge(g.rsvp_status)}
                          {g.plus_ones > 0 && <span className="ml-1 text-xs text-gray-400">+{g.plus_ones}</span>}
                        </td>
                        <td className="py-3 hidden md:table-cell">
                          <div className="flex items-center gap-2">
                            {g.email_sent_at ? (
                              <span className="text-xs text-blue-600 flex items-center gap-1" title="Email sent">
                                <Mail className="w-3 h-3" /> <CheckCircle className="w-3 h-3" />
                              </span>
                            ) : g.email ? (
                              <span className="text-xs text-gray-400 flex items-center gap-1" title="Email not sent">
                                <Mail className="w-3 h-3" />
                              </span>
                            ) : null}
                            {g.sms_sent_at ? (
                              <span className="text-xs text-emerald-600 flex items-center gap-1" title="SMS sent">
                                <Phone className="w-3 h-3" /> <CheckCircle className="w-3 h-3" />
                              </span>
                            ) : g.phone ? (
                              <span className="text-xs text-gray-400 flex items-center gap-1" title="SMS not sent">
                                <Phone className="w-3 h-3" />
                              </span>
                            ) : null}
                            {g.link_viewed_at && (
                              <span className="text-xs text-purple-600 flex items-center gap-1" title={`Link viewed ${new Date(g.link_viewed_at).toLocaleString()}`}>
                                <Eye className="w-3 h-3" />
                              </span>
                            )}
                            {!g.email && !g.phone && <span className="text-xs text-gray-400">No contact</span>}
                          </div>
                        </td>
                        <td className="py-3">
                          <button onClick={() => handleRemoveGuest(g.id)} className="p-1 text-gray-400 hover:text-red-500 transition-colors" title="Remove guest">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab: Add Guests */}
      {activeTab === 'add' && (
        <Card className="rounded-2xl">
          <CardContent className="p-3 sm:p-4 space-y-4">
            {/* Welcome banner for freshly created party */}
            {isNewParty && guests.length === 0 && (
              <div className="rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 p-4 sm:p-5 text-white">
                <div className="flex items-center gap-2 mb-2">
                  <PartyPopper className="w-5 h-5 sm:w-6 sm:h-6" />
                  <h3 className="text-base sm:text-lg font-bold">Party created! Now add your guests</h3>
                </div>
                <p className="text-sm text-white/90">
                  Add guests manually, paste a list, import from contacts, or upload a CSV. You can use email, phone, or both.
                </p>
              </div>
            )}

            {/* "Ready to send?" prompt when guests have been added */}
            {isNewParty && guests.length > 0 && (
              <div className="rounded-xl bg-gradient-to-r from-blue-500 to-emerald-500 p-4 sm:p-5 text-white space-y-3">
                <h3 className="text-base sm:text-lg font-bold">Ready to send?</h3>
                <p className="text-sm text-white/90">
                  You have <span className="font-bold">{guests.length}</span> guest{guests.length !== 1 ? 's' : ''}.{' '}
                  <span className="font-bold">{guests.filter(g => g.email).length}</span> with email.{' '}
                  <span className="font-bold">{guests.filter(g => g.phone).length}</span> with phone.
                </p>
                <div className="flex flex-wrap gap-2">
                  {unsentEmailGuests.length > 0 && (
                    <Button
                      onClick={handleSendInvites}
                      disabled={sendingInvites || (paidEmailCount > 0 && creditBalance < emailCreditsNeeded)}
                      className="bg-white text-blue-700 hover:bg-blue-50 rounded-xl gap-1.5 text-xs sm:text-sm"
                    >
                      {sendingInvites ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                      Send Email ({unsentEmailGuests.length})
                    </Button>
                  )}
                  {unsentSmsGuests.length > 0 && (
                    <Button
                      onClick={handleSendSmsInvites}
                      disabled={sendingSms || creditBalance < smsCreditsNeeded}
                      className="bg-white text-emerald-700 hover:bg-emerald-50 rounded-xl gap-1.5 text-xs sm:text-sm"
                    >
                      {sendingSms ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
                      Send SMS ({unsentSmsGuests.length})
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => { setIsNewParty(false); setActiveTab('guests'); }}
                    className="border-white/40 text-white hover:bg-white/20 rounded-xl gap-1.5 text-xs sm:text-sm"
                  >
                    <Users className="w-4 h-4" /> View Guest List
                  </Button>
                </div>
                {((paidEmailCount > 0 && creditBalance < emailCreditsNeeded) || (unsentSmsGuests.length > 0 && creditBalance < smsCreditsNeeded)) && (
                  <div className="rounded-lg bg-amber-500/20 border border-amber-300/40 p-3 mt-1">
                    <p className="text-sm text-white flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      You need more credits to send all invites.{' '}
                      <a
                        href="/organizer/credits"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-bold underline hover:no-underline"
                      >
                        Buy Credits
                      </a>
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 sm:flex gap-2">
              {[
                { id: 'manual', label: 'Manual', fullLabel: 'Manual Entry', icon: Plus },
                { id: 'paste', label: 'Paste', fullLabel: 'Paste List', icon: ClipboardList },
                { id: 'contacts', label: 'Contacts', fullLabel: 'From Contacts', icon: Users },
                { id: 'upload', label: 'CSV', fullLabel: 'Upload CSV', icon: Upload },
              ].map(m => (
                <button
                  key={m.id} onClick={() => { setAddMode(m.id); if (m.id !== 'upload') setCsvParsed([]); }}
                  className={`px-3 py-2 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center justify-center sm:justify-start gap-1.5 ${
                    addMode === m.id ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {m.icon && <m.icon className="w-3.5 h-3.5" />}
                  <span className="sm:hidden">{m.label}</span>
                  <span className="hidden sm:inline">{m.fullLabel}</span>
                </button>
              ))}
            </div>
            {addMode === 'manual' && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Name *</Label>
                    <Input value={manualName} onChange={e => setManualName(e.target.value)} placeholder="Jane Doe" className="rounded-lg mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">Email</Label>
                    <Input type="email" value={manualEmail} onChange={e => setManualEmail(e.target.value)} placeholder="jane@email.com" className="rounded-lg mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">Phone</Label>
                    <Input value={manualPhone} onChange={e => setManualPhone(e.target.value)} placeholder="+234..." className="rounded-lg mt-1" />
                  </div>
                </div>
                <Button onClick={handleAddManual} disabled={!manualName.trim() || addingGuests} className="rounded-xl gap-2">
                  {addingGuests ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Add Guest
                </Button>
              </div>
            )}
            {addMode === 'paste' && (
              <div className="space-y-3">
                <p className="text-xs text-gray-500">
                  One guest per line. Formats: "Name &lt;email&gt;", "Name, email", "Name, phone", or just email/phone
                </p>
                <textarea
                  value={pasteText} onChange={e => setPasteText(e.target.value)}
                  placeholder={"Jane Doe <jane@email.com>\nJohn Smith, john@email.com\nAda, 08012345678\nfriend@email.com"}
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
                <Button onClick={handleAddPaste} disabled={!pasteText.trim() || addingGuests} className="rounded-xl gap-2">
                  {addingGuests ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardList className="w-4 h-4" />}
                  Add Guests
                </Button>
              </div>
            )}
            {addMode === 'contacts' && (
              <div className="space-y-3">
                <Input value={contactSearch} onChange={e => setContactSearch(e.target.value)} placeholder="Search contacts..." className="rounded-lg" />
                <div className="max-h-60 overflow-y-auto space-y-1 border rounded-xl p-2">
                  {contacts.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">No contacts found</p>
                  ) : contacts.map(c => {
                    const isSelected = selectedContacts.some(sc => sc.id === c.id);
                    return (
                      <button
                        key={c.id}
                        onClick={() => setSelectedContacts(prev => isSelected ? prev.filter(sc => sc.id !== c.id) : [...prev, c])}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                          isSelected ? 'bg-primary/10 border border-primary/20' : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                          isSelected ? 'bg-primary border-primary' : 'border-gray-300'
                        }`}>
                          {isSelected && <CheckCircle className="w-3 h-3 text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{c.full_name || c.email || 'Unknown'}</p>
                          <p className="text-xs text-gray-400 truncate">{c.email || c.phone || '\u2014'}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <Button onClick={handleAddContacts} disabled={selectedContacts.length === 0 || addingGuests} className="rounded-xl gap-2">
                  {addingGuests ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  Add {selectedContacts.length} Contact{selectedContacts.length !== 1 ? 's' : ''}
                </Button>
              </div>
            )}
            {addMode === 'upload' && (
              <div className="space-y-3">
                <p className="text-xs text-gray-500">
                  Upload a CSV or text file with columns: name, phone, email. Header row is auto-detected.
                </p>
                <label className="flex items-center gap-3 px-4 py-6 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-primary/40 hover:bg-gray-50 transition-colors">
                  <Upload className="w-5 h-5 text-gray-400" />
                  <span className="text-sm text-gray-500">{csvParsed.length > 0 ? `${csvParsed.length} guests parsed` : 'Choose .csv or .txt file'}</span>
                  <input
                    type="file"
                    accept=".csv,.txt"
                    className="hidden"
                    onChange={e => { handleCsvFile(e.target.files[0]); e.target.value = ''; }}
                  />
                </label>
                {csvParsed.length > 0 && (
                  <>
                    <div className="max-h-60 overflow-y-auto border rounded-xl">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-gray-500 border-b bg-gray-50">
                            <th className="px-3 py-2 font-medium">Name</th>
                            <th className="px-3 py-2 font-medium">Email</th>
                            <th className="px-3 py-2 font-medium">Phone</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {csvParsed.slice(0, 50).map((g, i) => (
                            <tr key={i} className="hover:bg-gray-50">
                              <td className="px-3 py-2 text-gray-900">{g.name}</td>
                              <td className="px-3 py-2 text-gray-600">{g.email || '\u2014'}</td>
                              <td className="px-3 py-2 text-gray-600">{g.phone || '\u2014'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {csvParsed.length > 50 && (
                        <p className="text-xs text-gray-400 text-center py-2">Showing 50 of {csvParsed.length} guests</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleAddCsv} disabled={addingGuests} className="rounded-xl gap-2">
                        {addingGuests ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        Add {csvParsed.length} Guest{csvParsed.length !== 1 ? 's' : ''}
                      </Button>
                      <Button variant="outline" onClick={() => setCsvParsed([])} className="rounded-xl">
                        Clear
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab: Design */}
      {activeTab === 'design' && (
        <Card className="rounded-2xl">
          <CardContent className="p-3 sm:p-4">
            <DesignTab invite={invite} organizer={organizer} onInviteUpdate={setInvite} />
          </CardContent>
        </Card>
      )}

      {/* Tab: Wall */}
      {activeTab === 'wall' && (
        <Card className="rounded-2xl">
          <CardContent className="p-3 sm:p-4">
            <WallTab invite={invite} organizer={organizer} />
          </CardContent>
        </Card>
      )}

      {/* Tab: Announcements */}
      {activeTab === 'announcements' && (
        <Card className="rounded-2xl">
          <CardContent className="p-3 sm:p-4">
            <AnnouncementsTab invite={invite} organizer={organizer} />
          </CardContent>
        </Card>
      )}

      {/* Tab: Activity */}
      {activeTab === 'activity' && (
        <Card className="rounded-2xl">
          <CardContent className="p-3 sm:p-4">
            <ActivityTab invite={invite} />
          </CardContent>
        </Card>
      )}

      {/* Tab: Settings */}
      {activeTab === 'settings' && (
        <Card className="rounded-2xl">
          <CardContent className="p-3 sm:p-4 space-y-5">
            <div>
              <Label className="text-sm font-medium">Title</Label>
              <Input value={settingsTitle} onChange={e => setSettingsTitle(e.target.value)} placeholder="Invite title" className="rounded-xl mt-1" />
            </div>
            <div>
              <Label className="text-sm font-medium">Description</Label>
              <textarea value={settingsDescription} onChange={e => setSettingsDescription(e.target.value)} placeholder="Describe your event..." rows={3} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DateTimePicker label="Start Date & Time" value={settingsStartDate} onChange={setSettingsStartDate} />
              <DateTimePicker label="End Date & Time" value={settingsEndDate} onChange={setSettingsEndDate} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label className="text-sm font-medium">Venue Name</Label>
                <Input value={settingsVenueName} onChange={e => setSettingsVenueName(e.target.value)} placeholder="Venue name" className="rounded-xl mt-1" />
              </div>
              <div>
                <Label className="text-sm font-medium">City</Label>
                <Input value={settingsCity} onChange={e => setSettingsCity(e.target.value)} placeholder="City" className="rounded-xl mt-1" />
              </div>
              <div>
                <Label className="text-sm font-medium">Address</Label>
                <Input value={settingsAddress} onChange={e => setSettingsAddress(e.target.value)} placeholder="Address" className="rounded-xl mt-1" />
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium">Cover Image</Label>
              {invite.cover_image_url && !settingsCoverImage && (
                <div className="mt-1 mb-2">
                  <img src={invite.cover_image_url} alt="" className="w-32 h-20 object-cover rounded-lg" />
                </div>
              )}
              <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-primary/40 transition-colors mt-1">
                <Image className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-500">{settingsCoverImage ? settingsCoverImage.name : 'Upload new image'}</span>
                <input type="file" accept="image/*" className="hidden" onChange={e => setSettingsCoverImage(e.target.files[0] || null)} />
              </label>
            </div>
            <div>
              <Label className="text-sm font-medium">Custom Invite Message</Label>
              <textarea value={inviteMessage} onChange={e => setInviteMessage(e.target.value)} placeholder="Add a personal message to your invite..." rows={3} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Allow Plus-Ones</Label>
                <p className="text-xs text-gray-400">Let guests bring additional people</p>
              </div>
              <button onClick={() => setAllowPlusOnes(!allowPlusOnes)} className={`relative w-11 h-6 rounded-full transition-colors ${allowPlusOnes ? 'bg-primary' : 'bg-gray-300'}`}>
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${allowPlusOnes ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
            </div>
            {allowPlusOnes && (
              <div>
                <Label className="text-xs text-gray-500">Max plus-ones per guest</Label>
                <Select value={String(maxPlusOnes)} onValueChange={v => setMaxPlusOnes(Number(v))}>
                  <SelectTrigger className="w-24 rounded-lg h-9 mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <p className="text-xs text-gray-400 mb-1">After this date, guests can no longer respond</p>
              <DateTimePicker label="RSVP Deadline" value={rsvpDeadline} onChange={setRsvpDeadline} />
            </div>
            <div>
              <Label className="text-sm font-medium">Shareable Invite Link</Label>
              <p className="text-xs text-gray-400 mb-2">Anyone with this link can RSVP (they'll enter their name)</p>
              <div className="flex items-center gap-2">
                <Input readOnly value={`${APP_URL}/invite/${invite.share_token}`} className="rounded-lg text-xs sm:text-sm bg-gray-50 flex-1 min-w-0" />
                <Button variant="outline" size="sm" onClick={copyShareLink} className="rounded-lg gap-1 shrink-0">
                  <Copy className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Copy</span>
                </Button>
              </div>
            </div>
            <Button onClick={handleSaveSettings} disabled={savingSettings} className="rounded-xl gap-2">
              {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Save Settings
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
