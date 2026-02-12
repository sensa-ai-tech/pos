import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/onboarding', '/api/tenants/setup', '/api/tenants'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow static assets and Next.js internals
  if (pathname.startsWith('/_next/') || pathname.startsWith('/favicon.ico')) {
    return NextResponse.next();
  }

  // ============ Admin Routes ============
  // Admin login page and admin login API are always accessible
  if (pathname === '/admin/login' || pathname === '/api/admin/login') {
    return NextResponse.next();
  }

  // Admin API routes — check admin_id cookie
  if (pathname.startsWith('/api/admin/')) {
    const adminId = request.cookies.get('admin_id')?.value;
    if (!adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.next();
  }

  // Admin pages — check admin_id cookie, redirect to admin login if missing
  if (pathname.startsWith('/admin')) {
    const adminId = request.cookies.get('admin_id')?.value;
    if (!adminId) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
    return NextResponse.next();
  }

  // ============ Tenant Routes ============
  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Check for tenant_id cookie
  const tenantId = request.cookies.get('tenant_id')?.value;
  if (!tenantId) {
    // For API routes, return 401
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // For pages, redirect to onboarding
    return NextResponse.redirect(new URL('/onboarding', request.url));
  }

  // For API routes, inject tenant_id from cookie into request headers
  if (pathname.startsWith('/api/')) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-tenant-id', tenantId);
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
