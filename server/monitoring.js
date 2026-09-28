function envValue(...names) {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  return '';
}

function cleanMetadata(value) {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entryValue]) => entryValue !== undefined && entryValue !== null)
      .map(([key, entryValue]) => [key, String(entryValue).slice(0, 500)])
  );
}

export async function logAppEvent({ area, eventType, severity = 'info', userId = null, metadata = {} }) {
  const supabaseUrl = envValue('VITE_SUPABASE_URL', 'SUPABASE_URL');
  const serviceRoleKey = envValue('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey || !area || !eventType) return;

  await fetch(`${supabaseUrl}/rest/v1/app_events`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal'
    },
    body: JSON.stringify({
      area,
      event_type: eventType,
      severity,
      user_id: userId,
      metadata: cleanMetadata(metadata)
    })
  }).catch(() => {});
}
