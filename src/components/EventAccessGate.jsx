import { useState } from 'react';
import { Lock, Ticket, Mail, ArrowLeft, Loader2, AlertCircle, Check, Eye, EyeOff } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';

/**
 * EventAccessGate Component
 * 
 * Displays an access gate for private events requiring authentication.
 * Supports: Password, Invite Code, Email Whitelist
 * 
 * Props:
 * - event: The event object with visibility settings
 * - onAccessGranted: Callback when access is successfully verified
 * - onBack: Callback to go back to event listing
 */

export function EventAccessGate({ event, onAccessGranted, onBack }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  
  // Form inputs
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [email, setEmail] = useState('');
  
  // Get visibility type
  const visibility = event?.visibility || 'public';
  
  // Verify password
  const verifyPassword = async () => {
    if (!password.trim()) {
      setError('Please enter the event password');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      // Simple password check (compare with stored password)
      // In production, you'd want to hash and compare
      if (password === event.access_password) {
        setSuccess(true);
        // Store in session for this event
        sessionStorage.setItem(`event_access_${event.id}`, 'granted');
        setTimeout(() => onAccessGranted(), 500);
      } else {
        setError('Incorrect password. Please try again.');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  // Verify invite code
  const verifyInviteCode = async () => {
    if (!inviteCode.trim()) {
      setError('Please enter your invite code');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      // Call the database function to validate and use the code
      const { data, error: rpcError } = await supabase
        .rpc('validate_invite_code', {
          p_event_id: event.id,
          p_code: inviteCode.toUpperCase().trim(),
        });
      
      if (rpcError) throw rpcError;
      
      if (data?.valid) {
        setSuccess(true);
        // Store in session for this event
        sessionStorage.setItem(`event_access_${event.id}`, 'granted');
        sessionStorage.setItem(`event_invite_code_${event.id}`, inviteCode.toUpperCase().trim());
        setTimeout(() => onAccessGranted(), 500);
      } else {
        setError(data?.error || 'Invalid invite code');
      }
    } catch (err) {
      console.error('Error verifying invite code:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  // Verify email whitelist
  const verifyEmail = async () => {
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }
    
    if (!email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      // Call the database function to check email whitelist
      const { data, error: rpcError } = await supabase
        .rpc('check_email_whitelist', {
          p_event_id: event.id,
          p_email: email.toLowerCase().trim(),
        });
      
      if (rpcError) throw rpcError;
      
      if (data?.valid) {
        setSuccess(true);
        // Store in session for this event
        sessionStorage.setItem(`event_access_${event.id}`, 'granted');
        sessionStorage.setItem(`event_access_email_${event.id}`, email.toLowerCase().trim());
        setTimeout(() => onAccessGranted(), 500);
      } else {
        setError(data?.error || 'Your email is not on the guest list');
      }
    } catch (err) {
      console.error('Error verifying email:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    
    switch (visibility) {
      case 'password':
        verifyPassword();
        break;
      case 'invite_only':
        verifyInviteCode();
        break;
      case 'email_whitelist':
        verifyEmail();
        break;
      default:
        onAccessGranted();
    }
  };
  
  // Get icon and color based on visibility
  const getVisibilityConfig = () => {
    switch (visibility) {
      case 'password':
        return {
          icon: Lock,
          color: 'orange',
          title: 'Password Protected Event',
          subtitle: 'This event requires a password to access',
          placeholder: 'Enter event password',
          buttonText: 'Unlock Event',
        };
      case 'invite_only':
        return {
          icon: Ticket,
          color: 'purple',
          title: 'Invite Only Event',
          subtitle: 'You need an invite code to access this event',
          placeholder: 'Enter your invite code',
          buttonText: 'Verify Code',
        };
      case 'email_whitelist':
        return {
          icon: Mail,
          color: 'pink',
          title: 'Private Guest List',
          subtitle: 'Only approved guests can access this event',
          placeholder: 'Enter your email address',
          buttonText: 'Check Guest List',
        };
      default:
        return {
          icon: Lock,
          color: 'gray',
          title: 'Private Event',
          subtitle: 'This event requires authentication',
          placeholder: '',
          buttonText: 'Continue',
        };
    }
  };
  
  const config = getVisibilityConfig();
  const Icon = config.icon;
  
  // Success state
  if (success) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-border/10 rounded-2xl overflow-hidden">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Access Granted!
            </h2>
            <p className="text-muted-foreground">
              Loading event details...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <Card className="max-w-md w-full border-border/10 rounded-2xl overflow-hidden">
        {/* Header with event image (if available and settings allow) */}
        {event?.image_url && event?.access_settings?.showDetailsBeforeAuth && (
          <div className="relative h-32 bg-muted">
            <img
              src={event.image_url}
              alt={event.title}
              className="w-full h-full object-cover opacity-50"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-white/80 to-transparent" />
          </div>
        )}
        
        <CardContent className="p-8">
          {/* Back button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="mb-6 -ml-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to events
          </Button>
          
          {/* Icon */}
          <div className={`
            w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6
            ${config.color === 'orange' ? 'bg-orange-100' : ''}
            ${config.color === 'purple' ? 'bg-purple-100' : ''}
            ${config.color === 'pink' ? 'bg-pink-100' : ''}
            ${config.color === 'gray' ? 'bg-muted' : ''}
          `}>
            <Icon className={`
              w-8 h-8
              ${config.color === 'orange' ? 'text-orange-600' : ''}
              ${config.color === 'purple' ? 'text-purple-600' : ''}
              ${config.color === 'pink' ? 'text-pink-600' : ''}
              ${config.color === 'gray' ? 'text-muted-foreground' : ''}
            `} />
          </div>
          
          {/* Title & subtitle */}
          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold text-foreground mb-2">
              {config.title}
            </h2>
            <p className="text-muted-foreground">
              {config.subtitle}
            </p>
            
            {/* Show event title if settings allow */}
            {event?.title && event?.access_settings?.showDetailsBeforeAuth && (
              <p className="mt-3 font-medium text-[#2969FF]">
                {event.title}
              </p>
            )}
          </div>
          
          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Password input */}
            {visibility === 'password' && (
              <div className="space-y-2">
                <Label>Event Password</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError('');
                    }}
                    placeholder={config.placeholder}
                    className="rounded-xl pr-10"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}
            
            {/* Invite code input */}
            {visibility === 'invite_only' && (
              <div className="space-y-2">
                <Label>Invite Code</Label>
                <Input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => {
                    setInviteCode(e.target.value.toUpperCase());
                    setError('');
                  }}
                  placeholder={config.placeholder}
                  className="rounded-xl font-mono text-center text-lg tracking-widest uppercase"
                  maxLength={20}
                  autoFocus
                />
              </div>
            )}
            
            {/* Email input */}
            {visibility === 'email_whitelist' && (
              <div className="space-y-2">
                <Label>Your Email Address</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError('');
                  }}
                  placeholder={config.placeholder}
                  className="rounded-xl"
                  autoFocus
                />
              </div>
            )}
            
            {/* Error message */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 rounded-xl text-red-600">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}
            
            {/* Submit button */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-[#2969FF] hover:bg-[#2969FF]/90 rounded-xl h-12"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Icon className="w-4 h-4 mr-2" />
                  {config.buttonText}
                </>
              )}
            </Button>
          </form>
          
          {/* Help text */}
          <p className="text-xs text-muted-foreground text-center mt-6">
            {visibility === 'password' && "Don't have the password? Contact the event organizer."}
            {visibility === 'invite_only' && "Don't have a code? Contact the event organizer for an invite."}
            {visibility === 'email_whitelist' && "Not on the list? Contact the event organizer to request access."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default EventAccessGate;
