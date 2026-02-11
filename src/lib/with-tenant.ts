import { NextRequest, NextResponse } from 'next/server';
import { getTenantId, validateTenant } from './tenant-context';

type ApiHandler = (
  request: NextRequest,
  context: { tenantId: string }
) => Promise<NextResponse> | NextResponse;

export function withTenant(handler: ApiHandler) {
  return async (request: NextRequest, _routeContext?: unknown) => {
    const tenantId = getTenantId(request);
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Unauthorized: tenant identification required' },
        { status: 401 }
      );
    }

    const tenant = validateTenant(tenantId);
    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }

    return handler(request, { tenantId });
  };
}
