import { NextRequest, NextResponse } from 'next/server';
import { getTenantId } from '@/lib/tenant-context';
import { getTenantFeatures, getAllFeatures } from '@/lib/feature-gate';

export async function GET(request: NextRequest) {
  const tenantId = getTenantId(request);
  if (!tenantId) {
    return NextResponse.json({ error: 'Unauthorized: tenant identification required' }, { status: 401 });
  }

  const allFeatures = getAllFeatures();
  const tenantFeaturesData = getTenantFeatures(tenantId);

  const activeIds = new Set(
    tenantFeaturesData.filter((f) => f.isActive).map((f) => f.featureId)
  );

  const result = allFeatures.map((f) => ({
    featureId: f.id,
    featureName: f.name,
    featureDescription: f.description,
    category: f.category,
    priceMonthly: f.priceMonthly,
    isFree: f.isFree,
    isActive: activeIds.has(f.id),
  }));

  return NextResponse.json(result);
}
