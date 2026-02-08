import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CreditCard, CheckCircle, AlertCircle, Loader2,
  Shield, DollarSign, Zap, ArrowRight, XCircle,
  Building2, Clock, Wallet, Banknote, RefreshCw, Lock, Trophy, TrendingUp
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { HelpTip } from '@/components/HelpTip';

// Nigerian banks list
const NIGERIAN_BANKS = [
  { code: '044', name: 'Access Bank' },
  { code: '023', name: 'Citibank Nigeria' },
  { code: '050', name: 'Ecobank Nigeria' },
  { code: '070', name: 'Fidelity Bank' },
  { code: '011', name: 'First Bank of Nigeria' },
  { code: '214', name: 'First City Monument Bank' },
  { code: '058', name: 'Guaranty Trust Bank' },
  { code: '030', name: 'Heritage Bank' },
  { code: '301', name: 'Jaiz Bank' },
  { code: '082', name: 'Keystone Bank' },
  { code: '526', name: 'Parallex Bank' },
  { code: '076', name: 'Polaris Bank' },
  { code: '101', name: 'Providus Bank' },
  { code: '221', name: 'Stanbic IBTC Bank' },
  { code: '068', name: 'Standard Chartered Bank' },
  { code: '232', name: 'Sterling Bank' },
  { code: '100', name: 'Suntrust Bank' },
  { code: '032', name: 'Union Bank of Nigeria' },
  { code: '033', name: 'United Bank for Africa' },
  { code: '215', name: 'Unity Bank' },
  { code: '035', name: 'Wema Bank' },
  { code: '057', name: 'Zenith Bank' },
  { code: '999992', name: 'Opay' },
  { code: '999991', name: 'PalmPay' },
  { code: '999993', name: 'Kuda Bank' },
  { code: '999994', name: 'Moniepoint' },
];

// Ghanaian banks list
const GHANAIAN_BANKS = [
  { code: 'GH010100', name: 'GCB Bank' },
  { code: 'GH020100', name: 'Barclays Bank Ghana' },
  { code: 'GH030100', name: 'Standard Chartered Bank Ghana' },
  { code: 'GH040100', name: 'Ghana Commercial Bank' },
  { code: 'GH050100', name: 'National Investment Bank' },
  { code: 'GH060100', name: 'Agricultural Development Bank' },
  { code: 'GH070100', name: 'Prudential Bank' },
  { code: 'GH080100', name: 'Ecobank Ghana' },
  { code: 'GH090100', name: 'Access Bank Ghana' },
  { code: 'GH100100', name: 'Zenith Bank Ghana' },
  { code: 'GH110100', name: 'Fidelity Bank Ghana' },
  { code: 'GH120100', name: 'UBA Ghana' },
  { code: 'GH130100', name: 'Stanbic Bank Ghana' },
  { code: 'GH140100', name: 'First Atlantic Bank' },
  { code: 'GH150100', name: 'Republic Bank Ghana' },
];

// Kenyan banks list
const KENYAN_BANKS = [
  { code: 'KE001', name: 'Kenya Commercial Bank' },
  { code: 'KE002', name: 'Standard Chartered Bank Kenya' },
  { code: 'KE003', name: 'Barclays Bank of Kenya' },
  { code: 'KE004', name: 'Bank of India (Kenya)' },
  { code: 'KE005', name: 'Bank of Baroda (Kenya)' },
  { code: 'KE007', name: 'Commercial Bank of Africa' },
  { code: 'KE010', name: 'Prime Bank' },
  { code: 'KE011', name: 'Co-operative Bank of Kenya' },
  { code: 'KE012', name: 'National Bank of Kenya' },
  { code: 'KE014', name: 'Oriental Commercial Bank' },
  { code: 'KE016', name: 'Citibank N.A. Kenya' },
  { code: 'KE018', name: 'Middle East Bank Kenya' },
  { code: 'KE019', name: 'Bank of Africa Kenya' },
  { code: 'KE023', name: 'Consolidated Bank of Kenya' },
  { code: 'KE025', name: 'Credit Bank' },
  { code: 'KE026', name: 'Transnational Bank' },
  { code: 'KE030', name: 'Chase Bank Kenya' },
  { code: 'KE031', name: 'Stanbic Bank Kenya' },
  { code: 'KE035', name: 'African Banking Corporation' },
  { code: 'KE039', name: 'Imperial Bank Kenya' },
  { code: 'KE041', name: 'NIC Bank' },
  { code: 'KE043', name: 'Giro Commercial Bank' },
  { code: 'KE049', name: 'Equatorial Commercial Bank' },
  { code: 'KE051', name: 'Paramount Universal Bank' },
  { code: 'KE054', name: 'Jamii Bora Bank' },
  { code: 'KE055', name: 'Guaranty Trust Bank Kenya' },
  { code: 'KE057', name: 'I&M Bank' },
  { code: 'KE061', name: 'Housing Finance Company' },
  { code: 'KE063', name: 'Diamond Trust Bank' },
  { code: 'KE066', name: 'Equity Bank' },
  { code: 'KE068', name: 'Family Bank' },
  { code: 'KE070', name: 'Gulf African Bank' },
  { code: 'KE072', name: 'First Community Bank' },
  { code: 'KE074', name: 'DIB Bank Kenya' },
  { code: 'KE076', name: 'UBA Kenya' },
  { code: 'KE078', name: 'Sidian Bank' },
  { code: 'KE079', name: 'M-Pesa' },
];

