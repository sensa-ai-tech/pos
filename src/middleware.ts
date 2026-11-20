import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  ADMIN_SESSION_COOKIE,
  TENANT_SESSION_COOKIE,
  SessionSecretError,
  verifySession,
} from '@/lib/session';

// Exact paths reachable without a tenant session.
const PUBLIC_PATHS = new Set(['/onboarding', '/api/tenants/setup', '/api/auth/logout']);
// Exact admin paths reachable without an admin session.
const ADMIN_PUBLIC_PATHS = new Set(['/admin/login', '/api/admin/login', '/api/admin/logout']);

// Identity headers that only the middleware may set; client-supplied values are always dropped.
const IDENTITY_HEADERS = ['x-tenant-id', 'x-user-id', 'x-admin-id'];

function isUnder(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow static assets and Next.js internals
  if (pathname.startsWith('/_next/') || pathname.startsWith('/favicon.ico')) {
    return NextResponse.next();
  }

  const requestHeaders = new Headers(request.headers);
  for (const header of IDENTITY_HEADERS) requestHeaders.delete(header);
  const next = () => NextResponse.next({ request: { headers: requestHeaders } });

  try {
    // ============ Admin Routes ============
    if (ADMIN_PUBLIC_PATHS.has(pathname)) {
      return next();
    }

    if (isUnder(pathname, '/api/admin') || isUnder(pathname, '/admin')) {
      const session = await verifySession(request.cookies.get(ADMIN_SESSION_COOKIE)?.value, 'admin');
      if (!session) {
        if (pathname.startsWith('/api/')) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        return NextResponse.redirect(new URL('/admin/login', request.url));
      }
      requestHeaders.set('x-admin-id', session.adminId);
      return next();
    }

    // ============ Tenant Routes ============
    if (PUBLIC_PATHS.has(pathname)) {
      return next();
    }

    const session = await verifySession(request.cookies.get(TENANT_SESSION_COOKIE)?.value, 'tenant');
    if (!session) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      return NextResponse.redirect(new URL('/onboarding', request.url));
    }

    requestHeaders.set('x-tenant-id', session.tenantId);
    requestHeaders.set('x-user-id', session.userId);
    return next();
  } catch (error) {
    if (error instanceof SessionSecretError) {
      console.error('Session secret is not configured:', error.message);
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 503 });
    }
    throw error;
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
