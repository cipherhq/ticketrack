import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Coins, CreditCard, TrendingUp, TrendingDown, Clock, CheckCircle,
  AlertCircle, Loader2, Plus, Minus, Mail, Phone, MessageSquare,
  Send, History, Package, Sparkles, Zap, ChevronRight, RefreshCw,
  Download, Filter, Calendar, ArrowUpRight, ArrowDownRight, Info
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { useOrganizer } from '@/contexts/OrganizerContext';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';

// Channel icons and colors
const CHANNEL_CONFIG = {
  email: { icon: Mail, color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'Email' },
  sms: { icon: Phone, color: 'text-green-600', bgColor: 'bg-green-100', label: 'SMS' },
  sms_dnd: { icon: Phone, color: 'text-orange-600', bgColor: 'bg-orange-100', label: 'SMS (DND)' },
  whatsapp_marketing: { icon: MessageSquare, color: 'text-emerald-600', bgColor: 'bg-emerald-100', label: 'WhatsApp Marketing' },
  whatsapp_utility: { icon: MessageSquare, color: 'text-teal-600', bgColor: 'bg-teal-100', label: 'WhatsApp Utility' },
  telegram: { icon: Send, color: 'text-sky-600', bgColor: 'bg-sky-100', label: 'Telegram' },
  push: { icon: Zap, color: 'text-purple-600', bgColor: 'bg-purple-100', label: 'Push' },
};

