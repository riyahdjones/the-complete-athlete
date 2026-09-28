import { envValue } from './supabase.js';

export const DEFAULT_GHL_LOCATION_ID = 'J5jwTA7jPr3FTKdXz9iP';

function splitName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: parts[0] || '', lastName: '' };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' ')
  };
}

export async function highLevelRequest(path, token, options = {}) {
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

export async function upsertHighLevelContact({
  name,
  email,
  phone = '',
  source,
  tags = []
}) {
  const token = envValue('GHL_PRIVATE_INTEGRATION_TOKEN', 'GHL_ACCESS_TOKEN');
  const locationId = envValue('GHL_LOCATION_ID') || DEFAULT_GHL_LOCATION_ID;
  if (!token) {
    return { ok: false, status: 503, error: 'GHL integration is not configured.' };
  }

  const { firstName, lastName } = splitName(name);
  const contact = {
    locationId,
    name,
    firstName,
    lastName,
    email,
    source,
    createNewIfDuplicateAllowed: false
  };
  if (phone) contact.phone = phone;

  const upsert = await highLevelRequest('/contacts/upsert', token, {
    method: 'POST',
    body: JSON.stringify(contact)
  });
  if (upsert.error) {
    return { ok: false, status: upsert.status, error: upsert.error };
  }

  const contactId = upsert.data?.contact?.id || upsert.data?.id;
  const uniqueTags = [...new Set(tags.map((tag) => String(tag || '').trim()).filter(Boolean))];
  if (contactId && uniqueTags.length) {
    const tagResult = await highLevelRequest(`/contacts/${contactId}/tags`, token, {
      method: 'POST',
      body: JSON.stringify({ tags: uniqueTags })
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
