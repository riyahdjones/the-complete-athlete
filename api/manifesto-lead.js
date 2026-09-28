import { envValue, json, readJson, setCorsHeaders } from '../server/supabase.js';
import { upsertHighLevelContact } from '../server/highlevel.js';

const MANIFESTO_TAG = 'Ninety Percent Manifesto';
const SMS_OPT_IN_TAG = 'Ninety Percent SMS Opt-In';

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
    if (webhookUrl) {
      const result = await sendToWebhook(lead, webhookUrl);
      return json(res, result.ok ? 200 : 502, result.ok ? { ok: true, method: result.method } : {
        ok: false,
        error: 'GHL webhook submission failed.'
      });
    }

    const result = await upsertHighLevelContact({
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      source: lead.source,
      tags: lead.smsConsent ? [MANIFESTO_TAG, SMS_OPT_IN_TAG] : [MANIFESTO_TAG]
    });
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
