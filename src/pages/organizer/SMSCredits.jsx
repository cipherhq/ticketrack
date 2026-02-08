import { useState, useEffect } from 'react';
import {
  Wallet,
  CreditCard,
  Loader2,
  TrendingUp,
  History,
  Sparkles,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { getOrCreateWallet, getCreditPackages, createPurchase, completePurchase } from '@/lib/smsWallet';

export function SMSCredits() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [organizer, setOrganizer] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [packages, setPackages] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [usage, setUsage] = useState([]);
  const [selectedPackage, setSelectedPackage] = useState(null);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: org } = await supabase
        .from('organizers')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      setOrganizer(org);

      if (org) {
        const walletData = await getOrCreateWallet(org.id);
        setWallet(walletData);

        const packagesData = await getCreditPackages();
        setPackages(packagesData);

        const { data: purchaseData } = await supabase
          .from('sms_credit_purchases')
          .select('*, sms_credit_packages(name)')
          .eq('organizer_id', org.id)
          .order('created_at', { ascending: false })
          .limit(20);
        setPurchases(purchaseData || []);

        const { data: usageData } = await supabase
          .from('sms_credit_usage')
          .select('*, events(title)')
          .eq('organizer_id', org.id)
          .order('created_at', { ascending: false })
          .limit(20);
        setUsage(usageData || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = function(pkg) {
    if (!organizer) {
      alert('Organizer profile not found');
      return;
    }

    if (!window.PaystackPop) {
      alert('Payment system not loaded. Please refresh the page.');
      return;
    }

    const email = organizer.email || organizer.business_email || user?.email;
    if (!email) {
      alert('No email found. Please update your profile.');
      return;
    }

    setSelectedPackage(pkg);
    setPurchasing(true);

    const reference = 'SMS_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const totalCredits = pkg.credits + (pkg.bonus_credits || 0);
    
    createPurchase(
      organizer.id,
      pkg.id,
      pkg.credits,
      pkg.bonus_credits || 0,
      pkg.price,
      reference
    ).then(function(purchase) {
      console.log('Purchase created:', purchase);

      var handler = window.PaystackPop.setup({
        key: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY,
        email: email,
        amount: Math.round(pkg.price * 100),
        currency: 'NGN',
        ref: reference,
        metadata: {
          type: 'sms_credits',
          purchase_id: purchase.id,
          organizer_id: organizer.id,
        },
        callback: function(response) {
          console.log('Paystack success:', response);
          completePurchase(purchase.id).then(function() {
            alert('Payment successful! ' + totalCredits + ' SMS credits added.');
            loadData();
          }).catch(function(error) {
            console.error('Error completing purchase:', error);
            alert('Payment received but credits not added. Contact support with ref: ' + reference);
          }).finally(function() {
            setPurchasing(false);
            setSelectedPackage(null);
          });
        },
        onClose: function() {
          console.log('Paystack closed');
          setPurchasing(false);
          setSelectedPackage(null);
        }
      });

      handler.openIframe();
    }).catch(function(error) {
      console.error('Error creating purchase:', error);
      alert('Failed to initiate payment: ' + error.message);
      setPurchasing(false);
      setSelectedPackage(null);
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(amount || 0);
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">SMS Credits</h2>
          <p className="text-muted-foreground mt-1">Buy credits to send SMS to your attendees</p>
        </div>
        <Button variant="outline" size="icon" onClick={loadData} className="rounded-xl">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      <Card className="border-border/10 rounded-2xl bg-gradient-to-r from-[#2969FF] to-[#1e4fcc]">
        <CardContent className="p-6">
          <div className="flex items-center justify-between text-white">
            <div>
              <p className="text-white/80 text-sm">Available Credits</p>
              <p className="text-4xl font-bold mt-1">{wallet?.balance || 0}</p>
              <p className="text-white/60 text-sm mt-1">SMS messages</p>
            </div>
            <div className="w-16 h-16 bg-card/20 rounded-2xl flex items-center justify-center">
              <Wallet className="w-8 h-8 text-white" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-white/20">
            <div>
              <p className="text-white/60 text-sm">Total Purchased</p>
              <p className="text-white font-semibold">{wallet?.total_purchased || 0}</p>
            </div>
            <div>
              <p className="text-white/60 text-sm">Total Used</p>
              <p className="text-white font-semibold">{wallet?.total_used || 0}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="packages">
        <TabsList className="bg-muted rounded-xl">
          <TabsTrigger value="packages" className="rounded-lg"><CreditCard className="w-4 h-4 mr-2" />Buy Credits</TabsTrigger>
          <TabsTrigger value="history" className="rounded-lg"><History className="w-4 h-4 mr-2" />Purchases</TabsTrigger>
          <TabsTrigger value="usage" className="rounded-lg"><TrendingUp className="w-4 h-4 mr-2" />Usage</TabsTrigger>
        </TabsList>

        <TabsContent value="packages" className="mt-6">
          {packages.length === 0 ? (
            <Card className="border-border/10 rounded-2xl">
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">No packages available.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {packages.map((pkg) => (
                <Card key={pkg.id} className={`border-2 rounded-2xl relative ${pkg.is_popular ? 'border-[#2969FF]' : 'border-border/10'}`}>
                  {pkg.is_popular && (
                    <div className="absolute top-0 right-0 bg-[#2969FF] text-white text-xs px-3 py-1 rounded-bl-xl">
                      <Sparkles className="w-3 h-3 inline mr-1" />Popular
                    </div>
                  )}
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold text-foreground">{pkg.name}</h3>
                    <div className="mt-4">
                      <p className="text-3xl font-bold text-foreground">{pkg.credits}<span className="text-base font-normal text-muted-foreground ml-1">credits</span></p>
                      {pkg.bonus_credits > 0 && <p className="text-green-600 text-sm mt-1">+{pkg.bonus_credits} bonus!</p>}
                    </div>
                    <div className="mt-4 p-3 bg-muted rounded-xl">
                      <div className="flex justify-between"><span className="text-muted-foreground">Price</span><span className="font-semibold">{formatCurrency(pkg.price)}</span></div>
                      <div className="flex justify-between mt-1"><span className="text-muted-foreground">Per SMS</span><span>₦{parseFloat(pkg.price_per_sms || (pkg.price / pkg.credits)).toFixed(2)}</span></div>
                    </div>
                    <Button onClick={() => handlePurchase(pkg)} disabled={purchasing} className={`w-full mt-4 rounded-xl ${pkg.is_popular ? 'bg-[#2969FF]' : 'bg-[#0F0F0F]'} text-white`}>
                      {purchasing && selectedPackage?.id === pkg.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowRight className="w-4 h-4 mr-2" />}
                      Buy Now
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          <div className="mt-6 p-4 bg-blue-50 rounded-xl">
            <p className="text-blue-800 font-medium">How it works</p>
            <ul className="text-sm text-blue-700 mt-2 space-y-1">
              <li>• 1 credit = 1 SMS (160 chars)</li>
              <li>• Credits never expire</li>
              <li>• Bonus credits added instantly</li>
            </ul>
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <Card className="border-border/10 rounded-2xl">
            <CardHeader><CardTitle>Purchase History</CardTitle></CardHeader>
            <CardContent>
              {purchases.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No purchases yet</p>
              ) : (
                <div className="space-y-3">
                  {purchases.map((p) => (
                    <div key={p.id} className="flex justify-between p-4 bg-muted rounded-xl">
                      <div>
                        <p className="font-medium">{p.sms_credit_packages?.name || 'Package'}</p>
                        <p className="text-sm text-muted-foreground">{p.credits_purchased}{p.bonus_credits > 0 && ` + ${p.bonus_credits} bonus`}</p>
                        <p className="text-xs text-muted-foreground mt-1">{new Date(p.created_at).toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatCurrency(p.amount_paid)}</p>
                        <Badge className={p.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}>{p.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usage" className="mt-6">
          <Card className="border-border/10 rounded-2xl">
            <CardHeader><CardTitle>Usage History</CardTitle></CardHeader>
            <CardContent>
              {usage.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No usage yet</p>
              ) : (
                <div className="space-y-3">
                  {usage.map((u) => (
                    <div key={u.id} className="flex justify-between p-4 bg-muted rounded-xl">
                      <div>
                        <p className="font-medium">{u.events?.title || 'Campaign'}</p>
                        <p className="text-sm text-muted-foreground">{u.recipient_count} recipients</p>
                        <p className="text-xs text-muted-foreground mt-1">{new Date(u.created_at).toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-red-600">-{u.credits_used}</p>
                        <p className="text-xs text-muted-foreground">credits</p>
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
