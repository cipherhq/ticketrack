import { useState, useEffect } from 'react';
import {
  Smartphone,
  Loader2,
  CheckCircle,
  Wallet,
  CreditCard,
  TrendingUp,
  Gift,
  Star,
  History,
  ArrowRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { formatPrice, getDefaultCurrency } from '@/config/currencies';

export function BuySMSCredits() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [organizer, setOrganizer] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [packages, setPackages] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [activeTab, setActiveTab] = useState('buy');

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Get organizer
      const { data: org } = await supabase
        .from('organizers')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      setOrganizer(org);

      if (org) {
        // Get or create wallet
        let { data: walletData } = await supabase
          .from('organizer_sms_wallet')
          .select('*')
          .eq('organizer_id', org.id)
          .single();

        if (!walletData) {
          const { data: newWallet } = await supabase
            .from('organizer_sms_wallet')
            .insert({ organizer_id: org.id })
            .select()
            .single();
          walletData = newWallet;
        }

        setWallet(walletData);

        // Get purchase history
        const { data: purchaseData } = await supabase
          .from('sms_credit_purchases')
          .select('*, sms_credit_packages(name)')
          .eq('organizer_id', org.id)
          .order('created_at', { ascending: false })
          .limit(20);
        
        setPurchases(purchaseData || []);
      }

      // Get packages
      const { data: pkgData } = await supabase
        .from('sms_credit_packages')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      
      setPackages(pkgData || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (pkg) => {
    if (!organizer) return;
    
    setSelectedPackage(pkg);
    setProcessing(true);

    try {
      // Create purchase record
      const { data: purchase, error: purchaseError } = await supabase
        .from('sms_credit_purchases')
        .insert({
          organizer_id: organizer.id,
          package_id: pkg.id,
          credits_purchased: pkg.credits,
          bonus_credits: pkg.bonus_credits,
          amount_paid: pkg.price,
          payment_status: 'pending',
        })
        .select()
        .single();

      if (purchaseError) throw purchaseError;

      // Determine currency from package or organizer's country
      const currency = pkg.currency || getDefaultCurrency(organizer.country_code);

      // Initialize Paystack (supports NGN, GHS only)
      const handler = window.PaystackPop.setup({
        key: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY,
        email: organizer.email || organizer.business_email,
        amount: pkg.price * 100, // Paystack uses kobo/pesewas
        currency: currency,
        ref: `SMS-${purchase.id.split('-')[0]}-${Date.now()}`,
        metadata: {
          purchase_id: purchase.id,
          organizer_id: organizer.id,
          package_id: pkg.id,
          credits: pkg.credits + pkg.bonus_credits,
          type: 'sms_credits',
        },
        callback: async (response) => {
          // Payment successful
          await handlePaymentSuccess(purchase.id, response.reference, pkg);
        },
        onClose: () => {
          setProcessing(false);
          setSelectedPackage(null);
        },
      });

      handler.openIframe();
    } catch (error) {
      console.error('Error initiating purchase:', error);
      alert('Failed to initiate purchase');
      setProcessing(false);
      setSelectedPackage(null);
    }
  };

  const handlePaymentSuccess = async (purchaseId, reference, pkg) => {
    try {
      // Update purchase record
      await supabase
        .from('sms_credit_purchases')
        .update({
          payment_status: 'completed',
          payment_reference: reference,
          payment_channel: 'paystack',
        })
        .eq('id', purchaseId);

      // Update wallet
      const totalCredits = pkg.credits + pkg.bonus_credits;
      
      await supabase
        .from('organizer_sms_wallet')
        .update({
          sms_balance: (wallet?.sms_balance || 0) + totalCredits,
          total_purchased: (wallet?.total_purchased || 0) + totalCredits,
          total_spent: (wallet?.total_spent || 0) + pkg.price,
          last_purchase_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('organizer_id', organizer.id);

      // Reload data
      await loadData();
      
      alert(`Success! ${totalCredits} SMS credits added to your account.`);
    } catch (error) {
      console.error('Error processing payment:', error);
      alert('Payment received but failed to add credits. Please contact support.');
    } finally {
      setProcessing(false);
      setSelectedPackage(null);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount || 0);
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
      <div>
        <h2 className="text-2xl font-semibold text-[#0F0F0F]">SMS Credits</h2>
        <p className="text-[#0F0F0F]/60 mt-1">Purchase credits to send SMS to your attendees</p>
      </div>

      {/* Wallet Balance */}
      <Card className="border-[#0F0F0F]/10 rounded-2xl bg-gradient-to-r from-[#2969FF] to-[#1e4fd6]">
        <CardContent className="p-6">
          <div className="flex items-center justify-between text-white">
            <div>
              <p className="text-white/80 text-sm">Your SMS Balance</p>
              <p className="text-4xl font-bold mt-1">{(wallet?.sms_balance || 0).toLocaleString()}</p>
              <p className="text-white/80 text-sm mt-1">credits available</p>
            </div>
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
              <Wallet className="w-8 h-8 text-white" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-white/20">
            <div>
              <p className="text-white/60 text-xs">Total Purchased</p>
              <p className="text-white font-semibold">{(wallet?.total_purchased || 0).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-white/60 text-xs">Total Used</p>
              <p className="text-white font-semibold">{(wallet?.total_used || 0).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-white/60 text-xs">Total Spent</p>
              <p className="text-white font-semibold">{formatCurrency(wallet?.total_spent)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-[#F4F6FA] rounded-xl">
          <TabsTrigger value="buy" className="rounded-lg">
            <CreditCard className="w-4 h-4 mr-2" />
            Buy Credits
          </TabsTrigger>
          <TabsTrigger value="history" className="rounded-lg">
            <History className="w-4 h-4 mr-2" />
            Purchase History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="buy" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {packages.map((pkg) => (
              <Card
                key={pkg.id}
                className={`border-2 rounded-2xl transition-all cursor-pointer hover:shadow-lg ${
                  pkg.is_popular ? 'border-[#2969FF] bg-blue-50/50' : 'border-[#0F0F0F]/10'
                } ${selectedPackage?.id === pkg.id ? 'ring-2 ring-[#2969FF]' : ''}`}
              >
                {pkg.is_popular && (
                  <div className="bg-[#2969FF] text-white text-xs font-medium px-3 py-1 rounded-t-xl text-center">
                    <Star className="w-3 h-3 inline mr-1" />
                    MOST POPULAR
                  </div>
                )}
                <CardContent className={`p-6 ${pkg.is_popular ? '' : 'pt-6'}`}>
                  <div className="text-center">
                    <h3 className="text-lg font-semibold text-[#0F0F0F]">{pkg.name}</h3>
                    <div className="mt-4">
                      <span className="text-3xl font-bold text-[#0F0F0F]">{pkg.credits.toLocaleString()}</span>
                      <span className="text-[#0F0F0F]/60 ml-1">SMS</span>
                    </div>
                    {pkg.bonus_credits > 0 && (
                      <div className="mt-2 flex items-center justify-center gap-1 text-green-600">
                        <Gift className="w-4 h-4" />
                        <span className="text-sm font-medium">+{pkg.bonus_credits} bonus</span>
                      </div>
                    )}
                    <div className="mt-4">
                      <span className="text-2xl font-bold text-[#2969FF]">{formatCurrency(pkg.price)}</span>
                    </div>
                    <p className="text-sm text-[#0F0F0F]/60 mt-1">
                      {formatCurrency(pkg.price / (pkg.credits + pkg.bonus_credits))} per SMS
                    </p>
                  </div>
                  <Button
                    onClick={() => handlePurchase(pkg)}
                    disabled={processing}
                    className={`w-full mt-6 rounded-xl ${
                      pkg.is_popular
                        ? 'bg-[#2969FF] hover:bg-[#2969FF]/90 text-white'
                        : 'bg-[#0F0F0F] hover:bg-[#0F0F0F]/90 text-white'
                    }`}
                  >
                    {processing && selectedPackage?.id === pkg.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        Buy Now <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="border-[#0F0F0F]/10 rounded-2xl mt-6">
            <CardContent className="p-6">
              <h3 className="font-semibold text-[#0F0F0F] mb-4">How It Works</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-[#2969FF]/10 rounded-lg flex items-center justify-center text-[#2969FF] font-semibold">1</div>
                  <div>
                    <p className="font-medium text-[#0F0F0F]">Buy Credits</p>
                    <p className="text-sm text-[#0F0F0F]/60">Choose a package and pay securely via Paystack</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-[#2969FF]/10 rounded-lg flex items-center justify-center text-[#2969FF] font-semibold">2</div>
                  <div>
                    <p className="font-medium text-[#0F0F0F]">Send SMS</p>
                    <p className="text-sm text-[#0F0F0F]/60">Go to Communications and send SMS to attendees</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-[#2969FF]/10 rounded-lg flex items-center justify-center text-[#2969FF] font-semibold">3</div>
                  <div>
                    <p className="font-medium text-[#0F0F0F]">Auto-Deduct</p>
                    <p className="text-sm text-[#0F0F0F]/60">Credits are automatically deducted per SMS sent</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <Card className="border-[#0F0F0F]/10 rounded-2xl">
            <CardHeader>
              <CardTitle>Purchase History</CardTitle>
            </CardHeader>
            <CardContent>
              {purchases.length === 0 ? (
                <p className="text-center text-[#0F0F0F]/60 py-8">No purchases yet</p>
              ) : (
                <div className="space-y-3">
                  {purchases.map((purchase) => (
                    <div
                      key={purchase.id}
                      className="flex items-center justify-between p-4 bg-[#F4F6FA] rounded-xl"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          purchase.payment_status === 'completed' ? 'bg-green-100' : 'bg-yellow-100'
                        }`}>
                          {purchase.payment_status === 'completed' ? (
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          ) : (
                            <Loader2 className="w-5 h-5 text-yellow-600" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-[#0F0F0F]">
                            {purchase.sms_credit_packages?.name || 'SMS Credits'}
                          </p>
                          <p className="text-sm text-[#0F0F0F]/60">
                            {purchase.credits_purchased + purchase.bonus_credits} credits • {new Date(purchase.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-[#0F0F0F]">{formatCurrency(purchase.amount_paid)}</p>
                        <Badge className={
                          purchase.payment_status === 'completed' ? 'bg-green-100 text-green-700' :
                          purchase.payment_status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }>
                          {purchase.payment_status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
