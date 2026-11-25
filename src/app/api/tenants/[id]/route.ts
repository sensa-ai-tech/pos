import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { tenants } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getTenantId } from '@/lib/tenant-context';

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const tenantId = await getTenantId(request);
  if (!tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (tenantId !== params.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const tenant = db.select().from(tenants).where(eq(tenants.id, params.id)).get();
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
  }
  return NextResponse.json(tenant);
}
