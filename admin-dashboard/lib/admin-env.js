import fs from 'node:fs';
import path from 'node:path';

let loaded = false;

function loadParentEnv() {
  if (loaded) return;
  loaded = true;

  const envPath = path.resolve(process.cwd(), '..', '.env.admin.local');
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const clean = line.trim();
    if (!clean || clean.startsWith('#') || !clean.includes('=')) continue;
    const [key, ...valueParts] = clean.split('=');
    const value = valueParts.join('=').trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

export function adminEnv() {
  loadParentEnv();

  return {
    supabaseUrl: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    dashboardPassword: process.env.ADMIN_DASHBOARD_PASSWORD
  };
}
