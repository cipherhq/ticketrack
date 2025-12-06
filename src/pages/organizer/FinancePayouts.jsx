import { useNavigate } from 'react-router-dom';
import { DollarSign, Clock, CheckCircle, Plus, CreditCard, Building2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';

const payouts = [
  { id: 1, amount: '₦850,000', date: 'Nov 20, 2025', status: 'Completed', event: 'Summer Fest' },
  { id: 2, amount: '₦450,000', date: 'Nov 25, 2025', status: 'Pending', event: 'Tech Conference' },
  { id: 3, amount: '₦320,000', date: 'Nov 28, 2025', status: 'Processing', event: 'Business Summit' },
];

export function FinancePayouts() {
  const navigate = useNavigate();
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-[#0F0F0F]">Finance & Payouts</h2>
          <p className="text-[#0F0F0F]/60 mt-1">Manage your earnings and bank accounts</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => navigate('/organizer/bank-accounts')}
            variant="outline"
            className="rounded-xl border-[#0F0F0F]/10"
          >
            <CreditCard className="w-5 h-5 mr-2" />
            Manage Bank Accounts
          </Button>
          <Button 
            onClick={() => navigate('/organizer/add-bank')}
            className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Bank Account
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <DollarSign className="w-8 h-8 text-[#2969FF] mb-3" />
            <p className="text-[#0F0F0F]/60 mb-2">Available Balance</p>
            <h2 className="text-2xl font-semibold text-[#2969FF]">₦1,450,000</h2>
          </CardContent>
        </Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <Clock className="w-8 h-8 text-[#0F0F0F]/40 mb-3" />
            <p className="text-[#0F0F0F]/60 mb-2">In Escrow</p>
            <h2 className="text-2xl font-semibold text-[#0F0F0F]">₦680,000</h2>
          </CardContent>
        </Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <CheckCircle className="w-8 h-8 text-green-500 mb-3" />
            <p className="text-[#0F0F0F]/60 mb-2">Total Paid Out</p>
            <h2 className="text-2xl font-semibold text-[#0F0F0F]">₦4,200,000</h2>
          </CardContent>
        </Card>
      </div>

      {/* Request Payout Card */}
      <Card className="border-[#0F0F0F]/10 rounded-2xl bg-[#2969FF]/5">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h3 className="font-medium text-[#0F0F0F] mb-1">Request a Payout</h3>
              <p className="text-sm text-[#0F0F0F]/60">
                Withdraw your available balance to your bank account. Processing takes 24-48 hours.
              </p>
            </div>
            <Button className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl">
              <DollarSign className="w-5 h-5 mr-2" />
              Request Payout
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardHeader>
          <CardTitle className="text-[#0F0F0F]">Payout History</CardTitle>
        </CardHeader>
        <CardContent>
          {payouts.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="w-12 h-12 text-[#0F0F0F]/20 mx-auto mb-4" />
              <p className="text-[#0F0F0F]/60">No payout history yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {payouts.map((payout) => (
                <div key={payout.id} className="p-4 rounded-xl bg-[#F4F6FA]">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-[#0F0F0F] mb-1">{payout.event}</h4>
                      <p className="text-sm text-[#0F0F0F]/60">{payout.date}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[#2969FF] font-medium mb-2">{payout.amount}</p>
                      <Badge
                        className={`${
                          payout.status === 'Completed'
                            ? 'bg-green-100 text-green-700'
                            : payout.status === 'Processing'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-[#0F0F0F]/10 text-[#0F0F0F]/60'
                        }`}
                      >
                        {payout.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
