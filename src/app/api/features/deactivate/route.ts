import { NextRequest, NextResponse } from 'next/server';
import { getTenantId } from '@/lib/tenant-context';
import { deactivateFeature } from '@/lib/feature-gate';
import { z } from 'zod';

const deactivateSchema = z.object({
  featureId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const tenantId = getTenantId(request);
  if (!tenantId) {
    return NextResponse.json({ error: 'Unauthorized: tenant identification required' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = deactivateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const { featureId } = parsed.data;
    deactivateFeature(tenantId, featureId);

    return NextResponse.json({ success: true, featureId });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
