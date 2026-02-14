import { useState, useEffect } from 'react';
import {
  Search,
  Loader2,
  RefreshCw,
  Building,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  CreditCard,
  Zap,
  Globe,
  Filter,
  Eye,
  ToggleLeft,
  ToggleRight,
  Unlink,
  Download,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
  DialogDescription,
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
import { Pagination } from '@/components/ui/pagination';
import { toast } from 'sonner';

// Status configuration for display
const STATUS_CONFIG = {
  active: { label: 'Active', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  not_started: { label: 'Not Connected', color: 'bg-muted text-muted-foreground', icon: XCircle },
  restricted: { label: 'Restricted', color: 'bg-orange-100 text-orange-700', icon: AlertCircle },
  disabled: { label: 'Disabled', color: 'bg-red-100 text-red-700', icon: XCircle },
};

// Provider icons and colors
const PROVIDER_CONFIG = {
  stripe: { name: 'Stripe Connect', icon: CreditCard, color: 'text-purple-600', bgColor: 'bg-purple-50' },
  paystack: { name: 'Paystack', icon: Zap, color: 'text-blue-600', bgColor: 'bg-blue-50' },
  flutterwave: { name: 'Flutterwave', icon: Globe, color: 'text-orange-600', bgColor: 'bg-orange-50' },
};

// Country flags/codes
const COUNTRY_FLAGS = {
  NG: '🇳🇬',
  GH: '🇬🇭',
  KE: '🇰🇪',
  ZA: '🇿🇦',
  US: '🇺🇸',
  GB: '🇬🇧',
  CA: '🇨🇦',
  AU: '🇦🇺',
};

const StatusBadge = ({ status }) => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.not_started;
  const Icon = config.icon;
  return (
    <Badge className={`${config.color} flex items-center gap-1`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </Badge>
  );
};

// Format currency for display
const formatCurrency = (amount, currency = 'NGN') => {
  const symbols = { NGN: '₦', USD: '$', GBP: '£', EUR: '€', GHS: 'GH₵', KES: 'KSh', ZAR: 'R', CAD: 'C$', AUD: 'A$' };
  const symbol = symbols[currency] || currency + ' ';
  return symbol + new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
};

// Render a multi-currency revenue object as stacked lines
const RevenueByCurrency = ({ revenueByCurrency, className = '' }) => {
  const entries = Object.entries(revenueByCurrency || {}).filter(([, amt]) => amt > 0);
  if (entries.length === 0) {
    return <span className={className}>{formatCurrency(0, 'NGN')}</span>;
  }
  // Sort by amount descending
  entries.sort((a, b) => b[1] - a[1]);
  return (
    <div className={className}>
      {entries.map(([currency, amount]) => (
        <div key={currency}>{formatCurrency(amount, currency)}</div>
      ))}
    </div>
  );
};

export function AdminPaymentConnections() {
  const { logAdminAction, admin } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [organizers, setOrganizers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [providerFilter, setProviderFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [countryFilter, setCountryFilter] = useState('all');
  const [selectedOrganizer, setSelectedOrganizer] = useState(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [stats, setStats] = useState({
    totalConnected: 0,
    stripeConnected: 0,
    paystackConnected: 0,
    flutterwaveConnected: 0,
  });
  const [revenueStats, setRevenueStats] = useState({
    stripeRevenue: {},
    paystackRevenue: {},
    flutterwaveRevenue: {},
    standardRevenue: {},
    totalRevenue: {},
  });
  const [loadingRevenue, setLoadingRevenue] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    loadOrganizers();
    loadRevenueStats();
  }, []);

  const loadRevenueStats = async () => {
    setLoadingRevenue(true);
    try {
      // Get orders with payment provider info
      const { data: orders, error } = await supabase
        .from('orders')
        .select('total_amount, currency, payment_provider, status')
        .eq('status', 'completed');

      if (error) throw error;

      // Calculate revenue by provider, grouped by currency
      const stripeRevenue = {};
      const paystackRevenue = {};
      const flutterwaveRevenue = {};
      const standardRevenue = {};
      const totalRevenue = {};

      (orders || []).forEach(order => {
        const amount = parseFloat(order.total_amount) || 0;
        const currency = order.currency || 'NGN';

        totalRevenue[currency] = (totalRevenue[currency] || 0) + amount;

        switch (order.payment_provider?.toLowerCase()) {
          case 'stripe':
          case 'stripe_connect':
            stripeRevenue[currency] = (stripeRevenue[currency] || 0) + amount;
            break;
          case 'paystack':
            paystackRevenue[currency] = (paystackRevenue[currency] || 0) + amount;
            break;
          case 'flutterwave':
            flutterwaveRevenue[currency] = (flutterwaveRevenue[currency] || 0) + amount;
            break;
          default:
            standardRevenue[currency] = (standardRevenue[currency] || 0) + amount;
        }
      });

      setRevenueStats({
        stripeRevenue,
        paystackRevenue,
        flutterwaveRevenue,
        standardRevenue,
        totalRevenue,
      });
    } catch (error) {
      console.error('Error loading revenue stats:', error);
    } finally {
      setLoadingRevenue(false);
    }
  };

  const loadOrganizers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('organizers')
        .select(`
          id,
          business_name,
          business_email,
          country_code,
          is_active,
          stripe_connect_id,
          stripe_connect_status,
          stripe_connect_enabled,
          stripe_connect_payouts_enabled,
          stripe_connect_charges_enabled,
          stripe_connect_onboarded_at,
          paystack_subaccount_id,
          paystack_subaccount_status,
          paystack_subaccount_enabled,
          paystack_subaccount_payouts_enabled,
          paystack_subaccount_charges_enabled,
          paystack_subaccount_onboarded_at,
          flutterwave_subaccount_id,
          flutterwave_subaccount_status,
          flutterwave_subaccount_enabled,
          flutterwave_subaccount_payouts_enabled,
          flutterwave_subaccount_charges_enabled,
          flutterwave_subaccount_onboarded_at,
          created_at
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrganizers(data || []);

      // Calculate stats
      const stripeConnected = data?.filter(o => o.stripe_connect_status === 'active').length || 0;
      const paystackConnected = data?.filter(o => o.paystack_subaccount_status === 'active').length || 0;
      const flutterwaveConnected = data?.filter(o => o.flutterwave_subaccount_status === 'active').length || 0;

      setStats({
        totalConnected: stripeConnected + paystackConnected + flutterwaveConnected,
        stripeConnected,
        paystackConnected,
        flutterwaveConnected,
      });
    } catch (error) {
      console.error('Error loading organizers:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter organizers
  const filteredOrganizers = organizers.filter(org => {
    // Search filter
    const matchesSearch = !searchQuery || 
      org.business_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      org.business_email?.toLowerCase().includes(searchQuery.toLowerCase());

    // Provider filter
    let matchesProvider = true;
    if (providerFilter === 'stripe') {
      matchesProvider = org.stripe_connect_id || org.stripe_connect_status !== 'not_started';
    } else if (providerFilter === 'paystack') {
      matchesProvider = org.paystack_subaccount_id || org.paystack_subaccount_status !== 'not_started';
    } else if (providerFilter === 'flutterwave') {
      matchesProvider = org.flutterwave_subaccount_id || org.flutterwave_subaccount_status !== 'not_started';
    } else if (providerFilter === 'any_connected') {
      matchesProvider = 
        org.stripe_connect_status === 'active' ||
        org.paystack_subaccount_status === 'active' ||
        org.flutterwave_subaccount_status === 'active';
    } else if (providerFilter === 'none') {
      matchesProvider = 
        (!org.stripe_connect_status || org.stripe_connect_status === 'not_started') &&
        (!org.paystack_subaccount_status || org.paystack_subaccount_status === 'not_started') &&
        (!org.flutterwave_subaccount_status || org.flutterwave_subaccount_status === 'not_started');
    }

    // Status filter
    let matchesStatus = true;
    if (statusFilter !== 'all') {
      matchesStatus = 
        org.stripe_connect_status === statusFilter ||
        org.paystack_subaccount_status === statusFilter ||
        org.flutterwave_subaccount_status === statusFilter;
    }

    // Country filter
    const matchesCountry = countryFilter === 'all' || org.country_code === countryFilter;

    return matchesSearch && matchesProvider && matchesStatus && matchesCountry;
  });

  // Paginate
  const totalPages = Math.max(1, Math.ceil(filteredOrganizers.length / pageSize));
  const paginatedOrganizers = filteredOrganizers.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, providerFilter, statusFilter, countryFilter]);

  const toggleProviderEnabled = async (organizerId, provider, currentEnabled) => {
    setProcessing(true);
    try {
      const field = `${provider}_enabled`;
      const { error } = await supabase
        .from('organizers')
        .update({ [field]: !currentEnabled })
        .eq('id', organizerId);

      if (error) throw error;

      await logAdminAction(
        currentEnabled ? 'payment_connection_disabled' : 'payment_connection_enabled',
        'organizer',
        organizerId,
        { provider, enabled: !currentEnabled }
      );

      loadOrganizers();
    } catch (error) {
      console.error('Error toggling provider:', error);
      toast.error('Failed to update: ' + error.message);
    } finally {
      setProcessing(false);
    }
  };

  const disconnectProvider = async () => {
    if (!selectedOrganizer || !actionType) return;
    setProcessing(true);

    try {
      const updates = {};
      if (actionType === 'stripe_connect') {
        updates.stripe_connect_id = null;
        updates.stripe_connect_status = 'not_started';
        updates.stripe_connect_enabled = false;
        updates.stripe_connect_payouts_enabled = false;
        updates.stripe_connect_charges_enabled = false;
        updates.stripe_connect_onboarded_at = null;
      } else if (actionType === 'paystack_subaccount') {
        updates.paystack_subaccount_id = null;
        updates.paystack_subaccount_status = 'not_started';
        updates.paystack_subaccount_enabled = false;
        updates.paystack_subaccount_payouts_enabled = false;
        updates.paystack_subaccount_charges_enabled = false;
        updates.paystack_subaccount_onboarded_at = null;
      } else if (actionType === 'flutterwave_subaccount') {
        updates.flutterwave_subaccount_id = null;
        updates.flutterwave_subaccount_status = 'not_started';
        updates.flutterwave_subaccount_enabled = false;
        updates.flutterwave_subaccount_payouts_enabled = false;
        updates.flutterwave_subaccount_charges_enabled = false;
        updates.flutterwave_subaccount_onboarded_at = null;
      }

      const { error } = await supabase
        .from('organizers')
        .update(updates)
        .eq('id', selectedOrganizer.id);

      if (error) throw error;

      await logAdminAction(
        'payment_connection_disconnected',
        'organizer',
        selectedOrganizer.id,
        { provider: actionType, businessName: selectedOrganizer.business_name }
      );

      // Send notification email to organizer
      try {
        const providerName = actionType === 'stripe_connect' ? 'Stripe Connect' 
          : actionType === 'paystack_subaccount' ? 'Paystack' 
          : 'Flutterwave';
        
        await supabase.functions.invoke('send-email', {
          body: {
            type: 'payment_connection_disconnected',
            to: selectedOrganizer.business_email,
            data: {
              organizerName: selectedOrganizer.business_name,
              provider: providerName,
              disconnectedAt: new Date().toISOString(),
              reason: 'Disconnected by administrator',
            },
          },
        });
      } catch (emailError) {
        console.error('Failed to send disconnect notification:', emailError);
      }

      setActionDialogOpen(false);
      loadOrganizers();
      toast.success('Payment connection disconnected successfully');
    } catch (error) {
      console.error('Error disconnecting:', error);
      toast.error('Failed to disconnect: ' + error.message);
    } finally {
      setProcessing(false);
    }
  };

  const openDisconnectDialog = (organizer, provider) => {
    setSelectedOrganizer(organizer);
    setActionType(provider);
    setActionDialogOpen(true);
  };

  const getProviderStatus = (org, provider) => {
    if (provider === 'stripe') {
      return {
        id: org.stripe_connect_id,
        status: org.stripe_connect_status || 'not_started',
        enabled: org.stripe_connect_enabled,
        payoutsEnabled: org.stripe_connect_payouts_enabled,
        chargesEnabled: org.stripe_connect_charges_enabled,
        onboardedAt: org.stripe_connect_onboarded_at,
        field: 'stripe_connect',
      };
    } else if (provider === 'paystack') {
      return {
        id: org.paystack_subaccount_id,
        status: org.paystack_subaccount_status || 'not_started',
        enabled: org.paystack_subaccount_enabled,
        payoutsEnabled: org.paystack_subaccount_payouts_enabled,
        chargesEnabled: org.paystack_subaccount_charges_enabled,
        onboardedAt: org.paystack_subaccount_onboarded_at,
        field: 'paystack_subaccount',
      };
    } else {
      return {
        id: org.flutterwave_subaccount_id,
        status: org.flutterwave_subaccount_status || 'not_started',
        enabled: org.flutterwave_subaccount_enabled,
        payoutsEnabled: org.flutterwave_subaccount_payouts_enabled,
        chargesEnabled: org.flutterwave_subaccount_charges_enabled,
        onboardedAt: org.flutterwave_subaccount_onboarded_at,
        field: 'flutterwave_subaccount',
      };
    }
  };

  const exportData = () => {
    const headers = [
      'Business Name',
      'Email',
      'Country',
      'Stripe Status',
      'Stripe ID',
      'Paystack Status',
      'Paystack ID',
      'Flutterwave Status',
      'Flutterwave ID',
    ];

    const rows = filteredOrganizers.map(org => [
      org.business_name,
      org.business_email,
      org.country_code,
      org.stripe_connect_status || 'not_started',
      org.stripe_connect_id || '',
      org.paystack_subaccount_status || 'not_started',
      org.paystack_subaccount_id || '',
      org.flutterwave_subaccount_status || 'not_started',
      org.flutterwave_subaccount_id || '',
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payment-connections-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Payment Connections</h1>
          <p className="text-muted-foreground">Manage organizer payment provider connections</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportData}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="outline" onClick={loadOrganizers}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <Tabs defaultValue="connections" className="space-y-4">
        <TabsList>
          <TabsTrigger value="connections">Connection Stats</TabsTrigger>
          <TabsTrigger value="revenue">Revenue by Provider</TabsTrigger>
        </TabsList>

        <TabsContent value="connections">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="border-border/10">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Connected</p>
                    <p className="text-2xl font-bold text-foreground">{stats.totalConnected}</p>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/10">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Stripe Connect</p>
                    <p className="text-2xl font-bold text-purple-600">{stats.stripeConnected}</p>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/10">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Paystack</p>
                    <p className="text-2xl font-bold text-blue-600">{stats.paystackConnected}</p>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/10">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Flutterwave</p>
                    <p className="text-2xl font-bold text-orange-600">{stats.flutterwaveConnected}</p>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                    <Globe className="w-5 h-5 text-orange-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="revenue">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Card className="border-border/10 md:col-span-1">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Revenue</p>
                    {loadingRevenue ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                      <RevenueByCurrency revenueByCurrency={revenueStats.totalRevenue} className="text-xl font-bold text-foreground" />
                    )}
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/10">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Stripe Revenue</p>
                    {loadingRevenue ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                      <RevenueByCurrency revenueByCurrency={revenueStats.stripeRevenue} className="text-xl font-bold text-purple-600" />
                    )}
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/10">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Paystack Revenue</p>
                    {loadingRevenue ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                      <RevenueByCurrency revenueByCurrency={revenueStats.paystackRevenue} className="text-xl font-bold text-blue-600" />
                    )}
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/10">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Flutterwave Revenue</p>
                    {loadingRevenue ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                      <RevenueByCurrency revenueByCurrency={revenueStats.flutterwaveRevenue} className="text-xl font-bold text-orange-600" />
                    )}
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                    <Globe className="w-5 h-5 text-orange-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/10">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Standard/Other</p>
                    {loadingRevenue ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                      <RevenueByCurrency revenueByCurrency={revenueStats.standardRevenue} className="text-xl font-bold text-muted-foreground" />
                    )}
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                    <Building className="w-5 h-5 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Filters */}
      <Card className="border-border/10">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search organizers..."
                  className="pl-10"
                />
              </div>
            </div>

            <Select value={providerFilter} onValueChange={setProviderFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Providers</SelectItem>
                <SelectItem value="any_connected">Any Connected</SelectItem>
                <SelectItem value="none">No Connections</SelectItem>
                <SelectItem value="stripe">Stripe Connect</SelectItem>
                <SelectItem value="paystack">Paystack</SelectItem>
                <SelectItem value="flutterwave">Flutterwave</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="restricted">Restricted</SelectItem>
                <SelectItem value="disabled">Disabled</SelectItem>
              </SelectContent>
            </Select>

            <Select value={countryFilter} onValueChange={setCountryFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Country" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Countries</SelectItem>
                <SelectItem value="NG">🇳🇬 Nigeria</SelectItem>
                <SelectItem value="GH">🇬🇭 Ghana</SelectItem>
                <SelectItem value="KE">🇰🇪 Kenya</SelectItem>
                <SelectItem value="ZA">🇿🇦 South Africa</SelectItem>
                <SelectItem value="US">🇺🇸 United States</SelectItem>
                <SelectItem value="GB">🇬🇧 United Kingdom</SelectItem>
                <SelectItem value="CA">🇨🇦 Canada</SelectItem>
                <SelectItem value="AU">🇦🇺 Australia</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Organizers Table */}
      <Card className="border-border/10">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted border-b border-border/10">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    Organizer
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    Country
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">
                    <span className="flex items-center justify-center gap-1">
                      <CreditCard className="w-3 h-3 text-purple-600" />
                      Stripe
                    </span>
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">
                    <span className="flex items-center justify-center gap-1">
                      <Zap className="w-3 h-3 text-blue-600" />
                      Paystack
                    </span>
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">
                    <span className="flex items-center justify-center gap-1">
                      <Globe className="w-3 h-3 text-orange-600" />
                      Flutterwave
                    </span>
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#0F0F0F]/5">
                {paginatedOrganizers.map((org) => {
                  const stripe = getProviderStatus(org, 'stripe');
                  const paystack = getProviderStatus(org, 'paystack');
                  const flutterwave = getProviderStatus(org, 'flutterwave');

                  return (
                    <tr key={org.id} className="hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-foreground">{org.business_name}</p>
                          <p className="text-sm text-muted-foreground">{org.business_email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-lg">{COUNTRY_FLAGS[org.country_code] || '🌍'}</span>
                        <span className="ml-1 text-sm text-muted-foreground">{org.country_code}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <StatusBadge status={stripe.status} />
                          {stripe.status === 'active' && (
                            <button
                              onClick={() => toggleProviderEnabled(org.id, 'stripe_connect', stripe.enabled)}
                              className="text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground"
                              disabled={processing}
                            >
                              {stripe.enabled ? (
                                <ToggleRight className="w-4 h-4 text-green-600" />
                              ) : (
                                <ToggleLeft className="w-4 h-4 text-muted-foreground" />
                              )}
                              {stripe.enabled ? 'Enabled' : 'Disabled'}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <StatusBadge status={paystack.status} />
                          {paystack.status === 'active' && (
                            <button
                              onClick={() => toggleProviderEnabled(org.id, 'paystack_subaccount', paystack.enabled)}
                              className="text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground"
                              disabled={processing}
                            >
                              {paystack.enabled ? (
                                <ToggleRight className="w-4 h-4 text-green-600" />
                              ) : (
                                <ToggleLeft className="w-4 h-4 text-muted-foreground" />
                              )}
                              {paystack.enabled ? 'Enabled' : 'Disabled'}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <StatusBadge status={flutterwave.status} />
                          {flutterwave.status === 'active' && (
                            <button
                              onClick={() => toggleProviderEnabled(org.id, 'flutterwave_subaccount', flutterwave.enabled)}
                              className="text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground"
                              disabled={processing}
                            >
                              {flutterwave.enabled ? (
                                <ToggleRight className="w-4 h-4 text-green-600" />
                              ) : (
                                <ToggleLeft className="w-4 h-4 text-muted-foreground" />
                              )}
                              {flutterwave.enabled ? 'Enabled' : 'Disabled'}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <Eye className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => {
                              setSelectedOrganizer(org);
                              setDetailsDialogOpen(true);
                            }}>
                              <Eye className="w-4 h-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {stripe.status === 'active' && (
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => openDisconnectDialog(org, 'stripe_connect')}
                              >
                                <Unlink className="w-4 h-4 mr-2" />
                                Disconnect Stripe
                              </DropdownMenuItem>
                            )}
                            {paystack.status === 'active' && (
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => openDisconnectDialog(org, 'paystack_subaccount')}
                              >
                                <Unlink className="w-4 h-4 mr-2" />
                                Disconnect Paystack
                              </DropdownMenuItem>
                            )}
                            {flutterwave.status === 'active' && (
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => openDisconnectDialog(org, 'flutterwave_subaccount')}
                              >
                                <Unlink className="w-4 h-4 mr-2" />
                                Disconnect Flutterwave
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredOrganizers.length === 0 && (
            <div className="text-center py-12">
              <Building className="w-12 h-12 text-foreground/20 mx-auto mb-4" />
              <p className="text-muted-foreground">No organizers found matching your filters</p>
            </div>
          )}

          {filteredOrganizers.length > pageSize && (
            <div className="p-4 border-t border-border/10">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredOrganizers.length}
                itemsPerPage={pageSize}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Payment Connection Details</DialogTitle>
            <DialogDescription>
              {selectedOrganizer?.business_name}
            </DialogDescription>
          </DialogHeader>

          {selectedOrganizer && (
            <Tabs defaultValue="stripe" className="mt-4">
              <TabsList className="w-full">
                <TabsTrigger value="stripe" className="flex-1">
                  <CreditCard className="w-4 h-4 mr-1" />
                  Stripe
                </TabsTrigger>
                <TabsTrigger value="paystack" className="flex-1">
                  <Zap className="w-4 h-4 mr-1" />
                  Paystack
                </TabsTrigger>
                <TabsTrigger value="flutterwave" className="flex-1">
                  <Globe className="w-4 h-4 mr-1" />
                  Flutterwave
                </TabsTrigger>
              </TabsList>

              {['stripe', 'paystack', 'flutterwave'].map((provider) => {
                const data = getProviderStatus(selectedOrganizer, provider);
                return (
                  <TabsContent key={provider} value={provider} className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-xs text-muted-foreground">Status</p>
                        <StatusBadge status={data.status} />
                      </div>
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-xs text-muted-foreground">Admin Enabled</p>
                        <p className="font-medium">{data.enabled ? 'Yes' : 'No'}</p>
                      </div>
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-xs text-muted-foreground">Payouts</p>
                        <p className="font-medium">{data.payoutsEnabled ? 'Enabled' : 'Disabled'}</p>
                      </div>
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-xs text-muted-foreground">Charges</p>
                        <p className="font-medium">{data.chargesEnabled ? 'Enabled' : 'Disabled'}</p>
                      </div>
                    </div>

                    {data.id && (
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-xs text-muted-foreground">Account ID</p>
                        <p className="font-mono text-sm break-all">{data.id}</p>
                      </div>
                    )}

                    {data.onboardedAt && (
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-xs text-muted-foreground">Connected On</p>
                        <p className="font-medium">
                          {new Date(data.onboardedAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </p>
                      </div>
                    )}
                  </TabsContent>
                );
              })}
            </Tabs>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disconnect Confirmation Dialog */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">Disconnect Payment Provider</DialogTitle>
            <DialogDescription>
              Are you sure you want to disconnect {actionType?.replace('_', ' ')} for {selectedOrganizer?.business_name}?
              This will remove the connection and the organizer will need to reconnect.
            </DialogDescription>
          </DialogHeader>

          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
            <strong>Warning:</strong> This action cannot be undone. The organizer's subaccount 
            will be disconnected and they will no longer receive direct payments until they reconnect.
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={disconnectProvider}
              disabled={processing}
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Disconnecting...
                </>
              ) : (
                <>
                  <Unlink className="w-4 h-4 mr-2" />
                  Disconnect
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
