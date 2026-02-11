import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { tenants } from '@/db/schema';
import { getTenantId, validateTenant } from '@/lib/tenant-context';
import { z } from 'zod';

const createTenantSchema = z.object({
  name: z.string().min(1),
  industry: z.enum(['restaurant', 'retail', 'medical', 'service', 'cafe', 'gym', 'education', 'petshop', 'repair', 'beauty']),
  plan: z.enum(['free', 'basic', 'pro', 'enterprise']).optional(),
});

export async function GET(request: NextRequest) {
  const tenantId = getTenantId(request);
  if (!tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tenant = validateTenant(tenantId);
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
  }

  return NextResponse.json(tenant);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createTenantSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const newTenant = {
      id,
      name: parsed.data.name,
      industry: parsed.data.industry,
      plan: parsed.data.plan ?? ('free' as const),
      createdAt: new Date(),
    };

    db.insert(tenants).values(newTenant).run();

    return NextResponse.json(newTenant, { status: 201 });
  } catch (error) {
    console.error('Failed to create tenant:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
