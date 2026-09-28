export function envValue(...names) {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  return '';
}

export function setCorsHeaders(res, methods = 'POST, OPTIONS') {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
}

export function json(res, status, payload) {
  res.statusCode = status;
  setCorsHeaders(res);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

export async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return {};
  }
}

export async function verifyUser(token) {
  const supabaseUrl = envValue('VITE_SUPABASE_URL', 'SUPABASE_URL');
  const anonKey = envValue('VITE_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey || !token) return null;

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) return null;
  return response.json().catch(() => null);
}

export async function supabaseServiceRequest(path, options = {}) {
  const supabaseUrl = envValue('VITE_SUPABASE_URL', 'SUPABASE_URL');
  const serviceRoleKey = envValue('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return { data: null, error: 'Supabase service role is not configured.', status: 503 };
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  return {
    data,
    error: response.ok ? null : data?.message || data?.error || response.statusText,
    status: response.status
  };
}

export async function supabaseUserRequest(path, token, options = {}) {
  const supabaseUrl = envValue('VITE_SUPABASE_URL', 'SUPABASE_URL');
  const anonKey = envValue('VITE_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey || !token) {
    return { data: null, error: 'Supabase user request is not configured.', status: 503 };
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  return {
    data,
    error: response.ok ? null : data?.message || data?.error || response.statusText,
    status: response.status
  };
}
