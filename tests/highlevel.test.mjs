import test from 'node:test';
import assert from 'node:assert/strict';
import { upsertHighLevelContact } from '../server/highlevel.js';

test('app contacts are upserted by email and receive workflow tags', async () => {
  const originalFetch = globalThis.fetch;
  const originalToken = process.env.GHL_PRIVATE_INTEGRATION_TOKEN;
  const originalLocation = process.env.GHL_LOCATION_ID;
  const calls = [];

  process.env.GHL_PRIVATE_INTEGRATION_TOKEN = 'test-token';
  process.env.GHL_LOCATION_ID = 'test-location';
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/contacts/upsert')) {
      return new Response(JSON.stringify({ contact: { id: 'contact-1' }, new: true }), { status: 200 });
    }
    return new Response(JSON.stringify({ tags: [] }), { status: 200 });
  };

  try {
    const result = await upsertHighLevelContact({
      name: 'Jordan Smith',
      email: 'jordan@example.com',
      source: 'The Complete Athlete App',
      tags: ['Complete Athlete App User', 'Complete Athlete Athlete']
    });

    assert.equal(result.ok, true);
    assert.equal(result.contactId, 'contact-1');
    assert.equal(calls.length, 2);

    const contactBody = JSON.parse(calls[0].options.body);
    assert.equal(contactBody.locationId, 'test-location');
    assert.equal(contactBody.email, 'jordan@example.com');
    assert.equal(contactBody.firstName, 'Jordan');
    assert.equal(contactBody.lastName, 'Smith');
    assert.equal('phone' in contactBody, false);

    const tagBody = JSON.parse(calls[1].options.body);
    assert.deepEqual(tagBody.tags, ['Complete Athlete App User', 'Complete Athlete Athlete']);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalToken === undefined) delete process.env.GHL_PRIVATE_INTEGRATION_TOKEN;
    else process.env.GHL_PRIVATE_INTEGRATION_TOKEN = originalToken;
    if (originalLocation === undefined) delete process.env.GHL_LOCATION_ID;
    else process.env.GHL_LOCATION_ID = originalLocation;
  }
});
