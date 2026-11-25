import { NextResponse } from 'next/server';
import { CLIENT_TENANT_ID_COOKIE, TENANT_SESSION_COOKIE } from '@/lib/session';

// Clears the tenant session plus display hints and legacy unsigned cookies.
const TENANT_COOKIES = [TENANT_SESSION_COOKIE, CLIENT_TENANT_ID_COOKIE, 'tenant_name', 'tenant_id', 'user_id'];

export async function POST() {
  const response = NextResponse.json({ ok: true });
  for (const name of TENANT_COOKIES) {
    response.cookies.set(name, '', { path: '/', maxAge: 0 });
  }
  return response;
}
