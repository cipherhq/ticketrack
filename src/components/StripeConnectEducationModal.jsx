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
} from 'lucide-react';

/**
 * Educational modal explaining Stripe Connect benefits to organizers
 * Shows after event creation for eligible countries (US, UK, CA, etc.)
 */
export function StripeConnectEducationModal({ open, onClose, organizerCountry }) {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  const handleSetup = () => {
    onClose();
    navigate('/organizer/finance?tab=connect');
  };

  const handleDismiss = () => {
    // Store permanently so modal doesn't show again
    localStorage.setItem('stripe_connect_dismissed', 'true');
    setDismissed(true);
    onClose();
  };

  const handleRemindLater = () => {
    // Store in localStorage to remind later
    localStorage.setItem('stripe_connect_reminder', Date.now().toString());
    onClose();
  };

  if (dismissed) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
        {/* Header with gradient */}
        <div className="bg-gradient-to-br from-[#635BFF] to-[#0A2540] p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-card/20 rounded-xl flex items-center justify-center">
              <CreditCard className="w-6 h-6" />
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-card/10 hover:bg-card/20 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <DialogHeader className="text-left">
            <DialogTitle className="text-2xl font-bold text-white mb-2">
              🎉 Congratulations on your event!
            </DialogTitle>
            <DialogDescription className="text-white/80 text-base">
              Get paid faster with Stripe Connect - money goes directly to your bank account!
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* How it works */}
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Zap className="w-5 h-5 text-[#635BFF]" />
              How Stripe Connect Works
            </h3>
            
            {/* Flow diagram */}
            <div className="bg-muted rounded-xl p-4">
              <div className="flex items-center justify-between text-sm">
                <div className="text-center flex-1">
                  <div className="w-10 h-10 bg-card rounded-full flex items-center justify-center mx-auto mb-2 shadow-sm">
                    <CreditCard className="w-5 h-5 text-[#635BFF]" />
                  </div>
                  <p className="font-medium text-foreground">Attendee Pays</p>
                </div>
                <ArrowRight className="w-5 h-5 text-foreground/30 flex-shrink-0" />
                <div className="text-center flex-1">
                  <div className="w-10 h-10 bg-card rounded-full flex items-center justify-center mx-auto mb-2 shadow-sm">
                    <Shield className="w-5 h-5 text-[#635BFF]" />
                  </div>
                  <p className="font-medium text-foreground">Stripe Processes</p>
                </div>
                <ArrowRight className="w-5 h-5 text-foreground/30 flex-shrink-0" />
                <div className="text-center flex-1">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2 shadow-sm">
                    <DollarSign className="w-5 h-5 text-green-600" />
                  </div>
                  <p className="font-medium text-green-600">You Get Paid!</p>
                </div>
              </div>
            </div>
          </div>

          {/* Benefits */}
          <div className="space-y-3">
            <h3 className="font-semibold text-foreground">Why Use Stripe Connect?</h3>
            <ul className="space-y-2">
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">Direct Deposits</p>
                  <p className="text-sm text-muted-foreground">
                    Money goes straight to your bank account - no waiting for manual payouts
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">Fast Payouts</p>
                  <p className="text-sm text-muted-foreground">
                    Receive funds within 2-3 business days after each sale
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">Transparent Fees</p>
                  <p className="text-sm text-muted-foreground">
                    Only a small platform fee is deducted - you keep the rest
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">Full Control</p>
                  <p className="text-sm text-muted-foreground">
                    Manage your payments, refunds, and disputes directly
                  </p>
                </div>
              </li>
            </ul>
          </div>

          {/* Fee breakdown */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              <h4 className="font-semibold text-green-800">Example: £100 Ticket Sale</h4>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-green-700">Ticket Price</span>
                <span className="font-medium text-green-800">£100.00</span>
              </div>
              <div className="flex justify-between">
                <span className="text-green-700">Stripe Fee (~2.9% + 20p)</span>
                <span className="text-green-700">-£3.10</span>
              </div>
              <div className="flex justify-between">
                <span className="text-green-700">Platform Fee (~5%)</span>
                <span className="text-green-700">-£5.00</span>
              </div>
              <div className="border-t border-green-200 pt-1 mt-1 flex justify-between">
                <span className="font-semibold text-green-800">You Receive</span>
                <span className="font-bold text-green-800 text-lg">£91.90</span>
              </div>
            </div>
          </div>

          {/* Setup time note */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>Setup takes less than 5 minutes</span>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={handleSetup}
              className="flex-1 bg-[#635BFF] hover:bg-[#635BFF]/90 text-white py-6"
            >
              <CreditCard className="w-4 h-4 mr-2" />
              Set Up Stripe Connect
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
            className="w-full text-center text-sm text-muted-foreground hover:text-muted-foreground"
          >
            Don't show this again
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
