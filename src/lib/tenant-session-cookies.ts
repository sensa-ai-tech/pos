import type { NextResponse } from 'next/server';
import {
  CLIENT_TENANT_ID_COOKIE,
  TENANT_SESSION_COOKIE,
  TENANT_SESSION_MAX_AGE_SECONDS,
  sessionCookieOptions,
} from '@/lib/session';

/**
 * Sets the signed tenant session cookie (httpOnly) plus the display-only
 * client_tenant_id / tenant_name hints read by the client.
 */
export function setTenantSessionCookies(
  response: NextResponse,
  { sessionToken, tenantId, tenantName }: { sessionToken: string; tenantId: string; tenantName: string }
): void {
  response.cookies.set(TENANT_SESSION_COOKIE, sessionToken, sessionCookieOptions(TENANT_SESSION_MAX_AGE_SECONDS));
  const hintOptions = {
    path: '/',
    maxAge: TENANT_SESSION_MAX_AGE_SECONDS,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
  };
  response.cookies.set(CLIENT_TENANT_ID_COOKIE, tenantId, hintOptions);
  response.cookies.set('tenant_name', encodeURIComponent(tenantName), hintOptions);
}
