import { NextResponse } from 'next/server';
import { adminCookieName, adminSessionValue, validateAdminPassword } from '../../lib/admin-auth';

export async function POST(request) {
  const formData = await request.formData();
  const password = String(formData.get('password') ?? '');

  if (!validateAdminPassword(password)) {
    return NextResponse.redirect(new URL('/?error=bad-password', request.url), 303);
  }

  const response = NextResponse.redirect(new URL('/', request.url), 303);
  response.cookies.set(adminCookieName(), adminSessionValue(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: new URL(request.url).protocol === 'https:',
    path: '/',
    maxAge: 60 * 60 * 8
  });

  return response;
}