export function CommunicationCredits() {
  const navigate = useNavigate();
  const { organizer } = useOrganizer();

  // State
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(null);
  const [packages, setPackages] = useState([]);
  const [channelPricing, setChannelPricing] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [expiry, setExpiry] = useState([]);

  // Purchase flow
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [customAmount, setCustomAmount] = useState('');
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false);
  const [purchasing, setPurchasing] = useState(false);

  // Filters
  const [transactionFilter, setTransactionFilter] = useState('all');

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  useEffect(() => {
    if (organizer?.id) {
      loadData();
      handlePaymentCallback();
    }
  }, [organizer?.id]);

  // Handle payment success callback from Paystack
  const handlePaymentCallback = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment');
    const reference = urlParams.get('reference') || urlParams.get('trxref');

    if (paymentStatus === 'success' && reference && organizer?.id) {
      // Clear URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);

      try {
        // Verify the payment and add credits
        const { data, error } = await supabase.functions.invoke('verify-credit-purchase', {
          body: {
            reference,
            organizerId: organizer.id,
          },
        });

        if (error) {
          console.error('Verification error:', error);
          // Still reload data - webhook might have already processed it
        }

        // Reload data to get updated balance
        await loadData();

        if (data?.success) {
          alert(`✅ ${data.credits} credits added to your account!`);
        }
      } catch (error) {
        console.error('Payment verification failed:', error);
        // Reload anyway - webhook might have already processed it
        await loadData();
      }
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadBalance(),
        loadPackages(),
        loadChannelPricing(),
        loadTransactions(),
        loadExpiry(),
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadBalance = async () => {
    const { data, error } = await supabase
      .from('communication_credit_balances')
      .select('*')
      .eq('organizer_id', organizer.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error loading balance:', error);
    }

    setBalance(data || {
      balance: 0,
      bonus_balance: 0,
      lifetime_purchased: 0,
      lifetime_used: 0,
      email_credits_used: 0,
      sms_credits_used: 0,
      whatsapp_credits_used: 0,
    });
  };

  const loadPackages = async () => {
    const { data } = await supabase
      .from('communication_credit_packages')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');

    setPackages(data || []);
  };

  const loadChannelPricing = async () => {
    const { data } = await supabase
      .from('communication_channel_pricing')
      .select('*')
      .eq('is_active', true)
      .order('credits_per_message');

    setChannelPricing(data || []);
  };

  const loadTransactions = async () => {
    const { data } = await supabase
      .from('communication_credit_transactions')
      .select('*')
      .eq('organizer_id', organizer.id)
      .order('created_at', { ascending: false })
      .limit(50);

    setTransactions(data || []);
  };

  const loadExpiry = async () => {
    const { data } = await supabase
      .from('communication_credit_expiry')
      .select('*')
      .eq('organizer_id', organizer.id)
      .eq('expired', false)
      .gt('remaining_amount', 0)
      .order('expires_at')
      .limit(10);

    setExpiry(data || []);
  };

  // ============================================================================
  // PURCHASE FLOW
  // ============================================================================

  const initiatePayment = async (pkg) => {
    setSelectedPackage(pkg);
    setShowPurchaseDialog(true);
  };

  const processPayment = async () => {
    if (!selectedPackage) return;

    setPurchasing(true);
    try {
      // Initialize Paystack payment
      const { data, error } = await supabase.functions.invoke('create-credit-purchase', {
        body: {
          organizerId: organizer.id,
          packageId: selectedPackage.id,
          credits: selectedPackage.credits,
          bonusCredits: selectedPackage.bonus_credits,
          amount: selectedPackage.price_ngn,
          currency: 'NGN',
          email: organizer.business_email || organizer.email,
          callbackUrl: `${window.location.origin}/organizer/credits?payment=success`,
        },
      });

      if (error) throw error;

      // Redirect to payment page
      if (data?.authorization_url) {
        window.location.href = data.authorization_url;
      } else if (data?.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else {
        // If payment was processed directly (e.g., test mode)
        await loadData();
        setShowPurchaseDialog(false);
        alert('Credits added successfully!');
      }
    } catch (error) {
      console.error('Payment error:', error);
      alert('Failed to initiate payment: ' + error.message);
    } finally {
      setPurchasing(false);
    }
  };

  // ============================================================================
  // HELPERS
  // ============================================================================

  const totalBalance = (balance?.balance || 0) + (balance?.bonus_balance || 0);

  const formatCredits = (amount) => {
    return new Intl.NumberFormat('en-NG').format(amount || 0);
  };

  const formatCurrency = (amount, currency = 'NGN') => {
    if (currency === 'NGN') {
      return `₦${new Intl.NumberFormat('en-NG').format(amount || 0)}`;
    }
    return `$${new Intl.NumberFormat('en-US').format(amount || 0)}`;
  };

  const getTransactionIcon = (type) => {
    switch (type) {
      case 'purchase': return <ArrowUpRight className="w-4 h-4 text-green-600" />;
      case 'usage': return <ArrowDownRight className="w-4 h-4 text-red-600" />;
      case 'bonus': return <Sparkles className="w-4 h-4 text-purple-600" />;
      case 'refund': return <RefreshCw className="w-4 h-4 text-blue-600" />;
      case 'expiry': return <Clock className="w-4 h-4 text-orange-600" />;
      default: return <Coins className="w-4 h-4 text-gray-600" />;
    }
  };

  const filteredTransactions = transactions.filter(t => {
    if (transactionFilter === 'all') return true;
    return t.type === transactionFilter;
  });

  // ============================================================================
  // RENDER
  // ============================================================================

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
          <h1 className="text-2xl font-bold text-[#0F0F0F]">Message Credits</h1>
          <p className="text-[#0F0F0F]/60">Purchase credits to send SMS, WhatsApp, and email campaigns</p>
        </div>
        <Button onClick={() => navigate('/organizer/hub')} variant="outline">
          <Send className="w-4 h-4 mr-2" />
          Communication Hub
        </Button>
      </div>

      {/* Balance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-[#0F0F0F]/10 rounded-xl bg-gradient-to-br from-[#2969FF] to-[#1E4FCC] text-white col-span-1 md:col-span-2">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                <Coins className="w-6 h-6" />
              </div>
              {balance?.bonus_balance > 0 && (
                <Badge className="bg-white/20 text-white">
                  <Sparkles className="w-3 h-3 mr-1" />
                  {formatCredits(balance.bonus_balance)} bonus
                </Badge>
              )}
            </div>
            <p className="text-white/70 text-sm">Total Credit Balance</p>
            <p className="text-4xl font-bold">{formatCredits(totalBalance)}</p>
            <p className="text-white/70 text-sm mt-1">
              {formatCredits(balance?.balance || 0)} standard + {formatCredits(balance?.bonus_balance || 0)} bonus
            </p>
          </CardContent>
        </Card>

        <Card className="border-[#0F0F0F]/10 rounded-xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
            </div>
            <p className="text-[#0F0F0F]/60 text-sm">Lifetime Purchased</p>
            <p className="text-2xl font-bold">{formatCredits(balance?.lifetime_purchased || 0)}</p>
          </CardContent>
        </Card>

        <Card className="border-[#0F0F0F]/10 rounded-xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                <TrendingDown className="w-5 h-5 text-red-600" />
              </div>
            </div>
            <p className="text-[#0F0F0F]/60 text-sm">Lifetime Used</p>
            <p className="text-2xl font-bold">{formatCredits(balance?.lifetime_used || 0)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Credits Never Expire Notice */}
      <Card className="border-green-200 bg-green-50 rounded-xl">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <div>
              <p className="font-medium text-green-800">Credits Never Expire</p>
              <p className="text-sm text-green-600">
                Your message credits are permanent and can be used anytime
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <Tabs defaultValue="packages">
        <TabsList>
          <TabsTrigger value="packages">Buy Credits</TabsTrigger>
          <TabsTrigger value="pricing">Channel Pricing</TabsTrigger>
          <TabsTrigger value="history">Transaction History</TabsTrigger>
        </TabsList>

        {/* Packages Tab */}
        <TabsContent value="packages" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {packages.map((pkg) => (
              <Card
                key={pkg.id}
                className={`border-2 rounded-xl transition-all cursor-pointer hover:shadow-lg ${
                  pkg.is_popular ? 'border-[#2969FF] ring-2 ring-[#2969FF]/20' : 'border-[#0F0F0F]/10'
                }`}
                onClick={() => initiatePayment(pkg)}
              >
                <CardContent className="p-5">
                  {pkg.badge_text && (
                    <Badge className={`mb-3 ${pkg.is_popular ? 'bg-[#2969FF]' : 'bg-gray-600'}`}>
                      {pkg.badge_text}
                    </Badge>
                  )}
                  
                  <h3 className="text-lg font-bold mb-1">{pkg.name}</h3>
                  <p className="text-sm text-[#0F0F0F]/60 mb-4">{pkg.description}</p>
                  
                  <div className="mb-4">
                    <p className="text-3xl font-bold text-[#2969FF]">
                      {formatCredits(pkg.credits + pkg.bonus_credits)}
                    </p>
                    <p className="text-sm text-[#0F0F0F]/60">credits</p>
                  </div>
                  
                  {pkg.bonus_credits > 0 && (
                    <div className="flex items-center gap-1 text-sm text-green-600 mb-3">
                      <Sparkles className="w-4 h-4" />
                      <span>+{formatCredits(pkg.bonus_credits)} bonus</span>
                    </div>
                  )}
                  
                  <div className="border-t border-[#0F0F0F]/10 pt-4">
                    <p className="text-2xl font-bold">{formatCurrency(pkg.price_ngn)}</p>
                    <p className="text-xs text-[#0F0F0F]/40">
                      {formatCurrency(pkg.price_per_credit)}/credit
                    </p>
                  </div>
                  
                  <Button className="w-full mt-4 bg-[#2969FF] text-white">
                    Buy Now
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="border-[#0F0F0F]/10 rounded-xl">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Info className="w-5 h-5 text-[#0F0F0F]/40" />
                <h3 className="font-medium">Credit Policy</h3>
              </div>
              <ul className="text-sm text-[#0F0F0F]/60 space-y-2">
                <li>• Standard credits expire 12 months after purchase</li>
                <li>• Bonus credits expire 6 months after purchase</li>
                <li>• Bonus credits are used first when sending messages</li>
                <li>• Credits are non-refundable once purchased</li>
                <li>• 1 credit = ₦1 value</li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Channel Pricing Tab */}
        <TabsContent value="pricing" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {channelPricing.map((channel) => {
              const config = CHANNEL_CONFIG[channel.channel] || CHANNEL_CONFIG.email;
              return (
                <Card key={channel.id} className="border-[#0F0F0F]/10 rounded-xl">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`w-12 h-12 rounded-xl ${config.bgColor} flex items-center justify-center`}>
                        <config.icon className={`w-6 h-6 ${config.color}`} />
                      </div>
                      <div>
                        <h3 className="font-semibold">{channel.display_name}</h3>
                        <p className="text-sm text-[#0F0F0F]/60">{channel.description}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-3xl font-bold text-[#2969FF]">
                          {channel.credits_per_message === 0 ? 'FREE' : channel.credits_per_message}
                        </p>
                        {channel.credits_per_message > 0 && (
                          <p className="text-sm text-[#0F0F0F]/60">credits/message</p>
                        )}
                      </div>
                      {channel.credits_per_message > 0 && (
                        <p className="text-sm text-[#0F0F0F]/40">
                          ≈ {formatCurrency(channel.credits_per_message)}
                        </p>
                      )}
                    </div>

                    {/* Estimate how many messages with current balance */}
                    {totalBalance > 0 && channel.credits_per_message > 0 && (
                      <div className="mt-4 pt-4 border-t border-[#0F0F0F]/10">
                        <p className="text-sm text-[#0F0F0F]/60">
                          You can send <span className="font-semibold text-[#0F0F0F]">
                            {formatCredits(Math.floor(totalBalance / channel.credits_per_message))}
                          </span> messages
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Usage by Channel */}
          <Card className="border-[#0F0F0F]/10 rounded-xl">
            <CardHeader>
              <CardTitle className="text-lg">Your Usage by Channel</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-blue-50 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <Mail className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-800">Email</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-600">
                    {formatCredits(balance?.email_credits_used || 0)}
                  </p>
                  <p className="text-xs text-blue-600/60">credits used</p>
                </div>

                <div className="p-4 bg-green-50 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <Phone className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium text-green-800">SMS</span>
                  </div>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCredits(balance?.sms_credits_used || 0)}
                  </p>
                  <p className="text-xs text-green-600/60">credits used</p>
                </div>

                <div className="p-4 bg-emerald-50 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare className="w-4 h-4 text-emerald-600" />
                    <span className="text-sm font-medium text-emerald-800">WhatsApp</span>
                  </div>
                  <p className="text-2xl font-bold text-emerald-600">
                    {formatCredits(balance?.whatsapp_credits_used || 0)}
                  </p>
                  <p className="text-xs text-emerald-600/60">credits used</p>
                </div>

                <div className="p-4 bg-sky-50 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <Send className="w-4 h-4 text-sky-600" />
                    <span className="text-sm font-medium text-sky-800">Telegram</span>
                  </div>
                  <p className="text-2xl font-bold text-sky-600">
                    {formatCredits(balance?.telegram_credits_used || 0)}
                  </p>
                  <p className="text-xs text-sky-600/60">credits used</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <Select value={transactionFilter} onValueChange={setTransactionFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Transactions</SelectItem>
                <SelectItem value="purchase">Purchases</SelectItem>
                <SelectItem value="usage">Usage</SelectItem>
                <SelectItem value="bonus">Bonuses</SelectItem>
                <SelectItem value="refund">Refunds</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={loadTransactions}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>

          <Card className="border-[#0F0F0F]/10 rounded-xl">
            <CardContent className="p-0">
              {filteredTransactions.length === 0 ? (
                <div className="text-center py-12">
                  <History className="w-12 h-12 text-[#0F0F0F]/20 mx-auto mb-4" />
                  <p className="text-[#0F0F0F]/60">No transactions yet</p>
                </div>
              ) : (
                <div className="divide-y divide-[#0F0F0F]/5">
                  {filteredTransactions.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between p-4 hover:bg-[#F4F6FA]/50">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-[#F4F6FA] flex items-center justify-center">
                          {getTransactionIcon(tx.type)}
                        </div>
                        <div>
                          <p className="font-medium text-[#0F0F0F]">
                            {tx.description || tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}
                          </p>
                          <div className="flex items-center gap-2 text-sm text-[#0F0F0F]/60">
                            <span>{format(new Date(tx.created_at), 'MMM d, yyyy h:mm a')}</span>
                            {tx.channel && (
                              <>
                                <span>•</span>
                                <span className="capitalize">{tx.channel.replace('_', ' ')}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold ${tx.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {tx.amount > 0 ? '+' : ''}{formatCredits(tx.amount)}
                        </p>
                        <p className="text-xs text-[#0F0F0F]/40">
                          Balance: {formatCredits(tx.balance_after)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Purchase Confirmation Dialog */}
      <Dialog open={showPurchaseDialog} onOpenChange={setShowPurchaseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Purchase</DialogTitle>
            <DialogDescription>
              You're about to purchase the {selectedPackage?.name} package
            </DialogDescription>
          </DialogHeader>

          {selectedPackage && (
            <div className="py-4 space-y-4">
              <div className="p-4 bg-[#F4F6FA] rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[#0F0F0F]/60">Credits</span>
                  <span className="font-semibold">{formatCredits(selectedPackage.credits)}</span>
                </div>
                {selectedPackage.bonus_credits > 0 && (
                  <div className="flex items-center justify-between mb-2 text-green-600">
                    <span className="flex items-center gap-1">
                      <Sparkles className="w-4 h-4" />
                      Bonus Credits
                    </span>
                    <span className="font-semibold">+{formatCredits(selectedPackage.bonus_credits)}</span>
                  </div>
                )}
                <div className="border-t border-[#0F0F0F]/10 pt-2 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Total Credits</span>
                    <span className="font-bold text-[#2969FF]">
                      {formatCredits(selectedPackage.credits + selectedPackage.bonus_credits)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-[#2969FF]/5 rounded-xl border border-[#2969FF]/20">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#0F0F0F]">Amount to Pay</span>
                  <span className="text-2xl font-bold text-[#2969FF]">
                    {formatCurrency(selectedPackage.price_ngn)}
                  </span>
                </div>
              </div>

              <p className="text-xs text-[#0F0F0F]/40 text-center">
                You'll be redirected to Paystack to complete payment
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPurchaseDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={processPayment}
              disabled={purchasing}
              className="bg-[#2969FF] text-white"
            >
              {purchasing ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <CreditCard className="w-4 h-4 mr-2" />
              )}
              Pay {formatCurrency(selectedPackage?.price_ngn)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default CommunicationCredits;
