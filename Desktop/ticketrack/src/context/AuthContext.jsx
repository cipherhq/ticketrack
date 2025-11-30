import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, onAuthStateChange } from '../lib/supabase';

/**
 * AUTHENTICATION CONTEXT
 * 
 * This provides user authentication state to the entire app.
 * 
 * WHAT IS CONTEXT?
 * Context lets you pass data through the component tree without 
 * having to pass props down manually at every level.
 * 
 * Any component can access the current user by using:
 *   const { user, isLoading } = useAuth();
 */

// Create the context
const AuthContext = createContext({});

// Custom hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Auth Provider component
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch user profile from profiles table
  async function fetchProfile(userId) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error.message);
      setProfile(null);
    }
  }

  // Listen for auth state changes
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setIsLoading(false);
    });

    // Subscribe to auth changes
    const { data: { subscription } } = onAuthStateChange((event, session) => {
      console.log('Auth event:', event);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
      }
      
      setIsLoading(false);
    });

    // Cleanup subscription
    return () => subscription.unsubscribe();
  }, []);

  // Sign up with email and password
  async function signUpWithEmail(email, password, fullName) {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) throw error;
      
      return { data, error: null };
    } catch (error) {
      console.error('Sign up error:', error.message);
      return { data: null, error };
    } finally {
      setIsLoading(false);
    }
  }

  // Sign in with email and password
  async function signInWithEmail(email, password) {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      
      return { data, error: null };
    } catch (error) {
      console.error('Sign in error:', error.message);
      return { data: null, error };
    } finally {
      setIsLoading(false);
    }
  }

  // Send OTP to phone number
  async function sendPhoneOTP(phone) {
    setIsLoading(true);
    try {
      // Format phone number (ensure it starts with country code)
      const formattedPhone = phone.startsWith('+') ? phone : `+234${phone.replace(/^0/, '')}`;
      
      const { data, error } = await supabase.auth.signInWithOtp({
        phone: formattedPhone,
      });

      if (error) throw error;
      
      return { data, error: null, phone: formattedPhone };
    } catch (error) {
      console.error('Send OTP error:', error.message);
      return { data: null, error };
    } finally {
      setIsLoading(false);
    }
  }

  // Verify phone OTP
  async function verifyPhoneOTP(phone, token) {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone,
        token,
        type: 'sms',
      });

      if (error) throw error;
      
      return { data, error: null };
    } catch (error) {
      console.error('Verify OTP error:', error.message);
      return { data: null, error };
    } finally {
      setIsLoading(false);
    }
  }

  // Sign out
  async function signOut() {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      setUser(null);
      setProfile(null);
      
      return { error: null };
    } catch (error) {
      console.error('Sign out error:', error.message);
      return { error };
    } finally {
      setIsLoading(false);
    }
  }

  // Reset password
  async function resetPassword(email) {
    try {
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;
      
      return { data, error: null };
    } catch (error) {
      console.error('Reset password error:', error.message);
      return { data: null, error };
    }
  }

  // Update profile
  async function updateProfile(updates) {
    try {
      if (!user) throw new Error('No user logged in');

      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single();

      if (error) throw error;
      
      setProfile(data);
      return { data, error: null };
    } catch (error) {
      console.error('Update profile error:', error.message);
      return { data: null, error };
    }
  }

  // Context value
  const value = {
    user,
    profile,
    isLoading,
    isAuthenticated: !!user,
    signUpWithEmail,
    signInWithEmail,
    sendPhoneOTP,
    verifyPhoneOTP,
    signOut,
    resetPassword,
    updateProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * WHAT YOU LEARNED:
 * 
 * 1. CONTEXT API: A way to share data (like user info) across all components
 *    without passing props through every level.
 * 
 * 2. PROVIDER PATTERN: AuthProvider wraps your app and provides auth functions
 *    to any child component that needs them.
 * 
 * 3. CUSTOM HOOK: useAuth() is a convenient way to access auth state and functions.
 * 
 * 4. AUTH FUNCTIONS:
 *    - signUpWithEmail: Create new account
 *    - signInWithEmail: Login with email/password
 *    - sendPhoneOTP: Send SMS code to phone
 *    - verifyPhoneOTP: Verify the SMS code
 *    - signOut: Logout
 *    - resetPassword: Send password reset email
 * 
 * 5. NIGERIAN PHONE FORMAT: We auto-format numbers to +234 country code
 */
