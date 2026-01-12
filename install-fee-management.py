#!/usr/bin/env python3
"""
Ticketrack Fee Management System Installation
Run from ticketrack directory: python3 install-fee-management.py
"""

import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# fees.js content
fees_js = '''import { supabase } from '@/lib/supabase';

// Cache fees to avoid repeated DB calls
let feesCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Get all country fees (cached)
export const getCountryFees = async () => {
  const now = Date.now();
  
  if (feesCache && cacheTimestamp && (now - cacheTimestamp < CACHE_DURATION)) {
    return feesCache;
  }

  const { data, error } = await supabase
    .from('countries')
    .select(`
      code, default_currency, 
      service_fee_percentage, service_fee_fixed_per_ticket, service_fee_cap,
      processing_fee_fixed_per_order,
      stripe_processing_fee_pct, stripe_processing_fee_fixed,
      paystack_processing_fee_pct, paystack_processing_fee_fixed,
      payout_fee, min_payout_amount
    `)
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching country fees:', error);
    return getDefaultFees();
  }

  // Build lookup by currency
  const feesByCurrency = {};
  data?.forEach(country => {
    if (country.default_currency) {
      feesByCurrency[country.default_currency] = {
        countryCode: country.code,
        // Service fees (Ticketrack revenue)
        serviceFeePercent: parseFloat(country.service_fee_percentage || 5) / 100,
        serviceFeeFixedPerTicket: parseFloat(country.service_fee_fixed_per_ticket || 0),
        serviceFeeCap: country.service_fee_cap ? parseFloat(country.service_fee_cap) : null,
        // Processing fees (pass-through)
        processingFeeFixedPerOrder: parseFloat(country.processing_fee_fixed_per_order || 0),
        stripeProcessingPercent: parseFloat(country.stripe_processing_fee_pct || 2.9) / 100,
        stripeProcessingFixed: parseFloat(country.stripe_processing_fee_fixed || 0.30),
        paystackProcessingPercent: parseFloat(country.paystack_processing_fee_pct || 1.5) / 100,
        paystackProcessingFixed: parseFloat(country.paystack_processing_fee_fixed || 100),
        // Payout settings
        payoutFee: parseFloat(country.payout_fee || 0),
        minPayout: parseFloat(country.min_payout_amount || 0)
      };
    }
  });

  feesCache = feesByCurrency;
  cacheTimestamp = now;
  
  return feesByCurrency;
};

// Get fees for specific currency
export const getFeesByCurrency = async (currencyCode = 'NGN') => {
  const allFees = await getCountryFees();
  return allFees[currencyCode] || getDefaultFees().NGN;
};

// Default fees fallback
export const getDefaultFees = () => ({
  NGN: {
    countryCode: 'NG',
    serviceFeePercent: 0.05,
    serviceFeeFixedPerTicket: 200,
    serviceFeeCap: null,
    processingFeeFixedPerOrder: 100,
    stripeProcessingPercent: 0.029,
    stripeProcessingFixed: 0.30,
    paystackProcessingPercent: 0.015,
    paystackProcessingFixed: 100,
    payoutFee: 50,
    minPayout: 5000
  }
});

// Synchronous default for initial render (before async fetch)
export const DEFAULT_FEES = {
  serviceFeePercent: 0.05,
  serviceFeeFixedPerTicket: 0,
  serviceFeeCap: null,
  processingFeeFixedPerOrder: 0,
  stripeProcessingPercent: 0.029,
  stripeProcessingFixed: 0.30,
  paystackProcessingPercent: 0.015,
  paystackProcessingFixed: 100
};

// Clear cache (call when admin updates fees)
export const clearFeesCache = () => {
  feesCache = null;
  cacheTimestamp = null;
};

// Get fees for a specific organizer (checks custom fees first, then falls back to country)
export const getOrganizerFees = async (organizerId, currencyCode = 'NGN') => {
  // Get country defaults first
  const countryFees = await getFeesByCurrency(currencyCode);
  
  if (!organizerId) {
    return countryFees;
  }

  try {
    // Check if organizer has custom fees
    const { data: organizer, error } = await supabase
      .from('organizers')
      .select('custom_fee_enabled, custom_service_fee_percentage, custom_service_fee_fixed, custom_service_fee_cap')
      .eq('id', organizerId)
      .single();

    if (error || !organizer || !organizer.custom_fee_enabled) {
      return countryFees;
    }

    // Return custom fees, falling back to country defaults for unset values
    return {
      ...countryFees,
      serviceFeePercent: organizer.custom_service_fee_percentage != null 
        ? parseFloat(organizer.custom_service_fee_percentage) / 100 
        : countryFees.serviceFeePercent,
      serviceFeeFixedPerTicket: organizer.custom_service_fee_fixed != null
        ? parseFloat(organizer.custom_service_fee_fixed)
        : countryFees.serviceFeeFixedPerTicket,
      serviceFeeCap: organizer.custom_service_fee_cap != null
        ? parseFloat(organizer.custom_service_fee_cap)
        : countryFees.serviceFeeCap,
      isCustom: true
    };
  } catch (err) {
    console.error('Error fetching organizer fees:', err);
    return countryFees;
  }
};

/**
 * Calculate total fees for an order
 * @param {number} ticketSubtotal - Total ticket price (before fees)
 * @param {number} ticketCount - Number of tickets
 * @param {object} fees - Fee config from getOrganizerFees
 * @param {string} paymentProvider - 'stripe' or 'paystack'
 * @returns {object} { serviceFee, processingFee, totalFee, displayFee }
 */
export const calculateFees = (ticketSubtotal, ticketCount, fees, paymentProvider = 'paystack') => {
  // 1. Calculate service fee (% of subtotal + fixed per ticket)
  let serviceFee = (ticketSubtotal * fees.serviceFeePercent) + (fees.serviceFeeFixedPerTicket * ticketCount);
  
  // 2. Apply cap if exists
  if (fees.serviceFeeCap && serviceFee > fees.serviceFeeCap) {
    serviceFee = fees.serviceFeeCap;
  }
  
  // 3. Calculate processing fee based on provider
  let processingFee = 0;
  const totalBeforeProcessing = ticketSubtotal + serviceFee;
  
  if (paymentProvider === 'stripe') {
    processingFee = (totalBeforeProcessing * fees.stripeProcessingPercent) + fees.stripeProcessingFixed;
  } else {
    // Paystack
    processingFee = (totalBeforeProcessing * fees.paystackProcessingPercent) + fees.paystackProcessingFixed;
  }
  
  // 4. Add per-order processing fixed fee
  processingFee += fees.processingFeeFixedPerOrder;
  
  return {
    serviceFee: Math.round(serviceFee * 100) / 100,
    processingFee: Math.round(processingFee * 100) / 100,
    totalFee: Math.round((serviceFee + processingFee) * 100) / 100,
    // For display to buyer (combined as "Service Fee")
    displayFee: Math.round((serviceFee + processingFee) * 100) / 100
  };
};
'''

