import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { orders, orderItems, payments, products } from '@/db/schema';
import { eq, and, desc, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getTenantId, validateTenant } from '@/lib/tenant-context';
import { sqlite } from '@/db';

export const DEFAULT_TAX_RATE = 0.05;
const MAX_DISCOUNT = 999999;
const MAX_METADATA_LENGTH = 5000;

const orderItemSchema = z.object({
  productId: z.string(),
  quantity: z.number().int().positive(),
  notes: z.string().optional().nullable(),
});

const createOrderSchema = z.object({
  items: z.array(orderItemSchema).min(1),
  paymentMethod: z.enum(['cash', 'card', 'transfer', 'other']),
  customerId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  metadata: z.string().max(MAX_METADATA_LENGTH).optional().nullable(),
  taxRate: z.number().min(0).max(1).optional(),
  discount: z.number().min(0).max(MAX_DISCOUNT).finite().optional(),
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
    .from(orders)
    .where(eq(orders.tenantId, tenantId))
    .get();
  const total = countResult?.count ?? 0;

  const allOrders = db.select().from(orders)
    .where(eq(orders.tenantId, tenantId))
    .orderBy(desc(orders.createdAt))
    .limit(limit)
    .offset(offset)
    .all();

  return NextResponse.json({
    data: allOrders,
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
    const parsed = createOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
    }

    const { items, paymentMethod, customerId, notes, metadata, taxRate = DEFAULT_TAX_RATE, discount = 0 } = parsed.data;

    // Batch-fetch all products in one query (eliminates N+1)
    const productIds = items.map((item) => item.productId);
    const fetchedProducts = db.select().from(products)
      .where(and(inArray(products.id, productIds), eq(products.tenantId, tenantId)))
      .all();

    const productMap = new Map(fetchedProducts.map((p) => [p.id, p]));

    // Validate all products exist, are active, and belong to tenant
    const productDetails: Array<{ id: string; name: string; price: number; stockQuantity: number }> = [];
    for (const item of items) {
      const product = productMap.get(item.productId);

      if (!product) {
        return NextResponse.json({ error: `Product not found: ${item.productId}` }, { status: 400 });
      }

      if (!product.isActive) {
        return NextResponse.json({ error: `Product is inactive: ${product.name}` }, { status: 400 });
      }

      productDetails.push({
        id: product.id,
        name: product.name,
        price: product.price,
        stockQuantity: product.stockQuantity,
      });
    }

    // Calculate totals
    let subtotal = 0;
    const orderItemsData = items.map((item, idx) => {
      const product = productDetails[idx];
      const itemSubtotal = product.price * item.quantity;
      subtotal += itemSubtotal;
      return {
        id: crypto.randomUUID(),
        productId: item.productId,
        productName: product.name,
        quantity: item.quantity,
        unitPrice: product.price,
        subtotal: itemSubtotal,
        notes: item.notes ?? null,
      };
    });

    const tax = Math.round(subtotal * taxRate * 100) / 100;
    // Cap discount to prevent negative total
    const effectiveDiscount = Math.min(discount, subtotal + tax);
    const total = Math.max(0, subtotal + tax - effectiveDiscount);
    const orderId = crypto.randomUUID();
    const now = new Date();
    const orderNumber = `ORD-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${crypto.randomUUID().substring(0, 8).toUpperCase()}`;

    // Execute in transaction — stock check inside for atomicity
    const createOrder = sqlite.transaction(() => {
      // Batch re-check stock inside transaction to prevent race condition
      const freshProducts = db.select().from(products)
        .where(inArray(products.id, productIds))
        .all();

      const freshMap = new Map(freshProducts.map((p) => [p.id, p]));

      for (const item of items) {
        const freshProduct = freshMap.get(item.productId);

        if (!freshProduct || freshProduct.stockQuantity < item.quantity) {
          throw new Error(
            `Insufficient stock for ${freshProduct?.name ?? item.productId}: ` +
            `available ${freshProduct?.stockQuantity ?? 0}, requested ${item.quantity}`
          );
        }
      }

      // Create order
      db.insert(orders).values({
        id: orderId,
        tenantId,
        orderNumber,
        customerId: customerId ?? null,
        status: 'completed',
        subtotal,
        tax,
        discount: effectiveDiscount,
        total,
        paymentMethod,
        notes: notes ?? null,
        metadata: metadata ?? null,
        createdAt: now,
      }).run();

      // Create order items
      for (const item of orderItemsData) {
        db.insert(orderItems).values({
          ...item,
          orderId,
        }).run();
      }

      // Create payment
      db.insert(payments).values({
        id: crypto.randomUUID(),
        tenantId,
        orderId,
        amount: total,
        method: paymentMethod,
        status: 'completed',
        createdAt: now,
      }).run();

      // Deduct inventory atomically using Drizzle SQL expression
      for (const item of items) {
        db.update(products)
          .set({ stockQuantity: sql`stock_quantity - ${item.quantity}` })
          .where(eq(products.id, item.productId))
          .run();
      }
    });

    try {
      createOrder();
    } catch (txError) {
      const msg = txError instanceof Error ? txError.message : 'Transaction failed';
      if (msg.includes('Insufficient stock')) {
        return NextResponse.json({ error: msg }, { status: 400 });
      }
      throw txError;
    }

    const createdOrder = db.select().from(orders).where(eq(orders.id, orderId)).get();
    const createdItems = db.select().from(orderItems).where(eq(orderItems.orderId, orderId)).all();

    return NextResponse.json({ ...createdOrder, items: createdItems }, { status: 201 });
  } catch (error) {
    console.error('Order creation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
