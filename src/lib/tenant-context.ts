import { NextRequest } from 'next/server';
import { db } from '@/db';
import { tenants } from '@/db/schema';
import { eq } from 'drizzle-orm';

export function getTenantId(request: NextRequest): string | null {
  return request.headers.get('x-tenant-id');
}

export function validateTenant(tenantId: string) {
  const tenant = db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
  });
  return tenant ?? null;
}

export function requireTenantId(request: NextRequest): string {
  const tenantId = getTenantId(request);
  if (!tenantId) {
    throw new Error('Missing x-tenant-id header');
  }
  return tenantId;
}
