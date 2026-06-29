import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { adminEnv } from './admin-env';

const cookieName = 'tca_admin_session';

export function adminCookieName() {
  return cookieName;
}

export function adminSessionValue() {
  const { dashboardPassword, serviceRoleKey } = adminEnv();
  return crypto
    .createHmac('sha256', serviceRoleKey || 'local-admin')
    .update(`tca-admin:${dashboardPassword}`)
    .digest('hex');
}

export async function isAdminAuthed() {
  const cookieStore = await cookies();
  return cookieStore.get(cookieName)?.value === adminSessionValue();
}

export async function setAdminSession() {
  const cookieStore = await cookies();
  cookieStore.set(cookieName, adminSessionValue(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 8
  });
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(cookieName);
}

export function validateAdminPassword(password) {
  return password === adminEnv().dashboardPassword;
}
