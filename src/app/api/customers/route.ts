import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { customers } from '@/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getTenantId } from '@/lib/tenant-context';
import { hasFeature } from '@/lib/feature-gate';

const createCustomerSchema = z.object({
  name: z.string().trim().min(1).max(100),
  phone: z.string().trim().max(20).optional().nullable(),
  email: z.string().email().max(200).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export async function GET(request: NextRequest) {
  const tenantId = getTenantId(request);
  if (!tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasFeature(tenantId, 'crm')) {
    return NextResponse.json({ error: 'Feature not enabled', feature: 'crm' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));
  const offset = (page - 1) * limit;

  const countResult = db.select({ count: sql<number>`count(*)` })
    .from(customers)
    .where(eq(customers.tenantId, tenantId))
    .get();
  const total = countResult?.count ?? 0;

  const data = db.select().from(customers)
    .where(eq(customers.tenantId, tenantId))
    .orderBy(desc(customers.createdAt))
    .limit(limit)
    .offset(offset)
    .all();

  return NextResponse.json({
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function POST(request: NextRequest) {
  const tenantId = getTenantId(request);
  if (!tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasFeature(tenantId, 'crm')) {
    return NextResponse.json({ error: 'Feature not enabled', feature: 'crm' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = createCustomerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
    }

    const id = crypto.randomUUID();
    db.insert(customers).values({
      id,
      tenantId,
      name: parsed.data.name,
      phone: parsed.data.phone ?? null,
      email: parsed.data.email ?? null,
      notes: parsed.data.notes ?? null,
      totalSpent: 0,
      visitCount: 0,
      createdAt: new Date(),
    }).run();

    const created = db.select().from(customers).where(eq(customers.id, id)).get();
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('Customer creation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
