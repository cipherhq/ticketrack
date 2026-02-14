import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building,
  Search,
  CheckCircle,
  ArrowLeft,
  ArrowRight,
  Loader2,
  Printer,
  DollarSign,
  Calendar,
  CreditCard,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { useAdmin } from '@/contexts/AdminContext';
import { sendPayoutProcessedEmail, sendAdminPayoutCompletedEmail } from '@/lib/emailService';
import { formatPrice, getDefaultCurrency } from '@/config/currencies';
import { getFeesByCurrency } from '@/config/fees';

export function AdminProcessPayout() {
  const navigate = useNavigate();
  const { logAdminAction } = useAdmin();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [organizers, setOrganizers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrganizer, setSelectedOrganizer] = useState(null);
  const [pendingEvents, setPendingEvents] = useState([]);
  const [bankAccount, setBankAccount] = useState(null);
  const [payoutResult, setPayoutResult] = useState(null);
  const [selectedFees, setSelectedFees] = useState(null);

  useEffect(() => {
    loadOrganizers();
  }, []);

  const loadOrganizers = async () => {
    setLoading(true);
    try {
      // Get organizers with available balance
      const { data, error } = await supabase
        .from('organizers')
        .select(`
          id,
          business_name,
          email,
          business_email,
          country_code,
          available_balance,
          pending_balance,
          kyc_status,
          kyc_verified
        `)
        .gt('available_balance', 0)
        .eq('is_active', true)
        .order('available_balance', { ascending: false });

      if (error) throw error;

      // Get pending events count for each organizer
      const organizersWithEvents = await Promise.all(
        (data || []).map(async (org) => {
          const { count } = await supabase
            .from('events')
            .select('*', { count: 'exact', head: true })
            .eq('organizer_id', org.id)
            .eq('payout_status', 'pending');

          return {
            ...org,
            pendingEventsCount: count || 0,
          };
        })
      );

      setOrganizers(organizersWithEvents.filter(o => o.pendingEventsCount > 0 || o.available_balance > 0));
    } catch (error) {
      console.error('Error loading organizers:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectOrganizer = async (organizer) => {
    setSelectedOrganizer(organizer);
    setLoading(true);

    try {
      const currency = getDefaultCurrency(organizer.country_code);

      // Load pending events, bank account, and fees in parallel
      const [eventsRes, accountsRes, fees] = await Promise.all([
        supabase
          .from('events')
          .select('id, title, start_date, ticket_price')
          .eq('organizer_id', organizer.id)
          .eq('payout_status', 'pending'),
        supabase
          .from('bank_accounts')
          .select('*')
          .eq('organizer_id', organizer.id)
          .eq('is_primary', true)
          .limit(1),
        getFeesByCurrency(currency),
      ]);

      setPendingEvents(eventsRes.data || []);
      setBankAccount(accountsRes.data?.[0] || null);
      setSelectedFees(fees);
    } catch (error) {
      console.error('Error loading organizer details:', error);
    } finally {
      setLoading(false);
    }
  };

  const processPayout = async () => {
    if (!selectedOrganizer || !bankAccount) return;

    // Check KYC verification status
    const kycStatus = selectedOrganizer.kyc_status;
    const kycVerified = selectedOrganizer.kyc_verified;
    if (!kycVerified && kycStatus !== 'verified' && kycStatus !== 'approved') {
      alert('Cannot process payout: Organizer has not completed KYC verification. Please ask the organizer to complete their KYC verification first.');
      return;
    }

    setProcessing(true);

    try {
      const amount = parseFloat(selectedOrganizer.available_balance) || 0;

      if (amount <= 0) {
        alert('Cannot process payout: organizer has no available balance.');
        setProcessing(false);
        return;
      }

      // Idempotency check: prevent double-payout within the last hour
      const { data: recentPayout } = await supabase
        .from('payouts')
        .select('id, payout_number')
        .eq('organizer_id', selectedOrganizer.id)
        .in('status', ['completed', 'processing'])
        .gte('processed_at', new Date(Date.now() - 3600000).toISOString())
        .limit(1);

      if (recentPayout && recentPayout.length > 0) {
        alert(`A payout was already processed for this organizer recently (${recentPayout[0].payout_number}). Please wait and refresh before retrying.`);
        setProcessing(false);
        return;
      }
      const currency = getDefaultCurrency(selectedOrganizer.country_code);
      const fees = selectedFees || await getFeesByCurrency(currency);
      const feeRate = fees?.serviceFeePercent || 0.05;
      const platformFee = Math.round(amount * feeRate * 100) / 100;
      const netAmount = amount - platformFee;
      const reference = `PAY-${Date.now().toString(36).toUpperCase()}`;
      const eventTitles = pendingEvents.map(e => e.title).join(', ');
      const eventIds = pendingEvents.map(e => e.id);
      // Insert payout with 'processing' status first
      const { data: payout, error: payoutError } = await supabase
        .from('payouts')
        .insert({
          organizer_id: selectedOrganizer.id,
          bank_account_id: bankAccount.id,
          payout_number: reference,
          amount: amount,
          platform_fee_deducted: platformFee,
          net_amount: netAmount,
          currency: currency,
          status: 'processing',
          transaction_reference: reference,
          event_ids: eventIds,
          notes: eventTitles ? `Events: ${eventTitles}` : null,
        })
        .select()
        .single();

      if (payoutError) throw payoutError;

      // Update organizer balance
      const { error: updateError } = await supabase
        .from('organizers')
        .update({
          available_balance: 0,
          pending_balance: 0,
        })
        .eq('id', selectedOrganizer.id);

      if (updateError) {
        // Rollback: mark payout as failed
        await supabase.from('payouts').update({ status: 'failed' }).eq('id', payout.id);
        throw updateError;
      }

      // Mark events as paid
      if (pendingEvents.length > 0) {
        await supabase
          .from('events')
          .update({ payout_status: 'paid' })
          .eq('organizer_id', selectedOrganizer.id)
          .eq('payout_status', 'pending');
      }

      // Mark payout as completed
      const { error: completeError } = await supabase
        .from('payouts')
        .update({ status: 'completed', processed_at: new Date().toISOString() })
        .eq('id', payout.id);

      if (completeError) {
        console.error('Failed to mark payout as completed:', completeError);
      }

      await logAdminAction('payout_processed', 'payout', payout.id, {
        organizer: selectedOrganizer.business_name,
        amount: netAmount,
      });

      // Send email to organizer
      const organizerEmail = selectedOrganizer.email || selectedOrganizer.business_email;
      if (organizerEmail) {
        sendPayoutProcessedEmail(organizerEmail, {
          amount: netAmount,
          currency: currency,
          bankName: bankAccount.bank_name,
          accountNumber: bankAccount.account_number?.slice(-4) || '****',
          reference: reference,
        }, selectedOrganizer.id).catch(err => console.error('Failed to send organizer payout email:', err));
      }

      // Send email to support/admin
      sendAdminPayoutCompletedEmail('support@ticketrack.com', {
        organizerName: selectedOrganizer.business_name,
        organizerEmail: organizerEmail,
        amount: amount,
        netAmount: netAmount,
        platformFee: platformFee,
        currency: currency,
        bankName: bankAccount.bank_name,
        accountNumber: bankAccount.account_number,
        reference: reference,
        processedBy: 'Admin',
      }).catch(err => console.error('Failed to send admin payout email:', err));

      setPayoutResult({
        organizer: selectedOrganizer.business_name,
        reference: reference,
        bankName: bankAccount.bank_name,
        accountNumber: bankAccount.account_number,
        eventsCount: pendingEvents.length,
        totalRevenue: amount,
        platformFee: platformFee,
        netPayout: netAmount,
      });

      setStep(3);
    } catch (error) {
      console.error('Payout error:', error);
      alert('Failed to process payout');
    } finally {
      setProcessing(false);
    }
  };

  const filteredOrganizers = organizers.filter((org) =>
    org.business_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    org.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    org.business_email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading && step === 1) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <Button
          variant="ghost"
          onClick={() => navigate('/admin/payouts')}
          className="mb-4 rounded-xl"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Payouts
        </Button>
        <h2 className="text-2xl font-semibold text-foreground">Start Organizer Payouts</h2>
        <p className="text-muted-foreground mt-1">Process payouts for organizers with completed events</p>
      </div>

      {/* Stepper */}
      <div className="flex items-center justify-center gap-4 py-6">
        <div className={`flex items-center gap-2 ${step >= 1 ? 'text-[#2969FF]' : 'text-muted-foreground'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step >= 1 ? 'bg-[#2969FF] text-white' : 'bg-[#0F0F0F]/10'}`}>
            {step > 1 ? <CheckCircle className="w-5 h-5" /> : '1'}
          </div>
          <span className="font-medium">Select Organizer</span>
        </div>
        <div className="w-16 h-0.5 bg-[#0F0F0F]/10" />
        <div className={`flex items-center gap-2 ${step >= 2 ? 'text-[#2969FF]' : 'text-muted-foreground'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step >= 2 ? 'bg-[#2969FF] text-white' : 'bg-[#0F0F0F]/10'}`}>
            {step > 2 ? <CheckCircle className="w-5 h-5" /> : '2'}
          </div>
          <span className="font-medium">Review & Process</span>
        </div>
        <div className="w-16 h-0.5 bg-[#0F0F0F]/10" />
        <div className={`flex items-center gap-2 ${step >= 3 ? 'text-[#2969FF]' : 'text-muted-foreground'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step >= 3 ? 'bg-[#2969FF] text-white' : 'bg-[#0F0F0F]/10'}`}>
            3
          </div>
          <span className="font-medium">Complete</span>
        </div>
      </div>

      {/* Step 1: Select Organizer */}
      {step === 1 && (
        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Building className="w-5 h-5 text-muted-foreground" />
              <h3 className="text-lg font-medium text-foreground">Select Organizer for Payout</h3>
            </div>

            <div className="mb-4">
              <p className="text-sm text-muted-foreground mb-2">Search Organizers</p>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-3">
              {filteredOrganizers.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No organizers with pending payouts</p>
              ) : (
                filteredOrganizers.map((org) => {
                  const currency = getDefaultCurrency(org.country_code);
                  return (
                    <div
                      key={org.id}
                      onClick={() => {
                        selectOrganizer(org);
                        setStep(2);
                      }}
                      className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${
                        selectedOrganizer?.id === org.id
                          ? 'border-[#2969FF] bg-[#2969FF]/5'
                          : 'border-border/10 hover:border-[#2969FF]/50 hover:bg-muted'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${selectedOrganizer?.id === org.id ? 'bg-[#2969FF]' : 'bg-[#0F0F0F]/20'}`} />
                        <div>
                          <p className="font-medium text-foreground">{org.business_name}</p>
                          <p className="text-sm text-muted-foreground">{org.email || org.business_email}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">{org.country_code || 'Nigeria'} ({currency})</Badge>
                            {org.pendingEventsCount > 0 && (
                              <Badge className="bg-orange-100 text-orange-700 text-xs">
                                {org.pendingEventsCount} pending event{org.pendingEventsCount > 1 ? 's' : ''}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Available Balance</p>
                        <p className="text-xl font-semibold text-foreground">{formatPrice(org.available_balance, currency)}</p>
                        {org.pending_balance > 0 && (
                          <>
                            <p className="text-xs text-muted-foreground mt-1">Pending Payout</p>
                            <p className="text-sm font-medium text-[#2969FF]">{formatPrice(org.pending_balance, currency)}</p>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Review & Process */}
      {step === 2 && selectedOrganizer && (
        <div className="space-y-4">
          <Card className="border-border/10 rounded-2xl">
            <CardContent className="p-6">
              <h3 className="text-lg font-medium text-foreground mb-4">Review Payout Details</h3>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-[#2969FF]" />
                </div>
              ) : (
                <>
                  {/* Organizer Info */}
                  <div className="p-4 bg-muted rounded-xl mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-[#2969FF] flex items-center justify-center text-white text-xl font-medium">
                        {selectedOrganizer.business_name?.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{selectedOrganizer.business_name}</p>
                        <p className="text-sm text-muted-foreground">{selectedOrganizer.email || selectedOrganizer.business_email}</p>
                      </div>
                    </div>
                  </div>

                  {/* Payout Summary */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="p-4 bg-muted rounded-xl">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <DollarSign className="w-4 h-4" />
                        <span className="text-sm">Total Revenue</span>
                      </div>
                      <p className="text-xl font-semibold text-foreground">
                        {formatPrice(selectedOrganizer.available_balance, getDefaultCurrency(selectedOrganizer.country_code))}
                      </p>
                    </div>
                    <div className="p-4 bg-muted rounded-xl">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <Calendar className="w-4 h-4" />
                        <span className="text-sm">Events to Pay</span>
                      </div>
                      <p className="text-xl font-semibold text-foreground">{pendingEvents.length}</p>
                    </div>
                  </div>

                  {/* Fee Breakdown */}
                  {(() => {
                    const feeRate = selectedFees?.serviceFeePercent || 0.05;
                    const feePercent = Math.round(feeRate * 1000) / 10;
                    const gross = parseFloat(selectedOrganizer.available_balance) || 0;
                    const fee = Math.round(gross * feeRate * 100) / 100;
                    const net = gross - fee;
                    const currency = getDefaultCurrency(selectedOrganizer.country_code);
                    return (
                      <div className="p-4 border border-border/10 rounded-xl mb-4">
                        <div className="flex justify-between mb-2">
                          <span className="text-muted-foreground">Gross Amount</span>
                          <span className="text-foreground">{formatPrice(gross, currency)}</span>
                        </div>
                        <div className="flex justify-between mb-2">
                          <span className="text-muted-foreground">Platform Fee ({feePercent}%)</span>
                          <span className="text-red-600">-{formatPrice(fee, currency)}</span>
                        </div>
                        <div className="border-t border-border/10 pt-2 mt-2">
                          <div className="flex justify-between">
                            <span className="font-medium text-foreground">Net Payout</span>
                            <span className="text-xl font-semibold text-green-600">
                              {formatPrice(net, currency)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Bank Account */}
                  {bankAccount ? (
                    <div className="p-4 bg-green-50 rounded-xl">
                      <div className="flex items-center gap-2 text-green-700 mb-2">
                        <CreditCard className="w-4 h-4" />
                        <span className="font-medium">Bank Account</span>
                      </div>
                      <p className="text-foreground">{bankAccount.bank_name}</p>
                      <p className="text-muted-foreground">{bankAccount.account_name} - {bankAccount.account_number}</p>
                    </div>
                  ) : (
                    <div className="p-4 bg-red-50 rounded-xl">
                      <p className="text-red-600">No bank account found for this organizer</p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setStep(1)}
              className="flex-1 rounded-xl"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <Button
              onClick={processPayout}
              disabled={processing || !bankAccount}
              className="flex-1 bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl"
            >
              {processing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4 mr-2" />
              )}
              Process Payout
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Complete */}
      {step === 3 && payoutResult && (
        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-semibold text-foreground mb-2">Payout Processed Successfully!</h2>
            <p className="text-muted-foreground mb-6">
              {formatPrice(payoutResult.netPayout)} has been paid to {payoutResult.organizer}
            </p>

            {/* Transaction Summary */}
            <div className="p-6 bg-muted rounded-xl text-left mb-6">
              <div className="flex items-center gap-2 mb-4">
                <Building className="w-5 h-5 text-muted-foreground" />
                <span className="font-medium text-foreground">Transaction Summary</span>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Organizer</p>
                  <p className="text-foreground font-medium">{payoutResult.organizer}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Transaction Reference</p>
                  <p className="text-foreground font-medium">{payoutResult.reference}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Bank Account</p>
                  <p className="text-foreground font-medium">{payoutResult.bankName} - {payoutResult.accountNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Events Paid</p>
                  <p className="text-foreground font-medium">{payoutResult.eventsCount} events</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                  <p className="text-foreground font-medium">{formatPrice(payoutResult.totalRevenue)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Platform Fees</p>
                  <p className="text-red-600 font-medium">-{formatPrice(payoutResult.platformFee)}</p>
                </div>
              </div>

              <div className="border-t border-border/10 mt-4 pt-4">
                <p className="text-sm text-muted-foreground">Net Payout</p>
                <p className="text-2xl font-semibold text-green-600">{formatPrice(payoutResult.netPayout)}</p>
              </div>
            </div>

            {/* Actions Completed */}
            <div className="p-4 bg-green-50 rounded-xl text-left mb-6">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="font-medium text-green-700">Actions Completed:</span>
              </div>
              <ul className="text-sm text-green-700 space-y-1 ml-7">
                <li>✓ Payout marked as completed</li>
                <li>✓ Deducted {formatPrice(payoutResult.netPayout)} from organizer's available balance</li>
                <li>✓ Added payout record to organizer's history</li>
                <li>✓ Marked {payoutResult.eventsCount} events as paid</li>
                <li>✓ Confirmation email sent to organizer</li>
              </ul>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 justify-center">
              <Button
                onClick={() => {
                  setStep(1);
                  setSelectedOrganizer(null);
                  setPayoutResult(null);
                  loadOrganizers();
                }}
                className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl"
              >
                Process Another Payout
              </Button>
              <Button
                variant="outline"
                onClick={() => window.print()}
                className="rounded-xl"
              >
                <Printer className="w-4 h-4 mr-2" />
                Print Receipt
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
