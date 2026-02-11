import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { products } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getTenantId, validateTenant } from '@/lib/tenant-context';

const createProductSchema = z.object({
  categoryId: z.string().optional().nullable(),
  name: z.string().trim().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  price: z.number().positive().finite().max(99999999),
  cost: z.number().finite().optional().nullable(),
  sku: z.string().max(100).optional().nullable(),
  barcode: z.string().max(100).optional().nullable(),
  imageUrl: z.string().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
  stockQuantity: z.number().int().min(0).max(9999999).optional(),
  lowStockThreshold: z.number().int().min(0).max(9999999).optional(),
  metadata: z.string().max(5000).optional().nullable(),
});

export async function GET(request: NextRequest) {
  const tenantId = getTenantId(request);
  if (!tenantId) {
    return NextResponse.json({ error: 'Unauthorized: tenant identification required' }, { status: 401 });
  }

  const tenant = validateTenant(tenantId);
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));
  const offset = (page - 1) * limit;

  const countResult = db.select({ count: sql<number>`count(*)` })
    .from(products)
    .where(eq(products.tenantId, tenantId))
    .get();
  const total = countResult?.count ?? 0;

  const allProducts = db.select()
    .from(products)
    .where(eq(products.tenantId, tenantId))
    .limit(limit)
    .offset(offset)
    .all();

  return NextResponse.json({
    data: allProducts,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function POST(request: NextRequest) {
  const tenantId = getTenantId(request);
  if (!tenantId) {
    return NextResponse.json({ error: 'Unauthorized: tenant identification required' }, { status: 401 });
  }

  const tenant = validateTenant(tenantId);
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
  }

  try {
    const body = await request.json();
    const parsed = createProductSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const newProduct = {
      id,
      tenantId,
      categoryId: parsed.data.categoryId ?? null,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      price: parsed.data.price,
      cost: parsed.data.cost ?? null,
      sku: parsed.data.sku ?? null,
      barcode: parsed.data.barcode ?? null,
      imageUrl: parsed.data.imageUrl ?? null,
      isActive: parsed.data.isActive ?? true,
      stockQuantity: parsed.data.stockQuantity ?? 0,
      lowStockThreshold: parsed.data.lowStockThreshold ?? 5,
      metadata: parsed.data.metadata ?? null,
      createdAt: new Date(),
    };

    db.insert(products).values(newProduct).run();

    return NextResponse.json(newProduct, { status: 201 });
  } catch (error) {
    console.error('Failed to create product:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
