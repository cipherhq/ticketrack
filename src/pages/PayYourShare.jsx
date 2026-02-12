import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Calendar, MapPin, Users, Clock, CreditCard, Loader2, CheckCircle2, AlertCircle, XCircle, Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { formatPrice } from '@/config/currencies';
import { getPaymentProvider, getProviderInfo } from '@/config/payments';
import { getShareByToken, recordSharePayment, recordPoolContribution, getSplitShares, subscribeToSplitPayment, getTimeRemaining, formatShareStatus } from '@/services/splitPayment';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export function PayYourShare() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState(null);
  const [shareData, setShareData] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [allShares, setAllShares] = useState([]);
  const [contributionAmount, setContributionAmount] = useState('');

  useEffect(() => {
    loadShareData();
  }, [token]);

  // Update time remaining every minute
  useEffect(() => {
    if (!shareData?.split_payment?.expires_at) return;
    
    const updateTime = () => {
      setTimeRemaining(getTimeRemaining(shareData.split_payment.expires_at));
    };
    
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, [shareData]);

  const loadShareData = async () => {
    try {
      setLoading(true);
      const data = await getShareByToken(token);
      setShareData(data);

      // For pool mode, fetch all shares for progress display
      if (data?.split_payment?.split_type === 'pool' && data?.split_payment?.id) {
        const shares = await getSplitShares(data.split_payment.id);
        setAllShares(shares);
      }
    } catch (err) {
      console.error('Error loading share:', err);
      setError(err.message || 'Invalid or expired payment link');
    } finally {
      setLoading(false);
    }
  };

  // Subscribe to real-time updates for pool mode
  useEffect(() => {
    if (!shareData?.split_payment?.id || shareData?.split_payment?.split_type !== 'pool') return;

    const unsubscribe = subscribeToSplitPayment(shareData.split_payment.id, {
      onShareUpdate: async () => {
        const shares = await getSplitShares(shareData.split_payment.id);
        setAllShares(shares);
        // Reload share data to get updated amount_collected
        const data = await getShareByToken(token);
        setShareData(data);
      },
      onSplitUpdate: (payload) => {
        if (payload.status === 'completed') {
          toast.success('Pool target reached! Tickets are being issued.');
        }
      }
    });

    return () => unsubscribe();
  }, [shareData?.split_payment?.id, shareData?.split_payment?.split_type]);

  // Determine payment provider based on currency
  const paymentProvider = shareData?.split_payment?.currency 
    ? getPaymentProvider(shareData.split_payment.currency) 
    : 'paystack';
  const providerInfo = getProviderInfo(shareData?.split_payment?.currency || 'NGN');

  // Determine if this is a pool payment
  const isPoolMode = shareData?.split_payment?.split_type === 'pool';

  // Pool calculations
  const poolAmountCollected = parseFloat(shareData?.split_payment?.amount_collected || 0);
  const poolGrandTotal = parseFloat(shareData?.split_payment?.grand_total || 0);
  const poolRemaining = Math.max(0, Math.round((poolGrandTotal - poolAmountCollected) * 100) / 100);
  const poolProgress = poolGrandTotal > 0 ? (poolAmountCollected / poolGrandTotal) * 100 : 0;

  // Get the actual payment amount (pool: user-chosen, equal: fixed share)
  const getPaymentAmount = () => {
    if (isPoolMode) {
      return parseFloat(contributionAmount) || 0;
    }
    return shareData?.share?.share_amount || 0;
  };

  // Currency minimums
  const currencyMinimums = { NGN: 100, GHS: 1, KES: 1, ZAR: 1, USD: 1, GBP: 1, EUR: 1, CAD: 1, AUD: 1 };
  const minAmount = currencyMinimums[shareData?.split_payment?.currency] || 1;

  // Quick amount buttons for pool
  const quickAmounts = useMemo(() => {
    if (!isPoolMode || poolRemaining <= 0) return [];
    const amounts = [
      Math.round(poolRemaining * 0.25 * 100) / 100,
      Math.round(poolRemaining * 0.5 * 100) / 100,
      poolRemaining
    ].filter(a => a >= minAmount);
    // Deduplicate
    return [...new Set(amounts)];
  }, [isPoolMode, poolRemaining, minAmount]);

  // Handle Paystack payment (NGN, GHS, KES, ZAR)
  const handlePaystackPayment = async (share, splitPayment, event) => {
    if (!window.PaystackPop) {
      toast.error('Payment system not loaded. Please refresh the page.');
      setPaying(false);
      return;
    }

    const payAmount = getPaymentAmount();

    const handler = window.PaystackPop.setup({
      key: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY,
      email: share.email,
      amount: Math.round(payAmount * 100), // Convert to kobo/pesewas
      currency: splitPayment.currency,
      ref: `SPLIT-${share.id}-${Date.now()}`,
      metadata: {
        type: 'split_payment',
        share_id: share.id,
        split_payment_id: splitPayment.id,
        event_id: event.id,
        payer_name: share.name,
        payer_email: share.email,
        ...(isPoolMode && { split_type: 'pool', pool_amount: payAmount })
      },
      callback: async (response) => {
        if (isPoolMode) {
          await handlePoolPaymentSuccess(share.id, payAmount, response.reference, 'paystack');
        } else {
          await handlePaymentSuccess(share.id, response.reference, 'paystack');
        }
      },
      onClose: () => {
        setPaying(false);
      }
    });

    handler.openIframe();
  };

  // Handle Flutterwave payment (backup for African currencies)
  const handleFlutterwavePayment = async (share, splitPayment, event) => {
    try {
      const payAmount = getPaymentAmount();
      const { data, error } = await supabase.functions.invoke('create-split-flutterwave-checkout', {
        body: {
          shareId: share.id,
          splitPaymentId: splitPayment.id,
          email: share.email,
          name: share.name,
          amount: payAmount,
          currency: splitPayment.currency,
          eventTitle: event.title,
          successUrl: `${window.location.origin}/pay-share/${token}?status=success`,
          cancelUrl: `${window.location.origin}/pay-share/${token}?status=cancelled`,
          ...(isPoolMode && { splitType: 'pool', poolAmount: payAmount })
        }
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('Failed to create payment link');
      }
    } catch (err) {
      console.error('Flutterwave error:', err);
      toast.error('Failed to initialize payment. Please try again.');
      setPaying(false);
    }
  };

  // Handle Stripe payment (USD, GBP, EUR, CAD, AUD)
  const handleStripePayment = async (share, splitPayment, event) => {
    try {
      const payAmount = getPaymentAmount();
      const { data, error } = await supabase.functions.invoke('create-split-stripe-checkout', {
        body: {
          shareId: share.id,
          splitPaymentId: splitPayment.id,
          email: share.email,
          name: share.name,
          amount: payAmount,
          currency: splitPayment.currency,
          eventTitle: event.title,
          successUrl: `${window.location.origin}/pay-share/${token}?status=success`,
          cancelUrl: `${window.location.origin}/pay-share/${token}?status=cancelled`,
          ...(isPoolMode && { splitType: 'pool', poolAmount: payAmount })
        }
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('Failed to create Stripe checkout session');
      }
    } catch (err) {
      console.error('Stripe error:', err);
      toast.error('Failed to initialize payment. Please try again.');
      setPaying(false);
    }
  };

  // Handle successful payment callback (equal split)
  const handlePaymentSuccess = async (shareId, reference, provider) => {
    try {
      const result = await recordSharePayment(shareId, reference, provider);

      if (result.all_paid) {
        toast.success('All shares paid! Tickets will be issued shortly.');
      } else {
        toast.success('Payment successful! Waiting for others to pay.');
      }

      await loadShareData();
    } catch (err) {
      console.error('Error recording payment:', err);
      toast.error('Payment recorded but there was an error. Please contact support.');
    } finally {
      setPaying(false);
    }
  };

  // Handle successful pool contribution
  const handlePoolPaymentSuccess = async (shareId, amount, reference, provider) => {
    try {
      const result = await recordPoolContribution(shareId, amount, reference, provider);

      if (result.all_paid) {
        toast.success('Pool target reached! Tickets will be issued shortly.');
      } else {
        toast.success(`Contribution of ${formatPrice(amount, shareData?.split_payment?.currency)} recorded! ${formatPrice(result.grand_total - result.amount_collected, shareData?.split_payment?.currency)} remaining.`);
      }

      await loadShareData();
    } catch (err) {
      console.error('Error recording pool contribution:', err);
      toast.error('Payment recorded but there was an error. Please contact support.');
    } finally {
      setPaying(false);
    }
  };

  // Check for payment redirect status on page load
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get('status');
    
    if (status === 'success') {
      toast.success('Payment successful! Updating status...');
      // Clear the URL params
      window.history.replaceState({}, '', `/pay-share/${token}`);
      loadShareData();
    } else if (status === 'cancelled') {
      toast.info('Payment was cancelled');
      window.history.replaceState({}, '', `/pay-share/${token}`);
    }
  }, [token]);

  const handlePayment = async () => {
    if (!shareData) return;

    const share = shareData.share;
    const splitPayment = shareData.split_payment;
    const event = shareData.event;

    // Check if already paid
    if (share.payment_status === 'paid') {
      toast.info('You have already paid your share!');
      return;
    }

    // Check if expired
    if (timeRemaining?.expired) {
      toast.error('This payment link has expired');
      return;
    }

    // Pool-specific validation
    if (isPoolMode) {
      const amount = parseFloat(contributionAmount);
      if (!amount || amount < minAmount) {
        toast.error(`Minimum contribution is ${formatPrice(minAmount, splitPayment.currency)}`);
        return;
      }
      if (amount > poolRemaining) {
        toast.error(`Maximum contribution is ${formatPrice(poolRemaining, splitPayment.currency)} (remaining amount)`);
        return;
      }
    }

    setPaying(true);

    try {
      // Route to appropriate payment provider based on currency
      const provider = getPaymentProvider(splitPayment.currency);

      switch (provider) {
        case 'stripe':
          await handleStripePayment(share, splitPayment, event);
          break;
        case 'flutterwave':
          await handleFlutterwavePayment(share, splitPayment, event);
          break;
        case 'paystack':
        default:
          await handlePaystackPayment(share, splitPayment, event);
          break;
      }
    } catch (err) {
      console.error('Payment error:', err);
      toast.error('Failed to initialize payment');
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-foreground mb-2">Invalid Link</h2>
            <p className="text-muted-foreground mb-6">{error}</p>
            <Button onClick={() => navigate('/')} className="rounded-xl">
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const share = shareData?.share;
  const splitPayment = shareData?.split_payment;
  const event = shareData?.event;
  const status = formatShareStatus(share?.payment_status);

  if (share?.payment_status === 'paid') {
    const paidPoolCollected = parseFloat(splitPayment?.amount_collected || 0);
    const paidPoolTotal = parseFloat(splitPayment?.grand_total || 0);
    const paidPoolProgress = paidPoolTotal > 0 ? (paidPoolCollected / paidPoolTotal) * 100 : 0;

    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4 py-8">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-foreground mb-2">
              {splitPayment?.split_type === 'pool' ? 'Contribution Received!' : 'Payment Complete!'}
            </h2>
            <p className="text-muted-foreground mb-6">
              {splitPayment?.split_type === 'pool'
                ? <>You contributed to <strong>{event?.title}</strong></>
                : <>You've paid your share for <strong>{event?.title}</strong></>
              }
            </p>
            <div className="bg-green-50 rounded-xl p-4 mb-6">
              <div className="text-2xl font-bold text-green-600">
                {formatPrice(share?.share_amount, splitPayment?.currency)}
              </div>
              <div className="text-sm text-green-600">
                {splitPayment?.split_type === 'pool' ? 'Contributed' : 'Paid'} on {new Date(share?.paid_at).toLocaleDateString()}
              </div>
            </div>

            {/* Pool progress for paid state */}
            {splitPayment?.split_type === 'pool' && splitPayment?.status !== 'completed' && (
              <div className="mb-6 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Pool Progress</span>
                  <span className="font-medium">
                    {formatPrice(paidPoolCollected, splitPayment?.currency)} / {formatPrice(paidPoolTotal, splitPayment?.currency)}
                  </span>
                </div>
                <Progress value={paidPoolProgress} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {Math.round(paidPoolProgress)}% funded &middot; {formatPrice(paidPoolTotal - paidPoolCollected, splitPayment?.currency)} remaining
                </p>
              </div>
            )}

            <p className="text-sm text-muted-foreground mb-6">
              {splitPayment?.status === 'completed'
                ? 'All shares have been paid! Tickets will be sent to your email.'
                : splitPayment?.split_type === 'pool'
                  ? 'Waiting for the pool to reach its target...'
                  : 'Waiting for other members to pay their shares...'}
            </p>
            <Button onClick={() => navigate(`/e/${event?.slug}`)} className="rounded-xl">
              View Event
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (timeRemaining?.expired) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4 py-8">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-foreground mb-2">Payment Expired</h2>
            <p className="text-muted-foreground mb-6">
              This split payment has expired. The deadline was {new Date(splitPayment?.expires_at).toLocaleString()}.
            </p>
            <Button onClick={() => navigate(`/e/${event?.slug}`)} className="rounded-xl">
              View Event
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] py-8 px-4">
      <div className="max-w-lg mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">Pay Your Share</h1>
          <p className="text-muted-foreground mt-1">
            {share?.name || 'Friend'}, here's your share of the tickets
          </p>
        </div>

        {/* Event Card */}
        <Card className="overflow-hidden">
          {event?.image_url && (
            <img 
              src={event.image_url} 
              alt={event?.title}
              className="w-full h-40 object-cover"
            />
          )}
          <CardContent className="p-4">
            <h2 className="font-semibold text-lg text-foreground">{event?.title}</h2>
            <div className="mt-2 space-y-1 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {new Date(event?.start_date).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </div>
              {event?.venue_name && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  {event.venue_name}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Split Details */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="w-5 h-5" />
              {isPoolMode ? 'Pool Details' : 'Split Details'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Tickets */}
            <div className="space-y-2">
              {splitPayment?.ticket_selection?.map((ticket, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span>{ticket.quantity}x {ticket.name}</span>
                  <span className="text-muted-foreground">
                    {formatPrice(ticket.price * ticket.quantity, splitPayment.currency)}
                  </span>
                </div>
              ))}
              <div className="border-t pt-2 flex justify-between">
                <span>{isPoolMode ? 'Pool Target' : `Total (split ${splitPayment?.member_count} ways)`}</span>
                <span className="font-medium">
                  {formatPrice(splitPayment?.grand_total, splitPayment?.currency)}
                </span>
              </div>
            </div>

            {isPoolMode ? (
              <>
                {/* Pool Progress Bar */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 space-y-3">
                  <div className="text-sm font-medium text-center">Pool Progress</div>
                  <Progress value={poolProgress} className="h-3" />
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold text-[#2969FF]">
                      {formatPrice(poolAmountCollected, splitPayment?.currency)}
                    </span>
                    <span className="text-muted-foreground">
                      of {formatPrice(poolGrandTotal, splitPayment?.currency)}
                    </span>
                  </div>
                  <div className="text-center text-xs text-muted-foreground">
                    {Math.round(poolProgress)}% funded &middot; {formatPrice(poolRemaining, splitPayment?.currency)} remaining
                  </div>
                </div>

                {/* Contributors List */}
                {allShares.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Contributors</div>
                    {allShares.map((s) => {
                      const isPaid = s.payment_status === 'paid';
                      const isCurrentUser = s.id === share?.id;
                      return (
                        <div
                          key={s.id}
                          className={`flex items-center justify-between py-2 px-3 rounded-lg text-sm ${
                            isCurrentUser ? 'bg-blue-50 border border-blue-200' : isPaid ? 'bg-green-50' : 'bg-muted/50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {isPaid ? (
                              <Check className="w-4 h-4 text-green-500" />
                            ) : (
                              <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30" />
                            )}
                            <span className={isCurrentUser ? 'font-medium' : ''}>
                              {isCurrentUser ? 'You' : (s.name || s.email?.split('@')[0])}
                            </span>
                          </div>
                          <span className={isPaid ? 'text-green-600 font-medium' : 'text-muted-foreground'}>
                            {isPaid ? formatPrice(s.share_amount, splitPayment?.currency) : 'awaiting'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Amount Input */}
                <div className="space-y-3">
                  <div className="text-sm font-medium">Choose your contribution</div>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                      {splitPayment?.currency}
                    </span>
                    <Input
                      type="number"
                      min={minAmount}
                      max={poolRemaining}
                      step="0.01"
                      value={contributionAmount}
                      onChange={(e) => setContributionAmount(e.target.value)}
                      placeholder="0.00"
                      className="pl-14 h-14 text-xl font-semibold rounded-xl"
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Min: {formatPrice(minAmount, splitPayment?.currency)}</span>
                    <span>Max: {formatPrice(poolRemaining, splitPayment?.currency)} (remaining)</span>
                  </div>

                  {/* Quick Amount Buttons */}
                  {quickAmounts.length > 0 && (
                    <div className="flex gap-2">
                      {quickAmounts.map((amount) => (
                        <Button
                          key={amount}
                          variant="outline"
                          size="sm"
                          onClick={() => setContributionAmount(amount.toString())}
                          className={`flex-1 rounded-lg ${
                            parseFloat(contributionAmount) === amount ? 'border-[#2969FF] bg-blue-50 text-[#2969FF]' : ''
                          }`}
                        >
                          {formatPrice(amount, splitPayment?.currency)}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* Equal Split: Your Share */
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4">
                <div className="text-center">
                  <div className="text-sm text-muted-foreground mb-1">Your Share</div>
                  <div className="text-3xl font-bold text-[#2969FF]">
                    {formatPrice(share?.share_amount, splitPayment?.currency)}
                  </div>
                </div>
              </div>
            )}

            {/* Deadline */}
            <div className={`flex items-center justify-center gap-2 p-3 rounded-xl ${
              timeRemaining?.urgent ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
            }`}>
              <Clock className="w-4 h-4" />
              <span className="font-medium">{timeRemaining?.text}</span>
            </div>
          </CardContent>
        </Card>

        {/* Pay Button */}
        <Button
          onClick={handlePayment}
          disabled={paying || (isPoolMode && (!contributionAmount || parseFloat(contributionAmount) < minAmount))}
          className="w-full h-14 bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl text-lg"
        >
          {paying ? (
            <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Processing...</>
          ) : (
            <><CreditCard className="w-5 h-5 mr-2" />
              {isPoolMode
                ? `Pay ${contributionAmount ? formatPrice(parseFloat(contributionAmount), splitPayment?.currency) : formatPrice(0, splitPayment?.currency)}`
                : `Pay ${formatPrice(share?.share_amount, splitPayment?.currency)}`
              }
            </>
          )}
        </Button>

        {/* Info */}
        <p className="text-center text-xs text-muted-foreground">
          Secure payment powered by {providerInfo.name}.
          {isPoolMode
            ? ` Tickets will be issued once the pool target of ${formatPrice(splitPayment?.grand_total, splitPayment?.currency)} is reached.`
            : ` Tickets will be issued once all ${splitPayment?.member_count} members have paid.`
          }
        </p>
      </div>
    </div>
  );
}
