import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle, Users, Building } from 'lucide-react';

export function AcceptTeamInvitation() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState('loading'); // loading, needs_login, accepting, success, error
  const [error, setError] = useState('');
  const [invitationData, setInvitationData] = useState(null);
  const [organizerName, setOrganizerName] = useState('');

  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setError('Invalid invitation link');
      return;
    }
    loadInvitation();
  }, [token]);

  useEffect(() => {
    if (!authLoading && invitationData) {
      if (!user) {
        setStatus('needs_login');
      } else {
        acceptInvitation();
      }
    }
  }, [user, authLoading, invitationData]);

  const loadInvitation = async () => {
    try {
      // Get invitation details
      const { data, error } = await supabase
        .from('organizer_team_members')
        .select('*, organizer:organizers(business_name, user_id)')
        .eq('invitation_token', token)
        .single();

      if (error || !data) {
        setStatus('error');
        setError('Invalid or expired invitation');
        return;
      }

      if (data.status === 'active') {
        setStatus('error');
        setError('This invitation has already been accepted');
        return;
      }

      if (new Date(data.invitation_expires_at) < new Date()) {
        setStatus('error');
        setError('This invitation has expired');
        return;
      }

      setInvitationData(data);
      setOrganizerName(data.organizer?.business_name || 'Organization');
      
      if (!authLoading && !user) {
        setStatus('needs_login');
      }
    } catch (err) {
      console.error('Error loading invitation:', err);
      setStatus('error');
      setError('Failed to load invitation');
    }
  };

  const acceptInvitation = async () => {
    if (!user) return;
    
    setStatus('accepting');
    try {
      const { data, error } = await supabase.rpc('accept_team_invitation', {
        p_token: token,
        p_user_id: user.id
      });

      if (error) throw error;

      if (data?.success) {
        setStatus('success');
        // Redirect after 2 seconds
        setTimeout(() => {
          navigate('/team-dashboard');
        }, 2000);
      } else {
        setStatus('error');
        setError(data?.error || 'Failed to accept invitation');
      }
    } catch (err) {
      console.error('Error accepting invitation:', err);
      setStatus('error');
      setError('Failed to accept invitation');
    }
  };

  const goToLogin = () => {
    // Store token in session storage for after login
    sessionStorage.setItem('pending_team_invite', token);
    navigate('/login?redirect=/accept-invite?token=' + token);
  };

  const goToSignup = () => {
    sessionStorage.setItem('pending_team_invite', token);
    navigate('/signup?redirect=/accept-invite?token=' + token);
  };

  if (authLoading || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4F6FA]">
        <Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F4F6FA] p-4">
      <Card className="w-full max-w-md rounded-2xl">
        <CardHeader className="text-center">
          <div className="w-16 h-16 rounded-full bg-[#2969FF]/10 flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-[#2969FF]" />
          </div>
          <CardTitle className="text-xl">Team Invitation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === 'needs_login' && (
            <>
              <div className="text-center space-y-2">
                <div className="flex items-center justify-center gap-2 text-[#0F0F0F]/60">
                  <Building className="w-4 h-4" />
                  <span>{organizerName}</span>
                </div>
                <p className="text-[#0F0F0F]">
                  You've been invited to join as <strong className="text-[#2969FF]">{invitationData?.role}</strong>
                </p>
                <p className="text-sm text-[#0F0F0F]/60">
                  Please log in or create an account to accept this invitation.
                </p>
              </div>
              <div className="space-y-3 pt-4">
                <Button
                  onClick={goToLogin}
                  className="w-full bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl h-12"
                >
                  Log In to Accept
                </Button>
                <Button
                  onClick={goToSignup}
                  variant="outline"
                  className="w-full rounded-xl h-12"
                >
                  Create Account
                </Button>
              </div>
            </>
          )}

          {status === 'accepting' && (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-[#2969FF] mx-auto mb-4" />
              <p className="text-[#0F0F0F]/60">Accepting invitation...</p>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center py-8">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <p className="text-lg font-medium text-[#0F0F0F] mb-2">Welcome to the team!</p>
              <p className="text-sm text-[#0F0F0F]/60">Redirecting to your dashboard...</p>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center py-8">
              <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <p className="text-lg font-medium text-[#0F0F0F] mb-2">Invitation Error</p>
              <p className="text-sm text-red-500 mb-4">{error}</p>
              <Button
                onClick={() => navigate('/')}
                variant="outline"
                className="rounded-xl"
              >
                Go to Home
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
