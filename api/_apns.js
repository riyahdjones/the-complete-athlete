import http2 from 'node:http2';
import { webcrypto } from 'node:crypto';
import { envValue } from './_supabase.js';

function base64Url(input) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buffer
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function privateKeyBuffer(privateKey) {
  const pem = privateKey.includes('-----BEGIN PRIVATE KEY-----')
    ? privateKey
    : privateKey.replace(/\\n/g, '\n');
  const body = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s+/g, '');
  return Buffer.from(body, 'base64');
}

async function apnsJwt() {
  const teamId = envValue('APNS_TEAM_ID');
  const keyId = envValue('APNS_KEY_ID');
  const privateKey = envValue('APNS_PRIVATE_KEY');
  if (!teamId || !keyId || !privateKey) {
    throw new Error('APNs is not configured.');
  }

  const header = base64Url(JSON.stringify({ alg: 'ES256', kid: keyId }));
  const payload = base64Url(JSON.stringify({ iss: teamId, iat: Math.floor(Date.now() / 1000) }));
  const signingInput = `${header}.${payload}`;
  const key = await webcrypto.subtle.importKey(
    'pkcs8',
    privateKeyBuffer(privateKey),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
  const signature = await webcrypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    Buffer.from(signingInput)
  );
  return `${signingInput}.${base64Url(Buffer.from(signature))}`;
}

export function apnsConfigured() {
  return Boolean(
    envValue('APNS_TEAM_ID') &&
    envValue('APNS_KEY_ID') &&
    envValue('APNS_PRIVATE_KEY') &&
    envValue('APNS_BUNDLE_ID')
  );
}

export async function sendApplePush({ token, title, body, data = {} }) {
  if (!token) throw new Error('Missing device token.');
  const bundleId = envValue('APNS_BUNDLE_ID', 'IOS_BUNDLE_ID');
  const environment = envValue('APNS_ENVIRONMENT') || 'production';
  const host = environment === 'sandbox' ? 'api.sandbox.push.apple.com' : 'api.push.apple.com';
  const jwt = await apnsJwt();

  const payload = JSON.stringify({
    aps: {
      alert: { title, body },
      sound: 'default'
    },
    ...data
  });

  return new Promise((resolve, reject) => {
    const client = http2.connect(`https://${host}`);
    const request = client.request({
      ':method': 'POST',
      ':path': `/3/device/${token}`,
      authorization: `bearer ${jwt}`,
      'apns-topic': bundleId,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'content-type': 'application/json'
    });

    let status = 0;
    let responseBody = '';

    request.setEncoding('utf8');
    request.on('response', (headers) => {
      status = Number(headers[':status']) || 0;
    });
    request.on('data', (chunk) => {
      responseBody += chunk;
    });
    request.on('end', () => {
      client.close();
      if (status >= 200 && status < 300) {
        resolve(true);
        return;
      }
      reject(new Error(responseBody || `APNs failed with ${status}`));
    });
    request.on('error', (error) => {
      client.close();
      reject(error);
    });
    client.on('error', (error) => {
      reject(error);
    });

    request.end(payload);
  });
}
