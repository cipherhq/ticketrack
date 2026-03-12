import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import {
  Users, Calendar, MapPin, Loader2, ChevronLeft, Copy, Download,
  CheckCircle, HelpCircle, X, Clock, Mail, Bell, Phone, MessageCircle,
  CreditCard, AlertCircle, Trash2, Plus, UserPlus, ClipboardList, Settings2,
  RefreshCw, Image, Palette, MessageSquare, Megaphone, Activity, Pencil,
  Upload, Eye, PartyPopper, Sparkles, Coins, Package,
  UtensilsCrossed, Camera, Wallet, CalendarRange, UserCheck, Repeat,
  CalendarPlus, BarChart3,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
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
import { sanitizeFilterValue, validateImageUpload, safeImageExt } from '@/lib/utils';
import { compressImage } from '@/lib/imageCompression';
import { getPaymentProvider } from '@/config/payments';
import { getDefaultCurrency } from '@/config/currencies';
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
  getInviteQuestions,
  createInviteQuestion,
  updateInviteQuestion,
  deleteInviteQuestion,
  getAnswersForInvite,
  getDatePollOptions,
  createDatePollOption,
  deleteDatePollOption,
  finalizeDatePoll,
  getCohosts,
  inviteCohost,
  removeCohost,
  getSeriesParties,
  createNextOccurrence,
} from '@/services/partyInvites';
import { sendPartyInviteEmail, sendPartyInviteReminderEmail, sendPartyMessageEmail } from '@/lib/emailService';
import { APP_URL, formatDateShort, statusBadge, DateTimePicker } from '@/components/rackparty/shared';
import { DesignTab } from '@/components/rackparty/DesignTab';
import { WallTab } from '@/components/rackparty/WallTab';
import { AnnouncementsTab } from '@/components/rackparty/AnnouncementsTab';
import { ActivityTab } from '@/components/rackparty/ActivityTab';
import { PotluckTab } from '@/components/rackparty/PotluckTab';
import { PhotosTab } from '@/components/rackparty/PhotosTab';
import { FundTab } from '@/components/rackparty/FundTab';

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

  // Auto-Reminders
  const [autoRemindEnabled, setAutoRemindEnabled] = useState(false);
  const [autoRemindHours, setAutoRemindHours] = useState(24);

  // Custom Questions
  const [questions, setQuestions] = useState([]);
  const [newQuestionText, setNewQuestionText] = useState('');
  const [newQuestionType, setNewQuestionType] = useState('text');
  const [newQuestionOptions, setNewQuestionOptions] = useState('');
  const [newQuestionRequired, setNewQuestionRequired] = useState(false);
  const [questionsLoaded, setQuestionsLoaded] = useState(false);

  // Date Polling
  const [datePollOptions, setDatePollOptions] = useState([]);
  const [newPollDate, setNewPollDate] = useState('');
  const [newPollLabel, setNewPollLabel] = useState('');
  const [datePollLoaded, setDatePollLoaded] = useState(false);

  // Co-Hosting
  const [cohosts, setCohosts] = useState([]);
  const [newCohostEmail, setNewCohostEmail] = useState('');
  const [newCohostName, setNewCohostName] = useState('');
  const [cohostsLoaded, setCohostsLoaded] = useState(false);

  // Recurring
  const [recurrenceFrequency, setRecurrenceFrequency] = useState('weekly');
  const [seriesParties, setSeriesParties] = useState([]);
  const [creatingOccurrence, setCreatingOccurrence] = useState(false);

  // Inline title edit
  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState('');
  const [duplicating, setDuplicating] = useState(false);

  // Credits
  const [creditBalance, setCreditBalance] = useState(0);
  const [freeEmailsUsed, setFreeEmailsUsed] = useState(0);
  const FREE_EMAIL_LIMIT = 10;

  // Credit purchase dialog
  const [showCreditDialog, setShowCreditDialog] = useState(false);
  const [creditPackages, setCreditPackages] = useState([]);
  const [selectedCreditPackage, setSelectedCreditPackage] = useState(null);
  const [purchasingCredits, setPurchasingCredits] = useState(false);
  const [loadingPackages, setLoadingPackages] = useState(false);

  // Credit purchase history
  const [creditTransactions, setCreditTransactions] = useState([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [showPurchaseHistory, setShowPurchaseHistory] = useState(false);

  // Message Guests
  const [showMessageDialog, setShowMessageDialog] = useState(false);
  const [messageAudience, setMessageAudience] = useState('all');
  const [messageChannel, setMessageChannel] = useState('email');
  const [messageSubject, setMessageSubject] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  useEffect(() => {
    if (!organizer?.id || !id) return;
    loadInvite();
    loadCreditAndFreeEmailData();
    handleCreditPaymentCallback();
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
    setAutoRemindEnabled(inv.auto_remind_enabled || false);
    setAutoRemindHours(inv.auto_remind_hours_before || 24);
    if (inv.recurrence_rule?.frequency) setRecurrenceFrequency(inv.recurrence_rule.frequency);
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

  // Credit purchase helpers
  async function loadCreditPackages() {
    setLoadingPackages(true);
    try {
      let { data } = await supabase
        .from('communication_credit_packages')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (!data || data.length === 0) {
        const { data: legacyData } = await supabase
          .from('sms_credit_packages')
          .select('*')
          .eq('is_active', true)
          .order('sort_order');

        if (legacyData && legacyData.length > 0) {
          data = legacyData.map(pkg => ({
            ...pkg,
            price_ngn: pkg.price,
            price_per_credit: pkg.price / (pkg.credits + (pkg.bonus_credits || 0)),
            description: null,
            badge_text: pkg.is_popular ? 'Popular' : null,
          }));
        }
      }

      setCreditPackages(data || []);
    } catch (err) {
      console.error('Error loading credit packages:', err);
    } finally {
      setLoadingPackages(false);
    }
  }

  async function loadCreditTransactions() {
    if (!organizer?.id) return;
    setLoadingTransactions(true);
    try {
      const { data } = await supabase
        .from('communication_credit_transactions')
        .select('*')
        .eq('organizer_id', organizer.id)
        .order('created_at', { ascending: false })
        .limit(20);
      setCreditTransactions(data || []);
    } catch (err) {
      console.error('Error loading credit transactions:', err);
    } finally {
      setLoadingTransactions(false);
    }
  }

  function getOrganizerCurrency() {
    const countryCode = organizer?.country_code;
    const countryToCurrency = {
      NG: 'NGN', GH: 'GHS', US: 'USD', GB: 'GBP', CA: 'CAD',
    };
    return countryToCurrency[countryCode] || 'USD';
  }

  function getPackagePrice(pkg, currency) {
    const priceMap = {
      NGN: pkg.price_ngn, GHS: pkg.price_ghs, USD: pkg.price_usd,
      GBP: pkg.price_gbp, CAD: pkg.price_cad,
    };
    return priceMap[currency] || null;
  }

  function formatCreditsCurrency(amount, currency = 'NGN') {
    const symbols = { NGN: '\u20A6', GHS: 'GH\u20B5', USD: '$', GBP: '\u00A3', EUR: '\u20AC', CAD: 'C$', AUD: 'A$' };
    const symbol = symbols[currency] || '$';
    const noDecimals = ['NGN', 'GHS'];
    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: noDecimals.includes(currency) ? 0 : 2,
      maximumFractionDigits: noDecimals.includes(currency) ? 0 : 2,
    }).format(amount || 0);
    return `${symbol}${formatted}`;
  }

  function formatCreditsNumber(n) {
    return new Intl.NumberFormat('en-US').format(n || 0);
  }

  function openCreditDialog() {
    setSelectedCreditPackage(null);
    setShowPurchaseHistory(false);
    setShowCreditDialog(true);
    if (creditPackages.length === 0) loadCreditPackages();
    loadCreditTransactions();
  }

  async function processCreditsPayment() {
    if (!selectedCreditPackage) return;
    setPurchasingCredits(true);
    try {
      const currency = getOrganizerCurrency();
      const provider = getPaymentProvider(currency);
      const amount = getPackagePrice(selectedCreditPackage, currency);

      if (!amount) throw new Error('This package is not available in your region');

      const { data, error } = await supabase.functions.invoke('create-credit-purchase', {
        body: {
          organizerId: organizer.id,
          packageId: selectedCreditPackage.id,
          credits: selectedCreditPackage.credits,
          bonusCredits: selectedCreditPackage.bonus_credits,
          amount,
          currency,
          email: organizer.business_email || organizer.email,
          callbackUrl: `${window.location.origin}${location.pathname}?payment=success`,
          provider,
        },
      });

      if (error) throw error;
      if (data && !data.success) throw new Error(data.error || 'Payment initialization failed');

      const redirectUrl = data?.url || data?.authorization_url || data?.link || data?.paymentUrl;
      if (redirectUrl) {
        window.location.href = redirectUrl;
      } else {
        await loadCreditAndFreeEmailData();
        setShowCreditDialog(false);
        toast.success('Credits added successfully!');
      }
    } catch (error) {
      console.error('Payment error:', error);
      toast.error('Failed to initiate payment: ' + (error.message || 'Unknown error'));
    } finally {
      setPurchasingCredits(false);
    }
  }

  async function handleCreditPaymentCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment');
    const reference = urlParams.get('reference') || urlParams.get('trxref');

    if (paymentStatus === 'success' && reference && organizer?.id) {
      window.history.replaceState({}, document.title, window.location.pathname);
      try {
        const { data, error } = await supabase.functions.invoke('verify-credit-purchase', {
          body: { reference, organizerId: organizer.id },
        });
        if (error) console.error('Verification error:', error);
        await loadCreditAndFreeEmailData();
        if (data?.success) {
          toast.success(`${data.credits} credits added to your account!`);
        }
      } catch (error) {
        console.error('Payment verification failed:', error);
        await loadCreditAndFreeEmailData();
      }
    }
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
      if (contactSearch) { const cs = sanitizeFilterValue(contactSearch); query = query.or(`full_name.ilike.%${cs}%,email.ilike.%${cs}%,phone.ilike.%${cs}%`); }
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
    const validationError = validateImageUpload(file);
    if (validationError) throw new Error(validationError);
    const compressed = await compressImage(file);
    const ext = safeImageExt(compressed);
    const path = `party-invites/${organizer.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('event-images').upload(path, compressed);
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
        autoRemindEnabled, autoRemindHoursBefore: autoRemindHours,
        recurrenceRule: recurrenceFrequency ? { frequency: recurrenceFrequency } : null,
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

  async function handleMessageGuests() {
    if (!messageBody.trim()) { toast.error('Please enter a message'); return; }
    if ((messageChannel === 'email' || messageChannel === 'both') && !messageSubject.trim()) {
      toast.error('Please enter a subject for the email'); return;
    }

    // Filter recipients by audience
    const audienceGuests = messageAudience === 'all'
      ? guests
      : guests.filter(g => g.rsvp_status === messageAudience);

    // Split by channel
    const emailRecipients = (messageChannel === 'email' || messageChannel === 'both')
      ? audienceGuests.filter(g => g.email) : [];
    const smsRecipients = (messageChannel === 'sms' || messageChannel === 'both')
      ? audienceGuests.filter(g => g.phone) : [];

    if (emailRecipients.length === 0 && smsRecipients.length === 0) {
      toast.error('No recipients with contact info for the selected channel'); return;
    }

    // Calculate credits
    const msgFreeEmailsToUse = Math.min(freeEmailsRemaining, emailRecipients.length);
    const msgPaidEmails = emailRecipients.length - msgFreeEmailsToUse;
    const msgEmailCredits = msgPaidEmails * 1;
    const msgSmsCredits = smsRecipients.length * 5;
    const totalNeeded = msgEmailCredits + msgSmsCredits;

    if (creditBalance < totalNeeded) {
      toast.error(`Insufficient credits. Need ${totalNeeded} credits (${msgPaidEmails > 0 ? `${msgEmailCredits} for emails` : ''}${msgPaidEmails > 0 && smsRecipients.length > 0 ? ' + ' : ''}${smsRecipients.length > 0 ? `${msgSmsCredits} for SMS` : ''}). Buy credits above.`);
      return;
    }

    setSendingMessage(true);
    try {
      let emailsSent = 0, smsSent = 0, freeUsed = 0;

      // Send emails
      for (const g of emailRecipients) {
        const isFree = freeUsed < msgFreeEmailsToUse;
        if (!isFree) {
          const { error: deductError } = await supabase.rpc('deduct_communication_credits', {
            p_organizer_id: organizer.id, p_amount: 1,
            p_description: `Party message email to ${g.email}`,
          });
          if (deductError) {
            if (emailsSent > 0) toast.warning(`Sent ${emailsSent} emails but ran out of credits.`);
            else toast.error('Failed to deduct credits');
            break;
          }
        }
        const rsvpUrl = `${APP_URL}/invite/${invite.share_token}?rsvp=${g.rsvp_token}`;
        const result = await sendPartyMessageEmail(g.email, {
          eventTitle: invite.title, subject: messageSubject.trim(),
          messageBody: messageBody.trim(), organizerName: organizer?.business_name, rsvpUrl,
        }, organizer.id);
        if (result?.success === false) {
          if (emailsSent === 0) { toast.error(`Email failed: ${result.error || 'Unknown error'}`); break; }
          toast.warning(`Sent ${emailsSent} but failed on ${g.email}`);
          break;
        }
        emailsSent++;
        if (isFree) freeUsed++;
      }

      // Send SMS
      for (const g of smsRecipients) {
        const { error: smsError } = await supabase.functions.invoke('send-sms', {
          body: { organizer_id: organizer.id, phone: g.phone, message: messageBody.trim() + `\n\n- ${organizer?.business_name}` },
        });
        if (smsError) {
          if (smsSent > 0) toast.warning(`Sent ${smsSent} SMS but encountered an error.`);
          else toast.error('Failed to send SMS');
          break;
        }
        smsSent++;
      }

      // Post-send
      if (freeUsed > 0) await incrementFreeEmailUsage(organizer.id, freeUsed);
      await loadCreditAndFreeEmailData();
      if (emailsSent > 0 || smsSent > 0) {
        logActivity(invite.id, 'message_sent', organizer?.business_name, { emailCount: emailsSent, smsCount: smsSent });
        const parts = [];
        if (emailsSent > 0) parts.push(`${emailsSent} email${emailsSent > 1 ? 's' : ''}`);
        if (smsSent > 0) parts.push(`${smsSent} SMS`);
        toast.success(`Message sent: ${parts.join(' and ')}!`);
      }
      setShowMessageDialog(false);
      setMessageSubject('');
      setMessageBody('');
      setMessageAudience('all');
      setMessageChannel('email');
    } catch (err) {
      console.error('Message send error:', err);
      toast.error('Error sending messages');
    } finally {
      setSendingMessage(false);
    }
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
              <button
                onClick={openCreditDialog}
                className="ml-auto text-xs sm:text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
              >
                Buy Credits
              </button>
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
          { id: 'potluck', label: 'Potluck', icon: UtensilsCrossed },
          { id: 'photos', label: 'Photos', icon: Camera },
          { id: 'fund', label: 'Fund', icon: Wallet },
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
              <Button variant="outline" size="sm" onClick={() => setShowMessageDialog(true)} className="gap-1 ml-auto">
                <Mail className="w-3.5 h-3.5" /> Message
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
                      <button
                        onClick={openCreditDialog}
                        className="font-bold underline hover:no-underline"
                      >
                        Buy Credits
                      </button>
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
                    <Input value={manualPhone} onChange={e => setManualPhone(e.target.value)} placeholder="Phone number" className="rounded-lg mt-1" />
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

      {/* Tab: Potluck */}
      {activeTab === 'potluck' && (
        <Card className="rounded-2xl">
          <CardContent className="p-3 sm:p-4">
            <PotluckTab invite={invite} organizer={organizer} />
          </CardContent>
        </Card>
      )}

      {/* Tab: Photos */}
      {activeTab === 'photos' && (
        <Card className="rounded-2xl">
          <CardContent className="p-3 sm:p-4">
            <PhotosTab invite={invite} organizer={organizer} />
          </CardContent>
        </Card>
      )}

      {/* Tab: Fund */}
      {activeTab === 'fund' && (
        <Card className="rounded-2xl">
          <CardContent className="p-3 sm:p-4">
            <FundTab invite={invite} organizer={organizer} />
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
            {/* Auto-Reminders */}
            <div className="border-t pt-5">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Auto-Reminders</Label>
                  <p className="text-xs text-gray-400">Automatically remind pending guests before the event</p>
                </div>
                <button onClick={() => setAutoRemindEnabled(!autoRemindEnabled)} className={`relative w-11 h-6 rounded-full transition-colors ${autoRemindEnabled ? 'bg-primary' : 'bg-gray-300'}`}>
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${autoRemindEnabled ? 'left-[22px]' : 'left-0.5'}`} />
                </button>
              </div>
              {autoRemindEnabled && (
                <div className="mt-3">
                  <Label className="text-xs text-gray-500">Send reminder before event</Label>
                  <Select value={String(autoRemindHours)} onValueChange={v => setAutoRemindHours(Number(v))}>
                    <SelectTrigger className="w-40 rounded-lg h-9 mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[6, 12, 24, 48, 72].map(h => <SelectItem key={h} value={String(h)}>{h} hours before</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {invite.auto_remind_sent_at && (
                    <p className="text-xs text-emerald-600 mt-1">Last sent: {new Date(invite.auto_remind_sent_at).toLocaleString()}</p>
                  )}
                </div>
              )}
            </div>

            {/* Recurring Events */}
            <div className="border-t pt-5">
              <div className="flex items-center gap-2 mb-2">
                <Repeat className="w-4 h-4 text-gray-400" />
                <Label className="text-sm font-medium">Recurring Event</Label>
              </div>
              <p className="text-xs text-gray-400 mb-3">Set up this party as a recurring event</p>
              <Select value={recurrenceFrequency} onValueChange={setRecurrenceFrequency}>
                <SelectTrigger className="w-48 rounded-lg h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not recurring</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="biweekly">Every 2 Weeks</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
              {recurrenceFrequency !== 'none' && invite.recurrence_rule && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 rounded-xl gap-2"
                  disabled={creatingOccurrence}
                  onClick={async () => {
                    setCreatingOccurrence(true);
                    try {
                      const next = await createNextOccurrence(invite.id, organizer.id, { carryOverGuests: true });
                      toast.success('Next occurrence created!');
                      navigate(`${basePath}/${next.id}`);
                    } catch (err) {
                      console.error(err);
                      toast.error('Failed to create next occurrence');
                    } finally {
                      setCreatingOccurrence(false);
                    }
                  }}
                >
                  {creatingOccurrence ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarPlus className="w-4 h-4" />}
                  Create Next Occurrence
                </Button>
              )}
            </div>

            {/* Custom Questions */}
            <div className="border-t pt-5">
              <div className="flex items-center gap-2 mb-3">
                <HelpCircle className="w-4 h-4 text-gray-400" />
                <Label className="text-sm font-medium">Custom RSVP Questions</Label>
              </div>
              <p className="text-xs text-gray-400 mb-3">Add questions guests must answer when they RSVP</p>
              {!questionsLoaded ? (
                <Button variant="outline" size="sm" className="rounded-xl gap-2" onClick={async () => {
                  try {
                    const qs = await getInviteQuestions(invite.id);
                    setQuestions(qs);
                    setQuestionsLoaded(true);
                  } catch { toast.error('Failed to load questions'); }
                }}>
                  Load Questions
                </Button>
              ) : (
                <div className="space-y-3">
                  {questions.map((q, i) => (
                    <div key={q.id} className="flex items-start gap-2 p-2.5 bg-gray-50 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{q.question_text}</p>
                        <p className="text-xs text-gray-400">
                          {q.question_type === 'text' ? 'Text' : q.question_type === 'single_choice' ? 'Single Choice' : 'Multi Choice'}
                          {q.is_required && ' · Required'}
                          {q.options?.length > 0 && ` · ${q.options.join(', ')}`}
                        </p>
                      </div>
                      <button onClick={async () => {
                        try {
                          await deleteInviteQuestion(q.id);
                          setQuestions(prev => prev.filter(x => x.id !== q.id));
                          toast.success('Question removed');
                        } catch { toast.error('Failed to remove question'); }
                      }} className="p-1 text-gray-400 hover:text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <div className="p-3 border border-dashed border-gray-200 rounded-xl space-y-2">
                    <Input value={newQuestionText} onChange={e => setNewQuestionText(e.target.value)} placeholder="Question text" className="rounded-lg text-sm" />
                    <div className="flex gap-2 flex-wrap">
                      <Select value={newQuestionType} onValueChange={setNewQuestionType}>
                        <SelectTrigger className="w-36 rounded-lg h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Text Answer</SelectItem>
                          <SelectItem value="single_choice">Single Choice</SelectItem>
                          <SelectItem value="multi_choice">Multi Choice</SelectItem>
                        </SelectContent>
                      </Select>
                      {(newQuestionType === 'single_choice' || newQuestionType === 'multi_choice') && (
                        <Input value={newQuestionOptions} onChange={e => setNewQuestionOptions(e.target.value)} placeholder="Options (comma separated)" className="flex-1 rounded-lg text-xs h-8" />
                      )}
                      <label className="flex items-center gap-1 text-xs text-gray-600">
                        <input type="checkbox" checked={newQuestionRequired} onChange={e => setNewQuestionRequired(e.target.checked)} className="rounded" />
                        Required
                      </label>
                    </div>
                    <Button size="sm" className="rounded-lg gap-1" disabled={!newQuestionText.trim()} onClick={async () => {
                      try {
                        const opts = newQuestionOptions.split(',').map(o => o.trim()).filter(Boolean);
                        const q = await createInviteQuestion(invite.id, organizer.id, {
                          questionText: newQuestionText.trim(),
                          questionType: newQuestionType,
                          options: opts,
                          isRequired: newQuestionRequired,
                          sortOrder: questions.length,
                        });
                        setQuestions(prev => [...prev, q]);
                        setNewQuestionText('');
                        setNewQuestionOptions('');
                        setNewQuestionRequired(false);
                        toast.success('Question added');
                      } catch { toast.error('Failed to add question'); }
                    }}>
                      <Plus className="w-3.5 h-3.5" /> Add Question
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Date Polling */}
            <div className="border-t pt-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <CalendarRange className="w-4 h-4 text-gray-400" />
                  <Label className="text-sm font-medium">Date Poll</Label>
                </div>
                <button onClick={async () => {
                  try {
                    await updateInviteSettings(invite.id, { datePollActive: !invite.date_poll_active });
                    setInvite(prev => ({ ...prev, date_poll_active: !prev.date_poll_active }));
                  } catch {}
                }} className={`relative w-11 h-6 rounded-full transition-colors ${invite.date_poll_active ? 'bg-primary' : 'bg-gray-300'}`}>
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${invite.date_poll_active ? 'left-[22px]' : 'left-0.5'}`} />
                </button>
              </div>
              <p className="text-xs text-gray-400 mb-3">Let guests vote on the best date for the party</p>
              {invite.date_poll_active && (
                <div className="space-y-3">
                  {!datePollLoaded ? (
                    <Button variant="outline" size="sm" className="rounded-xl gap-2" onClick={async () => {
                      try {
                        const opts = await getDatePollOptions(invite.id);
                        setDatePollOptions(opts);
                        setDatePollLoaded(true);
                      } catch { toast.error('Failed to load poll options'); }
                    }}>
                      Load Date Poll
                    </Button>
                  ) : (
                    <>
                      {datePollOptions.map(opt => {
                        const yesVotes = (opt.votes || []).filter(v => v.vote === 'yes').length;
                        const maybeVotes = (opt.votes || []).filter(v => v.vote === 'maybe').length;
                        return (
                          <div key={opt.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {new Date(opt.date_option).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                              </p>
                              {opt.label && <p className="text-xs text-gray-500">{opt.label}</p>}
                              <div className="flex gap-2 mt-1">
                                <span className="text-xs text-emerald-600">{yesVotes} yes</span>
                                <span className="text-xs text-amber-600">{maybeVotes} maybe</span>
                              </div>
                            </div>
                            <div className="flex gap-1">
                              <Button variant="outline" size="sm" className="rounded-lg text-xs h-7 px-2" onClick={async () => {
                                try {
                                  await finalizeDatePoll(invite.id, opt.date_option);
                                  setInvite(prev => ({ ...prev, start_date: opt.date_option, date_poll_active: false }));
                                  setSettingsStartDate(opt.date_option.slice(0, 16));
                                  toast.success('Date finalized!');
                                } catch { toast.error('Failed to finalize'); }
                              }}>
                                Pick
                              </Button>
                              <button onClick={async () => {
                                try {
                                  await deleteDatePollOption(opt.id);
                                  setDatePollOptions(prev => prev.filter(o => o.id !== opt.id));
                                } catch {}
                              }} className="p-1 text-gray-400 hover:text-red-500">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      <div className="flex gap-2 items-end">
                        <div className="flex-1">
                          <Label className="text-xs">Date Option</Label>
                          <Input type="datetime-local" value={newPollDate} onChange={e => setNewPollDate(e.target.value)} className="rounded-lg mt-1 text-sm" />
                        </div>
                        <div className="flex-1">
                          <Label className="text-xs">Label (optional)</Label>
                          <Input value={newPollLabel} onChange={e => setNewPollLabel(e.target.value)} placeholder="e.g. Saturday option" className="rounded-lg mt-1 text-sm" />
                        </div>
                        <Button size="sm" className="rounded-lg gap-1 shrink-0" disabled={!newPollDate} onClick={async () => {
                          try {
                            const opt = await createDatePollOption(invite.id, {
                              dateOption: new Date(newPollDate).toISOString(),
                              label: newPollLabel.trim() || null,
                            });
                            setDatePollOptions(prev => [...prev, { ...opt, votes: [] }]);
                            setNewPollDate('');
                            setNewPollLabel('');
                            toast.success('Date option added');
                          } catch { toast.error('Failed to add option'); }
                        }}>
                          <Plus className="w-3.5 h-3.5" /> Add
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Co-Hosts */}
            <div className="border-t pt-5">
              <div className="flex items-center gap-2 mb-3">
                <UserCheck className="w-4 h-4 text-gray-400" />
                <Label className="text-sm font-medium">Co-Hosts</Label>
              </div>
              <p className="text-xs text-gray-400 mb-3">Invite others to help manage this party</p>
              {!cohostsLoaded ? (
                <Button variant="outline" size="sm" className="rounded-xl gap-2" onClick={async () => {
                  try {
                    const ch = await getCohosts(invite.id);
                    setCohosts(ch);
                    setCohostsLoaded(true);
                  } catch { toast.error('Failed to load co-hosts'); }
                }}>
                  Load Co-Hosts
                </Button>
              ) : (
                <div className="space-y-3">
                  {cohosts.map(ch => (
                    <div key={ch.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{ch.name || ch.email}</p>
                        <p className="text-xs text-gray-400">
                          {ch.email} · {ch.accepted_at ? 'Accepted' : 'Pending'} · {ch.role}
                        </p>
                      </div>
                      <button onClick={async () => {
                        try {
                          await removeCohost(ch.id);
                          setCohosts(prev => prev.filter(c => c.id !== ch.id));
                          toast.success('Co-host removed');
                        } catch { toast.error('Failed to remove co-host'); }
                      }} className="p-1 text-gray-400 hover:text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Label className="text-xs">Email *</Label>
                      <Input value={newCohostEmail} onChange={e => setNewCohostEmail(e.target.value)} placeholder="cohost@email.com" className="rounded-lg mt-1 text-sm" />
                    </div>
                    <div className="flex-1">
                      <Label className="text-xs">Name</Label>
                      <Input value={newCohostName} onChange={e => setNewCohostName(e.target.value)} placeholder="Name" className="rounded-lg mt-1 text-sm" />
                    </div>
                    <Button size="sm" className="rounded-lg gap-1 shrink-0" disabled={!newCohostEmail.trim()} onClick={async () => {
                      try {
                        const ch = await inviteCohost(invite.id, {
                          email: newCohostEmail.trim(),
                          name: newCohostName.trim() || null,
                        });
                        setCohosts(prev => [...prev, ch]);
                        setNewCohostEmail('');
                        setNewCohostName('');
                        toast.success('Co-host invited');
                      } catch (err) {
                        toast.error(err.message?.includes('duplicate') ? 'Already invited' : 'Failed to invite');
                      }
                    }}>
                      <Plus className="w-3.5 h-3.5" /> Invite
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <Button onClick={handleSaveSettings} disabled={savingSettings} className="rounded-xl gap-2">
              {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Save Settings
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Message Guests Dialog */}
      <Dialog open={showMessageDialog} onOpenChange={(open) => { setShowMessageDialog(open); if (!open) { setMessageSubject(''); setMessageBody(''); } }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-600" />
              Message Guests
            </DialogTitle>
            <DialogDescription>
              Send a custom message to your guests via email or SMS
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-sm font-medium">Audience</Label>
              <Select value={messageAudience} onValueChange={setMessageAudience}>
                <SelectTrigger className="rounded-lg mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Guests ({stats.total})</SelectItem>
                  <SelectItem value="going">Going ({stats.going})</SelectItem>
                  <SelectItem value="maybe">Maybe ({stats.maybe})</SelectItem>
                  <SelectItem value="pending">Pending ({stats.pending})</SelectItem>
                  <SelectItem value="declined">Declined ({stats.declined})</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-medium">Channel</Label>
              <div className="flex gap-2 mt-1">
                {[
                  { id: 'email', label: 'Email', sub: '1 credit each' },
                  { id: 'sms', label: 'SMS', sub: '5 credits each' },
                  { id: 'both', label: 'Both', sub: '' },
                ].map(ch => (
                  <button
                    key={ch.id}
                    onClick={() => setMessageChannel(ch.id)}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-center ${
                      messageChannel === ch.id ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {ch.label}
                    {ch.sub && <span className="block text-[10px] opacity-80">{ch.sub}</span>}
                  </button>
                ))}
              </div>
            </div>
            {(messageChannel === 'email' || messageChannel === 'both') && (
              <div>
                <Label className="text-sm font-medium">Subject</Label>
                <Input
                  value={messageSubject}
                  onChange={e => setMessageSubject(e.target.value)}
                  placeholder="e.g. Important update about the party"
                  className="rounded-lg mt-1"
                />
              </div>
            )}
            <div>
              <Label className="text-sm font-medium">Message</Label>
              <textarea
                value={messageBody}
                onChange={e => setMessageBody(e.target.value)}
                placeholder="Write your message here..."
                rows={5}
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            {(() => {
              const audienceGuests = messageAudience === 'all' ? guests : guests.filter(g => g.rsvp_status === messageAudience);
              const eCount = (messageChannel === 'email' || messageChannel === 'both') ? audienceGuests.filter(g => g.email).length : 0;
              const sCount = (messageChannel === 'sms' || messageChannel === 'both') ? audienceGuests.filter(g => g.phone).length : 0;
              const freeToUse = Math.min(freeEmailsRemaining, eCount);
              const paidE = eCount - freeToUse;
              const eCost = paidE * 1;
              const sCost = sCount * 5;
              const total = eCost + sCost;
              const insufficient = creditBalance < total;
              return (
                <div className={`p-3 rounded-xl text-sm ${insufficient ? 'bg-red-50 border border-red-200' : 'bg-gray-50'}`}>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-gray-600">
                    {eCount > 0 && <span>{eCount} email{eCount > 1 ? 's' : ''} {freeToUse > 0 ? `(${freeToUse} free)` : ''} = {eCost} credit{eCost !== 1 ? 's' : ''}</span>}
                    {sCount > 0 && <span>{sCount} SMS x 5 = {sCost} credits</span>}
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="font-semibold">Total: {total} credits</span>
                    <span className={`font-medium ${insufficient ? 'text-red-600' : 'text-gray-600'}`}>
                      Balance: {creditBalance} credits
                    </span>
                  </div>
                  {insufficient && (
                    <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Insufficient credits.{' '}
                      <button onClick={() => { setShowMessageDialog(false); openCreditDialog(); }} className="underline font-medium">Buy Credits</button>
                    </p>
                  )}
                </div>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMessageDialog(false)}>Cancel</Button>
            <Button
              onClick={handleMessageGuests}
              disabled={sendingMessage || !messageBody.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
            >
              {sendingMessage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              Send Message
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credit Purchase Dialog */}
      <Dialog open={showCreditDialog} onOpenChange={(open) => { setShowCreditDialog(open); if (!open) setSelectedCreditPackage(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Coins className="w-5 h-5 text-blue-600" />
              {selectedCreditPackage ? 'Confirm Purchase' : 'Buy Credits'}
            </DialogTitle>
            <DialogDescription>
              {selectedCreditPackage
                ? `You're about to purchase the ${selectedCreditPackage.name} package`
                : 'Choose a credit package to power your email and SMS invites'}
            </DialogDescription>
          </DialogHeader>

          {!selectedCreditPackage ? (
            // Package grid
            <div className="py-2">
              {loadingPackages ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                </div>
              ) : creditPackages.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No packages available for your region yet.</p>
                  <p className="text-sm text-gray-400 mt-2">Please contact support for assistance.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(() => {
                    const currency = getOrganizerCurrency();
                    return creditPackages
                      .filter(pkg => getPackagePrice(pkg, currency) != null)
                      .map(pkg => {
                        const price = getPackagePrice(pkg, currency);
                        const totalCredits = pkg.credits + (pkg.bonus_credits || 0);
                        const pricePerCredit = totalCredits > 0 ? price / totalCredits : 0;
                        return (
                          <Card
                            key={pkg.id}
                            className={`rounded-xl transition-all cursor-pointer hover:shadow-md border-2 ${
                              pkg.is_popular ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-gray-200'
                            }`}
                            onClick={() => setSelectedCreditPackage(pkg)}
                          >
                            <CardContent className="p-4 text-center">
                              {pkg.badge_text && (
                                <Badge className={`mb-2 ${pkg.is_popular ? 'bg-blue-600' : 'bg-gray-600'}`}>
                                  {pkg.badge_text}
                                </Badge>
                              )}
                              <h3 className="text-base font-bold mb-0.5">{pkg.name}</h3>
                              {pkg.description && <p className="text-xs text-gray-500 mb-3">{pkg.description}</p>}
                              <div className="mb-3">
                                <p className="text-2xl font-bold text-blue-600">
                                  {formatCreditsNumber(totalCredits)}
                                </p>
                                <p className="text-xs text-gray-500">credits</p>
                              </div>
                              {pkg.bonus_credits > 0 && (
                                <div className="flex items-center justify-center gap-1 text-xs text-green-600 mb-2">
                                  <Sparkles className="w-3.5 h-3.5" />
                                  <span>+{formatCreditsNumber(pkg.bonus_credits)} bonus</span>
                                </div>
                              )}
                              <div className="border-t pt-3">
                                <p className="text-lg font-bold">{formatCreditsCurrency(price, currency)}</p>
                                <p className="text-[10px] text-gray-400">
                                  {formatCreditsCurrency(pricePerCredit, currency)}/credit
                                </p>
                              </div>
                              <Button className="w-full mt-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm">
                                Buy Now
                              </Button>
                            </CardContent>
                          </Card>
                        );
                      });
                  })()}
                </div>
              )}

              {/* Purchase History */}
              <div className="mt-4 border-t pt-4">
                <button
                  onClick={() => setShowPurchaseHistory(!showPurchaseHistory)}
                  className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                >
                  <Clock className="w-3.5 h-3.5" />
                  {showPurchaseHistory ? 'Hide Purchase History' : 'View Purchase History'}
                </button>
                {showPurchaseHistory && (
                  <div className="mt-3">
                    {loadingTransactions ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                      </div>
                    ) : creditTransactions.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-4">No purchase history yet</p>
                    ) : (
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {creditTransactions.map((tx) => (
                          <div key={tx.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl text-sm">
                            <div>
                              <p className="font-medium text-gray-900">
                                {tx.description || tx.package_name || 'Credit Purchase'}
                              </p>
                              <p className="text-xs text-gray-400">
                                {new Date(tx.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-blue-600">
                                +{formatCreditsNumber(tx.credits || tx.amount)} credits
                              </p>
                              {tx.payment_amount != null && (
                                <p className="text-xs text-gray-400">
                                  {formatCreditsCurrency(tx.payment_amount, tx.currency || 'NGN')}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            // Confirmation view
            (() => {
              const currency = getOrganizerCurrency();
              const provider = getPaymentProvider(currency);
              const providerNames = { stripe: 'Stripe', paystack: 'Paystack', flutterwave: 'Flutterwave' };
              const displayAmount = getPackagePrice(selectedCreditPackage, currency);

              return (
                <div className="py-4 space-y-4">
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-500">Credits</span>
                      <span className="font-semibold">{formatCreditsNumber(selectedCreditPackage.credits)}</span>
                    </div>
                    {selectedCreditPackage.bonus_credits > 0 && (
                      <div className="flex items-center justify-between mb-2 text-green-600">
                        <span className="flex items-center gap-1">
                          <Sparkles className="w-4 h-4" />
                          Bonus Credits
                        </span>
                        <span className="font-semibold">+{formatCreditsNumber(selectedCreditPackage.bonus_credits)}</span>
                      </div>
                    )}
                    <div className="border-t pt-2 mt-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">Total Credits</span>
                        <span className="font-bold text-blue-600">
                          {formatCreditsNumber(selectedCreditPackage.credits + (selectedCreditPackage.bonus_credits || 0))}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-900">Amount to Pay</span>
                      <span className="text-2xl font-bold text-blue-600">
                        {formatCreditsCurrency(displayAmount, currency)}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-gray-400 text-center">
                    You'll be redirected to {providerNames[provider] || 'payment'} to complete payment
                  </p>
                </div>
              );
            })()
          )}

          {selectedCreditPackage && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedCreditPackage(null)}>
                Back
              </Button>
              <Button
                onClick={processCreditsPayment}
                disabled={purchasingCredits}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {purchasingCredits ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <CreditCard className="w-4 h-4 mr-2" />
                )}
                Pay Now
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
