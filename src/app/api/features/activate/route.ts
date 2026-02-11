import { NextRequest, NextResponse } from 'next/server';
import { withTenant } from '@/lib/with-tenant';
import { activateFeature } from '@/lib/feature-gate';
import { db } from '@/db';
import { featureCatalog, tenants } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const activateSchema = z.object({
  featureId: z.string().min(1),
});

export const POST = withTenant(async (request: NextRequest, { tenantId }) => {
  try {
    const body = await request.json();
    const parsed = activateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const { featureId } = parsed.data;

    // Verify feature exists in catalog
    const feature = db
      .select()
      .from(featureCatalog)
      .where(eq(featureCatalog.id, featureId))
      .get();

    if (!feature) {
      return NextResponse.json({ error: 'Feature not found' }, { status: 404 });
    }

    // Payment validation: free plan can only activate free features
    if (!feature.isFree) {
      const tenant = db
        .select()
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .get();

      if (tenant?.plan === 'free') {
        return NextResponse.json(
          {
            error: '此功能需要升級方案才能啟用',
            requiredAction: 'upgrade',
            featurePrice: feature.priceMonthly,
          },
          { status: 403 }
        );
      }
    }

    activateFeature(tenantId, featureId);

    return NextResponse.json({
      success: true,
      featureId,
      featureName: feature.name,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
