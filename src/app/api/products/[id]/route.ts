import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { products } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { getTenantId } from '@/lib/tenant-context';

const updateProductSchema = z.object({
  categoryId: z.string().optional().nullable(),
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  price: z.number().positive().finite().max(99999999).optional(),
  cost: z.number().finite().optional().nullable(),
  sku: z.string().max(100).optional().nullable(),
  barcode: z.string().max(100).optional().nullable(),
  imageUrl: z.string().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
  stockQuantity: z.number().int().min(0).max(9999999).optional(),
  lowStockThreshold: z.number().int().min(0).max(9999999).optional(),
  metadata: z.string().max(5000).optional().nullable(),
});

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const tenantId = getTenantId(request);
  if (!tenantId) {
    return NextResponse.json({ error: 'Unauthorized: tenant identification required' }, { status: 401 });
  }

  const product = db.select().from(products)
    .where(and(eq(products.id, params.id), eq(products.tenantId, tenantId)))
    .get();

  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  return NextResponse.json(product);
}

export async function PUT(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const tenantId = getTenantId(request);
  if (!tenantId) {
    return NextResponse.json({ error: 'Unauthorized: tenant identification required' }, { status: 401 });
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
  } catch (error) {
    console.error('Failed to update product:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const tenantId = getTenantId(request);
  if (!tenantId) {
    return NextResponse.json({ error: 'Unauthorized: tenant identification required' }, { status: 401 });
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
