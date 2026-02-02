import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Persist session in localStorage
    persistSession: true,
    // Storage key for the session
    storageKey: 'ticketrack-auth',
    // Auto refresh token before it expires
    autoRefreshToken: true,
    // Detect session from URL (for OAuth/magic links)
    detectSessionInUrl: true,
    // Flow type - use PKCE for better security
    flowType: 'pkce',
  },
})