// South African banks list
const SOUTH_AFRICAN_BANKS = [
  { code: 'ZA001', name: 'ABSA Bank' },
  { code: 'ZA002', name: 'Standard Bank' },
  { code: 'ZA003', name: 'First National Bank (FNB)' },
  { code: 'ZA004', name: 'Nedbank' },
  { code: 'ZA005', name: 'Capitec Bank' },
  { code: 'ZA006', name: 'Investec Bank' },
  { code: 'ZA007', name: 'African Bank' },
  { code: 'ZA008', name: 'Bidvest Bank' },
  { code: 'ZA009', name: 'Discovery Bank' },
  { code: 'ZA010', name: 'Grindrod Bank' },
  { code: 'ZA011', name: 'Mercantile Bank' },
  { code: 'ZA012', name: 'Sasfin Bank' },
  { code: 'ZA013', name: 'TymeBank' },
  { code: 'ZA014', name: 'Bank Zero' },
  { code: 'ZA015', name: 'Ubank' },
  { code: 'ZA016', name: 'Old Mutual' },
];

// Status badge component
const StatusBadge = ({ status }) => {
  const statusConfig = {
    not_started: { label: 'Not Connected', color: 'bg-muted text-foreground/80', icon: XCircle },
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

export function PaystackFlutterwaveConnect() {
  const navigate = useNavigate();
  const { organizer, refreshOrganizer } = useOrganizer();
  
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [verifyingAccount, setVerifyingAccount] = useState(false);
  const [accountVerified, setAccountVerified] = useState(false);
  const [accountName, setAccountName] = useState('');
  
  // Form state
  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [businessName, setBusinessName] = useState('');
  
  // Determine which provider to use based on country
  const isNigeria = organizer?.country_code === 'NG';
  const isGhana = organizer?.country_code === 'GH';
  const isKenya = organizer?.country_code === 'KE';
  const isSouthAfrica = organizer?.country_code === 'ZA';
  const isEligible = isNigeria || isGhana || isKenya || isSouthAfrica;
  
  // Nigeria uses Paystack, other countries use Flutterwave
  const provider = isNigeria ? 'Paystack' : 'Flutterwave';
  
  // Get appropriate bank list based on country
  const getBanks = () => {
    if (isNigeria) return NIGERIAN_BANKS;
    if (isGhana) return GHANAIAN_BANKS;
    if (isKenya) return KENYAN_BANKS;
    if (isSouthAfrica) return SOUTH_AFRICAN_BANKS;
    return [];
  };
  const banks = getBanks();
  
  // Get currency symbol based on country
  const getCurrency = () => {
    if (isNigeria) return '₦';
    if (isGhana) return 'GH₵';
    if (isKenya) return 'KSh';
    if (isSouthAfrica) return 'R';
    return '$';
  };
  const currency = getCurrency();
  
  // Get current subaccount status
  const paystackStatus = organizer?.paystack_subaccount_status || 'not_started';
  const flutterwaveStatus = organizer?.flutterwave_subaccount_status || 'not_started';
  const currentStatus = isNigeria ? paystackStatus : flutterwaveStatus;
  const isConnected = currentStatus === 'active';
  const subaccountId = isNigeria ? organizer?.paystack_subaccount_id : organizer?.flutterwave_subaccount_id;

  useEffect(() => {
    if (organizer?.id) {
      setBusinessName(organizer.business_name || '');
      setLoading(false);
    }
  }, [organizer?.id]);

  // Verify bank account
  const verifyBankAccount = async () => {
    if (!bankCode || !accountNumber || accountNumber.length < 10) {
      setError('Please enter a valid bank and account number');
      return;
    }

    setVerifyingAccount(true);
    setError('');
    setAccountVerified(false);
    setAccountName('');

    try {
      if (isNigeria) {
        // Verify with Paystack
        const { data, error: fnError } = await supabase.functions.invoke('verify-bank-account', {
          body: { bankCode, accountNumber, provider: 'paystack' }
        });

        if (fnError || !data?.success) {
          throw new Error(data?.error || 'Failed to verify account');
        }

        setAccountName(data.accountName);
        setAccountVerified(true);
      } else {
        // For Ghana, Kenya, South Africa - skip verification (Flutterwave doesn't have easy verification)
        setAccountVerified(true);
        setAccountName(businessName);
      }
    } catch (err) {
      console.error('Verification error:', err);
      setError(err.message || 'Failed to verify bank account');
    } finally {
      setVerifyingAccount(false);
    }
  };

  // Create subaccount
  const createSubaccount = async () => {
    if (!accountVerified && isNigeria) {
      setError('Please verify your bank account first');
      return;
    }

    setConnecting(true);
    setError('');

    try {
      const endpoint = isNigeria ? 'create-paystack-subaccount' : 'create-flutterwave-subaccount';
      
      const { data, error: fnError } = await supabase.functions.invoke(endpoint, {
        body: {
          organizerId: organizer.id,
          bankCode,
          accountNumber,
          businessName: businessName || organizer.business_name,
        }
      });

      if (fnError || !data?.success) {
        throw new Error(data?.error || 'Failed to create subaccount');
      }

      setSuccess(`${provider} subaccount created successfully! You can now receive direct payments.`);
      setShowSetupModal(false);
      refreshOrganizer?.();
    } catch (err) {
      console.error('Subaccount error:', err);
      setError(err.message || 'Failed to create subaccount');
    } finally {
      setConnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" />
      </div>
    );
  }

  // Feature disabled for this organizer by admin
  if (organizer?.feature_direct_payment_enabled === false) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Direct Payments</h1>
            <p className="text-muted-foreground">Receive payments directly to your bank account</p>
          </div>
        </div>

        <Card className="border-red-200 bg-red-50 rounded-xl">
          <CardContent className="p-8 text-center">
            <Lock className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">Direct Payments Disabled</h2>
            <p className="text-muted-foreground max-w-md mx-auto mb-4">
              Direct payments have been disabled for your account. Your event earnings will be processed through our standard escrow payout system.
            </p>
            <p className="text-sm text-muted-foreground">
              If you believe this is an error, please contact support.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isEligible) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Direct Payments</h1>
            <p className="text-muted-foreground">Receive payments directly to your bank account</p>
          </div>
        </div>

        <Card className="border-border/10 rounded-xl">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">Not Available in Your Region</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Direct payments via Paystack/Flutterwave are currently only available for organizers in Nigeria, Ghana, Kenya, and South Africa.
              Your region uses our standard payout system.
            </p>
            <Button onClick={() => navigate('/organizer/finance')} className="mt-6">
              View Payout Options
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Direct payout gating - check if organizer has completed enough events
  const completedEvents = organizer?.completed_events_count || 0;
  const requiredEvents = organizer?.required_events_for_payout || 5;
  const isPayoutEligible = organizer?.direct_payout_eligible || organizer?.direct_payout_override;
  const eventsRemaining = Math.max(0, requiredEvents - completedEvents);

  if (!isPayoutEligible && !isConnected) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{provider} Direct Payments</h1>
            <p className="text-muted-foreground">Receive payments directly to your bank account</p>
          </div>
        </div>

        {/* Locked State Card */}
        <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-white rounded-xl">
          <CardContent className="pt-6">
            <div className="text-center py-6">
              <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Lock className="w-10 h-10 text-amber-600" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">Unlock Direct Payouts</h3>
              <p className="text-muted-foreground max-w-md mx-auto mb-6">
                Complete {requiredEvents} successful events to unlock {provider} direct payments and receive money directly to your bank account.
              </p>

              {/* Progress Bar */}
              <div className="max-w-xs mx-auto mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-semibold text-foreground">{completedEvents}/{requiredEvents} events</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, (completedEvents / requiredEvents) * 100)}%` }}
                  />
                </div>
              </div>

              {eventsRemaining > 0 ? (
                <p className="text-sm text-amber-700 font-medium">
                  {eventsRemaining} more event{eventsRemaining !== 1 ? 's' : ''} to go!
                </p>
              ) : (
                <p className="text-sm text-green-600 font-medium">
                  Almost there! Your eligibility is being verified.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Why This Requirement */}
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-[#00C3F7]" />
              Why We Require Completed Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Shield className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-foreground">Trust & Security</h4>
                  <p className="text-sm text-muted-foreground">
                    Protects attendees and ensures quality events
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Trophy className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-foreground">Proven Track Record</h4>
                  <p className="text-sm text-muted-foreground">
                    Shows you're a reliable event organizer
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-foreground">Faster Settlements</h4>
                  <p className="text-sm text-muted-foreground">
                    {isNigeria ? 'Next-day' : 'T+1 to T+2'} direct deposits once unlocked
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Wallet className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-foreground">Full Transparency</h4>
                  <p className="text-sm text-muted-foreground">
                    See exactly what you earn from each sale
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>In the meantime:</strong> Your event earnings are safely held and will be paid out by our finance team after each event ends. You can track your earnings in the Finance section.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Benefits Preview */}
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle>What You'll Get with {provider} Direct Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 opacity-60">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">Direct Bank Deposits</p>
                  <p className="text-sm text-muted-foreground">
                    Money goes straight to your bank account
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">Faster Settlements</p>
                  <p className="text-sm text-muted-foreground">
                    {isNigeria ? 'Next-day' : 'T+1 to T+2'} settlement to your bank
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">Transparent Fees</p>
                  <p className="text-sm text-muted-foreground">
                    Know exactly what you earn from each sale
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">No Manual Payouts</p>
                  <p className="text-sm text-muted-foreground">
                    No need to request payouts - it's automatic
                  </p>
                </div>
              </div>
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
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            {provider} Direct Payments
            <StatusBadge status={currentStatus} />
          </h1>
          <p className="text-muted-foreground">
            Receive payments directly to your bank account with {provider}
          </p>
        </div>
        <HelpTip content={`${provider} Direct Payments allows attendee payments to go directly to your bank account, minus the platform fee. This is faster and more transparent than waiting for manual payouts.`} />
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
          <p className="text-green-800">{success}</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Connected State */}
      {isConnected ? (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Status Card */}
          <Card className="border-green-200 bg-green-50/50 rounded-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-800">
                <CheckCircle className="w-5 h-5" />
                Connected to {provider}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-green-200/50">
                <span className="text-green-700">Status</span>
                <StatusBadge status="active" />
              </div>
              <div className="flex items-center justify-between py-2 border-b border-green-200/50">
                <span className="text-green-700">Subaccount ID</span>
                <span className="font-mono text-sm text-green-800">{subaccountId?.slice(0, 15)}...</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-green-700">Direct Payouts</span>
                <Badge className="bg-green-100 text-green-700">Enabled</Badge>
              </div>
            </CardContent>
          </Card>

          {/* How It Works */}
          <Card className="border-border/10 rounded-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-[#00C3F7]" />
                How It Works
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-[#00C3F7]/10 flex items-center justify-center flex-shrink-0">
                  <CreditCard className="w-4 h-4 text-[#00C3F7]" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Attendee Pays</p>
                  <p className="text-sm text-muted-foreground">Payment processed securely via {provider}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-[#00C3F7]/10 flex items-center justify-center flex-shrink-0">
                  <ArrowRight className="w-4 h-4 text-[#00C3F7]" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Automatic Split</p>
                  <p className="text-sm text-muted-foreground">Platform fee deducted automatically</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <Banknote className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-green-600">You Get Paid!</p>
                  <p className="text-sm text-muted-foreground">Money goes directly to your bank</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Fee Breakdown */}
          <Card className="border-border/10 rounded-xl md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-600" />
                Example Fee Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-green-50 rounded-xl p-4">
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between">
                    <span>Ticket Price</span>
                    <span className="font-medium">{currency}10,000</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Payment Processing (~1.5%)</span>
                    <span>-{currency}150</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Platform Fee (~5%)</span>
                    <span>-{currency}500</span>
                  </div>
                  <div className="border-t border-green-200 pt-2 mt-2 flex justify-between">
                    <span className="font-semibold">You Receive</span>
                    <span className="font-bold text-green-600 text-lg">{currency}9,350</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        /* Not Connected State */
        <div className="grid gap-6 md:grid-cols-2">
          {/* Benefits Card */}
          <Card className="border-border/10 rounded-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-[#00C3F7]" />
                Why Connect {provider}?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">Direct Bank Deposits</p>
                  <p className="text-sm text-muted-foreground">
                    Money goes straight to your bank account
                  </p>
                </div>
              </div>
                <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">Faster Settlements</p>
                  <p className="text-sm text-muted-foreground">
                    {isNigeria ? 'Next-day' : 'T+1 to T+2'} settlement to your bank
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">Transparent Fees</p>
                  <p className="text-sm text-muted-foreground">
                    Know exactly what you earn from each sale
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">No Manual Payouts</p>
                  <p className="text-sm text-muted-foreground">
                    No need to request payouts - it's automatic
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Setup Card */}
          <Card className="border-[#00C3F7]/30 bg-gradient-to-br from-[#00C3F7]/5 to-white rounded-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#00C3F7]">
                <Building2 className="w-5 h-5" />
                Get Started
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Connect your bank account to start receiving direct payments. 
                Setup takes less than 2 minutes.
              </p>
              
              <div className="bg-card border border-border/10 rounded-xl p-4">
                <h4 className="font-medium text-foreground mb-2">You'll need:</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Your bank account number
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Your bank name
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Business name (optional)
                  </li>
                </ul>
              </div>

              <Button 
                onClick={() => setShowSetupModal(true)}
                className="w-full bg-[#00C3F7] hover:bg-[#0BA4DB] text-white py-6"
              >
                <CreditCard className="w-4 h-4 mr-2" />
                Connect {provider}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Setup Modal */}
      <Dialog open={showSetupModal} onOpenChange={setShowSetupModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[#00C3F7]" />
              Connect Your Bank Account
            </DialogTitle>
            <DialogDescription>
              Enter your bank details to receive direct payments via {provider}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label>Business Name</Label>
              <Input
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Your business name"
              />
            </div>

            <div className="space-y-2">
              <Label>Bank</Label>
              <Select value={bankCode} onValueChange={setBankCode}>
                <SelectTrigger>
                  <SelectValue placeholder="Select your bank" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {banks.map((bank) => (
                    <SelectItem key={bank.code} value={bank.code}>
                      {bank.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Account Number</Label>
              <div className="flex gap-2">
                <Input
                  value={accountNumber}
                  onChange={(e) => {
                    setAccountNumber(e.target.value.replace(/\D/g, ''));
                    setAccountVerified(false);
                  }}
                  placeholder="0000000000"
                  maxLength={10}
                  className="flex-1"
                />
                {isNigeria && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={verifyBankAccount}
                    disabled={verifyingAccount || !bankCode || accountNumber.length < 10}
                  >
                    {verifyingAccount ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      'Verify'
                    )}
                  </Button>
                )}
              </div>
            </div>

            {accountVerified && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-800">Account Verified</p>
                  <p className="text-sm text-green-700">{accountName}</p>
                </div>
              </div>
            )}

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              <strong>Note:</strong> A small platform fee (~5%) will be automatically deducted from each transaction. The rest goes directly to your bank.
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSetupModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={createSubaccount}
              disabled={connecting || (!accountVerified && isNigeria) || !bankCode || accountNumber.length < 10}
              className="bg-[#00C3F7] hover:bg-[#0BA4DB]"
            >
              {connecting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4 mr-2" />
                  Connect {provider}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
