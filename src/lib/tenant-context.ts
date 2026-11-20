import { NextRequest } from 'next/server';
import { db } from '@/db';
import { tenants } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { TENANT_SESSION_COOKIE, verifySession, type TenantSession } from '@/lib/session';

/** Returns the verified tenant session from the signed cookie, or null. Never trusts client headers. */
export async function getTenantSession(request: NextRequest): Promise<TenantSession | null> {
  return verifySession(request.cookies.get(TENANT_SESSION_COOKIE)?.value, 'tenant');
}

export async function getTenantId(request: NextRequest): Promise<string | null> {
  const session = await getTenantSession(request);
  return session?.tenantId ?? null;
}

export function validateTenant(tenantId: string) {
  const tenant = db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
  });
  return tenant ?? null;
}

export async function requireTenantId(request: NextRequest): Promise<string> {
  const tenantId = await getTenantId(request);
  if (!tenantId) {
    throw new Error('Unauthorized: tenant identification required');
  }
  return tenantId;
}
