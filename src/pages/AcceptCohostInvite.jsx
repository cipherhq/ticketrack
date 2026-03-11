import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2, Check, X, PartyPopper, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { getCohostByToken, acceptCohostInvite } from '@/services/partyInvites';

export function AcceptCohostInvite() {
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('token');
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [cohost, setCohost] = useState(null);
  const [error, setError] = useState('');
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (!inviteToken) {
      setError('Invalid invitation link');
      setLoading(false);
      return;
    }
    loadCohost();
  }, [inviteToken]);

  async function loadCohost() {
    setLoading(true);
    try {
      const data = await getCohostByToken(inviteToken);
      if (!data) {
        setError('Invitation not found or already accepted');
        return;
      }
      if (data.accepted_at) {
        setAccepted(true);
      }
      setCohost(data);
    } catch {
      setError('Failed to load invitation');
    } finally {
      setLoading(false);
    }
  }

  async function handleAccept() {
    if (!user) {
      navigate(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    setAccepting(true);
    try {
      await acceptCohostInvite(inviteToken, user.id);
      setAccepted(true);
    } catch (err) {
      setError('Failed to accept invitation. You may need to use the same email the invite was sent to.');
    } finally {
      setAccepting(false);
    }
  }

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error && !cohost) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <X className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Invalid Invitation</h1>
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">You're a Co-Host!</h1>
          <p className="text-gray-500 mb-6">
            You now have access to manage{' '}
            <span className="font-semibold">{cohost?.invite?.title || 'this party'}</span>.
          </p>
          <Button onClick={() => navigate('/rackparty')} className="rounded-xl gap-2">
            <PartyPopper className="w-4 h-4" />
            Go to RackParty
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-4">
          <PartyPopper className="w-8 h-8 text-purple-600" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-1">Co-Host Invitation</h1>
        <p className="text-gray-500 mb-6">
          You've been invited to co-host{' '}
          <span className="font-semibold text-gray-900">{cohost?.invite?.title || 'a party'}</span>
          {cohost?.role && <span className="text-sm"> as {cohost.role}</span>}
        </p>

        {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

        {user ? (
          <Button onClick={handleAccept} disabled={accepting} className="w-full rounded-xl gap-2">
            {accepting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Accept Invitation
          </Button>
        ) : (
          <Button onClick={handleAccept} className="w-full rounded-xl gap-2">
            <LogIn className="w-4 h-4" />
            Sign in to Accept
          </Button>
        )}
      </div>
    </div>
  );
}
