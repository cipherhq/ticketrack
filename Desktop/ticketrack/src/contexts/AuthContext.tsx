import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { updateSessionActivity, clearSession, logSecurityEvent } from '@/lib/security';

interface Profile {
  id: string;
  email: string | null;
  phone: string | null;
  full_name: string | null;
  avatar_url: string | null;
  role: 'user' | 'organizer' | 'admin';
  is_verified: boolean;
  is_suspended: boolean;
}

interface Organizer {
  id: string;
  user_id: string;
  business_name: string;
  business_email: string;
  business_phone: string | null;
  logo_url: string | null;
  is_verified: boolean;
  verification_status: string;
  country_code: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  organizer: Organizer | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isOrganizer: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: AuthError | null }>;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signInWithPhone: (phone: string) => Promise<{ error: AuthError | null }>;
  verifyOTP: (phone: string, token: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: Error | null }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [organizer, setOrganizer] = useState<Organizer | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch user profile
  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }

    return data as Profile;
  };

  // Fetch organizer profile if user is organizer
  const fetchOrganizer = async (userId: string) => {
    const { data, error } = await supabase
      .from('organizers')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching organizer:', error);
    }

    return data as Organizer | null;
  };

  // Initialize auth state
  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        
        if (currentSession?.user) {
          setSession(currentSession);
          setUser(currentSession.user);
          
          const userProfile = await fetchProfile(currentSession.user.id);
          setProfile(userProfile);
          
          if (userProfile?.role === 'organizer' || userProfile?.role === 'admin') {
            const userOrganizer = await fetchOrganizer(currentSession.user.id);
            setOrganizer(userOrganizer);
          }
          
          updateSessionActivity();
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (event === 'SIGNED_IN' && newSession?.user) {
          const userProfile = await fetchProfile(newSession.user.id);
          setProfile(userProfile);
          
          if (userProfile?.role === 'organizer' || userProfile?.role === 'admin') {
            const userOrganizer = await fetchOrganizer(newSession.user.id);
            setOrganizer(userOrganizer);
          }
          
          updateSessionActivity();
          logSecurityEvent('login_success', { userId: newSession.user.id });
        }

        if (event === 'SIGNED_OUT') {
          setProfile(null);
          setOrganizer(null);
          clearSession();
          logSecurityEvent('logout', {});
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Sign up with email
  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (error) {
      logSecurityEvent('signup_failed', { email, error: error.message });
    } else {
      logSecurityEvent('signup_success', { email });
    }

    return { error };
  };

  // Sign in with email
  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      logSecurityEvent('login_failed', { email, error: error.message });
    }

    return { error };
  };

  // Sign in with phone (OTP)
  const signInWithPhone = async (phone: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      phone,
    });

    return { error };
  };

  // Verify OTP
  const verifyOTP = async (phone: string, token: string) => {
    const { error } = await supabase.auth.verifyOtp({
      phone,
      token,
      type: 'sms',
    });

    return { error };
  };

  // Sign out
  const signOut = async () => {
    await supabase.auth.signOut();
  };

  // Reset password
  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    return { error };
  };

  // Update profile
  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) {
      return { error: new Error('Not authenticated') };
    }

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id);

    if (!error) {
      setProfile((prev) => prev ? { ...prev, ...updates } : null);
    }

    return { error };
  };

  // Refresh profile data
  const refreshProfile = async () => {
    if (!user) return;

    const userProfile = await fetchProfile(user.id);
    setProfile(userProfile);

    if (userProfile?.role === 'organizer' || userProfile?.role === 'admin') {
      const userOrganizer = await fetchOrganizer(user.id);
      setOrganizer(userOrganizer);
    }
  };

  const value: AuthContextType = {
    user,
    session,
    profile,
    organizer,
    isLoading,
    isAuthenticated: !!user,
    isAdmin: profile?.role === 'admin',
    isOrganizer: profile?.role === 'organizer' || profile?.role === 'admin',
    signUp,
    signIn,
    signInWithPhone,
    verifyOTP,
    signOut,
    resetPassword,
    updateProfile,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
