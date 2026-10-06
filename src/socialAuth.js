import { Capacitor, registerPlugin } from '@capacitor/core';

const NativeAuth = registerPlugin('TCAAuth');
export const nativeAuthRedirect = 'com.riyahdjones.thecompleteathlete://auth/callback';
const intentKey = 'tca-social-auth-intent';
const finishing = new Map();

export function validIntent(value, now = Date.now()) {
  return value && ['apple', 'google'].includes(value.provider)
    && ['athlete', 'parent'].includes(value.role)
    && Number.isFinite(value.startedAt) && now >= value.startedAt
    && now - value.startedAt < 30 * 60 * 1000;
}

export function isNewSocialAccount(user, intent) {
  return validIntent(intent) && !user.user_metadata?.role
    && Date.parse(user.created_at) >= intent.startedAt - 5000
    && user.app_metadata?.providers?.includes(intent.provider);
}

export async function startSocialAuth(client, oauthClient, provider, context) {
  if (!['apple', 'google'].includes(provider)) throw new Error('Unsupported sign-in provider.');
  if (!client) throw new Error('Sign-in is unavailable. Please try again later.');
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() !== 'ios') {
    throw new Error('Please use email sign-in on this device.');
  }
  const intent = { provider, role: context.role === 'parent' ? 'parent' : 'athlete',
    name: String(context.name || '').trim(), language: context.language === 'es' ? 'es' : 'en',
    parentCode: context.mode === 'signup' ? String(context.parentCode || '').trim() : '',
    parentFamilyCode: context.mode === 'signup' ? String(context.parentFamilyCode || '').trim() : '', startedAt: Date.now() };
  localStorage.setItem(intentKey, JSON.stringify(intent));
  try {
    const native = Capacitor.isNativePlatform();
    const redirectTo = native ? nativeAuthRedirect : `${window.location.origin}/?socialAuth=1`;
    const { data, error } = await oauthClient.auth.signInWithOAuth({ provider, options: {
      redirectTo, skipBrowserRedirect: true,
      ...(provider === 'google' ? { queryParams: { prompt: 'select_account' } } : {})
    } });
    if (error) throw error;
    if (!data?.url) throw new Error('Unable to open sign-in. Please try again.');
    if (!native) { window.location.assign(data.url); return; }
    const result = await NativeAuth.authenticate({ url: data.url });
    const callback = new URL(result.url);
    if (`${callback.protocol}//${callback.host}${callback.pathname}` !== nativeAuthRedirect) throw new Error('Invalid sign-in response.');
    if (callback.searchParams.has('error')) throw new Error('Sign-in was not completed. Please try again.');
    const code = callback.searchParams.get('code');
    if (!code) throw new Error('Sign-in did not return an authorization code.');
    await exchangeSocialCode(client, oauthClient, code);
  } catch (error) {
    localStorage.removeItem(intentKey);
    if (error?.code === 'CANCELLED') return;
    if (/provider.*(disabled|not enabled)|unsupported provider/i.test(error?.message || '')) {
      throw new Error('This sign-in option is being set up. Please use email for now.');
    }
    throw error;
  }
}

export function finishSocialProfile(client, user) {
  if (finishing.has(user.id)) return finishing.get(user.id);
  const job = (async () => {
    let intent;
    try { intent = JSON.parse(localStorage.getItem(intentKey)); } catch { return; }
    if (!validIntent(intent)) { localStorage.removeItem(intentKey); return; }
    if (isNewSocialAccount(user, intent)) {
      const name = intent.name || user.user_metadata?.full_name || user.user_metadata?.name || '';
      const { error } = await client.from('profiles').update({ role: intent.role, full_name: name, preferred_language: intent.language }).eq('id', user.id);
      if (error) throw new Error('Your account was created, but setup could not finish. Please try signing in again.');
      const { error: metadataError } = await client.auth.updateUser({ data: { role: intent.role, full_name: name, preferred_language: intent.language } });
      if (metadataError) throw metadataError;
      if (intent.role === 'parent' && intent.parentCode) {
        const { error: linkError } = await client.rpc('link_parent_to_athlete', { access_code: intent.parentCode });
        if (linkError) localStorage.setItem('tca-social-link-warning', 'Account created. Add your athlete’s code in Settings to finish linking.');
      }
      if (intent.role === 'athlete' && intent.parentFamilyCode) {
        const { error: linkError } = await client.rpc('link_athlete_to_parent', { parent_code: intent.parentFamilyCode });
        if (linkError) localStorage.setItem('tca-social-link-warning', 'Account created. Add your family code in Settings to finish linking.');
      }
    }
    localStorage.removeItem(intentKey);
  })().finally(() => finishing.delete(user.id));
  finishing.set(user.id, job);
  return job;
}

async function exchangeSocialCode(client, oauthClient, code) {
  const { data, error } = await oauthClient.auth.exchangeCodeForSession(code);
  if (error) throw error;
  if (!data.session) throw new Error('Sign-in did not return a session.');
  const { error: sessionError } = await client.auth.setSession({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
  if (sessionError) throw sessionError;
}

let callbackJob;
export function completeSocialRedirect(client, oauthClient) {
  const url = new URL(window.location.href);
  if (url.searchParams.get('socialAuth') !== '1') return Promise.resolve();
  if (callbackJob) return callbackJob;
  callbackJob = (async () => {
    try {
      if (url.searchParams.has('error')) throw new Error('Sign-in was not completed. Please try again.');
      const code = url.searchParams.get('code');
      if (code) await exchangeSocialCode(client, oauthClient, code);
    } finally {
      ['code', 'socialAuth', 'error', 'error_description', 'error_code'].forEach((key) => url.searchParams.delete(key));
      window.history.replaceState({}, '', url.pathname + url.search + url.hash);
    }
  })();
  return callbackJob;
}
