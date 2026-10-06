import test from 'node:test';
import assert from 'node:assert/strict';
import { validIntent, isNewSocialAccount, finishSocialProfile } from '../src/socialAuth.js';

const intent = () => ({ provider: 'google', role: 'parent', startedAt: Date.now(), language: 'en', parentCode: 'TCA-TEST' });
const user = (context) => ({ id: 'user-1', created_at: new Date(context.startedAt).toISOString(), user_metadata: {}, app_metadata: { providers: ['google'] } });

test('social auth intent expires and rejects invalid roles/providers', () => {
  const value = intent();
  assert.ok(validIntent(value));
  assert.equal(validIntent({ ...value, role: 'admin' }), false);
  assert.equal(validIntent({ ...value, provider: 'unknown' }), false);
  assert.equal(validIntent(value, value.startedAt + 31 * 60000), false);
});

test('existing accounts never change role from a signup choice', () => {
  const value = intent();
  assert.ok(isNewSocialAccount(user(value), value));
  assert.equal(isNewSocialAccount({ ...user(value), user_metadata: { role: 'athlete' } }, value), false);
  assert.equal(isNewSocialAccount({ ...user(value), created_at: '2020-01-01' }, value), false);
});

test('new parent receives role before family linking and concurrent restoration runs once', async () => {
  const value = intent();
  const storage = new Map([['tca-social-auth-intent', JSON.stringify(value)]]);
  global.localStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, v) => storage.set(key,v), removeItem: (key) => storage.delete(key) };
  const calls = [];
  const client = {
    from: () => ({ update: (fields) => ({ eq: async () => { calls.push(fields.role); return {}; } }) }),
    auth: { updateUser: async () => { calls.push('metadata'); return {}; } },
    rpc: async (name) => { calls.push(name); return {}; }
  };
  await Promise.all([finishSocialProfile(client, user(value)), finishSocialProfile(client, user(value))]);
  assert.deepEqual(calls, ['parent', 'metadata', 'link_parent_to_athlete']);
  assert.equal(storage.has('tca-social-auth-intent'), false);
});

test('failed profile setup retains the intent for retry', async () => {
  const value = intent();
  const storage = new Map([['tca-social-auth-intent', JSON.stringify(value)]]);
  global.localStorage = { getItem: (key) => storage.get(key) ?? null, removeItem: (key) => storage.delete(key) };
  const client = { from: () => ({ update: () => ({ eq: async () => ({ error: new Error('offline') }) }) }) };
  await assert.rejects(finishSocialProfile(client, user(value)));
  assert.equal(storage.has('tca-social-auth-intent'), true);
});
