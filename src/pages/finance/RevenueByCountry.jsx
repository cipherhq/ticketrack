import { useState, useEffect } from 'react';
import { Globe, Loader2, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { formatPrice, formatMultiCurrencyCompact } from '@/config/currencies';
import { useFinance } from '@/contexts/FinanceContext';

export function RevenueByCountry() {
  const { logFinanceAction } = useFinance();
  const [loading, setLoading] = useState(true);
  const [revenueByCountry, setRevenueByCountry] = useState([]);

  useEffect(() => {
    loadData();
    logFinanceAction('view_revenue_by_country');
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: orders } = await supabase.from('orders').select('platform_fee, currency, events(country_code)').eq('status', 'completed');

      // Group by country, then by currency within each country
      const countryMap = {};
      orders?.forEach(o => {
        const country = o.events?.country_code || 'Unknown';
        const currency = o.currency || 'USD';
        if (!countryMap[country]) {
          countryMap[country] = { revenueByCurrency: {}, total: 0 };
        }
        const fee = parseFloat(o.platform_fee || 0);
        countryMap[country].revenueByCurrency[currency] = (countryMap[country].revenueByCurrency[currency] || 0) + fee;
        countryMap[country].total += fee;
      });

      const sorted = Object.entries(countryMap)
        .map(([country, data]) => ({ country, revenueByCurrency: data.revenueByCurrency, total: data.total }))
        .sort((a, b) => b.total - a.total);

      setRevenueByCountry(sorted);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalRevenue = revenueByCountry.reduce((sum, c) => sum + c.total, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Revenue by Country</h1>
          <p className="text-muted-foreground">Platform revenue breakdown by country</p>
        </div>
        <Button onClick={loadData} variant="outline" className="rounded-xl">
          <RefreshCw className="w-4 h-4 mr-2" />Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" /></div>
      ) : (
        <Card className="border-border/10 rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Globe className="w-5 h-5" />Revenue by Country</CardTitle>
          </CardHeader>
          <CardContent>
            {revenueByCountry.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No data available</p>
            ) : (
              <div className="space-y-3">
                {revenueByCountry.map((item, idx) => {
                  const percentage = totalRevenue > 0 ? (item.total / totalRevenue) * 100 : 0;
                  return (
                    <div key={idx} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-[#2969FF]/10 flex items-center justify-center font-semibold text-[#2969FF]">
                            {item.country?.slice(0, 2) || '??'}
                          </div>
                          <p className="font-medium text-foreground">{item.country || 'Unknown'}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-foreground">{formatMultiCurrencyCompact(item.revenueByCurrency)}</p>
                          <p className="text-xs text-muted-foreground">{percentage.toFixed(1)}%</p>
                        </div>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div className="bg-[#2969FF] h-2 rounded-full" style={{ width: `${percentage}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
