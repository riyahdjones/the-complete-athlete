import { json, readJson, setCorsHeaders, supabaseServiceRequest } from './_supabase.js';
import { logAppEvent } from './_monitoring.js';

const ACTIVE_EVENT_TYPES = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'PRODUCT_CHANGE',
  'UNCANCELLATION',
  'NON_RENEWING_PURCHASE',
  'SUBSCRIPTION_EXTENDED',
  'TEMPORARY_ENTITLEMENT_GRANT'
]);

const INACTIVE_EVENT_TYPES = new Set([
  'CANCELLATION',
  'EXPIRATION',
  'BILLING_ISSUE',
  'TRANSFER'
]);

function bearerToken(header = '') {
  return header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
}

function eventStatus(event) {
  const type = String(event?.type || '').toUpperCase();
  const periodType = String(event?.period_type || '').toUpperCase();
  const expirationMs = Number(event?.expiration_at_ms || 0);

  if (INACTIVE_EVENT_TYPES.has(type)) return type === 'BILLING_ISSUE' ? 'inactive' : 'expired';
  if (periodType === 'TRIAL') return 'trialing';
  if (ACTIVE_EVENT_TYPES.has(type)) return 'active';
  if (expirationMs && expirationMs < Date.now()) return 'expired';
  return 'active';
}

function eventExpiresAt(event) {
  const expirationMs = Number(event?.expiration_at_ms || 0);
  return expirationMs ? new Date(expirationMs).toISOString() : null;
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

  const webhookSecret = process.env.REVENUECAT_WEBHOOK_SECRET || '';
  if (!webhookSecret) {
    return json(res, 503, { error: 'RevenueCat webhook secret is not configured.' });
  }

  if (bearerToken(req.headers.authorization || '') !== webhookSecret) {
    return json(res, 401, { error: 'Invalid webhook token.' });
  }

  const payload = await readJson(req);
  const event = payload?.event ?? payload;
  const userId = String(event?.app_user_id || event?.original_app_user_id || '').trim();
  const entitlementId = String(event?.entitlement_ids?.[0] || event?.entitlement_id || process.env.REVENUECAT_ENTITLEMENT_ID || 'The Complete Athlete Pro');

  if (!userId || !entitlementId) {
    await logAppEvent({
      area: 'subscriptions',
      eventType: 'revenuecat_webhook_missing_user',
      severity: 'warning',
      metadata: { eventType: event?.type || '' }
    });
    return json(res, 400, { error: 'Missing RevenueCat user or entitlement.' });
  }

  const status = eventStatus(event);
  const result = await supabaseServiceRequest('user_subscriptions?on_conflict=user_id,provider,entitlement_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      user_id: userId,
      provider: 'revenuecat',
      entitlement_id: entitlementId,
      status,
      product_id: String(event?.product_id || ''),
      original_transaction_id: String(event?.original_transaction_id || event?.transaction_id || ''),
      expires_at: eventExpiresAt(event),
      metadata: {
        eventType: event?.type || '',
        periodType: event?.period_type || '',
        store: event?.store || '',
        purchasedAtMs: event?.purchased_at_ms || null
      },
      updated_at: new Date().toISOString()
    })
  });

  if (result.error) {
    await logAppEvent({
      area: 'subscriptions',
      eventType: 'revenuecat_webhook_sync_failed',
      severity: 'error',
      userId,
      metadata: { status: result.status, error: result.error }
    });
    return json(res, 502, { error: 'Subscription sync failed.' });
  }

  await logAppEvent({
    area: 'subscriptions',
    eventType: 'revenuecat_webhook_synced',
    severity: 'info',
    userId,
    metadata: { status, entitlementId, eventType: event?.type || '' }
  });

  return json(res, 200, { ok: true, status });
}
