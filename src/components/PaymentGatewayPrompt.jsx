import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  CreditCard,
  CheckCircle2,
  X,
  ArrowRight,
  Zap,
  Clock,
  Wallet,
  Bell,
} from 'lucide-react';

// Gateway configuration by country
const GATEWAY_BY_COUNTRY = {
  US: { name: 'Stripe Connect', color: 'purple', primary: true },
  GB: { name: 'Stripe Connect', color: 'purple', primary: true },
  CA: { name: 'Stripe Connect', color: 'purple', primary: true },
  AU: { name: 'Stripe Connect', color: 'purple', primary: true },
  DE: { name: 'Stripe Connect', color: 'purple', primary: true },
  FR: { name: 'Stripe Connect', color: 'purple', primary: true },
  IE: { name: 'Stripe Connect', color: 'purple', primary: true },
  NL: { name: 'Stripe Connect', color: 'purple', primary: true },
  ES: { name: 'Stripe Connect', color: 'purple', primary: true },
  IT: { name: 'Stripe Connect', color: 'purple', primary: true },
  BE: { name: 'Stripe Connect', color: 'purple', primary: true },
  AT: { name: 'Stripe Connect', color: 'purple', primary: true },
  CH: { name: 'Stripe Connect', color: 'purple', primary: true },
  NG: { name: 'Paystack', color: 'green', alt: 'Flutterwave', primary: true },
  GH: { name: 'Paystack', color: 'green', alt: 'Flutterwave', primary: true },
  KE: { name: 'Flutterwave', color: 'orange', primary: true },
  ZA: { name: 'Flutterwave', color: 'orange', primary: true },
  TZ: { name: 'Flutterwave', color: 'orange', primary: true },
  UG: { name: 'Flutterwave', color: 'orange', primary: true },
  RW: { name: 'Flutterwave', color: 'orange', primary: true },
};

// Default gateway for unknown countries
const DEFAULT_GATEWAY = { name: 'Payment Gateway', color: 'blue', primary: true };

// Get gateway info for a country with fallback
const getGatewayInfo = (countryCode) => {
  if (!countryCode) return DEFAULT_GATEWAY;
  return GATEWAY_BY_COUNTRY[countryCode] || DEFAULT_GATEWAY;
};

// Color configurations
const COLORS = {
  purple: {
    gradient: 'from-[#635BFF] to-[#0A2540]',
    bg: 'bg-[#635BFF]',
    bgHover: 'hover:bg-[#635BFF]/90',
    text: 'text-[#635BFF]',
    light: 'bg-[#635BFF]/10',
  },
  green: {
    gradient: 'from-[#00C3A1] to-[#007B6E]',
    bg: 'bg-[#00C3A1]',
    bgHover: 'hover:bg-[#00C3A1]/90',
    text: 'text-[#00C3A1]',
    light: 'bg-[#00C3A1]/10',
  },
  orange: {
    gradient: 'from-[#F5A623] to-[#D4790E]',
    bg: 'bg-[#F5A623]',
    bgHover: 'hover:bg-[#F5A623]/90',
    text: 'text-[#F5A623]',
    light: 'bg-[#F5A623]/10',
  },
  blue: {
    gradient: 'from-[#2969FF] to-[#1A4BB8]',
    bg: 'bg-[#2969FF]',
    bgHover: 'hover:bg-[#2969FF]/90',
    text: 'text-[#2969FF]',
    light: 'bg-[#2969FF]/10',
  },
};

// Snooze duration options (in days)
const SNOOZE_DAYS = 7;

/**
 * Pre-Create Event Modal
 * Shows before event creation to encourage payment gateway setup
 */
