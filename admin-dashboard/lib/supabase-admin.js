import { createClient } from '@supabase/supabase-js';
import { adminEnv } from './admin-env';

export function supabaseAdmin() {
  const { supabaseUrl, serviceRoleKey } = adminEnv();

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.admin.local.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}
