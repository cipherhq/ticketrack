import { useState, useEffect } from 'react';
import { Loader2, Clock, Users, CheckCircle, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { joinWaitlist, getWaitlistPosition, cancelWaitlist, getWaitlistCount } from '@/services/waitlist';

export function WaitlistDialog({ open, onOpenChange, event }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [existingEntry, setExistingEntry] = useState(null);
  const [waitlistCount, setWaitlistCount] = useState(0);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    quantity: 1
  });

  // Check existing waitlist entry on open
  useEffect(() => {
    if (open && event?.id) {
      checkExisting();
      loadCount();
    }
  }, [open, event?.id]);

  // Pre-fill user data
  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        email: user.email || '',
        name: user.user_metadata?.full_name || ''
      }));
    }
  }, [user]);

  const checkExisting = async () => {
    if (!user?.email) {
      setChecking(false);
      return;
    }
    
    setChecking(true);
    try {
      const entry = await getWaitlistPosition(event.id, user.email);
      setExistingEntry(entry);
    } catch (err) {
      console.error('Error checking waitlist:', err);
    } finally {
      setChecking(false);
    }
  };

  const loadCount = async () => {
    try {
      const count = await getWaitlistCount(event.id);
      setWaitlistCount(count);
    } catch (err) {
      console.error('Error loading count:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await joinWaitlist(
        event.id,
        user?.id || null,
        formData.email,
        formData.name,
        formData.phone,
        formData.quantity
      );

      if (result.success) {
        setSuccess(true);
        setExistingEntry({ position: result.position, status: 'waiting' });
      } else {
        setError(result.error || 'Failed to join waitlist');
      }
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!existingEntry?.id) return;
    
    setLoading(true);
    try {
      await cancelWaitlist(existingEntry.id);
      setExistingEntry(null);
      setSuccess(false);
    } catch (err) {
      setError(err.message || 'Failed to cancel');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSuccess(false);
    setError('');
    onOpenChange(false);
  };

  if (checking) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {existingEntry ? "You're on the Waitlist!" : "Join Waitlist"}
          </DialogTitle>
          <DialogDescription>
            {event?.title}
          </DialogDescription>
        </DialogHeader>

        {/* Already on waitlist */}
        {existingEntry && (
          <div className="space-y-4">
            <div className="bg-[#2969FF]/10 rounded-xl p-6 text-center">
              <div className="w-16 h-16 bg-[#2969FF] rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-white">#{existingEntry.position}</span>
              </div>
              <h3 className="font-semibold text-lg text-[#0F0F0F]">Your Position</h3>
              <p className="text-[#0F0F0F]/60 text-sm mt-1">
                {existingEntry.status === 'notified' 
                  ? "Check your email! Tickets are available for you."
                  : "We'll notify you when tickets become available."}
              </p>
            </div>

            <div className="flex items-center justify-between text-sm text-[#0F0F0F]/60">
              <span className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                {waitlistCount} people waiting
              </span>
              <span className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Joined {new Date(existingEntry.created_at).toLocaleDateString()}
              </span>
            </div>

            <Button 
              variant="outline" 
              className="w-full rounded-xl"
              onClick={handleCancel}
              disabled={loading}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <X className="w-4 h-4 mr-2" />}
              Leave Waitlist
            </Button>
          </div>
        )}

        {/* Success state */}
        {success && !existingEntry && (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="font-semibold text-lg text-[#0F0F0F]">You're on the list!</h3>
            <p className="text-[#0F0F0F]/60 text-sm mt-2">
              We'll email you at {formData.email} when tickets become available.
            </p>
            <Button className="mt-4 rounded-xl" onClick={handleClose}>
              Done
            </Button>
          </div>
        )}

        {/* Join form */}
        {!existingEntry && !success && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-orange-50 rounded-xl p-4 flex items-start gap-3">
              <Clock className="w-5 h-5 text-orange-600 mt-0.5" />
              <div>
                <p className="font-medium text-orange-800">This event is sold out</p>
                <p className="text-sm text-orange-600">
                  Join the waitlist and we'll notify you if tickets become available.
                  {waitlistCount > 0 && ` ${waitlistCount} people already waiting.`}
                </p>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 rounded-xl p-3 text-sm">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label>Full Name <span className="text-red-500">*</span></Label>
              <Input
                required
                placeholder="Your full name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label>Email <span className="text-red-500">*</span></Label>
              <Input
                required
                type="email"
                placeholder="your@email.com"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label>Phone (optional)</Label>
              <Input
                type="tel"
                placeholder="+234..."
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label>Number of Tickets</Label>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="rounded-xl"
                  onClick={() => setFormData(prev => ({ ...prev, quantity: Math.max(1, prev.quantity - 1) }))}
                  disabled={formData.quantity <= 1}
                >
                  -
                </Button>
                <span className="w-8 text-center font-semibold">{formData.quantity}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="rounded-xl"
                  onClick={() => setFormData(prev => ({ ...prev, quantity: Math.min(10, prev.quantity + 1) }))}
                  disabled={formData.quantity >= 10}
                >
                  +
                </Button>
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full bg-[#2969FF] hover:bg-[#1a4fd8] rounded-xl py-6"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Users className="w-4 h-4 mr-2" />
              )}
              Join Waitlist
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
