import { logAppEvent } from './_monitoring.js';

function json(res, status, payload) {
  res.statusCode = status;
  setCorsHeaders(res);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function envValue(...names) {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  return '';
}

async function verifyUser(token, supabaseUrl, anonKey) {
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) return null;
  return response.json().catch(() => null);
}

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed.' });
  }

  const supabaseUrl = envValue('VITE_SUPABASE_URL', 'SUPABASE_URL');
  const anonKey = envValue('VITE_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY');
  const serviceRoleKey = envValue('SUPABASE_SERVICE_ROLE_KEY');
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : '';

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    await logAppEvent({
      area: 'account',
      eventType: 'delete_account_not_configured',
      severity: 'error'
    });
    return json(res, 503, { error: 'Account deletion is not configured yet.' });
  }

  if (!token) {
    return json(res, 401, { error: 'Sign in again before deleting your account.' });
  }

  const user = await verifyUser(token, supabaseUrl, anonKey);
  if (!user?.id) {
    await logAppEvent({
      area: 'account',
      eventType: 'delete_account_invalid_session',
      severity: 'warning'
    });
    return json(res, 401, { error: 'Session expired. Sign in again before deleting your account.' });
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users/${user.id}`, {
    method: 'DELETE',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`
    }
  });

  if (!response.ok) {
    await logAppEvent({
      area: 'account',
      eventType: 'delete_account_failed',
      severity: 'error',
      userId: user.id,
      metadata: { status: response.status }
    });
    return json(res, 502, { error: 'Account deletion failed. Contact support.' });
  }

  await logAppEvent({
    area: 'account',
    eventType: 'delete_account_success',
    severity: 'info',
    userId: user.id
  });

  return json(res, 200, { ok: true });
}
