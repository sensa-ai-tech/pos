import { NextResponse } from 'next/server';
import { ADMIN_SESSION_COOKIE } from '@/lib/session';

// Clears the admin session and the legacy unsigned admin cookie.
export async function POST() {
  const response = NextResponse.json({ ok: true });
  for (const name of [ADMIN_SESSION_COOKIE, 'admin_id']) {
    response.cookies.set(name, '', { path: '/', maxAge: 0 });
  }
  return response;
}
