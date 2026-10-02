import crypto from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyStandardWebhook } from '../server/supabase-auth-email.js';

function signedHeaders(payload, secret, timestamp = Math.floor(Date.now() / 1000)) {
  const id = 'msg_test_auth_email';
  const key = Buffer.from(secret.replace(/^v1,whsec_/, ''), 'base64');
  const signature = crypto.createHmac('sha256', key).update(`${id}.${timestamp}.${payload}`).digest('base64');
  return {
    'webhook-id': id,
    'webhook-timestamp': String(timestamp),
    'webhook-signature': `v1,${signature}`
  };
}

test('accepts a valid Supabase Standard Webhooks signature', () => {
  const secret = `v1,whsec_${Buffer.from('complete-athlete-hook-secret').toString('base64')}`;
  const payload = JSON.stringify({ user: { email: 'athlete@example.com' } });
  assert.equal(verifyStandardWebhook(payload, signedHeaders(payload, secret), secret), true);
});

test('rejects tampered and expired webhook signatures', () => {
  const secret = `v1,whsec_${Buffer.from('complete-athlete-hook-secret').toString('base64')}`;
  const payload = JSON.stringify({ user: { email: 'athlete@example.com' } });
  const headers = signedHeaders(payload, secret);
  assert.equal(verifyStandardWebhook(`${payload} `, headers, secret), false);

  const expired = Math.floor(Date.now() / 1000) - 600;
  assert.equal(verifyStandardWebhook(payload, signedHeaders(payload, secret, expired), secret), false);
});
