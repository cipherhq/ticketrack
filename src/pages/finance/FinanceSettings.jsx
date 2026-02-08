import { Settings, CreditCard, Wallet, Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useFinance } from '@/contexts/FinanceContext';

export function FinanceSettings() {
  const { financeUser } = useFinance();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Finance Settings</h1>
        <p className="text-muted-foreground">Configure financial settings and preferences</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-border/10 rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-[#2969FF]" />
              Platform Fees
            </CardTitle>
            <CardDescription>Configure platform fee percentages by country</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">Platform fees are configured in Admin Settings → Countries</p>
            <Button variant="outline" className="rounded-xl" onClick={() => window.open('/admin/settings', '_blank')}>
              <Settings className="w-4 h-4 mr-2" />Go to Admin Settings
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/10 rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-green-600" />
              Payout Rules
            </CardTitle>
            <CardDescription>Configure payout processing rules</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between p-2 bg-muted rounded-lg">
                <span className="text-muted-foreground">Minimum Payout</span>
                <span className="font-medium">₦1,000</span>
              </div>
              <div className="flex justify-between p-2 bg-muted rounded-lg">
                <span className="text-muted-foreground">Payout Delay</span>
                <span className="font-medium">After event ends</span>
              </div>
              <div className="flex justify-between p-2 bg-muted rounded-lg">
                <span className="text-muted-foreground">Processing Time</span>
                <span className="font-medium">1-3 business days</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/10 rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-purple-600" />
            Your Access
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="p-3 bg-muted rounded-xl">
              <p className="text-muted-foreground">Email</p>
              <p className="font-medium text-foreground">{financeUser?.email}</p>
            </div>
            <div className="p-3 bg-muted rounded-xl">
              <p className="text-muted-foreground">Role</p>
              <p className="font-medium text-foreground capitalize">{financeUser?.financeRole?.replace('_', ' ')}</p>
            </div>
            <div className="p-3 bg-muted rounded-xl">
              <p className="text-muted-foreground">Super Admin</p>
              <p className="font-medium text-foreground">{financeUser?.isSuperAdmin ? 'Yes' : 'No'}</p>
            </div>
            <div className="p-3 bg-muted rounded-xl">
              <p className="text-muted-foreground">Session Timeout</p>
              <p className="font-medium text-foreground">30 minutes</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
