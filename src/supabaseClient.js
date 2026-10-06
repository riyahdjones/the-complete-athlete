import { createClient } from '@supabase/supabase-js';

const fallbackSupabaseUrl = 'https://nddtgwygnzjikjynrzen.supabase.co';
const fallbackSupabaseAnonKey = 'sb_publishable_mmBIcEkq4eB7yJ-GQXzzrA_mT5qU3e_';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || fallbackSupabaseUrl;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || fallbackSupabaseAnonKey;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, { auth: {
      detectSessionInUrl: typeof window === 'undefined' || new URLSearchParams(window.location.search).get('socialAuth') !== '1'
    } })
  : null;

// Isolate OAuth PKCE from email recovery, which must keep working across devices.
export const oauthSupabase = isSupabaseConfigured ? createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'pkce', storageKey: 'tca-oauth', autoRefreshToken: false, detectSessionInUrl: false,
    storage: {
      getItem: (key) => key.endsWith('-code-verifier') ? localStorage.getItem(key) : null,
      setItem: (key, value) => { if (key.endsWith('-code-verifier')) localStorage.setItem(key, value); },
      removeItem: (key) => { if (key.endsWith('-code-verifier')) localStorage.removeItem(key); }
    }
  }
}) : null;
