import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useOrganizer } from '../../contexts/OrganizerContext';
import { MessageSquare, CreditCard, History, Wallet, Check, AlertCircle } from 'lucide-react';
import { sendWhatsAppCreditsPurchasedEmail } from '@/lib/emailService';

export default function BuyWhatsAppCredits() {
  const { organizer } = useOrganizer();
  const [packages, setPackages] = useState([]);
  const [wallet, setWallet] = useState(null);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (organizer?.id) loadData();
  }, [organizer?.id]);

  const loadData = async () => {
    try {
      // Get or create wallet
      let { data: walletData } = await supabase.from('organizer_whatsapp_wallet').select('*').eq('organizer_id', organizer.id).single();
      if (!walletData) {
        const { data: newWallet } = await supabase.from('organizer_whatsapp_wallet').insert({ organizer_id: organizer.id }).select().single();
        walletData = newWallet;
      }
      setWallet(walletData);

      // Load packages
      const { data: pkgs } = await supabase.from('whatsapp_credit_packages').select('*').eq('is_active', true).order('price');
      setPackages(pkgs || []);

      // Load purchase history
      const { data: history } = await supabase.from('whatsapp_credit_purchases').select('*, whatsapp_credit_packages(name)').eq('organizer_id', organizer.id).order('created_at', { ascending: false }).limit(10);
      setPurchases(history || []);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (pkg) => {
    setSelectedPackage(pkg);
    setPurchasing(true);
    setError('');
    setSuccess('');

    try {
      const { data: purchase, error: purchaseError } = await supabase.from('whatsapp_credit_purchases').insert({
        organizer_id: organizer.id,
        package_id: pkg.id,
        amount: pkg.price,
        credits: pkg.credits,
        payment_status: 'pending'
      }).select().single();

      if (purchaseError) throw purchaseError;

      const handler = window.PaystackPop.setup({
        key: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY,
        email: organizer.email || 'customer@ticketrack.com',
        amount: pkg.price * 100,
        currency: 'NGN',
        ref: `wa_${purchase.id}_${Date.now()}`,
        metadata: { purchase_id: purchase.id, type: 'whatsapp_credits' },
        callback: async function(response) {
          try {
            await supabase.from('whatsapp_credit_purchases').update({ payment_reference: response.reference, payment_status: 'completed' }).eq('id', purchase.id);

            // Add credits to wallet
            const newBalance = (wallet?.balance || 0) + pkg.credits;
            const newTotal = (wallet?.total_purchased || 0) + pkg.credits;
            await supabase.from('organizer_whatsapp_wallet').update({ balance: newBalance, total_purchased: newTotal, updated_at: new Date().toISOString() }).eq('organizer_id', organizer.id);

            // Send confirmation email
            const organizerEmail = organizer.email || organizer.business_email;
            if (organizerEmail) {
              sendWhatsAppCreditsPurchasedEmail(organizerEmail, {
                units: pkg.credits,
                amount: pkg.price,
                currency: 'NGN',
                newBalance: newBalance,
              }, organizer.id);
            }

            setSuccess(`Successfully purchased ${pkg.name}! $${pkg.credits} credits added.`);
            loadData();
          } catch (err) {
            setError('Payment received but failed to add credits. Contact support.');
          }
          setPurchasing(false);
          setSelectedPackage(null);
        },
        onClose: function() {
          supabase.from('whatsapp_credit_purchases').update({ payment_status: 'cancelled' }).eq('id', purchase.id);
          setPurchasing(false);
          setSelectedPackage(null);
        }
      });
      handler.openIframe();
    } catch (err) {
      setError(err.message || 'Failed to initiate payment');
      setPurchasing(false);
      setSelectedPackage(null);
    }
  };

  const calculateMessages = (credits) => Math.floor(credits / 0.0156);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div></div>;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">WhatsApp Credits</h1>
        <p className="text-gray-600">Purchase credits to send WhatsApp messages to attendees</p>
      </div>

      {error && <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700"><AlertCircle className="w-5 h-5" />{error}</div>}
      {success && <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3 text-green-700"><Check className="w-5 h-5" />{success}</div>}

      <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3 mb-2">
          <Wallet className="w-6 h-6" />
          <span className="text-green-100">Your WhatsApp Balance</span>
        </div>
        <div className="text-4xl font-bold">${parseFloat(wallet?.balance || 0).toFixed(4)}</div>
        <div className="text-green-100 mt-1">≈ {calculateMessages(wallet?.balance || 0).toLocaleString()} utility messages</div>
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div><p className="text-green-100">Total Purchased</p><p className="font-semibold">${parseFloat(wallet?.total_purchased || 0).toFixed(2)}</p></div>
          <div><p className="text-green-100">Total Used</p><p className="font-semibold">${parseFloat(wallet?.total_used || 0).toFixed(4)}</p></div>
        </div>
      </div>

      <div className="bg-white rounded-xl border p-4">
        <h3 className="font-semibold mb-3">Message Rates</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div className="p-3 bg-blue-50 rounded-lg"><p className="font-medium text-blue-700">Utility</p><p className="text-blue-600">$0.0156/msg</p><p className="text-xs text-gray-500">Tickets, reminders</p></div>
          <div className="p-3 bg-purple-50 rounded-lg"><p className="font-medium text-purple-700">Marketing</p><p className="text-purple-600">$0.0683/msg</p><p className="text-xs text-gray-500">Promos, announcements</p></div>
          <div className="p-3 bg-amber-50 rounded-lg"><p className="font-medium text-amber-700">Authentication</p><p className="text-amber-600">$0.0078/msg</p><p className="text-xs text-gray-500">OTP, verification</p></div>
          <div className="p-3 bg-green-50 rounded-lg"><p className="font-medium text-green-700">Service</p><p className="text-green-600">FREE</p><p className="text-xs text-gray-500">Replies (24hr window)</p></div>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">Buy Credit Packages</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {packages.length === 0 ? (
            <div className="col-span-3 text-center p-8 bg-gray-50 rounded-xl text-gray-500">No packages available yet</div>
          ) : packages.map(pkg => (
            <div key={pkg.id} className="bg-white rounded-xl border p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="w-5 h-5 text-green-600" />
                <h3 className="font-semibold">{pkg.name}</h3>
              </div>
              <div className="text-3xl font-bold text-green-600 mb-1">${pkg.credits}</div>
              <p className="text-gray-600 text-sm mb-2">≈ {calculateMessages(pkg.credits).toLocaleString()} utility messages</p>
              <p className="text-gray-500 text-sm mb-4">{pkg.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold">₦{parseFloat(pkg.price).toLocaleString()}</span>
                <button onClick={() => handlePurchase(pkg)} disabled={purchasing} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  {purchasing && selectedPackage?.id === pkg.id ? 'Processing...' : 'Buy Now'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {purchases.length > 0 && (
        <div className="bg-white rounded-xl border">
          <div className="p-4 border-b flex items-center gap-2"><History className="w-5 h-5 text-gray-600" /><h2 className="font-semibold">Purchase History</h2></div>
          <div className="divide-y max-h-64 overflow-y-auto">
            {purchases.map(purchase => (
              <div key={purchase.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{purchase.whatsapp_credit_packages?.name || 'Credit Package'}</p>
                  <p className="text-sm text-gray-600">{new Date(purchase.created_at).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium">${purchase.credits} credits</p>
                  <p className={`text-sm ${purchase.payment_status === 'completed' ? 'text-green-600' : purchase.payment_status === 'pending' ? 'text-amber-600' : 'text-red-600'}`}>{purchase.payment_status}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export { BuyWhatsAppCredits };
