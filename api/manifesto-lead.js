import { envValue, json, readJson, setCorsHeaders } from './_supabase.js';

const DEFAULT_LOCATION_ID = 'J5jwTA7jPr3FTKdXz9iP';
const MANIFESTO_TAG = 'Ninety Percent Manifesto';
const SMS_OPT_IN_TAG = 'Ninety Percent SMS Opt-In';

function splitName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: parts[0] || '', lastName: '' };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' ')
  };
}

function cleanLead(body) {
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const phone = String(body.phone || '').trim();
  return {
    name,
    email,
    phone,
    smsConsent: Boolean(body.smsConsent),
    source: String(body.source || MANIFESTO_TAG).trim(),
    submittedAt: String(body.submittedAt || new Date().toISOString()).trim()
  };
}

function validateLead(lead) {
  if (!lead.name) return 'Name is required.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) return 'A valid email is required.';
  if (lead.phone.replace(/\D/g, '').length < 10) return 'A valid phone number is required.';
  return '';
}

async function sendToWebhook(lead, url) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...lead,
      tag: MANIFESTO_TAG,
      tags: lead.smsConsent ? [MANIFESTO_TAG, SMS_OPT_IN_TAG] : [MANIFESTO_TAG],
      campaign: MANIFESTO_TAG
    })
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    return { ok: false, status: response.status, error: text || response.statusText };
  }
  return { ok: true, method: 'webhook' };
}

async function highLevelRequest(path, token, options = {}) {
  const version = envValue('GHL_API_VERSION') || '2021-07-28';
  const response = await fetch(`https://services.leadconnectorhq.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Version: version,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text ? { message: text } : null;
  }
  return {
    data,
    error: response.ok ? null : data?.message || data?.error || response.statusText,
    status: response.status
  };
}

async function sendToHighLevel(lead, token, locationId) {
  const { firstName, lastName } = splitName(lead.name);
  const upsert = await highLevelRequest('/contacts/upsert', token, {
    method: 'POST',
    body: JSON.stringify({
      locationId,
      name: lead.name,
      firstName,
      lastName,
      email: lead.email,
      phone: lead.phone,
      source: lead.source,
      createNewIfDuplicateAllowed: false
    })
  });

  if (upsert.error) {
    return { ok: false, status: upsert.status, error: upsert.error };
  }

  const contactId = upsert.data?.contact?.id || upsert.data?.id;
  if (contactId) {
    const tags = lead.smsConsent ? [MANIFESTO_TAG, SMS_OPT_IN_TAG] : [MANIFESTO_TAG];
    const tagResult = await highLevelRequest(`/contacts/${contactId}/tags`, token, {
      method: 'POST',
      body: JSON.stringify({ tags })
    });
    if (tagResult.error) {
      return { ok: false, status: tagResult.status, error: tagResult.error };
    }
  }

  return {
    ok: true,
    method: 'api',
    contactId,
    created: Boolean(upsert.data?.new)
  };
}

export default async function handler(req, res) {
  try {
    setCorsHeaders(res, 'POST, OPTIONS');

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      return res.end();
    }

    if (req.method !== 'POST') {
      return json(res, 405, { ok: false, error: 'Method not allowed.' });
    }

    const lead = cleanLead(await readJson(req));
    const validationError = validateLead(lead);
    if (validationError) {
      return json(res, 400, { ok: false, error: validationError });
    }

    const webhookUrl = envValue('GHL_MANIFESTO_WEBHOOK_URL');
    const token = envValue('GHL_PRIVATE_INTEGRATION_TOKEN', 'GHL_ACCESS_TOKEN');
    const locationId = envValue('GHL_LOCATION_ID') || DEFAULT_LOCATION_ID;

    if (webhookUrl) {
      const result = await sendToWebhook(lead, webhookUrl);
      return json(res, result.ok ? 200 : 502, result.ok ? { ok: true, method: result.method } : {
        ok: false,
        error: 'GHL webhook submission failed.'
      });
    }

    if (!token) {
      return json(res, 503, { ok: false, error: 'GHL integration is not configured.' });
    }

    const result = await sendToHighLevel(lead, token, locationId);
    return json(res, result.ok ? 200 : 502, result.ok ? {
      ok: true,
      method: result.method,
      contactId: result.contactId,
      created: result.created
    } : {
      ok: false,
      error: 'GHL contact submission failed.'
    });
  } catch (error) {
    console.error('manifesto-lead error', error);
    return json(res, 500, { ok: false, error: 'Lead submission failed.' });
  }
}
