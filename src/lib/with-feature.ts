import { NextRequest, NextResponse } from 'next/server';
import { hasFeature } from '@/lib/feature-gate';
import { withTenant } from '@/lib/with-tenant';

type FeatureHandler = (
  request: NextRequest,
  context: { tenantId: string }
) => Promise<NextResponse> | NextResponse;

export function withFeature(featureId: string, handler: FeatureHandler) {
  return withTenant(async (request: NextRequest, context: { tenantId: string }) => {
    if (!hasFeature(context.tenantId, featureId)) {
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
  });
}
