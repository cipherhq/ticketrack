import { Settings, CreditCard, Wallet, Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useFinance } from '@/contexts/FinanceContext';

export function FinanceSettings() {
  const { financeUser } = useFinance();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0F0F0F]">Finance Settings</h1>
        <p className="text-[#0F0F0F]/60">Configure financial settings and preferences</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-[#2969FF]" />
              Platform Fees
            </CardTitle>
            <CardDescription>Configure platform fee percentages by country</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-[#0F0F0F]/60 mb-4">Platform fees are configured in Admin Settings → Countries</p>
            <Button variant="outline" className="rounded-xl" onClick={() => window.open('/admin/settings', '_blank')}>
              <Settings className="w-4 h-4 mr-2" />Go to Admin Settings
            </Button>
          </CardContent>
        </Card>

        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-green-600" />
              Payout Rules
            </CardTitle>
            <CardDescription>Configure payout processing rules</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between p-2 bg-[#F4F6FA] rounded-lg">
                <span className="text-[#0F0F0F]/60">Minimum Payout</span>
                <span className="font-medium">₦1,000</span>
              </div>
              <div className="flex justify-between p-2 bg-[#F4F6FA] rounded-lg">
                <span className="text-[#0F0F0F]/60">Payout Delay</span>
                <span className="font-medium">After event ends</span>
              </div>
              <div className="flex justify-between p-2 bg-[#F4F6FA] rounded-lg">
                <span className="text-[#0F0F0F]/60">Processing Time</span>
                <span className="font-medium">1-3 business days</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-purple-600" />
            Your Access
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="p-3 bg-[#F4F6FA] rounded-xl">
              <p className="text-[#0F0F0F]/60">Email</p>
              <p className="font-medium text-[#0F0F0F]">{financeUser?.email}</p>
            </div>
            <div className="p-3 bg-[#F4F6FA] rounded-xl">
              <p className="text-[#0F0F0F]/60">Role</p>
              <p className="font-medium text-[#0F0F0F] capitalize">{financeUser?.financeRole?.replace('_', ' ')}</p>
            </div>
            <div className="p-3 bg-[#F4F6FA] rounded-xl">
              <p className="text-[#0F0F0F]/60">Super Admin</p>
              <p className="font-medium text-[#0F0F0F]">{financeUser?.isSuperAdmin ? 'Yes' : 'No'}</p>
            </div>
            <div className="p-3 bg-[#F4F6FA] rounded-xl">
              <p className="text-[#0F0F0F]/60">Session Timeout</p>
              <p className="font-medium text-[#0F0F0F]">30 minutes</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
