import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce', // More secure auth flow
  },
  global: {
    headers: {
      'X-Client-Info': 'ticketrack-web',
    },
  },
});

// Helper to get current user
export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  return user;
}

// Helper to get current session
export async function getCurrentSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  return session;
}

// Helper to check if user is admin
export async function isUserAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  
  return profile?.role === 'admin';
}

// Helper to check if user is organizer
export async function isUserOrganizer(): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  
  return profile?.role === 'organizer' || profile?.role === 'admin';
}

// Get user's organizer profile
export async function getUserOrganizer() {
  const user = await getCurrentUser();
  if (!user) return null;
  
  const { data: organizer } = await supabase
    .from('organizers')
    .select('*')
    .eq('user_id', user.id)
    .single();
  
  return organizer;
}
