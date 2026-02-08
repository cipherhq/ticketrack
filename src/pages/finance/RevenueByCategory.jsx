import { useState, useEffect } from 'react';
import { PieChart, Loader2, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { formatPrice, formatMultiCurrencyCompact } from '@/config/currencies';
import { useFinance } from '@/contexts/FinanceContext';

const categoryColors = [
  'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-yellow-500', 
  'bg-red-500', 'bg-indigo-500', 'bg-pink-500', 'bg-teal-500'
];

export function RevenueByCategory() {
  const { logFinanceAction } = useFinance();
  const [loading, setLoading] = useState(true);
  const [revenueByCategory, setRevenueByCategory] = useState([]);

  useEffect(() => {
    loadData();
    logFinanceAction('view_revenue_by_category');
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: orders } = await supabase.from('orders').select('platform_fee, currency, events(category)').eq('status', 'completed');

      // Group by category, then by currency within each category
      const categoryMap = {};
      orders?.forEach(o => {
        const category = o.events?.category || 'Other';
        const currency = o.currency || 'USD';
        if (!categoryMap[category]) {
          categoryMap[category] = { revenueByCurrency: {}, total: 0 };
        }
        const fee = parseFloat(o.platform_fee || 0);
        categoryMap[category].revenueByCurrency[currency] = (categoryMap[category].revenueByCurrency[currency] || 0) + fee;
        categoryMap[category].total += fee;
      });

      const sorted = Object.entries(categoryMap)
        .map(([category, data]) => ({ category, revenueByCurrency: data.revenueByCurrency, total: data.total }))
        .sort((a, b) => b.total - a.total);

      setRevenueByCategory(sorted);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalRevenue = revenueByCategory.reduce((sum, c) => sum + c.total, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Revenue by Category</h1>
          <p className="text-muted-foreground">Platform revenue breakdown by event category</p>
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
            <CardTitle className="flex items-center gap-2"><PieChart className="w-5 h-5" />Revenue by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {revenueByCategory.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No data available</p>
            ) : (
              <div className="space-y-3">
                {revenueByCategory.map((item, idx) => {
                  const percentage = totalRevenue > 0 ? (item.total / totalRevenue) * 100 : 0;
                  const colorClass = categoryColors[idx % categoryColors.length];
                  return (
                    <div key={idx} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-4 h-4 rounded ${colorClass}`} />
                          <p className="font-medium text-foreground">{item.category}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-foreground">{formatMultiCurrencyCompact(item.revenueByCurrency)}</p>
                          <p className="text-xs text-muted-foreground">{percentage.toFixed(1)}%</p>
                        </div>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div className={`${colorClass} h-2 rounded-full`} style={{ width: `${percentage}%` }} />
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
