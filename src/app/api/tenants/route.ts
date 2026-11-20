import { NextRequest, NextResponse } from 'next/server';
import { getTenantId, validateTenant } from '@/lib/tenant-context';

export async function GET(request: NextRequest) {
  const tenantId = await getTenantId(request);
  if (!tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tenant = validateTenant(tenantId);
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
  }

  return NextResponse.json(tenant);
}

// Tenant creation is only available through POST /api/tenants/setup (which also creates the owner
// and a signed session). Anonymous creation via POST /api/tenants was removed.
