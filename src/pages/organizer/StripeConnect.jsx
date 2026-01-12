import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  CreditCard, CheckCircle, AlertCircle, ExternalLink, Loader2, 
  Shield, DollarSign, Zap, ArrowRight, RefreshCw, XCircle,
  Building2, FileText, Clock, TrendingUp, Wallet
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useOrganizer } from '@/contexts/OrganizerContext';
import { supabase } from '@/lib/supabase';

// Stripe Connect status badge component
const StatusBadge = ({ status }) => {
  const statusConfig = {
    not_started: { label: 'Not Connected', color: 'bg-gray-100 text-gray-700', icon: XCircle },
    pending: { label: 'Setup Incomplete', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
    active: { label: 'Connected', color: 'bg-green-100 text-green-700', icon: CheckCircle },
    restricted: { label: 'Restricted', color: 'bg-red-100 text-red-700', icon: AlertCircle },
    disabled: { label: 'Disabled', color: 'bg-red-100 text-red-700', icon: XCircle },
  };

  const config = statusConfig[status] || statusConfig.not_started;
  const Icon = config.icon;

  return (
    <Badge className={`${config.color} flex items-center gap-1`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </Badge>
  );
};

export function StripeConnect() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { organizer, refreshOrganizer } = useOrganizer();
  
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [connectStatus, setConnectStatus] = useState(null);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [payoutStats, setPayoutStats] = useState({ total: 0, pending: 0, completed: 0 });
  
  // Stripe Balance state
  const [stripeBalance, setStripeBalance] = useState({ available: 0, pending: 0, currency: 'USD' });
  const [balanceLoading, setBalanceLoading] = useState(false);

  // Check for return from Stripe
  useEffect(() => {
    const successParam = searchParams.get('success');
    const refreshParam = searchParams.get('refresh');

    if (successParam === 'true') {
      setSuccess('Stripe Connect setup completed! Your account is being verified.');
      refreshOrganizer?.();
    } else if (refreshParam === 'true') {
      setError('Setup was not completed. Please try again to finish connecting your Stripe account.');
    }
  }, [searchParams]);

  // Load Connect status
  useEffect(() => {
    if (organizer?.id) {
      loadConnectStatus();
    }
  }, [organizer?.id]);

  const loadConnectStatus = async () => {
    setLoading(true);
    try {
      // Check if organizer is eligible (US, UK, CA)
      const eligibleCountries = ['US', 'GB', 'CA'];
      if (!eligibleCountries.includes(organizer.country_code)) {
        setConnectStatus({ eligible: false, reason: 'country' });
        setLoading(false);
        return;
      }

      // Check global setting
      const { data: globalSetting } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'stripe_connect_enabled')
        .single();

      if (globalSetting?.value !== 'true') {
        setConnectStatus({ eligible: false, reason: 'disabled' });
        setLoading(false);
        return;
      }

      // Get organizer's Connect status
      const status = {
        eligible: true,
        connected: !!organizer.stripe_connect_id,
        status: organizer.stripe_connect_status || 'not_started',
        accountId: organizer.stripe_connect_id,
        chargesEnabled: organizer.stripe_connect_charges_enabled,
        payoutsEnabled: organizer.stripe_connect_payouts_enabled,
        onboardedAt: organizer.stripe_connect_onboarded_at,
      };
      
      setConnectStatus(status);

      // Load payout stats and Stripe balance if connected
      if (organizer.stripe_connect_id && organizer.stripe_connect_status === 'active') {
        await Promise.all([
          loadPayoutStats(),
          loadStripeBalance()
        ]);
      }
    } catch (err) {
      console.error('Error loading Connect status:', err);
      setError('Failed to load Stripe Connect status');
    } finally {
      setLoading(false);
    }
  };

  const loadPayoutStats = async () => {
    try {
      const { data: payouts } = await supabase
        .from('stripe_connect_payouts')
        .select('amount, status')
        .eq('organizer_id', organizer.id);

      if (payouts) {
        const total = payouts.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
        const pending = payouts.filter(p => p.status === 'pending').reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
        const completed = payouts.filter(p => p.status === 'completed').reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
        setPayoutStats({ total, pending, completed });
      }
    } catch (err) {
      console.error('Error loading payout stats:', err);
    }
  };

  const loadStripeBalance = async () => {
    setBalanceLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('get-stripe-connect-balance', {
        body: { organizerId: organizer.id },
      });

      if (fnError) {
        console.error('Balance fetch error:', fnError);
        return;
      }

      if (data?.balance) {
        setStripeBalance({
          available: data.balance.available || 0,
          pending: data.balance.pending || 0,
          currency: data.balance.currency || 'USD',
        });
      }
    } catch (err) {
      console.error('Error loading Stripe balance:', err);
    } finally {
      setBalanceLoading(false);
    }
  };

  const handleConnectStripe = () => {
    if (!termsAccepted) {
      setShowTermsModal(true);
      return;
    }
    initiateStripeConnect();
  };

  const initiateStripeConnect = async () => {
    setConnecting(true);
    setError('');

    try {
      const { data, error: fnError } = await supabase.functions.invoke('create-stripe-connect-account', {
        body: {
          organizerId: organizer.id,
          refreshUrl: `${window.location.origin}/organizer/stripe-connect?refresh=true`,
          returnUrl: `${window.location.origin}/organizer/stripe-connect?success=true`,
        },
      });

      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);

      if (data?.onboardingUrl) {
        // Redirect to Stripe onboarding
        window.location.href = data.onboardingUrl;
      } else {
        throw new Error('Failed to get onboarding URL');
      }
    } catch (err) {
      console.error('Error connecting Stripe:', err);
      setError(err.message || 'Failed to connect Stripe account');
      setConnecting(false);
    }
  };

  const handleResumeSetup = async () => {
    setConnecting(true);
    setError('');

    try {
      const { data, error: fnError } = await supabase.functions.invoke('create-stripe-connect-account', {
        body: {
          organizerId: organizer.id,
          refreshUrl: `${window.location.origin}/organizer/stripe-connect?refresh=true`,
          returnUrl: `${window.location.origin}/organizer/stripe-connect?success=true`,
        },
      });

      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);

      if (data?.onboardingUrl) {
        window.location.href = data.onboardingUrl;
      }
    } catch (err) {
      console.error('Error resuming setup:', err);
      setError(err.message || 'Failed to resume setup');
      setConnecting(false);
    }
  };

  const handleTermsAccept = () => {
    setTermsAccepted(true);
    setShowTermsModal(false);
    initiateStripeConnect();
  };

  // Format currency
  const formatCurrency = (amount, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" />
      </div>
    );
  }

  // Not eligible - wrong country
  if (connectStatus?.eligible === false && connectStatus?.reason === 'country') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[#0F0F0F]">Stripe Connect</h1>
          <p className="text-[#0F0F0F]/60 mt-1">Automatic payouts for your events</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-[#0F0F0F] mb-2">Not Available in Your Region</h3>
              <p className="text-[#0F0F0F]/60 max-w-md mx-auto">
                Stripe Connect is currently available for organizers in the United States, United Kingdom, and Canada.
                Your payouts will continue to be processed manually by our finance team.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Feature disabled globally
  if (connectStatus?.eligible === false && connectStatus?.reason === 'disabled') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[#0F0F0F]">Stripe Connect</h1>
          <p className="text-[#0F0F0F]/60 mt-1">Automatic payouts for your events</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-[#0F0F0F] mb-2">Coming Soon</h3>
              <p className="text-[#0F0F0F]/60 max-w-md mx-auto">
                Stripe Connect is not currently available. Please check back later or contact support for more information.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0F0F0F]">Stripe Connect</h1>
          <p className="text-[#0F0F0F]/60 mt-1">Automatic payouts for your events</p>
        </div>
        {connectStatus?.status && <StatusBadge status={connectStatus.status} />}
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {/* Success Alert */}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-green-800 text-sm">{success}</p>
        </div>
      )}

      {/* Connected State */}
      {connectStatus?.status === 'active' && (
        <>
          {/* Stripe Balance Card */}
          <Card className="border-2 border-[#2969FF]/20 bg-gradient-to-r from-[#2969FF]/5 to-transparent">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-[#2969FF]" />
                  Stripe Balance
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={loadStripeBalance}
                  disabled={balanceLoading}
                  className="text-[#2969FF]"
                >
                  <RefreshCw className={`w-4 h-4 ${balanceLoading ? 'animate-spin' : ''}`} />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-[#0F0F0F]/60 mb-1">Available Balance</p>
                  <p className="text-3xl font-bold text-[#0F0F0F]">
                    {balanceLoading ? (
                      <span className="text-[#0F0F0F]/40">Loading...</span>
                    ) : (
                      formatCurrency(stripeBalance.available, stripeBalance.currency)
                    )}
                  </p>
                  <p className="text-xs text-[#0F0F0F]/50 mt-1">Ready to pay out</p>
                </div>
                <div>
                  <p className="text-sm text-[#0F0F0F]/60 mb-1">Pending Balance</p>
                  <p className="text-3xl font-bold text-[#0F0F0F]">
                    {balanceLoading ? (
                      <span className="text-[#0F0F0F]/40">Loading...</span>
                    ) : (
                      formatCurrency(stripeBalance.pending, stripeBalance.currency)
                    )}
                  </p>
                  <p className="text-xs text-[#0F0F0F]/50 mt-1">Processing (usually 2-7 days)</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payout Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-[#0F0F0F]/60">Total Payouts</p>
                    <p className="text-xl font-bold text-[#0F0F0F]">${payoutStats.total.toFixed(2)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                    <Clock className="w-5 h-5 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-sm text-[#0F0F0F]/60">Payouts Pending</p>
                    <p className="text-xl font-bold text-[#0F0F0F]">${payoutStats.pending.toFixed(2)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-[#0F0F0F]/60">Payouts Completed</p>
                    <p className="text-xl font-bold text-[#0F0F0F]">${payoutStats.completed.toFixed(2)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Connected Account Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                Stripe Account Connected
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-[#0F0F0F]/60">Account ID</p>
                  <p className="font-mono text-sm">{connectStatus.accountId}</p>
                </div>
                <div>
                  <p className="text-sm text-[#0F0F0F]/60">Connected Since</p>
                  <p className="text-sm">
                    {connectStatus.onboardedAt 
                      ? new Date(connectStatus.onboardedAt).toLocaleDateString()
                      : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-[#0F0F0F]/60">Charges</p>
                  <Badge className={connectStatus.chargesEnabled ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                    {connectStatus.chargesEnabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-[#0F0F0F]/60">Payouts</p>
                  <Badge className={connectStatus.payoutsEnabled ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                    {connectStatus.payoutsEnabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
              </div>

              <div className="pt-4 border-t">
                <p className="text-sm text-[#0F0F0F]/60 mb-2">
                  Ticket sales for your events will automatically be deposited to your connected Stripe account.
                  Payouts are released after each event ends.
                </p>
                <Button
                  variant="outline"
                  onClick={() => window.open('https://dashboard.stripe.com', '_blank')}
                  className="gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open Stripe Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Pending/Incomplete State */}
      {connectStatus?.status === 'pending' && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="w-8 h-8 text-yellow-600" />
              </div>
              <h3 className="text-lg font-semibold text-[#0F0F0F] mb-2">Setup Incomplete</h3>
              <p className="text-[#0F0F0F]/60 max-w-md mx-auto mb-6">
                Your Stripe Connect setup is not complete. Please finish the setup process to start receiving automatic payouts.
              </p>
              <Button
                onClick={handleResumeSetup}
                disabled={connecting}
                className="bg-[#2969FF] hover:bg-[#1e54d4] gap-2"
              >
                {connecting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Resume Setup
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Restricted State */}
      {connectStatus?.status === 'restricted' && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-[#0F0F0F] mb-2">Account Restricted</h3>
              <p className="text-[#0F0F0F]/60 max-w-md mx-auto mb-6">
                Your Stripe account has restrictions. Please visit your Stripe Dashboard to resolve any outstanding requirements.
              </p>
              <Button
                onClick={() => window.open('https://dashboard.stripe.com', '_blank')}
                className="bg-[#2969FF] hover:bg-[#1e54d4] gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Open Stripe Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Not Connected State */}
      {(!connectStatus?.status || connectStatus?.status === 'not_started') && (
        <>
          {/* Benefits Section */}
          <Card>
            <CardHeader>
              <CardTitle>Why Connect with Stripe?</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex gap-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Zap className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-[#0F0F0F]">Automatic Payouts</h4>
                    <p className="text-sm text-[#0F0F0F]/60">
                      Receive your earnings automatically after each event ends. No manual requests needed.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Shield className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-[#0F0F0F]">Secure & Verified</h4>
                    <p className="text-sm text-[#0F0F0F]/60">
                      Stripe handles identity verification and ensures secure transactions.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-[#0F0F0F]">Track Earnings</h4>
                    <p className="text-sm text-[#0F0F0F]/60">
                      Access your Stripe Dashboard to view detailed transaction history and analytics.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-[#0F0F0F]">Tax Documents</h4>
                    <p className="text-sm text-[#0F0F0F]/60">
                      Stripe provides 1099 tax forms automatically for US organizers.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Connect Button */}
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-[#2969FF]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CreditCard className="w-8 h-8 text-[#2969FF]" />
                </div>
                <h3 className="text-lg font-semibold text-[#0F0F0F] mb-2">Get Started with Stripe Connect</h3>
                <p className="text-[#0F0F0F]/60 max-w-md mx-auto mb-6">
                  Connect your Stripe account to receive automatic payouts for your ticket sales.
                  Setup takes about 5 minutes.
                </p>
                <Button
                  onClick={handleConnectStripe}
                  disabled={connecting}
                  className="bg-[#2969FF] hover:bg-[#1e54d4] gap-2"
                  size="lg"
                >
                  {connecting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ArrowRight className="w-4 h-4" />
                  )}
                  Connect with Stripe
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Terms Modal */}
      <Dialog open={showTermsModal} onOpenChange={setShowTermsModal}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Stripe Connect Terms & Conditions</DialogTitle>
            <DialogDescription>
              Please review and accept the terms before connecting your Stripe account.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-gray-50 rounded-lg p-4 text-sm text-[#0F0F0F]/70 space-y-3">
              <p><strong>By connecting your Stripe account, you agree to:</strong></p>
              
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong>Handle Refunds:</strong> You are responsible for processing refunds directly through your Stripe account. Ticketrack will not process refunds on your behalf for Stripe Connect payments.
                </li>
                <li>
                  <strong>Handle Disputes:</strong> You are responsible for responding to and resolving any payment disputes or chargebacks through your Stripe Dashboard.
                </li>
                <li>
                  <strong>Tax Compliance:</strong> You are responsible for reporting income and paying any applicable taxes. Stripe will provide 1099 forms for US-based organizers.
                </li>
                <li>
                  <strong>Platform Fees:</strong> Ticketrack will collect a platform fee from each transaction. The remaining amount will be deposited to your Stripe account.
                </li>
                <li>
                  <strong>Payout Timing:</strong> Payouts are released after your event ends. Standard Stripe payout timing applies after funds are released.
                </li>
                <li>
                  <strong>Account Compliance:</strong> You must keep your Stripe account in good standing and comply with Stripe's Terms of Service.
                </li>
              </ul>

              <p className="pt-2">
                For more details, please review Stripe's{' '}
                <a 
                  href="https://stripe.com/legal/connect-account" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-[#2969FF] hover:underline"
                >
                  Connected Account Agreement
                </a>.
              </p>
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                id="accept-terms"
                checked={termsAccepted}
                onCheckedChange={(checked) => setTermsAccepted(checked)}
              />
              <Label htmlFor="accept-terms" className="text-sm cursor-pointer">
                I have read and agree to the Stripe Connect terms and conditions. I understand that I am responsible for handling refunds, disputes, and tax compliance.
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTermsModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleTermsAccept}
              disabled={!termsAccepted || connecting}
              className="bg-[#2969FF] hover:bg-[#1e54d4]"
            >
              {connecting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Accept & Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
