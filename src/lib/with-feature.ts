import { NextRequest, NextResponse } from 'next/server';
import { getTenantId } from '@/lib/tenant-context';
import { hasFeature } from '@/lib/feature-gate';

type RouteHandler = (
  request: NextRequest,
  context?: { params: Record<string, string> }
) => Promise<NextResponse>;

export function withFeature(featureId: string, handler: RouteHandler): RouteHandler {
  return async (request: NextRequest, context?) => {
    const tenantId = getTenantId(request);
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID required' }, { status: 401 });
    }

    if (!hasFeature(tenantId, featureId)) {
      return NextResponse.json(
        {
          error: 'Feature not available',
          feature: featureId,
          upgrade: true,
          message: '此功能需要升級方案才能使用',
        },
        { status: 403 }
      );
    }

    return handler(request, context);
  };
}
