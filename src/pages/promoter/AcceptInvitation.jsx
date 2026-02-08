import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2, PartyPopper } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

// Send email via Edge Function
const sendEmail = async (emailData) => {
  try {
    // Try to use authenticated session token first for better security
    let authToken = import.meta.env.VITE_SUPABASE_ANON_KEY

    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) {
      authToken = session.access_token
    } else {
      // Try refreshing the session
      const { data: refreshData } = await supabase.auth.refreshSession()
      if (refreshData?.session?.access_token) {
        authToken = refreshData.session.access_token
      }
      // Fall back to anon key for public email endpoints if no session
    }

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken}`
      },
      body: JSON.stringify(emailData)
    });
    const result = await response.json();
    return result;
  } catch (err) {
    console.error("Email send error:", err);
    return { success: false, error: err.message };
  }
};

export function AcceptInvitation() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  
  const [status, setStatus] = useState('loading'); // loading, success, error, not_found
  const [message, setMessage] = useState('');
  const [promoterData, setPromoterData] = useState(null);

  const promoCode = searchParams.get('code');

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      // Redirect to login with return URL
      navigate('/login', { 
        state: { 
          from: `/promoter/accept?code=${promoCode}`,
          message: 'Please log in or sign up to accept your promoter invitation.'
        } 
      });
      return;
    }

    if (promoCode) {
      acceptInvitation();
    } else {
      setStatus('error');
      setMessage('Invalid invitation link. No promo code provided.');
    }
  }, [user, authLoading, promoCode]);

  const acceptInvitation = async () => {
    try {
      // Find the promoter invitation by code and user email
      const { data: promoter, error: findError } = await supabase
        .from('promoters')
        .select('*, organizers:organizer_id(id, business_name, email, user_id)')
        .or(`short_code.eq.${promoCode},referral_code.eq.${promoCode}`)
        .eq('email', user.email.toLowerCase())
        .single();

      if (findError || !promoter) {
        // Check if invitation exists but for different email
        const { data: existingPromoter } = await supabase
          .from('promoters')
          .select('email')
          .or(`short_code.eq.${promoCode},referral_code.eq.${promoCode}`)
          .single();

        if (existingPromoter) {
          setStatus('error');
          setMessage(`This invitation was sent to ${existingPromoter.email}. Please log in with that email address.`);
        } else {
          setStatus('not_found');
          setMessage('Invitation not found. It may have expired or been revoked.');
        }
        return;
      }

      // Check if already accepted
      if (promoter.status === 'active' && promoter.is_active) {
        setStatus('success');
        setMessage('You have already accepted this invitation!');
        setPromoterData(promoter);
        return;
      }

      // Update promoter status to active and link user_id
      const { error: updateError } = await supabase
        .from('promoters')
        .update({ 
          status: 'active', 
          is_active: true,
          user_id: user.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', promoter.id);

      if (updateError) throw updateError;

      // Get organizer email for notification
      let organizerEmail = promoter.organizers?.email;
      
      if (!organizerEmail && promoter.organizers?.user_id) {
        const { data: orgProfile } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', promoter.organizers.user_id)
          .single();
        organizerEmail = orgProfile?.email;
      }

      // Send email to organizer
      if (organizerEmail) {
        await sendEmail({
          type: 'promoter_accepted',
          to: organizerEmail,
          data: {
            promoterName: promoter.full_name || promoter.name || user.email,
            promoterEmail: user.email,
            promoCode: promoCode,
            commissionType: promoter.commission_type,
            commissionValue: promoter.commission_value || promoter.commission_rate,
            eventTitle: null, // Could fetch event title if needed
            appUrl: window.location.origin
          }
        });
      }

      setStatus('success');
      setMessage('Congratulations! You are now an official promoter.');
      setPromoterData(promoter);

      // Auto-redirect to promoter dashboard after a brief moment
      setTimeout(() => {
        navigate('/promoter');
      }, 2000);

    } catch (err) {
      console.error('Error accepting invitation:', err);
      setStatus('error');
      setMessage('Something went wrong. Please try again or contact support.');
    }
  };

  if (authLoading || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-[#2969FF] mx-auto mb-4" />
          <p className="text-muted-foreground">Processing your invitation...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted px-4">
      <Card className="w-full max-w-md border-border/10 rounded-2xl">
        <CardContent className="p-8 text-center">
          {status === 'success' && (
            <>
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <PartyPopper className="w-10 h-10 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">Welcome Aboard!</h2>
              <p className="text-muted-foreground mb-4">{message}</p>
              <p className="text-sm text-muted-foreground mb-6">Redirecting to your dashboard...</p>
              {promoterData && (
                <div className="bg-muted rounded-xl p-4 mb-6 text-left">
                  <div className="flex justify-between py-2 border-b border-border/10">
                    <span className="text-muted-foreground">Your Promo Code</span>
                    <span className="font-bold text-[#2969FF]">{promoCode}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-muted-foreground">Commission</span>
                    <span className="font-semibold">
                      {promoterData.commission_value || promoterData.commission_rate}
                      {promoterData.commission_type === 'percentage' ? '%' : ' per sale'}
                    </span>
                  </div>
                </div>
              )}
              <Button
                onClick={() => navigate('/promoter')}
                className="w-full bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl py-6"
              >
                Go to Dashboard Now
              </Button>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <XCircle className="w-10 h-10 text-red-600" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">Oops!</h2>
              <p className="text-muted-foreground mb-6">{message}</p>
              <Button 
                onClick={() => navigate('/')} 
                variant="outline"
                className="w-full rounded-xl py-6"
              >
                Go to Home
              </Button>
            </>
          )}

          {status === 'not_found' && (
            <>
              <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <XCircle className="w-10 h-10 text-yellow-600" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">Invitation Not Found</h2>
              <p className="text-muted-foreground mb-6">{message}</p>
              <Button 
                onClick={() => navigate('/')} 
                variant="outline"
                className="w-full rounded-xl py-6"
              >
                Go to Home
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