# AdminFeeManagement.jsx content
admin_fee_jsx = '''import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { clearFeesCache } from '@/config/fees';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { 
  DollarSign, Percent, Globe, Building2, Edit2, Save, 
  Loader2, Calculator, AlertCircle, CheckCircle, RefreshCw
} from 'lucide-react';

const CURRENCY_SYMBOLS = {
  USD: '$', GBP: '£', EUR: '€', NGN: '₦', GHS: '₵', 
  KES: 'KSh', ZAR: 'R', CAD: 'C$'
};

export function AdminFeeManagement() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [countries, setCountries] = useState([]);
  const [organizers, setOrganizers] = useState([]);
  const [editingCountry, setEditingCountry] = useState(null);
  const [editingOrganizer, setEditingOrganizer] = useState(null);
  const [countryModalOpen, setCountryModalOpen] = useState(false);
  const [organizerModalOpen, setOrganizerModalOpen] = useState(false);
  const [previewAmount, setPreviewAmount] = useState(50);
  const [previewTickets, setPreviewTickets] = useState(1);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [countriesRes, organizersRes] = await Promise.all([
        supabase
          .from('countries')
          .select('*')
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('organizers')
          .select('id, business_name, country_code, custom_fee_enabled, custom_service_fee_percentage, custom_service_fee_fixed, custom_service_fee_cap')
          .order('business_name')
      ]);

      setCountries(countriesRes.data || []);
      setOrganizers(organizersRes.data || []);
    } catch (error) {
      console.error('Error loading fee data:', error);
    } finally {
      setLoading(false);
    }
  };

  const openCountryModal = (country) => {
    setEditingCountry({
      ...country,
      service_fee_percentage: country.service_fee_percentage || 5,
      service_fee_fixed_per_ticket: country.service_fee_fixed_per_ticket || 0,
      service_fee_cap: country.service_fee_cap || '',
      processing_fee_fixed_per_order: country.processing_fee_fixed_per_order || 0,
      stripe_processing_fee_pct: country.stripe_processing_fee_pct || 2.9,
      stripe_processing_fee_fixed: country.stripe_processing_fee_fixed || 0.30,
      paystack_processing_fee_pct: country.paystack_processing_fee_pct || 1.5,
      paystack_processing_fee_fixed: country.paystack_processing_fee_fixed || 100,
    });
    setCountryModalOpen(true);
  };

  const saveCountryFees = async () => {
    if (!editingCountry) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('countries')
        .update({
          service_fee_percentage: parseFloat(editingCountry.service_fee_percentage) || 0,
          service_fee_fixed_per_ticket: parseFloat(editingCountry.service_fee_fixed_per_ticket) || 0,
          service_fee_cap: editingCountry.service_fee_cap ? parseFloat(editingCountry.service_fee_cap) : null,
          processing_fee_fixed_per_order: parseFloat(editingCountry.processing_fee_fixed_per_order) || 0,
          stripe_processing_fee_pct: parseFloat(editingCountry.stripe_processing_fee_pct) || 2.9,
          stripe_processing_fee_fixed: parseFloat(editingCountry.stripe_processing_fee_fixed) || 0.30,
          paystack_processing_fee_pct: parseFloat(editingCountry.paystack_processing_fee_pct) || 1.5,
          paystack_processing_fee_fixed: parseFloat(editingCountry.paystack_processing_fee_fixed) || 100,
        })
        .eq('code', editingCountry.code);

      if (error) throw error;

      clearFeesCache();
      
      setSuccessMessage(`${editingCountry.name} fees updated successfully`);
      setTimeout(() => setSuccessMessage(''), 3000);
      
      setCountryModalOpen(false);
      loadData();
    } catch (error) {
      console.error('Error saving country fees:', error);
      alert('Failed to save fees');
    } finally {
      setSaving(false);
    }
  };

  const openOrganizerModal = (organizer) => {
    setEditingOrganizer({
      ...organizer,
      custom_fee_enabled: organizer.custom_fee_enabled || false,
      custom_service_fee_percentage: organizer.custom_service_fee_percentage || '',
      custom_service_fee_fixed: organizer.custom_service_fee_fixed || '',
      custom_service_fee_cap: organizer.custom_service_fee_cap || '',
    });
    setOrganizerModalOpen(true);
  };

  const saveOrganizerFees = async () => {
    if (!editingOrganizer) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('organizers')
        .update({
          custom_fee_enabled: editingOrganizer.custom_fee_enabled,
          custom_service_fee_percentage: editingOrganizer.custom_service_fee_percentage 
            ? parseFloat(editingOrganizer.custom_service_fee_percentage) 
            : null,
          custom_service_fee_fixed: editingOrganizer.custom_service_fee_fixed 
            ? parseFloat(editingOrganizer.custom_service_fee_fixed) 
            : null,
          custom_service_fee_cap: editingOrganizer.custom_service_fee_cap 
            ? parseFloat(editingOrganizer.custom_service_fee_cap) 
            : null,
        })
        .eq('id', editingOrganizer.id);

      if (error) throw error;

      clearFeesCache();
      
      setSuccessMessage(`${editingOrganizer.business_name} fees updated successfully`);
      setTimeout(() => setSuccessMessage(''), 3000);
      
      setOrganizerModalOpen(false);
      loadData();
    } catch (error) {
      console.error('Error saving organizer fees:', error);
      alert('Failed to save fees');
    } finally {
      setSaving(false);
    }
  };

  const calculatePreviewFee = (country, provider = 'stripe') => {
    const subtotal = previewAmount * previewTickets;
    const servicePct = parseFloat(country.service_fee_percentage || 5) / 100;
    const serviceFixed = parseFloat(country.service_fee_fixed_per_ticket || 0);
    const cap = country.service_fee_cap ? parseFloat(country.service_fee_cap) : null;
    
    let serviceFee = (subtotal * servicePct) + (serviceFixed * previewTickets);
    if (cap && serviceFee > cap) serviceFee = cap;
    
    const totalBeforeProcessing = subtotal + serviceFee;
    let processingFee = 0;
    
    if (provider === 'stripe') {
      const stripePct = parseFloat(country.stripe_processing_fee_pct || 2.9) / 100;
      const stripeFixed = parseFloat(country.stripe_processing_fee_fixed || 0.30);
      processingFee = (totalBeforeProcessing * stripePct) + stripeFixed;
    } else {
      const paystackPct = parseFloat(country.paystack_processing_fee_pct || 1.5) / 100;
      const paystackFixed = parseFloat(country.paystack_processing_fee_fixed || 100);
      processingFee = (totalBeforeProcessing * paystackPct) + paystackFixed;
    }
    
    processingFee += parseFloat(country.processing_fee_fixed_per_order || 0);
    
    return {
      serviceFee: serviceFee.toFixed(2),
      processingFee: processingFee.toFixed(2),
      total: (serviceFee + processingFee).toFixed(2),
      grandTotal: (subtotal + serviceFee + processingFee).toFixed(2)
    };
  };

  const getCurrencySymbol = (currency) => CURRENCY_SYMBOLS[currency] || '$';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {successMessage && (
        <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700">
          <CheckCircle className="w-5 h-5" />
          {successMessage}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-[#0F0F0F]">Fee Management</h2>
          <p className="text-[#0F0F0F]/60">Configure platform and payment processing fees</p>
        </div>
        <Button variant="outline" onClick={loadData} className="rounded-xl">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Card className="border-[#0F0F0F]/10 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-[#2969FF]" />
            Fee Calculator Preview
          </CardTitle>
          <CardDescription>See how fees are calculated for different ticket prices</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div>
              <Label>Ticket Price</Label>
              <Input
                type="number"
                value={previewAmount}
                onChange={(e) => setPreviewAmount(parseFloat(e.target.value) || 0)}
                className="w-32 rounded-xl mt-1"
              />
            </div>
            <div>
              <Label>Quantity</Label>
              <Input
                type="number"
                value={previewTickets}
                onChange={(e) => setPreviewTickets(parseInt(e.target.value) || 1)}
                className="w-24 rounded-xl mt-1"
                min="1"
              />
            </div>
            <div className="text-sm text-[#0F0F0F]/60 mt-6">
              Subtotal: ${(previewAmount * previewTickets).toFixed(2)}
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="global" className="space-y-6">
        <TabsList className="bg-[#F4F6FA] rounded-xl p-1">
          <TabsTrigger value="global" className="rounded-lg data-[state=active]:bg-white">
            <Globe className="w-4 h-4 mr-2" />
            Global Fees by Country
          </TabsTrigger>
          <TabsTrigger value="organizers" className="rounded-lg data-[state=active]:bg-white">
            <Building2 className="w-4 h-4 mr-2" />
            Custom Organizer Fees
          </TabsTrigger>
        </TabsList>

        <TabsContent value="global" className="space-y-4">
          <Card className="border-[#0F0F0F]/10 rounded-2xl">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Country</TableHead>
                    <TableHead>Currency</TableHead>
                    <TableHead>Service Fee</TableHead>
                    <TableHead>Cap</TableHead>
                    <TableHead>Processing (Stripe)</TableHead>
                    <TableHead>Processing (Paystack)</TableHead>
                    <TableHead>Preview</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {countries.map((country) => {
                    const symbol = getCurrencySymbol(country.default_currency);
                    const preview = calculatePreviewFee(country, country.code === 'NG' || country.code === 'GH' ? 'paystack' : 'stripe');
                    
                    return (
                      <TableRow key={country.code}>
                        <TableCell className="font-medium">{country.name}</TableCell>
                        <TableCell><Badge variant="outline">{country.default_currency}</Badge></TableCell>
                        <TableCell>{country.service_fee_percentage || 0}% + {symbol}{country.service_fee_fixed_per_ticket || 0}/ticket</TableCell>
                        <TableCell>{country.service_fee_cap ? `${symbol}${country.service_fee_cap}` : 'No cap'}</TableCell>
                        <TableCell className="text-sm text-[#0F0F0F]/60">{country.stripe_processing_fee_pct || 2.9}% + {symbol}{country.stripe_processing_fee_fixed || 0.30}</TableCell>
                        <TableCell className="text-sm text-[#0F0F0F]/60">{country.paystack_processing_fee_pct || 1.5}% + {symbol}{country.paystack_processing_fee_fixed || 100}</TableCell>
                        <TableCell><span className="text-sm font-medium text-green-600">{symbol}{preview.total}</span></TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => openCountryModal(country)} className="rounded-lg">
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="organizers" className="space-y-4">
          <Card className="border-[#0F0F0F]/10 rounded-2xl">
            <CardHeader>
              <CardTitle>Custom Organizer Fees</CardTitle>
              <CardDescription>Override default fees for specific organizers (negotiated rates)</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organizer</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead>Custom Fees</TableHead>
                    <TableHead>Service Fee Override</TableHead>
                    <TableHead>Cap Override</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {organizers.map((organizer) => (
                    <TableRow key={organizer.id}>
                      <TableCell className="font-medium">{organizer.business_name || 'Unnamed'}</TableCell>
                      <TableCell><Badge variant="outline">{organizer.country_code || 'N/A'}</Badge></TableCell>
                      <TableCell>
                        {organizer.custom_fee_enabled ? (
                          <Badge className="bg-green-100 text-green-700">Enabled</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[#0F0F0F]/40">Default</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {organizer.custom_fee_enabled && organizer.custom_service_fee_percentage != null ? (
                          <span>{organizer.custom_service_fee_percentage}%{organizer.custom_service_fee_fixed ? ` + ${organizer.custom_service_fee_fixed}/ticket` : ''}</span>
                        ) : (
                          <span className="text-[#0F0F0F]/40">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {organizer.custom_fee_enabled && organizer.custom_service_fee_cap ? (
                          <span>{organizer.custom_service_fee_cap}</span>
                        ) : (
                          <span className="text-[#0F0F0F]/40">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => openOrganizerModal(organizer)} className="rounded-lg">
                          <Edit2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={countryModalOpen} onOpenChange={setCountryModalOpen}>
        <DialogContent className="max-w-xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-[#2969FF]" />
              Edit Fees - {editingCountry?.name}
            </DialogTitle>
          </DialogHeader>

          {editingCountry && (
            <div className="space-y-6 py-4">
              <div className="space-y-4">
                <h3 className="font-medium flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-green-600" />
                  Service Fees (Ticketrack Revenue)
                </h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Percentage (%)</Label>
                    <Input type="number" step="0.1" value={editingCountry.service_fee_percentage}
                      onChange={(e) => setEditingCountry({...editingCountry, service_fee_percentage: e.target.value})}
                      className="rounded-xl mt-1" />
                  </div>
                  <div>
                    <Label>Fixed per Ticket ({getCurrencySymbol(editingCountry.default_currency)})</Label>
                    <Input type="number" step="0.01" value={editingCountry.service_fee_fixed_per_ticket}
                      onChange={(e) => setEditingCountry({...editingCountry, service_fee_fixed_per_ticket: e.target.value})}
                      className="rounded-xl mt-1" />
                  </div>
                  <div>
                    <Label>Fee Cap ({getCurrencySymbol(editingCountry.default_currency)}) - Leave blank for no cap</Label>
                    <Input type="number" step="0.01" value={editingCountry.service_fee_cap}
                      onChange={(e) => setEditingCountry({...editingCountry, service_fee_cap: e.target.value})}
                      placeholder="No cap" className="rounded-xl mt-1" />
                  </div>
                  <div>
                    <Label>Fixed per Order ({getCurrencySymbol(editingCountry.default_currency)})</Label>
                    <Input type="number" step="0.01" value={editingCountry.processing_fee_fixed_per_order}
                      onChange={(e) => setEditingCountry({...editingCountry, processing_fee_fixed_per_order: e.target.value})}
                      className="rounded-xl mt-1" />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="font-medium flex items-center gap-2">
                  <Percent className="w-4 h-4 text-purple-600" />
                  Stripe Processing Fees (Pass-through)
                </h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Percentage (%)</Label>
                    <Input type="number" step="0.1" value={editingCountry.stripe_processing_fee_pct}
                      onChange={(e) => setEditingCountry({...editingCountry, stripe_processing_fee_pct: e.target.value})}
                      className="rounded-xl mt-1" />
                  </div>
                  <div>
                    <Label>Fixed ({getCurrencySymbol(editingCountry.default_currency)})</Label>
                    <Input type="number" step="0.01" value={editingCountry.stripe_processing_fee_fixed}
                      onChange={(e) => setEditingCountry({...editingCountry, stripe_processing_fee_fixed: e.target.value})}
                      className="rounded-xl mt-1" />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="font-medium flex items-center gap-2">
                  <Percent className="w-4 h-4 text-teal-600" />
                  Paystack Processing Fees (Pass-through)
                </h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Percentage (%)</Label>
                    <Input type="number" step="0.1" value={editingCountry.paystack_processing_fee_pct}
                      onChange={(e) => setEditingCountry({...editingCountry, paystack_processing_fee_pct: e.target.value})}
                      className="rounded-xl mt-1" />
                  </div>
                  <div>
                    <Label>Fixed ({getCurrencySymbol(editingCountry.default_currency)})</Label>
                    <Input type="number" step="0.01" value={editingCountry.paystack_processing_fee_fixed}
                      onChange={(e) => setEditingCountry({...editingCountry, paystack_processing_fee_fixed: e.target.value})}
                      className="rounded-xl mt-1" />
                  </div>
                </div>
              </div>

              <div className="p-4 bg-[#F4F6FA] rounded-xl">
                <p className="text-sm font-medium mb-2">Preview (for {getCurrencySymbol(editingCountry.default_currency)}{previewAmount} × {previewTickets} ticket{previewTickets > 1 ? 's' : ''}):</p>
                {(() => {
                  const preview = calculatePreviewFee(editingCountry, editingCountry.code === 'NG' || editingCountry.code === 'GH' ? 'paystack' : 'stripe');
                  const symbol = getCurrencySymbol(editingCountry.default_currency);
                  return (
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <span>Service Fee:</span><span className="text-right font-medium">{symbol}{preview.serviceFee}</span>
                      <span>Processing Fee:</span><span className="text-right font-medium">{symbol}{preview.processingFee}</span>
                      <span className="font-medium">Total Fee:</span><span className="text-right font-bold text-green-600">{symbol}{preview.total}</span>
                      <span>Buyer Pays:</span><span className="text-right font-medium">{symbol}{preview.grandTotal}</span>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setCountryModalOpen(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={saveCountryFees} disabled={saving} className="bg-[#2969FF] text-white rounded-xl">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={organizerModalOpen} onOpenChange={setOrganizerModalOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[#2969FF]" />
              Custom Fees - {editingOrganizer?.business_name}
            </DialogTitle>
          </DialogHeader>

          {editingOrganizer && (
            <div className="space-y-6 py-4">
              <div className="flex items-center justify-between p-4 bg-[#F4F6FA] rounded-xl">
                <div>
                  <Label>Enable Custom Fees</Label>
                  <p className="text-sm text-[#0F0F0F]/60">Override default country fees</p>
                </div>
                <Switch checked={editingOrganizer.custom_fee_enabled}
                  onCheckedChange={(checked) => setEditingOrganizer({...editingOrganizer, custom_fee_enabled: checked})} />
              </div>

              {editingOrganizer.custom_fee_enabled && (
                <div className="space-y-4">
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-xl text-sm text-yellow-800">
                    <AlertCircle className="w-4 h-4 inline mr-2" />
                    Leave fields blank to use country default
                  </div>
                  <div>
                    <Label>Service Fee Percentage (%)</Label>
                    <Input type="number" step="0.1" value={editingOrganizer.custom_service_fee_percentage}
                      onChange={(e) => setEditingOrganizer({...editingOrganizer, custom_service_fee_percentage: e.target.value})}
                      placeholder="Use country default" className="rounded-xl mt-1" />
                  </div>
                  <div>
                    <Label>Fixed Fee per Ticket</Label>
                    <Input type="number" step="0.01" value={editingOrganizer.custom_service_fee_fixed}
                      onChange={(e) => setEditingOrganizer({...editingOrganizer, custom_service_fee_fixed: e.target.value})}
                      placeholder="Use country default" className="rounded-xl mt-1" />
                  </div>
                  <div>
                    <Label>Fee Cap (max fee per order)</Label>
                    <Input type="number" step="0.01" value={editingOrganizer.custom_service_fee_cap}
                      onChange={(e) => setEditingOrganizer({...editingOrganizer, custom_service_fee_cap: e.target.value})}
                      placeholder="Use country default" className="rounded-xl mt-1" />
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOrganizerModalOpen(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={saveOrganizerFees} disabled={saving} className="bg-[#2969FF] text-white rounded-xl">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
'''

def main():
    # Write fees.js
    fees_path = os.path.join(BASE_DIR, "src/config/fees.js")
    os.makedirs(os.path.dirname(fees_path), exist_ok=True)
    with open(fees_path, 'w') as f:
        f.write(fees_js)
    print(f"✅ Updated {fees_path}")
    
    # Write AdminFeeManagement.jsx
    admin_path = os.path.join(BASE_DIR, "src/pages/admin/AdminFeeManagement.jsx")
    os.makedirs(os.path.dirname(admin_path), exist_ok=True)
    with open(admin_path, 'w') as f:
        f.write(admin_fee_jsx)
    print(f"✅ Created {admin_path}")
    
    print()
    print("⚠️  IMPORTANT: Next steps:")
    print("1. Run SQL: ALTER TABLE organizers ADD COLUMN IF NOT EXISTS custom_service_fee_cap DECIMAL(10,2) DEFAULT NULL;")
    print("2. Add route to App.jsx for AdminFeeManagement")
    print("3. Update WebCheckout.jsx to use new fee calculation (I will do this next)")

if __name__ == "__main__":
    main()
