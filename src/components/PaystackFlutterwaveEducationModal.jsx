import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  CreditCard,
  ArrowRight,
  CheckCircle2,
  Zap,
  Shield,
  DollarSign,
  Clock,
  X,
  Banknote,
  Building2,
  Wallet,
} from 'lucide-react';

/**
 * Educational modal explaining Paystack/Flutterwave payment flow to Nigerian/Ghanaian organizers
 * Shows after event creation for NG/GH countries
 */
export function PaystackFlutterwaveEducationModal({ open, onClose, organizerCountry }) {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  const isNigeria = organizerCountry === 'NG';
  const isGhana = organizerCountry === 'GH';
  const currency = isNigeria ? '₦' : isGhana ? 'GH₵' : '₦';
  const currencyCode = isNigeria ? 'NGN' : isGhana ? 'GHS' : 'NGN';
  const countryName = isNigeria ? 'Nigeria' : isGhana ? 'Ghana' : 'your country';

  const handleSetup = () => {
    onClose();
    navigate('/organizer/finance?tab=payouts');
  };

  const handleDismiss = () => {
    localStorage.setItem('paystack_flutterwave_dismissed', 'true');
    setDismissed(true);
    onClose();
  };

  const handleRemindLater = () => {
    localStorage.setItem('paystack_flutterwave_reminder', Date.now().toString());
    onClose();
  };

  if (dismissed) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
        {/* Header with gradient - Paystack/Flutterwave colors */}
        <div className="bg-gradient-to-br from-[#00C3F7] via-[#0BA4DB] to-[#F5A623] p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Wallet className="w-6 h-6" />
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <DialogHeader className="text-left">
            <DialogTitle className="text-2xl font-bold text-white mb-2">
              🎉 Congratulations on your event!
            </DialogTitle>
            <DialogDescription className="text-white/90 text-base">
              Here's how you'll receive payments for your {countryName} event
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* How it works */}
          <div className="space-y-4">
            <h3 className="font-semibold text-[#0F0F0F] flex items-center gap-2">
              <Zap className="w-5 h-5 text-[#00C3F7]" />
              How Payments Work
            </h3>
            
            {/* Flow diagram */}
            <div className="bg-[#F4F6FA] rounded-xl p-4">
              <div className="flex items-center justify-between text-sm">
                <div className="text-center flex-1">
                  <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center mx-auto mb-2 shadow-sm">
                    <CreditCard className="w-5 h-5 text-[#00C3F7]" />
                  </div>
                  <p className="font-medium text-[#0F0F0F] text-xs">Attendee Pays</p>
                  <p className="text-[10px] text-[#0F0F0F]/60">Card/Bank/USSD</p>
                </div>
                <ArrowRight className="w-4 h-4 text-[#0F0F0F]/30 flex-shrink-0" />
                <div className="text-center flex-1">
                  <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center mx-auto mb-2 shadow-sm">
                    <Shield className="w-5 h-5 text-[#00C3F7]" />
                  </div>
                  <p className="font-medium text-[#0F0F0F] text-xs">Secure Hold</p>
                  <p className="text-[10px] text-[#0F0F0F]/60">Protected funds</p>
                </div>
                <ArrowRight className="w-4 h-4 text-[#0F0F0F]/30 flex-shrink-0" />
                <div className="text-center flex-1">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2 shadow-sm">
                    <Banknote className="w-5 h-5 text-green-600" />
                  </div>
                  <p className="font-medium text-green-600 text-xs">You Get Paid!</p>
                  <p className="text-[10px] text-[#0F0F0F]/60">To your bank</p>
                </div>
              </div>
            </div>
          </div>

          {/* Benefits */}
          <div className="space-y-3">
            <h3 className="font-semibold text-[#0F0F0F]">Why This Works Great</h3>
            <ul className="space-y-2">
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-[#0F0F0F]">Multiple Payment Options</p>
                  <p className="text-sm text-[#0F0F0F]/60">
                    Accept cards, bank transfers, USSD, and mobile money
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-[#0F0F0F]">Secure & Protected</p>
                  <p className="text-sm text-[#0F0F0F]/60">
                    Funds are held securely until you request payout
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-[#0F0F0F]">Fast Bank Payouts</p>
                  <p className="text-sm text-[#0F0F0F]/60">
                    Request payouts anytime - usually processed within 24-48 hours
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-[#0F0F0F]">Real-Time Dashboard</p>
                  <p className="text-sm text-[#0F0F0F]/60">
                    Track all sales, refunds, and payouts in one place
                  </p>
                </div>
              </li>
            </ul>
          </div>

          {/* Fee breakdown */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              <h4 className="font-semibold text-green-800">Example: {currency}10,000 Ticket Sale</h4>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-green-700">Ticket Price</span>
                <span className="font-medium text-green-800">{currency}10,000</span>
              </div>
              <div className="flex justify-between">
                <span className="text-green-700">Payment Processing (~1.5%)</span>
                <span className="text-green-700">-{currency}150</span>
              </div>
              <div className="flex justify-between">
                <span className="text-green-700">Platform Fee (~5%)</span>
                <span className="text-green-700">-{currency}500</span>
              </div>
              <div className="border-t border-green-200 pt-1 mt-1 flex justify-between">
                <span className="font-semibold text-green-800">You Receive</span>
                <span className="font-bold text-green-800 text-lg">{currency}9,350</span>
              </div>
            </div>
          </div>

          {/* Important note */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Building2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-blue-800 text-sm">Add Your Bank Account</p>
                <p className="text-sm text-blue-700">
                  Make sure to add your bank account details in the Finance section to receive payouts.
                </p>
              </div>
            </div>
          </div>

          {/* Setup time note */}
          <div className="flex items-center gap-2 text-sm text-[#0F0F0F]/60">
            <Clock className="w-4 h-4" />
            <span>Setup takes less than 2 minutes</span>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={handleSetup}
              className="flex-1 bg-[#00C3F7] hover:bg-[#0BA4DB] text-white py-6"
            >
              <Building2 className="w-4 h-4 mr-2" />
              Set Up Bank Account
            </Button>
            <Button
              variant="outline"
              onClick={handleRemindLater}
              className="flex-1 py-6"
            >
              Remind Me Later
            </Button>
          </div>

          <button
            onClick={handleDismiss}
            className="w-full text-center text-sm text-[#0F0F0F]/40 hover:text-[#0F0F0F]/60"
          >
            Don't show this again
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
