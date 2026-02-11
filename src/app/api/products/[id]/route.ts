import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { products } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { getTenantId } from '@/lib/tenant-context';

const updateProductSchema = z.object({
  categoryId: z.string().optional().nullable(),
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  price: z.number().positive().optional(),
  cost: z.number().optional().nullable(),
  sku: z.string().optional().nullable(),
  barcode: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  stockQuantity: z.number().int().min(0).optional(),
  lowStockThreshold: z.number().int().min(0).optional(),
  metadata: z.string().optional().nullable(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const tenantId = getTenantId(request);
  if (!tenantId) {
    return NextResponse.json({ error: 'Missing x-tenant-id header' }, { status: 400 });
  }

  const product = db.select().from(products)
    .where(and(eq(products.id, params.id), eq(products.tenantId, tenantId)))
    .get();

  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  return NextResponse.json(product);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const tenantId = getTenantId(request);
  if (!tenantId) {
    return NextResponse.json({ error: 'Missing x-tenant-id header' }, { status: 400 });
  }

  const existing = db.select().from(products)
    .where(and(eq(products.id, params.id), eq(products.tenantId, tenantId)))
    .get();

  if (!existing) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  try {
    const body = await request.json();
    const parsed = updateProductSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
    }

    db.update(products)
      .set(parsed.data)
      .where(and(eq(products.id, params.id), eq(products.tenantId, tenantId)))
      .run();

    const updated = db.select().from(products)
      .where(eq(products.id, params.id))
      .get();

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const tenantId = getTenantId(request);
  if (!tenantId) {
    return NextResponse.json({ error: 'Missing x-tenant-id header' }, { status: 400 });
  }

  const existing = db.select().from(products)
    .where(and(eq(products.id, params.id), eq(products.tenantId, tenantId)))
    .get();

  if (!existing) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  db.delete(products)
    .where(and(eq(products.id, params.id), eq(products.tenantId, tenantId)))
    .run();

  return NextResponse.json({ success: true });
}
