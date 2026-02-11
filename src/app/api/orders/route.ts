import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { orders, orderItems, payments, products } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';
import { getTenantId, validateTenant } from '@/lib/tenant-context';
import { sqlite } from '@/db';

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
  metadata: z.string().max(5000).optional().nullable(),
  taxRate: z.number().min(0).max(1).optional(),
  discount: z.number().min(0).max(999999).finite().optional(),
});

export async function GET(request: NextRequest) {
  const tenantId = getTenantId(request);
  if (!tenantId) {
    return NextResponse.json({ error: 'Missing x-tenant-id header' }, { status: 400 });
  }

  const tenant = validateTenant(tenantId);
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
  }

  const allOrders = db.select().from(orders)
    .where(eq(orders.tenantId, tenantId))
    .orderBy(desc(orders.createdAt))
    .all();

  return NextResponse.json(allOrders);
}

export async function POST(request: NextRequest) {
  const tenantId = getTenantId(request);
  if (!tenantId) {
    return NextResponse.json({ error: 'Missing x-tenant-id header' }, { status: 400 });
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

    const { items, paymentMethod, customerId, notes, metadata, taxRate = 0.05, discount = 0 } = parsed.data;

    // Pre-validate products exist and belong to this tenant
    const productDetails: Array<{ id: string; name: string; price: number; stockQuantity: number }> = [];
    for (const item of items) {
      const product = db.select().from(products)
        .where(and(eq(products.id, item.productId), eq(products.tenantId, tenantId)))
        .get();

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
      // Re-check stock inside transaction to prevent race condition
      for (const item of items) {
        const freshProduct = db.select().from(products)
          .where(eq(products.id, item.productId))
          .get();

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

      // Deduct inventory atomically using SQL expression
      for (const item of items) {
        sqlite.prepare(
          `UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?`
        ).run(item.quantity, item.productId);
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
