import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Calendar, MapPin, Users, Clock, CreditCard, Loader2, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/config/currencies';
import { getShareByToken, recordSharePayment, getTimeRemaining, formatShareStatus } from '@/services/splitPayment';
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
    } catch (err) {
      console.error('Error loading share:', err);
      setError(err.message || 'Invalid or expired payment link');
    } finally {
      setLoading(false);
    }
  };

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

    setPaying(true);

    try {
      // Initialize Paystack payment
      const handler = window.PaystackPop.setup({
        key: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY,
        email: share.email,
        amount: Math.round(share.share_amount * 100), // Convert to kobo
        currency: splitPayment.currency,
        ref: `SPLIT-${share.id}-${Date.now()}`,
        metadata: {
          type: 'split_payment',
          share_id: share.id,
          split_payment_id: splitPayment.id,
          event_id: event.id,
          payer_name: share.name,
          payer_email: share.email
        },
        callback: async (response) => {
          try {
            // Record the payment
            const result = await recordSharePayment(
              share.id,
              response.reference,
              'paystack'
            );

            if (result.all_paid) {
              toast.success('All shares paid! Tickets will be issued shortly.');
            } else {
              toast.success('Payment successful! Waiting for others to pay.');
            }

            // Reload to show updated status
            await loadShareData();
          } catch (err) {
            console.error('Error recording payment:', err);
            toast.error('Payment recorded but there was an error. Please contact support.');
          } finally {
            setPaying(false);
          }
        },
        onClose: () => {
          setPaying(false);
        }
      });

      handler.openIframe();
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
            <h2 className="text-xl font-bold text-[#0F0F0F] mb-2">Invalid Link</h2>
            <p className="text-[#0F0F0F]/60 mb-6">{error}</p>
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
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4 py-8">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-[#0F0F0F] mb-2">Payment Complete!</h2>
            <p className="text-[#0F0F0F]/60 mb-6">
              You've paid your share for <strong>{event?.title}</strong>
            </p>
            <div className="bg-green-50 rounded-xl p-4 mb-6">
              <div className="text-2xl font-bold text-green-600">
                {formatPrice(share?.share_amount, splitPayment?.currency)}
              </div>
              <div className="text-sm text-green-600">Paid on {new Date(share?.paid_at).toLocaleDateString()}</div>
            </div>
            <p className="text-sm text-[#0F0F0F]/50 mb-6">
              {splitPayment?.status === 'completed' 
                ? 'All shares have been paid! Tickets will be sent to your email.'
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
            <h2 className="text-xl font-bold text-[#0F0F0F] mb-2">Payment Expired</h2>
            <p className="text-[#0F0F0F]/60 mb-6">
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
          <h1 className="text-2xl font-bold text-[#0F0F0F]">Pay Your Share</h1>
          <p className="text-[#0F0F0F]/60 mt-1">
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
            <h2 className="font-semibold text-lg text-[#0F0F0F]">{event?.title}</h2>
            <div className="mt-2 space-y-1 text-sm text-[#0F0F0F]/60">
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
              Split Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Tickets */}
            <div className="space-y-2">
              {splitPayment?.ticket_selection?.map((ticket, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span>{ticket.quantity}x {ticket.name}</span>
                  <span className="text-[#0F0F0F]/60">
                    {formatPrice(ticket.price * ticket.quantity, splitPayment.currency)}
                  </span>
                </div>
              ))}
              <div className="border-t pt-2 flex justify-between">
                <span>Total (split {splitPayment?.member_count} ways)</span>
                <span className="font-medium">
                  {formatPrice(splitPayment?.grand_total, splitPayment?.currency)}
                </span>
              </div>
            </div>

            {/* Your Share */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4">
              <div className="text-center">
                <div className="text-sm text-[#0F0F0F]/60 mb-1">Your Share</div>
                <div className="text-3xl font-bold text-[#2969FF]">
                  {formatPrice(share?.share_amount, splitPayment?.currency)}
                </div>
              </div>
            </div>

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
          disabled={paying}
          className="w-full h-14 bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl text-lg"
        >
          {paying ? (
            <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Processing...</>
          ) : (
            <><CreditCard className="w-5 h-5 mr-2" />Pay {formatPrice(share?.share_amount, splitPayment?.currency)}</>
          )}
        </Button>

        {/* Info */}
        <p className="text-center text-xs text-[#0F0F0F]/50">
          Secure payment powered by Paystack. Tickets will be issued once all {splitPayment?.member_count} members have paid.
        </p>
      </div>
    </div>
  );
}