export function PreCreateEventPrompt({
  open,
  onClose,
  onSetup,
  onSkip,
  onDontShowAgain,
  onRemindLater,
  countryCode
}) {
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const gatewayInfo = getGatewayInfo(countryCode);
  const colors = COLORS[gatewayInfo.color] || COLORS.blue;

  const handleSkip = () => {
    if (dontShowAgain) {
      onDontShowAgain?.();
    }
    onSkip?.();
  };

  const handleSetup = () => {
    onSetup?.();
  };

  const handleRemindLater = () => {
    onRemindLater?.();
    onClose?.();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
        {/* Header */}
        <div className={`bg-gradient-to-br ${colors.gradient} p-6 text-white`}>
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
              Get Paid Faster!
            </DialogTitle>
            <DialogDescription className="text-white/80 text-base">
              Set up {gatewayInfo.name} to receive automatic payouts after your events.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Benefits */}
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-[#0F0F0F]">Automatic Payouts</p>
                <p className="text-sm text-[#0F0F0F]/60">
                  Receive funds within 2-7 business days - no manual requests needed
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-[#0F0F0F]">Transparent Fees</p>
                <p className="text-sm text-[#0F0F0F]/60">
                  Clear breakdown of all charges - know exactly what you'll receive
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-[#0F0F0F]">Professional Experience</p>
                <p className="text-sm text-[#0F0F0F]/60">
                  Trusted payment processing for your attendees
                </p>
              </div>
            </div>
          </div>

          {/* Setup time */}
          <div className="flex items-center gap-2 text-sm text-[#0F0F0F]/60 bg-[#F4F6FA] rounded-xl p-3">
            <Clock className="w-4 h-4" />
            <span>Setup takes less than 5 minutes</span>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <Button
              onClick={handleSetup}
              className={`w-full ${colors.bg} ${colors.bgHover} text-white py-6`}
            >
              <CreditCard className="w-4 h-4 mr-2" />
              Set Up {gatewayInfo.name}
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleRemindLater}
                className="flex-1 py-5"
              >
                <Bell className="w-4 h-4 mr-2" />
                Remind in {SNOOZE_DAYS} days
              </Button>
              <Button
                variant="outline"
                onClick={handleSkip}
                className="flex-1 py-5"
              >
                Skip for Now
              </Button>
            </div>
          </div>

          {/* Don't show again */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="dontShowAgain"
              checked={dontShowAgain}
              onCheckedChange={setDontShowAgain}
            />
            <label
              htmlFor="dontShowAgain"
              className="text-sm text-[#0F0F0F]/60 cursor-pointer"
            >
              Don't show this again
            </label>
          </div>

          {/* Alternative gateway note */}
          {gatewayInfo.alt && (
            <p className="text-center text-xs text-[#0F0F0F]/40">
              You can also use {gatewayInfo.alt} in your Finance settings
            </p>
          )}

          {/* No country note */}
          {!countryCode && (
            <p className="text-center text-xs text-[#0F0F0F]/40">
              Set your country in Profile settings for region-specific payment options
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Post-Create Event Modal
 * Shows after successful event creation as a reminder
 */
export function PostCreateEventPrompt({
  open,
  onClose,
  onSetup,
  onRemindLater,
  onDontShowAgain,
  countryCode
}) {
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const gatewayInfo = getGatewayInfo(countryCode);
  const colors = COLORS[gatewayInfo.color] || COLORS.blue;

  const handleClose = () => {
    if (dontShowAgain) {
      onDontShowAgain?.();
    }
    onClose?.();
  };

  const handleRemindLater = () => {
    onRemindLater?.();
    onClose?.();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        {/* Success Header */}
        <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-6 text-white text-center">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-white mb-2">
              Event Created!
            </DialogTitle>
            <DialogDescription className="text-white/80 text-base">
              Your event is ready. One more step to start receiving payments!
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          <div className={`${colors.light} rounded-xl p-4`}>
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 ${colors.bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                <Wallet className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-[#0F0F0F] mb-1">
                  Connect {gatewayInfo.name}
                </h3>
                <p className="text-sm text-[#0F0F0F]/60">
                  Set up your payment gateway to receive automatic payouts when tickets sell.
                </p>
              </div>
            </div>
          </div>

          {/* Quick benefit */}
          <div className="flex items-center gap-3 text-sm">
            <Zap className={`w-5 h-5 ${colors.text}`} />
            <span className="text-[#0F0F0F]/70">
              Automatic payouts within 2-7 business days
            </span>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <Button
              onClick={onSetup}
              className={`w-full ${colors.bg} ${colors.bgHover} text-white py-5`}
            >
              Connect {gatewayInfo.name}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleRemindLater}
                className="flex-1 py-5"
              >
                <Bell className="w-4 h-4 mr-2" />
                Remind Later
              </Button>
              <Button
                variant="outline"
                onClick={handleClose}
                className="flex-1 py-5"
              >
                View Event
              </Button>
            </div>
          </div>

          {/* Don't show again */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="dontShowAgainPost"
              checked={dontShowAgain}
              onCheckedChange={setDontShowAgain}
            />
            <label
              htmlFor="dontShowAgainPost"
              className="text-sm text-[#0F0F0F]/60 cursor-pointer"
            >
              Don't show this again after creating events
            </label>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Dashboard Banner
 * Persistent banner shown on organizer dashboard
 */
export function PaymentGatewayBanner({
  onSetup,
  onDismiss,
  onRemindLater,
  countryCode
}) {
  const gatewayInfo = getGatewayInfo(countryCode);
  const colors = COLORS[gatewayInfo.color] || COLORS.blue;

  return (
    <div className={`bg-gradient-to-r ${colors.gradient} rounded-xl p-4 mb-6`}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
            <Wallet className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-white font-medium truncate">
              Speed up your payouts!
            </p>
            <p className="text-white/70 text-sm truncate">
              Connect {gatewayInfo.name} to receive automatic payments after your events.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            onClick={onSetup}
            className="bg-white text-[#0F0F0F] hover:bg-white/90 text-sm px-4"
          >
            Connect Now
          </Button>
          <Button
            onClick={onRemindLater}
            variant="ghost"
            className="text-white/80 hover:text-white hover:bg-white/10 text-sm px-3"
            title="Remind me in 7 days"
          >
            <Bell className="w-4 h-4" />
          </Button>
          <button
            onClick={onDismiss}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            aria-label="Dismiss permanently"
            title="Don't show again"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Helper Functions for Payment Gateway Checks
// ============================================

/**
 * Check if organizer has an ACTIVE payment gateway connection
 */
export const hasPaymentGateway = (organizer) => {
  if (!organizer) return false;

  // Stripe Connect: check status is active OR has an ID
  const hasStripe = organizer.stripe_connect_status === 'active' ||
                    (organizer.stripe_connect_id && organizer.stripe_connect_enabled);

  // Paystack: check status is active OR has an ID and enabled
  const hasPaystack = organizer.paystack_subaccount_status === 'active' ||
                      (organizer.paystack_subaccount_id && organizer.paystack_subaccount_enabled);

  // Flutterwave: check status is active OR has an ID and enabled
  const hasFlutterwave = organizer.flutterwave_subaccount_status === 'active' ||
                         (organizer.flutterwave_subaccount_id && organizer.flutterwave_subaccount_enabled);

  return hasStripe || hasPaystack || hasFlutterwave;
};

/**
 * Check if a snooze period has expired
 */
const isSnoozeExpired = (snoozedUntil) => {
  if (!snoozedUntil) return true;
  return new Date(snoozedUntil) <= new Date();
};

/**
 * Calculate snooze end date (X days from now)
 */
export const calculateSnoozeUntil = (days = SNOOZE_DAYS) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
};

/**
 * Check if PRE-CREATE prompt should be shown
 * Shows only for first event creation when no payment gateway connected
 */
export const shouldShowPrecreatePrompt = (organizer, eventCount = 0) => {
  if (!organizer) return false;
  if (hasPaymentGateway(organizer)) return false;
  if (organizer.dismissed_precreate_prompt) return false;
  if (!isSnoozeExpired(organizer.precreate_prompt_snoozed_until)) return false;

  // Only show for first event (or first few events)
  if (eventCount > 0) return false;

  return true;
};

/**
 * Check if POST-CREATE prompt should be shown
 * Shows after creating paid events when no payment gateway connected
 */
export const shouldShowPostcreatePrompt = (organizer, hasPaidContent = true) => {
  if (!organizer) return false;
  if (hasPaymentGateway(organizer)) return false;
  if (organizer.dismissed_postcreate_prompt) return false;
  if (!isSnoozeExpired(organizer.postcreate_prompt_snoozed_until)) return false;
  if (!hasPaidContent) return false; // Only show for paid events

  return true;
};

/**
 * Check if DASHBOARD BANNER should be shown
 */
export const shouldShowDashboardBanner = (organizer) => {
  if (!organizer) return false;
  if (hasPaymentGateway(organizer)) return false;
  if (organizer.dismissed_dashboard_banner) return false;
  if (!isSnoozeExpired(organizer.dashboard_banner_snoozed_until)) return false;

  return true;
};

/**
 * Legacy function for backward compatibility
 * @deprecated Use specific prompt check functions instead
 */
export const shouldShowPaymentPrompt = (organizer) => {
  return !hasPaymentGateway(organizer) &&
         !organizer?.dismissed_precreate_prompt &&
         !organizer?.dismissed_postcreate_prompt &&
         !organizer?.dismissed_dashboard_banner;
};

// Export constants and helpers
export { GATEWAY_BY_COUNTRY, getGatewayInfo, SNOOZE_DAYS, DEFAULT_GATEWAY };
