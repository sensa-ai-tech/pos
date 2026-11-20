import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  ADMIN_SESSION_COOKIE,
  TENANT_SESSION_COOKIE,
  SessionSecretError,
  signSession,
  verifySession,
} from '@/lib/session';
import { middleware } from '@/middleware';

const TEST_SECRET = 'test-secret-that-is-at-least-32-characters-long';

function request(path: string, init: { cookie?: string; headers?: Record<string, string> } = {}) {
  const headers = new Headers(init.headers);
  if (init.cookie) headers.set('cookie', init.cookie);
  return new NextRequest(`http://localhost${path}`, { headers });
}

beforeEach(() => {
  vi.stubEnv('SESSION_SECRET', TEST_SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('signed session tokens', () => {
  it('round-trips a tenant session', async () => {
    const token = await signSession({ kind: 'tenant', tenantId: 't-1', userId: 'u-1' }, 60);
    expect(await verifySession(token, 'tenant')).toEqual({ kind: 'tenant', tenantId: 't-1', userId: 'u-1' });
  });

  it('rejects a tampered payload, a token of the other kind, and an expired token', async () => {
    const token = await signSession({ kind: 'tenant', tenantId: 't-1', userId: 'u-1' }, 60);
    const [, expiry, signature] = token.split('.');
    const forgedPayload = Buffer.from(JSON.stringify({ kind: 'tenant', tenantId: 't-2', userId: 'u-1' }))
      .toString('base64url');
    expect(await verifySession(`${forgedPayload}.${expiry}.${signature}`, 'tenant')).toBeNull();
    expect(await verifySession(token, 'admin')).toBeNull();
    expect(await verifySession(token, 'tenant', Date.now() + 61_000)).toBeNull();
    expect(await verifySession('t-1', 'tenant')).toBeNull();
  });

  it('throws when SESSION_SECRET is missing or too short', async () => {
    vi.stubEnv('SESSION_SECRET', '');
    await expect(signSession({ kind: 'admin', adminId: 'a-1' }, 60)).rejects.toBeInstanceOf(SessionSecretError);
    vi.stubEnv('SESSION_SECRET', 'short');
    await expect(verifySession('x.1.y', 'admin')).rejects.toBeInstanceOf(SessionSecretError);
  });
});

describe('middleware session enforcement', () => {
  it('rejects unsigned legacy cookies on tenant and admin APIs', async () => {
    const tenantRes = await middleware(request('/api/products', { cookie: 'tenant_id=t-1; user_id=u-1' }));
    expect(tenantRes.status).toBe(401);
    const adminRes = await middleware(request('/api/admin/tenants', { cookie: 'admin_id=a-1' }));
    expect(adminRes.status).toBe(401);
    const tenantByIdRes = await middleware(request('/api/tenants/t-1'));
    expect(tenantByIdRes.status).toBe(401);
  });

  it('replaces a client-supplied x-tenant-id with the signed session tenant', async () => {
    const token = await signSession({ kind: 'tenant', tenantId: 't-1', userId: 'u-1' }, 60);
    const res = await middleware(request('/api/products', {
      cookie: `${TENANT_SESSION_COOKIE}=${token}`,
      headers: { 'x-tenant-id': 'victim' },
    }));
    expect(res.status).toBe(200);
    expect(res.headers.get('x-middleware-request-x-tenant-id')).toBe('t-1');

    const publicRes = await middleware(request('/api/tenants/setup', { headers: { 'x-tenant-id': 'victim' } }));
    expect(publicRes.headers.get('x-middleware-request-x-tenant-id')).toBeNull();
  });

  it('does not accept a tenant session as an admin session', async () => {
    const token = await signSession({ kind: 'tenant', tenantId: 't-1', userId: 'u-1' }, 60);
    const res = await middleware(request('/api/admin/tenants', { cookie: `${ADMIN_SESSION_COOKIE}=${token}` }));
    expect(res.status).toBe(401);
  });

  it('returns 503 instead of passing through when SESSION_SECRET is missing', async () => {
    vi.stubEnv('SESSION_SECRET', '');
    const res = await middleware(request('/api/products', { cookie: `${TENANT_SESSION_COOKIE}=x.1.y` }));
    expect(res.status).toBe(503);
  });
});
