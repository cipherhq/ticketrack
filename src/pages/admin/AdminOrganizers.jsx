import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  MoreVertical,
  Loader2,
  RefreshCw,
  Building,
  Mail,
  Phone,
  Calendar,
  DollarSign,
  Eye,
  Ban,
  Shield,
  CheckCircle,
  MapPin,
  Globe,
  Instagram,
  Twitter,
  Facebook,
  Linkedin,
  Ticket,
  TrendingUp,
  CreditCard,
  LogIn,
  Lock,
  Unlock,
  Trophy,
  Star,
  Sparkles,
  MessageSquare,
  Users,
  Link2,
  Percent,
  Clock,
  LayoutGrid,
  Repeat,
  Award,
  Zap,
  ExternalLink,
  ToggleLeft,
  ToggleRight,
  Settings2,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase';
import { useAdmin } from '@/contexts/AdminContext';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { Link } from 'react-router-dom';
import { Pagination, usePagination } from '@/components/ui/pagination';

export function AdminOrganizers() {
  const navigate = useNavigate();
  const { logAdminAction, admin } = useAdmin();
  const { startImpersonation } = useImpersonation();
  const [loading, setLoading] = useState(true);
  const [organizers, setOrganizers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [countryFilter, setCountryFilter] = useState('all');
  const [selectedOrganizer, setSelectedOrganizer] = useState(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [organizerEvents, setOrganizerEvents] = useState([]);
  const [organizerPayouts, setOrganizerPayouts] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [customFeeData, setCustomFeeData] = useState({
    enabled: false,
    percentage: "",
    fixed: ""
  });
  const [savingFees, setSavingFees] = useState(false);
  const [payoutOverrideReason, setPayoutOverrideReason] = useState('');
  const [savingPayoutOverride, setSavingPayoutOverride] = useState(false);
  const [featureFlags, setFeatureFlags] = useState({});
  const [savingFeatures, setSavingFeatures] = useState(false);
  const [accountData, setAccountData] = useState({ country_code: '', default_currency: '' });
  const [savingAccount, setSavingAccount] = useState(false);

  useEffect(() => {
    loadOrganizers();
  }, []);

  const loadOrganizers = async () => {
    setLoading(true);
    try {
      // Single query - uses pre-computed stats from tier system
      // Avoids N+1 queries (was: 200+ queries for 100 organizers, now: 1 query)
      const { data, error } = await supabase
        .from('organizers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Use pre-computed values from tier system (total_events, total_tickets_sold, total_revenue)
      const organizersWithStats = (data || []).map((org) => ({
        ...org,
        eventCount: org.total_events || 0,
        totalRevenue: org.total_revenue || 0,
        totalTickets: org.total_tickets_sold || 0,
      }));

      setOrganizers(organizersWithStats);
    } catch (error) {
      console.error('Error loading organizers:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadOrganizerDetails = async (organizer) => {
    setLoadingDetails(true);
    try {
      const { data: events } = await supabase
        .from('events')
        .select('id, title, start_date, status, ticket_price')
        .eq('organizer_id', organizer.id)
        .order('start_date', { ascending: false })
        .limit(10);

      setOrganizerEvents(events || []);

      const { data: payouts } = await supabase
        .from('payouts')
        .select('id, amount, net_amount, status, created_at')
        .eq('organizer_id', organizer.id)
        .order('created_at', { ascending: false })
        .limit(5);

      setOrganizerPayouts(payouts || []);
    } catch (error) {
      console.error('Error loading organizer details:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleLoginAs = async (organizer) => {
    try {
      await startImpersonation('organizer', organizer, admin);
      await logAdminAction('impersonation_started', 'organizer', organizer.id, { 
        name: organizer.business_name 
      });
      navigate('/organizer');
    } catch (error) {
      console.error('Error starting impersonation:', error);
      alert('Failed to start support session');
    }
  };

  const handleAction = async () => {
    if (!selectedOrganizer) return;
    setProcessing(true);

    try {
      if (actionType === 'suspend') {
        const { error } = await supabase
          .from('organizers')
          .update({ is_active: false })
          .eq('id', selectedOrganizer.id);
        if (error) throw error;
        await logAdminAction('organizer_suspended', 'organizer', selectedOrganizer.id, { name: selectedOrganizer.business_name });
        alert('Organizer suspended successfully');
      } else if (actionType === 'activate') {
        const { error } = await supabase
          .from('organizers')
          .update({ is_active: true })
          .eq('id', selectedOrganizer.id);
        if (error) throw error;
        await logAdminAction('organizer_activated', 'organizer', selectedOrganizer.id, { name: selectedOrganizer.business_name });
        alert('Organizer activated successfully');
      }

      setActionDialogOpen(false);
      loadOrganizers();
    } catch (error) {
      console.error('Action error:', error);
      alert('Failed to perform action: ' + error.message);
    } finally {
      setProcessing(false);
    }
  };

  const openActionDialog = (organizer, action) => {
    setSelectedOrganizer(organizer);
    setCustomFeeData({
      enabled: organizer.custom_fee_enabled || false,
      percentage: organizer.custom_service_fee_percentage || "",
      fixed: organizer.custom_service_fee_fixed || ""
    });
    setActionType(action);
    setActionDialogOpen(true);
  };

  // Country to currency mapping
  const COUNTRY_CURRENCY_MAP = {
    NG: { currency: 'NGN', name: 'Nigeria', flag: '🇳🇬', symbol: '₦' },
    GH: { currency: 'GHS', name: 'Ghana', flag: '🇬🇭', symbol: '₵' },
    KE: { currency: 'KES', name: 'Kenya', flag: '🇰🇪', symbol: 'KSh' },
    ZA: { currency: 'ZAR', name: 'South Africa', flag: '🇿🇦', symbol: 'R' },
    US: { currency: 'USD', name: 'United States', flag: '🇺🇸', symbol: '$' },
    GB: { currency: 'GBP', name: 'United Kingdom', flag: '🇬🇧', symbol: '£' },
    CA: { currency: 'CAD', name: 'Canada', flag: '🇨🇦', symbol: 'C$' },
    AU: { currency: 'AUD', name: 'Australia', flag: '🇦🇺', symbol: 'A$' },
  };

  const getCurrencyForCountry = (countryCode) => {
    return COUNTRY_CURRENCY_MAP[countryCode]?.currency || 'USD';
  };

  const openDetailsDialog = async (organizer) => {
    setSelectedOrganizer(organizer);
    setCustomFeeData({
      enabled: organizer.custom_fee_enabled || false,
      percentage: organizer.custom_service_fee_percentage || "",
      fixed: organizer.custom_service_fee_fixed || ""
    });
    // Initialize account data
    setAccountData({
      country_code: organizer.country_code || 'NG',
      default_currency: organizer.default_currency || getCurrencyForCountry(organizer.country_code || 'NG'),
    });
    // Initialize feature flags from organizer data
    setFeatureFlags({
      feature_sms_enabled: organizer.feature_sms_enabled ?? true,
      feature_whatsapp_enabled: organizer.feature_whatsapp_enabled ?? true,
      feature_email_enabled: organizer.feature_email_enabled ?? true,
      feature_direct_payment_enabled: organizer.feature_direct_payment_enabled ?? true,
      feature_group_buy_enabled: organizer.feature_group_buy_enabled ?? true,
      feature_promoters_enabled: organizer.feature_promoters_enabled ?? true,
      feature_custom_urls_enabled: organizer.feature_custom_urls_enabled ?? true,
      feature_discount_codes_enabled: organizer.feature_discount_codes_enabled ?? true,
      feature_waitlist_enabled: organizer.feature_waitlist_enabled ?? true,
      // feature_reserved_seating_enabled - not implemented yet
      feature_multiday_events_enabled: organizer.feature_multiday_events_enabled ?? true,
      feature_recurring_events_enabled: organizer.feature_recurring_events_enabled ?? true,
      feature_sponsors_enabled: organizer.feature_sponsors_enabled ?? true,
      feature_fast_payout_enabled: organizer.feature_fast_payout_enabled ?? true,
      feature_payment_links_enabled: organizer.feature_payment_links_enabled ?? true,
    });
    setDetailsDialogOpen(true);
    await loadOrganizerDetails(organizer);
  };


  const saveCustomFees = async () => {
    if (!selectedOrganizer) return;
    setSavingFees(true);
    try {
      const { error } = await supabase
        .from("organizers")
        .update({
          custom_fee_enabled: customFeeData.enabled,
          custom_service_fee_percentage: customFeeData.percentage ? parseFloat(customFeeData.percentage) : null,
          custom_service_fee_fixed: customFeeData.fixed ? parseFloat(customFeeData.fixed) : null,
          custom_fee_set_by: admin?.id,
          custom_fee_set_at: new Date().toISOString()
        })
        .eq("id", selectedOrganizer.id);

      if (error) throw error;

      await logAdminAction(
        customFeeData.enabled ? "custom_fees_enabled" : "custom_fees_disabled",
        "organizer",
        selectedOrganizer.id,
        {
          name: selectedOrganizer.business_name,
          percentage: customFeeData.percentage,
          fixed: customFeeData.fixed
        }
      );

      setSelectedOrganizer(prev => ({
        ...prev,
        custom_fee_enabled: customFeeData.enabled,
        custom_service_fee_percentage: customFeeData.percentage ? parseFloat(customFeeData.percentage) : null,
        custom_service_fee_fixed: customFeeData.fixed ? parseFloat(customFeeData.fixed) : null
      }));

      loadOrganizers();
    } catch (err) {
      console.error("Error saving custom fees:", err);
    } finally {
      setSavingFees(false);
    }
  };

  const toggleDirectPayoutOverride = async (enable) => {
    if (!selectedOrganizer) return;
    if (enable && !payoutOverrideReason.trim()) {
      alert('Please provide a reason for enabling direct payout override');
      return;
    }

    setSavingPayoutOverride(true);
    try {
      const { error } = await supabase
        .from("organizers")
        .update({
          direct_payout_override: enable,
          direct_payout_override_by: enable ? admin?.id : null,
          direct_payout_override_at: enable ? new Date().toISOString() : null,
          direct_payout_override_reason: enable ? payoutOverrideReason : null,
          direct_payout_eligible: enable || (selectedOrganizer.completed_events_count >= (selectedOrganizer.required_events_for_payout || 5))
        })
        .eq("id", selectedOrganizer.id);

      if (error) throw error;

      await logAdminAction(
        enable ? "direct_payout_enabled" : "direct_payout_disabled",
        "organizer",
        selectedOrganizer.id,
        {
          name: selectedOrganizer.business_name,
          reason: payoutOverrideReason
        }
      );

      // Update local state
      setSelectedOrganizer(prev => ({
        ...prev,
        direct_payout_override: enable,
        direct_payout_eligible: enable || (prev.completed_events_count >= (prev.required_events_for_payout || 5))
      }));
      setPayoutOverrideReason('');
      loadOrganizers();
    } catch (err) {
      console.error("Error updating payout override:", err);
      alert('Failed to update payout override');
    } finally {
      setSavingPayoutOverride(false);
    }
  };

  const toggleFeatureFlag = (key, value) => {
    setFeatureFlags(prev => ({ ...prev, [key]: value }));
  };

  const saveFeatureFlags = async () => {
    if (!selectedOrganizer) return;
    setSavingFeatures(true);
    try {
      const { error } = await supabase
        .from("organizers")
        .update({
          ...featureFlags,
          feature_flags_updated_by: admin?.id,
          feature_flags_updated_at: new Date().toISOString()
        })
        .eq("id", selectedOrganizer.id);

      if (error) throw error;

      // Find which flags changed
      const changes = {};
      Object.keys(featureFlags).forEach(key => {
        const originalValue = selectedOrganizer[key] ?? true;
        if (featureFlags[key] !== originalValue) {
          changes[key] = featureFlags[key];
        }
      });

      if (Object.keys(changes).length > 0) {
        await logAdminAction(
          "feature_flags_updated",
          "organizer",
          selectedOrganizer.id,
          {
            name: selectedOrganizer.business_name,
            changes
          }
        );
      }

      // Update local state
      setSelectedOrganizer(prev => ({
        ...prev,
        ...featureFlags
      }));

      loadOrganizers();
    } catch (err) {
      console.error("Error saving feature flags:", err);
      alert('Failed to save feature flags');
    } finally {
      setSavingFeatures(false);
    }
  };

  const saveAccountSettings = async () => {
    if (!selectedOrganizer) return;
    setSavingAccount(true);
    try {
      const newCurrency = getCurrencyForCountry(accountData.country_code);
      const { error } = await supabase
        .from("organizers")
        .update({
          country_code: accountData.country_code,
          default_currency: newCurrency,
        })
        .eq("id", selectedOrganizer.id);

      if (error) throw error;

      await logAdminAction(
        "organizer_account_updated",
        "organizer",
        selectedOrganizer.id,
        {
          name: selectedOrganizer.business_name,
          old_country: selectedOrganizer.country_code,
          new_country: accountData.country_code,
          old_currency: selectedOrganizer.default_currency || getCurrencyForCountry(selectedOrganizer.country_code),
          new_currency: newCurrency,
        }
      );

      // Update local state
      setSelectedOrganizer(prev => ({
        ...prev,
        country_code: accountData.country_code,
        default_currency: newCurrency,
      }));

      // Send notification email to organizer about the change
      try {
        await supabase.functions.invoke('send-email', {
          body: {
            type: 'account_settings_updated',
            to: selectedOrganizer.email || selectedOrganizer.business_email,
            data: {
              organizerName: selectedOrganizer.business_name,
              changes: `Your account country has been updated to ${COUNTRY_CURRENCY_MAP[accountData.country_code]?.name || accountData.country_code}. Your default currency is now ${newCurrency}.`,
              updatedAt: new Date().toISOString(),
            },
          },
        });
      } catch (emailError) {
        console.error('Failed to send notification email:', emailError);
      }

      loadOrganizers();
      alert('Account settings updated successfully');
    } catch (err) {
      console.error("Error saving account settings:", err);
      alert('Failed to update account settings: ' + err.message);
    } finally {
      setSavingAccount(false);
    }
  };

  // Feature flags configuration
  const featureFlagsConfig = [
    {
      key: 'feature_direct_payment_enabled',
      label: 'Direct Payment',
      description: 'Stripe Connect / Paystack / Flutterwave subaccounts. When disabled, uses escrow payout only.',
      icon: CreditCard,
      category: 'payments',
      warning: true
    },
    {
      key: 'feature_fast_payout_enabled',
      label: 'Fast Payout',
      description: 'Instant/same-day payouts for eligible organizers',
      icon: Zap,
      category: 'payments'
    },
    {
      key: 'feature_payment_links_enabled',
      label: 'Payment Links',
      description: 'Create shareable payment links for tickets',
      icon: ExternalLink,
      category: 'payments'
    },
    {
      key: 'feature_sms_enabled',
      label: 'SMS Notifications',
      description: 'Send SMS notifications to attendees',
      icon: MessageSquare,
      category: 'notifications'
    },
    {
      key: 'feature_whatsapp_enabled',
      label: 'WhatsApp Notifications',
      description: 'Send WhatsApp notifications to attendees',
      icon: MessageSquare,
      category: 'notifications'
    },
    {
      key: 'feature_email_enabled',
      label: 'Email Notifications',
      description: 'Send email notifications to attendees',
      icon: Mail,
      category: 'notifications'
    },
    {
      key: 'feature_group_buy_enabled',
      label: 'Group Buy / Split Payment',
      description: 'Allow attendees to split ticket costs',
      icon: Users,
      category: 'tickets'
    },
    {
      key: 'feature_discount_codes_enabled',
      label: 'Discount Codes',
      description: 'Create and use promo/discount codes',
      icon: Percent,
      category: 'tickets'
    },
    {
      key: 'feature_waitlist_enabled',
      label: 'Waitlist',
      description: 'Enable waitlist for sold-out events',
      icon: Clock,
      category: 'tickets'
    },
    // Reserved seating - not implemented yet
    // {
    //   key: 'feature_reserved_seating_enabled',
    //   label: 'Reserved Seating',
    //   description: 'Enable seat selection for events',
    //   icon: LayoutGrid,
    //   category: 'events'
    // },
    {
      key: 'feature_multiday_events_enabled',
      label: 'Multi-day Events',
      description: 'Create events spanning multiple days',
      icon: Calendar,
      category: 'events'
    },
    {
      key: 'feature_recurring_events_enabled',
      label: 'Recurring Events',
      description: 'Create repeating/recurring events',
      icon: Repeat,
      category: 'events'
    },
    {
      key: 'feature_sponsors_enabled',
      label: 'Event Sponsors',
      description: 'Add sponsor logos and info to events',
      icon: Award,
      category: 'events'
    },
    {
      key: 'feature_promoters_enabled',
      label: 'Promoter System',
      description: 'Enable affiliate/promoter referral program',
      icon: Users,
      category: 'marketing'
    },
    {
      key: 'feature_custom_urls_enabled',
      label: 'Custom URLs',
      description: 'Create custom URLs for events',
      icon: Link2,
      category: 'marketing'
    },
  ];

  const getTierBadge = (tier) => {
    const tierConfig = {
      emerging: { label: 'Emerging', color: 'bg-muted text-foreground/80', icon: Sparkles },
      established: { label: 'Established', color: 'bg-blue-100 text-blue-700', icon: Star },
      premier: { label: 'Premier', color: 'bg-amber-100 text-amber-700', icon: Trophy },
    };
    const config = tierConfig[tier] || tierConfig.emerging;
    const Icon = config.icon;
    return (
      <Badge className={`${config.color} flex items-center gap-1`}>
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
    );
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount || 0);
  };

  const getKYCBadge = (status, level) => {
    if (status === 'verified' || status === 'approved') {
      return <Badge className="bg-green-100 text-green-700">Level {level || 1}</Badge>;
    } else if (status === 'pending' || status === 'in_review') {
      return <Badge className="bg-yellow-100 text-yellow-700">Pending</Badge>;
    } else if (status === 'rejected') {
      return <Badge className="bg-red-100 text-red-700">Rejected</Badge>;
    }
    return <Badge className="bg-muted text-foreground/80">No KYC</Badge>;
  };

  const filteredOrganizers = organizers.filter((org) => {
    const matchesSearch =
      org.business_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      org.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      org.business_email?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCountry = countryFilter === 'all' || org.country_code === countryFilter;

    let matchesStatus = true;
    if (filter === 'verified') matchesStatus = org.kyc_status === 'verified' || org.kyc_status === 'approved';
    if (filter === 'pending') matchesStatus = org.kyc_status === 'pending' || org.kyc_status === 'in_review';
    if (filter === 'suspended') matchesStatus = org.is_active === false;
    if (filter === 'no-kyc') matchesStatus = !org.kyc_status || org.kyc_status === 'none';

    return matchesSearch && matchesCountry && matchesStatus;
  });

  const stats = {
    total: organizers.length,
    verified: organizers.filter(o => o.kyc_status === 'verified' || o.kyc_status === 'approved').length,
    pending: organizers.filter(o => o.kyc_status === 'pending' || o.kyc_status === 'in_review').length,
    suspended: organizers.filter(o => o.is_active === false).length,
  };

  // Pagination
  const {
    currentPage,
    totalPages,
    totalItems,
    itemsPerPage,
    paginatedItems: paginatedOrganizers,
    handlePageChange,
  } = usePagination(filteredOrganizers, 20);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">All Organizers</h2>
          <p className="text-muted-foreground mt-1">Manage all platform organizers</p>
        </div>
        <Button variant="outline" size="icon" onClick={loadOrganizers} className="rounded-xl">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-semibold">{stats.total}</p>
              </div>
              <Building className="w-8 h-8 text-[#2969FF]/20" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Verified</p>
                <p className="text-2xl font-semibold text-green-600">{stats.verified}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-200" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending KYC</p>
                <p className="text-2xl font-semibold text-yellow-600">{stats.pending}</p>
              </div>
              <Shield className="w-8 h-8 text-yellow-200" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Suspended</p>
                <p className="text-2xl font-semibold text-red-600">{stats.suspended}</p>
              </div>
              <Ban className="w-8 h-8 text-red-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filter */}
      <Card className="border-border/10 rounded-2xl">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Search organizers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-card border-border/10 rounded-xl"
              />
            </div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-40 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="pending">Pending KYC</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="no-kyc">No KYC</SelectItem>
              </SelectContent>
            </Select>
            <Select value={countryFilter} onValueChange={setCountryFilter}>
              <SelectTrigger className="w-44 rounded-xl">
                <SelectValue placeholder="All Countries" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">All Countries</SelectItem>
                <SelectItem value="NG">🇳🇬 Nigeria (NGN)</SelectItem>
                <SelectItem value="GH">🇬🇭 Ghana (GHS)</SelectItem>
                <SelectItem value="KE">🇰🇪 Kenya (KES)</SelectItem>
                <SelectItem value="ZA">🇿🇦 South Africa (ZAR)</SelectItem>
                <SelectItem value="US">🇺🇸 United States (USD)</SelectItem>
                <SelectItem value="GB">🇬🇧 United Kingdom (GBP)</SelectItem>
                <SelectItem value="CA">🇨🇦 Canada (CAD)</SelectItem>
                <SelectItem value="AU">🇦🇺 Australia (AUD)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Organizers Table */}
      <Card className="border-border/10 rounded-2xl">
        <CardHeader>
          <CardTitle className="text-foreground">Organizers ({filteredOrganizers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/10">
                  <th className="text-left py-4 px-4 text-muted-foreground font-medium">Organizer</th>
                  <th className="text-left py-4 px-4 text-muted-foreground font-medium">Contact</th>
                  <th className="text-left py-4 px-4 text-muted-foreground font-medium">Country</th>
                  <th className="text-left py-4 px-4 text-muted-foreground font-medium">Events</th>
                  <th className="text-left py-4 px-4 text-muted-foreground font-medium">Revenue</th>
                  <th className="text-left py-4 px-4 text-muted-foreground font-medium">KYC</th>
                  <th className="text-left py-4 px-4 text-muted-foreground font-medium">Connect</th>
                  <th className="text-left py-4 px-4 text-muted-foreground font-medium">Tier</th>
                  <th className="text-left py-4 px-4 text-muted-foreground font-medium">Status</th>
                  <th className="text-right py-4 px-4 text-muted-foreground font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedOrganizers.map((org) => (
                  <tr key={org.id} className="border-b border-border/5 hover:bg-muted/50">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        {org.logo_url ? (
                          <img src={org.logo_url} alt={org.business_name} className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-[#2969FF] flex items-center justify-center text-white font-medium">
                            {org.business_name?.charAt(0) || 'O'}
                          </div>
                        )}
                        <div>
                          <p className="text-foreground font-medium">{org.business_name || 'Unnamed'}</p>
                          <p className="text-sm text-muted-foreground">
                            Joined {new Date(org.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <p className="text-foreground/80 text-sm">{org.email || org.business_email || 'N/A'}</p>
                      <p className="text-muted-foreground text-sm">{org.phone || org.business_phone || 'N/A'}</p>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{COUNTRY_CURRENCY_MAP[org.country_code]?.flag || '🌍'}</span>
                        <div>
                          <p className="text-foreground text-sm font-medium">{org.country_code || 'N/A'}</p>
                          <p className="text-xs text-muted-foreground">{getCurrencyForCountry(org.country_code)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <p className="text-foreground">{org.eventCount}</p>
                      <p className="text-sm text-muted-foreground">{org.totalTickets} tickets</p>
                    </td>
                    <td className="py-4 px-4">
                      <p className="text-foreground font-medium">{formatCurrency(org.totalRevenue)}</p>
                    </td>
                    <td className="py-4 px-4">
                      {getKYCBadge(org.kyc_status, org.kyc_level)}
                    </td>
                    <td className="py-4 px-4">
                      {org.stripe_connect_status === 'active' ? (
                        <Badge className="bg-purple-100 text-purple-700 flex items-center gap-1 w-fit">
                          <CreditCard className="w-3 h-3" />Connected
                        </Badge>
                      ) : org.stripe_connect_status === 'pending' ? (
                        <Badge className="bg-yellow-100 text-yellow-700">Pending</Badge>
                      ) : (
                        <span className="text-foreground/30">—</span>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex flex-col gap-1">
                        {getTierBadge(org.organizer_tier)}
                        {org.direct_payout_eligible ? (
                          <Badge className="bg-green-100 text-green-700 flex items-center gap-1 w-fit text-xs">
                            <Unlock className="w-2.5 h-2.5" />Payout OK
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-700 flex items-center gap-1 w-fit text-xs">
                            <Lock className="w-2.5 h-2.5" />{org.completed_events_count || 0}/{org.required_events_for_payout || 5}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      {org.is_active !== false ? (
                        <Badge className="bg-green-100 text-green-700">Active</Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-700">Suspended</Badge>
                      )}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="rounded-xl">
                            <MoreVertical className="w-5 h-5 text-muted-foreground" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl">
                          <DropdownMenuItem onClick={() => openDetailsDialog(org)}>
                            <Eye className="w-4 h-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleLoginAs(org)} className="text-[#2969FF]">
                            <LogIn className="w-4 h-4 mr-2" />
                            Login as Organizer
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {(org.kyc_status === 'pending' || org.kyc_status === 'in_review') && (
                            <DropdownMenuItem asChild>
                              <Link to="/admin/kyc">
                                <Shield className="w-4 h-4 mr-2" />
                                Review KYC
                              </Link>
                            </DropdownMenuItem>
                          )}
                          {org.is_active !== false ? (
                            <DropdownMenuItem
                              className="text-red-500"
                              onClick={() => openActionDialog(org, 'suspend')}
                            >
                              <Ban className="w-4 h-4 mr-2" />
                              Suspend
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              className="text-green-600"
                              onClick={() => openActionDialog(org, 'activate')}
                            >
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Activate
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
                {filteredOrganizers.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-muted-foreground">
                      No organizers found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            itemsPerPage={itemsPerPage}
            onPageChange={handlePageChange}
          />
        </CardContent>
      </Card>

      {/* Full Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>Organizer Profile</DialogTitle>
          </DialogHeader>
          {selectedOrganizer && (
            <div className="space-y-6 py-4">
              {/* Header */}
              <div className="flex items-start gap-4">
                {selectedOrganizer.logo_url ? (
                  <img src={selectedOrganizer.logo_url} alt={selectedOrganizer.business_name} className="w-20 h-20 rounded-2xl object-cover" />
                ) : (
                  <div className="w-20 h-20 rounded-2xl bg-[#2969FF] flex items-center justify-center text-white text-3xl font-medium">
                    {selectedOrganizer.business_name?.charAt(0) || 'O'}
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="text-2xl font-semibold text-foreground">{selectedOrganizer.business_name}</h3>
                    {selectedOrganizer.is_active !== false ? (
                      <Badge className="bg-green-100 text-green-700">Active</Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-700">Suspended</Badge>
                    )}
                    {getKYCBadge(selectedOrganizer.kyc_status, selectedOrganizer.kyc_level)}
                  </div>
                  <p className="text-muted-foreground mt-1">{selectedOrganizer.description || 'No description provided'}</p>
                </div>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-4 gap-4">
                <div className="p-4 bg-blue-50 rounded-xl text-center">
                  <Calendar className="w-6 h-6 text-[#2969FF] mx-auto mb-2" />
                  <p className="text-2xl font-semibold text-[#2969FF]">{selectedOrganizer.eventCount}</p>
                  <p className="text-sm text-muted-foreground">Events</p>
                </div>
                <div className="p-4 bg-green-50 rounded-xl text-center">
                  <Ticket className="w-6 h-6 text-green-600 mx-auto mb-2" />
                  <p className="text-2xl font-semibold text-green-600">{selectedOrganizer.totalTickets}</p>
                  <p className="text-sm text-muted-foreground">Tickets Sold</p>
                </div>
                <div className="p-4 bg-purple-50 rounded-xl text-center">
                  <TrendingUp className="w-6 h-6 text-purple-600 mx-auto mb-2" />
                  <p className="text-lg font-semibold text-purple-600">{formatCurrency(selectedOrganizer.totalRevenue)}</p>
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                </div>
                <div className="p-4 bg-orange-50 rounded-xl text-center">
                  <DollarSign className="w-6 h-6 text-orange-600 mx-auto mb-2" />
                  <p className="text-lg font-semibold text-orange-600">{formatCurrency(selectedOrganizer.available_balance)}</p>
                  <p className="text-sm text-muted-foreground">Balance</p>
                </div>
              </div>

              {loadingDetails ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-[#2969FF]" />
                </div>
              ) : (
                <Tabs defaultValue="info" className="w-full">
                  <TabsList className="bg-muted rounded-xl flex-wrap">
                    <TabsTrigger value="info" className="rounded-lg">Contact Info</TabsTrigger>
                    <TabsTrigger value="account" className="rounded-lg">Account</TabsTrigger>
                    <TabsTrigger value="events" className="rounded-lg">Events ({organizerEvents.length})</TabsTrigger>
                    <TabsTrigger value="payouts" className="rounded-lg">Payouts ({organizerPayouts.length})</TabsTrigger>
                    <TabsTrigger value="tier" className="rounded-lg">Tier & Payouts</TabsTrigger>
                    <TabsTrigger value="features" className="rounded-lg">Features</TabsTrigger>
                    <TabsTrigger value="pricing" className="rounded-lg">Custom Pricing</TabsTrigger>
                  </TabsList>

                  <TabsContent value="info" className="mt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-muted rounded-xl">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <Mail className="w-4 h-4" />
                          <span className="text-sm">Email</span>
                        </div>
                        <p className="text-foreground">{selectedOrganizer.email || selectedOrganizer.business_email || 'N/A'}</p>
                      </div>
                      <div className="p-4 bg-muted rounded-xl">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <Phone className="w-4 h-4" />
                          <span className="text-sm">Phone</span>
                        </div>
                        <p className="text-foreground">{selectedOrganizer.phone || selectedOrganizer.business_phone || 'N/A'}</p>
                      </div>
                      <div className="p-4 bg-muted rounded-xl">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <MapPin className="w-4 h-4" />
                          <span className="text-sm">Location</span>
                        </div>
                        <p className="text-foreground">{selectedOrganizer.location || 'N/A'}</p>
                      </div>
                      <div className="p-4 bg-muted rounded-xl">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <Globe className="w-4 h-4" />
                          <span className="text-sm">Website</span>
                        </div>
                        <p className="text-foreground">{selectedOrganizer.website || selectedOrganizer.website_url || 'N/A'}</p>
                      </div>
                      <div className="p-4 bg-muted rounded-xl">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <Calendar className="w-4 h-4" />
                          <span className="text-sm">Joined</span>
                        </div>
                        <p className="text-foreground">{new Date(selectedOrganizer.created_at).toLocaleDateString()}</p>
                      </div>
                      <div className="p-4 bg-muted rounded-xl">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <Shield className="w-4 h-4" />
                          <span className="text-sm">KYC Status</span>
                        </div>
                        {getKYCBadge(selectedOrganizer.kyc_status, selectedOrganizer.kyc_level)}
                      </div>
                    </div>

                    {/* Social Links */}
                    <div className="mt-4 p-4 bg-muted rounded-xl">
                      <p className="text-sm text-muted-foreground mb-3">Social Media</p>
                      <div className="flex gap-3">
                        {(selectedOrganizer.instagram || selectedOrganizer.social_instagram) && (
                          <a href={selectedOrganizer.instagram || selectedOrganizer.social_instagram} target="_blank" rel="noopener noreferrer" className="p-2 bg-card rounded-lg hover:bg-pink-50">
                            <Instagram className="w-5 h-5 text-pink-600" />
                          </a>
                        )}
                        {(selectedOrganizer.twitter || selectedOrganizer.social_twitter) && (
                          <a href={selectedOrganizer.twitter || selectedOrganizer.social_twitter} target="_blank" rel="noopener noreferrer" className="p-2 bg-card rounded-lg hover:bg-blue-50">
                            <Twitter className="w-5 h-5 text-blue-400" />
                          </a>
                        )}
                        {(selectedOrganizer.facebook || selectedOrganizer.social_facebook) && (
                          <a href={selectedOrganizer.facebook || selectedOrganizer.social_facebook} target="_blank" rel="noopener noreferrer" className="p-2 bg-card rounded-lg hover:bg-blue-50">
                            <Facebook className="w-5 h-5 text-blue-600" />
                          </a>
                        )}
                        {(selectedOrganizer.linkedin || selectedOrganizer.social_linkedin) && (
                          <a href={selectedOrganizer.linkedin || selectedOrganizer.social_linkedin} target="_blank" rel="noopener noreferrer" className="p-2 bg-card rounded-lg hover:bg-blue-50">
                            <Linkedin className="w-5 h-5 text-blue-700" />
                          </a>
                        )}
                        {!selectedOrganizer.instagram && !selectedOrganizer.social_instagram && 
                         !selectedOrganizer.twitter && !selectedOrganizer.social_twitter &&
                         !selectedOrganizer.facebook && !selectedOrganizer.social_facebook &&
                         !selectedOrganizer.linkedin && !selectedOrganizer.social_linkedin && (
                          <p className="text-muted-foreground text-sm">No social links added</p>
                        )}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="account" className="mt-4 space-y-4">
                    {/* Country & Currency Settings */}
                    <div className="p-4 bg-card border border-border/10 rounded-xl space-y-4">
                      <h4 className="font-semibold text-foreground flex items-center gap-2">
                        <Globe className="w-5 h-5 text-[#2969FF]" />
                        Country & Currency
                      </h4>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm text-muted-foreground mb-2 block">Country</label>
                          <Select
                            value={accountData.country_code}
                            onValueChange={(value) => setAccountData(prev => ({
                              ...prev,
                              country_code: value,
                              default_currency: getCurrencyForCountry(value)
                            }))}
                          >
                            <SelectTrigger className="rounded-xl">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                              {Object.entries(COUNTRY_CURRENCY_MAP).map(([code, info]) => (
                                <SelectItem key={code} value={code}>
                                  <span className="flex items-center gap-2">
                                    <span>{info.flag}</span>
                                    <span>{info.name}</span>
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <label className="text-sm text-muted-foreground mb-2 block">Currency</label>
                          <div className="flex items-center gap-2 p-3 bg-muted rounded-xl">
                            <span className="text-2xl">{COUNTRY_CURRENCY_MAP[accountData.country_code]?.symbol || '$'}</span>
                            <div>
                              <p className="font-semibold text-foreground">
                                {getCurrencyForCountry(accountData.country_code)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Based on selected country
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Show change preview if different from current */}
                      {accountData.country_code !== selectedOrganizer.country_code && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                            <div className="text-sm">
                              <p className="font-medium text-amber-800">Currency Change Preview</p>
                              <p className="text-amber-700">
                                {COUNTRY_CURRENCY_MAP[selectedOrganizer.country_code]?.flag} {selectedOrganizer.country_code} ({getCurrencyForCountry(selectedOrganizer.country_code)})
                                {' → '}
                                {COUNTRY_CURRENCY_MAP[accountData.country_code]?.flag} {accountData.country_code} ({getCurrencyForCountry(accountData.country_code)})
                              </p>
                              <p className="text-amber-600 mt-1">
                                This will change the organizer's default currency for future events and payouts.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      <Button
                        onClick={saveAccountSettings}
                        disabled={savingAccount || accountData.country_code === selectedOrganizer.country_code}
                        className="rounded-xl bg-[#2969FF] hover:bg-[#2969FF]/90"
                      >
                        {savingAccount ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <CheckCircle className="w-4 h-4 mr-2" />
                        )}
                        Save Country & Currency
                      </Button>
                    </div>

                    {/* Payment Gateway Info */}
                    <div className="p-4 bg-muted rounded-xl">
                      <h4 className="font-semibold text-foreground mb-3">Payment Gateway Routing</h4>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="p-3 bg-card rounded-lg">
                          <p className="text-muted-foreground mb-1">Africa (NG, GH, KE, ZA)</p>
                          <div className="flex items-center gap-2">
                            <Zap className="w-4 h-4 text-blue-600" />
                            <span className="font-medium">Paystack / Flutterwave</span>
                          </div>
                        </div>
                        <div className="p-3 bg-card rounded-lg">
                          <p className="text-muted-foreground mb-1">International (US, GB, CA, AU)</p>
                          <div className="flex items-center gap-2">
                            <CreditCard className="w-4 h-4 text-purple-600" />
                            <span className="font-medium">Stripe Connect</span>
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-3">
                        Payment gateway is automatically determined by the organizer's country.
                      </p>
                    </div>

                    {/* Current Connection Status */}
                    <div className="p-4 bg-card border border-border/10 rounded-xl">
                      <h4 className="font-semibold text-foreground mb-3">Payment Connections</h4>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="p-3 bg-muted rounded-lg text-center">
                          <CreditCard className="w-5 h-5 text-purple-600 mx-auto mb-1" />
                          <p className="text-xs text-muted-foreground">Stripe</p>
                          <Badge className={selectedOrganizer.stripe_connect_status === 'active' ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}>
                            {selectedOrganizer.stripe_connect_status || 'Not Connected'}
                          </Badge>
                        </div>
                        <div className="p-3 bg-muted rounded-lg text-center">
                          <Zap className="w-5 h-5 text-blue-600 mx-auto mb-1" />
                          <p className="text-xs text-muted-foreground">Paystack</p>
                          <Badge className={selectedOrganizer.paystack_subaccount_status === 'active' ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}>
                            {selectedOrganizer.paystack_subaccount_status || 'Not Connected'}
                          </Badge>
                        </div>
                        <div className="p-3 bg-muted rounded-lg text-center">
                          <Globe className="w-5 h-5 text-orange-600 mx-auto mb-1" />
                          <p className="text-xs text-muted-foreground">Flutterwave</p>
                          <Badge className={selectedOrganizer.flutterwave_subaccount_status === 'active' ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}>
                            {selectedOrganizer.flutterwave_subaccount_status || 'Not Connected'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="events" className="mt-4">
                    {organizerEvents.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">No events yet</p>
                    ) : (
                      <div className="space-y-2">
                        {organizerEvents.map((event) => (
                          <div key={event.id} className="flex items-center justify-between p-3 bg-muted rounded-xl">
                            <div>
                              <p className="text-foreground font-medium">{event.title}</p>
                              <p className="text-sm text-muted-foreground">
                                {new Date(event.start_date).toLocaleDateString()} • {formatCurrency(event.ticket_price)}
                              </p>
                            </div>
                            <Badge className={event.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-muted text-foreground/80'}>
                              {event.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="payouts" className="mt-4">
                    {organizerPayouts.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">No payouts yet</p>
                    ) : (
                      <div className="space-y-2">
                        {organizerPayouts.map((payout) => (
                          <div key={payout.id} className="flex items-center justify-between p-3 bg-muted rounded-xl">
                            <div>
                              <p className="text-foreground font-medium">{formatCurrency(payout.net_amount)}</p>
                              <p className="text-sm text-muted-foreground">
                                {new Date(payout.created_at).toLocaleDateString()}
                              </p>
                            </div>
                            <Badge className={
                              payout.status === 'completed' ? 'bg-green-100 text-green-700' :
                              payout.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                              payout.status === 'processing' ? 'bg-blue-100 text-blue-700' :
                              'bg-red-100 text-red-700'
                            }>
                              {payout.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="tier" className="mt-4 space-y-4">
                    {/* Tier Info */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-muted rounded-xl">
                        <p className="text-sm text-muted-foreground mb-2">Organizer Tier</p>
                        {getTierBadge(selectedOrganizer.organizer_tier)}
                        {selectedOrganizer.tier_calculated_at && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Last updated: {new Date(selectedOrganizer.tier_calculated_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <div className="p-4 bg-muted rounded-xl">
                        <p className="text-sm text-muted-foreground mb-2">Completed Events</p>
                        <p className="text-2xl font-semibold text-foreground">
                          {selectedOrganizer.completed_events_count || 0}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Required for direct payout: {selectedOrganizer.required_events_for_payout || 5}
                        </p>
                      </div>
                      <div className="p-4 bg-muted rounded-xl">
                        <p className="text-sm text-muted-foreground mb-2">Refund Rate</p>
                        <p className="text-2xl font-semibold text-foreground">
                          {selectedOrganizer.refund_rate || 0}%
                        </p>
                      </div>
                      <div className="p-4 bg-muted rounded-xl">
                        <p className="text-sm text-muted-foreground mb-2">Cancellation Rate</p>
                        <p className="text-2xl font-semibold text-foreground">
                          {selectedOrganizer.cancellation_rate || 0}%
                        </p>
                      </div>
                    </div>

                    {/* Direct Payout Status */}
                    <div className={`p-4 rounded-xl border-2 ${
                      selectedOrganizer.direct_payout_eligible
                        ? 'bg-green-50 border-green-200'
                        : 'bg-amber-50 border-amber-200'
                    }`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          {selectedOrganizer.direct_payout_eligible ? (
                            <Unlock className="w-5 h-5 text-green-600" />
                          ) : (
                            <Lock className="w-5 h-5 text-amber-600" />
                          )}
                          <span className="font-semibold text-foreground">
                            Direct Payout {selectedOrganizer.direct_payout_eligible ? 'Unlocked' : 'Locked'}
                          </span>
                        </div>
                        {selectedOrganizer.direct_payout_override && (
                          <Badge className="bg-purple-100 text-purple-700">Admin Override</Badge>
                        )}
                      </div>

                      {selectedOrganizer.direct_payout_eligible ? (
                        <p className="text-sm text-green-700">
                          {selectedOrganizer.direct_payout_override
                            ? `Override enabled by admin${selectedOrganizer.direct_payout_override_reason ? `: ${selectedOrganizer.direct_payout_override_reason}` : ''}`
                            : 'Organizer has completed enough events to unlock direct payouts.'}
                        </p>
                      ) : (
                        <div>
                          <p className="text-sm text-amber-700 mb-2">
                            {(selectedOrganizer.required_events_for_payout || 5) - (selectedOrganizer.completed_events_count || 0)} more events needed to unlock.
                          </p>
                          <div className="h-2 bg-amber-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-amber-500 rounded-full"
                              style={{
                                width: `${Math.min(100, ((selectedOrganizer.completed_events_count || 0) / (selectedOrganizer.required_events_for_payout || 5)) * 100)}%`
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Admin Override */}
                    <div className="p-4 bg-card border border-border/10 rounded-xl">
                      <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                        <Shield className="w-4 h-4 text-[#2969FF]" />
                        Admin Override
                      </h4>

                      {selectedOrganizer.direct_payout_override ? (
                        <div className="space-y-3">
                          <p className="text-sm text-muted-foreground">
                            Direct payout is currently enabled via admin override.
                          </p>
                          <Button
                            onClick={() => toggleDirectPayoutOverride(false)}
                            disabled={savingPayoutOverride}
                            variant="outline"
                            className="rounded-xl border-red-200 text-red-600 hover:bg-red-50"
                          >
                            {savingPayoutOverride ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <Lock className="w-4 h-4 mr-2" />
                            )}
                            Remove Override
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <p className="text-sm text-muted-foreground">
                            Enable direct payout for this organizer before they complete the required events.
                          </p>
                          <Textarea
                            placeholder="Reason for override (required)..."
                            value={payoutOverrideReason}
                            onChange={(e) => setPayoutOverrideReason(e.target.value)}
                            className="rounded-xl"
                            rows={2}
                          />
                          <Button
                            onClick={() => toggleDirectPayoutOverride(true)}
                            disabled={savingPayoutOverride || !payoutOverrideReason.trim()}
                            className="rounded-xl bg-[#2969FF] hover:bg-[#2969FF]/90"
                          >
                            {savingPayoutOverride ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <Unlock className="w-4 h-4 mr-2" />
                            )}
                            Enable Direct Payout
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Tier Criteria Info */}
                    <div className="p-4 bg-blue-50 rounded-xl">
                      <h4 className="font-semibold text-blue-800 mb-2">Tier Criteria</h4>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="font-medium text-blue-700">Emerging</p>
                          <p className="text-blue-600/70">0-2 events</p>
                        </div>
                        <div>
                          <p className="font-medium text-blue-700">Established</p>
                          <p className="text-blue-600/70">3-9 events, ≤5% refund</p>
                        </div>
                        <div>
                          <p className="font-medium text-blue-700">Premier</p>
                          <p className="text-blue-600/70">10+ events, ≤2% refund</p>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="features" className="mt-4 space-y-4">
                    {/* Feature Flags Header */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold text-foreground flex items-center gap-2">
                          <Settings2 className="w-5 h-5 text-[#2969FF]" />
                          Feature Management
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          Enable or disable specific features for this organizer
                        </p>
                      </div>
                      <Button
                        onClick={saveFeatureFlags}
                        disabled={savingFeatures}
                        className="rounded-xl bg-[#2969FF] hover:bg-[#2969FF]/90"
                      >
                        {savingFeatures ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <CheckCircle className="w-4 h-4 mr-2" />
                        )}
                        Save Changes
                      </Button>
                    </div>

                    {/* Payments Section */}
                    <div className="space-y-3">
                      <h5 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                        Payments & Payouts
                      </h5>
                      <div className="grid gap-3">
                        {featureFlagsConfig.filter(f => f.category === 'payments').map((feature) => {
                          const Icon = feature.icon;
                          const isEnabled = featureFlags[feature.key] ?? true;
                          return (
                            <div
                              key={feature.key}
                              className={`flex items-center justify-between p-4 rounded-xl border ${
                                !isEnabled ? 'bg-red-50 border-red-200' : 'bg-card border-border/10'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                  !isEnabled ? 'bg-red-100' : 'bg-[#2969FF]/10'
                                }`}>
                                  <Icon className={`w-5 h-5 ${!isEnabled ? 'text-red-600' : 'text-[#2969FF]'}`} />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium text-foreground">{feature.label}</p>
                                    {feature.warning && !isEnabled && (
                                      <Badge className="bg-red-100 text-red-700 text-xs">Escrow Only</Badge>
                                    )}
                                  </div>
                                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                                </div>
                              </div>
                              <Switch
                                checked={isEnabled}
                                onCheckedChange={(checked) => toggleFeatureFlag(feature.key, checked)}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Notifications Section */}
                    <div className="space-y-3">
                      <h5 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                        Notifications
                      </h5>
                      <div className="grid gap-3">
                        {featureFlagsConfig.filter(f => f.category === 'notifications').map((feature) => {
                          const Icon = feature.icon;
                          const isEnabled = featureFlags[feature.key] ?? true;
                          return (
                            <div
                              key={feature.key}
                              className={`flex items-center justify-between p-4 rounded-xl border ${
                                !isEnabled ? 'bg-red-50 border-red-200' : 'bg-card border-border/10'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                  !isEnabled ? 'bg-red-100' : 'bg-green-100'
                                }`}>
                                  <Icon className={`w-5 h-5 ${!isEnabled ? 'text-red-600' : 'text-green-600'}`} />
                                </div>
                                <div>
                                  <p className="font-medium text-foreground">{feature.label}</p>
                                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                                </div>
                              </div>
                              <Switch
                                checked={isEnabled}
                                onCheckedChange={(checked) => toggleFeatureFlag(feature.key, checked)}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Tickets Section */}
                    <div className="space-y-3">
                      <h5 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                        Tickets & Sales
                      </h5>
                      <div className="grid gap-3">
                        {featureFlagsConfig.filter(f => f.category === 'tickets').map((feature) => {
                          const Icon = feature.icon;
                          const isEnabled = featureFlags[feature.key] ?? true;
                          return (
                            <div
                              key={feature.key}
                              className={`flex items-center justify-between p-4 rounded-xl border ${
                                !isEnabled ? 'bg-red-50 border-red-200' : 'bg-card border-border/10'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                  !isEnabled ? 'bg-red-100' : 'bg-purple-100'
                                }`}>
                                  <Icon className={`w-5 h-5 ${!isEnabled ? 'text-red-600' : 'text-purple-600'}`} />
                                </div>
                                <div>
                                  <p className="font-medium text-foreground">{feature.label}</p>
                                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                                </div>
                              </div>
                              <Switch
                                checked={isEnabled}
                                onCheckedChange={(checked) => toggleFeatureFlag(feature.key, checked)}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Events Section */}
                    <div className="space-y-3">
                      <h5 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                        Event Features
                      </h5>
                      <div className="grid gap-3">
                        {featureFlagsConfig.filter(f => f.category === 'events').map((feature) => {
                          const Icon = feature.icon;
                          const isEnabled = featureFlags[feature.key] ?? true;
                          return (
                            <div
                              key={feature.key}
                              className={`flex items-center justify-between p-4 rounded-xl border ${
                                !isEnabled ? 'bg-red-50 border-red-200' : 'bg-card border-border/10'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                  !isEnabled ? 'bg-red-100' : 'bg-orange-100'
                                }`}>
                                  <Icon className={`w-5 h-5 ${!isEnabled ? 'text-red-600' : 'text-orange-600'}`} />
                                </div>
                                <div>
                                  <p className="font-medium text-foreground">{feature.label}</p>
                                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                                </div>
                              </div>
                              <Switch
                                checked={isEnabled}
                                onCheckedChange={(checked) => toggleFeatureFlag(feature.key, checked)}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Marketing Section */}
                    <div className="space-y-3">
                      <h5 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                        Marketing & Promotion
                      </h5>
                      <div className="grid gap-3">
                        {featureFlagsConfig.filter(f => f.category === 'marketing').map((feature) => {
                          const Icon = feature.icon;
                          const isEnabled = featureFlags[feature.key] ?? true;
                          return (
                            <div
                              key={feature.key}
                              className={`flex items-center justify-between p-4 rounded-xl border ${
                                !isEnabled ? 'bg-red-50 border-red-200' : 'bg-card border-border/10'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                  !isEnabled ? 'bg-red-100' : 'bg-pink-100'
                                }`}>
                                  <Icon className={`w-5 h-5 ${!isEnabled ? 'text-red-600' : 'text-pink-600'}`} />
                                </div>
                                <div>
                                  <p className="font-medium text-foreground">{feature.label}</p>
                                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                                </div>
                              </div>
                              <Switch
                                checked={isEnabled}
                                onCheckedChange={(checked) => toggleFeatureFlag(feature.key, checked)}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Warning Notice */}
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-amber-800">Important</p>
                        <p className="text-sm text-amber-700">
                          Disabling features will immediately affect the organizer's dashboard.
                          They will not be able to use disabled features until re-enabled.
                          When "Direct Payment" is disabled, the organizer will only receive payouts through escrow.
                        </p>
                      </div>
                    </div>

                    {/* Last Updated */}
                    {selectedOrganizer.feature_flags_updated_at && (
                      <p className="text-xs text-muted-foreground text-right">
                        Last updated: {new Date(selectedOrganizer.feature_flags_updated_at).toLocaleString()}
                      </p>
                    )}
                  </TabsContent>

                  <TabsContent value="pricing" className="mt-4 space-y-4">
                    {/* Custom Fee Settings */}
                    <div className="p-4 bg-card border border-border/10 rounded-xl space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-semibold text-foreground flex items-center gap-2">
                            <Percent className="w-5 h-5 text-[#2969FF]" />
                            Custom Service Fees
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            Override platform default fees for this organizer
                          </p>
                        </div>
                        <Switch
                          checked={customFeeData.enabled}
                          onCheckedChange={(checked) => setCustomFeeData(prev => ({ ...prev, enabled: checked }))}
                        />
                      </div>

                      {customFeeData.enabled && (
                        <div className="grid grid-cols-2 gap-4 pt-3 border-t border-border/10">
                          <div>
                            <label className="text-sm text-muted-foreground mb-2 block">Percentage Fee (%)</label>
                            <Input
                              type="number"
                              step="0.1"
                              min="0"
                              max="100"
                              placeholder="e.g., 3.5"
                              value={customFeeData.percentage}
                              onChange={(e) => setCustomFeeData(prev => ({ ...prev, percentage: e.target.value }))}
                              className="rounded-xl"
                            />
                          </div>
                          <div>
                            <label className="text-sm text-muted-foreground mb-2 block">Fixed Fee (₦)</label>
                            <Input
                              type="number"
                              step="1"
                              min="0"
                              placeholder="e.g., 100"
                              value={customFeeData.fixed}
                              onChange={(e) => setCustomFeeData(prev => ({ ...prev, fixed: e.target.value }))}
                              className="rounded-xl"
                            />
                          </div>
                        </div>
                      )}

                      {customFeeData.enabled && (
                        <div className="p-3 bg-blue-50 rounded-xl text-sm">
                          <p className="text-blue-800 font-medium">Fee Calculation Example</p>
                          <p className="text-blue-600">
                            For a ₦10,000 ticket: {customFeeData.percentage || 0}% + ₦{customFeeData.fixed || 0} =
                            ₦{((parseFloat(customFeeData.percentage) || 0) / 100 * 10000 + (parseFloat(customFeeData.fixed) || 0)).toLocaleString()}
                          </p>
                        </div>
                      )}

                      <Button
                        onClick={saveCustomFees}
                        disabled={savingFees}
                        className="rounded-xl bg-[#2969FF] hover:bg-[#2969FF]/90"
                      >
                        {savingFees ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <CheckCircle className="w-4 h-4 mr-2" />
                        )}
                        Save Custom Pricing
                      </Button>

                      {selectedOrganizer.custom_fee_set_at && (
                        <p className="text-xs text-muted-foreground">
                          Last updated: {new Date(selectedOrganizer.custom_fee_set_at).toLocaleString()}
                        </p>
                      )}
                    </div>

                    {/* Platform Default Fees Info */}
                    <div className="p-4 bg-muted rounded-xl">
                      <h4 className="font-semibold text-foreground mb-2">Platform Default Fees</h4>
                      <p className="text-sm text-muted-foreground">
                        If custom fees are disabled, the platform default fees will apply.
                        Check the Fee Management page for current platform defaults.
                      </p>
                    </div>
                  </TabsContent>
                </Tabs>
              )}

              {/* Quick Actions */}
              <div className="flex gap-3 pt-4 border-t border-border/10">
                <Button
                  onClick={() => {
                    setDetailsDialogOpen(false);
                    handleLoginAs(selectedOrganizer);
                  }}
                  className="rounded-xl bg-[#2969FF] hover:bg-[#2969FF]/90 text-white"
                >
                  <LogIn className="w-4 h-4 mr-2" />
                  Login as Organizer
                </Button>
                {selectedOrganizer.is_active !== false ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDetailsDialogOpen(false);
                      openActionDialog(selectedOrganizer, 'suspend');
                    }}
                    className="rounded-xl border-red-200 text-red-600 hover:bg-red-50"
                  >
                    <Ban className="w-4 h-4 mr-2" />
                    Suspend Organizer
                  </Button>
                ) : (
                  <Button
                    onClick={() => {
                      setDetailsDialogOpen(false);
                      openActionDialog(selectedOrganizer, 'activate');
                    }}
                    className="rounded-xl bg-green-500 hover:bg-green-600 text-white"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Activate Organizer
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Action Dialog */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>
              {actionType === 'suspend' ? 'Suspend Organizer' : 'Activate Organizer'}
            </DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            {actionType === 'suspend'
              ? `Are you sure you want to suspend "${selectedOrganizer?.business_name}"? They will not be able to access their dashboard or receive payouts.`
              : `Are you sure you want to activate "${selectedOrganizer?.business_name}"? They will regain full access to their account.`}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialogOpen(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button
              onClick={handleAction}
              disabled={processing}
              className={`rounded-xl ${
                actionType === 'suspend' ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
              } text-white`}
            >
              {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
