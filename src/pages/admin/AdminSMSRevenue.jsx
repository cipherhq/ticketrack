import { useState, useEffect } from 'react';
import {
  DollarSign,
  MessageSquare,
  Users,
  TrendingUp,
  Loader2,
  RefreshCw,
  Package,
  CreditCard,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase';
import { useAdmin } from '@/contexts/AdminContext';

export function AdminSMSRevenue() {
  const { admin } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalCreditsSold: 0,
    totalCreditsUsed: 0,
    totalPurchases: 0,
    organizersWithCredits: 0,
  });
  const [purchases, setPurchases] = useState([]);
  const [packages, setPackages] = useState([]);
  const [topOrganizers, setTopOrganizers] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Get all completed purchases
      const { data: purchaseData } = await supabase
        .from('sms_credit_purchases')
        .select('*, organizers(business_name), sms_credit_packages(name)')
        .eq('status', 'completed')
        .order('created_at', { ascending: false });

      setPurchases(purchaseData || []);

      // Calculate stats
      const totalRevenue = (purchaseData || []).reduce((sum, p) => sum + parseFloat(p.amount_paid), 0);
      const totalCreditsSold = (purchaseData || []).reduce((sum, p) => sum + p.credits_purchased + p.bonus_credits, 0);

      // Get total credits used
      const { data: usageData } = await supabase
        .from('sms_credit_usage')
        .select('credits_used');
      const totalCreditsUsed = (usageData || []).reduce((sum, u) => sum + u.credits_used, 0);

      // Get organizers with credits
      const { count: organizersWithCredits } = await supabase
        .from('organizer_sms_wallet')
        .select('*', { count: 'exact', head: true })
        .gt('balance', 0);

      setStats({
        totalRevenue,
        totalCreditsSold,
        totalCreditsUsed,
        totalPurchases: (purchaseData || []).length,
        organizersWithCredits: organizersWithCredits || 0,
      });

      // Get packages
      const { data: pkgData } = await supabase
        .from('sms_credit_packages')
        .select('*')
        .order('sort_order');
      setPackages(pkgData || []);

      // Get top organizers by credits purchased
      const { data: walletData } = await supabase
        .from('organizer_sms_wallet')
        .select('*, organizers(business_name)')
        .order('total_purchased', { ascending: false })
        .limit(10);
      setTopOrganizers(walletData || []);

    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount || 0);
  };

  // Calculate profit (assuming ₦4 cost per SMS)
  const costPerSMS = 4;
  const totalCost = stats.totalCreditsUsed * costPerSMS;
  const grossProfit = stats.totalRevenue - totalCost;
  const profitMargin = stats.totalRevenue > 0 ? ((grossProfit / stats.totalRevenue) * 100).toFixed(1) : 0;

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
          <h2 className="text-2xl font-semibold text-[#0F0F0F]">SMS Revenue</h2>
          <p className="text-[#0F0F0F]/60 mt-1">Track SMS credit sales and revenue</p>
        </div>
        <Button variant="outline" size="icon" onClick={loadData} className="rounded-xl">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Total Revenue</p>
                <p className="text-2xl font-semibold text-green-600">{formatCurrency(stats.totalRevenue)}</p>
              </div>
              <DollarSign className="w-8 h-8 text-green-200" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Gross Profit</p>
                <p className="text-2xl font-semibold text-[#2969FF]">{formatCurrency(grossProfit)}</p>
                <p className="text-xs text-[#0F0F0F]/40">{profitMargin}% margin</p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-200" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Credits Sold</p>
                <p className="text-2xl font-semibold">{stats.totalCreditsSold.toLocaleString()}</p>
              </div>
              <MessageSquare className="w-8 h-8 text-purple-200" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Credits Used</p>
                <p className="text-2xl font-semibold">{stats.totalCreditsUsed.toLocaleString()}</p>
              </div>
              <CreditCard className="w-8 h-8 text-orange-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="purchases">
        <TabsList className="bg-[#F4F6FA] rounded-xl">
          <TabsTrigger value="purchases" className="rounded-lg">
            Recent Purchases
          </TabsTrigger>
          <TabsTrigger value="packages" className="rounded-lg">
            Packages
          </TabsTrigger>
          <TabsTrigger value="top" className="rounded-lg">
            Top Organizers
          </TabsTrigger>
        </TabsList>

        {/* Recent Purchases */}
        <TabsContent value="purchases" className="mt-6">
          <Card className="border-[#0F0F0F]/10 rounded-2xl">
            <CardHeader>
              <CardTitle>Recent Purchases ({purchases.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {purchases.length === 0 ? (
                <p className="text-center text-[#0F0F0F]/60 py-8">No purchases yet</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#0F0F0F]/10">
                        <th className="text-left py-3 px-4 text-[#0F0F0F]/60 font-medium">Organizer</th>
                        <th className="text-left py-3 px-4 text-[#0F0F0F]/60 font-medium">Package</th>
                        <th className="text-left py-3 px-4 text-[#0F0F0F]/60 font-medium">Credits</th>
                        <th className="text-left py-3 px-4 text-[#0F0F0F]/60 font-medium">Amount</th>
                        <th className="text-left py-3 px-4 text-[#0F0F0F]/60 font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {purchases.slice(0, 20).map((purchase) => (
                        <tr key={purchase.id} className="border-b border-[#0F0F0F]/5">
                          <td className="py-3 px-4">
                            <p className="text-[#0F0F0F] font-medium">{purchase.organizers?.business_name || 'Unknown'}</p>
                          </td>
                          <td className="py-3 px-4">
                            <p className="text-[#0F0F0F]">{purchase.sms_credit_packages?.name || 'N/A'}</p>
                          </td>
                          <td className="py-3 px-4">
                            <p className="text-[#0F0F0F]">
                              {purchase.credits_purchased}
                              {purchase.bonus_credits > 0 && (
                                <span className="text-green-600 text-sm ml-1">+{purchase.bonus_credits}</span>
                              )}
                            </p>
                          </td>
                          <td className="py-3 px-4">
                            <p className="text-[#0F0F0F] font-medium">{formatCurrency(purchase.amount_paid)}</p>
                          </td>
                          <td className="py-3 px-4">
                            <p className="text-[#0F0F0F]/60 text-sm">
                              {new Date(purchase.created_at).toLocaleDateString()}
                            </p>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Packages */}
        <TabsContent value="packages" className="mt-6">
          <Card className="border-[#0F0F0F]/10 rounded-2xl">
            <CardHeader>
              <CardTitle>Credit Packages</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#0F0F0F]/10">
                      <th className="text-left py-3 px-4 text-[#0F0F0F]/60 font-medium">Name</th>
                      <th className="text-left py-3 px-4 text-[#0F0F0F]/60 font-medium">Credits</th>
                      <th className="text-left py-3 px-4 text-[#0F0F0F]/60 font-medium">Bonus</th>
                      <th className="text-left py-3 px-4 text-[#0F0F0F]/60 font-medium">Price</th>
                      <th className="text-left py-3 px-4 text-[#0F0F0F]/60 font-medium">Per SMS</th>
                      <th className="text-left py-3 px-4 text-[#0F0F0F]/60 font-medium">Your Profit</th>
                      <th className="text-left py-3 px-4 text-[#0F0F0F]/60 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {packages.map((pkg) => {
                      const totalCredits = pkg.credits + pkg.bonus_credits;
                      const costToYou = totalCredits * costPerSMS;
                      const profit = pkg.price - costToYou;
                      return (
                        <tr key={pkg.id} className="border-b border-[#0F0F0F]/5">
                          <td className="py-3 px-4">
                            <p className="text-[#0F0F0F] font-medium">
                              {pkg.name}
                              {pkg.is_popular && <Badge className="ml-2 bg-[#2969FF] text-white text-xs">Popular</Badge>}
                            </p>
                          </td>
                          <td className="py-3 px-4">{pkg.credits}</td>
                          <td className="py-3 px-4 text-green-600">+{pkg.bonus_credits}</td>
                          <td className="py-3 px-4 font-medium">{formatCurrency(pkg.price)}</td>
                          <td className="py-3 px-4">₦{parseFloat(pkg.price_per_sms).toFixed(2)}</td>
                          <td className="py-3 px-4 text-green-600 font-medium">{formatCurrency(profit)}</td>
                          <td className="py-3 px-4">
                            {pkg.is_active ? (
                              <Badge className="bg-green-100 text-green-700">Active</Badge>
                            ) : (
                              <Badge className="bg-gray-100 text-gray-700">Inactive</Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Top Organizers */}
        <TabsContent value="top" className="mt-6">
          <Card className="border-[#0F0F0F]/10 rounded-2xl">
            <CardHeader>
              <CardTitle>Top Organizers by Credits</CardTitle>
            </CardHeader>
            <CardContent>
              {topOrganizers.length === 0 ? (
                <p className="text-center text-[#0F0F0F]/60 py-8">No data yet</p>
              ) : (
                <div className="space-y-3">
                  {topOrganizers.map((org, idx) => (
                    <div key={org.id} className="flex items-center justify-between p-4 bg-[#F4F6FA] rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-medium ${
                          idx === 0 ? 'bg-yellow-500' : idx === 1 ? 'bg-gray-400' : idx === 2 ? 'bg-orange-400' : 'bg-[#2969FF]'
                        }`}>
                          {idx + 1}
                        </div>
                        <p className="font-medium text-[#0F0F0F]">{org.organizers?.business_name || 'Unknown'}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-[#0F0F0F]">{org.total_purchased.toLocaleString()} credits</p>
                        <p className="text-sm text-[#0F0F0F]/60">Balance: {org.balance}</p>
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
