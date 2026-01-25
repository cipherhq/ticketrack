import { useState, useEffect } from 'react';
import { Users, Clock, Check, X, Mail, MessageCircle, Loader2, AlertCircle, Copy, ExternalLink, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { formatPrice } from '@/config/currencies';
import { 
  getSplitPayment, 
  getSplitShares, 
  sendPaymentReminder, 
  subscribeToSplitPayment,
  getPayYourShareLink,
  getTimeRemaining,
  formatShareStatus,
  formatSplitStatus,
  cancelSplitPayment
} from '@/services/splitPayment';
import { toast } from 'sonner';

export function SplitPaymentTracker({ splitPaymentId, onComplete, onCancel }) {
  const [splitData, setSplitData] = useState(null);
  const [shares, setShares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sendingReminder, setSendingReminder] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    loadData();
    
    // Subscribe to real-time updates
    const unsubscribe = subscribeToSplitPayment(splitPaymentId, {
      onShareUpdate: (payload) => {
        console.log('Share updated:', payload);
        loadData(); // Reload data on any change
      },
      onSplitUpdate: (payload) => {
        console.log('Split updated:', payload);
        if (payload.status === 'completed') {
          toast.success('All payments received! Tickets are being issued.');
          onComplete?.();
        }
      }
    });

    return () => unsubscribe();
  }, [splitPaymentId]);

  // Update time remaining every minute
  useEffect(() => {
    if (!splitData?.split_payment?.expires_at) return;
    
    const updateTime = () => {
      setTimeRemaining(getTimeRemaining(splitData.split_payment.expires_at));
    };
    
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, [splitData]);

  const loadData = async () => {
    try {
      const data = await getSplitPayment(splitPaymentId);
      setSplitData(data);
      setShares(data.shares || []);
    } catch (err) {
      console.error('Error loading split payment:', err);
      toast.error('Failed to load payment status');
    } finally {
      setLoading(false);
    }
  };

  const handleSendReminder = async (share) => {
    setSendingReminder(share.id);
    try {
      await sendPaymentReminder(share.id);
      toast.success(`Reminder sent to ${share.name || share.email}`);
      await loadData();
    } catch (err) {
      console.error('Error sending reminder:', err);
      toast.error('Failed to send reminder');
    } finally {
      setSendingReminder(null);
    }
  };

  const handleCopyLink = async (share) => {
    const link = getPayYourShareLink(share.payment_token);
    await navigator.clipboard.writeText(link);
    toast.success('Payment link copied!');
  };

  const handleCancel = async () => {
    if (!confirm('Cancel this split payment? Any payments made will be refunded.')) return;
    
    setCancelling(true);
    try {
      await cancelSplitPayment(splitPaymentId);
      toast.success('Split payment cancelled');
      onCancel?.();
    } catch (err) {
      console.error('Error cancelling:', err);
      toast.error('Failed to cancel');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#2969FF] mx-auto" />
          <p className="mt-2 text-[#0F0F0F]/60">Loading payment status...</p>
        </CardContent>
      </Card>
    );
  }

  if (!splitData) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
          <p className="mt-2 text-[#0F0F0F]/60">Could not load payment data</p>
        </CardContent>
      </Card>
    );
  }

  const split = splitData.split_payment;
  const paidCount = splitData.paid_count || 0;
  const totalCount = shares.length;
  const progress = totalCount > 0 ? (paidCount / totalCount) * 100 : 0;
  const splitStatus = formatSplitStatus(split?.status);

  return (
    <Card className="border-[#0F0F0F]/10">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-5 h-5" />
            Split Payment Status
          </CardTitle>
          <Badge className={`bg-${splitStatus.color}-100 text-${splitStatus.color}-700`}>
            {splitStatus.label}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-[#0F0F0F]/60">{paidCount} of {totalCount} paid</span>
            <span className="font-medium">
              {formatPrice(splitData.total_paid || 0, split?.currency)} / {formatPrice(split?.grand_total, split?.currency)}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Time Remaining */}
        {split?.status === 'pending' || split?.status === 'partial' ? (
          <div className={`flex items-center justify-center gap-2 p-3 rounded-xl ${
            timeRemaining?.urgent ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
          }`}>
            <Clock className="w-4 h-4" />
            <span className="font-medium">{timeRemaining?.text || 'Calculating...'}</span>
          </div>
        ) : null}

        {/* Member List */}
        <div className="space-y-2">
          {shares.map((share) => {
            const status = formatShareStatus(share.payment_status);
            const isPaid = share.payment_status === 'paid';
            
            return (
              <div 
                key={share.id}
                className={`flex items-center justify-between p-3 rounded-xl ${
                  isPaid ? 'bg-green-50' : 'bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    isPaid ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
                  }`}>
                    {isPaid ? <Check className="w-4 h-4" /> : share.name?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <div>
                    <div className="font-medium text-sm">{share.name || share.email?.split('@')[0]}</div>
                    <div className="text-xs text-[#0F0F0F]/50">{share.email}</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="text-right mr-2">
                    <div className="font-medium text-sm">
                      {formatPrice(share.share_amount, split?.currency)}
                    </div>
                    <div className={`text-xs text-${status.color}-600`}>
                      {status.label}
                    </div>
                  </div>
                  
                  {!isPaid && split?.status !== 'completed' && split?.status !== 'expired' && (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleCopyLink(share)}
                        title="Copy payment link"
                        className="h-8 w-8"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleSendReminder(share)}
                        disabled={sendingReminder === share.id}
                        title="Send reminder"
                        className="h-8 w-8"
                      >
                        {sendingReminder === share.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Mail className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  )}
                  
                  {isPaid && (
                    <Check className="w-5 h-5 text-green-500" />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Actions */}
        {split?.status === 'pending' || split?.status === 'partial' ? (
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={loadData}
              className="flex-1 rounded-xl"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={cancelling}
              className="flex-1 rounded-xl text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              {cancelling ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <X className="w-4 h-4 mr-2" />}
              Cancel Split
            </Button>
          </div>
        ) : null}

        {split?.status === 'completed' && (
          <div className="p-4 bg-green-50 rounded-xl text-center">
            <Check className="w-8 h-8 text-green-500 mx-auto mb-2" />
            <p className="font-medium text-green-700">All payments received!</p>
            <p className="text-sm text-green-600">Tickets are being issued to all members.</p>
          </div>
        )}

        {split?.status === 'expired' && (
          <div className="p-4 bg-red-50 rounded-xl text-center">
            <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
            <p className="font-medium text-red-700">Payment deadline passed</p>
            <p className="text-sm text-red-600">This split payment has expired. Payments will be refunded.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
