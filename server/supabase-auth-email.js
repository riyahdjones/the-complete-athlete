import crypto from 'node:crypto';
import { envValue, json } from './supabase.js';
import { highLevelRequest } from './highlevel.js';

const SUPABASE_URL = 'https://nddtgwygnzjikjynrzen.supabase.co';
const APP_URL = 'https://the-complete-athlete.vercel.app/';

async function rawRequestBody(req) {
  if (typeof req.body === 'string') return req.body;
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

function headerValue(headers, name) {
  const value = headers[name] ?? headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : String(value || '');
}

function decodeSecret(value) {
  return Buffer.from(String(value || '').replace(/^v1,whsec_/, ''), 'base64');
}

export function verifyStandardWebhook(payload, headers, secretValue, now = Date.now()) {
  const id = headerValue(headers, 'webhook-id');
  const timestamp = headerValue(headers, 'webhook-timestamp');
  const signatures = headerValue(headers, 'webhook-signature')
    .split(' ')
    .map((entry) => entry.split(',').at(-1))
    .filter(Boolean);
  if (!id || !timestamp || !signatures.length || !secretValue) return false;

  const time = Number(timestamp);
  if (!Number.isFinite(time) || Math.abs(now / 1000 - time) > 300) return false;
  const expected = crypto
    .createHmac('sha256', decodeSecret(secretValue))
    .update(`${id}.${timestamp}.${payload}`)
    .digest();

  return signatures.some((signature) => {
    try {
      const received = Buffer.from(signature, 'base64');
      return received.length === expected.length && crypto.timingSafeEqual(received, expected);
    } catch {
      return false;
    }
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function displayName(payload) {
  const metadata = payload.user?.user_metadata || {};
  return String(metadata.full_name || metadata.name || metadata.display_name || '').trim();
}

function emailJobs(payload) {
  const data = payload.email_data || {};
  const actionType = data.email_action_type || 'magiclink';
  const currentEmail = String(payload.user?.email || '').trim().toLowerCase();
  const nextEmail = String(payload.user?.new_email || '').trim().toLowerCase();

  if (actionType === 'email_change') {
    const jobs = [];
    if (currentEmail && data.token_hash_new) {
      jobs.push({ to: currentEmail, tokenHash: data.token_hash_new, actionType });
    }
    if (nextEmail && data.token_hash) {
      jobs.push({ to: nextEmail, tokenHash: data.token_hash, actionType });
    }
    return jobs;
  }
  if (!currentEmail || !data.token_hash) return [];
  return [{ to: currentEmail, tokenHash: data.token_hash, actionType }];
}

function emailCopy(actionType) {
  const copies = {
    recovery: ['Reset your Complete Athlete password', 'PASSWORD RESET', 'Create a new password', 'Use the secure button below to reset your password and get back to your training.', 'Reset my password', "If you didn't request this, you can safely ignore this email."],
    signup: ['Confirm your Complete Athlete account', 'WELCOME TO THE COMPLETE ATHLETE', 'Confirm your email', 'Confirm your email to finish creating your account and start training the part of your game no one sees.', 'Confirm my account', "If you didn't create this account, you can safely ignore this email."],
    invite: ["You've been invited to The Complete Athlete", 'YOUR INVITATION IS READY', 'Join The Complete Athlete', 'Accept your invitation to begin building the mindset, habits, and discipline that change performance.', 'Accept invitation', "If you weren't expecting this invitation, you can safely ignore this email."],
    email_change: ['Confirm your new Complete Athlete email', 'EMAIL CHANGE', 'Confirm this email address', 'Use the secure button below to confirm the email address connected to your account.', 'Confirm email', "If you didn't request this change, contact help@completeathlete.io."],
    magiclink: ['Your Complete Athlete sign-in link', 'SECURE SIGN IN', 'Sign in to your account', 'Use the secure button below to sign in to The Complete Athlete.', 'Sign in', "If you didn't request this link, you can safely ignore this email."]
  };
  const copy = copies[actionType] || ['Complete your Complete Athlete account action', 'THE COMPLETE ATHLETE', 'Continue securely', 'Use the secure button below to continue.', 'Continue', "If you didn't request this, you can safely ignore this email."];
  return { subject: copy[0], eyebrow: copy[1], heading: copy[2], body: copy[3], button: copy[4], footer: copy[5] };
}

function confirmationLink(payload, job) {
  const redirectTo = payload.email_data?.redirect_to || payload.email_data?.site_url || APP_URL;
  const params = new URLSearchParams({
    token: job.tokenHash,
    type: job.actionType,
    redirect_to: redirectTo
  });
  return `${envValue('SUPABASE_URL') || SUPABASE_URL}/auth/v1/verify?${params}`;
}

function renderEmail(payload, job) {
  const copy = emailCopy(job.actionType);
  const firstName = displayName(payload).split(/\s+/)[0];
  const greeting = firstName ? `Hi ${escapeHtml(firstName)},` : 'Hi,';
  const link = confirmationLink(payload, job);
  const html = `<!doctype html><html><body style="margin:0;background:#f3f6fb;font-family:Arial,Helvetica,sans-serif;color:#071633"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f6fb;padding:28px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff;border:1px solid #d8e2f2;border-radius:20px;overflow:hidden"><tr><td style="height:10px;background:#2f73ff"></td></tr><tr><td style="padding:36px 34px 14px"><div style="font-size:12px;font-weight:800;letter-spacing:1.4px;color:#2f73ff">${copy.eyebrow}</div><h1 style="margin:12px 0 14px;font-size:30px;line-height:1.1">${copy.heading}</h1><p style="font-size:17px;line-height:1.6;color:#33415d">${greeting}</p><p style="font-size:17px;line-height:1.6;color:#33415d">${copy.body}</p></td></tr><tr><td style="padding:18px 34px 24px"><a href="${escapeHtml(link)}" style="display:block;background:#2168f4;color:#fff;text-decoration:none;text-align:center;font-size:17px;font-weight:800;padding:16px 22px;border-radius:14px">${copy.button}</a></td></tr><tr><td style="padding:0 34px 34px"><p style="font-size:13px;line-height:1.55;color:#66718a">${copy.footer}</p><p style="font-size:12px;color:#8992a6">The Complete Athlete · Train the part of your game no one sees.</p></td></tr></table></td></tr></table></body></html>`;
  const text = `${greeting}\n\n${copy.body}\n\n${copy.button}: ${link}\n\n${copy.footer}`;
  return { ...copy, html, text };
}

async function deliverEmail(payload, job) {
  const token = envValue('GHL_AUTH_EMAIL_TOKEN', 'GHL_PRIVATE_INTEGRATION_TOKEN');
  if (!token) throw new Error('GHL auth email integration is not configured.');
  const name = displayName(payload);
  const parts = name.split(/\s+/).filter(Boolean);
  const upsert = await highLevelRequest('/contacts/upsert', token, {
    method: 'POST',
    body: JSON.stringify({
      locationId: envValue('GHL_LOCATION_ID') || 'J5jwTA7jPr3FTKdXz9iP',
      email: job.to,
      name: name || job.to.split('@')[0],
      firstName: parts[0] || '',
      lastName: parts.slice(1).join(' '),
      source: 'The Complete Athlete App',
      createNewIfDuplicateAllowed: false
    })
  });
  if (upsert.error) throw new Error(`GHL contact error: ${upsert.error}`);
  const contactId = upsert.data?.contact?.id || upsert.data?.id;
  if (!contactId) throw new Error('GHL did not return a contact id.');

  const email = renderEmail(payload, job);
  const sent = await highLevelRequest('/conversations/messages', token, {
    method: 'POST',
    body: JSON.stringify({
      type: 'Email',
      contactId,
      emailFrom: envValue('GHL_AUTH_EMAIL_FROM') || 'The Complete Athlete <help@completeathlete.io>',
      emailTo: job.to,
      subject: email.subject,
      html: email.html,
      message: email.text,
      status: 'pending'
    })
  });
  if (sent.error) throw new Error(`GHL email error: ${sent.error}`);
}

export async function handleSupabaseAuthEmail(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' });
  try {
    const raw = await rawRequestBody(req);
    const hookSecret = envValue('SUPABASE_SEND_EMAIL_HOOK_SECRET');
    if (!verifyStandardWebhook(raw, req.headers, hookSecret)) {
      return json(res, 401, { error: { http_code: 401, message: 'Invalid webhook signature.' } });
    }
    const payload = JSON.parse(raw);
    const jobs = emailJobs(payload);
    if (!jobs.length) throw new Error('No deliverable auth email was included.');
    await Promise.all(jobs.map((job) => deliverEmail(payload, job)));
    return json(res, 200, {});
  } catch (error) {
    console.error('supabase-auth-email error', error);
    return json(res, 500, { error: { http_code: 500, message: error?.message || 'Auth email delivery failed.' } });
  }
}
