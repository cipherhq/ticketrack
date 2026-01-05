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
  LogIn,
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

export function AdminOrganizers() {
  const navigate = useNavigate();
  const { logAdminAction, admin } = useAdmin();
  const { startImpersonation } = useImpersonation();
  const [loading, setLoading] = useState(true);
  const [organizers, setOrganizers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all');
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

  useEffect(() => {
    loadOrganizers();
  }, []);

  const loadOrganizers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('organizers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const organizersWithStats = await Promise.all(
        (data || []).map(async (org) => {
          const { count: eventCount } = await supabase
            .from('events')
            .select('*', { count: 'exact', head: true })
            .eq('organizer_id', org.id);

          const { data: tickets } = await supabase
            .from('tickets')
            .select('total_price, quantity, events!inner(organizer_id)')
            .eq('events.organizer_id', org.id)
            .eq('payment_status', 'completed');

          const totalRevenue = tickets?.reduce((sum, t) => sum + (parseFloat(t.total_price) || 0), 0) || 0;
          const totalTickets = tickets?.reduce((sum, t) => sum + (t.quantity || 1), 0) || 0;

          return {
            ...org,
            eventCount: eventCount || 0,
            totalRevenue,
            totalTickets,
          };
        })
      );

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

  const openDetailsDialog = async (organizer) => {
    setSelectedOrganizer(organizer);
    setCustomFeeData({
      enabled: organizer.custom_fee_enabled || false,
      percentage: organizer.custom_service_fee_percentage || "",
      fixed: organizer.custom_service_fee_fixed || ""
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
    return <Badge className="bg-gray-100 text-gray-700">No KYC</Badge>;
  };

  const filteredOrganizers = organizers.filter((org) => {
    const matchesSearch =
      org.business_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      org.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      org.business_email?.toLowerCase().includes(searchQuery.toLowerCase());

    if (filter === 'all') return matchesSearch;
    if (filter === 'verified') return matchesSearch && (org.kyc_status === 'verified' || org.kyc_status === 'approved');
    if (filter === 'pending') return matchesSearch && (org.kyc_status === 'pending' || org.kyc_status === 'in_review');
    if (filter === 'suspended') return matchesSearch && org.is_active === false;
    if (filter === 'no-kyc') return matchesSearch && (!org.kyc_status || org.kyc_status === 'none');
    return matchesSearch;
  });

  const stats = {
    total: organizers.length,
    verified: organizers.filter(o => o.kyc_status === 'verified' || o.kyc_status === 'approved').length,
    pending: organizers.filter(o => o.kyc_status === 'pending' || o.kyc_status === 'in_review').length,
    suspended: organizers.filter(o => o.is_active === false).length,
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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-[#0F0F0F]">All Organizers</h2>
          <p className="text-[#0F0F0F]/60 mt-1">Manage all platform organizers</p>
        </div>
        <Button variant="outline" size="icon" onClick={loadOrganizers} className="rounded-xl">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Total</p>
                <p className="text-2xl font-semibold">{stats.total}</p>
              </div>
              <Building className="w-8 h-8 text-[#2969FF]/20" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Verified</p>
                <p className="text-2xl font-semibold text-green-600">{stats.verified}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-200" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Pending KYC</p>
                <p className="text-2xl font-semibold text-yellow-600">{stats.pending}</p>
              </div>
              <Shield className="w-8 h-8 text-yellow-200" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Suspended</p>
                <p className="text-2xl font-semibold text-red-600">{stats.suspended}</p>
              </div>
              <Ban className="w-8 h-8 text-red-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filter */}
      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#0F0F0F]/40" />
              <Input
                placeholder="Search organizers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white border-[#0F0F0F]/10 rounded-xl"
              />
            </div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-40 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="pending">Pending KYC</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="no-kyc">No KYC</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Organizers Table */}
      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardHeader>
          <CardTitle className="text-[#0F0F0F]">Organizers ({filteredOrganizers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#0F0F0F]/10">
                  <th className="text-left py-4 px-4 text-[#0F0F0F]/60 font-medium">Organizer</th>
                  <th className="text-left py-4 px-4 text-[#0F0F0F]/60 font-medium">Contact</th>
                  <th className="text-left py-4 px-4 text-[#0F0F0F]/60 font-medium">Events</th>
                  <th className="text-left py-4 px-4 text-[#0F0F0F]/60 font-medium">Revenue</th>
                  <th className="text-left py-4 px-4 text-[#0F0F0F]/60 font-medium">KYC</th>
                  <th className="text-left py-4 px-4 text-[#0F0F0F]/60 font-medium">Status</th>
                  <th className="text-right py-4 px-4 text-[#0F0F0F]/60 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrganizers.map((org) => (
                  <tr key={org.id} className="border-b border-[#0F0F0F]/5 hover:bg-[#F4F6FA]/50">
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
                          <p className="text-[#0F0F0F] font-medium">{org.business_name || 'Unnamed'}</p>
                          <p className="text-sm text-[#0F0F0F]/60">
                            Joined {new Date(org.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <p className="text-[#0F0F0F]/80 text-sm">{org.email || org.business_email || 'N/A'}</p>
                      <p className="text-[#0F0F0F]/60 text-sm">{org.phone || org.business_phone || 'N/A'}</p>
                    </td>
                    <td className="py-4 px-4">
                      <p className="text-[#0F0F0F]">{org.eventCount}</p>
                      <p className="text-sm text-[#0F0F0F]/60">{org.totalTickets} tickets</p>
                    </td>
                    <td className="py-4 px-4">
                      <p className="text-[#0F0F0F] font-medium">{formatCurrency(org.totalRevenue)}</p>
                    </td>
                    <td className="py-4 px-4">
                      {getKYCBadge(org.kyc_status, org.kyc_level)}
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
                            <MoreVertical className="w-5 h-5 text-[#0F0F0F]/60" />
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
                    <td colSpan={7} className="py-8 text-center text-[#0F0F0F]/60">
                      No organizers found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
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
                    <h3 className="text-2xl font-semibold text-[#0F0F0F]">{selectedOrganizer.business_name}</h3>
                    {selectedOrganizer.is_active !== false ? (
                      <Badge className="bg-green-100 text-green-700">Active</Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-700">Suspended</Badge>
                    )}
                    {getKYCBadge(selectedOrganizer.kyc_status, selectedOrganizer.kyc_level)}
                  </div>
                  <p className="text-[#0F0F0F]/60 mt-1">{selectedOrganizer.description || 'No description provided'}</p>
                </div>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-4 gap-4">
                <div className="p-4 bg-blue-50 rounded-xl text-center">
                  <Calendar className="w-6 h-6 text-[#2969FF] mx-auto mb-2" />
                  <p className="text-2xl font-semibold text-[#2969FF]">{selectedOrganizer.eventCount}</p>
                  <p className="text-sm text-[#0F0F0F]/60">Events</p>
                </div>
                <div className="p-4 bg-green-50 rounded-xl text-center">
                  <Ticket className="w-6 h-6 text-green-600 mx-auto mb-2" />
                  <p className="text-2xl font-semibold text-green-600">{selectedOrganizer.totalTickets}</p>
                  <p className="text-sm text-[#0F0F0F]/60">Tickets Sold</p>
                </div>
                <div className="p-4 bg-purple-50 rounded-xl text-center">
                  <TrendingUp className="w-6 h-6 text-purple-600 mx-auto mb-2" />
                  <p className="text-lg font-semibold text-purple-600">{formatCurrency(selectedOrganizer.totalRevenue)}</p>
                  <p className="text-sm text-[#0F0F0F]/60">Total Revenue</p>
                </div>
                <div className="p-4 bg-orange-50 rounded-xl text-center">
                  <DollarSign className="w-6 h-6 text-orange-600 mx-auto mb-2" />
                  <p className="text-lg font-semibold text-orange-600">{formatCurrency(selectedOrganizer.available_balance)}</p>
                  <p className="text-sm text-[#0F0F0F]/60">Balance</p>
                </div>
              </div>

              {loadingDetails ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-[#2969FF]" />
                </div>
              ) : (
                <Tabs defaultValue="info" className="w-full">
                  <TabsList className="bg-[#F4F6FA] rounded-xl">
                    <TabsTrigger value="info" className="rounded-lg">Contact Info</TabsTrigger>
                    <TabsTrigger value="events" className="rounded-lg">Events ({organizerEvents.length})</TabsTrigger>
                    <TabsTrigger value="payouts" className="rounded-lg">Payouts ({organizerPayouts.length})</TabsTrigger>
                    <TabsTrigger value="pricing" className="rounded-lg">Custom Pricing</TabsTrigger>
                  </TabsList>

                  <TabsContent value="info" className="mt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-[#F4F6FA] rounded-xl">
                        <div className="flex items-center gap-2 text-[#0F0F0F]/60 mb-1">
                          <Mail className="w-4 h-4" />
                          <span className="text-sm">Email</span>
                        </div>
                        <p className="text-[#0F0F0F]">{selectedOrganizer.email || selectedOrganizer.business_email || 'N/A'}</p>
                      </div>
                      <div className="p-4 bg-[#F4F6FA] rounded-xl">
                        <div className="flex items-center gap-2 text-[#0F0F0F]/60 mb-1">
                          <Phone className="w-4 h-4" />
                          <span className="text-sm">Phone</span>
                        </div>
                        <p className="text-[#0F0F0F]">{selectedOrganizer.phone || selectedOrganizer.business_phone || 'N/A'}</p>
                      </div>
                      <div className="p-4 bg-[#F4F6FA] rounded-xl">
                        <div className="flex items-center gap-2 text-[#0F0F0F]/60 mb-1">
                          <MapPin className="w-4 h-4" />
                          <span className="text-sm">Location</span>
                        </div>
                        <p className="text-[#0F0F0F]">{selectedOrganizer.location || 'N/A'}</p>
                      </div>
                      <div className="p-4 bg-[#F4F6FA] rounded-xl">
                        <div className="flex items-center gap-2 text-[#0F0F0F]/60 mb-1">
                          <Globe className="w-4 h-4" />
                          <span className="text-sm">Website</span>
                        </div>
                        <p className="text-[#0F0F0F]">{selectedOrganizer.website || selectedOrganizer.website_url || 'N/A'}</p>
                      </div>
                      <div className="p-4 bg-[#F4F6FA] rounded-xl">
                        <div className="flex items-center gap-2 text-[#0F0F0F]/60 mb-1">
                          <Calendar className="w-4 h-4" />
                          <span className="text-sm">Joined</span>
                        </div>
                        <p className="text-[#0F0F0F]">{new Date(selectedOrganizer.created_at).toLocaleDateString()}</p>
                      </div>
                      <div className="p-4 bg-[#F4F6FA] rounded-xl">
                        <div className="flex items-center gap-2 text-[#0F0F0F]/60 mb-1">
                          <Shield className="w-4 h-4" />
                          <span className="text-sm">KYC Status</span>
                        </div>
                        {getKYCBadge(selectedOrganizer.kyc_status, selectedOrganizer.kyc_level)}
                      </div>
                    </div>

                    {/* Social Links */}
                    <div className="mt-4 p-4 bg-[#F4F6FA] rounded-xl">
                      <p className="text-sm text-[#0F0F0F]/60 mb-3">Social Media</p>
                      <div className="flex gap-3">
                        {(selectedOrganizer.instagram || selectedOrganizer.social_instagram) && (
                          <a href={selectedOrganizer.instagram || selectedOrganizer.social_instagram} target="_blank" rel="noopener noreferrer" className="p-2 bg-white rounded-lg hover:bg-pink-50">
                            <Instagram className="w-5 h-5 text-pink-600" />
                          </a>
                        )}
                        {(selectedOrganizer.twitter || selectedOrganizer.social_twitter) && (
                          <a href={selectedOrganizer.twitter || selectedOrganizer.social_twitter} target="_blank" rel="noopener noreferrer" className="p-2 bg-white rounded-lg hover:bg-blue-50">
                            <Twitter className="w-5 h-5 text-blue-400" />
                          </a>
                        )}
                        {(selectedOrganizer.facebook || selectedOrganizer.social_facebook) && (
                          <a href={selectedOrganizer.facebook || selectedOrganizer.social_facebook} target="_blank" rel="noopener noreferrer" className="p-2 bg-white rounded-lg hover:bg-blue-50">
                            <Facebook className="w-5 h-5 text-blue-600" />
                          </a>
                        )}
                        {(selectedOrganizer.linkedin || selectedOrganizer.social_linkedin) && (
                          <a href={selectedOrganizer.linkedin || selectedOrganizer.social_linkedin} target="_blank" rel="noopener noreferrer" className="p-2 bg-white rounded-lg hover:bg-blue-50">
                            <Linkedin className="w-5 h-5 text-blue-700" />
                          </a>
                        )}
                        {!selectedOrganizer.instagram && !selectedOrganizer.social_instagram && 
                         !selectedOrganizer.twitter && !selectedOrganizer.social_twitter &&
                         !selectedOrganizer.facebook && !selectedOrganizer.social_facebook &&
                         !selectedOrganizer.linkedin && !selectedOrganizer.social_linkedin && (
                          <p className="text-[#0F0F0F]/60 text-sm">No social links added</p>
                        )}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="events" className="mt-4">
                    {organizerEvents.length === 0 ? (
                      <p className="text-center text-[#0F0F0F]/60 py-8">No events yet</p>
                    ) : (
                      <div className="space-y-2">
                        {organizerEvents.map((event) => (
                          <div key={event.id} className="flex items-center justify-between p-3 bg-[#F4F6FA] rounded-xl">
                            <div>
                              <p className="text-[#0F0F0F] font-medium">{event.title}</p>
                              <p className="text-sm text-[#0F0F0F]/60">
                                {new Date(event.start_date).toLocaleDateString()} • {formatCurrency(event.ticket_price)}
                              </p>
                            </div>
                            <Badge className={event.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>
                              {event.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="payouts" className="mt-4">
                    {organizerPayouts.length === 0 ? (
                      <p className="text-center text-[#0F0F0F]/60 py-8">No payouts yet</p>
                    ) : (
                      <div className="space-y-2">
                        {organizerPayouts.map((payout) => (
                          <div key={payout.id} className="flex items-center justify-between p-3 bg-[#F4F6FA] rounded-xl">
                            <div>
                              <p className="text-[#0F0F0F] font-medium">{formatCurrency(payout.net_amount)}</p>
                              <p className="text-sm text-[#0F0F0F]/60">
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
                </Tabs>
              )}

              {/* Quick Actions */}
              <div className="flex gap-3 pt-4 border-t border-[#0F0F0F]/10">
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
          <p className="text-[#0F0F0F]/60">
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
