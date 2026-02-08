import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useFinance } from '@/contexts/FinanceContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, Loader2, Shield, AlertCircle } from 'lucide-react';

export function FinanceLogin() {
  const navigate = useNavigate();
  const { financeUser, checkFinanceAccess, loading: contextLoading } = useFinance();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // If already logged in, redirect to dashboard
  useEffect(() => {
    if (financeUser && !contextLoading) {
      navigate('/finance/dashboard');
    }
  }, [financeUser, contextLoading, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Step 1: Sign in
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (authError) throw authError;

      const userId = authData.user.id;

      // Step 2: Check if super_admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

      if (profile?.role === 'super_admin') {
        // Log successful login
        await supabase.from('finance_audit_log').insert({
          user_id: userId,
          action: 'login',
          details: { role: 'super_admin' },
          user_agent: navigator.userAgent
        });
        
        // Refresh context and navigate
        await checkFinanceAccess();
        navigate('/finance/dashboard');
        return;
      }

      // Step 3: Check finance_users table
      const { data: financeUserData, error: financeError } = await supabase
        .from('finance_users')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      if (financeError || !financeUserData) {
        // Not authorized - sign out
        await supabase.auth.signOut();
        setError('You do not have access to the Finance Portal.');
        setLoading(false);
        return;
      }

      // Step 4: Update last login and log
      await supabase
        .from('finance_users')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', financeUserData.id);

      await supabase.from('finance_audit_log').insert({
        user_id: userId,
        action: 'login',
        resource_type: 'finance_user',
        resource_id: financeUserData.id,
        details: { role: financeUserData.role },
        user_agent: navigator.userAgent
      });

      // Refresh context and navigate
      await checkFinanceAccess();
      navigate('/finance/dashboard');
      
    } catch (err) {
      console.error('Login error:', err);
      setError(err.message || 'Failed to login');
      setLoading(false);
    }
  };

  // Show loading if context is still loading
  if (contextLoading) {
    return (
      <div className="min-h-screen bg-[#0F0F0F] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F0F0F] flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-[#2969FF]/20 bg-card rounded-2xl shadow-2xl">
        <CardHeader className="text-center pb-2">
          <div className="w-16 h-16 bg-[#2969FF] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <DollarSign className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold text-foreground">Finance Portal</CardTitle>
          <CardDescription className="flex items-center justify-center gap-2 text-muted-foreground">
            <Shield className="w-4 h-4" />
            Secure Access Only
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="finance@ticketrack.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="rounded-xl"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="rounded-xl"
              />
            </div>
            
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-[#2969FF] hover:bg-[#2969FF]/90 rounded-xl h-12"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Verifying Access...
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4 mr-2" />
                  Access Finance Portal
                </>
              )}
            </Button>
          </form>
          
          <div className="mt-6 p-3 bg-muted rounded-xl">
            <p className="text-xs text-muted-foreground text-center">
              🔒 This portal is restricted to authorized finance personnel only. 
              All access attempts are logged and monitored.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
