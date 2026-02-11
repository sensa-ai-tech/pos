import { NextRequest, NextResponse } from 'next/server';
import { getTenantId } from '@/lib/tenant-context';
import { activateFeature } from '@/lib/feature-gate';
import { db } from '@/db';
import { featureCatalog } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const activateSchema = z.object({
  featureId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const tenantId = getTenantId(request);
  if (!tenantId) {
    return NextResponse.json({ error: 'Tenant ID required' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = activateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const { featureId } = parsed.data;

    // Verify feature exists
    const feature = db
      .select()
      .from(featureCatalog)
      .where(eq(featureCatalog.id, featureId))
      .get();

    if (!feature) {
      return NextResponse.json({ error: 'Feature not found' }, { status: 404 });
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
}
