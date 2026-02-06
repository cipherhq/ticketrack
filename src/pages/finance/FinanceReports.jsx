import { useState, useEffect, useRef } from 'react';
import { 
  FileText, Download, Calendar, Building2, Globe, Loader2,
  FileSpreadsheet, Users, TrendingUp, CheckCircle, AlertCircle,
  ChevronDown, Filter, RefreshCw, Search, X
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { formatPrice, getDefaultCurrency } from '@/config/currencies';
import { useFinance } from '@/contexts/FinanceContext';
import { brand } from '@/config/brand';

// Country configurations for tax/compliance
const COUNTRY_CONFIG = {
  US: {
    name: 'United States',
    currency: 'USD',
    taxDocument: '1099-K Style',
    fiscalYear: 'Jan - Dec',
    taxId: 'EIN/SSN',
    threshold: 600,
    notes: 'Gross receipts reported to IRS'
  },
  GB: {
    name: 'United Kingdom',
    currency: 'GBP',
    taxDocument: 'Earnings Statement',
    fiscalYear: 'Apr - Mar',
    taxId: 'UTR/VAT',
    threshold: 0,
    notes: 'VAT at 20% if VAT registered'
  },
  CA: {
    name: 'Canada',
    currency: 'CAD',
    taxDocument: 'Earnings Statement',
    fiscalYear: 'Jan - Dec',
    taxId: 'SIN/BN',
    threshold: 0,
    notes: 'GST/HST if registered'
  },
  NG: {
    name: 'Nigeria',
    currency: 'NGN',
    taxDocument: 'Earnings Statement',
    fiscalYear: 'Jan - Dec',
    taxId: 'TIN',
    threshold: 0,
    notes: 'VAT at 7.5% on platform fees'
  },
  GH: {
    name: 'Ghana',
    currency: 'GHS',
    taxDocument: 'Earnings Statement',
    fiscalYear: 'Jan - Dec',
    taxId: 'TIN',
    threshold: 0,
    notes: 'VAT at 15% on platform fees'
  }
};

// Searchable Organizer Dropdown Component
function OrganizerSearchDropdown({ organizers, selectedOrganizer, onSelect }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  // Find the selected organizer's name for display
  const selectedOrganizerData = organizers.find(org => org.id === selectedOrganizer);

  // Filter organizers based on search term (searches business name and email)
  const filteredOrganizers = organizers.filter(org => {
    const search = searchTerm.toLowerCase();
    return (
      org.business_name?.toLowerCase().includes(search) ||
      org.email?.toLowerCase().includes(search)
    );
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelect = (organizerId) => {
    onSelect(organizerId);
    setIsOpen(false);
    setSearchTerm('');
  };

  const clearSelection = (e) => {
    e.stopPropagation();
    onSelect('');
    setSearchTerm('');
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full h-10 px-3 py-2 text-sm bg-white border border-[#0F0F0F]/10 rounded-xl hover:border-[#2969FF]/50 focus:outline-none focus:ring-2 focus:ring-[#2969FF] focus:ring-offset-2 transition-colors"
      >
        <div className="flex items-center gap-2 truncate">
          <Building2 className="w-4 h-4 text-[#0F0F0F]/40 flex-shrink-0" />
          {selectedOrganizerData ? (
            <span className="truncate text-[#0F0F0F]">{selectedOrganizerData.business_name}</span>
          ) : (
            <span className="text-[#0F0F0F]/40">Select organizer</span>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {selectedOrganizer && (
            <button
              onClick={clearSelection}
              className="p-1 hover:bg-[#F4F6FA] rounded-full"
              title="Clear selection"
            >
              <X className="w-3 h-3 text-[#0F0F0F]/40" />
            </button>
          )}
          <ChevronDown className={`w-4 h-4 text-[#0F0F0F]/40 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-[#0F0F0F]/10 rounded-xl shadow-lg overflow-hidden">
          {/* Search Input */}
          <div className="p-2 border-b border-[#0F0F0F]/10">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0F0F0F]/40" />
              <Input
                ref={inputRef}
                type="text"
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
          </div>

          {/* Organizer List */}
          <div className="max-h-60 overflow-y-auto">
            {filteredOrganizers.length === 0 ? (
              <div className="p-4 text-center text-sm text-[#0F0F0F]/60">
                No organizers found
              </div>
            ) : (
              filteredOrganizers.map((org) => (
                <button
                  key={org.id}
                  type="button"
                  onClick={() => handleSelect(org.id)}
                  className={`w-full px-3 py-2 text-left hover:bg-[#F4F6FA] transition-colors ${
                    selectedOrganizer === org.id ? 'bg-[#2969FF]/10' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className={`text-sm font-medium truncate ${
                        selectedOrganizer === org.id ? 'text-[#2969FF]' : 'text-[#0F0F0F]'
                      }`}>
                        {org.business_name}
                      </p>
                      <p className="text-xs text-[#0F0F0F]/60 truncate">{org.email}</p>
                    </div>
                    {org.country_code && (
                      <Badge variant="outline" className="ml-2 text-xs flex-shrink-0">
                        {org.country_code}
                      </Badge>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Footer showing count */}
          <div className="p-2 border-t border-[#0F0F0F]/10 bg-[#F4F6FA]">
            <p className="text-xs text-[#0F0F0F]/60 text-center">
              {filteredOrganizers.length} of {organizers.length} organizers
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export function FinanceReports() {
  const { logFinanceAction } = useFinance();
  const [activeTab, setActiveTab] = useState('organizer');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  
  // Filters
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedCountry, setSelectedCountry] = useState('all');
  const [selectedOrganizer, setSelectedOrganizer] = useState('');
  
  // Data
  const [organizers, setOrganizers] = useState([]);
  const [reportPreview, setReportPreview] = useState(null);
  const [previewDialog, setPreviewDialog] = useState(false);

  const years = [];
  const currentYear = new Date().getFullYear();
  for (let y = currentYear; y >= currentYear - 5; y--) {
    years.push(y.toString());
  }

  useEffect(() => {
    loadOrganizers();
    logFinanceAction('view_finance_reports');
  }, []);

  const loadOrganizers = async () => {
    const { data } = await supabase.from('organizers')
      .select('id, business_name, email, country_code')
      .order('business_name');
    setOrganizers(data || []);
  };

  // Generate Annual Earnings Report for an organizer
  const generateOrganizerReport = async (organizerId, year, format = 'preview') => {
    setGenerating(true);
    try {
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;

      // Get organizer details
      const { data: organizer } = await supabase.from('organizers')
        .select('*, bank_accounts(*)')
        .eq('id', organizerId)
        .single();

      if (!organizer) throw new Error('Organizer not found');

      // Get all events for this organizer in the year
      const { data: events } = await supabase.from('events')
        .select(`
          id, title, start_date, end_date, currency, payout_status, country_code,
          orders (id, total_amount, platform_fee, status, created_at)
        `)
        .eq('organizer_id', organizerId)
        .gte('start_date', startDate)
        .lte('start_date', endDate + 'T23:59:59')
        .order('start_date');

      // Get all payouts for this organizer in the year
      const { data: payouts } = await supabase.from('payouts')
        .select('*')
        .eq('organizer_id', organizerId)
        .gte('created_at', startDate)
        .lte('created_at', endDate + 'T23:59:59')
        .order('created_at');

      // Get all advance payments
      const { data: advances } = await supabase.from('advance_payments')
        .select('*')
        .eq('organizer_id', organizerId)
        .eq('recipient_type', 'organizer')
        .gte('created_at', startDate)
        .lte('created_at', endDate + 'T23:59:59');

      // Calculate totals
      let totalGrossSales = 0;
      let totalPlatformFees = 0;
      let totalTransactions = 0;
      const eventBreakdown = [];

      events?.forEach(event => {
        const completedOrders = event.orders?.filter(o => o.status === 'completed') || [];
        const eventGross = completedOrders.reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0);
        const eventFees = completedOrders.reduce((sum, o) => sum + parseFloat(o.platform_fee || 0), 0);
        const eventNet = eventGross - eventFees;

        if (eventGross > 0) {
          totalGrossSales += eventGross;
          totalPlatformFees += eventFees;
          totalTransactions += completedOrders.length;

          eventBreakdown.push({
            id: event.id,
            title: event.title,
            date: event.start_date,
            currency: event.currency,
            grossSales: eventGross,
            platformFees: eventFees,
            netEarnings: eventNet,
            transactionCount: completedOrders.length,
            payoutStatus: event.payout_status
          });
        }
      });

      const totalNetEarnings = totalGrossSales - totalPlatformFees;
      const totalPayouts = payouts?.reduce((sum, p) => sum + parseFloat(p.net_amount || 0), 0) || 0;
      const totalAdvances = advances?.reduce((sum, a) => sum + parseFloat(a.advance_amount || 0), 0) || 0;

      const countryCode = organizer.country_code || 'NG';
      const countryConfig = COUNTRY_CONFIG[countryCode] || COUNTRY_CONFIG.NG;

      const report = {
        type: 'annual_earnings',
        year,
        generatedAt: new Date().toISOString(),
        organizer: {
          id: organizer.id,
          businessName: organizer.business_name,
          email: organizer.email,
          phone: organizer.phone,
          countryCode,
          countryName: countryConfig.name,
          taxIdType: countryConfig.taxId
        },
        summary: {
          grossSales: totalGrossSales,
          platformFees: totalPlatformFees,
          netEarnings: totalNetEarnings,
          advancesReceived: totalAdvances,
          payoutsReceived: totalPayouts,
          balanceRemaining: totalNetEarnings - totalPayouts,
          transactionCount: totalTransactions,
          eventCount: eventBreakdown.length,
          currency: events?.[0]?.currency || getDefaultCurrency(events?.[0]?.country_code || events?.[0]?.country)
        },
        events: eventBreakdown,
        payouts: payouts?.map(p => ({
          date: p.processed_at || p.created_at,
          amount: p.net_amount,
          reference: p.reference,
          currency: p.currency
        })) || [],
        advances: advances?.map(a => ({
          date: a.paid_at || a.created_at,
          amount: a.advance_amount,
          reference: a.transaction_reference,
          currency: a.currency
        })) || [],
        countryConfig,
        platform: {
          name: brand.name,
          website: brand.urls.website,
          supportEmail: brand.emails.support
        }
      };

      if (format === 'preview') {
        setReportPreview(report);
        setPreviewDialog(true);
      } else if (format === 'pdf') {
        await downloadReportAsPDF(report);
      } else if (format === 'excel') {
        await downloadReportAsExcel(report);
      }

      await logFinanceAction('generate_organizer_report', 'organizer', organizerId, {
        year,
        format,
        grossSales: totalGrossSales
      });

    } catch (error) {
      console.error('Error generating report:', error);
      alert('Failed to generate report: ' + error.message);
    } finally {
      setGenerating(false);
    }
  };

  // Generate Platform Revenue Report
  const generatePlatformReport = async (year, countryFilter = 'all', format = 'preview') => {
    setGenerating(true);
    try {
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;

      // Get all completed orders for the year
      const { data: orders } = await supabase.from('orders')
        .select(`
          id, total_amount, platform_fee, currency, status, created_at,
          events (id, title, country_code, organizer_id, organizers (business_name))
        `)
        .eq('status', 'completed')
        .gte('created_at', startDate)
        .lte('created_at', endDate + 'T23:59:59');

      // Filter by country if specified
      let filteredOrders = orders || [];
      if (countryFilter !== 'all') {
        filteredOrders = filteredOrders.filter(o => o.events?.country_code === countryFilter);
      }

      // Group by country
      const byCountry = {};
      filteredOrders.forEach(order => {
        const country = order.events?.country_code || 'NG';
        if (!byCountry[country]) {
          byCountry[country] = {
            grossSales: 0,
            platformFees: 0,
            transactionCount: 0,
            currency: order.currency
          };
        }
        byCountry[country].grossSales += parseFloat(order.total_amount || 0);
        byCountry[country].platformFees += parseFloat(order.platform_fee || 0);
        byCountry[country].transactionCount += 1;
      });

      // Group by month
      const byMonth = {};
      filteredOrders.forEach(order => {
        const month = order.created_at?.substring(0, 7);
        if (!byMonth[month]) {
          byMonth[month] = { grossSales: 0, platformFees: 0, transactionCount: 0 };
        }
        byMonth[month].grossSales += parseFloat(order.total_amount || 0);
        byMonth[month].platformFees += parseFloat(order.platform_fee || 0);
        byMonth[month].transactionCount += 1;
      });

      const totalGross = filteredOrders.reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0);
      const totalFees = filteredOrders.reduce((sum, o) => sum + parseFloat(o.platform_fee || 0), 0);

      const report = {
        type: 'platform_revenue',
        year,
        countryFilter,
        generatedAt: new Date().toISOString(),
        summary: {
          totalGrossSales: totalGross,
          totalPlatformRevenue: totalFees,
          totalTransactions: filteredOrders.length,
          averageFeeRate: totalGross > 0 ? ((totalFees / totalGross) * 100).toFixed(2) : 0
        },
        byCountry: Object.entries(byCountry).map(([code, data]) => ({
          countryCode: code,
          countryName: COUNTRY_CONFIG[code]?.name || code,
          ...data
        })),
        byMonth: Object.entries(byMonth)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([month, data]) => ({ month, ...data })),
        platform: {
          name: brand.name,
          website: brand.urls.website
        }
      };

      if (format === 'preview') {
        setReportPreview(report);
        setPreviewDialog(true);
      } else if (format === 'excel') {
        await downloadPlatformReportAsExcel(report);
      }

      await logFinanceAction('generate_platform_report', null, null, {
        year,
        countryFilter,
        format,
        totalRevenue: totalFees
      });

    } catch (error) {
      console.error('Error generating report:', error);
      alert('Failed to generate report: ' + error.message);
    } finally {
      setGenerating(false);
    }
  };

  const downloadReportAsExcel = async (report) => {
    const rows = [
      ['ANNUAL EARNINGS STATEMENT'],
      ['Year', report.year],
      ['Generated', new Date(report.generatedAt).toLocaleString()],
      [''],
      ['ORGANIZER DETAILS'],
      ['Business Name', report.organizer.businessName],
      ['Email', report.organizer.email],
      ['Country', report.organizer.countryName],
      [''],
      ['SUMMARY'],
      ['Gross Sales', report.summary.grossSales],
      ['Platform Fees', report.summary.platformFees],
      ['Net Earnings', report.summary.netEarnings],
      ['Advances Received', report.summary.advancesReceived],
      ['Total Payouts', report.summary.payoutsReceived],
      ['Balance Remaining', report.summary.balanceRemaining],
      ['Total Transactions', report.summary.transactionCount],
      ['Total Events', report.summary.eventCount],
      [''],
      ['EVENTS BREAKDOWN'],
      ['Event', 'Date', 'Gross Sales', 'Platform Fees', 'Net Earnings', 'Transactions', 'Payout Status'],
      ...report.events.map(e => [
        e.title,
        new Date(e.date).toLocaleDateString(),
        e.grossSales,
        e.platformFees,
        e.netEarnings,
        e.transactionCount,
        e.payoutStatus
      ]),
      [''],
      ['PAYOUTS'],
      ['Date', 'Amount', 'Reference'],
      ...report.payouts.map(p => [
        new Date(p.date).toLocaleDateString(),
        p.amount,
        p.reference || '-'
      ])
    ];

    const csvContent = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `earnings-statement-${report.organizer.businessName.replace(/\s+/g, '-')}-${report.year}.csv`;
    a.click();
  };

  const downloadPlatformReportAsExcel = async (report) => {
    const rows = [
      ['PLATFORM REVENUE REPORT'],
      ['Year', report.year],
      ['Country Filter', report.countryFilter === 'all' ? 'All Countries' : report.countryFilter],
      ['Generated', new Date(report.generatedAt).toLocaleString()],
      [''],
      ['SUMMARY'],
      ['Total Gross Sales', report.summary.totalGrossSales],
      ['Total Platform Revenue', report.summary.totalPlatformRevenue],
      ['Total Transactions', report.summary.totalTransactions],
      ['Average Fee Rate', report.summary.averageFeeRate + '%'],
      [''],
      ['BY COUNTRY'],
      ['Country', 'Gross Sales', 'Platform Revenue', 'Transactions'],
      ...report.byCountry.map(c => [c.countryName, c.grossSales, c.platformFees, c.transactionCount]),
      [''],
      ['BY MONTH'],
      ['Month', 'Gross Sales', 'Platform Revenue', 'Transactions'],
      ...report.byMonth.map(m => [m.month, m.grossSales, m.platformFees, m.transactionCount])
    ];

    const csvContent = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `platform-revenue-${report.year}-${report.countryFilter}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#0F0F0F]">Financial Reports</h1>
        <p className="text-[#0F0F0F]/60">Generate tax documents and earnings statements</p>
      </div>

      {/* Country Compliance Info */}
      <Card className="border-blue-200 bg-blue-50 rounded-2xl">
        <CardContent className="p-4">
          <h3 className="font-semibold text-blue-800 mb-3">📋 Country Tax Requirements</h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {Object.entries(COUNTRY_CONFIG).map(([code, config]) => (
              <div key={code} className="p-2 bg-white rounded-lg text-sm">
                <p className="font-medium text-[#0F0F0F]">{config.name}</p>
                <p className="text-xs text-[#0F0F0F]/60">{config.taxDocument}</p>
                <p className="text-xs text-[#0F0F0F]/40">{config.notes}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-[#F4F6FA] rounded-xl p-1">
          <TabsTrigger value="organizer" className="rounded-lg data-[state=active]:bg-white">
            <Building2 className="w-4 h-4 mr-2" />Organizer Reports
          </TabsTrigger>
          <TabsTrigger value="platform" className="rounded-lg data-[state=active]:bg-white">
            <TrendingUp className="w-4 h-4 mr-2" />Platform Reports
          </TabsTrigger>
        </TabsList>

        {/* Organizer Reports Tab */}
        <TabsContent value="organizer" className="mt-4 space-y-4">
          <Card className="border-[#0F0F0F]/10 rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#2969FF]" />
                Annual Earnings Statement
              </CardTitle>
              <CardDescription>
                Generate year-end tax document for an organizer. Available for completed years.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Tax Year</Label>
                  <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger className="rounded-xl">
                      <Calendar className="w-4 h-4 mr-2" />
                      <SelectValue placeholder="Select year" />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map(year => (
                        <SelectItem key={year} value={year}>{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Searchable Organizer Dropdown */}
                <div className="space-y-2">
                  <Label>Organizer</Label>
                  <OrganizerSearchDropdown
                    organizers={organizers}
                    selectedOrganizer={selectedOrganizer}
                    onSelect={setSelectedOrganizer}
                  />
                </div>

                <div className="space-y-2">
                  <Label>&nbsp;</Label>
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => generateOrganizerReport(selectedOrganizer, selectedYear, 'preview')}
                      disabled={!selectedOrganizer || generating}
                      variant="outline"
                      className="rounded-xl flex-1"
                    >
                      {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
                      Preview
                    </Button>
                    <Button 
                      onClick={() => generateOrganizerReport(selectedOrganizer, selectedYear, 'excel')}
                      disabled={!selectedOrganizer || generating}
                      className="bg-green-600 hover:bg-green-700 rounded-xl flex-1"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-xl">
                <p className="text-sm text-yellow-800">
                  📅 Annual earnings reports for {currentYear} will be available on December 31, {currentYear} at 11:59 PM.
                  Organizers can download their own reports from their dashboard.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Bulk Generate */}
          <Card className="border-[#0F0F0F]/10 rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-600" />
                Bulk Generate Reports
              </CardTitle>
              <CardDescription>
                Generate annual earnings statements for all organizers at once
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="w-40 rounded-xl">
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map(year => (
                      <SelectItem key={year} value={year}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                  <SelectTrigger className="w-48 rounded-xl">
                    <Globe className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Country" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Countries</SelectItem>
                    {Object.entries(COUNTRY_CONFIG).map(([code, config]) => (
                      <SelectItem key={code} value={code}>{config.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" className="rounded-xl">
                  <Download className="w-4 h-4 mr-2" />
                  Generate All ({organizers.filter(o => selectedCountry === 'all' || o.country_code === selectedCountry).length})
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Platform Reports Tab */}
        <TabsContent value="platform" className="mt-4 space-y-4">
          <Card className="border-[#0F0F0F]/10 rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                Platform Revenue Report
              </CardTitle>
              <CardDescription>
                Generate revenue summary by country and month
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Year</Label>
                  <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger className="rounded-xl">
                      <Calendar className="w-4 h-4 mr-2" />
                      <SelectValue placeholder="Select year" />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map(year => (
                        <SelectItem key={year} value={year}>{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Country</Label>
                  <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                    <SelectTrigger className="rounded-xl">
                      <Globe className="w-4 h-4 mr-2" />
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Countries</SelectItem>
                      {Object.entries(COUNTRY_CONFIG).map(([code, config]) => (
                        <SelectItem key={code} value={code}>{config.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>&nbsp;</Label>
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => generatePlatformReport(selectedYear, selectedCountry, 'preview')}
                      disabled={generating}
                      variant="outline"
                      className="rounded-xl flex-1"
                    >
                      {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
                      Preview
                    </Button>
                    <Button 
                      onClick={() => generatePlatformReport(selectedYear, selectedCountry, 'excel')}
                      disabled={generating}
                      className="bg-green-600 hover:bg-green-700 rounded-xl flex-1"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Reports */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-[#0F0F0F]/10 rounded-2xl hover:border-[#2969FF]/50 cursor-pointer transition-colors">
              <CardContent className="p-6 text-center">
                <FileSpreadsheet className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                <h3 className="font-semibold text-[#0F0F0F] mb-2">Transaction Report</h3>
                <p className="text-sm text-[#0F0F0F]/60 mb-4">All transactions with full details</p>
                <Button variant="outline" className="rounded-xl w-full">
                  <Download className="w-4 h-4 mr-2" />Generate
                </Button>
              </CardContent>
            </Card>

            <Card className="border-[#0F0F0F]/10 rounded-2xl hover:border-[#2969FF]/50 cursor-pointer transition-colors">
              <CardContent className="p-6 text-center">
                <Users className="w-12 h-12 text-purple-600 mx-auto mb-4" />
                <h3 className="font-semibold text-[#0F0F0F] mb-2">Payout Summary</h3>
                <p className="text-sm text-[#0F0F0F]/60 mb-4">All payouts to organizers & promoters</p>
                <Button variant="outline" className="rounded-xl w-full">
                  <Download className="w-4 h-4 mr-2" />Generate
                </Button>
              </CardContent>
            </Card>

            <Card className="border-[#0F0F0F]/10 rounded-2xl hover:border-[#2969FF]/50 cursor-pointer transition-colors">
              <CardContent className="p-6 text-center">
                <Globe className="w-12 h-12 text-green-600 mx-auto mb-4" />
                <h3 className="font-semibold text-[#0F0F0F] mb-2">Country Summary</h3>
                <p className="text-sm text-[#0F0F0F]/60 mb-4">Revenue breakdown by country</p>
                <Button variant="outline" className="rounded-xl w-full">
                  <Download className="w-4 h-4 mr-2" />Generate
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Preview Dialog */}
      <Dialog open={previewDialog} onOpenChange={setPreviewDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>
              {reportPreview?.type === 'annual_earnings' ? '📄 Annual Earnings Statement' : '📊 Platform Revenue Report'}
            </DialogTitle>
            <DialogDescription>
              Preview for {reportPreview?.year}
            </DialogDescription>
          </DialogHeader>

          {reportPreview?.type === 'annual_earnings' && (
            <div className="space-y-6 py-4">
              <div className="text-center border-b pb-4">
                <h2 className="text-2xl font-bold text-[#0F0F0F]">ANNUAL EARNINGS STATEMENT</h2>
                <p className="text-lg text-[#0F0F0F]/60">Tax Year {reportPreview.year}</p>
                <p className="text-sm text-[#0F0F0F]/40 mt-2">
                  Generated: {new Date(reportPreview.generatedAt).toLocaleString()}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 p-4 bg-[#F4F6FA] rounded-xl">
                <div>
                  <p className="text-sm text-[#0F0F0F]/60">Business Name</p>
                  <p className="font-semibold text-[#0F0F0F]">{reportPreview.organizer.businessName}</p>
                </div>
                <div>
                  <p className="text-sm text-[#0F0F0F]/60">Email</p>
                  <p className="font-medium text-[#0F0F0F]">{reportPreview.organizer.email}</p>
                </div>
                <div>
                  <p className="text-sm text-[#0F0F0F]/60">Country</p>
                  <p className="font-medium text-[#0F0F0F]">{reportPreview.organizer.countryName}</p>
                </div>
                <div>
                  <p className="text-sm text-[#0F0F0F]/60">Tax ID Type</p>
                  <p className="font-medium text-[#0F0F0F]">{reportPreview.organizer.taxIdType}</p>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-[#0F0F0F] mb-3">Summary</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 bg-blue-50 rounded-xl text-center">
                    <p className="text-2xl font-bold text-blue-600">
                      {formatPrice(reportPreview.summary.grossSales, reportPreview.summary.currency)}
                    </p>
                    <p className="text-xs text-[#0F0F0F]/60">Gross Sales</p>
                  </div>
                  <div className="p-3 bg-red-50 rounded-xl text-center">
                    <p className="text-2xl font-bold text-red-600">
                      {formatPrice(reportPreview.summary.platformFees, reportPreview.summary.currency)}
                    </p>
                    <p className="text-xs text-[#0F0F0F]/60">Platform Fees</p>
                  </div>
                  <div className="p-3 bg-green-50 rounded-xl text-center">
                    <p className="text-2xl font-bold text-green-600">
                      {formatPrice(reportPreview.summary.netEarnings, reportPreview.summary.currency)}
                    </p>
                    <p className="text-xs text-[#0F0F0F]/60">Net Earnings</p>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-xl text-center">
                    <p className="text-2xl font-bold text-purple-600">
                      {formatPrice(reportPreview.summary.payoutsReceived, reportPreview.summary.currency)}
                    </p>
                    <p className="text-xs text-[#0F0F0F]/60">Total Payouts</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 mt-3">
                  <div className="p-2 bg-[#F4F6FA] rounded-lg text-center">
                    <p className="font-bold text-[#0F0F0F]">{reportPreview.summary.eventCount}</p>
                    <p className="text-xs text-[#0F0F0F]/60">Events</p>
                  </div>
                  <div className="p-2 bg-[#F4F6FA] rounded-lg text-center">
                    <p className="font-bold text-[#0F0F0F]">{reportPreview.summary.transactionCount}</p>
                    <p className="text-xs text-[#0F0F0F]/60">Transactions</p>
                  </div>
                  <div className="p-2 bg-[#F4F6FA] rounded-lg text-center">
                    <p className="font-bold text-yellow-600">
                      {formatPrice(reportPreview.summary.advancesReceived, reportPreview.summary.currency)}
                    </p>
                    <p className="text-xs text-[#0F0F0F]/60">Advances</p>
                  </div>
                </div>
              </div>

              {reportPreview.events.length > 0 && (
                <div>
                  <h3 className="font-semibold text-[#0F0F0F] mb-3">Events Breakdown</h3>
                  <div className="border rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-[#F4F6FA]">
                        <tr>
                          <th className="text-left p-3">Event</th>
                          <th className="text-left p-3">Date</th>
                          <th className="text-right p-3">Gross</th>
                          <th className="text-right p-3">Fees</th>
                          <th className="text-right p-3">Net</th>
                          <th className="text-center p-3">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportPreview.events.map((event, idx) => (
                          <tr key={idx} className="border-t">
                            <td className="p-3 font-medium">{event.title}</td>
                            <td className="p-3 text-[#0F0F0F]/60">{new Date(event.date).toLocaleDateString()}</td>
                            <td className="p-3 text-right">{formatPrice(event.grossSales, event.currency)}</td>
                            <td className="p-3 text-right text-red-600">{formatPrice(event.platformFees, event.currency)}</td>
                            <td className="p-3 text-right font-medium text-green-600">{formatPrice(event.netEarnings, event.currency)}</td>
                            <td className="p-3 text-center">
                              {event.payoutStatus === 'paid' ? (
                                <Badge className="bg-green-100 text-green-800">Paid</Badge>
                              ) : (
                                <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <h4 className="font-medium text-blue-800 mb-2">📋 {reportPreview.countryConfig.name} Tax Notes</h4>
                <p className="text-sm text-blue-700">{reportPreview.countryConfig.notes}</p>
                <p className="text-sm text-blue-700 mt-1">
                  Tax ID Type: {reportPreview.countryConfig.taxId} • Fiscal Year: {reportPreview.countryConfig.fiscalYear}
                </p>
              </div>

              <div className="text-center text-sm text-[#0F0F0F]/40 border-t pt-4">
                <p>Generated by {reportPreview.platform.name}</p>
                <p>{reportPreview.platform.website} • {reportPreview.platform.supportEmail}</p>
              </div>
            </div>
          )}

          {reportPreview?.type === 'platform_revenue' && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-4 bg-blue-50 rounded-xl text-center">
                  <p className="text-2xl font-bold text-blue-600">
                    {formatPrice(reportPreview.summary.totalGrossSales, 'NGN')}
                  </p>
                  <p className="text-xs text-[#0F0F0F]/60">Total Gross Sales</p>
                </div>
                <div className="p-4 bg-green-50 rounded-xl text-center">
                  <p className="text-2xl font-bold text-green-600">
                    {formatPrice(reportPreview.summary.totalPlatformRevenue, 'NGN')}
                  </p>
                  <p className="text-xs text-[#0F0F0F]/60">Platform Revenue</p>
                </div>
                <div className="p-4 bg-purple-50 rounded-xl text-center">
                  <p className="text-2xl font-bold text-purple-600">
                    {reportPreview.summary.totalTransactions}
                  </p>
                  <p className="text-xs text-[#0F0F0F]/60">Transactions</p>
                </div>
                <div className="p-4 bg-yellow-50 rounded-xl text-center">
                  <p className="text-2xl font-bold text-yellow-600">
                    {reportPreview.summary.averageFeeRate}%
                  </p>
                  <p className="text-xs text-[#0F0F0F]/60">Avg Fee Rate</p>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-[#0F0F0F] mb-3">By Country</h3>
                <div className="space-y-2">
                  {reportPreview.byCountry.map((country, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-[#F4F6FA] rounded-xl">
                      <span className="font-medium">{country.countryName}</span>
                      <div className="flex items-center gap-4 text-sm">
                        <span>Sales: {formatPrice(country.grossSales, country.currency)}</span>
                        <span className="text-green-600">Revenue: {formatPrice(country.platformFees, country.currency)}</span>
                        <span className="text-[#0F0F0F]/60">{country.transactionCount} txns</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-[#0F0F0F] mb-3">By Month</h3>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                  {reportPreview.byMonth.map((month, idx) => (
                    <div key={idx} className="p-2 bg-[#F4F6FA] rounded-lg text-center text-sm">
                      <p className="font-medium text-[#0F0F0F]">{month.month}</p>
                      <p className="text-green-600">{formatPrice(month.platformFees, 'NGN')}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewDialog(false)} className="rounded-xl">
              Close
            </Button>
            <Button 
              onClick={() => {
                if (reportPreview?.type === 'annual_earnings') {
                  downloadReportAsExcel(reportPreview);
                } else {
                  downloadPlatformReportAsExcel(reportPreview);
                }
              }}
              className="bg-green-600 hover:bg-green-700 rounded-xl"
            >
              <Download className="w-4 h-4 mr-2" />
              Download CSV
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
