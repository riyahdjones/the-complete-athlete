const DAILY_COACH_MESSAGE_LIMIT = 15;

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

function configured(value) {
  return Boolean(String(value ?? '').trim());
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return json(res, 405, { error: 'Method not allowed.' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const openAiKey = process.env.OPENAI_API_KEY;
  const coachModel = process.env.OPENAI_COACH_MODEL || 'gpt-4.1-mini';

  const checks = {
    supabase: {
      configured: configured(supabaseUrl) && configured(supabaseAnonKey)
    },
    openai: {
      configured: configured(openAiKey),
      coachModel
    },
    coach: {
      dailyMessageLimit: DAILY_COACH_MESSAGE_LIMIT,
      memoryEnabled: configured(supabaseUrl) && configured(supabaseAnonKey),
      usageLimitEnabled: configured(supabaseUrl) && configured(supabaseAnonKey)
    },
    account: {
      deletionEnabled: configured(supabaseUrl) && configured(supabaseAnonKey) && configured(serviceRoleKey)
    }
  };

  const ok = checks.supabase.configured && checks.openai.configured && checks.account.deletionEnabled;

  return json(res, ok ? 200 : 503, {
    ok,
    checks,
    checkedAt: new Date().toISOString()
  });
}
