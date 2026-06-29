import { NextResponse } from 'next/server';
import { adminCookieName } from '../../lib/admin-auth';

export async function POST(request) {
  const response = NextResponse.redirect(new URL('/', request.url), 303);
  response.cookies.delete(adminCookieName());
  return response;
}
