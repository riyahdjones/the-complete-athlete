import { createClient } from '@supabase/supabase-js';

const fallbackSupabaseUrl = 'https://nddtgwygnzjikjynrzen.supabase.co';
const fallbackSupabaseAnonKey = 'sb_publishable_mmBIcEkq4eB7yJ-GQXzzrA_mT5qU3e_';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || fallbackSupabaseUrl;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || fallbackSupabaseAnonKey;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
